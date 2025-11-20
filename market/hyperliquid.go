package market

import (
	"time"
)

// HyperliquidRequest 通用请求结构
type HyperliquidRequest struct {
	Type string      `json:"type"`
	Req  interface{} `json:"req,omitempty"`
}

// CandleSnapshotReq K线请求参数
type CandleSnapshotReq struct {
	Coin      string `json:"coin"`
	Interval  string `json:"interval"`
	StartTime int64  `json:"startTime"`
	EndTime   int64  `json:"endTime"`
}

// HyperliquidCandle K线数据结构
type HyperliquidCandle struct {
	T int64   `json:"t"` // Start time (msecs)
	O string  `json:"o"` // Open
	H string  `json:"h"` // High
	L string  `json:"l"` // Low
	C string  `json:"c"` // Close
	V string  `json:"v"` // Volume (base currency)
	N float64 `json:"n"` // Number of trades (not always available, sometimes 0)
}

// HyperliquidMeta 交易所元数据
type HyperliquidMeta struct {
	Universe []HyperliquidAsset `json:"universe"`
}

// HyperliquidAsset 资产信息
type HyperliquidAsset struct {
	Name         string `json:"name"`
	SzDecimals   int    `json:"szDecimals"`
	MaxLeverage  int    `json:"maxLeverage"`
	OnlyIsolated bool   `json:"onlyIsolated"`
	IsDelisted   bool   `json:"isDelisted"`
}

// HyperliquidAllMids 所有中间价
type HyperliquidAllMids map[string]string

// HyperliquidWSMessage WebSocket 消息
type HyperliquidWSMessage struct {
	Channel string      `json:"channel"`
	Data    interface{} `json:"data"`
}

// HyperliquidWSData WebSocket 数据通用接口
type HyperliquidWSData struct {
	Coin string      `json:"coin"`
	Ctx  interface{} `json:"ctx,omitempty"`
}

// ConvertIntervalToHyperliquid 将通用间隔转换为 Hyperliquid 格式
func ConvertIntervalToHyperliquid(interval string) string {
	// Hyperliquid uses same format as Binance for standard intervals?
	// Docs say: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 1d
	// Binance: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
	// 3m is not supported by Hyperliquid? Need to check.
	// If not supported, fallback to 1m or 5m? Or return error?
	// For now assume standard mapping.
	return interval
}

// CalculateHyperliquidStartTime 计算起始时间 (ms)
func CalculateHyperliquidStartTime(interval string, limit int) int64 {
	now := time.Now().UnixMilli()
	var intervalMs int64
	switch interval {
	case "1m":
		intervalMs = 60 * 1000
	case "3m":
		intervalMs = 3 * 60 * 1000
	case "5m":
		intervalMs = 5 * 60 * 1000
	case "15m":
		intervalMs = 15 * 60 * 1000
	case "30m":
		intervalMs = 30 * 60 * 1000
	case "1h":
		intervalMs = 60 * 60 * 1000
	case "2h":
		intervalMs = 2 * 60 * 60 * 1000
	case "4h":
		intervalMs = 4 * 60 * 60 * 1000
	case "1d":
		intervalMs = 24 * 60 * 60 * 1000
	default:
		intervalMs = 5 * 60 * 1000
	}
	return now - (int64(limit) * intervalMs)
}
