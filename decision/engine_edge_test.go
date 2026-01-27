package decision

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// JSON extraction from AI responses
// ============================================================

func TestExtractDecisions_ValidJSONInCodeBlock(t *testing.T) {
	response := `<reasoning>
The market looks good for BTC.
</reasoning>

<decision>
` + "```json" + `
[
  {"symbol": "BTCUSDT", "action": "hold", "reasoning": "wait for confirmation"}
]
` + "```" + `
</decision>`

	decisions, err := extractDecisions(response)
	require.NoError(t, err)
	require.Len(t, decisions, 1)
	assert.Equal(t, "BTCUSDT", decisions[0].Symbol)
	assert.Equal(t, "hold", decisions[0].Action)
}

func TestExtractDecisions_ValidJSONWithoutCodeBlock(t *testing.T) {
	response := `<reasoning>
Analysis complete.
</reasoning>

<decision>
[{"symbol": "ETHUSDT", "action": "wait", "reasoning": "low confidence"}]
</decision>`

	decisions, err := extractDecisions(response)
	require.NoError(t, err)
	require.Len(t, decisions, 1)
	assert.Equal(t, "ETHUSDT", decisions[0].Symbol)
	assert.Equal(t, "wait", decisions[0].Action)
}

func TestExtractDecisions_NoJSON_SafeFallback(t *testing.T) {
	// AI outputs only reasoning, no JSON at all
	response := `<reasoning>
I need more data to make a decision. The market is choppy.
</reasoning>`

	decisions, err := extractDecisions(response)
	require.NoError(t, err)
	require.Len(t, decisions, 1, "should produce a safe fallback decision")
	assert.Equal(t, "ALL", decisions[0].Symbol)
	assert.Equal(t, "wait", decisions[0].Action)
}

func TestExtractDecisions_PlainTextNoTags(t *testing.T) {
	// AI outputs free-form text without any tags
	response := `I think the market will go up but I'm not sure.`

	decisions, err := extractDecisions(response)
	require.NoError(t, err)
	require.Len(t, decisions, 1)
	assert.Equal(t, "wait", decisions[0].Action, "fallback should be wait")
}

func TestExtractDecisions_MultipleDecisions(t *testing.T) {
	response := `<decision>
[
  {"symbol": "BTCUSDT", "action": "open_long", "leverage": 5, "position_size_usd": 500, "stop_loss": 90000, "take_profit": 110000, "confidence": 85, "risk_usd": 100, "reasoning": "bullish"},
  {"symbol": "ETHUSDT", "action": "close_short", "reasoning": "take profit"}
]
</decision>`

	decisions, err := extractDecisions(response)
	require.NoError(t, err)
	require.Len(t, decisions, 2)
	assert.Equal(t, "BTCUSDT", decisions[0].Symbol)
	assert.Equal(t, "open_long", decisions[0].Action)
	assert.Equal(t, 5, decisions[0].Leverage)
	assert.Equal(t, "ETHUSDT", decisions[1].Symbol)
	assert.Equal(t, "close_short", decisions[1].Action)
}

// ============================================================
// XML tag extraction
// ============================================================

func TestExtractCoTTrace_WithReasoningTag(t *testing.T) {
	response := `<reasoning>
BTC is showing bullish divergence on the 4h chart.
RSI is oversold at 28.
</reasoning>

<decision>
[{"symbol": "BTCUSDT", "action": "hold", "reasoning": "waiting"}]
</decision>`

	cot := extractCoTTrace(response)
	assert.Contains(t, cot, "BTC is showing bullish divergence")
	assert.Contains(t, cot, "RSI is oversold at 28")
	assert.NotContains(t, cot, "<decision>", "should not include decision tag")
}

func TestExtractCoTTrace_WithoutReasoningTag_UsesDecisionSplit(t *testing.T) {
	response := `Market analysis: BTC looks strong.

<decision>
[{"symbol": "BTCUSDT", "action": "hold", "reasoning": "strong"}]
</decision>`

	cot := extractCoTTrace(response)
	assert.Contains(t, cot, "Market analysis: BTC looks strong")
	assert.NotContains(t, cot, "<decision>")
}

func TestExtractCoTTrace_NoTagsAtAll(t *testing.T) {
	response := `Just some analysis without any structured output.`
	cot := extractCoTTrace(response)
	assert.Equal(t, response, cot)
}

// ============================================================
// Invisible unicode character stripping
// ============================================================

func TestRemoveInvisibleRunes(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"zero-width space", "hello\u200Bworld", "helloworld"},
		{"zero-width non-joiner", "foo\u200Cbar", "foobar"},
		{"zero-width joiner", "abc\u200Ddef", "abcdef"},
		{"BOM", "\uFEFFstart", "start"},
		{"multiple invisible chars", "\u200B\u200C\u200D\uFEFFclean", "clean"},
		{"no invisible chars", "normal text", "normal text"},
		{"empty string", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := removeInvisibleRunes(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}

// ============================================================
// fixMissingQuotes — fullwidth / CJK character replacement
// ============================================================

func TestFixMissingQuotes_FullwidthCharacters(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"fullwidth brackets", "［｛\"action\"：\"hold\"｝］", "[{\"action\":\"hold\"}]"},
		{"Chinese quotes", "\u201chello\u201d", "\"hello\""},
		{"fullwidth comma", "a，b", "a,b"},
		{"fullwidth colon", "key：value", "key:value"},
		{"CJK brackets", "【test】", "[test]"},
		{"fullwidth space", "a　b", "a b"},
		{"no replacement needed", "[{\"action\": \"hold\"}]", "[{\"action\": \"hold\"}]"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := fixMissingQuotes(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}

// ============================================================
// validateJSONFormat edge cases
// ============================================================

func TestValidateJSONFormat_ValidArray(t *testing.T) {
	err := validateJSONFormat(`[{"symbol": "BTC", "action": "hold"}]`)
	assert.NoError(t, err)
}

func TestValidateJSONFormat_NotAnObjectArray(t *testing.T) {
	err := validateJSONFormat(`[1, 2, 3]`)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "不是有效的决策数组")
}

func TestValidateJSONFormat_ContainsRangeSymbol(t *testing.T) {
	err := validateJSONFormat(`[{"symbol": "BTC", "stop_loss": "90000~95000"}]`)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "范围符号")
}

func TestValidateJSONFormat_ContainsThousandSeparator(t *testing.T) {
	err := validateJSONFormat(`[{"symbol": "BTC", "position_size_usd": 98,000}]`)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "千位分隔符")
}

// ============================================================
// compactArrayOpen
// ============================================================

func TestCompactArrayOpen(t *testing.T) {
	assert.Equal(t, "[{\"a\": 1}]", compactArrayOpen(`  [  {"a": 1}]`))
	assert.Equal(t, "[{\"a\": 1}]", compactArrayOpen(`[{"a": 1}]`))
}

// ============================================================
// validateDecision edge cases
// ============================================================

func TestValidateDecision_InvalidAction(t *testing.T) {
	d := &Decision{Symbol: "BTCUSDT", Action: "buy_everything"}
	err := validateDecision(d, 1000, 10, 5)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "无效的action")
}

func TestValidateDecision_HoldAndWait_NoParamsNeeded(t *testing.T) {
	d := &Decision{Symbol: "BTCUSDT", Action: "hold"}
	assert.NoError(t, validateDecision(d, 1000, 10, 5))

	d2 := &Decision{Symbol: "ALL", Action: "wait"}
	assert.NoError(t, validateDecision(d2, 1000, 10, 5))
}

func TestValidateDecision_OpenLong_MissingStopLoss(t *testing.T) {
	d := &Decision{
		Symbol:          "SOLUSDT",
		Action:          "open_long",
		Leverage:        3,
		PositionSizeUSD: 100,
		StopLoss:        0, // missing
		TakeProfit:      200,
	}
	err := validateDecision(d, 1000, 10, 5)
	assert.Error(t, err)
}

func TestValidateDecision_PartialClose_InvalidPercentage(t *testing.T) {
	tests := []struct {
		name string
		pct  float64
	}{
		{"zero", 0},
		{"negative", -10},
		{"over 100", 150},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := &Decision{
				Symbol:          "ETHUSDT",
				Action:          "partial_close",
				ClosePercentage: tt.pct,
			}
			err := validateDecision(d, 1000, 10, 5)
			assert.Error(t, err)
		})
	}
}

func TestValidateDecision_PartialClose_ValidPercentage(t *testing.T) {
	d := &Decision{
		Symbol:          "ETHUSDT",
		Action:          "partial_close",
		ClosePercentage: 50,
	}
	assert.NoError(t, validateDecision(d, 1000, 10, 5))
}

func TestValidateDecision_UpdateStopLoss_ZeroPrice(t *testing.T) {
	d := &Decision{
		Symbol:      "BTCUSDT",
		Action:      "update_stop_loss",
		NewStopLoss: 0,
	}
	err := validateDecision(d, 1000, 10, 5)
	assert.Error(t, err)
}

func TestValidateDecision_OpenShort_StopLossMustBeAboveTakeProfit(t *testing.T) {
	d := &Decision{
		Symbol:          "BTCUSDT",
		Action:          "open_short",
		Leverage:        5,
		PositionSizeUSD: 500,
		StopLoss:        80000, // below take profit — invalid for short
		TakeProfit:      90000,
	}
	err := validateDecision(d, 1000, 10, 5)
	assert.Error(t, err)
}

func TestValidateDecision_OpenLong_MinPositionSize(t *testing.T) {
	d := &Decision{
		Symbol:          "SOLUSDT",
		Action:          "open_long",
		Leverage:        3,
		PositionSizeUSD: 5, // too small (<12)
		StopLoss:        10,
		TakeProfit:      200,
	}
	err := validateDecision(d, 1000, 10, 5)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "开仓金额过小")
}

// ============================================================
// parseFullDecisionResponse integration
// ============================================================

func TestParseFullDecisionResponse_ValidResponse(t *testing.T) {
	response := `<reasoning>
BTC is looking bullish on multiple timeframes.
</reasoning>

<decision>
` + "```json" + `
[
  {"symbol": "BTCUSDT", "action": "hold", "reasoning": "consolidation phase"}
]
` + "```" + `
</decision>`

	fd, err := parseFullDecisionResponse(response, 1000, 10, 5)
	require.NoError(t, err)
	require.NotNil(t, fd)
	assert.Contains(t, fd.CoTTrace, "BTC is looking bullish")
	require.Len(t, fd.Decisions, 1)
	assert.Equal(t, "hold", fd.Decisions[0].Action)
}

func TestParseFullDecisionResponse_EmptyResponse(t *testing.T) {
	fd, err := parseFullDecisionResponse("", 1000, 10, 5)
	// Should produce a safe fallback, no crash
	require.NoError(t, err)
	require.NotNil(t, fd)
	require.GreaterOrEqual(t, len(fd.Decisions), 1)
	assert.Equal(t, "wait", fd.Decisions[0].Action)
}

func TestExtractDecisions_JSONWithInvisiblePrefix(t *testing.T) {
	// BOM + zero-width chars before JSON
	response := "\uFEFF\u200B<decision>\n[{\"symbol\": \"BTCUSDT\", \"action\": \"hold\", \"reasoning\": \"ok\"}]\n</decision>"

	decisions, err := extractDecisions(response)
	require.NoError(t, err)
	require.Len(t, decisions, 1)
	assert.Equal(t, "hold", decisions[0].Action)
}
