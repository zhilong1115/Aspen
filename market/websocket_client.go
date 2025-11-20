package market

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WSClient struct {
	conn        *websocket.Conn
	mu          sync.RWMutex
	subscribers map[string]chan []byte
	reconnect   bool
	done        chan struct{}
}

type WSMessage struct {
	Stream string          `json:"stream"`
	Data   json.RawMessage `json:"data"`
}

type KlineWSData struct {
	EventType string `json:"e"`
	EventTime int64  `json:"E"`
	Symbol    string `json:"s"`
	Kline     struct {
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
	} `json:"k"`
}

type TickerWSData struct {
	EventType          string `json:"e"`
	EventTime          int64  `json:"E"`
	Symbol             string `json:"s"`
	PriceChange        string `json:"p"`
	PriceChangePercent string `json:"P"`
	WeightedAvgPrice   string `json:"w"`
	LastPrice          string `json:"c"`
	LastQty            string `json:"Q"`
	OpenPrice          string `json:"o"`
	HighPrice          string `json:"h"`
	LowPrice           string `json:"l"`
	Volume             string `json:"v"`
	QuoteVolume        string `json:"q"`
	OpenTime           int64  `json:"O"`
	CloseTime          int64  `json:"C"`
	FirstID            int64  `json:"F"`
	LastID             int64  `json:"L"`
	Count              int    `json:"n"`
}

func NewWSClient() *WSClient {
	return &WSClient{
		subscribers: make(map[string]chan []byte),
		reconnect:   true,
		done:        make(chan struct{}),
	}
}

func (w *WSClient) Connect() error {
	cfg := GetDataSourceConfig()
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.Dial(cfg.WSStreamURL, nil)
	if err != nil {
		return fmt.Errorf("WebSocket连接失败 (%s): %v", cfg.Source, err)
	}

	w.mu.Lock()
	w.conn = conn
	w.mu.Unlock()

	log.Println("WebSocket连接成功")

	// 启动消息读取循环
	go w.readMessages()

	return nil
}

func (w *WSClient) SubscribeKline(symbol, interval string) error {
	if GetCurrentDataSource() == DataSourceHyperliquid {
		// Hyperliquid subscription
		// {"method": "subscribe", "subscription": {"type": "candle", "coin": "BTC", "interval": "1h"}}
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
		return w.sendJSON(msg)
	}

	// Binance/Bybit (Bybit handled in monitor.go via combined streams usually, but here for single stream)
	stream := fmt.Sprintf("%s@kline_%s", symbol, interval)
	return w.subscribe(stream)
}

func (w *WSClient) SubscribeTicker(symbol string) error {
	stream := fmt.Sprintf("%s@ticker", symbol)
	return w.subscribe(stream)
}

func (w *WSClient) SubscribeMiniTicker(symbol string) error {
	stream := fmt.Sprintf("%s@miniTicker", symbol)
	return w.subscribe(stream)
}

func (w *WSClient) subscribe(stream string) error {
	subscribeMsg := map[string]interface{}{
		"method": "SUBSCRIBE",
		"params": []string{stream},
		"id":     time.Now().Unix(),
	}
	return w.sendJSON(subscribeMsg)
}

func (w *WSClient) sendJSON(msg interface{}) error {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if w.conn == nil {
		return fmt.Errorf("WebSocket未连接")
	}

	err := w.conn.WriteJSON(msg)
	if err != nil {
		return err
	}

	log.Printf("发送WebSocket消息: %v", msg)
	return nil
}

func (w *WSClient) readMessages() {
	for {
		select {
		case <-w.done:
			return
		default:
			w.mu.RLock()
			conn := w.conn
			w.mu.RUnlock()

			if conn == nil {
				time.Sleep(1 * time.Second)
				continue
			}

			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("读取WebSocket消息失败: %v", err)
				w.handleReconnect()
				return
			}

			w.handleMessage(message)
		}
	}
}

func (w *WSClient) handleMessage(message []byte) {
	if GetCurrentDataSource() == DataSourceHyperliquid {
		w.handleHyperliquidMessage(message)
		return
	}

	var wsMsg WSMessage
	if err := json.Unmarshal(message, &wsMsg); err != nil {
		// 可能是其他格式的消息
		return
	}

	w.mu.RLock()
	ch, exists := w.subscribers[wsMsg.Stream]
	w.mu.RUnlock()

	if exists {
		select {
		case ch <- wsMsg.Data:
		default:
			log.Printf("订阅者通道已满: %s", wsMsg.Stream)
		}
	}
}

func (w *WSClient) handleHyperliquidMessage(message []byte) {
	var hlMsg HyperliquidWSMessage
	if err := json.Unmarshal(message, &hlMsg); err != nil {
		return
	}

	if hlMsg.Channel == "candle" {
		// Data is the candle update
		// Need to route to the correct subscriber.
		// Hyperliquid doesn't send the "stream" name in the same way.
		// We need to reconstruct the stream key or use a different mapping.
		// The data contains "coin" and "interval" (in ctx or implied).
		// Let's look at the data structure.
		// Data: {"coin": "BTC", "interval": "1h", "t": ..., "o": ...} ?
		// Actually, Hyperliquid candle update:
		// {"channel": "candle", "data": {"t": 123, "o": "...", ... "s": "BTC", "i": "1h"}}
		// Wait, the search result didn't specify the exact response format.
		// Usually it includes the coin symbol.
		// Let's assume we can map it back to "symbol@kline_interval" for compatibility.

		// We need to parse the data as a map to check fields
		dataMap, ok := hlMsg.Data.(map[string]interface{})
		if !ok {
			return
		}

		coin, _ := dataMap["s"].(string)     // Symbol
		interval, _ := dataMap["i"].(string) // Interval

		if coin == "" || interval == "" {
			// Try to find it in context or other fields if structure is different
			// For now, if we can't find it, we can't route it.
			return
		}

		// Map back to Binance-style stream key for compatibility with monitor.go
		// monitor.go expects: lowercase(symbol) + "@kline_" + interval
		// Hyperliquid coin is "BTC", we need "btcusdt" (if we appended USDT)
		// or just "btc" if we stripped it.
		// monitor.go uses "BTCUSDT" -> "btcusdt@kline_1h"

		// If we used "BTCUSDT" in monitor.go, we need to match that.
		// In api_client.go we appended USDT.
		symbol := coin + "USDT"
		streamKey := fmt.Sprintf("%s@kline_%s", strings.ToLower(symbol), interval)

		w.mu.RLock()
		ch, exists := w.subscribers[streamKey]
		w.mu.RUnlock()

		if exists {
			// We need to convert Hyperliquid candle to Binance KlineWSData format
			// so monitor.go can consume it without changes.
			// Or we change monitor.go to handle raw bytes differently.
			// monitor.go unmarshals into KlineWSData.
			// Let's construct a compatible JSON.

			// Extract fields
			t, _ := dataMap["t"].(float64)
			o, _ := dataMap["o"].(string)
			c, _ := dataMap["c"].(string)
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
					ClosePrice:     c,
					HighPrice:      h,
					LowPrice:       l,
					Volume:         v,
					NumberOfTrades: int(n),
					IsFinal:        true, // Hyperliquid updates are usually snapshots/final?
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

func (w *WSClient) handleReconnect() {
	if !w.reconnect {
		return
	}

	log.Println("尝试重新连接...")
	time.Sleep(3 * time.Second)

	if err := w.Connect(); err != nil {
		log.Printf("重新连接失败: %v", err)
		go w.handleReconnect()
	}
}

func (w *WSClient) AddSubscriber(stream string, bufferSize int) <-chan []byte {
	ch := make(chan []byte, bufferSize)
	w.mu.Lock()
	w.subscribers[stream] = ch
	w.mu.Unlock()
	return ch
}

func (w *WSClient) RemoveSubscriber(stream string) {
	w.mu.Lock()
	delete(w.subscribers, stream)
	w.mu.Unlock()
}

func (w *WSClient) Close() {
	w.reconnect = false
	close(w.done)

	w.mu.Lock()
	defer w.mu.Unlock()

	if w.conn != nil {
		w.conn.Close()
		w.conn = nil
	}

	// 关闭所有订阅者通道
	for stream, ch := range w.subscribers {
		close(ch)
		delete(w.subscribers, stream)
	}
}
