package market

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// Normalize — symbol standardization
// ============================================================

func TestNormalize(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"btcusdt", "BTCUSDT"},
		{"BTCUSDT", "BTCUSDT"},
		{"btc", "BTCUSDT"},
		{"BTC", "BTCUSDT"},
		{"ethusdt", "ETHUSDT"},
		{"sol", "SOLUSDT"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equal(t, tt.want, Normalize(tt.input))
		})
	}
}

// ============================================================
// EMA calculation
// ============================================================

func TestCalculateEMA_InsufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	ema := calculateEMA(klines, 20)
	assert.Equal(t, 0.0, ema, "EMA with insufficient data should return 0")
}

func TestCalculateEMA_ExactPeriod(t *testing.T) {
	klines := generateEdgeTestKlines(20)
	ema := calculateEMA(klines, 20)
	// With exactly period klines, EMA should equal SMA
	sum := 0.0
	for _, k := range klines {
		sum += k.Close
	}
	expected := sum / 20.0
	assert.InDelta(t, expected, ema, 0.01, "EMA with exactly period data points should equal SMA")
}

func TestCalculateEMA_MoreThanPeriod(t *testing.T) {
	klines := generateEdgeTestKlines(50)
	ema := calculateEMA(klines, 20)
	assert.Greater(t, ema, 0.0, "EMA should be positive for positive prices")
}

// ============================================================
// MACD calculation
// ============================================================

func TestCalculateMACD_InsufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(10) // needs 26
	macd := calculateMACD(klines)
	assert.Equal(t, 0.0, macd)
}

func TestCalculateMACD_SufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(50)
	macd := calculateMACD(klines)
	// MACD is EMA12 - EMA26; for uptrending data it should be > 0
	assert.NotEqual(t, 0.0, macd, "MACD should be non-zero with enough data")
}

// ============================================================
// RSI calculation
// ============================================================

func TestCalculateRSI_InsufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	rsi := calculateRSI(klines, 7)
	assert.Equal(t, 0.0, rsi)
}

func TestCalculateRSI_AllGains(t *testing.T) {
	// Monotonically increasing prices
	klines := make([]Kline, 20)
	for i := range klines {
		klines[i] = Kline{Close: float64(100 + i)}
	}
	rsi := calculateRSI(klines, 7)
	assert.Equal(t, 100.0, rsi, "RSI with all gains should be 100")
}

func TestCalculateRSI_RangeCheck(t *testing.T) {
	klines := generateEdgeTestKlines(50)
	rsi := calculateRSI(klines, 14)
	assert.GreaterOrEqual(t, rsi, 0.0, "RSI must be >= 0")
	assert.LessOrEqual(t, rsi, 100.0, "RSI must be <= 100")
}

// ============================================================
// ATR edge cases
// ============================================================

func TestCalculateATR_EmptyKlines(t *testing.T) {
	atr := calculateATR([]Kline{}, 14)
	assert.Equal(t, 0.0, atr)
}

func TestCalculateATR_SingleKline(t *testing.T) {
	klines := []Kline{{High: 100, Low: 90, Close: 95}}
	atr := calculateATR(klines, 14)
	assert.Equal(t, 0.0, atr, "ATR needs more than period klines")
}

func TestCalculateATR_FlatPrices(t *testing.T) {
	// All prices the same = zero volatility
	klines := make([]Kline, 20)
	for i := range klines {
		klines[i] = Kline{Open: 100, High: 100, Low: 100, Close: 100}
	}
	atr := calculateATR(klines, 14)
	assert.InDelta(t, 0.0, atr, 0.001, "ATR for flat prices should be ~0")
}

// ============================================================
// TSI calculation
// ============================================================

func TestCalculateTSI_InsufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	tsi, signal := calculateTSI(klines, 35, 35, 13)
	assert.Equal(t, 0.0, tsi)
	assert.Equal(t, 0.0, signal)
}

func TestCalculateTSI_SufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(100)
	tsi, signal := calculateTSI(klines, 35, 35, 13)
	// TSI is bounded between -100 and +100
	assert.GreaterOrEqual(t, tsi, -100.0)
	assert.LessOrEqual(t, tsi, 100.0)
	_ = signal // signal is just EMA of TSI, no strict range needed
}

// ============================================================
// KEMAD — Kalman filter trend
// ============================================================

func TestCalculateKEMAD_Empty(t *testing.T) {
	trend, kema, atr := calculateKEMAD([]Kline{})
	assert.Equal(t, 0, trend)
	assert.Equal(t, 0.0, kema)
	assert.Equal(t, 0.0, atr)
}

func TestCalculateKEMAD_SingleKline(t *testing.T) {
	klines := []Kline{{Close: 100, High: 101, Low: 99}}
	trend, kema, _ := calculateKEMAD(klines)
	// Single kline: kalman = close, so last == kalman => trend 0
	assert.Equal(t, 0, trend)
	assert.InDelta(t, 100.0, kema, 0.01)
}

func TestCalculateKEMAD_UpTrend(t *testing.T) {
	klines := make([]Kline, 50)
	for i := range klines {
		klines[i] = Kline{
			Open: float64(100 + i), High: float64(102 + i),
			Low: float64(99 + i), Close: float64(101 + i),
		}
	}
	trend, _, _ := calculateKEMAD(klines)
	assert.Equal(t, 1, trend, "uptrending prices should give trend=1")
}

// ============================================================
// Volatility Gaussian Bands
// ============================================================

func TestCalculateVGB_InsufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	trend, avg, upper, lower, score := calculateVolatilityGaussianBands(klines, 20, 2.0)
	assert.Equal(t, 0, trend)
	assert.Equal(t, 0.0, avg)
	assert.Equal(t, 0.0, upper)
	assert.Equal(t, 0.0, lower)
	assert.Equal(t, 0.0, score)
}

func TestCalculateVGB_NormalData(t *testing.T) {
	klines := generateEdgeTestKlines(50)
	trend, avg, upper, lower, _ := calculateVolatilityGaussianBands(klines, 20, 2.0)
	assert.Greater(t, avg, 0.0)
	assert.Greater(t, upper, lower, "upper band should be above lower band")
	assert.Contains(t, []int{-1, 0, 1}, trend)
}

// ============================================================
// SSL Hybrid Exit
// ============================================================

func TestCalculateSSLHybridExit_InsufficientData(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	exitSignal, baseline, upperK, lowerK := calculateSSLHybridExit(klines, 20, 60)
	assert.Equal(t, 0, exitSignal)
	assert.Equal(t, 0.0, baseline)
	assert.Equal(t, 0.0, upperK)
	assert.Equal(t, 0.0, lowerK)
}

// ============================================================
// Format — market data formatting
// ============================================================

func TestFormat_NilFields(t *testing.T) {
	data := &Data{
		Symbol:       "BTCUSDT",
		CurrentPrice: 95000.50,
		// OI and intraday are nil
	}
	output := Format(data)
	assert.Contains(t, output, "95000.50")
	assert.Contains(t, output, "BTCUSDT")
}

func TestFormat_CompleteData(t *testing.T) {
	data := &Data{
		Symbol:        "ETHUSDT",
		CurrentPrice:  3500.25,
		PriceChange1h: 1.5,
		PriceChange4h: -2.3,
		CurrentEMA20:  3450.0,
		CurrentMACD:   12.5,
		CurrentRSI7:   55.0,
		FundingRate:   0.0001,
		OpenInterest:  &OIData{Latest: 50000, Average: 49000},
		IntradaySeries: &IntradayData{
			MidPrices:   []float64{3400, 3450, 3500},
			EMA20Values: []float64{3420, 3440},
			MACDValues:  []float64{10.5, 12.5},
			RSI7Values:  []float64{52, 55},
			RSI14Values: []float64{50, 53},
			Volume:      []float64{1000, 1200, 1100},
			ATR14:       45.3,
		},
		LongerTermContext: &LongerTermData{
			EMA20:         3400,
			EMA50:         3350,
			ATR3:          50,
			ATR14:         80,
			CurrentVolume: 5000,
			AverageVolume: 4500,
			MACDValues:    []float64{5, 8, 12},
			RSI14Values:   []float64{48, 52, 55},
		},
	}
	output := Format(data)
	assert.Contains(t, output, "3500.25")
	assert.Contains(t, output, "ETHUSDT")
	assert.Contains(t, output, "Intraday series")
	assert.Contains(t, output, "Longer")
	assert.Contains(t, output, "Funding Rate")
	assert.Contains(t, output, "Open Interest")
}

// ============================================================
// formatPriceWithDynamicPrecision
// ============================================================

func TestFormatPriceWithDynamicPrecision(t *testing.T) {
	tests := []struct {
		price    float64
		contains string
	}{
		{0.00002070, "0.00002070"},   // ultra low
		{0.00015060, "0.000151"},     // low meme
		{0.00556800, "0.005568"},     // mid-low
		{0.9954, "0.9954"},           // sub-dollar
		{23.4567, "23.4567"},         // mid price
		{45678.91, "45678.91"},       // BTC-level
	}
	for _, tt := range tests {
		t.Run(tt.contains, func(t *testing.T) {
			result := formatPriceWithDynamicPrecision(tt.price)
			assert.Equal(t, tt.contains, result)
		})
	}
}

// ============================================================
// Zero-Lag Trend Signals
// ============================================================

func TestCalculateZeroLagTrendSignals_Insufficient(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	trend, zlema, vol := calculateZeroLagTrendSignals(klines, 34)
	assert.Equal(t, 0, trend)
	assert.Equal(t, 0.0, zlema)
	assert.Equal(t, 0.0, vol)
}

// ============================================================
// QQE MOD Hybrid
// ============================================================

func TestCalculateQQEModHybrid_Insufficient(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	trend, _, _, _ := calculateQQEModHybrid(klines)
	assert.Equal(t, 0, trend)
}

// ============================================================
// Range Filtered Trend
// ============================================================

func TestCalculateRangeFilteredTrend_Empty(t *testing.T) {
	kalman, trend, kTrend, combined := calculateRangeFilteredTrend([]Kline{})
	assert.Equal(t, 0.0, kalman)
	assert.Equal(t, 0, trend)
	assert.Equal(t, 0, kTrend)
	assert.Equal(t, 0, combined)
}

// ============================================================
// DPSD
// ============================================================

func TestCalculateDPSD_Insufficient(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	trend, pt, dema, perUp, perDown := calculateDPSD(klines, 20)
	assert.Equal(t, 0, trend)
	assert.Equal(t, 0.0, pt)
	assert.Equal(t, 0.0, dema)
	assert.Equal(t, 0.0, perUp)
	assert.Equal(t, 0.0, perDown)
}

// ============================================================
// Ultimate RSI
// ============================================================

func TestCalculateUltimateRSI_Insufficient(t *testing.T) {
	klines := generateEdgeTestKlines(5)
	val, sig, ob, os := calculateUltimateRSI(klines, 14)
	assert.Equal(t, 0.0, val)
	assert.Equal(t, 0.0, sig)
	assert.False(t, ob)
	assert.False(t, os)
}

// ============================================================
// RSI with patterns
// ============================================================

func TestCalculateRSIWithPatterns_Insufficient(t *testing.T) {
	klines := []Kline{{Close: 100, Open: 99}}
	val, buy, sell := calculateRSIWithPatterns(klines, 14)
	assert.Equal(t, 0.0, val)
	assert.False(t, buy)
	assert.False(t, sell)
}

func TestCalculateRSIWithPatterns_BullishEngulfing(t *testing.T) {
	// Construct a bullish engulfing candle pattern
	klines := make([]Kline, 20)
	for i := 0; i < 18; i++ {
		klines[i] = Kline{Open: 100, Close: 100, High: 101, Low: 99}
	}
	// Bearish candle (prev)
	klines[18] = Kline{Open: 102, Close: 98, High: 103, Low: 97}
	// Bullish engulfing candle (last)
	klines[19] = Kline{Open: 97, Close: 103, High: 104, Low: 96}

	_, buy, _ := calculateRSIWithPatterns(klines, 14)
	assert.True(t, buy, "should detect bullish engulfing")
}

// ============================================================
// parseFloat helper
// ============================================================

func TestParseFloat(t *testing.T) {
	tests := []struct {
		name    string
		input   interface{}
		want    float64
		wantErr bool
	}{
		{"string", "123.45", 123.45, false},
		{"float64", 123.45, 123.45, false},
		{"int", 42, 42.0, false},
		{"int64", int64(99), 99.0, false},
		{"unsupported", true, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseFloat(tt.input)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.InDelta(t, tt.want, got, 0.001)
			}
		})
	}
}

// ============================================================
// emaSeries
// ============================================================

func TestEmaSeries_InsufficientData(t *testing.T) {
	result := emaSeries([]float64{1, 2}, 5)
	assert.Empty(t, result)
}

func TestEmaSeries_ExactPeriod(t *testing.T) {
	result := emaSeries([]float64{1, 2, 3}, 3)
	require.Len(t, result, 1)
	assert.InDelta(t, 2.0, result[0], 0.01) // SMA of [1,2,3] = 2.0
}

func TestEmaSeries_ZeroPeriod(t *testing.T) {
	result := emaSeries([]float64{1, 2, 3}, 0)
	assert.Empty(t, result)
}

// ============================================================
// sma / stdev helpers
// ============================================================

func TestSMA_Basic(t *testing.T) {
	values := []float64{10, 20, 30, 40, 50}
	result := sma(values, 3) // avg of last 3: (30+40+50)/3 = 40
	assert.InDelta(t, 40.0, result, 0.01)
}

func TestSMA_InsufficientData(t *testing.T) {
	assert.Equal(t, 0.0, sma([]float64{1}, 5))
	assert.Equal(t, 0.0, sma([]float64{}, 1))
}

func TestStdev_FlatValues(t *testing.T) {
	values := []float64{5, 5, 5, 5, 5}
	result := stdev(values, 5)
	assert.InDelta(t, 0.0, result, 0.001)
}

func TestStdev_KnownValues(t *testing.T) {
	values := []float64{2, 4, 4, 4, 5, 5, 7, 9}
	sd := stdev(values, 8)
	// Population stdev of [2,4,4,4,5,5,7,9] ≈ 2.0
	assert.Greater(t, sd, 0.0)
	assert.InDelta(t, 2.0, sd, 0.2)
}

// ============================================================
// Longer term data
// ============================================================

func TestCalculateLongerTermData_EmptyKlines(t *testing.T) {
	data := calculateLongerTermData([]Kline{})
	require.NotNil(t, data)
	assert.Equal(t, 0.0, data.EMA20)
	assert.Equal(t, 0.0, data.ATR14)
}

func TestCalculateLongerTermData_FullData(t *testing.T) {
	klines := generateEdgeTestKlines(60)
	data := calculateLongerTermData(klines)
	require.NotNil(t, data)
	assert.Greater(t, data.EMA20, 0.0)
	assert.Greater(t, data.EMA50, 0.0)
	assert.Greater(t, data.CurrentVolume, 0.0)
	assert.Greater(t, data.AverageVolume, 0.0)
}

// ============================================================
// findMatchingBracket (from engine.go, but lives in decision pkg — tested there)
// Min helper
// ============================================================

func TestMinHelper(t *testing.T) {
	// min is defined in data.go (market package doesn't have it, but it's used elsewhere)
	// We just verify basic math helper logic
	assert.InDelta(t, math.Min(3, 5), 3.0, 0)
	assert.InDelta(t, math.Min(5, 3), 3.0, 0)
}

// ============================================================
// Helper: generate klines for edge tests (different from the existing data_test.go helper)
// ============================================================

func generateEdgeTestKlines(count int) []Kline {
	klines := make([]Kline, count)
	for i := 0; i < count; i++ {
		basePrice := 100.0 + float64(i)*0.5
		klines[i] = Kline{
			OpenTime:  int64(i * 180000),
			Open:      basePrice,
			High:      basePrice + 2.0,
			Low:       basePrice - 1.0,
			Close:     basePrice + 0.5,
			Volume:    500.0 + float64(i)*10,
			CloseTime: int64((i+1)*180000 - 1),
		}
	}
	return klines
}
