# Aspen Trading Investigation Report
**Date:** 2026-02-02
**Investigator:** Friday (AI Agent)

---

## Executive Summary

Three issues were investigated:
1. Claude & GPT-4o traders at $0 (no trades)
2. Two Gemini traders with opposite results (+$105 vs -$594)
3. WebSocket concurrent write panic bug

---

## Issue 1: Claude & GPT-4o Traders at $0 (No Trades)

### Root Cause: **OpenRouter API Rate Limit Hit**

**Error Message:**
```
Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys
```

**Evidence from recent decision logs:**
- `/decision_logs/test-trader-claude/decision_20260202_092736_cycle2.json`
- `/decision_logs/test-trader-gpt4o/decision_20260202_092735_cycle2.json`
- All traders hitting 403 error with rate limit message

### Secondary Issue: Empty Action Output

When traders WERE working earlier, some decisions output empty `"action": ""` instead of `"wait"` or `"hold"`, causing:
```
获取AI决策失败: 解析AI响应失败: 决策验证失败: 决策 #1 验证失败: 无效的action: 
```

**Example from Gemini trader (Feb 1):**
```json
"decision_json": "[{\"symbol\": \"BTCUSDT\", \"action\": \"\", \"reasoning\": \"\"}...]"
```

The model analyzed correctly but output empty action fields.

### Recommendations:
1. **Increase OpenRouter API rate limit** at https://openrouter.ai/settings/keys
2. **Add fallback handling** in decision parser to treat empty actions as "wait"
3. **Update prompts** to explicitly state: "If no trade, output `action: wait`"

---

## Issue 2: Two Gemini Traders with Opposite Results

| Trader | Model | Leverage | Balance | P&L |
|--------|-------|----------|---------|-----|
| test-trader-gemini | `google/gemini-3-flash-preview` | BTC/ETH: 3x, Alt: 3x | $10,105 | +$105 (+1.06%) |
| paper_openrouter-google-gemini-2.5-pro | `google/gemini-2.5-pro` | BTC/ETH: 5x, Alt: 3x | $9,344 | -$594 (-5.95%) |

### Key Differences Found:

1. **Model Version:**
   - Profitable: `google/gemini-3-flash-preview` (newer)
   - Losing: `google/gemini-2.5-pro` (older)

2. **Leverage:**
   - Profitable: Conservative 3x across the board
   - Losing: Higher 5x leverage on BTC/ETH

3. **Trading Behavior (from logs):**
   - The losing trader (gemini-2.5-pro) took more aggressive positions:
     - Short SOL at $286.31 → lost $125.89
     - Long DOGE at $0.398 → lost $91.79
   - Used 90% margin at peak

### Recommendations:
1. **Use Gemini 3 Flash** as the default model (better performance)
2. **Reduce leverage** to 3x maximum for all positions
3. **Monitor margin usage** - keep below 60%

---

## Issue 3: WebSocket Concurrent Write Bug

### Location:
`market/combined_streams.go`

### Error:
```
panic: concurrent write to websocket connection
```

### Root Cause:
Write operations (`WriteJSON`) were protected with `RLock()` (read lock) instead of `Lock()` (write lock). `RLock` allows multiple goroutines to acquire the lock simultaneously, enabling concurrent writes.

**Affected functions:**
- `subscribeBybitKlines()` - line 137
- `subscribeStreams()` - line 171  
- `sendJSON()` - line 183

### Fix Applied:
Changed `RLock()` to `Lock()` for all WebSocket write operations:

```go
// BEFORE (buggy):
c.mu.RLock()
defer c.mu.RUnlock()
return c.conn.WriteJSON(subscribeMsg)

// AFTER (fixed):
c.mu.Lock()
defer c.mu.Unlock()
return c.conn.WriteJSON(subscribeMsg)
```

### Status:
✅ **Fixed and tested** - Build successful

---

## Paper Trader Balance Summary

| Trader | Initial | Current | Realized P&L |
|--------|---------|---------|--------------|
| test-trader-gemini | $10,000 | $10,095 | +$105.58 |
| paper_openrouter-deepseek-v3.2-exp | $10,000 | $9,939 | -$41.55 |
| test-trader-deepseek | $10,000 | $9,682 | -$214.33 |
| paper_openrouter-gemini-2.5-pro | $10,000 | $9,344 | -$594.77 |
| test-trader-claude | $10,000 | $10,000 | $0.00 (API blocked) |
| test-trader-gpt4o | $10,000 | $10,000 | $0.00 (API blocked) |

---

## Action Items

| Priority | Item | Status |
|----------|------|--------|
| 🔴 High | Increase OpenRouter API limit | Pending |
| 🔴 High | Deploy WebSocket fix | ✅ Fixed |
| 🟡 Medium | Update prompts for empty action handling | Pending |
| 🟡 Medium | Switch losing trader to Gemini 3 Flash | Pending |
| 🟢 Low | Reduce leverage defaults to 3x | Pending |

---

## Files Modified

- `market/combined_streams.go` - Fixed concurrent write bug (lines 137, 171, 183)

## Files Analyzed

- `decision_logs/test-trader-*/*.json`
- `decision_logs/paper_openrouter-google-gemini-2.5-pro_*/*.json`
- `config.db` (traders, ai_models, paper_trader_state tables)
- `aspen.log`
