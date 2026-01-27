package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ============================================================================
// HTTP API Metrics
// ============================================================================

var (
	// HTTPRequestsTotal 总请求数
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	// HTTPRequestDuration 请求延迟
	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "aspen_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0},
		},
		[]string{"method", "path"},
	)

	// HTTPRequestsInFlight 正在处理的请求数
	HTTPRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_http_requests_in_flight",
			Help: "Number of HTTP requests currently being processed",
		},
	)
)

// ============================================================================
// User Metrics
// ============================================================================

var (
	// UsersTotal 总注册用户数
	UsersTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_users_total",
			Help: "Total number of registered users",
		},
	)

	// UsersVerified 完成OTP验证的用户数
	UsersVerified = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_users_verified",
			Help: "Number of users who completed OTP verification",
		},
	)

	// UsersActiveDaily DAU 日活跃用户
	UsersActiveDaily = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_users_active_daily",
			Help: "Daily active users (DAU)",
		},
	)

	// UsersActiveWeekly WAU 周活跃用户
	UsersActiveWeekly = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_users_active_weekly",
			Help: "Weekly active users (WAU)",
		},
	)

	// UsersActiveMonthly MAU 月活跃用户
	UsersActiveMonthly = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_users_active_monthly",
			Help: "Monthly active users (MAU)",
		},
	)

	// UserRegistrationsTotal 注册次数
	UserRegistrationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_user_registrations_total",
			Help: "Total number of user registration attempts",
		},
		[]string{"status"}, // "success", "failed", "duplicate"
	)

	// UserLoginsTotal 登录次数
	UserLoginsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_user_logins_total",
			Help: "Total number of user login attempts",
		},
		[]string{"status"}, // "success", "failed", "otp_required"
	)

	// UserOTPVerificationsTotal OTP验证次数
	UserOTPVerificationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_user_otp_verifications_total",
			Help: "Total number of OTP verification attempts",
		},
		[]string{"status"}, // "success", "failed"
	)

	// UserTradersTotal 用户创建的Trader总数
	UserTradersTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_user_traders_total",
			Help: "Total number of traders created by users",
		},
	)

	// UserTradersRunning 正在运行的Trader数
	UserTradersRunning = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_user_traders_running",
			Help: "Number of currently running traders",
		},
	)

	// UserNewRegistrationsDaily 每日新注册用户
	UserNewRegistrationsDaily = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_user_new_registrations_daily",
			Help: "New user registrations in the last 24 hours",
		},
	)
)

// ============================================================================
// Authentication Metrics
// ============================================================================

var (
	// AuthLoginTotal 登录次数 (deprecated, use UserLoginsTotal)
	AuthLoginTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_auth_login_total",
			Help: "Total number of login attempts",
		},
		[]string{"status"}, // "success", "failed"
	)

	// AuthJWTValidationTotal JWT验证次数
	AuthJWTValidationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_auth_jwt_validation_total",
			Help: "Total number of JWT validation attempts",
		},
		[]string{"status"}, // "success", "failed", "expired"
	)

	// ActiveUsers 活跃用户数（在线用户）
	ActiveUsers = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_active_users",
			Help: "Number of currently active users",
		},
	)
)

// ============================================================================
// AI / Token Usage Metrics
// ============================================================================

var (
	// AIRequestsTotal AI调用总数
	AIRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ai_requests_total",
			Help: "Total number of AI API requests",
		},
		[]string{"provider", "model", "status"}, // status: "success", "failed", "timeout"
	)

	// AIRequestDuration AI请求延迟
	AIRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "aspen_ai_request_duration_seconds",
			Help:    "AI API request duration in seconds",
			Buckets: []float64{1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0, 120.0, 180.0},
		},
		[]string{"provider", "model"},
	)

	// AITokensTotal Token使用总量
	AITokensTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ai_tokens_total",
			Help: "Total number of AI tokens used",
		},
		[]string{"provider", "model", "type"}, // type: "prompt", "completion"
	)

	// AIEstimatedCost 估算成本（美元）
	AIEstimatedCost = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ai_estimated_cost_usd",
			Help: "Estimated AI API cost in USD",
		},
		[]string{"provider", "model"},
	)

	// AIRetryTotal AI重试次数
	AIRetryTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ai_retry_total",
			Help: "Total number of AI API retries",
		},
		[]string{"provider", "model"},
	)

	// AIDecisionParseTotal 决策解析结果
	AIDecisionParseTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ai_decision_parse_total",
			Help: "Total number of AI decision parse attempts",
		},
		[]string{"status"}, // "success", "failed", "empty"
	)
)

// ============================================================================
// Trading Metrics
// ============================================================================

var (
	// TradingCyclesTotal 交易周期总数
	TradingCyclesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_trading_cycles_total",
			Help: "Total number of trading cycles",
		},
		[]string{"trader_id", "status"}, // status: "success", "failed"
	)

	// TradingOrdersTotal 订单总数
	TradingOrdersTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_trading_orders_total",
			Help: "Total number of trading orders",
		},
		[]string{"trader_id", "exchange", "action", "status"}, // action: "open_long", "close_short", etc.
	)

	// TradingPnL 盈亏
	TradingPnL = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_trading_pnl_usdt",
			Help: "Current trading PnL in USDT",
		},
		[]string{"trader_id", "type"}, // type: "realized", "unrealized", "total"
	)

	// TradingEquity 账户净值
	TradingEquity = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_trading_equity_usdt",
			Help: "Current trading account equity in USDT",
		},
		[]string{"trader_id"},
	)

	// TradingDrawdown 回撤
	TradingDrawdown = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_trading_drawdown_pct",
			Help: "Current drawdown percentage",
		},
		[]string{"trader_id"},
	)

	// TradingPositions 当前持仓数
	TradingPositions = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_trading_positions",
			Help: "Number of current open positions",
		},
		[]string{"trader_id"},
	)

	// TradingMarginUsed 保证金使用率
	TradingMarginUsed = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_trading_margin_used_pct",
			Help: "Margin utilization percentage",
		},
		[]string{"trader_id"},
	)

	// TradingRiskControlTriggered 风控触发次数
	TradingRiskControlTriggered = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_trading_risk_control_triggered_total",
			Help: "Total number of risk control triggers",
		},
		[]string{"trader_id", "reason"}, // reason: "max_daily_loss", "max_drawdown", "stop_loss"
	)

	// ActiveTraders 活跃交易员数量
	ActiveTraders = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_active_traders",
			Help: "Number of currently active traders",
		},
	)
)

// ============================================================================
// Market Data / WebSocket Metrics
// ============================================================================

var (
	// WSConnectionsTotal WebSocket连接总数
	WSConnectionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ws_connections_total",
			Help: "Total number of WebSocket connection attempts",
		},
		[]string{"type", "status"}, // type: "kline", "ticker"; status: "success", "failed"
	)

	// WSDisconnectsTotal WebSocket断开次数
	WSDisconnectsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ws_disconnects_total",
			Help: "Total number of WebSocket disconnections",
		},
		[]string{"type", "reason"}, // reason: "error", "timeout", "server_close"
	)

	// WSReconnectsTotal WebSocket重连次数
	WSReconnectsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ws_reconnects_total",
			Help: "Total number of WebSocket reconnection attempts",
		},
		[]string{"type"},
	)

	// WSMessagesTotal WebSocket消息总数
	WSMessagesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_ws_messages_total",
			Help: "Total number of WebSocket messages received",
		},
		[]string{"type"}, // "kline", "ticker"
	)

	// WSActiveConnections 当前活跃连接数
	WSActiveConnections = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_ws_active_connections",
			Help: "Number of active WebSocket connections",
		},
		[]string{"type"},
	)

	// MarketDataLag 行情数据延迟（秒）
	MarketDataLag = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_market_data_lag_seconds",
			Help: "Market data lag in seconds",
		},
		[]string{"symbol"},
	)

	// SubscribedSymbols 订阅的币种数
	SubscribedSymbols = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_subscribed_symbols",
			Help: "Number of subscribed trading symbols",
		},
	)
)

// ============================================================================
// Database Metrics
// ============================================================================

var (
	// DBQueryTotal 数据库查询总数
	DBQueryTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_db_query_total",
			Help: "Total number of database queries",
		},
		[]string{"operation", "status"}, // operation: "select", "insert", "update"; status: "success", "failed"
	)

	// DBQueryDuration 数据库查询延迟
	DBQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "aspen_db_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
		},
		[]string{"operation"},
	)
)

// ============================================================================
// Exchange API Metrics
// ============================================================================

var (
	// ExchangeAPIRequestsTotal 交易所API请求总数
	ExchangeAPIRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_exchange_api_requests_total",
			Help: "Total number of exchange API requests",
		},
		[]string{"exchange", "endpoint", "status"},
	)

	// ExchangeAPIRequestDuration 交易所API请求延迟
	ExchangeAPIRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "aspen_exchange_api_request_duration_seconds",
			Help:    "Exchange API request duration in seconds",
			Buckets: []float64{0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0},
		},
		[]string{"exchange", "endpoint"},
	)

	// ExchangeRateLimitHits 限流触发次数
	ExchangeRateLimitHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aspen_exchange_rate_limit_hits_total",
			Help: "Total number of exchange API rate limit hits",
		},
		[]string{"exchange"},
	)
)

// ============================================================================
// System Metrics（Go runtime metrics are auto-collected by promhttp）
// ============================================================================

var (
	// AppInfo 应用信息
	AppInfo = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aspen_app_info",
			Help: "Application information",
		},
		[]string{"version", "go_version"},
	)

	// AppStartTime 应用启动时间
	AppStartTime = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "aspen_app_start_timestamp_seconds",
			Help: "Application start timestamp in seconds",
		},
	)
)
