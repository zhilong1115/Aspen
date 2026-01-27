package market

import (
	"aspen/hook"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

type APIClient struct {
	client *http.Client
}

func NewAPIClient() *APIClient {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// 检查环境变量中的代理配置
	proxyURL := getProxyFromEnv()
	if proxyURL != nil {
		transport := &http.Transport{
			Proxy: http.ProxyURL(proxyURL),
		}
		client.Transport = transport
		log.Printf("🌐 [Market] 使用代理服务器: %s", proxyURL.Host)
	}

	// 尝试通过 Hook 设置 HTTP 客户端（优先级更高）
	hookRes := hook.HookExec[hook.SetHttpClientResult](hook.SET_HTTP_CLIENT, client)
	if hookRes != nil && hookRes.Error() == nil {
		log.Printf("使用Hook设置的HTTP客户端")
		client = hookRes.GetResult()
	}

	return &APIClient{
		client: client,
	}
}

// getProxyFromEnv 从环境变量获取代理配置
// 支持 HTTP_PROXY, HTTPS_PROXY, http_proxy, https_proxy
func getProxyFromEnv() *url.URL {
	// 优先检查 HTTPS_PROXY（因为 Binance API 使用 HTTPS）
	proxyStr := os.Getenv("HTTPS_PROXY")
	if proxyStr == "" {
		proxyStr = os.Getenv("https_proxy")
	}
	if proxyStr == "" {
		proxyStr = os.Getenv("HTTP_PROXY")
	}
	if proxyStr == "" {
		proxyStr = os.Getenv("http_proxy")
	}

	if proxyStr == "" {
		return nil
	}

	proxyURL, err := url.Parse(proxyStr)
	if err != nil {
		log.Printf("⚠️  [Market] 代理URL格式错误: %v", err)
		return nil
	}

	return proxyURL
}

func (c *APIClient) GetExchangeInfo() (*ExchangeInfo, error) {
	// 根据数据源选择不同的 endpoint
	cfg := GetDataSourceConfig()
	var endpoint string
	switch currentDataSource {
	case DataSourceFinnhub:
		// Finnhub 不支持 exchangeInfo，返回空结构
		return &ExchangeInfo{Symbols: []SymbolInfo{}}, nil
	case DataSourceBybit:
		endpoint = fmt.Sprintf("%s/v5/market/instruments-info?category=linear", cfg.BaseURL)
	case DataSourceBinanceUS:
		endpoint = fmt.Sprintf("%s/api/v3/exchangeInfo", cfg.BaseURL)
	case DataSourceHyperliquid:
		endpoint = fmt.Sprintf("%s/info", cfg.BaseURL)
	default: // Binance
		endpoint = fmt.Sprintf("%s/fapi/v1/exchangeInfo", cfg.BaseURL)
	}

	var resp *http.Response
	var err error

	if currentDataSource == DataSourceHyperliquid {
		// Hyperliquid uses POST
		reqBody := HyperliquidRequest{Type: "meta"}
		jsonBody, _ := json.Marshal(reqBody)
		resp, err = c.client.Post(endpoint, "application/json", bytes.NewBuffer(jsonBody))
	} else {
		resp, err = c.client.Get(endpoint)
	}

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if currentDataSource == DataSourceHyperliquid {
		var meta HyperliquidMeta
		if err := json.Unmarshal(body, &meta); err != nil {
			return nil, err
		}
		// Convert to ExchangeInfo
		var exchangeInfo ExchangeInfo
		for _, asset := range meta.Universe {
			if asset.IsDelisted {
				continue
			}
			// Hyperliquid symbols are just "BTC", "ETH". We might want to append "USDT" or keep as is?
			// The system seems to expect "BTCUSDT".
			// Hyperliquid is USDC based usually, but let's check.
			// For compatibility, let's append "USDT" or "USD" if the system expects it.
			// Existing code in monitor.go checks for "USDT" suffix (line 60).
			// So we should probably append "USDT" or "USDC".
			// Let's use "USDT" for now to match existing filters, or update filters.
			// Hyperliquid is USDC margined.
			symbolName := asset.Name + "USDT" // Mapping to USDT for compatibility

			exchangeInfo.Symbols = append(exchangeInfo.Symbols, SymbolInfo{
				Symbol:       symbolName,
				Status:       "TRADING",
				ContractType: "PERPETUAL",
				BaseAsset:    asset.Name,
				QuoteAsset:   "USDT",
			})
		}
		return &exchangeInfo, nil
	}

	var exchangeInfo ExchangeInfo
	err = json.Unmarshal(body, &exchangeInfo)
	if err != nil {
		return nil, err
	}

	return &exchangeInfo, nil
}

func (c *APIClient) GetKlines(symbol, interval string, limit int) ([]Kline, error) {
	cfg := GetDataSourceConfig()
	var url string
	var req *http.Request
	var err error

	switch currentDataSource {
	case DataSourceFinnhub:
		// Finnhub API 格式: /api/v1/crypto/candle?symbol=BINANCE:BTCUSDT&resolution=3&from=timestamp&to=timestamp&token=API_KEY
		if cfg.APIKey == "" {
			return nil, fmt.Errorf("Finnhub API key 未配置，请在 config.json 中设置 finnhub_api_key")
		}
		url = fmt.Sprintf("%s%s", cfg.BaseURL, cfg.KlinesEndpoint)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("创建请求失败: %w", err)
		}
		q := req.URL.Query()
		// Finnhub 需要 BINANCE:SYMBOL 格式
		q.Add("symbol", fmt.Sprintf("BINANCE:%s", symbol))
		// Finnhub resolution: 1, 5, 15, 30, 60, D, W, M
		finnhubResolution := convertIntervalToFinnhub(interval)
		q.Add("resolution", finnhubResolution)
		// 计算时间范围（获取最近 limit 个K线）
		now := time.Now()
		to := now.Unix()
		// 根据间隔计算 from 时间
		from := calculateFromTime(interval, limit, to)
		q.Add("from", strconv.FormatInt(from, 10))
		q.Add("to", strconv.FormatInt(to, 10))
		q.Add("token", cfg.APIKey)
		req.URL.RawQuery = q.Encode()
	case DataSourceBybit:
		// Bybit API 格式: /v5/market/kline?category=linear&symbol=BTCUSDT&interval=3&limit=100
		url = fmt.Sprintf("%s%s", cfg.BaseURL, cfg.KlinesEndpoint)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("创建请求失败: %w", err)
		}
		q := req.URL.Query()
		q.Add("category", "linear")
		q.Add("symbol", symbol)
		// Bybit 使用数字表示间隔: 1=1m, 3=3m, 5=5m, 15=15m, 30=30m, 60=1h, 120=2h, 240=4h, etc.
		bybitInterval := convertIntervalToBybit(interval)
		q.Add("interval", bybitInterval)
		q.Add("limit", strconv.Itoa(limit))
		req.URL.RawQuery = q.Encode()
	case DataSourceBinanceUS:
		// Binance.US 使用现货 API
		url = fmt.Sprintf("%s%s", cfg.BaseURL, cfg.KlinesEndpoint)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("创建请求失败: %w", err)
		}
		q := req.URL.Query()
		q.Add("symbol", symbol)
		q.Add("interval", interval)
		q.Add("limit", strconv.Itoa(limit))
		req.URL.RawQuery = q.Encode()
	case DataSourceHyperliquid:
		url = fmt.Sprintf("%s%s", cfg.BaseURL, cfg.KlinesEndpoint)
		// Hyperliquid symbol conversion: BTCUSDT -> BTC
		hlSymbol := symbol
		if len(symbol) > 4 && symbol[len(symbol)-4:] == "USDT" {
			hlSymbol = symbol[:len(symbol)-4]
		}

		startTime := CalculateHyperliquidStartTime(interval, limit)
		endTime := time.Now().UnixMilli()

		reqBody := HyperliquidRequest{
			Type: "candleSnapshot",
			Req: CandleSnapshotReq{
				Coin:      hlSymbol,
				Interval:  ConvertIntervalToHyperliquid(interval),
				StartTime: startTime,
				EndTime:   endTime,
			},
		}
		jsonBody, _ := json.Marshal(reqBody)
		req, err = http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		if err != nil {
			return nil, fmt.Errorf("创建请求失败: %w", err)
		}
	default: // Binance
		url = fmt.Sprintf("%s%s", cfg.BaseURL, cfg.KlinesEndpoint)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("创建请求失败: %w", err)
		}
		q := req.URL.Query()
		q.Add("symbol", symbol)
		q.Add("interval", interval)
		q.Add("limit", strconv.Itoa(limit))
		req.URL.RawQuery = q.Encode()
	}

	resp, err := c.client.Do(req)
	if err != nil {
		sourceName := string(currentDataSource)
		return nil, fmt.Errorf("HTTP请求失败 (可能是网络问题或%s API不可访问): %w", sourceName, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		sourceName := string(currentDataSource)
		return nil, fmt.Errorf("%s API返回错误状态码 %d: %s", sourceName, resp.StatusCode, string(body))
	}

	// 根据数据源解析不同的响应格式
	var klines []Kline
	if currentDataSource == DataSourceFinnhub {
		klines, err = parseFinnhubKlinesResponse(body, symbol, interval)
		if err != nil {
			log.Printf("❌ [Market] 解析Finnhub K线数据失败, symbol=%s, interval=%s, 响应内容: %s", symbol, interval, string(body))
			return nil, fmt.Errorf("解析Finnhub JSON响应失败: %w", err)
		}
	} else if currentDataSource == DataSourceBybit {
		klines, err = parseBybitKlinesResponse(body, symbol, interval)
		if err != nil {
			log.Printf("❌ [Market] 解析Bybit K线数据失败, symbol=%s, interval=%s, 响应内容: %s", symbol, interval, string(body))
			return nil, fmt.Errorf("解析Bybit JSON响应失败: %w", err)
		}
	} else if currentDataSource == DataSourceHyperliquid {
		var hlKlines []HyperliquidCandle
		err = json.Unmarshal(body, &hlKlines)
		if err != nil {
			log.Printf("❌ [Market] 解析Hyperliquid K线数据失败, symbol=%s, interval=%s, 响应内容: %s", symbol, interval, string(body))
			return nil, fmt.Errorf("解析Hyperliquid JSON响应失败: %w", err)
		}
		for _, hlk := range hlKlines {
			open, _ := strconv.ParseFloat(hlk.O, 64)
			high, _ := strconv.ParseFloat(hlk.H, 64)
			low, _ := strconv.ParseFloat(hlk.L, 64)
			close, _ := strconv.ParseFloat(hlk.C, 64)
			volume, _ := strconv.ParseFloat(hlk.V, 64)

			// Hyperliquid volume is in base currency (BTC), quote volume needs calculation or approx
			// QuoteVolume approx = volume * close (or avg of OHLC)
			quoteVolume := volume * close

			kline := Kline{
				OpenTime:            hlk.T / 1000, // ms to s
				Open:                open,
				High:                high,
				Low:                 low,
				Close:               close,
				Volume:              volume,
				CloseTime:           (hlk.T / 1000) + 60, // Approx, or calculate based on interval
				QuoteVolume:         quoteVolume,
				Trades:              int(hlk.N),
				TakerBuyBaseVolume:  0,
				TakerBuyQuoteVolume: 0,
			}
			klines = append(klines, kline)
		}
	} else {
		// Binance 和 Binance.US 使用相同的格式
		var klineResponses []KlineResponse
		err = json.Unmarshal(body, &klineResponses)
		if err != nil {
			log.Printf("❌ [Market] 解析K线数据失败, symbol=%s, interval=%s, 响应内容: %s", symbol, interval, string(body))
			return nil, fmt.Errorf("解析JSON响应失败: %w", err)
		}

		for _, kr := range klineResponses {
			kline, err := parseKline(kr)
			if err != nil {
				log.Printf("解析K线数据失败: %v", err)
				continue
			}
			klines = append(klines, kline)
		}
	}

	return klines, nil
}

// convertIntervalToFinnhub 将 Binance 间隔格式转换为 Finnhub 格式
func convertIntervalToFinnhub(interval string) string {
	// Finnhub resolution: 1, 5, 15, 30, 60, D, W, M
	intervalMap := map[string]string{
		"1m": "1", "3m": "5", "5m": "5", "15m": "15", "30m": "30",
		"1h": "60", "2h": "60", "4h": "60", "6h": "60", "12h": "60",
		"1d": "D", "1w": "W", "1M": "M",
	}
	if finnhubResolution, ok := intervalMap[interval]; ok {
		return finnhubResolution
	}
	return "5" // 默认5分钟
}

// calculateFromTime 根据间隔和数量计算起始时间
func calculateFromTime(interval string, limit int, to int64) int64 {
	var intervalSeconds int64
	switch interval {
	case "1m":
		intervalSeconds = 60
	case "3m":
		intervalSeconds = 180
	case "5m":
		intervalSeconds = 300
	case "15m":
		intervalSeconds = 900
	case "30m":
		intervalSeconds = 1800
	case "1h":
		intervalSeconds = 3600
	case "2h":
		intervalSeconds = 7200
	case "4h":
		intervalSeconds = 14400
	case "6h":
		intervalSeconds = 21600
	case "12h":
		intervalSeconds = 43200
	case "1d":
		intervalSeconds = 86400
	default:
		intervalSeconds = 300 // 默认5分钟
	}
	return to - (int64(limit) * intervalSeconds)
}

// parseFinnhubKlinesResponse 解析 Finnhub K线响应
func parseFinnhubKlinesResponse(body []byte, symbol, interval string) ([]Kline, error) {
	// 先检查是否是错误响应
	var errorResponse struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &errorResponse); err == nil && errorResponse.Error != "" {
		return nil, fmt.Errorf("Finnhub API错误: %s", errorResponse.Error)
	}

	var response struct {
		S string    `json:"s"` // Status: ok, no_data, error
		O []float64 `json:"o"` // Open prices
		H []float64 `json:"h"` // High prices
		L []float64 `json:"l"` // Low prices
		C []float64 `json:"c"` // Close prices
		V []float64 `json:"v"` // Volume
		T []int64   `json:"t"` // Timestamps
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("解析Finnhub响应失败: %w, 响应内容: %s", err, string(body))
	}

	if response.S != "ok" && response.S != "" {
		return nil, fmt.Errorf("Finnhub API错误: %s", response.S)
	}

	if len(response.T) == 0 {
		return nil, fmt.Errorf("Finnhub返回的K线数据为空")
	}

	var klines []Kline
	for i := 0; i < len(response.T); i++ {
		intervalMs := getIntervalMs(interval)
		kline := Kline{
			OpenTime:            response.T[i],
			Open:                response.O[i],
			High:                response.H[i],
			Low:                 response.L[i],
			Close:               response.C[i],
			Volume:              response.V[i],
			CloseTime:           response.T[i] + intervalMs/1000,
			QuoteVolume:         response.C[i] * response.V[i], // 近似值
			Trades:              0,
			TakerBuyBaseVolume:  0,
			TakerBuyQuoteVolume: 0,
		}
		klines = append(klines, kline)
	}

	return klines, nil
}

// convertIntervalToBybit 将 Binance 间隔格式转换为 Bybit 格式
func convertIntervalToBybit(interval string) string {
	// Bybit 使用数字: 1, 3, 5, 15, 30, 60, 120, 240, 360, 720, D, W, M
	intervalMap := map[string]string{
		"1m": "1", "3m": "3", "5m": "5", "15m": "15", "30m": "30",
		"1h": "60", "2h": "120", "4h": "240", "6h": "360", "12h": "720",
		"1d": "D", "1w": "W", "1M": "M",
	}
	if bybitInterval, ok := intervalMap[interval]; ok {
		return bybitInterval
	}
	// 默认返回原值（可能已经是数字格式）
	return interval
}

// parseBybitKlinesResponse 解析 Bybit K线响应
func parseBybitKlinesResponse(body []byte, symbol, interval string) ([]Kline, error) {
	var response struct {
		RetCode int    `json:"retCode"`
		RetMsg  string `json:"retMsg"`
		Result  struct {
			Category string `json:"category"`
			List     []struct {
				StartTime string `json:"startTime"`
				Open      string `json:"open"`
				High      string `json:"high"`
				Low       string `json:"low"`
				Close     string `json:"close"`
				Volume    string `json:"volume"`
				Turnover  string `json:"turnover"`
			} `json:"list"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	if response.RetCode != 0 {
		return nil, fmt.Errorf("Bybit API错误: %s (code: %d)", response.RetMsg, response.RetCode)
	}

	var klines []Kline
	for _, item := range response.Result.List {
		openTime, _ := strconv.ParseInt(item.StartTime, 10, 64)
		open, _ := strconv.ParseFloat(item.Open, 64)
		high, _ := strconv.ParseFloat(item.High, 64)
		low, _ := strconv.ParseFloat(item.Low, 64)
		close, _ := strconv.ParseFloat(item.Close, 64)
		volume, _ := strconv.ParseFloat(item.Volume, 64)
		turnover, _ := strconv.ParseFloat(item.Turnover, 64)

		// 计算 CloseTime (假设间隔为 3m = 180000ms)
		closeTime := openTime + 180000 // 默认3分钟，实际应该根据interval计算

		kline := Kline{
			OpenTime:            openTime / 1000, // Bybit 返回毫秒，转换为秒
			Open:                open,
			High:                high,
			Low:                 low,
			Close:               close,
			Volume:              volume,
			CloseTime:           closeTime / 1000,
			QuoteVolume:         turnover,
			Trades:              0, // Bybit 不提供交易次数
			TakerBuyBaseVolume:  0,
			TakerBuyQuoteVolume: 0,
		}
		klines = append(klines, kline)
	}

	return klines, nil
}

func parseKline(kr KlineResponse) (Kline, error) {
	var kline Kline

	if len(kr) < 11 {
		return kline, fmt.Errorf("invalid kline data")
	}

	// 解析各个字段
	kline.OpenTime = int64(kr[0].(float64))
	kline.Open, _ = strconv.ParseFloat(kr[1].(string), 64)
	kline.High, _ = strconv.ParseFloat(kr[2].(string), 64)
	kline.Low, _ = strconv.ParseFloat(kr[3].(string), 64)
	kline.Close, _ = strconv.ParseFloat(kr[4].(string), 64)
	kline.Volume, _ = strconv.ParseFloat(kr[5].(string), 64)
	kline.CloseTime = int64(kr[6].(float64))
	kline.QuoteVolume, _ = strconv.ParseFloat(kr[7].(string), 64)
	kline.Trades = int(kr[8].(float64))
	kline.TakerBuyBaseVolume, _ = strconv.ParseFloat(kr[9].(string), 64)
	kline.TakerBuyQuoteVolume, _ = strconv.ParseFloat(kr[10].(string), 64)

	return kline, nil
}

func (c *APIClient) GetCurrentPrice(symbol string) (float64, error) {
	cfg := GetDataSourceConfig()
	var url string
	var req *http.Request
	var err error

	switch currentDataSource {
	case DataSourceFinnhub:
		// Finnhub: /api/v1/quote?symbol=BINANCE:BTCUSDT&token=API_KEY
		if cfg.APIKey == "" {
			return 0, fmt.Errorf("Finnhub API key 未配置")
		}
		url = fmt.Sprintf("%s%s?symbol=BINANCE:%s&token=%s", cfg.BaseURL, cfg.PriceEndpoint, symbol, cfg.APIKey)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return 0, err
		}
	case DataSourceBybit:
		// Bybit: /v5/market/tickers?category=linear&symbol=BTCUSDT
		url = fmt.Sprintf("%s%s?category=linear&symbol=%s", cfg.BaseURL, cfg.PriceEndpoint, symbol)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return 0, err
		}
	case DataSourceBinanceUS:
		// Binance.US: /api/v3/ticker/price?symbol=BTCUSDT
		url = fmt.Sprintf("%s%s?symbol=%s", cfg.BaseURL, cfg.PriceEndpoint, symbol)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return 0, err
		}
	case DataSourceHyperliquid:
		url = fmt.Sprintf("%s%s", cfg.BaseURL, cfg.PriceEndpoint)
		reqBody := HyperliquidRequest{Type: "allMids"}
		jsonBody, _ := json.Marshal(reqBody)
		req, err = http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		if err != nil {
			return 0, err
		}
	default: // Binance
		url = fmt.Sprintf("%s%s?symbol=%s", cfg.BaseURL, cfg.PriceEndpoint, symbol)
		req, err = http.NewRequest("GET", url, nil)
		if err != nil {
			return 0, err
		}
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	var price float64
	if currentDataSource == DataSourceFinnhub {
		var response struct {
			C  float64 `json:"c"`  // Current price
			H  float64 `json:"h"`  // High
			L  float64 `json:"l"`  // Low
			O  float64 `json:"o"`  // Open
			PC float64 `json:"pc"` // Previous close
			T  int64   `json:"t"`  // Timestamp
		}
		err = json.Unmarshal(body, &response)
		if err != nil {
			return 0, err
		}
		if response.C == 0 {
			return 0, fmt.Errorf("Finnhub API返回的价格为0")
		}
		price = response.C
	} else if currentDataSource == DataSourceBybit {
		var response struct {
			RetCode int    `json:"retCode"`
			RetMsg  string `json:"retMsg"`
			Result  struct {
				List []struct {
					LastPrice string `json:"lastPrice"`
				} `json:"list"`
			} `json:"result"`
		}
		err = json.Unmarshal(body, &response)
		if err != nil {
			return 0, err
		}
		if response.RetCode != 0 || len(response.Result.List) == 0 {
			return 0, fmt.Errorf("Bybit API错误: %s", response.RetMsg)
		}
		price, err = strconv.ParseFloat(response.Result.List[0].LastPrice, 64)
		if err != nil {
			return 0, err
		}
	} else if currentDataSource == DataSourceHyperliquid {
		var allMids HyperliquidAllMids
		err = json.Unmarshal(body, &allMids)
		if err != nil {
			return 0, err
		}

		// Hyperliquid symbol conversion: BTCUSDT -> BTC
		hlSymbol := symbol
		if len(symbol) > 4 && symbol[len(symbol)-4:] == "USDT" {
			hlSymbol = symbol[:len(symbol)-4]
		}

		priceStr, ok := allMids[hlSymbol]
		if !ok {
			return 0, fmt.Errorf("Hyperliquid price not found for %s", hlSymbol)
		}
		price, err = strconv.ParseFloat(priceStr, 64)
		if err != nil {
			return 0, err
		}
	} else {
		// Binance 和 Binance.US 使用相同的格式
		var ticker PriceTicker
		err = json.Unmarshal(body, &ticker)
		if err != nil {
			return 0, err
		}
		price, err = strconv.ParseFloat(ticker.Price, 64)
		if err != nil {
			return 0, err
		}
	}

	return price, nil
}
