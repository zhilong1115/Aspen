package auth

import (
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---- helpers ----

func init() {
	// Ensure a JWT secret is set for all tests in this package.
	SetJWTSecret("test-secret-key-for-unit-tests-1234567890")
}

// resetBlacklist clears the in-memory blacklist between tests.
func resetBlacklist() {
	tokenBlacklist.Lock()
	tokenBlacklist.items = make(map[string]time.Time)
	tokenBlacklist.Unlock()
	db = nil // detach any mock DB
}

// mockDB implements DatabaseLike for in-memory persistence tests.
type mockDB struct {
	mu     sync.Mutex
	tokens map[string]time.Time
}

func newMockDB() *mockDB {
	return &mockDB{tokens: make(map[string]time.Time)}
}

func (m *mockDB) BlacklistToken(tokenHash string, expiresAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tokens[tokenHash] = expiresAt
	return nil
}

func (m *mockDB) IsTokenBlacklisted(tokenHash string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	exp, ok := m.tokens[tokenHash]
	if !ok {
		return false
	}
	return time.Now().Before(exp)
}

func (m *mockDB) CleanExpiredTokens() (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	var cleaned int64
	for h, exp := range m.tokens {
		if now.After(exp) {
			delete(m.tokens, h)
			cleaned++
		}
	}
	return cleaned, nil
}

func (m *mockDB) GetAllBlacklistedTokens() (map[string]time.Time, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make(map[string]time.Time, len(m.tokens))
	for k, v := range m.tokens {
		out[k] = v
	}
	return out, nil
}

// ---- JWT tests ----

func TestGenerateToken_CreatesValidJWT(t *testing.T) {
	resetBlacklist()

	tokenStr, err := GenerateJWT("user-123", "test@example.com")
	require.NoError(t, err)
	assert.NotEmpty(t, tokenStr)

	// Should be parseable
	claims, err := ValidateJWT(tokenStr)
	require.NoError(t, err)
	assert.Equal(t, "user-123", claims.UserID)
	assert.Equal(t, "test@example.com", claims.Email)
	assert.Equal(t, "Aspen", claims.Issuer)
}

func TestGenerateJWT_ContainsExpiry(t *testing.T) {
	resetBlacklist()

	tokenStr, err := GenerateJWT("u1", "u1@test.com")
	require.NoError(t, err)

	claims, err := ValidateJWT(tokenStr)
	require.NoError(t, err)
	require.NotNil(t, claims.ExpiresAt)
	// Token should expire ~24h from now
	diff := time.Until(claims.ExpiresAt.Time)
	assert.InDelta(t, 24*time.Hour.Seconds(), diff.Seconds(), 10, "token should expire in ~24h")
}

func TestValidateToken_RejectsExpired(t *testing.T) {
	resetBlacklist()

	// Create a token that expired 1 second ago via direct claims.
	claims := Claims{
		UserID: "user-expired",
		Email:  "expired@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			NotBefore: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			Issuer:    "Aspen",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(JWTSecret)
	require.NoError(t, err)

	_, err = ValidateJWT(tokenStr)
	assert.Error(t, err, "expired token should fail validation")
}

func TestValidateToken_RejectsMalformed(t *testing.T) {
	resetBlacklist()

	_, err := ValidateJWT("not-a-jwt-token")
	assert.Error(t, err)
}

func TestValidateToken_RejectsEmptyString(t *testing.T) {
	resetBlacklist()

	_, err := ValidateJWT("")
	assert.Error(t, err)
}

func TestValidateToken_RejectsWrongSecret(t *testing.T) {
	resetBlacklist()

	// Generate with the current secret
	tokenStr, err := GenerateJWT("user-1", "u@e.com")
	require.NoError(t, err)

	// Swap secret
	old := make([]byte, len(JWTSecret))
	copy(old, JWTSecret)
	SetJWTSecret("different-secret")
	defer func() { JWTSecret = old }()

	_, err = ValidateJWT(tokenStr)
	assert.Error(t, err, "token signed with old secret should be rejected")
}

// ---- Blacklist tests ----

func TestBlacklistToken_BlocksAfterBlacklisting(t *testing.T) {
	resetBlacklist()

	token := "some-token-to-blacklist"
	assert.False(t, IsTokenBlacklisted(token))

	BlacklistToken(token, time.Now().Add(10*time.Minute))
	assert.True(t, IsTokenBlacklisted(token))
}

func TestBlacklist_ExpiredTokenAutoCleared(t *testing.T) {
	resetBlacklist()

	token := "already-expired"
	// Blacklist with an already-past expiry
	BlacklistToken(token, time.Now().Add(-1*time.Second))

	// Should NOT be considered blacklisted (auto-cleaned on check)
	assert.False(t, IsTokenBlacklisted(token))
}

func TestBlacklist_DifferentTokensIndependent(t *testing.T) {
	resetBlacklist()

	BlacklistToken("token-A", time.Now().Add(10*time.Minute))
	assert.True(t, IsTokenBlacklisted("token-A"))
	assert.False(t, IsTokenBlacklisted("token-B"))
}

func TestBlacklist_Persistence_WithMockDB(t *testing.T) {
	resetBlacklist()
	mdb := newMockDB()
	SetDatabase(mdb)
	defer func() { db = nil }()

	token := "persist-me"
	exp := time.Now().Add(5 * time.Minute)
	BlacklistToken(token, exp)

	// Memory check
	assert.True(t, IsTokenBlacklisted(token))

	// Simulate restart: clear memory, load from DB
	tokenBlacklist.Lock()
	tokenBlacklist.items = make(map[string]time.Time)
	tokenBlacklist.Unlock()

	// Memory is empty, but DB should have it
	assert.True(t, IsTokenBlacklisted(token), "should find token via DB fallback")

	// After DB fallback, memory should be back-filled
	tokenBlacklist.RLock()
	_, inMem := tokenBlacklist.items[hashToken(token)]
	tokenBlacklist.RUnlock()
	assert.True(t, inMem, "should be back-filled into memory after DB lookup")
}

func TestLoadBlacklistFromDB(t *testing.T) {
	resetBlacklist()
	mdb := newMockDB()
	SetDatabase(mdb)
	defer func() { db = nil }()

	// Pre-populate mock DB
	h := hashToken("preloaded-token")
	mdb.tokens[h] = time.Now().Add(10 * time.Minute)

	LoadBlacklistFromDB()

	tokenBlacklist.RLock()
	_, found := tokenBlacklist.items[h]
	tokenBlacklist.RUnlock()
	assert.True(t, found, "LoadBlacklistFromDB should populate memory cache")
}

// ---- Password hash tests ----

func TestHashPassword_RoundTrip(t *testing.T) {
	password := "mysecurepassword123!"
	hash, err := HashPassword(password)
	require.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.NotEqual(t, password, hash, "hash should differ from plaintext")

	assert.True(t, CheckPassword(password, hash), "correct password should verify")
	assert.False(t, CheckPassword("wrong-password", hash), "wrong password should not verify")
}

func TestCheckPassword_EmptyInputs(t *testing.T) {
	hash, err := HashPassword("abc123")
	require.NoError(t, err)

	assert.False(t, CheckPassword("", hash), "empty password should fail")
	assert.False(t, CheckPassword("abc123", ""), "empty hash should fail")
}

func TestHashPassword_DifferentHashesForSamePassword(t *testing.T) {
	hash1, err := HashPassword("samepass")
	require.NoError(t, err)
	hash2, err := HashPassword("samepass")
	require.NoError(t, err)
	// bcrypt includes a random salt, so hashes should differ
	assert.NotEqual(t, hash1, hash2, "bcrypt should produce different hashes due to salt")
	// But both should verify
	assert.True(t, CheckPassword("samepass", hash1))
	assert.True(t, CheckPassword("samepass", hash2))
}

// ---- OTP tests ----

func TestGenerateOTPSecret_UniqueAndNonEmpty(t *testing.T) {
	secret1, err := GenerateOTPSecret()
	require.NoError(t, err)
	assert.NotEmpty(t, secret1)

	secret2, err := GenerateOTPSecret()
	require.NoError(t, err)
	assert.NotEqual(t, secret1, secret2, "two consecutive secrets should differ")
}

func TestVerifyOTP_InvalidCode(t *testing.T) {
	secret, err := GenerateOTPSecret()
	require.NoError(t, err)

	// "000000" is extremely unlikely to be correct at any given moment
	assert.False(t, VerifyOTP(secret, "000000"))
}

func TestVerifyOTP_EmptySecret(t *testing.T) {
	assert.False(t, VerifyOTP("", "123456"))
}

func TestGetOTPQRCodeURL(t *testing.T) {
	url := GetOTPQRCodeURL("JBSWY3DPEHPK3PXP", "alice@example.com")
	assert.Contains(t, url, "otpauth://totp/")
	assert.Contains(t, url, "alice@example.com")
	assert.Contains(t, url, "JBSWY3DPEHPK3PXP")
	assert.Contains(t, url, OTPIssuer)
}

// ---- hashToken test ----

func TestHashToken_Deterministic(t *testing.T) {
	h1 := hashToken("my-token")
	h2 := hashToken("my-token")
	assert.Equal(t, h1, h2, "same input should produce same hash")
	assert.Len(t, h1, 64, "SHA-256 hex should be 64 chars")
}

func TestHashToken_DifferentInputs(t *testing.T) {
	h1 := hashToken("token-a")
	h2 := hashToken("token-b")
	assert.NotEqual(t, h1, h2)
}
