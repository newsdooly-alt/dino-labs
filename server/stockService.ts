// Stock Service - Fetches data from Python yfinance service
// No API key required - uses yfinance library

const PYTHON_SERVICE_URL = 'http://localhost:5001';

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
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

// Helper to check if Python service is running
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
  
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/quote/${upperSymbol}`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch quote');
    }
    
    const data = await response.json();
    
    return {
      symbol: data.symbol,
      name: data.name || upperSymbol,
      price: data.price || 0,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      isMarketOpen: data.isMarketOpen || false,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      isStale: data.price === 0,
    };
  } catch (error: any) {
    console.error(`[yfinance] Error fetching quote for ${upperSymbol}:`, error.message);
    throw new Error(`FETCH_ERROR: ${error.message}`);
  }
}

// Get multiple stock quotes in a batch (more efficient than individual calls)
export async function getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  
  const upperSymbols = symbols.map(s => s.toUpperCase());
  const startTime = Date.now();
  
  try {
    // Check if Python service is available first
    console.log("[yfinance] Checking Python service for batch quotes...");
    const isServiceUp = await checkPythonService();
    
    if (!isServiceUp) {
      console.error("[yfinance] Python service not responding for batch quotes");
      throw new Error("Python service unavailable");
    }
    
    console.log(`[yfinance] Fetching batch quotes for: ${upperSymbols.join(', ')}`);
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/quotes?symbols=${upperSymbols.join(',')}`,
      { signal: AbortSignal.timeout(10000) } // 10 second timeout
    );
    
    const elapsed = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[yfinance] Batch quotes API error (${response.status}):`, error);
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const quotesCount = data.quotes?.length || 0;
    console.log(`[yfinance] Batch quotes success: ${quotesCount} quotes in ${elapsed}ms`);
    
    return (data.quotes || []).map((q: any) => ({
      symbol: q.symbol,
      name: q.name || q.symbol,
      price: q.price || 0,
      change: q.change || 0,
      changePercent: q.changePercent || 0,
      isMarketOpen: q.isMarketOpen || false,
      lastUpdated: q.lastUpdated || new Date().toISOString(),
      isStale: q.isStale || q.price === 0,
    }));
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error(`[yfinance] Batch quotes timed out after ${elapsed}ms`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error("[yfinance] Connection refused for batch quotes");
    } else {
      console.error(`[yfinance] Batch quotes error after ${elapsed}ms:`, error.message);
    }
    
    // Return empty prices - server route will use fallback
    return upperSymbols.map(symbol => ({
      symbol,
      name: symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      isMarketOpen: false,
      lastUpdated: new Date().toISOString(),
      isStale: true,
    }));
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
  interval: string = '1d'
): Promise<HistoryDataPoint[]> {
  const upperSymbol = symbol.toUpperCase();
  
  try {
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/history/${upperSymbol}?period=${period}&interval=${interval}`,
      { signal: AbortSignal.timeout(15000) }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch history');
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error: any) {
    console.error(`[yfinance] History error for ${upperSymbol}:`, error.message);
    throw new Error(`HISTORY_ERROR: ${error.message}`);
  }
}

// Get detailed stock info
export async function getStockInfo(symbol: string): Promise<any> {
  const upperSymbol = symbol.toUpperCase();
  
  try {
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/info/${upperSymbol}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch info');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`[yfinance] Info error for ${upperSymbol}:`, error.message);
    throw new Error(`INFO_ERROR: ${error.message}`);
  }
}

// Get a random quiz question based on real-time data
export async function getRealTimeQuizQuestion(): Promise<{
  headline: string;
  symbol: string;
  companyName: string;
  correctAnswer: 'bullish' | 'bearish';
  explanation: string;
} | null> {
  const symbols = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  try {
    const quote = await getStockQuote(randomSymbol);
    
    if (quote.isStale || quote.price === 0) {
      return null; // Fall back to curated questions
    }
    
    const isUp = quote.changePercent >= 0;
    const changeText = isUp 
      ? `up ${quote.changePercent.toFixed(2)}%` 
      : `down ${Math.abs(quote.changePercent).toFixed(2)}%`;
    
    return {
      headline: `${quote.name} stock is ${changeText} today, trading at $${quote.price.toFixed(2)}. Is this movement good for investors?`,
      symbol: quote.symbol,
      companyName: quote.name,
      correctAnswer: isUp ? 'bullish' : 'bearish',
      explanation: isUp 
        ? `${quote.name} is up ${quote.changePercent.toFixed(2)}% today! When a stock rises, it means investors are buying and the company is doing well. That's bullish!`
        : `${quote.name} is down ${Math.abs(quote.changePercent).toFixed(2)}% today. When a stock falls, it means there's selling pressure. That's bearish, but could be a buying opportunity!`
    };
  } catch (error) {
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
  
  try {
    console.log("[yfinance] Checking Python service availability...");
    const isServiceUp = await checkPythonService();
    
    if (!isServiceUp) {
      console.error("[yfinance] Python service is not responding - news fetch aborted");
      return [];
    }
    
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
    
    if (newsCount === 0) {
      console.warn("[yfinance] News API returned empty array");
    }
    
    return data.news || [];
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
  
  try {
    const response = await fetch(
      `${PYTHON_SERVICE_URL}/news/${upperSymbol}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.news || [];
  } catch (error: any) {
    console.error(`[yfinance] Stock news error for ${upperSymbol}:`, error.message);
    return [];
  }
}

// Export service status check
export { checkPythonService };
