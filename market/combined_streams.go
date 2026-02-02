package market

import (
	"aspen/metrics"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type CombinedStreamsClient struct {
	conn        *websocket.Conn
	mu          sync.RWMutex
	subscribers map[string]chan []byte
	reconnect   bool
	done        chan struct{}
	batchSize   int // 每批订阅的流数量
}

func NewCombinedStreamsClient(batchSize int) *CombinedStreamsClient {
	return &CombinedStreamsClient{
		subscribers: make(map[string]chan []byte),
		reconnect:   true,
		done:        make(chan struct{}),
		batchSize:   batchSize,
	}
}

func (c *CombinedStreamsClient) Connect() error {
	wsMetrics := metrics.NewWSMetricsRecorder("combined")

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	// 根据数据源选择不同的 WebSocket 端点
	cfg := GetDataSourceConfig()
	wsURL := cfg.WSStreamURL
	if wsURL == "" {
		// 默认使用 Binance
		wsURL = "wss://fstream.binance.com/stream"
	}

	log.Printf("📡 [WebSocket] 连接到数据源: %s", string(GetCurrentDataSource()))
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		wsMetrics.RecordConnection(false)
		return fmt.Errorf("组合流WebSocket连接失败 (%s): %v", string(GetCurrentDataSource()), err)
	}

	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()

	wsMetrics.RecordConnection(true)
	log.Printf("✅ [WebSocket] 组合流连接成功: %s", string(GetCurrentDataSource()))
	go c.readMessages()

	return nil
}

// BatchSubscribeKlines 批量订阅K线
func (c *CombinedStreamsClient) BatchSubscribeKlines(symbols []string, interval string) error {
	// 将symbols分批处理
	batches := c.splitIntoBatches(symbols, c.batchSize)

	for i, batch := range batches {
		log.Printf("订阅第 %d 批, 数量: %d", i+1, len(batch))

		if GetCurrentDataSource() == DataSourceBybit {
			// Bybit 使用不同的订阅格式
			if err := c.subscribeBybitKlines(batch, interval); err != nil {
				return fmt.Errorf("第 %d 批订阅失败: %v", i+1, err)
			}
		} else if GetCurrentDataSource() == DataSourceHyperliquid {
			// Hyperliquid specific subscription
			// Hyperliquid doesn't support batch subscription in the same way (one message per stream usually)
			// But we can send multiple messages.
			for _, symbol := range batch {
				hlSymbol := symbol
				if len(symbol) > 4 && symbol[len(symbol)-4:] == "USDT" {
					hlSymbol = symbol[:len(symbol)-4]
				}
				msg := map[string]interface{}{
					"method": "subscribe",
					"subscription": map[string]string{
						"type":     "candle",
						"coin":     hlSymbol,
						"interval": ConvertIntervalToHyperliquid(interval),
					},
				}
				if err := c.sendJSON(msg); err != nil {
					log.Printf("Hyperliquid 订阅失败 %s: %v", symbol, err)
				}
			}
		} else {
			// Binance 格式
			streams := make([]string, len(batch))
			for j, symbol := range batch {
				streams[j] = fmt.Sprintf("%s@kline_%s", strings.ToLower(symbol), interval)
			}

			if err := c.subscribeStreams(streams); err != nil {
				return fmt.Errorf("第 %d 批订阅失败: %v", i+1, err)
			}
		}

		// 批次间延迟，避免被限制
		if i < len(batches)-1 {
			time.Sleep(100 * time.Millisecond)
		}
	}

	return nil
}

// subscribeBybitKlines 订阅 Bybit K线数据
func (c *CombinedStreamsClient) subscribeBybitKlines(symbols []string, interval string) error {
	// Bybit 间隔格式转换: 3m -> 3, 4h -> 240
	bybitInterval := convertIntervalToBybit(interval)

	// Bybit 订阅格式: {"op": "subscribe", "args": ["kline.3.BTCUSDT", "kline.3.ETHUSDT"]}
	args := make([]string, len(symbols))
	for i, symbol := range symbols {
		args[i] = fmt.Sprintf("kline.%s.%s", bybitInterval, symbol)
	}

	subscribeMsg := map[string]interface{}{
		"op":   "subscribe",
		"args": args,
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return fmt.Errorf("WebSocket未连接")
	}

	log.Printf("📡 [Bybit] 订阅流: %v", args)
	return c.conn.WriteJSON(subscribeMsg)
}

// splitIntoBatches 将切片分成指定大小的批次
func (c *CombinedStreamsClient) splitIntoBatches(symbols []string, batchSize int) [][]string {
	var batches [][]string

	for i := 0; i < len(symbols); i += batchSize {
		end := i + batchSize
		if end > len(symbols) {
			end = len(symbols)
		}
		batches = append(batches, symbols[i:end])
	}

	return batches
}

// subscribeStreams 订阅多个流（Binance 格式）
func (c *CombinedStreamsClient) subscribeStreams(streams []string) error {
	subscribeMsg := map[string]interface{}{
		"method": "SUBSCRIBE",
		"params": streams,
		"id":     time.Now().UnixNano(),
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return fmt.Errorf("WebSocket未连接")
	}

	log.Printf("📡 [Binance] 订阅流: %v", streams)
	return c.conn.WriteJSON(subscribeMsg)
}

func (c *CombinedStreamsClient) sendJSON(msg interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return fmt.Errorf("WebSocket未连接")
	}

	return c.conn.WriteJSON(msg)
}

func (c *CombinedStreamsClient) readMessages() {
	wsMetrics := metrics.NewWSMetricsRecorder("combined")

	for {
		select {
		case <-c.done:
			return
		default:
			c.mu.RLock()
			conn := c.conn
			c.mu.RUnlock()

			if conn == nil {
				time.Sleep(1 * time.Second)
				continue
			}

			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("读取组合流消息失败: %v", err)
				wsMetrics.RecordDisconnect("error")
				c.handleReconnect()
				return
			}

			// 记录消息指标
			wsMetrics.RecordMessage()

			c.handleCombinedMessage(message)
		}
	}
}

func (c *CombinedStreamsClient) handleCombinedMessage(message []byte) {
	if GetCurrentDataSource() == DataSourceBybit {
		c.handleBybitMessage(message)
	} else if GetCurrentDataSource() == DataSourceHyperliquid {
		c.handleHyperliquidMessage(message)
	} else {
		c.handleBinanceMessage(message)
	}
}

// handleHyperliquidMessage 处理 Hyperliquid 消息
func (c *CombinedStreamsClient) handleHyperliquidMessage(message []byte) {
	// Re-use the logic from WSClient or implement similar here.
	// Since CombinedStreamsClient is used by Monitor, we need to route to subscribers.
	// The subscribers are keyed by "symbol@kline_interval" (Binance format) because Monitor uses that key.

	var hlMsg HyperliquidWSMessage
	if err := json.Unmarshal(message, &hlMsg); err != nil {
		return
	}

	if hlMsg.Channel == "candle" {
		dataMap, ok := hlMsg.Data.(map[string]interface{})
		if !ok {
			return
		}

		coin, _ := dataMap["s"].(string)
		interval, _ := dataMap["i"].(string)

		if coin == "" || interval == "" {
			return
		}

		symbol := coin + "USDT"
		streamKey := fmt.Sprintf("%s@kline_%s", strings.ToLower(symbol), interval)

		c.mu.RLock()
		ch, exists := c.subscribers[streamKey]
		c.mu.RUnlock()

		if exists {
			// Convert to Binance KlineWSData
			t, _ := dataMap["t"].(float64)
			o, _ := dataMap["o"].(string)
			c_price, _ := dataMap["c"].(string)
			h, _ := dataMap["h"].(string)
			l, _ := dataMap["l"].(string)
			v, _ := dataMap["v"].(string)
			n, _ := dataMap["n"].(float64)

			binanceMsg := KlineWSData{
				EventType: "kline",
				EventTime: int64(t),
				Symbol:    symbol,
				Kline: struct {
					StartTime           int64  `json:"t"`
					CloseTime           int64  `json:"T"`
					Symbol              string `json:"s"`
					Interval            string `json:"i"`
					FirstTradeID        int64  `json:"f"`
					LastTradeID         int64  `json:"L"`
					OpenPrice           string `json:"o"`
					ClosePrice          string `json:"c"`
					HighPrice           string `json:"h"`
					LowPrice            string `json:"l"`
					Volume              string `json:"v"`
					NumberOfTrades      int    `json:"n"`
					IsFinal             bool   `json:"x"`
					QuoteVolume         string `json:"q"`
					TakerBuyBaseVolume  string `json:"V"`
					TakerBuyQuoteVolume string `json:"Q"`
				}{
					StartTime:      int64(t),
					CloseTime:      int64(t) + 60000, // Approx
					Symbol:         symbol,
					Interval:       interval,
					OpenPrice:      o,
					ClosePrice:     c_price,
					HighPrice:      h,
					LowPrice:       l,
					Volume:         v,
					NumberOfTrades: int(n),
					IsFinal:        true,
				},
			}

			jsonBytes, _ := json.Marshal(binanceMsg)

			select {
			case ch <- jsonBytes:
			default:
			}
		}
	}
}

// handleBinanceMessage 处理 Binance 格式的消息
func (c *CombinedStreamsClient) handleBinanceMessage(message []byte) {
	var combinedMsg struct {
		Stream string          `json:"stream"`
		Data   json.RawMessage `json:"data"`
	}

	if err := json.Unmarshal(message, &combinedMsg); err != nil {
		log.Printf("解析Binance组合消息失败: %v", err)
		return
	}

	c.mu.RLock()
	ch, exists := c.subscribers[combinedMsg.Stream]
	c.mu.RUnlock()

	if exists {
		select {
		case ch <- combinedMsg.Data:
		default:
			log.Printf("订阅者通道已满: %s", combinedMsg.Stream)
		}
	}
}

// handleBybitMessage 处理 Bybit 格式的消息
func (c *CombinedStreamsClient) handleBybitMessage(message []byte) {
	var bybitMsg struct {
		Topic string          `json:"topic"`
		Type  string          `json:"type"`
		Data  json.RawMessage `json:"data"`
	}

	if err := json.Unmarshal(message, &bybitMsg); err != nil {
		// 可能是订阅确认消息或其他格式
		var ackMsg map[string]interface{}
		if err2 := json.Unmarshal(message, &ackMsg); err2 == nil {
			if op, ok := ackMsg["op"].(string); ok && op == "subscribe" {
				if success, ok := ackMsg["success"].(bool); ok && success {
					log.Printf("✅ [Bybit] 订阅成功: %v", ackMsg["args"])
				} else {
					log.Printf("⚠️  [Bybit] 订阅失败: %v", ackMsg)
				}
			}
		}
		return
	}

	// Bybit topic 格式: "kline.3.BTCUSDT" -> 转换为 Binance 格式 "btcusdt@kline_3m"
	if strings.HasPrefix(bybitMsg.Topic, "kline.") {
		parts := strings.Split(bybitMsg.Topic, ".")
		if len(parts) >= 3 {
			interval := parts[1]
			symbol := strings.ToLower(parts[2])
			// 转换间隔格式: "3" -> "3m", "240" -> "4h"
			binanceInterval := convertBybitIntervalToBinance(interval)
			stream := fmt.Sprintf("%s@kline_%s", symbol, binanceInterval)

			c.mu.RLock()
			ch, exists := c.subscribers[stream]
			c.mu.RUnlock()

			if exists {
				// Bybit 的 data 是数组，需要提取第一个元素
				var dataArray []json.RawMessage
				if err := json.Unmarshal(bybitMsg.Data, &dataArray); err == nil && len(dataArray) > 0 {
					// 转换为 Binance 格式的 Kline 数据（传递间隔信息）
					binanceData := c.convertBybitKlineToBinance(dataArray[0], symbol, binanceInterval)
					if binanceData != nil {
						select {
						case ch <- binanceData:
						default:
							log.Printf("订阅者通道已满: %s", stream)
						}
					}
				}
			}
		}
	}
}

// convertBybitIntervalToBinance 将 Bybit 间隔转换为 Binance 格式
func convertBybitIntervalToBinance(interval string) string {
	intervalMap := map[string]string{
		"1": "1m", "3": "3m", "5": "5m", "15": "15m", "30": "30m",
		"60": "1h", "120": "2h", "240": "4h", "360": "6h", "720": "12h",
		"D": "1d", "W": "1w", "M": "1M",
	}
	if binanceInterval, ok := intervalMap[interval]; ok {
		return binanceInterval
	}
	return interval + "m" // 默认假设是分钟
}

// convertBybitKlineToBinance 将 Bybit K线数据转换为 Binance 格式
func (c *CombinedStreamsClient) convertBybitKlineToBinance(bybitData json.RawMessage, symbol string, interval string) []byte {
	var bybitKline struct {
		StartTime string `json:"start"`
		Open      string `json:"open"`
		High      string `json:"high"`
		Low       string `json:"low"`
		Close     string `json:"close"`
		Volume    string `json:"volume"`
		Turnover  string `json:"turnover"`
		Confirm   bool   `json:"confirm"`
		Interval  string `json:"interval"`
	}

	if err := json.Unmarshal(bybitData, &bybitKline); err != nil {
		log.Printf("解析Bybit K线数据失败: %v", err)
		return nil
	}

	// 计算间隔对应的毫秒数
	intervalMs := getIntervalMs(interval)
	startTime := parseBybitTimestamp(bybitKline.StartTime)
	closeTime := startTime + intervalMs

	// 转换为 Binance 格式
	binanceKline := map[string]interface{}{
		"e": "kline",
		"E": time.Now().Unix() * 1000,
		"s": strings.ToUpper(symbol),
		"k": map[string]interface{}{
			"t": startTime,
			"T": closeTime,
			"s": strings.ToUpper(symbol),
			"i": interval,
			"f": 0,
			"L": 0,
			"o": bybitKline.Open,
			"c": bybitKline.Close,
			"h": bybitKline.High,
			"l": bybitKline.Low,
			"v": bybitKline.Volume,
			"n": 0,
			"x": bybitKline.Confirm,
			"q": bybitKline.Turnover,
			"V": "0",
			"Q": "0",
		},
	}

	result, _ := json.Marshal(binanceKline)
	return result
}

// parseBybitTimestamp 解析 Bybit 时间戳（毫秒）
func parseBybitTimestamp(ts string) int64 {
	var t int64
	fmt.Sscanf(ts, "%d", &t)
	return t
}

// getIntervalMs 获取间隔对应的毫秒数
func getIntervalMs(interval string) int64 {
	intervalMap := map[string]int64{
		"1m": 60000, "3m": 180000, "5m": 300000, "15m": 900000, "30m": 1800000,
		"1h": 3600000, "2h": 7200000, "4h": 14400000, "6h": 21600000, "12h": 43200000,
		"1d": 86400000, "1w": 604800000, "1M": 2592000000,
	}
	if ms, ok := intervalMap[interval]; ok {
		return ms
	}
	return 180000 // 默认3分钟
}

func (c *CombinedStreamsClient) AddSubscriber(stream string, bufferSize int) <-chan []byte {
	ch := make(chan []byte, bufferSize)
	c.mu.Lock()
	c.subscribers[stream] = ch
	c.mu.Unlock()
	return ch
}

func (c *CombinedStreamsClient) handleReconnect() {
	if !c.reconnect {
		return
	}

	wsMetrics := metrics.NewWSMetricsRecorder("combined")
	wsMetrics.RecordReconnect()

	log.Println("组合流尝试重新连接...")
	time.Sleep(3 * time.Second)

	if err := c.Connect(); err != nil {
		log.Printf("组合流重新连接失败: %v", err)
		go c.handleReconnect()
	}
}

func (c *CombinedStreamsClient) Close() {
	c.reconnect = false
	close(c.done)

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}

	for stream, ch := range c.subscribers {
		close(ch)
		delete(c.subscribers, stream)
	}
}
