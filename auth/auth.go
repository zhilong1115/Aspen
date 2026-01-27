package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

// JWTSecret JWT密钥，将从配置中动态设置
var JWTSecret []byte

// tokenBlacklist 用于登出后的token黑名单（仅内存，按过期时间清理）
var tokenBlacklist = struct {
	sync.RWMutex
	items map[string]time.Time
}{items: make(map[string]time.Time)}

// maxBlacklistEntries 黑名单最大容量阈值
const maxBlacklistEntries = 100_000

// DatabaseLike 定义auth包所需的数据库接口（用于token黑名单持久化）
type DatabaseLike interface {
	BlacklistToken(tokenHash string, expiresAt time.Time) error
	IsTokenBlacklisted(tokenHash string) bool
	CleanExpiredTokens() (int64, error)
	GetAllBlacklistedTokens() (map[string]time.Time, error)
}

// db 数据库实例，用于持久化token黑名单（可选，nil时仅使用内存）
var db DatabaseLike

// SetDatabase 注入数据库实例以启用token黑名单持久化
func SetDatabase(d DatabaseLike) {
	db = d
}

// hashToken 对token进行SHA-256哈希（安全最佳实践：不存储原始token）
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// LoadBlacklistFromDB 从数据库加载未过期的黑名单token到内存缓存
func LoadBlacklistFromDB() {
	if db == nil {
		return
	}

	tokens, err := db.GetAllBlacklistedTokens()
	if err != nil {
		log.Printf("auth: 从数据库加载token黑名单失败: %v", err)
		return
	}

	tokenBlacklist.Lock()
	defer tokenBlacklist.Unlock()
	for hash, exp := range tokens {
		tokenBlacklist.items[hash] = exp
	}

	log.Printf("auth: 从数据库恢复了 %d 个黑名单token", len(tokens))
}

// StartBlacklistCleaner 启动后台协程定期清理过期的黑名单token
func StartBlacklistCleaner(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			// 清理内存缓存
			now := time.Now()
			tokenBlacklist.Lock()
			for t, e := range tokenBlacklist.items {
				if now.After(e) {
					delete(tokenBlacklist.items, t)
				}
			}
			tokenBlacklist.Unlock()

			// 清理数据库
			if db != nil {
				cleaned, err := db.CleanExpiredTokens()
				if err != nil {
					log.Printf("auth: 清理过期黑名单token失败: %v", err)
				} else if cleaned > 0 {
					log.Printf("auth: 清理了 %d 个过期黑名单token", cleaned)
				}
			}
		}
	}()
}

// OTPIssuer OTP发行者名称
const OTPIssuer = "Aspen"

// SetJWTSecret 设置JWT密钥
func SetJWTSecret(secret string) {
	JWTSecret = []byte(secret)
}

// BlacklistToken 将token加入黑名单直到过期
func BlacklistToken(token string, exp time.Time) {
	hash := hashToken(token)

	// 写入内存缓存
	tokenBlacklist.Lock()
	tokenBlacklist.items[hash] = exp

	// 如果超过容量阈值，则进行一次过期清理；若仍超限，记录警告日志
	if len(tokenBlacklist.items) > maxBlacklistEntries {
		now := time.Now()
		for t, e := range tokenBlacklist.items {
			if now.After(e) {
				delete(tokenBlacklist.items, t)
			}
		}
		if len(tokenBlacklist.items) > maxBlacklistEntries {
			log.Printf("auth: token blacklist size (%d) exceeds limit (%d) after sweep; consider reducing JWT TTL or using a shared persistent store",
				len(tokenBlacklist.items), maxBlacklistEntries)
		}
	}
	tokenBlacklist.Unlock()

	// 持久化到数据库
	if db != nil {
		if err := db.BlacklistToken(hash, exp); err != nil {
			log.Printf("auth: 持久化黑名单token失败: %v", err)
		}
	}
}

// IsTokenBlacklisted 检查token是否在黑名单中（过期自动清理）
func IsTokenBlacklisted(token string) bool {
	hash := hashToken(token)

	// 快速路径：检查内存缓存
	tokenBlacklist.Lock()
	if exp, ok := tokenBlacklist.items[hash]; ok {
		if time.Now().After(exp) {
			delete(tokenBlacklist.items, hash)
			tokenBlacklist.Unlock()
			return false
		}
		tokenBlacklist.Unlock()
		return true
	}
	tokenBlacklist.Unlock()

	// 慢速路径：检查数据库
	if db != nil {
		if db.IsTokenBlacklisted(hash) {
			// 从数据库找到，回填到内存缓存（下次查询走快速路径）
			// 注意：这里不知道精确的过期时间，用一个合理的TTL
			// 实际上token不会在DB中过期后还返回true，所以这里的过期时间不太关键
			tokenBlacklist.Lock()
			tokenBlacklist.items[hash] = time.Now().Add(24 * time.Hour)
			tokenBlacklist.Unlock()
			return true
		}
	}

	return false
}

// Claims JWT声明
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// HashPassword 哈希密码
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword 验证密码
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateOTPSecret 生成OTP密钥
func GenerateOTPSecret() (string, error) {
	secret := make([]byte, 20)
	_, err := rand.Read(secret)
	if err != nil {
		return "", err
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      OTPIssuer,
		AccountName: uuid.New().String(),
	})
	if err != nil {
		return "", err
	}

	return key.Secret(), nil
}

// VerifyOTP 验证OTP码
func VerifyOTP(secret, code string) bool {
	return totp.Validate(code, secret)
}

// GenerateJWT 生成JWT token
func GenerateJWT(userID, email string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)), // 24小时过期
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "Aspen",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

// ValidateJWT 验证JWT token
func ValidateJWT(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("意外的签名方法: %v", token.Header["alg"])
		}
		return JWTSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("无效的token")
}

// GetOTPQRCodeURL 获取OTP二维码URL
func GetOTPQRCodeURL(secret, email string) string {
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", OTPIssuer, email, secret, OTPIssuer)
}
