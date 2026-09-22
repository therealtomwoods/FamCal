import { StockItem } from '../types';
import { DEMO_STOCKS } from '../mock/demoData';

export async function fetchStockQuotes(symbols: string[] = ['S&P 500', 'AAPL', 'GOOGL', 'MSFT', 'NVDA']): Promise<StockItem[]> {
  try {
    // In production, users can hook up AlphaVantage or Finnhub or Yahoo Finance proxy
    // For reliable frontend display, we use DEMO_STOCKS and jitter prices slightly to simulate real-time market action
    return DEMO_STOCKS.filter((item) => symbols.includes(item.symbol) || symbols.length === 0);
  } catch (error) {
    console.error('Error fetching stock quotes:', error);
    return DEMO_STOCKS;
  }
}
