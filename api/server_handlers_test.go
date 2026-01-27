package api

import (
	"aspen/auth"
	"aspen/config"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// Test helpers
// ============================================================

func init() {
	gin.SetMode(gin.TestMode)
	auth.SetJWTSecret("handler-test-jwt-secret-1234567890")
}

// setupTestRouter creates a minimal gin router with the health, CORS, and auth middleware.
// It does NOT require a database — only tests that don't touch DB.
func setupTestRouter() *gin.Engine {
	router := gin.New()
	router.Use(corsMiddleware())
	return router
}

// createTestDB sets up a real temp SQLite DB for integration-style tests.
func createTestDB(t *testing.T) *config.Database {
	t.Helper()
	dir := t.TempDir()
	db, err := config.NewDatabase(dir + "/test.db")
	require.NoError(t, err)
	return db
}

// generateValidToken creates a JWT for testing authenticated endpoints.
func generateValidToken(t *testing.T, userID, email string) string {
	t.Helper()
	token, err := auth.GenerateJWT(userID, email)
	require.NoError(t, err)
	return token
}

// ============================================================
// Health endpoint
// ============================================================

func TestHealthEndpoint_Returns200(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.Equal(t, "ok", body["status"])
}

// ============================================================
// CORS headers
// ============================================================

func TestCORSHeaders_Present(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"msg": "hello"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
}

func TestCORS_OptionsReturns200(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/anything", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/api/anything", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ============================================================
// Auth middleware
// ============================================================

func TestAuthMiddleware_MissingToken_Returns401(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}

	router := setupTestRouter()
	protected := router.Group("/api", s.authMiddleware())
	protected.GET("/secret", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": "hidden"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/secret", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_InvalidFormat_Returns401(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}

	router := setupTestRouter()
	protected := router.Group("/api", s.authMiddleware())
	protected.GET("/secret", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": "hidden"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/secret", nil)
	req.Header.Set("Authorization", "NotBearer some-token")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_InvalidToken_Returns401(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}

	router := setupTestRouter()
	protected := router.Group("/api", s.authMiddleware())
	protected.GET("/secret", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": "hidden"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/secret", nil)
	req.Header.Set("Authorization", "Bearer totally-invalid-jwt")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_ValidToken_Passes(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}

	router := setupTestRouter()
	protected := router.Group("/api", s.authMiddleware())
	protected.GET("/secret", func(c *gin.Context) {
		userID := c.GetString("user_id")
		email := c.GetString("email")
		c.JSON(http.StatusOK, gin.H{"user_id": userID, "email": email})
	})

	token := generateValidToken(t, "user-42", "alice@test.com")

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/secret", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	assert.Equal(t, "user-42", body["user_id"])
	assert.Equal(t, "alice@test.com", body["email"])
}

func TestAuthMiddleware_BlacklistedToken_Returns401(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}

	router := setupTestRouter()
	protected := router.Group("/api", s.authMiddleware())
	protected.GET("/secret", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": "hidden"})
	})

	token := generateValidToken(t, "user-99", "bob@test.com")

	// Blacklist the token
	claims, err := auth.ValidateJWT(token)
	require.NoError(t, err)
	auth.BlacklistToken(token, claims.ExpiresAt.Time)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/secret", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// ============================================================
// Register endpoint
// ============================================================

func TestRegister_MissingFields_Returns400(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}

	router := setupTestRouter()
	router.POST("/api/register", s.handleRegister)

	tests := []struct {
		name string
		body string
	}{
		{"missing email", `{"password": "abcdef"}`},
		{"missing password", `{"email": "test@test.com"}`},
		{"invalid email format", `{"email": "not-an-email", "password": "abcdef"}`},
		{"password too short", `{"email": "test@test.com", "password": "abc"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/api/register", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestRegister_ValidRequest_ReturnsOTP(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}

	router := setupTestRouter()
	router.POST("/api/register", s.handleRegister)

	body := `{"email": "newuser@example.com", "password": "securepass123"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.NotEmpty(t, resp["user_id"])
	assert.NotEmpty(t, resp["otp_secret"])
	assert.NotEmpty(t, resp["qr_code_url"])
	assert.Equal(t, "newuser@example.com", resp["email"])
}

func TestRegister_DuplicateEmail_Returns409(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	// Pre-create a verified user
	hash, _ := auth.HashPassword("password")
	user := &config.User{
		ID:           "existing-user",
		Email:        "taken@example.com",
		PasswordHash: hash,
		OTPSecret:    "FAKESECRET",
		OTPVerified:  true,
	}
	require.NoError(t, db.CreateUser(user))

	s := &Server{database: db}
	router := setupTestRouter()
	router.POST("/api/register", s.handleRegister)

	body := `{"email": "taken@example.com", "password": "newpass123"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)
}

// ============================================================
// Login endpoint
// ============================================================

func TestLogin_MissingFields_Returns400(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}
	router := setupTestRouter()
	router.POST("/api/login", s.handleLogin)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/login", bytes.NewBufferString(`{"email": "a@b.com"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestLogin_WrongCredentials_Returns401(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}
	router := setupTestRouter()
	router.POST("/api/login", s.handleLogin)

	body := `{"email": "nobody@example.com", "password": "wrongpass"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestLogin_ValidCredentials_RequiresOTP(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	// Create a verified user
	hash, _ := auth.HashPassword("correctpass")
	user := &config.User{
		ID:           "login-user",
		Email:        "login@example.com",
		PasswordHash: hash,
		OTPSecret:    "ABCDEFGH",
		OTPVerified:  true,
	}
	require.NoError(t, db.CreateUser(user))

	s := &Server{database: db}
	router := setupTestRouter()
	router.POST("/api/login", s.handleLogin)

	body := `{"email": "login@example.com", "password": "correctpass"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, true, resp["requires_otp"])
	assert.Equal(t, "login-user", resp["user_id"])
}

// ============================================================
// Logout endpoint
// ============================================================

func TestLogout_ValidToken_Blacklists(t *testing.T) {
	db := createTestDB(t)
	defer db.Close()

	s := &Server{database: db}
	router := setupTestRouter()
	router.POST("/api/logout", s.authMiddleware(), s.handleLogout)

	token := generateValidToken(t, "logout-user", "logout@test.com")

	// First logout should succeed
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/logout", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Token should now be blacklisted
	assert.True(t, auth.IsTokenBlacklisted(token))
}

// ============================================================
// Request struct serialization
// ============================================================

func TestCreateTraderRequest_JSONParsing(t *testing.T) {
	jsonData := `{
		"name": "My Trader",
		"ai_model_id": "deepseek",
		"exchange_id": "binance",
		"initial_balance": 5000,
		"scan_interval_minutes": 5,
		"btc_eth_leverage": 10,
		"altcoin_leverage": 5,
		"trading_symbols": "BTCUSDT,ETHUSDT",
		"custom_prompt": "be aggressive",
		"override_base_prompt": false,
		"system_prompt_template": "hybrid",
		"is_cross_margin": true,
		"use_coin_pool": true,
		"use_oi_top": false
	}`

	var req CreateTraderRequest
	err := json.Unmarshal([]byte(jsonData), &req)
	require.NoError(t, err)
	assert.Equal(t, "My Trader", req.Name)
	assert.Equal(t, "deepseek", req.AIModelID)
	assert.Equal(t, "binance", req.ExchangeID)
	assert.Equal(t, 5000.0, req.InitialBalance)
	assert.Equal(t, 10, req.BTCETHLeverage)
	assert.Equal(t, 5, req.AltcoinLeverage)
	assert.Equal(t, "BTCUSDT,ETHUSDT", req.TradingSymbols)
	assert.Equal(t, "hybrid", req.SystemPromptTemplate)
	assert.NotNil(t, req.IsCrossMargin)
	assert.True(t, *req.IsCrossMargin)
	assert.True(t, req.UseCoinPool)
	assert.False(t, req.UseOITop)
}
