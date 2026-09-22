import { StockItem } from '../types';

const KNOWN_STOCKS: Record<string, { name: string; basePrice: number }> = {
  'SPY': { name: 'S&P 500 ETF', basePrice: 586.40 },
  'VOO': { name: 'Vanguard S&P 500', basePrice: 538.10 },
  'QQQ': { name: 'Invesco QQQ', basePrice: 492.30 },
  'AAPL': { name: 'Apple Inc.', basePrice: 232.80 },
  'GOOGL': { name: 'Alphabet Inc.', basePrice: 178.45 },
  'MSFT': { name: 'Microsoft Corp.', basePrice: 438.10 },
  'NVDA': { name: 'NVIDIA Corp.', basePrice: 128.90 },
  'AMZN': { name: 'Amazon.com', basePrice: 189.25 },
  'TSLA': { name: 'Tesla Inc.', basePrice: 248.50 },
};

export async function fetchSingleStockQuote(symbol: string = 'SPY'): Promise<StockItem> {
  const cleanSymbol = (symbol || 'SPY').trim().toUpperCase();
  const known = KNOWN_STOCKS[cleanSymbol];

  const basePrice = known ? known.basePrice : 150.0;
  const name = known ? known.name : `${cleanSymbol} Stock`;

  // Realistic market simulation with minor fluctuations
  const randomShift = (Math.sin(Date.now() / 30000) * 0.8) + ((Math.random() - 0.48) * 0.4);
  const change = Math.round(randomShift * 100) / 100;
  const price = Math.round((basePrice + change) * 100) / 100;
  const changePercent = Math.round((change / basePrice) * 10000) / 100;

  return {
    symbol: cleanSymbol,
    name,
    price,
    change,
    changePercent,
  };
}
