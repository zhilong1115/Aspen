package market

import (
	"fmt"
	"github.com/rs/zerolog/log"
)

// DataSource 数据源类型
type DataSource string

const (
	DataSourceBinance     DataSource = "binance"     // Binance (默认，可能被美国IP封锁)
	DataSourceBybit       DataSource = "bybit"       // Bybit (推荐给美国用户)
	DataSourceBinanceUS   DataSource = "binance_us"  // Binance.US (仅现货，无期货数据)
	DataSourceFinnhub     DataSource = "finnhub"     // Finnhub (需要 API key，无期货数据)
	DataSourceHyperliquid DataSource = "hyperliquid" // Hyperliquid (DEX, US-friendly via VPN/DeFi)
)

// DataSourceConfig 数据源配置
type DataSourceConfig struct {
	Source          DataSource
	BaseURL         string
	KlinesEndpoint  string
	PriceEndpoint   string
	OIEndpoint      string
	FundingEndpoint string
	WSURL           string
	WSStreamURL     string
	APIKey          string // 某些数据源需要 API key (如 Finnhub)
}

var (
	currentDataSource DataSource = DataSourceBinance
	dataSourceConfigs            = map[DataSource]*DataSourceConfig{
		DataSourceBinance: {
			Source:          DataSourceBinance,
			BaseURL:         "https://fapi.binance.com",
			KlinesEndpoint:  "/fapi/v1/klines",
			PriceEndpoint:   "/fapi/v1/ticker/price",
			OIEndpoint:      "/fapi/v1/openInterest",
			FundingEndpoint: "/fapi/v1/premiumIndex",
			WSURL:           "wss://ws-fapi.binance.com/ws-fapi/v1",
			WSStreamURL:     "wss://fstream.binance.com/stream",
		},
		DataSourceBybit: {
			Source:          DataSourceBybit,
			BaseURL:         "https://api.bybit.com",
			KlinesEndpoint:  "/v5/market/kline",
			PriceEndpoint:   "/v5/market/tickers",
			OIEndpoint:      "/v5/market/open-interest",
			FundingEndpoint: "/v5/market/tickers",
			WSURL:           "wss://stream.bybit.com/v5/public/linear",
			WSStreamURL:     "wss://stream.bybit.com/v5/public/linear",
		},
		DataSourceBinanceUS: {
			Source:          DataSourceBinanceUS,
			BaseURL:         "https://api.binance.us",
			KlinesEndpoint:  "/api/v3/klines",
			PriceEndpoint:   "/api/v3/ticker/price",
			OIEndpoint:      "", // Binance.US 没有期货数据
			FundingEndpoint: "", // Binance.US 没有期货数据
			WSURL:           "wss://stream.binance.us:9443/ws",
			WSStreamURL:     "wss://stream.binance.us:9443/stream",
		},
		DataSourceFinnhub: {
			Source:          DataSourceFinnhub,
			BaseURL:         "https://finnhub.io",
			KlinesEndpoint:  "/api/v1/crypto/candle",
			PriceEndpoint:   "/api/v1/quote",
			OIEndpoint:      "", // Finnhub 没有期货数据
			FundingEndpoint: "", // Finnhub 没有期货数据
			WSURL:           "", // Finnhub WebSocket 需要单独实现
			WSStreamURL:     "",
		},
		DataSourceHyperliquid: {
			Source:          DataSourceHyperliquid,
			BaseURL:         "https://api.hyperliquid.xyz",
			KlinesEndpoint:  "/info", // Hyperliquid uses POST /info for most things
			PriceEndpoint:   "/info",
			OIEndpoint:      "/info",
			FundingEndpoint: "/info",
			WSURL:           "wss://api.hyperliquid.xyz/ws",
			WSStreamURL:     "wss://api.hyperliquid.xyz/ws",
		},
	}
)

// InitDataSource 初始化数据源（从配置字符串读取）
func InitDataSource(source string, apiKey string) {
	if source == "" {
		source = "binance" // 默认使用 Binance
	}

	switch DataSource(source) {
	case DataSourceFinnhub:
		currentDataSource = DataSourceFinnhub
		if apiKey != "" {
			// 设置 API key
			if cfg, ok := dataSourceConfigs[DataSourceFinnhub]; ok {
				cfg.APIKey = apiKey
			}
			log.Info().Msgf("📊 [Market] 使用数据源: Finnhub (需要 API key，无期货数据)")
		} else {
			log.Warn().Msgf("⚠️  [Market] Finnhub 数据源需要 API key，请在 config.json 中配置 finnhub_api_key")
		}
	case DataSourceBybit:
		currentDataSource = DataSourceBybit
		log.Info().Msgf("📊 [Market] 使用数据源: Bybit (推荐给美国用户)")
	case DataSourceBinanceUS:
		currentDataSource = DataSourceBinanceUS
		log.Warn().Msgf("⚠️  [Market] 使用数据源: Binance.US (注意：仅支持现货数据，无期货 Open Interest 和 Funding Rate)")
	case DataSourceHyperliquid:
		currentDataSource = DataSourceHyperliquid
		log.Info().Msgf("📊 [Market] 使用数据源: Hyperliquid (DEX)")
	case DataSourceBinance:
		fallthrough
	default:
		currentDataSource = DataSourceBinance
		log.Info().Msgf("📊 [Market] 使用数据源: Binance")
	}
}

// GetCurrentDataSource 获取当前数据源
func GetCurrentDataSource() DataSource {
	return currentDataSource
}

// GetDataSourceConfig 获取数据源配置
func GetDataSourceConfig() *DataSourceConfig {
	cfg, ok := dataSourceConfigs[currentDataSource]
	if !ok {
		log.Warn().Msgf("⚠️  [Market] 数据源配置不存在，使用 Binance 默认配置")
		return dataSourceConfigs[DataSourceBinance]
	}
	return cfg
}

// GetBaseURL 获取基础URL
func GetBaseURL() string {
	return GetDataSourceConfig().BaseURL
}

// GetKlinesURL 获取K线数据URL
func GetKlinesURL() string {
	cfg := GetDataSourceConfig()
	return fmt.Sprintf("%s%s", cfg.BaseURL, cfg.KlinesEndpoint)
}

// GetPriceURL 获取价格URL
func GetPriceURL() string {
	cfg := GetDataSourceConfig()
	return fmt.Sprintf("%s%s", cfg.BaseURL, cfg.PriceEndpoint)
}

// GetOIURL 获取Open Interest URL
func GetOIURL(symbol string) (string, error) {
	cfg := GetDataSourceConfig()
	if cfg.OIEndpoint == "" {
		return "", fmt.Errorf("当前数据源 %s 不支持 Open Interest 数据", cfg.Source)
	}

	switch currentDataSource {
	case DataSourceBinance:
		return fmt.Sprintf("%s%s?symbol=%s", cfg.BaseURL, cfg.OIEndpoint, symbol), nil
	case DataSourceBybit:
		// Bybit 需要 category 参数
		return fmt.Sprintf("%s%s?category=linear&symbol=%s", cfg.BaseURL, cfg.OIEndpoint, symbol), nil
	case DataSourceHyperliquid:
		// Hyperliquid uses POST /info, so URL is just base + endpoint.
		// The caller needs to know to send a POST body.
		// For now, we return the URL, and the caller (monitor.go) needs to handle the POST logic.
		// This might require refactoring monitor.go, but for now let's return the URL.
		return fmt.Sprintf("%s%s", cfg.BaseURL, cfg.OIEndpoint), nil
	default:
		return "", fmt.Errorf("不支持的数据源: %s", cfg.Source)
	}
}

// GetFundingURL 获取Funding Rate URL
func GetFundingURL(symbol string) (string, error) {
	cfg := GetDataSourceConfig()
	if cfg.FundingEndpoint == "" {
		return "", fmt.Errorf("当前数据源 %s 不支持 Funding Rate 数据", cfg.Source)
	}

	switch currentDataSource {
	case DataSourceBinance:
		return fmt.Sprintf("%s%s?symbol=%s", cfg.BaseURL, cfg.FundingEndpoint, symbol), nil
	case DataSourceBybit:
		// Bybit 的 Funding Rate 在 tickers 接口中
		return fmt.Sprintf("%s%s?category=linear&symbol=%s", cfg.BaseURL, cfg.FundingEndpoint, symbol), nil
	case DataSourceHyperliquid:
		return fmt.Sprintf("%s%s", cfg.BaseURL, cfg.FundingEndpoint), nil
	default:
		return "", fmt.Errorf("不支持的数据源: %s", cfg.Source)
	}
}
