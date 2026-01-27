package trader

import (
	"aspen/config"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// NewPaperTrader — basic creation
// ============================================================

func TestNewPaperTrader_InitializesCorrectBalance(t *testing.T) {
	pt, err := NewPaperTrader(10000.0)
	require.NoError(t, err)
	assert.Equal(t, 10000.0, pt.balance)
	assert.Equal(t, 10000.0, pt.initialBalance)
	assert.Equal(t, 0.0, pt.realizedPnL)
	assert.NotNil(t, pt.positions)
	assert.Len(t, pt.positions, 0)
}

func TestNewPaperTrader_RejectsZeroBalance(t *testing.T) {
	pt, err := NewPaperTrader(0)
	assert.Error(t, err)
	assert.Nil(t, pt)
}

func TestNewPaperTrader_RejectsNegativeBalance(t *testing.T) {
	pt, err := NewPaperTrader(-500)
	assert.Error(t, err)
	assert.Nil(t, pt)
}

func TestNewPaperTrader_SmallBalance(t *testing.T) {
	pt, err := NewPaperTrader(0.01)
	require.NoError(t, err)
	assert.Equal(t, 0.01, pt.balance)
}

// ============================================================
// Position key generation
// ============================================================

func TestGetPositionKey(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	assert.Equal(t, "BTCUSDT_LONG", pt.getPositionKey("BTCUSDT", "LONG"))
	assert.Equal(t, "ETHUSDT_SHORT", pt.getPositionKey("ETHUSDT", "SHORT"))
}

// ============================================================
// FormatQuantity
// ============================================================

func TestFormatQuantity(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	formatted, err := pt.FormatQuantity("BTCUSDT", 0.123456789)
	require.NoError(t, err)
	assert.Equal(t, "0.123457", formatted, "should be 6 decimal places")
}

// ============================================================
// SetLeverage / SetMarginMode — no-op but shouldn't panic
// ============================================================

func TestSetLeverage_NoPanic(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	err := pt.SetLeverage("BTCUSDT", 10)
	assert.NoError(t, err)
}

func TestSetMarginMode_NoPanic(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	assert.NoError(t, pt.SetMarginMode("BTCUSDT", true))
	assert.NoError(t, pt.SetMarginMode("BTCUSDT", false))
}

// ============================================================
// Stop-loss / take-profit stubs — should not error
// ============================================================

func TestStopLossAndTakeProfitStubs(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	assert.NoError(t, pt.SetStopLoss("BTCUSDT", "LONG", 1, 90000))
	assert.NoError(t, pt.SetTakeProfit("BTCUSDT", "LONG", 1, 110000))
	assert.NoError(t, pt.CancelStopLossOrders("BTCUSDT"))
	assert.NoError(t, pt.CancelTakeProfitOrders("BTCUSDT"))
	assert.NoError(t, pt.CancelAllOrders("BTCUSDT"))
	assert.NoError(t, pt.CancelStopOrders("BTCUSDT"))
}

// ============================================================
// CloseLong / CloseShort on empty positions
// ============================================================

func TestCloseLong_NoPosition_ReturnsError(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	_, err := pt.CloseLong("BTCUSDT", 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "没有多仓持仓")
}

func TestCloseShort_NoPosition_ReturnsError(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	_, err := pt.CloseShort("BTCUSDT", 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "没有空仓持仓")
}

// ============================================================
// Internal position management (direct manipulation for unit testing)
// ============================================================

func TestPositionTracking(t *testing.T) {
	pt, _ := NewPaperTrader(10000)

	// Manually add a position (simulating what OpenLong does internally)
	key := pt.getPositionKey("BTCUSDT", "LONG")
	pt.positions[key] = &Position{
		Symbol:     "BTCUSDT",
		Side:       "LONG",
		Quantity:   0.1,
		EntryPrice: 50000,
		Leverage:   10,
	}

	assert.Len(t, pt.positions, 1)
	assert.Equal(t, 0.1, pt.positions[key].Quantity)
	assert.Equal(t, 50000.0, pt.positions[key].EntryPrice)
}

func TestPositionKeys_LongAndShort_Independent(t *testing.T) {
	pt, _ := NewPaperTrader(10000)

	longKey := pt.getPositionKey("BTCUSDT", "LONG")
	shortKey := pt.getPositionKey("BTCUSDT", "SHORT")
	assert.NotEqual(t, longKey, shortKey)

	pt.positions[longKey] = &Position{Symbol: "BTCUSDT", Side: "LONG", Quantity: 1}
	pt.positions[shortKey] = &Position{Symbol: "BTCUSDT", Side: "SHORT", Quantity: 2}

	assert.Len(t, pt.positions, 2)
}

// ============================================================
// SaveState / LoadState round-trip with real SQLite
// ============================================================

func createTempDB(t *testing.T) (*config.Database, string) {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test_paper_trader.db")
	db, err := config.NewDatabase(dbPath)
	require.NoError(t, err)
	return db, dbPath
}

func TestSaveState_LoadState_RoundTrip(t *testing.T) {
	database, _ := createTempDB(t)
	defer database.Close()

	traderID := "test-trader-1"

	// Create a paper trader with DB
	pt, err := NewPaperTraderWithDB(5000, database, traderID)
	require.NoError(t, err)
	assert.Equal(t, 5000.0, pt.balance)

	// Simulate some state changes
	pt.balance = 4500.0
	pt.realizedPnL = -200.0
	pt.positions["BTCUSDT_LONG"] = &Position{
		Symbol:     "BTCUSDT",
		Side:       "LONG",
		Quantity:   0.05,
		EntryPrice: 95000,
		Leverage:   10,
	}

	// Save state
	pt.SaveState()

	// Create a new trader with same DB — should restore state
	pt2, err := NewPaperTraderWithDB(5000, database, traderID)
	require.NoError(t, err)
	assert.InDelta(t, 4500.0, pt2.balance, 0.01)
	assert.InDelta(t, -200.0, pt2.realizedPnL, 0.01)
	require.Len(t, pt2.positions, 1)
	pos := pt2.positions["BTCUSDT_LONG"]
	require.NotNil(t, pos)
	assert.Equal(t, "BTCUSDT", pos.Symbol)
	assert.Equal(t, "LONG", pos.Side)
	assert.InDelta(t, 0.05, pos.Quantity, 1e-6)
	assert.InDelta(t, 95000.0, pos.EntryPrice, 0.01)
}

func TestNewPaperTraderWithDB_FreshStart(t *testing.T) {
	database, _ := createTempDB(t)
	defer database.Close()

	// No saved state — should use initial balance
	pt, err := NewPaperTraderWithDB(8000, database, "brand-new-trader")
	require.NoError(t, err)
	assert.Equal(t, 8000.0, pt.balance)
	assert.Equal(t, 8000.0, pt.initialBalance)
	assert.Equal(t, 0.0, pt.realizedPnL)
	assert.Len(t, pt.positions, 0)
}

func TestNewPaperTraderWithDB_NilDB(t *testing.T) {
	// Should work without DB (no persistence)
	pt, err := NewPaperTraderWithDB(3000, nil, "no-db-trader")
	require.NoError(t, err)
	assert.Equal(t, 3000.0, pt.balance)
}

func TestNewPaperTraderWithDB_EmptyTraderID(t *testing.T) {
	database, _ := createTempDB(t)
	defer database.Close()

	// Empty traderID — should still work, just no persistence
	pt, err := NewPaperTraderWithDB(2000, database, "")
	require.NoError(t, err)
	assert.Equal(t, 2000.0, pt.balance)
}

func TestNewPaperTraderWithDB_RejectsZeroBalance(t *testing.T) {
	database, _ := createTempDB(t)
	defer database.Close()

	pt, err := NewPaperTraderWithDB(0, database, "zero-bal")
	assert.Error(t, err)
	assert.Nil(t, pt)
}

func TestSaveState_WithoutDB_NoPanic(t *testing.T) {
	pt, _ := NewPaperTrader(1000)
	// Should be a no-op, no crash
	pt.SaveState()
}

func TestSaveState_MultiplePositions(t *testing.T) {
	database, _ := createTempDB(t)
	defer database.Close()

	traderID := "multi-pos-trader"
	pt, err := NewPaperTraderWithDB(10000, database, traderID)
	require.NoError(t, err)

	pt.positions["BTCUSDT_LONG"] = &Position{
		Symbol: "BTCUSDT", Side: "LONG", Quantity: 0.1, EntryPrice: 95000, Leverage: 10,
	}
	pt.positions["ETHUSDT_SHORT"] = &Position{
		Symbol: "ETHUSDT", Side: "SHORT", Quantity: 1.0, EntryPrice: 3500, Leverage: 5,
	}
	pt.balance = 8000
	pt.realizedPnL = 150

	pt.SaveState()

	// Reload
	pt2, err := NewPaperTraderWithDB(10000, database, traderID)
	require.NoError(t, err)
	assert.InDelta(t, 8000, pt2.balance, 0.01)
	assert.InDelta(t, 150, pt2.realizedPnL, 0.01)
	require.Len(t, pt2.positions, 2)
	assert.NotNil(t, pt2.positions["BTCUSDT_LONG"])
	assert.NotNil(t, pt2.positions["ETHUSDT_SHORT"])
}

// ============================================================
// Position JSON serialization
// ============================================================

func TestPositionJSON_Roundtrip(t *testing.T) {
	positions := map[string]*Position{
		"BTCUSDT_LONG": {
			Symbol:        "BTCUSDT",
			Side:          "LONG",
			Quantity:      0.05,
			EntryPrice:    95000,
			Leverage:      10,
			UnrealizedPnL: 250.0,
		},
	}

	data, err := json.Marshal(positions)
	require.NoError(t, err)

	var loaded map[string]*Position
	err = json.Unmarshal(data, &loaded)
	require.NoError(t, err)

	pos := loaded["BTCUSDT_LONG"]
	require.NotNil(t, pos)
	assert.Equal(t, "BTCUSDT", pos.Symbol)
	assert.Equal(t, "LONG", pos.Side)
	assert.InDelta(t, 0.05, pos.Quantity, 1e-6)
}

// ============================================================
// DB persistence edge cases
// ============================================================

func TestDBPersistence_EmptyPositions(t *testing.T) {
	database, _ := createTempDB(t)
	defer database.Close()

	traderID := "empty-pos-trader"
	pt, _ := NewPaperTraderWithDB(5000, database, traderID)
	pt.balance = 4000
	pt.realizedPnL = 100
	// No positions
	pt.SaveState()

	pt2, err := NewPaperTraderWithDB(5000, database, traderID)
	require.NoError(t, err)
	assert.InDelta(t, 4000, pt2.balance, 0.01)
	assert.Len(t, pt2.positions, 0)
}

func TestDBPersistence_OverwriteState(t *testing.T) {
	database, _ := createTempDB(t)
	defer database.Close()

	traderID := "overwrite-trader"

	// First save
	pt, _ := NewPaperTraderWithDB(5000, database, traderID)
	pt.balance = 4000
	pt.SaveState()

	// Second save — overwrites
	pt.balance = 3000
	pt.SaveState()

	pt2, err := NewPaperTraderWithDB(5000, database, traderID)
	require.NoError(t, err)
	assert.InDelta(t, 3000, pt2.balance, 0.01, "should have latest saved state")
}

func TestDBPersistence_FileExists(t *testing.T) {
	database, dbPath := createTempDB(t)
	database.Close()

	// File should exist on disk
	_, err := os.Stat(dbPath)
	assert.NoError(t, err, "database file should exist")
}
