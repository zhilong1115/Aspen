import { Strategy, PortfolioDataPoint } from './types';

export const RH_GREEN = '#00C805';
export const RH_RED = '#FF5000';
export const RH_BLACK = '#000000';
export const RH_GRAY = '#1F1F1F';

const generateChartData = (points: number, startValue: number, volatility: number): PortfolioDataPoint[] => {
  let currentValue = startValue;
  const data: PortfolioDataPoint[] = [];
  const now = new Date();
  
  for (let i = 0; i < points; i++) {
    const time = new Date(now.getTime() - (points - i) * 3600 * 1000).toISOString();
    const change = (Math.random() - 0.48) * volatility;
    currentValue = currentValue * (1 + change);
    data.push({ time, value: currentValue });
  }
  return data;
};

export const MOCK_PORTFOLIO_DATA: Record<string, PortfolioDataPoint[]> = {
  '1D': generateChartData(24, 15000, 0.005),
  '1W': generateChartData(7, 14500, 0.02),
  '1M': generateChartData(30, 13000, 0.03),
  '3M': generateChartData(90, 10000, 0.04),
  '1Y': generateChartData(12, 8000, 0.1),
};

export const MOCK_STRATEGIES: Strategy[] = [
  {
    id: '1',
    name: 'BTC Momentum Alpha',
    description: 'Captures short-term volatility in Bitcoin using RSI and MACD crossovers.',
    type: 'Trend',
    status: 'Running',
    totalPnl: 3420.50,
    returnPercentage: 12.4,
    winRate: 68,
    maxDrawdown: 4.2,
    riskLevel: 'Medium',
    trades: [
      { id: 't1', asset: 'BTC/USDT', side: 'SELL', size: 0.5, price: 64200, pnl: 450, timestamp: '2023-10-24 14:30' },
      { id: 't2', asset: 'BTC/USDT', side: 'BUY', size: 0.5, price: 63300, pnl: 0, timestamp: '2023-10-24 10:00' },
    ],
    chartData: generateChartData(20, 1000, 0.02),
  },
  {
    id: '2',
    name: 'ETH Mean Reversion',
    description: 'Buys oversold conditions on the 15m timeframe.',
    type: 'Mean Reversion',
    status: 'Paused',
    totalPnl: -150.20,
    returnPercentage: -1.5,
    winRate: 45,
    maxDrawdown: 8.5,
    riskLevel: 'High',
    trades: [
      { id: 't4', asset: 'ETH/USDT', side: 'SELL', size: 4.0, price: 3200, pnl: -150, timestamp: '2023-10-22 16:45' },
    ],
    chartData: generateChartData(20, 5000, 0.03),
  }
];

export const COMMUNITY_STRATEGIES: (Strategy & { creator: string; followers: number })[] = [
  {
    id: 'c1',
    creator: '@QuantWhale',
    followers: 1240,
    name: 'Solana Speedster',
    description: 'High-frequency SOL arbitrage bot.',
    type: 'Arbitrage',
    status: 'Running',
    totalPnl: 12400.00,
    returnPercentage: 45.2,
    winRate: 88,
    maxDrawdown: 2.1,
    riskLevel: 'Medium',
    trades: [],
    chartData: generateChartData(20, 10000, 0.05),
  },
  {
    id: 'c2',
    creator: '@AlphaSeeker',
    followers: 850,
    name: 'Sentiment Divergence',
    description: 'Trading based on Twitter sentiment analysis.',
    type: 'ML-Sentiment',
    status: 'Running',
    totalPnl: 5600.00,
    returnPercentage: 18.7,
    winRate: 54,
    maxDrawdown: 12.0,
    riskLevel: 'High',
    trades: [],
    chartData: generateChartData(20, 5000, 0.04),
  },
  {
    id: 'c3',
    creator: '@StableKing',
    followers: 3200,
    name: 'USDC Yield Farmer',
    description: 'Low risk yield optimization across DeFi protocols.',
    type: 'Arbitrage',
    status: 'Running',
    totalPnl: 2100.00,
    returnPercentage: 8.4,
    winRate: 99,
    maxDrawdown: 0.1,
    riskLevel: 'Low',
    trades: [],
    chartData: generateChartData(20, 25000, 0.001),
  }
];