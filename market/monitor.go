package market

import (
	"aspen/metrics"
	"encoding/json"
	"fmt"
	"github.com/rs/zerolog/log"
	"strings"
	"sync"
	"time"
)

type WSMonitor struct {
	wsClient       *WSClient
	combinedClient *CombinedStreamsClient
	symbols        []string
	featuresMap    sync.Map
	alertsChan     chan Alert
	klineDataMap3m sync.Map // 存储每个交易对的K线历史数据
	klineDataMap4h sync.Map // 存储每个交易对的K线历史数据
	tickerDataMap  sync.Map // 存储每个交易对的ticker数据
	batchSize      int
	filterSymbols  sync.Map // 使用sync.Map来存储需要监控的币种和其状态
	symbolStats    sync.Map // 存储币种统计信息
	FilterSymbol   []string //经过筛选的币种
}
type SymbolStats struct {
	LastActiveTime   time.Time
	AlertCount       int
	VolumeSpikeCount int
	LastAlertTime    time.Time
	Score            float64 // 综合评分
}

var WSMonitorCli *WSMonitor
var subKlineTime = []string{"3m", "4h"} // 管理订阅流的K线周期

func NewWSMonitor(batchSize int) *WSMonitor {
	WSMonitorCli = &WSMonitor{
		wsClient:       NewWSClient(),
		combinedClient: NewCombinedStreamsClient(batchSize),
		alertsChan:     make(chan Alert, 1000),
		batchSize:      batchSize,
	}
	return WSMonitorCli
}

func (m *WSMonitor) Initialize(coins []string) error {
	log.Info().Msg("初始化WebSocket监控器...")
	// 获取交易对信息
	apiClient := NewAPIClient()
	// 如果不指定交易对，则使用market市场的所有交易对币种
	if len(coins) == 0 {
		exchangeInfo, err := apiClient.GetExchangeInfo()
		if err != nil {
			return err
		}
		// 筛选永续合约交易对 --仅测试时使用
		//exchangeInfo.Symbols = exchangeInfo.Symbols[0:2]
		for _, symbol := range exchangeInfo.Symbols {
			if symbol.Status == "TRADING" && symbol.ContractType == "PERPETUAL" && strings.ToUpper(symbol.Symbol[len(symbol.Symbol)-4:]) == "USDT" {
				m.symbols = append(m.symbols, symbol.Symbol)
				m.filterSymbols.Store(symbol.Symbol, true)
			}
		}
	} else {
		m.symbols = coins
	}

	log.Info().Msgf("找到 %d 个交易对", len(m.symbols))
	
	// 记录订阅的币种数量
	metrics.SetSubscribedSymbols(len(m.symbols))
	
	// 初始化历史数据
	if err := m.initializeHistoricalData(); err != nil {
		log.Error().Msgf("初始化历史数据失败: %v", err)
	}

	return nil
}

func (m *WSMonitor) initializeHistoricalData() error {
	apiClient := NewAPIClient()

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 5) // 限制并发数

	for _, symbol := range m.symbols {
		wg.Add(1)
		semaphore <- struct{}{}

		go func(s string) {
			defer wg.Done()
			defer func() { <-semaphore }()

			// 获取历史K线数据
			klines, err := apiClient.GetKlines(s, "3m", 100)
			if err != nil {
				log.Error().Msgf("获取 %s 历史数据失败: %v", s, err)
				return
			}
			if len(klines) > 0 {
				m.klineDataMap3m.Store(s, klines)
				log.Info().Msgf("已加载 %s 的历史K线数据-3m: %d 条", s, len(klines))
			}
			// 获取历史K线数据
			klines4h, err := apiClient.GetKlines(s, "4h", 100)
			if err != nil {
				log.Error().Msgf("获取 %s 历史数据失败: %v", s, err)
				return
			}
			if len(klines4h) > 0 {
				m.klineDataMap4h.Store(s, klines4h)
				log.Info().Msgf("已加载 %s 的历史K线数据-4h: %d 条", s, len(klines4h))
			}
		}(symbol)
	}

	wg.Wait()
	return nil
}

func (m *WSMonitor) Start(coins []string) {
	log.Info().Msgf("启动WebSocket实时监控...")
	// 初始化交易对
	err := m.Initialize(coins)
	if err != nil {
		log.Error().Msgf("❌ 初始化币种失败: %v", err)
		return
	}

	err = m.combinedClient.Connect()
	if err != nil {
		log.Error().Msgf("❌ 批量订阅流失败: %v", err)
		return
	}
	// 订阅所有交易对
	err = m.subscribeAll()
	if err != nil {
		log.Error().Msgf("❌ 订阅币种交易对失败: %v", err)
		return
	}
}

// subscribeSymbol 注册监听
func (m *WSMonitor) subscribeSymbol(symbol, st string) []string {
	var streams []string
	
	if GetCurrentDataSource() == DataSourceBybit {
		// Bybit 格式: kline.3.BTCUSDT
		bybitInterval := convertIntervalToBybit(st)
		stream := fmt.Sprintf("kline.%s.%s", bybitInterval, symbol)
		// 转换为 Binance 格式用于内部映射
		binanceStream := fmt.Sprintf("%s@kline_%s", strings.ToLower(symbol), st)
		ch := m.combinedClient.AddSubscriber(binanceStream, 100)
		streams = append(streams, stream)
		go m.handleKlineData(symbol, ch, st)
	} else {
		// Binance 格式
		stream := fmt.Sprintf("%s@kline_%s", strings.ToLower(symbol), st)
		ch := m.combinedClient.AddSubscriber(stream, 100)
		streams = append(streams, stream)
		go m.handleKlineData(symbol, ch, st)
	}

	return streams
}
func (m *WSMonitor) subscribeAll() error {
	// 执行批量订阅
	log.Info().Msg("开始订阅所有交易对...")
	for _, symbol := range m.symbols {
		for _, st := range subKlineTime {
			m.subscribeSymbol(symbol, st)
		}
	}
	for _, st := range subKlineTime {
		err := m.combinedClient.BatchSubscribeKlines(m.symbols, st)
		if err != nil {
			log.Error().Msgf("❌ 订阅 %s K线失败: %v", st, err)
			return err
		}
	}
	log.Info().Msg("所有交易对订阅完成")
	return nil
}

func (m *WSMonitor) handleKlineData(symbol string, ch <-chan []byte, _time string) {
	for data := range ch {
		var klineData KlineWSData
		if err := json.Unmarshal(data, &klineData); err != nil {
			log.Error().Msgf("解析Kline数据失败: %v", err)
			continue
		}
		m.processKlineUpdate(symbol, klineData, _time)
	}
}

func (m *WSMonitor) getKlineDataMap(_time string) *sync.Map {
	var klineDataMap *sync.Map
	if _time == "3m" {
		klineDataMap = &m.klineDataMap3m
	} else if _time == "4h" {
		klineDataMap = &m.klineDataMap4h
	} else {
		klineDataMap = &sync.Map{}
	}
	return klineDataMap
}
func (m *WSMonitor) processKlineUpdate(symbol string, wsData KlineWSData, _time string) {
	// 转换WebSocket数据为Kline结构
	kline := Kline{
		OpenTime:  wsData.Kline.StartTime,
		CloseTime: wsData.Kline.CloseTime,
		Trades:    wsData.Kline.NumberOfTrades,
	}
	kline.Open, _ = parseFloat(wsData.Kline.OpenPrice)
	kline.High, _ = parseFloat(wsData.Kline.HighPrice)
	kline.Low, _ = parseFloat(wsData.Kline.LowPrice)
	kline.Close, _ = parseFloat(wsData.Kline.ClosePrice)
	kline.Volume, _ = parseFloat(wsData.Kline.Volume)
	kline.High, _ = parseFloat(wsData.Kline.HighPrice)
	kline.QuoteVolume, _ = parseFloat(wsData.Kline.QuoteVolume)
	kline.TakerBuyBaseVolume, _ = parseFloat(wsData.Kline.TakerBuyBaseVolume)
	kline.TakerBuyQuoteVolume, _ = parseFloat(wsData.Kline.TakerBuyQuoteVolume)
	// 更新K线数据
	var klineDataMap = m.getKlineDataMap(_time)
	value, exists := klineDataMap.Load(symbol)
	var klines []Kline
	if exists {
		klines = value.([]Kline)

		// 检查是否是新的K线
		if len(klines) > 0 && klines[len(klines)-1].OpenTime == kline.OpenTime {
			// 更新当前K线
			klines[len(klines)-1] = kline
		} else {
			// 添加新K线
			klines = append(klines, kline)

			// 保持数据长度
			if len(klines) > 100 {
				klines = klines[1:]
			}
		}
	} else {
		klines = []Kline{kline}
	}

	klineDataMap.Store(symbol, klines)
}

func (m *WSMonitor) GetCurrentKlines(symbol string, _time string) ([]Kline, error) {
	// 对每一个进来的symbol检测是否存在内类 是否的话就订阅它
	value, exists := m.getKlineDataMap(_time).Load(symbol)
	if !exists {
		// 如果Ws数据未初始化完成时,单独使用api获取 - 兼容性代码 (防止在未初始化完成是,已经有交易员运行)
		log.Info().Msgf("📡 [Market] WebSocket缓存中无 %s 的 %s K线数据，使用API直接获取...", symbol, _time)
		apiClient := NewAPIClient()
		klines, err := apiClient.GetKlines(symbol, _time, 100)
		if err != nil {
			log.Error().Msgf("❌ [Market] 获取 %s 的 %s K线数据失败: %v", symbol, _time, err)
			return nil, fmt.Errorf("获取%v分钟K线失败: %v", _time, err)
		}

		// 动态缓存进缓存
		m.getKlineDataMap(_time).Store(strings.ToUpper(symbol), klines)

		// 订阅 WebSocket 流
		subStr := m.subscribeSymbol(symbol, _time)
		subErr := m.combinedClient.subscribeStreams(subStr)
		log.Info().Msgf("动态订阅流: %v", subStr)
		if subErr != nil {
			log.Error().Msgf("警告: 动态订阅%v分钟K线失败: %v (使用API数据)", _time, subErr)
		}

		// ✅ FIX: 返回深拷贝而非引用
		result := make([]Kline, len(klines))
		copy(result, klines)
		return result, nil
	}

	// ✅ FIX: 返回深拷贝而非引用，避免并发竞态条件
	klines := value.([]Kline)
	result := make([]Kline, len(klines))
	copy(result, klines)
	return result, nil
}

func (m *WSMonitor) Close() {
	m.wsClient.Close()
	close(m.alertsChan)
}
