# Aspen

An agentic trading OS where AI models compete, learn, and trade autonomously across crypto exchanges.

![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)

**[Documentation](docs/README.md)** · **[Getting Started](docs/getting-started/README.md)** · **[Changelog](CHANGELOG.md)** · **[Contributing](CONTRIBUTING.md)**

---

## What is Aspen?

Aspen lets you create AI-powered traders that analyze markets, make decisions with chain-of-thought reasoning, and execute trades — all without manual intervention. Pit multiple AI models against each other and let the best strategy win.

**Core loop:** Market Data → AI Analysis → Risk Check → Trade Execution → Learn from Results → Repeat

### Key capabilities

- **Multi-agent competition** — Run Qwen vs DeepSeek (or any OpenAI-compatible model) side-by-side with independent accounts and live performance tracking
- **Self-learning** — Each agent reviews its last 20 trading cycles before deciding, learning from wins and avoiding repeated mistakes
- **Multi-exchange** — Binance Futures, Hyperliquid, and Aster DEX with unified execution
- **Built-in risk control** — Per-asset position limits, configurable leverage (1x–50x), margin caps, mandatory stop-loss/take-profit ratios
- **Full observability** — Equity curves, decision logs with complete chain-of-thought, real-time positions, and performance analytics
- **Web-first config** — Create and manage AI models, exchanges, and traders from the browser. No JSON editing required.

---

## Screenshots

### Portfolio — Live Performance Dashboard
![Portfolio Page](screenshots/competition-page.png)

### Trader Dashboard — Equity, Positions & AI Decisions
![Trader Dashboard](screenshots/details-page.png)

---

## Quick Start

### Docker (recommended)

```bash
cp config.json.example config.json    # edit with your settings
./start.sh start --build              # builds and starts everything
```

Open **http://localhost:3000**, then:
1. Add your AI model API keys (DeepSeek, Qwen, etc.)
2. Configure exchange credentials (Binance, Hyperliquid, or Aster)
3. Create a trader — pick a model + exchange combo
4. Hit Start and watch it trade

```bash
./start.sh logs       # tail logs
./start.sh status     # check health
./start.sh stop       # shut down
```

### Manual setup

**Prerequisites:** Go 1.21+, Node.js 18+, TA-Lib (`brew install ta-lib` on macOS)

```bash
# Backend
go mod download
go build -o aspen
./aspen                # API on :8081

# Frontend (new terminal)
cd web
npm install
npm run dev            # UI on :3000
```

---

## Architecture

```
aspen/
├── main.go              # Entry point, trader bootstrap
├── trader/              # Core trading engine
│   ├── auto_trader.go   # Decision loop, AI prompt construction
│   ├── hyperliquid_trader.go
│   └── paper_trader.go  # Paper trading mode
├── api/                 # REST API (Gin)
├── models/              # Data models & DB
├── web/                 # React frontend
│   ├── src/pages/       # Portfolio, Dashboard, Community, Profile
│   ├── src/components/  # Shared UI components
│   └── src/contexts/    # Auth, Theme, Language
├── config.json          # Runtime configuration
└── docs/                # Full documentation
```

| Layer | Tech |
|-------|------|
| Backend | Go, Gin, SQLite, TA-Lib |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, SWR |
| AI | DeepSeek, Qwen, any OpenAI-compatible API |
| Exchanges | Binance Futures, Hyperliquid DEX, Aster DEX |

---

## How It Works

Every 3–5 minutes, each trader runs this cycle:

1. **Review history** — Win rate, best/worst coins, recent P&L, profit factor
2. **Check account** — Equity, margin usage, open positions, unrealized P&L
3. **Analyze positions** — Multi-timeframe technicals (RSI, MACD, EMA, ATR) on current holdings
4. **Scan opportunities** — Filter candidate coins by liquidity, calculate indicators
5. **AI decides** — Full chain-of-thought reasoning → structured output (open/close, size, leverage, SL/TP)
6. **Execute** — Close first, then open. Precision-adjusted per exchange. Risk limits enforced.
7. **Record** — Full decision log saved. Performance metrics updated. Feeds into next cycle.

---

## API

### Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/PUT` | `/api/models` | AI model config |
| `GET/PUT` | `/api/exchanges` | Exchange config |

### Traders
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/traders` | List all traders |
| `POST` | `/api/traders` | Create trader |
| `DELETE` | `/api/traders/:id` | Delete trader |
| `POST` | `/api/traders/:id/start` | Start trader |
| `POST` | `/api/traders/:id/stop` | Stop trader |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status?trader_id=` | System status |
| `GET` | `/api/account?trader_id=` | Account info |
| `GET` | `/api/positions?trader_id=` | Open positions |
| `GET` | `/api/equity-history?trader_id=` | Equity curve data |
| `GET` | `/api/decisions/latest?trader_id=` | Recent AI decisions |
| `GET` | `/api/performance?trader_id=` | Performance analytics |
| `GET` | `/api/health` | Health check |

---

## Exchanges

### Binance Futures
Standard API key + secret. Supports subaccounts (≤5x leverage) and main accounts (up to 50x).

### Hyperliquid
Decentralized perps. Uses your Ethereum private key — no API key needed. Supports mainnet and testnet.

### Aster DEX
Binance-compatible API with a separate API wallet for security. Lower fees, no KYC, multi-chain.

---

## Admin Mode

For self-hosted setups, enable `admin_mode` in config to require JWT auth on all endpoints:

```json
{
  "admin_mode": true,
  "jwt_secret": "your-secret"
}
```

Set `Aspen_ADMIN_PASSWORD` as an env var. The UI redirects to a login page when admin mode is active.

---

## Risk Warnings

⚠️ **This is experimental software.** AI trading carries real financial risk.

- Crypto markets are volatile. Futures use leverage. Losses can exceed your deposit.
- AI decisions are not guaranteed to be profitable.
- Start small (100–500 USDT). Monitor actively. Never trade with money you can't lose.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. In short:

1. Fork → branch → commit → PR
2. Follow existing code conventions
3. Security issues → [SECURITY.md](SECURITY.md)

---

## License

[AGPL-3.0](LICENSE) — Free to use and modify. Derivatives must also be open source. Network use counts as distribution.
