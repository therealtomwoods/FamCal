import React from 'react';
import { StockItem } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StockTickerWidgetProps {
  stocks: StockItem[];
}

export const StockTickerWidget: React.FC<StockTickerWidgetProps> = ({ stocks }) => {
  if (!stocks || stocks.length === 0) return null;

  return (
    <div className="w-full overflow-hidden bg-slate-950/80 backdrop-blur-md border-y border-white/5 py-1 px-2 select-none">
      <div className="flex items-center gap-5 overflow-x-auto no-scrollbar scroll-smooth">
        {stocks.map((stock) => {
          const isPositive = stock.change >= 0;
          return (
            <div
              key={stock.symbol}
              className="flex items-center gap-1.5 flex-shrink-0 text-xs font-medium"
            >
              <span className="font-bold text-slate-200">{stock.symbol}</span>
              <span className="text-slate-300">${stock.price.toFixed(2)}</span>
              <span
                className={`inline-flex items-center text-[10px] font-semibold px-1 rounded ${
                  isPositive
                    ? 'text-emerald-400 bg-emerald-950/50'
                    : 'text-rose-400 bg-rose-950/50'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                )}
                {isPositive ? '+' : ''}
                {stock.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
