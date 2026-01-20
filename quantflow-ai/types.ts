export interface Trade {
  id: string;
  asset: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  pnl: number; // Profit and Loss in USD
  timestamp: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'Trend' | 'Mean Reversion' | 'Arbitrage' | 'ML-Sentiment';
  status: 'Running' | 'Paused';
  totalPnl: number;
  returnPercentage: number;
  winRate: number;
  maxDrawdown: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  trades: Trade[];
  chartData: { time: string; value: number }[];
}

export interface PortfolioDataPoint {
  time: string;
  value: number;
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y';

export interface AIAnalysisResponse {
  summary: string;
  recommendation: string;
}