// Stock Service - Fetches data from Python yfinance service
// No API key required - uses yfinance library

const PYTHON_SERVICE_URL = 'http://localhost:5001';

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  volume?: number;
  isMarketOpen: boolean;
  lastUpdated: string;
  isStale: boolean;
}

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
}

interface HistoryDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Node-layer in-memory TTL cache ───────────────────────────────────────────
interface CacheEntry<T> { data: T; ts: number; }

const _quoteCache  = new Map<string, CacheEntry<StockQuote>>();
const _newsCache   = { data: null as any, ts: 0 };
const _stockNewsCache = new Map<string, CacheEntry<any>>();
const _historyCache = new Map<string, CacheEntry<HistoryDataPoint[]>>();
const _infoCache   = new Map<string, CacheEntry<any>>();

const QUOTE_TTL   = 60_000;    // 60 s  – live prices
const NEWS_TTL    = 600_000;   // 10 min – market news
const HISTORY_TTL    = 900_000;   // 15 min – chart data (non-intraday)
const HISTORY_TTL_1D = 120_000;   //  2 min – 1D intraday chart (live market)
const INFO_TTL    = 1_800_000; // 30 min – fundamentals

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string, ttl: number): T | null {
  const entry = map.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return null;
}
function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, data: T) {
  map.set(key, { data, ts: Date.now() });
}

// ─── Python service ────────────────────────────────────────────────────────────
async function checkPythonService(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, { 
      signal: AbortSignal.timeout(2000) 
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Get a single stock quote
export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const upperSymbol = symbol.toUpperCase();

  const cached = cacheGet(_quoteCache, upperSymbol, QUOTE_TTL);
  if (cached) return cached;
  
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/quote/${upperSymbol}`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch quote');
    }
    
    const data = await response.json();
    
    const result: StockQuote = {
      symbol: data.symbol,
      name: data.name || upperSymbol,
      price: data.price || 0,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      isMarketOpen: data.isMarketOpen || false,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      isStale: data.price === 0,
    };
    cacheSet(_quoteCache, upperSymbol, result);
    return result;
  } catch (error: any) {
    console.error(`[yfinance] Error fetching quote for ${upperSymbol}:`, error.message);
    throw new Error(`FETCH_ERROR: ${error.message}`);
  }
}

// Get multiple stock quotes in a batch, with per-symbol caching
export async function getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  
  const upperSymbols = symbols.map(s => s.toUpperCase());
  const startTime = Date.now();

  // Serve cached symbols immediately, only fetch the rest
  const fresh: StockQuote[] = [];
  const needed: string[] = [];

  for (const sym of upperSymbols) {
    const cached = cacheGet(_quoteCache, sym, QUOTE_TTL);
    if (cached) {
      fresh.push(cached);
    } else {
      needed.push(sym);
    }
  }

  if (needed.length === 0) {
    console.log(`[yfinance] All ${upperSymbols.length} quotes served from cache`);
    // Return in original order
    return upperSymbols.map(s => fresh.find(q => q.symbol === s)!).filter(Boolean);
  }

  try {
    console.log(`[yfinance] Fetching ${needed.length}/${upperSymbols.length} quotes (rest from cache)`);
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/quotes?symbols=${needed.join(',')}`,
      { signal: AbortSignal.timeout(25000) }
    );
    
    const elapsed = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[yfinance] Batch quotes API error (${response.status}):`, error);
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const quotesCount = data.quotes?.length || 0;
    console.log(`[yfinance] Batch quotes success: ${quotesCount} new quotes in ${elapsed}ms`);
    
    const fetched: StockQuote[] = (data.quotes || []).map((q: any) => {
      const result: StockQuote = {
        symbol: q.symbol,
        name: q.name || q.symbol,
        price: q.price || 0,
        change: q.change || 0,
        changePercent: q.changePercent || 0,
        previousClose: q.previousClose || 0,
        volume: q.volume || 0,
        isMarketOpen: q.isMarketOpen || false,
        lastUpdated: q.lastUpdated || new Date().toISOString(),
        isStale: q.isStale || q.price === 0,
      };
      cacheSet(_quoteCache, q.symbol, result);
      return result;
    });

    // Merge and return in original order
    const allQuotes = [...fresh, ...fetched];
    return upperSymbols.map(s => allQuotes.find(q => q.symbol === s)!).filter(Boolean);
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error(`[yfinance] Batch quotes timed out after ${elapsed}ms`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error("[yfinance] Connection refused for batch quotes");
    } else {
      console.error(`[yfinance] Batch quotes error after ${elapsed}ms:`, error.message);
    }
    
    // Return cached + empty stubs for uncacheable
    const allQuotes = [
      ...fresh,
      ...needed.map(symbol => ({
        symbol,
        name: symbol,
        price: 0,
        change: 0,
        changePercent: 0,
        isMarketOpen: false,
        lastUpdated: new Date().toISOString(),
        isStale: true,
      })),
    ];
    return upperSymbols.map(s => allQuotes.find(q => q.symbol === s)!).filter(Boolean);
  }
}

// Search for stocks by symbol or name
export async function searchStocks(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 1) return [];
  
  try {
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/search?q=${encodeURIComponent(query.trim())}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Search failed');
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error: any) {
    console.error(`[yfinance] Search error:`, error.message);
    throw new Error(`SEARCH_ERROR: ${error.message}`);
  }
}

// Get historical data for charts
export async function getStockHistory(
  symbol: string, 
  period: string = '1mo', 
  interval: string = '1d',
  start?: string,
  end?: string,
): Promise<HistoryDataPoint[]> {
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `${upperSymbol}|${period}|${interval}|${start || ''}|${end || ''}`;

  // Use shorter TTL for 1D intraday so new candles appear quickly during trading hours
  const is1DIntraday = (period === '1d' && ['1m','2m','5m','10m','15m','30m'].includes(interval));
  const ttl = is1DIntraday ? HISTORY_TTL_1D : HISTORY_TTL;
  const cached = cacheGet(_historyCache, cacheKey, ttl);
  if (cached) {
    console.log(`[yfinance] History cache hit: ${cacheKey}`);
    return cached;
  }
  
  try {
    let url = `${PYTHON_SERVICE_URL}/history/${upperSymbol}?interval=${interval}`;
    if (start) {
      url += `&start=${start}`;
      if (end) url += `&end=${end}`;
    } else {
      url += `&period=${period}`;
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch history');
    }
    
    const data = await response.json();
    const result = data.data || [];
    cacheSet(_historyCache, cacheKey, result);
    return result;
  } catch (error: any) {
    console.error(`[yfinance] History error for ${upperSymbol}:`, error.message);
    throw new Error(`HISTORY_ERROR: ${error.message}`);
  }
}

// Get detailed stock info
export async function getStockInfo(symbol: string): Promise<any> {
  const upperSymbol = symbol.toUpperCase();

  const cached = cacheGet(_infoCache, upperSymbol, INFO_TTL);
  if (cached) return cached;
  
  try {
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/info/${upperSymbol}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch info');
    }
    
    const result = await response.json();
    cacheSet(_infoCache, upperSymbol, result);
    return result;
  } catch (error: any) {
    console.error(`[yfinance] Info error for ${upperSymbol}:`, error.message);
    throw new Error(`INFO_ERROR: ${error.message}`);
  }
}

// Get a random quiz question based on real-time data
export async function getStockFundamentals(symbol: string): Promise<{
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  peRatio: number | null;
  forwardPE: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  eps: number | null;
  beta: number | null;
  sector: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
} | null> {
  try {
    const [quoteRes, infoRes] = await Promise.all([
      fetch(`${PYTHON_SERVICE_URL}/quote/${symbol}`, { signal: AbortSignal.timeout(8000) }),
      fetch(`${PYTHON_SERVICE_URL}/info/${symbol}`, { signal: AbortSignal.timeout(8000) }),
    ]);
    
    if (!quoteRes.ok || !infoRes.ok) return null;
    
    const quote = await quoteRes.json();
    const info = await infoRes.json();
    
    return {
      symbol: symbol.toUpperCase(),
      name: quote.name || info.name || symbol,
      price: quote.price || 0,
      changePercent: quote.changePercent || 0,
      peRatio: info.peRatio || null,
      forwardPE: info.forwardPE || null,
      dividendYield: info.dividendYield || null,
      marketCap: info.marketCap || null,
      eps: info.eps || null,
      beta: info.beta || null,
      sector: info.sector || null,
      fiftyTwoWeekHigh: info["52WeekHigh"] || null,
      fiftyTwoWeekLow: info["52WeekLow"] || null,
    };
  } catch {
    return null;
  }
}

// Get market news
export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  relatedSymbol: string;
  thumbnail: string | null;
  koreanSummary?: string;
}

export async function getMarketNews(): Promise<NewsItem[]> {
  const startTime = Date.now();

  // Serve from cache if fresh
  if (_newsCache.data && Date.now() - _newsCache.ts < NEWS_TTL) {
    console.log('[yfinance] News served from cache');
    return _newsCache.data;
  }
  
  try {
    console.log("[yfinance] Fetching news from Python service...");
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/news`,
      { signal: AbortSignal.timeout(20000) }
    );
    
    const elapsed = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[yfinance] News API returned error status ${response.status}:`, error);
      throw new Error(error.error || `HTTP ${response.status}: Failed to fetch news`);
    }
    
    const data = await response.json();
    const newsCount = data.news?.length || 0;
    console.log(`[yfinance] News fetch successful: ${newsCount} items in ${elapsed}ms`);
    
    const result = data.news || [];
    _newsCache.data = result;
    _newsCache.ts = Date.now();
    return result;
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error(`[yfinance] News fetch timed out after ${elapsed}ms`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error("[yfinance] Connection refused - Python service not running");
    } else {
      console.error(`[yfinance] News error after ${elapsed}ms:`, error.message || error);
    }
    
    return [];
  }
}

// Get news for a specific stock
export async function getStockNews(symbol: string): Promise<NewsItem[]> {
  const upperSymbol = symbol.toUpperCase();

  const cached = cacheGet(_stockNewsCache, upperSymbol, NEWS_TTL);
  if (cached) return cached;
  
  try {
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/news/${upperSymbol}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.news || [];
    cacheSet(_stockNewsCache, upperSymbol, result);
    return result;
  } catch (error: any) {
    console.error(`[yfinance] Stock news error for ${upperSymbol}:`, error.message);
    return [];
  }
}

// Export service status check
export { checkPythonService };
