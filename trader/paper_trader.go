package trader

import (
	"fmt"
	"log"
	"atrade/market"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Position 持仓信息
type Position struct {
	Symbol        string
	Side          string // "LONG" or "SHORT"
	Quantity      float64
	EntryPrice    float64
	Leverage      int
	UnrealizedPnL float64
}

// PaperTrader 模拟仓交易器
type PaperTrader struct {
	initialBalance float64              // 初始USDC余额
	balance        float64              // 当前可用USDC余额（已扣除保证金）
	realizedPnL    float64              // 已实现盈亏
	positions      map[string]*Position // symbol_side -> Position
	mu             sync.RWMutex
}

// NewPaperTrader 创建模拟仓交易器
// initialUSDC: 初始USDC金额
func NewPaperTrader(initialUSDC float64) (*PaperTrader, error) {
	if initialUSDC <= 0 {
		return nil, fmt.Errorf("初始USDC金额必须大于0")
	}

	trader := &PaperTrader{
		initialBalance: initialUSDC,
		balance:        initialUSDC,
		realizedPnL:    0.0,
		positions:      make(map[string]*Position),
	}

	log.Printf("📝 [Paper Trading] 模拟仓已创建，初始余额: %.2f USDC", initialUSDC)
	return trader, nil
}

// getPositionKey 生成持仓键
func (t *PaperTrader) getPositionKey(symbol, side string) string {
	return fmt.Sprintf("%s_%s", symbol, side)
}

// updateUnrealizedPnL 更新未实现盈亏
func (t *PaperTrader) updateUnrealizedPnL() {
	t.mu.Lock()
	defer t.mu.Unlock()

	for key, pos := range t.positions {
		currentPrice, err := t.getMarketPrice(pos.Symbol)
		if err != nil {
			log.Printf("⚠️ [Paper Trading] 获取 %s 价格失败: %v", pos.Symbol, err)
			continue
		}

		if pos.Side == "LONG" {
			// 多仓盈亏 = (当前价格 - 开仓价格) * 数量
			pos.UnrealizedPnL = (currentPrice - pos.EntryPrice) * pos.Quantity
		} else {
			// 空仓盈亏 = (开仓价格 - 当前价格) * 数量
			pos.UnrealizedPnL = (pos.EntryPrice - currentPrice) * pos.Quantity
		}

		t.positions[key] = pos
	}
}

// getMarketPrice 获取市场价格
func (t *PaperTrader) getMarketPrice(symbol string) (float64, error) {
	// 使用 market 包获取实时价格
	apiClient := market.NewAPIClient()
	price, err := apiClient.GetCurrentPrice(symbol)
	if err != nil {
		return 0, fmt.Errorf("获取市场价格失败: %w", err)
	}
	return price, nil
}

// GetBalance 获取账户余额
func (t *PaperTrader) GetBalance() (map[string]interface{}, error) {
	// 更新未实现盈亏
	t.updateUnrealizedPnL()

	t.mu.RLock()
	defer t.mu.RUnlock()

	// 计算总未实现盈亏和总保证金占用
	totalUnrealizedPnL := 0.0
	totalMarginUsed := 0.0
	for _, pos := range t.positions {
		totalUnrealizedPnL += pos.UnrealizedPnL
		// 计算该持仓的保证金占用
		currentPrice, err := t.getMarketPrice(pos.Symbol)
		if err == nil {
			notional := pos.Quantity * currentPrice
			marginUsed := notional / float64(pos.Leverage)
			totalMarginUsed += marginUsed
		}
	}

	// 总权益 = 初始余额 + 已实现盈亏 + 未实现盈亏
	totalBalance := t.initialBalance + t.realizedPnL + totalUnrealizedPnL

	// 可用余额 = 总权益 - 保证金占用
	// 注意：t.balance 是开仓后剩余的余额（已扣除保证金），但不包含未实现盈亏
	// 所以可用余额应该是：总权益 - 保证金占用
	availableBalance := totalBalance - totalMarginUsed
	if availableBalance < 0 {
		availableBalance = 0 // 防止负数
	}

	result := map[string]interface{}{
		"totalWalletBalance":    totalBalance,
		"availableBalance":      availableBalance,
		"totalUnrealizedProfit": totalUnrealizedPnL,
		"initialBalance":        t.initialBalance,
	}

	return result, nil
}

// GetPositions 获取所有持仓
func (t *PaperTrader) GetPositions() ([]map[string]interface{}, error) {
	// 更新未实现盈亏
	t.updateUnrealizedPnL()

	t.mu.RLock()
	defer t.mu.RUnlock()

	var positions []map[string]interface{}
	for _, pos := range t.positions {
		if pos.Quantity > 0 {
			currentPrice, _ := t.getMarketPrice(pos.Symbol)
			// 标准化 side 字段：将 "LONG"/"SHORT" 转换为小写 "long"/"short"
			side := strings.ToLower(pos.Side)
			// 计算清算价格（简化计算：entryPrice * (1 - 1/leverage) for long, entryPrice * (1 + 1/leverage) for short）
			liquidationPrice := 0.0
			if side == "long" {
				liquidationPrice = pos.EntryPrice * (1.0 - 1.0/float64(pos.Leverage))
			} else if side == "short" {
				liquidationPrice = pos.EntryPrice * (1.0 + 1.0/float64(pos.Leverage))
			}
			positions = append(positions, map[string]interface{}{
				"symbol":           pos.Symbol,
				"side":             side, // 使用 "side" 而不是 "positionSide"，与其他交易所保持一致
				"positionSide":     side, // 保留 "positionSide" 以兼容某些代码
				"positionAmt":      pos.Quantity,
				"entryPrice":       pos.EntryPrice,
				"markPrice":        currentPrice,
				"unRealizedProfit": pos.UnrealizedPnL,
				"liquidationPrice": liquidationPrice,
				"leverage":         pos.Leverage,
			})
		}
	}

	return positions, nil
}

// OpenLong 开多仓
func (t *PaperTrader) OpenLong(symbol string, quantity float64, leverage int) (map[string]interface{}, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if quantity <= 0 {
		return nil, fmt.Errorf("数量必须大于0")
	}

	// 获取当前价格
	currentPrice, err := t.getMarketPrice(symbol)
	if err != nil {
		return nil, err
	}

	// 计算所需保证金（简化：使用全仓模式）
	notional := quantity * currentPrice
	requiredMargin := notional / float64(leverage)

	// 计算手续费（Taker费率 0.04%）
	tradingFee := notional * 0.0004
	totalRequired := requiredMargin + tradingFee

	if t.balance < totalRequired {
		return nil, fmt.Errorf("余额不足，需要 %.2f USDC（保证金 %.2f + 手续费 %.2f），当前可用 %.2f USDC",
			totalRequired, requiredMargin, tradingFee, t.balance)
	}

	key := t.getPositionKey(symbol, "LONG")
	pos, exists := t.positions[key]

	if exists && pos.Quantity > 0 {
		// 加仓：计算新的平均开仓价
		totalNotional := (pos.Quantity*pos.EntryPrice + quantity*currentPrice)
		totalQuantity := pos.Quantity + quantity
		newEntryPrice := totalNotional / totalQuantity
		pos.Quantity = totalQuantity
		pos.EntryPrice = newEntryPrice
		pos.Leverage = leverage
	} else {
		// 新开仓
		pos = &Position{
			Symbol:     symbol,
			Side:       "LONG",
			Quantity:   quantity,
			EntryPrice: currentPrice,
			Leverage:   leverage,
		}
	}

	t.positions[key] = pos
	// 扣除保证金和手续费
	t.balance -= totalRequired

	log.Printf("📝 [Paper Trading] 开多仓: %s, 数量: %.6f, 价格: %.2f, 杠杆: %dx, 保证金: %.2f USDC, 手续费: %.2f USDC",
		symbol, quantity, currentPrice, leverage, requiredMargin, tradingFee)

	return map[string]interface{}{
		"orderId":  fmt.Sprintf("paper_%d", time.Now().UnixNano()),
		"symbol":   symbol,
		"side":     "BUY",
		"quantity": quantity,
		"price":    currentPrice,
		"leverage": leverage,
		"status":   "FILLED",
	}, nil
}

// OpenShort 开空仓
func (t *PaperTrader) OpenShort(symbol string, quantity float64, leverage int) (map[string]interface{}, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if quantity <= 0 {
		return nil, fmt.Errorf("数量必须大于0")
	}

	// 获取当前价格
	currentPrice, err := t.getMarketPrice(symbol)
	if err != nil {
		return nil, err
	}

	// 计算所需保证金
	notional := quantity * currentPrice
	requiredMargin := notional / float64(leverage)

	// 计算手续费（Taker费率 0.04%）
	tradingFee := notional * 0.0004
	totalRequired := requiredMargin + tradingFee

	if t.balance < totalRequired {
		return nil, fmt.Errorf("余额不足，需要 %.2f USDC（保证金 %.2f + 手续费 %.2f），当前可用 %.2f USDC",
			totalRequired, requiredMargin, tradingFee, t.balance)
	}

	key := t.getPositionKey(symbol, "SHORT")
	pos, exists := t.positions[key]

	if exists && pos.Quantity > 0 {
		// 加仓：计算新的平均开仓价
		totalNotional := (pos.Quantity*pos.EntryPrice + quantity*currentPrice)
		totalQuantity := pos.Quantity + quantity
		newEntryPrice := totalNotional / totalQuantity
		pos.Quantity = totalQuantity
		pos.EntryPrice = newEntryPrice
		pos.Leverage = leverage
	} else {
		// 新开仓
		pos = &Position{
			Symbol:     symbol,
			Side:       "SHORT",
			Quantity:   quantity,
			EntryPrice: currentPrice,
			Leverage:   leverage,
		}
	}

	t.positions[key] = pos
	// 扣除保证金和手续费
	t.balance -= totalRequired

	log.Printf("📝 [Paper Trading] 开空仓: %s, 数量: %.6f, 价格: %.2f, 杠杆: %dx, 保证金: %.2f USDC, 手续费: %.2f USDC",
		symbol, quantity, currentPrice, leverage, requiredMargin, tradingFee)

	return map[string]interface{}{
		"orderId":  fmt.Sprintf("paper_%d", time.Now().UnixNano()),
		"symbol":   symbol,
		"side":     "SELL",
		"quantity": quantity,
		"price":    currentPrice,
		"leverage": leverage,
		"status":   "FILLED",
	}, nil
}

// CloseLong 平多仓
func (t *PaperTrader) CloseLong(symbol string, quantity float64) (map[string]interface{}, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	key := t.getPositionKey(symbol, "LONG")
	pos, exists := t.positions[key]

	if !exists || pos.Quantity <= 0 {
		return nil, fmt.Errorf("没有多仓持仓")
	}

	// 获取当前价格
	currentPrice, err := t.getMarketPrice(symbol)
	if err != nil {
		return nil, err
	}

	// 确定平仓数量
	closeQuantity := quantity
	if quantity <= 0 || quantity > pos.Quantity {
		closeQuantity = pos.Quantity
	}

	// 保存开仓价和杠杆（用于日志）
	entryPrice := pos.EntryPrice
	leverage := pos.Leverage

	// 计算盈亏
	pnl := (currentPrice - entryPrice) * closeQuantity
	marginUsed := (entryPrice * closeQuantity) / float64(leverage)

	// 更新余额（返还保证金 + 盈亏）
	t.balance += marginUsed + pnl
	// 更新已实现盈亏
	t.realizedPnL += pnl

	// 更新持仓
	pos.Quantity -= closeQuantity
	if pos.Quantity <= 0 {
		delete(t.positions, key)
	} else {
		t.positions[key] = pos
	}

	log.Printf("📝 [Paper Trading] 平多仓: %s, 数量: %.6f, 开仓价: %.2f, 平仓价: %.2f, 盈亏: %.2f USDC",
		symbol, closeQuantity, entryPrice, currentPrice, pnl)

	return map[string]interface{}{
		"orderId":  fmt.Sprintf("paper_%d", time.Now().UnixNano()),
		"symbol":   symbol,
		"side":     "SELL",
		"quantity": closeQuantity,
		"price":    currentPrice,
		"pnl":      pnl,
		"status":   "FILLED",
	}, nil
}

// CloseShort 平空仓
func (t *PaperTrader) CloseShort(symbol string, quantity float64) (map[string]interface{}, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	key := t.getPositionKey(symbol, "SHORT")
	pos, exists := t.positions[key]

	if !exists || pos.Quantity <= 0 {
		return nil, fmt.Errorf("没有空仓持仓")
	}

	// 获取当前价格
	currentPrice, err := t.getMarketPrice(symbol)
	if err != nil {
		return nil, err
	}

	// 确定平仓数量
	closeQuantity := quantity
	if quantity <= 0 || quantity > pos.Quantity {
		closeQuantity = pos.Quantity
	}

	// 保存开仓价和杠杆（用于日志）
	entryPrice := pos.EntryPrice
	leverage := pos.Leverage

	// 计算盈亏
	pnl := (entryPrice - currentPrice) * closeQuantity
	marginUsed := (entryPrice * closeQuantity) / float64(leverage)

	// 更新余额（返还保证金 + 盈亏）
	t.balance += marginUsed + pnl
	// 更新已实现盈亏
	t.realizedPnL += pnl

	// 更新持仓
	pos.Quantity -= closeQuantity
	if pos.Quantity <= 0 {
		delete(t.positions, key)
	} else {
		t.positions[key] = pos
	}

	log.Printf("📝 [Paper Trading] 平空仓: %s, 数量: %.6f, 开仓价: %.2f, 平仓价: %.2f, 盈亏: %.2f USDC",
		symbol, closeQuantity, entryPrice, currentPrice, pnl)

	return map[string]interface{}{
		"orderId":  fmt.Sprintf("paper_%d", time.Now().UnixNano()),
		"symbol":   symbol,
		"side":     "BUY",
		"quantity": closeQuantity,
		"price":    currentPrice,
		"pnl":      pnl,
		"status":   "FILLED",
	}, nil
}

// SetLeverage 设置杠杆（模拟仓中仅记录，不影响实际交易）
func (t *PaperTrader) SetLeverage(symbol string, leverage int) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	// 更新所有相关持仓的杠杆
	for key, pos := range t.positions {
		if strings.HasPrefix(key, symbol+"_") {
			pos.Leverage = leverage
			t.positions[key] = pos
		}
	}

	log.Printf("📝 [Paper Trading] 设置 %s 杠杆: %dx", symbol, leverage)
	return nil
}

// SetMarginMode 设置仓位模式（模拟仓中仅记录）
func (t *PaperTrader) SetMarginMode(symbol string, isCrossMargin bool) error {
	mode := "逐仓"
	if isCrossMargin {
		mode = "全仓"
	}
	log.Printf("📝 [Paper Trading] 设置 %s 仓位模式: %s", symbol, mode)
	return nil
}

// GetMarketPrice 获取市场价格
func (t *PaperTrader) GetMarketPrice(symbol string) (float64, error) {
	return t.getMarketPrice(symbol)
}

// SetStopLoss 设置止损单（模拟仓中暂不支持）
func (t *PaperTrader) SetStopLoss(symbol string, positionSide string, quantity, stopPrice float64) error {
	log.Printf("📝 [Paper Trading] 止损单功能暂不支持（模拟仓）")
	return nil
}

// SetTakeProfit 设置止盈单（模拟仓中暂不支持）
func (t *PaperTrader) SetTakeProfit(symbol string, positionSide string, quantity, takeProfitPrice float64) error {
	log.Printf("📝 [Paper Trading] 止盈单功能暂不支持（模拟仓）")
	return nil
}

// CancelStopLossOrders 取消止损单
func (t *PaperTrader) CancelStopLossOrders(symbol string) error {
	return nil
}

// CancelTakeProfitOrders 取消止盈单
func (t *PaperTrader) CancelTakeProfitOrders(symbol string) error {
	return nil
}

// CancelAllOrders 取消所有挂单
func (t *PaperTrader) CancelAllOrders(symbol string) error {
	return nil
}

// CancelStopOrders 取消止盈/止损单
func (t *PaperTrader) CancelStopOrders(symbol string) error {
	return nil
}

// FormatQuantity 格式化数量
func (t *PaperTrader) FormatQuantity(symbol string, quantity float64) (string, error) {
	// 简化处理，保留6位小数
	return strconv.FormatFloat(quantity, 'f', 6, 64), nil
}
