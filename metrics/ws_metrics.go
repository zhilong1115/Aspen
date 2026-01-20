package metrics

import "time"

// WSMetricsRecorder WebSocket指标记录器
type WSMetricsRecorder struct {
	Type string // "kline", "ticker", "combined"
}

// NewWSMetricsRecorder 创建WebSocket指标记录器
func NewWSMetricsRecorder(wsType string) *WSMetricsRecorder {
	return &WSMetricsRecorder{
		Type: wsType,
	}
}

// RecordConnection 记录连接
func (r *WSMetricsRecorder) RecordConnection(success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	WSConnectionsTotal.WithLabelValues(r.Type, status).Inc()
	
	if success {
		WSActiveConnections.WithLabelValues(r.Type).Inc()
	}
}

// RecordDisconnect 记录断开
func (r *WSMetricsRecorder) RecordDisconnect(reason string) {
	WSDisconnectsTotal.WithLabelValues(r.Type, reason).Inc()
	WSActiveConnections.WithLabelValues(r.Type).Dec()
}

// RecordReconnect 记录重连
func (r *WSMetricsRecorder) RecordReconnect() {
	WSReconnectsTotal.WithLabelValues(r.Type).Inc()
}

// RecordMessage 记录消息
func (r *WSMetricsRecorder) RecordMessage() {
	WSMessagesTotal.WithLabelValues(r.Type).Inc()
}

// RecordMarketDataLag 记录行情数据延迟
func RecordMarketDataLag(symbol string, eventTime int64) {
	// 计算延迟（当前时间 - 事件时间）
	lag := float64(time.Now().UnixMilli()-eventTime) / 1000.0
	if lag >= 0 && lag < 60 { // 合理范围内的延迟
		MarketDataLag.WithLabelValues(symbol).Set(lag)
	}
}

// SetSubscribedSymbols 设置订阅的币种数
func SetSubscribedSymbols(count int) {
	SubscribedSymbols.Set(float64(count))
}
