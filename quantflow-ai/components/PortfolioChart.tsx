import React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { PortfolioDataPoint } from '../types';
import { RH_GREEN, RH_RED } from '../constants';

interface PortfolioChartProps {
  data: PortfolioDataPoint[];
  isPositive?: boolean;
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ data, isPositive = true }) => {
  const color = isPositive ? RH_GREEN : RH_RED;

  return (
    <div className="h-64 w-full cursor-crosshair">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.1} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F1F1F', border: 'none', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
            labelStyle={{ display: 'none' }}
            cursor={{ stroke: '#555', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PortfolioChart;