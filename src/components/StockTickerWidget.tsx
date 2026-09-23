import React from 'react';
import { StockItem } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StockTickerWidgetProps {
  stock: StockItem | null;
}

export const StockTickerWidget: React.FC<StockTickerWidgetProps> = ({ stock }) => {
  if (!stock) return null;

  const isPositive = stock.change >= 0;

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-white select-none flex-shrink-0 shadow-md">
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs sm:text-sm font-black tracking-wider text-blue-300">
            {stock.symbol}
          </span>
          <span className="text-xl sm:text-2xl font-black tracking-tight leading-none text-white">
            ${stock.price.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span
            className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded ${
              isPositive
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30'
                : 'text-rose-400 bg-rose-950/60 border border-rose-500/30'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {isPositive ? '+' : ''}
            {stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
};
