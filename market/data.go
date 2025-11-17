package market

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// FundingRateCache 资金费率缓存结构
// Binance Funding Rate 每 8 小时才更新一次，使用 1 小时缓存可显著减少 API 调用
type FundingRateCache struct {
	Rate      float64
	UpdatedAt time.Time
}

var (
	fundingRateMap sync.Map // map[string]*FundingRateCache
	frCacheTTL     = 1 * time.Hour
)

// Get 获取指定代币的市场数据
func Get(symbol string) (*Data, error) {
	var klines3m, klines4h []Kline
	var err error
	// 标准化symbol
	symbol = Normalize(symbol)
	// 获取3分钟K线数据 (最近10个)
	klines3m, err = WSMonitorCli.GetCurrentKlines(symbol, "3m") // 多获取一些用于计算
	if err != nil {
		return nil, fmt.Errorf("获取3分钟K线失败: %v", err)
	}

	// 获取4小时K线数据 (最近10个)
	klines4h, err = WSMonitorCli.GetCurrentKlines(symbol, "4h") // 多获取用于计算指标
	if err != nil {
		return nil, fmt.Errorf("获取4小时K线失败: %v", err)
	}

	// 检查数据是否为空
	if len(klines3m) == 0 {
		return nil, fmt.Errorf("3分钟K线数据为空")
	}
	if len(klines4h) == 0 {
		return nil, fmt.Errorf("4小时K线数据为空")
	}

	// 计算当前指标 (基于3分钟最新数据)
	currentPrice := klines3m[len(klines3m)-1].Close
	currentEMA20 := calculateEMA(klines3m, 20)
	currentMACD := calculateMACD(klines3m)
	currentRSI7 := calculateRSI(klines3m, 7)

	// 计算价格变化百分比
	// 1小时价格变化 = 20个3分钟K线前的价格
	priceChange1h := 0.0
	if len(klines3m) >= 21 { // 至少需要21根K线 (当前 + 20根前)
		price1hAgo := klines3m[len(klines3m)-21].Close
		if price1hAgo > 0 {
			priceChange1h = ((currentPrice - price1hAgo) / price1hAgo) * 100
		}
	}

	// 4小时价格变化 = 1个4小时K线前的价格
	priceChange4h := 0.0
	if len(klines4h) >= 2 {
		price4hAgo := klines4h[len(klines4h)-2].Close
		if price4hAgo > 0 {
			priceChange4h = ((currentPrice - price4hAgo) / price4hAgo) * 100
		}
	}

	// 获取OI数据
	oiData, err := getOpenInterestData(symbol)
	if err != nil {
		// OI失败不影响整体,使用默认值
		oiData = &OIData{Latest: 0, Average: 0}
	}

	// 获取Funding Rate
	fundingRate, _ := getFundingRate(symbol)

	// 计算日内系列数据
	intradayData := calculateIntradaySeries(klines3m)

	// 计算长期数据
	longerTermData := calculateLongerTermData(klines4h)

	// ——— 来自 Pine 脚本的新增指标计算（1—10） ———
	currentTSI, currentTSISignal := calculateTSI(klines3m, 35, 35, 13)
	kemadTrend, kemaVal, kemadATR := calculateKEMAD(klines3m)
	vgbTrend, vgbAvg, vgbUpper, vgbLower, vgbScore := calculateVolatilityGaussianBands(klines3m, 20, 2.0)
	sslExit, sslBaseline, sslUpperK, sslLowerK := calculateSSLHybridExit(klines3m, 20, 60)
	zlTrend, zlZLEMA, zlVol := calculateZeroLagTrendSignals(klines3m, 34)
	qqeTrend, qqeFastTL, qqeUpper, qqeLower := calculateQQEModHybrid(klines3m)
	rfKalman, rfTrend, rfKTrend, rfCombined := calculateRangeFilteredTrend(klines3m)
	dpsdTrend, dpsdPT, dpsdEMA, dpsdPerUp, dpsdPerDown := calculateDPSD(klines3m, 20)
	ursi, ursiSig, ursiOB, ursiOS := calculateUltimateRSI(klines3m, 14)
	rsiVal10, rsiBuy10, rsiSell10 := calculateRSIWithPatterns(klines3m, 14)

	return &Data{
		Symbol:            symbol,
		CurrentPrice:      currentPrice,
		PriceChange1h:     priceChange1h,
		PriceChange4h:     priceChange4h,
		CurrentEMA20:      currentEMA20,
		CurrentMACD:       currentMACD,
		CurrentRSI7:       currentRSI7,
		OpenInterest:      oiData,
		FundingRate:       fundingRate,
		IntradaySeries:    intradayData,
		LongerTermContext: longerTermData,
		// 新增 1—10 指标汇总
		CurrentTSI:        currentTSI,
		CurrentTSISignal:  currentTSISignal,
		KEMADTrend:        kemadTrend,
		KEMADEMA:          kemaVal,
		KEMADATR:          kemadATR,
		VGBTrend:          vgbTrend,
		VGBAvg:            vgbAvg,
		VGBUpper:          vgbUpper,
		VGBLower:          vgbLower,
		VGBScore:          vgbScore,
		SSLExitSignal:     sslExit,
		SSLBaseline:       sslBaseline,
		SSLUpperK:         sslUpperK,
		SSLLowerK:         sslLowerK,
		ZeroLagTrend:      zlTrend,
		ZeroLagZLEMA:      zlZLEMA,
		ZeroLagVolatility: zlVol,
		QQETrend:          qqeTrend,
		QQEFastTL:         qqeFastTL,
		QQEUpper:          qqeUpper,
		QQELower:          qqeLower,
		RangeKalman:       rfKalman,
		RangeTrend:        rfTrend,
		RangeKTrend:       rfKTrend,
		RangeCombinedTrend: rfCombined,
		DPSDTrend:         dpsdTrend,
		DPSDPT:            dpsdPT,
		DPSDEMA:           dpsdEMA,
		DPSDPerUp:         dpsdPerUp,
		DPSDPerDown:       dpsdPerDown,
		UltimateRSI:       ursi,
		UltimateRSISignal: ursiSig,
		UltimateRSIOverbought: ursiOB,
		UltimateRSIOversold:   ursiOS,
		RSIBuySignal:      rsiBuy10,
		RSISellSignal:     rsiSell10,
		RSIValue:          rsiVal10,
	}, nil
}

// calculateEMA 计算EMA
func calculateEMA(klines []Kline, period int) float64 {
	if len(klines) < period {
		return 0
	}

	// 计算SMA作为初始EMA
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += klines[i].Close
	}
	ema := sum / float64(period)

	// 计算EMA
	multiplier := 2.0 / float64(period+1)
	for i := period; i < len(klines); i++ {
		ema = (klines[i].Close-ema)*multiplier + ema
	}

	return ema
}

// calculateMACD 计算MACD
func calculateMACD(klines []Kline) float64 {
	if len(klines) < 26 {
		return 0
	}

	// 计算12期和26期EMA
	ema12 := calculateEMA(klines, 12)
	ema26 := calculateEMA(klines, 26)

	// MACD = EMA12 - EMA26
	return ema12 - ema26
}

// calculateRSI 计算RSI
func calculateRSI(klines []Kline, period int) float64 {
	if len(klines) <= period {
		return 0
	}

	gains := 0.0
	losses := 0.0

	// 计算初始平均涨跌幅
	for i := 1; i <= period; i++ {
		change := klines[i].Close - klines[i-1].Close
		if change > 0 {
			gains += change
		} else {
			losses += -change
		}
	}

	avgGain := gains / float64(period)
	avgLoss := losses / float64(period)

	// 使用Wilder平滑方法计算后续RSI
	for i := period + 1; i < len(klines); i++ {
		change := klines[i].Close - klines[i-1].Close
		if change > 0 {
			avgGain = (avgGain*float64(period-1) + change) / float64(period)
			avgLoss = (avgLoss * float64(period-1)) / float64(period)
		} else {
			avgGain = (avgGain * float64(period-1)) / float64(period)
			avgLoss = (avgLoss*float64(period-1) + (-change)) / float64(period)
		}
	}

	if avgLoss == 0 {
		return 100
	}

	rs := avgGain / avgLoss
	rsi := 100 - (100 / (1 + rs))

	return rsi
}

// calculateATR 计算ATR
func calculateATR(klines []Kline, period int) float64 {
	if len(klines) <= period {
		return 0
	}

	trs := make([]float64, len(klines))
	for i := 1; i < len(klines); i++ {
		high := klines[i].High
		low := klines[i].Low
		prevClose := klines[i-1].Close

		tr1 := high - low
		tr2 := math.Abs(high - prevClose)
		tr3 := math.Abs(low - prevClose)

		trs[i] = math.Max(tr1, math.Max(tr2, tr3))
	}

	// 计算初始ATR
	sum := 0.0
	for i := 1; i <= period; i++ {
		sum += trs[i]
	}
	atr := sum / float64(period)

	// Wilder平滑
	for i := period + 1; i < len(klines); i++ {
		atr = (atr*float64(period-1) + trs[i]) / float64(period)
	}

	return atr
}

// calculateIntradaySeries 计算日内系列数据
func calculateIntradaySeries(klines []Kline) *IntradayData {
	data := &IntradayData{
		MidPrices:   make([]float64, 0, 10),
		EMA20Values: make([]float64, 0, 10),
		MACDValues:  make([]float64, 0, 10),
		RSI7Values:  make([]float64, 0, 10),
		RSI14Values: make([]float64, 0, 10),
		Volume:      make([]float64, 0, 10),
	}

	// 获取最近10个数据点
	start := len(klines) - 10
	if start < 0 {
		start = 0
	}

	for i := start; i < len(klines); i++ {
		data.MidPrices = append(data.MidPrices, klines[i].Close)
		data.Volume = append(data.Volume, klines[i].Volume)

		// 计算每个点的EMA20
		if i >= 19 {
			ema20 := calculateEMA(klines[:i+1], 20)
			data.EMA20Values = append(data.EMA20Values, ema20)
		}

		// 计算每个点的MACD
		if i >= 25 {
			macd := calculateMACD(klines[:i+1])
			data.MACDValues = append(data.MACDValues, macd)
		}

		// 计算每个点的RSI
		if i >= 7 {
			rsi7 := calculateRSI(klines[:i+1], 7)
			data.RSI7Values = append(data.RSI7Values, rsi7)
		}
		if i >= 14 {
			rsi14 := calculateRSI(klines[:i+1], 14)
			data.RSI14Values = append(data.RSI14Values, rsi14)
		}
	}

	// 计算3m ATR14
	data.ATR14 = calculateATR(klines, 14)

	return data
}

// calculateLongerTermData 计算长期数据
func calculateLongerTermData(klines []Kline) *LongerTermData {
	data := &LongerTermData{
		MACDValues:  make([]float64, 0, 10),
		RSI14Values: make([]float64, 0, 10),
	}

	// 计算EMA
	data.EMA20 = calculateEMA(klines, 20)
	data.EMA50 = calculateEMA(klines, 50)

	// 计算ATR
	data.ATR3 = calculateATR(klines, 3)
	data.ATR14 = calculateATR(klines, 14)

	// 计算成交量
	if len(klines) > 0 {
		data.CurrentVolume = klines[len(klines)-1].Volume
		// 计算平均成交量
		sum := 0.0
		for _, k := range klines {
			sum += k.Volume
		}
		data.AverageVolume = sum / float64(len(klines))
	}

	// 计算MACD和RSI序列
	start := len(klines) - 10
	if start < 0 {
		start = 0
	}

	for i := start; i < len(klines); i++ {
		if i >= 25 {
			macd := calculateMACD(klines[:i+1])
			data.MACDValues = append(data.MACDValues, macd)
		}
		if i >= 14 {
			rsi14 := calculateRSI(klines[:i+1], 14)
			data.RSI14Values = append(data.RSI14Values, rsi14)
		}
	}

	return data
}

// getOpenInterestData 获取OI数据
func getOpenInterestData(symbol string) (*OIData, error) {
	url, err := GetOIURL(symbol)
	if err != nil {
		return nil, err
	}

	apiClient := NewAPIClient()
	resp, err := apiClient.client.Get(url)
	if err != nil {
		sourceName := string(GetCurrentDataSource())
		return nil, fmt.Errorf("HTTP请求失败 (%s): %w", sourceName, err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		sourceName := string(GetCurrentDataSource())
		return nil, fmt.Errorf("%s API返回错误状态码 %d: %s", sourceName, resp.StatusCode, string(body))
	}

	var oi float64

	if GetCurrentDataSource() == DataSourceBybit {
		// Bybit 响应格式
		var response struct {
			RetCode int    `json:"retCode"`
			RetMsg  string `json:"retMsg"`
			Result  struct {
				Category    string `json:"category"`
				Symbol      string `json:"symbol"`
				OpenInterest string `json:"openInterest"`
				Timestamp   string `json:"timestamp"`
			} `json:"result"`
		}
		if err := json.Unmarshal(body, &response); err != nil {
			log.Printf("❌ [Market] 解析Bybit OpenInterest数据失败, symbol=%s, 响应内容: %s", symbol, string(body))
			return nil, fmt.Errorf("解析Bybit JSON响应失败: %w", err)
		}
		if response.RetCode != 0 {
			return nil, fmt.Errorf("Bybit API错误: %s (code: %d)", response.RetMsg, response.RetCode)
		}
		oi, err = strconv.ParseFloat(response.Result.OpenInterest, 64)
		if err != nil {
			log.Printf("❌ [Market] 解析Bybit OpenInterest数值失败, symbol=%s, value=%s", symbol, response.Result.OpenInterest)
			return nil, fmt.Errorf("解析OpenInterest数值失败: %w", err)
		}
	} else {
		// Binance 响应格式
		var result struct {
			OpenInterest string `json:"openInterest"`
			Symbol       string `json:"symbol"`
			Time         int64  `json:"time"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			log.Printf("❌ [Market] 解析OpenInterest数据失败, symbol=%s, 响应内容: %s", symbol, string(body))
			return nil, fmt.Errorf("解析JSON响应失败: %w", err)
		}
		oi, err = strconv.ParseFloat(result.OpenInterest, 64)
		if err != nil {
			log.Printf("❌ [Market] 解析OpenInterest数值失败, symbol=%s, value=%s", symbol, result.OpenInterest)
			return nil, fmt.Errorf("解析OpenInterest数值失败: %w", err)
		}
	}

	if oi == 0 {
		log.Printf("⚠️  [Market] %s 的 OpenInterest 为 0（可能是数据问题或币种未交易）", symbol)
	}

	return &OIData{
		Latest:  oi,
		Average: oi * 0.999, // 近似平均值
	}, nil
}

// getFundingRate 获取资金费率（优化：使用 1 小时缓存）
func getFundingRate(symbol string) (float64, error) {
	// 检查缓存（有效期 1 小时）
	// Funding Rate 每 8 小时才更新，1 小时缓存非常合理
	if cached, ok := fundingRateMap.Load(symbol); ok {
		cache := cached.(*FundingRateCache)
		if time.Since(cache.UpdatedAt) < frCacheTTL {
			// 缓存命中，直接返回
			return cache.Rate, nil
		}
	}

	// 缓存过期或不存在，调用 API
	url, err := GetFundingURL(symbol)
	if err != nil {
		return 0, err
	}

	apiClient := NewAPIClient()
	resp, err := apiClient.client.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	var fundingRate float64
	if GetCurrentDataSource() == DataSourceBybit {
		// Bybit 响应格式
		var response struct {
			RetCode int    `json:"retCode"`
			RetMsg  string `json:"retMsg"`
			Result  struct {
				List []struct {
					Symbol        string `json:"symbol"`
					FundingRate   string `json:"fundingRate"`
					MarkPrice     string `json:"markPrice"`
					IndexPrice    string `json:"indexPrice"`
				} `json:"list"`
			} `json:"result"`
		}
		if err := json.Unmarshal(body, &response); err != nil {
			return 0, err
		}
		if response.RetCode != 0 || len(response.Result.List) == 0 {
			return 0, fmt.Errorf("Bybit API错误: %s", response.RetMsg)
		}
		fundingRate, err = strconv.ParseFloat(response.Result.List[0].FundingRate, 64)
		if err != nil {
			return 0, err
		}
	} else {
		// Binance 响应格式
		var result struct {
			Symbol          string `json:"symbol"`
			MarkPrice       string `json:"markPrice"`
			IndexPrice      string `json:"indexPrice"`
			LastFundingRate string `json:"lastFundingRate"`
			NextFundingTime int64  `json:"nextFundingTime"`
			InterestRate    string `json:"interestRate"`
			Time            int64  `json:"time"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			return 0, err
		}
		fundingRate, err = strconv.ParseFloat(result.LastFundingRate, 64)
		if err != nil {
			return 0, err
		}
	}

	// 更新缓存
	fundingRateMap.Store(symbol, &FundingRateCache{
		Rate:      fundingRate,
		UpdatedAt: time.Now(),
	})

	return fundingRate, nil
}

// TSI 指标计算 来自脚本:1—TSI副图指标，指标-40区域金叉买，正40死叉卖
func calculateTSI(klines []Kline, longPeriod, shortPeriod, signalPeriod int) (float64, float64) {
	if len(klines) < (longPeriod+shortPeriod) || len(klines) < 2 {
		return 0, 0
	}

	// 价格变化序列（pc）
	pc := make([]float64, 0, len(klines)-1)
	absPC := make([]float64, 0, len(klines)-1)
	for i := 1; i < len(klines); i++ {
		change := klines[i].Close - klines[i-1].Close
		pc = append(pc, change)
		if change < 0 {
			absPC = append(absPC, -change)
		} else {
			absPC = append(absPC, change)
		}
	}

	// 双重平滑：先长周期EMA，再短周期EMA
	longPC := emaSeries(pc, longPeriod)
	longAbs := emaSeries(absPC, longPeriod)
	if len(longPC) == 0 || len(longAbs) == 0 {
		return 0, 0
	}
	shortPC := emaSeries(longPC, shortPeriod)
	shortAbs := emaSeries(longAbs, shortPeriod)
	if len(shortPC) == 0 || len(shortAbs) == 0 {
		return 0, 0
	}

	// 计算TSI序列
	length := min(len(shortPC), len(shortAbs))
	tsiSeries := make([]float64, length)
	for i := 0; i < length; i++ {
		denom := shortAbs[i]
		if denom == 0 {
			tsiSeries[i] = 0
		} else {
			tsiSeries[i] = 100.0 * (shortPC[i] / denom)
		}
	}

	// 计算信号线（EMA）
	signalSeries := emaSeries(tsiSeries, signalPeriod)
	tsi := tsiSeries[length-1]
	signal := 0.0
	if len(signalSeries) > 0 {
		signal = signalSeries[len(signalSeries)-1]
	}
	return tsi, signal
}

// 通用 EMA 序列计算（返回序列的EMA值，从第 period-1 个元素开始）
func emaSeries(values []float64, period int) []float64 {
	if len(values) < period || period <= 0 {
		return []float64{}
	}
	out := make([]float64, 0, len(values)-period+1)
	// 初始SMA
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += values[i]
	}
	ema := sum / float64(period)
	out = append(out, ema)

	multiplier := 2.0 / float64(period+1)
	for i := period; i < len(values); i++ {
		ema = (values[i]-ema)*multiplier + ema
		out = append(out, ema)
	}
	return out
}

// —— 工具函数 ——
func sma(values []float64, period int) float64 {
	if period <= 0 || len(values) < period {
		return 0
	}
	sum := 0.0
	for i := len(values) - period; i < len(values); i++ {
		sum += values[i]
	}
	return sum / float64(period)
}

func stdev(values []float64, period int) float64 {
	if period <= 1 || len(values) < period {
		return 0
	}
	mean := sma(values, period)
	sum := 0.0
	for i := len(values) - period; i < len(values); i++ {
		d := values[i] - mean
		sum += d * d
	}
	return math.Sqrt(sum / float64(period))
}

// calculateZLEMA 计算 ZLEMA（Zero-Lag EMA）
func calculateZLEMA(klines []Kline, period int) float64 {
	if len(klines) < period {
		return 0
	}
	lag := (period - 1) / 2
	// 构造零滞后价格序列
	adj := make([]float64, 0, len(klines))
	for i := 0; i < len(klines); i++ {
		p := klines[i].Close
		prev := p
		if i-lag >= 0 {
			prev = klines[i-lag].Close
		}
		adj = append(adj, p+(p-prev))
	}
	// 对调整后的价格做EMA
	vals := make([]float64, len(klines))
	for i := range vals {
		vals[i] = klines[i].Close
	}
	// 为简单起见，直接对 adj 的最后 period 段进行EMA
	mult := 2.0 / float64(period+1)
	s := 0.0
	start := len(adj) - period
	if start < 0 {
		start = 0
	}
	for i := start; i < len(adj); i++ {
		if i == start {
			s = sma(adj[:i+1], i-start+1)
		} else {
			s = (adj[i]-s)*mult + s
		}
	}
	return s
}

// calculateKEMAD 来自脚本: 2—KEMAD代码中绿色卖红色卖
// 采用一维卡尔曼滤波平滑收盘价，并以最新收盘与滤波值的相对位置判定趋势
func calculateKEMAD(klines []Kline) (trend int, kema float64, atr float64) {
	if len(klines) == 0 {
		return 0, 0, 0
	}
	q := 0.01
	r := 1.0
	x := klines[0].Close
	p := 1.0
	for i := 1; i < len(klines); i++ {
		p += q
		k := p / (p + r)
		x = x + k*(klines[i].Close-x)
		p = (1 - k) * p
	}
	atr = calculateATR(klines, 14)
	last := klines[len(klines)-1].Close
	if last > x {
		trend = 1
	} else if last < x {
		trend = -1
	}
	return trend, x, atr
}

// calculateVolatilityGaussianBands 来自脚本: 3—Volatillity趋势指标有明确买卖箭头
// 使用EMA与标准差构造波动率带，价超上轨→上行，破下轨→下行
func calculateVolatilityGaussianBands(klines []Kline, length int, mult float64) (trend int, avg, upper, lower, score float64) {
	if len(klines) < length {
		return 0, 0, 0, 0, 0
	}
	closes := make([]float64, len(klines))
	for i := range closes {
		closes[i] = klines[i].Close
	}
	avg = calculateEMA(klines, length)
	sd := stdev(closes, length)
	upper = avg + mult*sd
	lower = avg - mult*sd
	last := closes[len(closes)-1]
	if sd > 0 {
		score = (last - avg) / sd
	}
	if last > upper {
		trend = 1
	} else if last < lower {
		trend = -1
	} else {
		trend = 0
	}
	return trend, avg, upper, lower, score
}

// calculateSSLHybridExit 来自脚本: 4—ssl代码中有EXIT 上下箭头指示买卖
// 构造SSL通道(高低价SMA)与基线，价格上下穿通道触发EXIT信号
func calculateSSLHybridExit(klines []Kline, chLen int, baselineLen int) (exitSignal int, baseline, upperK, lowerK float64) {
	if len(klines) < chLen {
		return 0, 0, 0, 0
	}
	highs := make([]float64, len(klines))
	lows := make([]float64, len(klines))
	closes := make([]float64, len(klines))
	for i := range klines {
		highs[i] = klines[i].High
		lows[i] = klines[i].Low
		closes[i] = klines[i].Close
	}
	upperK = sma(highs, chLen)
	lowerK = sma(lows, chLen)
	baseline = calculateEMA(klines, baselineLen)
	// 计算前一根通道用于穿越判断
	prevUpper := upperK
	prevLower := lowerK
	if len(klines) > chLen+1 {
		prevUpper = sma(highs[:len(highs)-1], chLen)
		prevLower = sma(lows[:len(lows)-1], chLen)
	}
	prevClose := closes[len(closes)-2]
	last := closes[len(closes)-1]
	// 上穿上轨 → 买箭头；下穿下轨 → 卖箭头
	if prevClose <= prevUpper && last > upperK {
		exitSignal = 1
	} else if prevClose >= prevLower && last < lowerK {
		exitSignal = -1
	} else {
		exitSignal = 0
	}
	return exitSignal, baseline, upperK, lowerK
}

// calculateZeroLagTrendSignals 来自脚本: 5—zero lag趋势指标有明确买卖箭头
// 使用ZLEMA与ATR近似衡量波动，价位相对ZLEMA判定趋势
func calculateZeroLagTrendSignals(klines []Kline, period int) (trend int, zlema, vol float64) {
	if len(klines) < period {
		return 0, 0, 0
	}
	zlema = calculateZLEMA(klines, period)
	vol = calculateATR(klines, 14)
	last := klines[len(klines)-1].Close
	if last > zlema {
		trend = 1
	} else if last < zlema {
		trend = -1
	}
	return trend, zlema, vol
}

// calculateQQEModHybrid 来自脚本: 6—SSQ止损指标，红色下降趋势，绿色上涨趋势
// 近似QQE MOD：对RSI进行EMA平滑与波动阈值构造，上下轨用于趋势参考
func calculateQQEModHybrid(klines []Kline) (trend int, fastTL, upper, lower float64) {
	if len(klines) < 15 {
		return 0, 0, 0, 0
	}
	// RSI 基线
	rsi := make([]float64, len(klines))
	for i := range klines {
		rsi[i] = calculateRSI(klines[:i+1], 14)
	}
	// 快速平滑
	emaRSI := emaSeries(rsi, 5)
	if len(emaRSI) == 0 {
		return 0, 0, 0, 0
	}
	fastTL = emaRSI[len(emaRSI)-1]
	// RSI 波动（绝对变化的EMA）
	diffAbs := make([]float64, 0, len(emaRSI))
	for i := 1; i < len(emaRSI); i++ {
		d := math.Abs(emaRSI[i] - emaRSI[i-1])
		diffAbs = append(diffAbs, d)
	}
	atrRSI := 0.0
	if len(diffAbs) >= 5 {
		atrSeries := emaSeries(diffAbs, 5)
		atrRSI = atrSeries[len(atrSeries)-1]
	}
	factor := 4.236
	upper = fastTL + factor*atrRSI
	lower = fastTL - factor*atrRSI
	// 趋势（简化）：RSI平滑 > 50 视为上行，< 50 视为下行
	if fastTL > 50 {
		trend = 1
	} else if fastTL < 50 {
		trend = -1
	}
	return trend, fastTL, upper, lower
}

// calculateRangeFilteredTrend 来自脚本: 7—range filtered趋势指标 有买卖箭头
// 卡尔曼平滑+ATR阈值的区间滤波，超过阈值的偏离判定趋势
func calculateRangeFilteredTrend(klines []Kline) (kalman float64, trend int, kTrend int, combined int) {
	if len(klines) == 0 {
		return 0, 0, 0, 0
	}
	// 卡尔曼
	q := 0.01
	r := 1.0
	x := klines[0].Close
	p := 1.0
	for i := 1; i < len(klines); i++ {
		p += q
		k := p / (p + r)
		x = x + k*(klines[i].Close-x)
		p = (1 - k) * p
	}
	atr := calculateATR(klines, 14)
	thr := 0.5 * atr
	last := klines[len(klines)-1].Close
	if last-x > thr {
		trend = 1
	} else if x-last > thr {
		trend = -1
	} else {
		trend = 0
	}
	// 卡尔曼斜率趋势（简化采用价格相对卡尔曼的趋势）
	kTrend = trend
	combined = 0
	if trend == 1 && kTrend == 1 {
		combined = 1
	} else if trend == -1 && kTrend == -1 {
		combined = -1
	}
	return x, trend, kTrend, combined
}

// calculateDPSD 来自脚本: 8—dpsd副图指标代码中0轴线是多空线，金叉买死叉卖
// DEMA与标准差构成百分位得分，>0上行，<0下行
func calculateDPSD(klines []Kline, length int) (trend int, pt, demaVal float64, perUp, perDown float64) {
	if len(klines) < length {
		return 0, 0, 0, 0, 0
	}
	// DEMA = 2*EMA - EMA(EMA)
	ema1 := calculateEMA(klines, length)
	// 构造EMA序列以便二次EMA
	closes := make([]float64, len(klines))
	for i := range klines {
		closes[i] = klines[i].Close
	}
	emaSeq := emaSeries(closes, length)
	demaSeq := emaSeries(emaSeq, length)
	if len(demaSeq) > 0 {
		demaVal = 2*ema1 - demaSeq[len(demaSeq)-1]
	} else {
		demaVal = ema1
	}
	sd := stdev(closes, length)
	last := closes[len(closes)-1]
	if sd > 0 {
		pt = (last - demaVal) / sd
	}
	if pt > 0 {
		trend = 1
		perUp = pt
		perDown = 0
	} else if pt < 0 {
		trend = -1
		perUp = 0
		perDown = -pt
	} else {
		trend = 0
		perUp, perDown = 0, 0
	}
	return trend, pt, demaVal, perUp, perDown
}

// calculateUltimateRSI 来自脚本: 9—RSI2副图指标，代码中有超买超卖区，金叉买死叉卖
// 多重平滑RSI（简化：EMA平滑与信号线），同时给出超买/超卖布尔
func calculateUltimateRSI(klines []Kline, period int) (value float64, signal float64, overbought, oversold bool) {
	if len(klines) < period+1 {
		return 0, 0, false, false
	}
	// 原始RSI
	rsi := calculateRSI(klines, period)
	// 进一步平滑
	// 为简洁直接对RSI值进行二次EMA近似
	vals := make([]float64, 0, period)
	for i := len(klines) - period; i < len(klines); i++ {
		vals = append(vals, calculateRSI(klines[:i+1], period))
	}
	series := emaSeries(vals, min(5, len(vals)))
	if len(series) > 0 {
		value = series[len(series)-1]
	} else {
		value = rsi
	}
	// 信号线（EMA5）
	sigSeries := emaSeries(vals, min(5, len(vals)))
	if len(sigSeries) > 0 {
		signal = sigSeries[len(sigSeries)-1]
	}
	overbought = value >= 70
	oversold = value <= 30
	return value, signal, overbought, oversold
}

// calculateRSIWithPatterns 来自脚本: 10—rsi副图指标，代码中直接显示BUY买，SEEL卖
// 基于RSI阈值与常见吞噬形态生成买卖信号（简化）
func calculateRSIWithPatterns(klines []Kline, period int) (rsiVal float64, buy, sell bool) {
	if len(klines) < 2 {
		return 0, false, false
	}
	rsiVal = calculateRSI(klines, period)
	prev := klines[len(klines)-2]
	last := klines[len(klines)-1]
	bullEngulf := prev.Close < prev.Open && last.Close > last.Open && last.Close > prev.Open && last.Open < prev.Close
	bearEngulf := prev.Close > prev.Open && last.Close < last.Open && last.Close < prev.Open && last.Open > prev.Close
	buy = rsiVal <= 30 || bullEngulf
	sell = rsiVal >= 70 || bearEngulf
	return rsiVal, buy, sell
}

// Format 格式化输出市场数据
func Format(data *Data) string {
	var sb strings.Builder

	// 使用动态精度格式化价格
	priceStr := formatPriceWithDynamicPrecision(data.CurrentPrice)
	sb.WriteString(fmt.Sprintf("current_price = %s, current_ema20 = %.3f, current_macd = %.3f, current_rsi (7 period) = %.3f, current_tsi = %.3f, tsi_signal = %.3f\n\n",
		priceStr, data.CurrentEMA20, data.CurrentMACD, data.CurrentRSI7, data.CurrentTSI, data.CurrentTSISignal))

	sb.WriteString(fmt.Sprintf("In addition, here is the latest %s open interest and funding rate for perps:\n\n",
		data.Symbol))

	if data.OpenInterest != nil {
		// 使用动态精度格式化 OI 数据
		oiLatestStr := formatPriceWithDynamicPrecision(data.OpenInterest.Latest)
		oiAverageStr := formatPriceWithDynamicPrecision(data.OpenInterest.Average)
		sb.WriteString(fmt.Sprintf("Open Interest: Latest: %s Average: %s\n\n",
			oiLatestStr, oiAverageStr))
	}

	sb.WriteString(fmt.Sprintf("Funding Rate: %.2e\n\n", data.FundingRate))

	if data.IntradaySeries != nil {
		sb.WriteString("Intraday series (3‑minute intervals, oldest → latest):\n\n")

		if len(data.IntradaySeries.MidPrices) > 0 {
			sb.WriteString(fmt.Sprintf("Mid prices: %s\n\n", formatFloatSlice(data.IntradaySeries.MidPrices)))
		}

		if len(data.IntradaySeries.EMA20Values) > 0 {
			sb.WriteString(fmt.Sprintf("EMA indicators (20‑period): %s\n\n", formatFloatSlice(data.IntradaySeries.EMA20Values)))
		}

		if len(data.IntradaySeries.MACDValues) > 0 {
			sb.WriteString(fmt.Sprintf("MACD indicators: %s\n\n", formatFloatSlice(data.IntradaySeries.MACDValues)))
		}

		if len(data.IntradaySeries.RSI7Values) > 0 {
			sb.WriteString(fmt.Sprintf("RSI indicators (7‑Period): %s\n\n", formatFloatSlice(data.IntradaySeries.RSI7Values)))
		}

		if len(data.IntradaySeries.RSI14Values) > 0 {
			sb.WriteString(fmt.Sprintf("RSI indicators (14‑Period): %s\n\n", formatFloatSlice(data.IntradaySeries.RSI14Values)))
		}

		if len(data.IntradaySeries.Volume) > 0 {
			sb.WriteString(fmt.Sprintf("Volume: %s\n\n", formatFloatSlice(data.IntradaySeries.Volume)))
		}

		sb.WriteString(fmt.Sprintf("3m ATR (14‑period): %.3f\n\n", data.IntradaySeries.ATR14))
	}

	if data.LongerTermContext != nil {
		sb.WriteString("Longer‑term context (4‑hour timeframe):\n\n")

		sb.WriteString(fmt.Sprintf("20‑Period EMA: %.3f vs. 50‑Period EMA: %.3f\n\n",
			data.LongerTermContext.EMA20, data.LongerTermContext.EMA50))

		sb.WriteString(fmt.Sprintf("3‑Period ATR: %.3f vs. 14‑Period ATR: %.3f\n\n",
			data.LongerTermContext.ATR3, data.LongerTermContext.ATR14))

		sb.WriteString(fmt.Sprintf("Current Volume: %.3f vs. Average Volume: %.3f\n\n",
			data.LongerTermContext.CurrentVolume, data.LongerTermContext.AverageVolume))

		if len(data.LongerTermContext.MACDValues) > 0 {
			sb.WriteString(fmt.Sprintf("MACD indicators: %s\n\n", formatFloatSlice(data.LongerTermContext.MACDValues)))
		}

		if len(data.LongerTermContext.RSI14Values) > 0 {
			sb.WriteString(fmt.Sprintf("RSI indicators (14‑Period): %s\n\n", formatFloatSlice(data.LongerTermContext.RSI14Values)))
		}
	}

	// 脚本 1—10 指标摘要
	sb.WriteString("Additional indicators (scripts #1–#10):\n\n")
	aboveSignal := data.CurrentTSI > data.CurrentTSISignal
	zone := "neutral"
	if data.CurrentTSI >= 40 {
		zone = "overbought(>=+40)"
	} else if data.CurrentTSI <= -40 {
		zone = "oversold(<=-40)"
	}
	sb.WriteString(fmt.Sprintf("TSI: value=%.2f, signal=%.2f, above_signal=%v, zone=%s\n",
		data.CurrentTSI, data.CurrentTSISignal, aboveSignal, zone))
	sb.WriteString(fmt.Sprintf("KEMAD: trend=%d, kema=%.3f, atr=%.3f\n",
		data.KEMADTrend, data.KEMADEMA, data.KEMADATR))
	sb.WriteString(fmt.Sprintf("Volatility Gaussian Bands: trend=%d, avg=%.3f, upper=%.3f, lower=%.3f, score=%.3f\n",
		data.VGBTrend, data.VGBAvg, data.VGBUpper, data.VGBLower, data.VGBScore))
	sb.WriteString(fmt.Sprintf("SSL Hybrid Exit: signal=%d, baseline=%.3f, upperK=%.3f, lowerK=%.3f\n",
		data.SSLExitSignal, data.SSLBaseline, data.SSLUpperK, data.SSLLowerK))
	sb.WriteString(fmt.Sprintf("Zero‑Lag Trend: trend=%d, zlema=%.3f, volatility=%.3f\n",
		data.ZeroLagTrend, data.ZeroLagZLEMA, data.ZeroLagVolatility))
	sb.WriteString(fmt.Sprintf("QQE MOD Hybrid: trend=%d, fastTL=%.3f, upper=%.3f, lower=%.3f\n",
		data.QQETrend, data.QQEFastTL, data.QQEUpper, data.QQELower))
	sb.WriteString(fmt.Sprintf("Range Filtered: kalman=%.3f, trend=%d, kTrend=%d, combined=%d\n",
		data.RangeKalman, data.RangeTrend, data.RangeKTrend, data.RangeCombinedTrend))
	sb.WriteString(fmt.Sprintf("DPSD: trend=%d, pt=%.3f, dema=%.3f, perUp=%.3f, perDown=%.3f\n",
		data.DPSDTrend, data.DPSDPT, data.DPSDEMA, data.DPSDPerUp, data.DPSDPerDown))
	sb.WriteString(fmt.Sprintf("Ultimate RSI: value=%.2f, signal=%.2f, overbought=%v, oversold=%v\n",
		data.UltimateRSI, data.UltimateRSISignal, data.UltimateRSIOverbought, data.UltimateRSIOversold))
	sb.WriteString(fmt.Sprintf("RSI(10): buy=%v, sell=%v, rsi=%.2f\n\n",
		data.RSIBuySignal, data.RSISellSignal, data.RSIValue))

	return sb.String()
}

// formatPriceWithDynamicPrecision 根据价格区间动态选择精度
// 这样可以完美支持从超低价 meme coin (< 0.0001) 到 BTC/ETH 的所有币种
func formatPriceWithDynamicPrecision(price float64) string {
	switch {
	case price < 0.0001:
		// 超低价 meme coin: 1000SATS, 1000WHY, DOGS
		// 0.00002070 → "0.00002070" (8位小数)
		return fmt.Sprintf("%.8f", price)
	case price < 0.001:
		// 低价 meme coin: NEIRO, HMSTR, HOT, NOT
		// 0.00015060 → "0.000151" (6位小数)
		return fmt.Sprintf("%.6f", price)
	case price < 0.01:
		// 中低价币: PEPE, SHIB, MEME
		// 0.00556800 → "0.005568" (6位小数)
		return fmt.Sprintf("%.6f", price)
	case price < 1.0:
		// 低价币: ASTER, DOGE, ADA, TRX
		// 0.9954 → "0.9954" (4位小数)
		return fmt.Sprintf("%.4f", price)
	case price < 100:
		// 中价币: SOL, AVAX, LINK, MATIC
		// 23.4567 → "23.4567" (4位小数)
		return fmt.Sprintf("%.4f", price)
	default:
		// 高价币: BTC, ETH (节省 Token)
		// 45678.9123 → "45678.91" (2位小数)
		return fmt.Sprintf("%.2f", price)
	}
}

// formatFloatSlice 格式化float64切片为字符串（使用动态精度）
func formatFloatSlice(values []float64) string {
	strValues := make([]string, len(values))
	for i, v := range values {
		strValues[i] = formatPriceWithDynamicPrecision(v)
	}
	return "[" + strings.Join(strValues, ", ") + "]"
}

// Normalize 标准化symbol,确保是USDT交易对
func Normalize(symbol string) string {
	symbol = strings.ToUpper(symbol)
	if strings.HasSuffix(symbol, "USDT") {
		return symbol
	}
	return symbol + "USDT"
}

// parseFloat 解析float值
func parseFloat(v interface{}) (float64, error) {
	switch val := v.(type) {
	case string:
		return strconv.ParseFloat(val, 64)
	case float64:
		return val, nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	default:
		return 0, fmt.Errorf("unsupported type: %T", v)
	}
}
