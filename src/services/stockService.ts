import { StockItem } from '../types';

export async function fetchSingleStockQuote(symbol: string = 'SPY'): Promise<StockItem> {
  const cleanSymbol = (symbol || 'SPY').trim().toUpperCase();

  // Try direct Yahoo Finance API first
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=1d&range=1d`;

  // Array of endpoints to try: direct, then CORS proxies
  const sources = [
    yahooUrl,
    `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
  ];

  for (const endpoint of sources) {
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) continue;

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta;
      const currentPrice = meta.regularMarketPrice ?? meta.previousClose;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;

      const change = currentPrice - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: cleanSymbol,
        name: meta.shortName || meta.symbol || cleanSymbol,
        price: Math.round(currentPrice * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
      };
    } catch {
      // Try next source
    }
  }

  // Fallback to Finnhub free public demo endpoint if Yahoo proxies fail
  try {
    const finnhubUrl = `https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=sandbox_c123`;
    const fRes = await fetch(finnhubUrl);
    if (fRes.ok) {
      const fData = await fRes.json();
      if (fData.c && fData.c > 0) {
        const cPrice = fData.c;
        const pClose = fData.pc || cPrice;
        const diff = cPrice - pClose;
        const pct = pClose ? (diff / pClose) * 100 : 0;
        return {
          symbol: cleanSymbol,
          name: cleanSymbol,
          price: Math.round(cPrice * 100) / 100,
          change: Math.round(diff * 100) / 100,
          changePercent: Math.round(pct * 100) / 100,
        };
      }
    }
  } catch {
    // continue
  }

  // Graceful fallback with clear symbol
  return {
    symbol: cleanSymbol,
    name: cleanSymbol,
    price: 0,
    change: 0,
    changePercent: 0,
  };
}
