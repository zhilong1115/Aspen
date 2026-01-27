#!/usr/bin/env python3
"""
Generate realistic mock decision log data for 4 paper traders.
Each trader has a distinct personality and performance profile.
"""

import json
import os
import random
import math
from datetime import datetime, timedelta, timezone

# PST timezone
PST = timezone(timedelta(hours=-8))

# Base directory
BASE_DIR = "/Users/zhilongzheng/Projects/nofx/decision_logs"

# Trader directories
TRADERS = {
    "grok4": "paper_openrouter-x-ai-grok-4_1763057722",
    "gpt5": "paper_openrouter-openai-gpt-5_1763057706",
    "gemini": "paper_openrouter-google-gemini-2.5-pro_1763057690",
    "deepseek": "paper_openrouter-deepseek-deepseek-v3.2-exp_1763057671",
}

# Coin prices (approximate current/recent prices for Jan 2026)
COIN_PRICES_BASE = {
    "BTCUSDT": 105000,
    "ETHUSDT": 3300,
    "SOLUSDT": 260,
    "BNBUSDT": 700,
    "DOGEUSDT": 0.35,
    "XRPUSDT": 2.80,
    "ADAUSDT": 0.95,
    "HYPEUSDT": 45.0,
}

CANDIDATE_COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT", "XRPUSDT", "ADAUSDT", "HYPEUSDT"]

# Time range: Jan 1 - Jan 30, 2026, hourly
START = datetime(2026, 1, 1, 0, 0, 0, tzinfo=PST)
END = datetime(2026, 1, 30, 23, 0, 0, tzinfo=PST)
INTERVAL = timedelta(hours=1)

INITIAL_BALANCE = 10000.0


def smooth_curve(values, window=5):
    """Simple moving average smoother."""
    result = list(values)
    for i in range(window, len(result) - window):
        result[i] = sum(values[i-window:i+window+1]) / (2*window + 1)
    return result


def generate_equity_curve_v2(n_points, personality):
    """
    Generate a realistic equity curve using a target path + controlled noise.
    Returns list of balances of length n_points.
    """
    if personality == "star":
        # Grok-4: +18% over 30 days. Steady climb with small drawdowns.
        # Target: starts at 10000, ends at 11800
        # Path: gentle upward with a couple small dips
        target = []
        for i in range(n_points):
            t = i / (n_points - 1)  # 0 to 1
            # Main upward trend
            base = 10000 + 1800 * t
            # Add a small dip around day 8-10 (t=0.27-0.33)
            dip1 = -200 * math.exp(-((t - 0.30) ** 2) / (2 * 0.02 ** 2))
            # Another small dip around day 20 (t=0.67)
            dip2 = -150 * math.exp(-((t - 0.67) ** 2) / (2 * 0.015 ** 2))
            # Acceleration in the middle
            accel = 200 * math.sin(math.pi * t)
            target.append(base + dip1 + dip2 + accel)

        # Add small noise
        noisy = [v + random.gauss(0, 20) for v in target]
        return [round(v, 2) for v in smooth_curve(noisy, 3)]

    elif personality == "conservative":
        # GPT-5: +8% over 30 days. Very smooth, almost linear.
        target = []
        for i in range(n_points):
            t = i / (n_points - 1)
            base = 10000 + 800 * t
            # Tiny seasonal variation
            wave = 50 * math.sin(2 * math.pi * t * 3)
            # One small flat period around day 15
            flat = -80 * math.exp(-((t - 0.5) ** 2) / (2 * 0.05 ** 2))
            target.append(base + wave + flat)

        noisy = [v + random.gauss(0, 10) for v in target]
        return [round(v, 2) for v in smooth_curve(noisy, 3)]

    elif personality == "volatile":
        # Gemini: +3% final, but swings ±15%. Roller coaster.
        target = []
        for i in range(n_points):
            t = i / (n_points - 1)
            # Final target: 10300
            base = 10000 + 300 * t
            # Big swings
            swing1 = 800 * math.sin(2 * math.pi * t * 1.5)       # Up to +8%, oscillating
            swing2 = 500 * math.sin(2 * math.pi * t * 3.2 + 1)   # Faster oscillation
            swing3 = -600 * math.exp(-((t - 0.55) ** 2) / (2 * 0.04 ** 2))  # Big crash mid-month
            swing4 = 400 * math.exp(-((t - 0.35) ** 2) / (2 * 0.03 ** 2))   # Big rally
            target.append(base + swing1 + swing2 + swing3 + swing4)

        noisy = [v + random.gauss(0, 35) for v in target]
        return [round(v, 2) for v in smooth_curve(noisy, 3)]

    elif personality == "underperformer":
        # DeepSeek: -5% final. Good start, then bad week, partial recovery.
        target = []
        for i in range(n_points):
            t = i / (n_points - 1)
            # Rises to +6% by day 10-12, crashes to -10% by day 20, recovers to -5%
            base = 10000
            # Initial rise
            rise = 600 * math.sin(math.pi * min(t / 0.4, 1)) if t < 0.4 else 600 * math.exp(-3 * (t - 0.4))
            # Big drawdown
            crash = -1200 * max(0, math.sin(math.pi * max(0, (t - 0.4)) / 0.35)) if 0.4 < t < 0.75 else 0
            # Recovery
            recovery = 300 * max(0, (t - 0.75)) / 0.25 if t > 0.75 else 0
            # Adjust to hit -5% at end
            target.append(base + rise + crash + recovery - 100 * t)

        noisy = [v + random.gauss(0, 18) for v in target]
        result = [round(v, 2) for v in smooth_curve(noisy, 3)]
        # Adjust final point to be close to 9500
        offset = 9500 - result[-1]
        # Gradually apply offset over last 20% of points
        n_adjust = n_points // 5
        for i in range(n_adjust):
            idx = n_points - n_adjust + i
            factor = i / n_adjust
            result[idx] = round(result[idx] + offset * factor, 2)
        return result

    return [INITIAL_BALANCE] * n_points


def generate_positions(trader_type, balance, step, total_steps, coin_prices):
    """Generate realistic open positions for a trader at a given step."""
    positions = []
    t = step / total_steps

    if trader_type == "grok4":
        if random.random() < 0.55:
            coins = random.sample(["BTCUSDT", "ETHUSDT"], k=random.choices([1, 2], weights=[0.6, 0.4])[0])
            for coin in coins:
                entry_offset = random.uniform(-0.02, 0.015)
                entry_price = coin_prices[coin] * (1 + entry_offset)
                current_price = coin_prices[coin]
                leverage = random.choice([3, 5])
                direction = "long" if random.random() < 0.75 else "short"

                size_usd = random.uniform(50000, 80000) if coin == "BTCUSDT" else random.uniform(30000, 50000)
                qty = round(size_usd / entry_price, 3)

                unrealized = ((current_price - entry_price) if direction == "long" else (entry_price - current_price)) * qty
                positions.append({
                    "symbol": coin, "side": direction,
                    "entry_price": round(entry_price, 2),
                    "mark_price": round(current_price, 2),
                    "quantity": qty, "leverage": leverage,
                    "unrealized_pnl": round(unrealized, 2),
                    "margin": round(size_usd / leverage, 2),
                })

    elif trader_type == "gpt5":
        if random.random() < 0.35:
            coin = random.choice(["BTCUSDT", "ETHUSDT"])
            entry_offset = random.uniform(-0.015, 0.01)
            entry_price = coin_prices[coin] * (1 + entry_offset)
            current_price = coin_prices[coin]
            leverage = random.choice([2, 3])

            size_usd = random.uniform(30000, 50000) if coin == "BTCUSDT" else random.uniform(20000, 30000)
            qty = round(size_usd / entry_price, 3)
            unrealized = (current_price - entry_price) * qty
            positions.append({
                "symbol": coin, "side": "long",
                "entry_price": round(entry_price, 2),
                "mark_price": round(current_price, 2),
                "quantity": qty, "leverage": leverage,
                "unrealized_pnl": round(unrealized, 2),
                "margin": round(size_usd / leverage, 2),
            })

    elif trader_type == "gemini":
        if random.random() < 0.65:
            n_pos = random.choices([1, 2, 3], weights=[0.3, 0.4, 0.3])[0]
            pool = ["SOLUSDT", "BTCUSDT", "ETHUSDT", "DOGEUSDT", "BNBUSDT", "XRPUSDT"]
            coins = random.sample(pool, k=min(n_pos, len(pool)))
            for coin in coins:
                entry_offset = random.uniform(-0.04, 0.025)
                entry_price = coin_prices[coin] * (1 + entry_offset)
                current_price = coin_prices[coin]
                leverage = random.choice([2, 3])
                direction = random.choice(["long", "short"])

                if coin == "BTCUSDT":
                    size_usd = random.uniform(40000, 70000)
                elif coin == "ETHUSDT":
                    size_usd = random.uniform(25000, 45000)
                else:
                    size_usd = random.uniform(8000, 15000)

                decimals = 4 if coin_prices[coin] < 1 else (3 if coin_prices[coin] < 100 else 3)
                qty = round(size_usd / entry_price, decimals)
                unrealized = ((current_price - entry_price) if direction == "long" else (entry_price - current_price)) * qty

                price_decimals = 6 if coin_prices[coin] < 1 else 2
                positions.append({
                    "symbol": coin, "side": direction,
                    "entry_price": round(entry_price, price_decimals),
                    "mark_price": round(current_price, price_decimals),
                    "quantity": qty, "leverage": leverage,
                    "unrealized_pnl": round(unrealized, 2),
                    "margin": round(size_usd / leverage, 2),
                })

    elif trader_type == "deepseek":
        if random.random() < 0.45:
            n_pos = random.choices([1, 2], weights=[0.6, 0.4])[0]
            coins = random.sample(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"], k=n_pos)
            for coin in coins:
                entry_offset = random.uniform(-0.035, 0.02)
                entry_price = coin_prices[coin] * (1 + entry_offset)
                current_price = coin_prices[coin]
                leverage = random.choice([3, 5]) if coin in ["BTCUSDT", "ETHUSDT"] else random.choice([2, 3])
                direction = random.choice(["long", "short"])

                if coin == "BTCUSDT":
                    size_usd = random.uniform(40000, 60000)
                elif coin == "ETHUSDT":
                    size_usd = random.uniform(25000, 40000)
                else:
                    size_usd = random.uniform(8000, 12000)

                qty = round(size_usd / entry_price, 3)
                unrealized = ((current_price - entry_price) if direction == "long" else (entry_price - current_price)) * qty
                positions.append({
                    "symbol": coin, "side": direction,
                    "entry_price": round(entry_price, 2),
                    "mark_price": round(current_price, 2),
                    "quantity": qty, "leverage": leverage,
                    "unrealized_pnl": round(unrealized, 2),
                    "margin": round(size_usd / leverage, 2),
                })

    return positions


def generate_decisions(trader_type, positions, coin_prices):
    """Generate trading decisions for a cycle."""
    actions = []
    execution_log = []

    action_probs = {"grok4": 0.22, "gpt5": 0.10, "gemini": 0.32, "deepseek": 0.18}

    if random.random() > action_probs.get(trader_type, 0.15):
        action_type = random.choice(["wait", "hold"])
        actions.append({
            "action": action_type, "symbol": "ALL",
            "quantity": 0, "leverage": 0, "price": 0,
            "order_id": 0, "timestamp": "", "success": True, "error": ""
        })
        reasons = [
            "No high-confidence setup found",
            "RSI near oversold, waiting for confirmation",
            "Trend unclear, maintaining positions",
            "Waiting for breakout confirmation",
            "Market consolidating, holding",
            "Risk-reward not favorable",
            "Indicators conflicting, staying out",
            "Volatility too low for entry",
            "4h EMA20 ≈ EMA50, no clear trend",
            "KEMAD and ZeroLag not aligned",
        ]
        execution_log.append(f"✓ ALL {action_type} — {random.choice(reasons)}")
        return actions, execution_log

    # Trade action
    if positions and random.random() < 0.4:
        pos = random.choice(positions)
        close_action = f"close_{pos['side']}"
        actions.append({
            "action": close_action, "symbol": pos["symbol"],
            "quantity": pos["quantity"], "leverage": pos["leverage"],
            "price": pos["mark_price"],
            "order_id": random.randint(100000, 999999),
            "timestamp": "", "success": True, "error": ""
        })
        pnl = pos['unrealized_pnl']
        pnl_str = f"+{pnl:.2f}" if pnl >= 0 else f"{pnl:.2f}"
        execution_log.append(f"Closed {pos['side'].upper()} {pos['symbol']} @ {pos['mark_price']} (PnL: {pnl_str} USDT)")
    else:
        # Open new
        if trader_type == "gemini":
            coin = random.choice(["SOLUSDT", "BTCUSDT", "ETHUSDT", "DOGEUSDT", "BNBUSDT", "XRPUSDT"])
        elif trader_type in ["grok4", "gpt5"]:
            coin = random.choices(["BTCUSDT", "ETHUSDT", "SOLUSDT"], weights=[0.5, 0.35, 0.15])[0]
        else:
            coin = random.choice(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"])

        price = coin_prices.get(coin, 100)
        price_with_slippage = price * (1 + random.uniform(-0.002, 0.002))

        dir_map = {
            "grok4": (0.72, [3, 5], [3, 5]),
            "gpt5": (0.82, [2, 3], [2, 3]),
            "gemini": (0.50, [2, 3], [2, 3]),
            "deepseek": (0.55, [3, 5], [2, 3]),
        }
        long_prob, btc_lev, alt_lev = dir_map.get(trader_type, (0.5, [3], [2]))
        direction = "open_long" if random.random() < long_prob else "open_short"
        leverage = random.choice(btc_lev if coin in ["BTCUSDT", "ETHUSDT"] else alt_lev)

        if coin == "BTCUSDT":
            size_usd = random.uniform(50000, 80000)
        elif coin == "ETHUSDT":
            size_usd = random.uniform(30000, 50000)
        else:
            size_usd = random.uniform(8000, 15000)

        if price > 1000:
            qty = round(size_usd / price_with_slippage, 3)
        elif price > 1:
            qty = round(size_usd / price_with_slippage, 2)
        else:
            qty = round(size_usd / price_with_slippage, 0)

        price_dec = 6 if price < 1 else 2
        actions.append({
            "action": direction, "symbol": coin,
            "quantity": qty, "leverage": leverage,
            "price": round(price_with_slippage, price_dec),
            "order_id": random.randint(100000, 999999),
            "timestamp": "", "success": True, "error": ""
        })
        side_str = "LONG" if "long" in direction else "SHORT"
        execution_log.append(f"Opened {side_str} {coin} x{leverage} @ {round(price_with_slippage, price_dec)} ({round(size_usd)} USDT)")

    return actions, execution_log


def simulate_coin_prices(step, total_steps):
    """Simulate realistic coin price evolution over time."""
    prices = {}
    t = step / max(total_steps - 1, 1)

    for coin, base in COIN_PRICES_BASE.items():
        # Each coin has unique price trajectory
        if coin == "BTCUSDT":
            drift = base * (0.06 * math.sin(2 * math.pi * t * 1.5) + 0.04 * t + 0.02 * math.sin(2 * math.pi * t * 4))
        elif coin == "ETHUSDT":
            drift = base * (0.08 * math.sin(2 * math.pi * t * 1.2 + 0.5) + 0.03 * t)
        elif coin == "SOLUSDT":
            drift = base * (0.12 * math.sin(2 * math.pi * t * 2.0 + 1.0) + 0.02 * t)
        elif coin == "BNBUSDT":
            drift = base * (0.05 * math.sin(2 * math.pi * t * 1.0 + 0.3) + 0.01 * t)
        elif coin == "DOGEUSDT":
            drift = base * (0.18 * math.sin(2 * math.pi * t * 2.5 + 2.0) + 0.01 * t)
        elif coin == "XRPUSDT":
            drift = base * (0.10 * math.sin(2 * math.pi * t * 1.8 + 1.5) + 0.02 * t)
        elif coin == "ADAUSDT":
            drift = base * (0.08 * math.sin(2 * math.pi * t * 1.3 + 0.8) + 0.01 * t)
        else:
            drift = base * (0.07 * math.sin(2 * math.pi * t * 1.5 + 1.2) + 0.02 * t)

        noise = base * random.gauss(0, 0.003)
        p = base + drift + noise
        prices[coin] = round(p, 6 if base < 1 else 2)
    return prices


def create_record(timestamp, cycle_num, trader_type, balance, positions, coin_prices):
    """Create a single decision log record."""
    unrealized = sum(p.get("unrealized_pnl", 0) for p in positions)
    total_margin = sum(p.get("margin", 0) for p in positions)
    available = max(balance - total_margin, 0)
    margin_pct = round(total_margin / balance * 100, 1) if balance > 0 else 0
    margin_pct = min(margin_pct, 90)

    decisions, exec_log = generate_decisions(trader_type, positions, coin_prices)

    for d in decisions:
        d["timestamp"] = timestamp.isoformat()

    dur_ranges = {"grok4": (2000, 8000), "gpt5": (3000, 12000), "gemini": (2500, 10000), "deepseek": (4000, 15000)}
    lo, hi = dur_ranges.get(trader_type, (3000, 8000))
    ai_duration = random.randint(lo, hi)
    exec_log.insert(0, f"AI调用耗时: {ai_duration} ms")

    return {
        "timestamp": timestamp.isoformat(),
        "cycle_number": cycle_num,
        "system_prompt": "",
        "input_prompt": "",
        "cot_trace": "",
        "decision_json": "",
        "account_state": {
            "total_balance": round(balance, 2),
            "available_balance": round(available, 2),
            "total_unrealized_profit": round(unrealized, 2),
            "position_count": len(positions),
            "margin_used_pct": margin_pct,
        },
        "positions": positions if positions else None,
        "candidate_coins": CANDIDATE_COINS,
        "decisions": decisions,
        "execution_log": exec_log,
        "success": True,
        "error_message": "",
        "ai_request_duration_ms": ai_duration,
    }


def main():
    random.seed(42)

    # Build timestamps
    timestamps = []
    t = START
    while t <= END:
        timestamps.append(t)
        t += INTERVAL
    n = len(timestamps)
    print(f"Generating {n} data points per trader ({n * 4} total files)")

    # Generate equity curves
    curves = {
        "grok4": generate_equity_curve_v2(n, "star"),
        "gpt5": generate_equity_curve_v2(n, "conservative"),
        "gemini": generate_equity_curve_v2(n, "volatile"),
        "deepseek": generate_equity_curve_v2(n, "underperformer"),
    }

    labels = {"grok4": "Grok-4 (star)", "gpt5": "GPT-5 (conservative)", "gemini": "Gemini (volatile)", "deepseek": "DeepSeek (underperformer)"}
    for name, curve in curves.items():
        print(f"  {labels[name]}: ${curve[0]:,.2f} → ${curve[-1]:,.2f} ({(curve[-1]/curve[0]-1)*100:+.1f}%)")
        print(f"    Min: ${min(curve):,.2f}, Max: ${max(curve):,.2f}")

    # Generate files
    for trader_key, trader_dir in TRADERS.items():
        full_dir = os.path.join(BASE_DIR, trader_dir)

        # Clear existing
        if os.path.exists(full_dir):
            existing = [f for f in os.listdir(full_dir) if f.endswith('.json')]
            for f in existing:
                os.remove(os.path.join(full_dir, f))
            print(f"\nCleared {len(existing)} existing files from {trader_dir}")
        else:
            os.makedirs(full_dir, exist_ok=True)
            print(f"\nCreated {trader_dir}")

        balances = curves[trader_key]
        count = 0

        for i, ts in enumerate(timestamps):
            balance = balances[i]
            coin_prices = simulate_coin_prices(i, n)
            positions = generate_positions(trader_key, balance, i, n, coin_prices)
            cycle_num = i + 1

            record = create_record(ts, cycle_num, trader_key, balance, positions, coin_prices)

            fname = f"decision_{ts.strftime('%Y%m%d_%H%M%S')}_cycle{cycle_num}.json"
            with open(os.path.join(full_dir, fname), 'w') as f:
                json.dump(record, f, indent=2, ensure_ascii=False)
            count += 1

        print(f"  Wrote {count} files for {labels[trader_key]}")

    print(f"\n✅ Done! Generated {n * 4} total decision log files across 4 traders")


if __name__ == "__main__":
    main()
