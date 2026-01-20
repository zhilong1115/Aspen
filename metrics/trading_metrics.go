package metrics

// TradingMetricsRecorder 交易指标记录器
type TradingMetricsRecorder struct {
	TraderID string
	Exchange string
}

// NewTradingMetricsRecorder 创建交易指标记录器
func NewTradingMetricsRecorder(traderID, exchange string) *TradingMetricsRecorder {
	return &TradingMetricsRecorder{
		TraderID: traderID,
		Exchange: exchange,
	}
}

// RecordCycle 记录交易周期
func (r *TradingMetricsRecorder) RecordCycle(success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	TradingCyclesTotal.WithLabelValues(r.TraderID, status).Inc()
}

// RecordOrder 记录订单
func (r *TradingMetricsRecorder) RecordOrder(action string, success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	TradingOrdersTotal.WithLabelValues(r.TraderID, r.Exchange, action, status).Inc()
}

// RecordPnL 记录盈亏
func (r *TradingMetricsRecorder) RecordPnL(realized, unrealized, total float64) {
	TradingPnL.WithLabelValues(r.TraderID, "realized").Set(realized)
	TradingPnL.WithLabelValues(r.TraderID, "unrealized").Set(unrealized)
	TradingPnL.WithLabelValues(r.TraderID, "total").Set(total)
}

// RecordEquity 记录账户净值
func (r *TradingMetricsRecorder) RecordEquity(equity float64) {
	TradingEquity.WithLabelValues(r.TraderID).Set(equity)
}

// RecordDrawdown 记录回撤
func (r *TradingMetricsRecorder) RecordDrawdown(drawdownPct float64) {
	TradingDrawdown.WithLabelValues(r.TraderID).Set(drawdownPct)
}

// RecordPositions 记录持仓数
func (r *TradingMetricsRecorder) RecordPositions(count int) {
	TradingPositions.WithLabelValues(r.TraderID).Set(float64(count))
}

// RecordMarginUsed 记录保证金使用率
func (r *TradingMetricsRecorder) RecordMarginUsed(pct float64) {
	TradingMarginUsed.WithLabelValues(r.TraderID).Set(pct)
}

// RecordRiskControl 记录风控触发
func (r *TradingMetricsRecorder) RecordRiskControl(reason string) {
	TradingRiskControlTriggered.WithLabelValues(r.TraderID, reason).Inc()
}

// SetActiveTraders 设置活跃交易员数量
func SetActiveTraders(count int) {
	ActiveTraders.Set(float64(count))
}
