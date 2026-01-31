// Alpha Vantage Stock Service with caching and error handling

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

interface CachedQuote {
  data: StockQuote;
  timestamp: number;
}

// In-memory cache for stock quotes (1 minute TTL during market hours, 30 min otherwise)
const quoteCache: Map<string, CachedQuote> = new Map();
const CACHE_TTL_MARKET_OPEN = 60 * 1000; // 1 minute
const CACHE_TTL_MARKET_CLOSED = 30 * 60 * 1000; // 30 minutes

// Stock name mapping for common stocks
const stockNames: Record<string, string> = {
  'NVDA': 'NVIDIA Corporation',
  'AAPL': 'Apple Inc.',
  'TSLA': 'Tesla, Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc.',
  'AMZN': 'Amazon.com Inc.',
  'META': 'Meta Platforms Inc.',
  'SPY': 'S&P 500 ETF',
  'QQQ': 'Invesco QQQ Trust',
  'DIA': 'SPDR Dow Jones ETF',
};

function isMarketOpen(): boolean {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay();
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();
  
  // Weekend check
  if (day === 0 || day === 6) return false;
  
  // Market hours: 9:30 AM - 4:00 PM ET
  const marketOpenMinutes = 9 * 60 + 30;
  const marketCloseMinutes = 16 * 60;
  const currentMinutes = hour * 60 + minute;
  
  return currentMinutes >= marketOpenMinutes && currentMinutes < marketCloseMinutes;
}

function getCacheTTL(): number {
  return isMarketOpen() ? CACHE_TTL_MARKET_OPEN : CACHE_TTL_MARKET_CLOSED;
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const upperSymbol = symbol.toUpperCase();
  
  // Check cache first
  const cached = quoteCache.get(upperSymbol);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < getCacheTTL()) {
    return { ...cached.data, isStale: false };
  }
  
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  if (!apiKey) {
    // Return cached data if available, otherwise throw
    if (cached) {
      return { ...cached.data, isStale: true };
    }
    throw new Error('API_KEY_MISSING');
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${upperSymbol}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Check for API rate limit or errors
    if (data.Note || data.Information) {
      console.warn('Alpha Vantage rate limit:', data.Note || data.Information);
      if (cached) {
        return { ...cached.data, isStale: true };
      }
      throw new Error('RATE_LIMIT');
    }
    
    if (!data['Global Quote'] || !data['Global Quote']['05. price']) {
      if (cached) {
        return { ...cached.data, isStale: true };
      }
      throw new Error('INVALID_SYMBOL');
    }
    
    const quote = data['Global Quote'];
    const price = parseFloat(quote['05. price']);
    const change = parseFloat(quote['09. change']);
    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
    
    const stockQuote: StockQuote = {
      symbol: upperSymbol,
      name: stockNames[upperSymbol] || upperSymbol,
      price,
      change,
      changePercent,
      isMarketOpen: isMarketOpen(),
      lastUpdated: new Date().toISOString(),
      isStale: false,
    };
    
    // Update cache
    quoteCache.set(upperSymbol, { data: stockQuote, timestamp: now });
    
    return stockQuote;
  } catch (error: any) {
    console.error(`Error fetching quote for ${upperSymbol}:`, error);
    
    // Return stale cached data if available
    if (cached) {
      return { ...cached.data, isStale: true };
    }
    
    throw error;
  }
}

export async function getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
  const results: StockQuote[] = [];
  
  // Fetch sequentially with 1.2s delay to respect Alpha Vantage's rate limit (1 req/sec)
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    try {
      const quote = await getStockQuote(symbol);
      results.push(quote);
      // Wait 1.2 seconds between calls to stay under rate limit
      if (i < symbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } catch (error) {
      console.error(`Failed to fetch ${symbol}:`, error);
      // Push a placeholder with error state
      results.push({
        symbol: symbol.toUpperCase(),
        name: stockNames[symbol.toUpperCase()] || symbol,
        price: 0,
        change: 0,
        changePercent: 0,
        isMarketOpen: isMarketOpen(),
        lastUpdated: new Date().toISOString(),
        isStale: true,
      });
    }
  }
  
  return results;
}

// Search for stocks using Alpha Vantage SYMBOL_SEARCH API
interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  matchScore: number;
}

// Cache for search results (5 minute TTL)
const searchCache: Map<string, { results: SearchResult[]; timestamp: number }> = new Map();
const SEARCH_CACHE_TTL = 5 * 60 * 1000;

export async function searchStocks(keywords: string): Promise<SearchResult[]> {
  const query = keywords.trim().toUpperCase();
  if (!query || query.length < 1) return [];
  
  // Check cache
  const cached = searchCache.get(query);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.results;
  }
  
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.Note || data.Information) {
      console.warn('Alpha Vantage rate limit:', data.Note || data.Information);
      if (cached) return cached.results;
      throw new Error('RATE_LIMIT');
    }
    
    const matches = data.bestMatches || [];
    const results: SearchResult[] = matches
      .filter((m: any) => m['4. region'] === 'United States') // Only US stocks
      .map((m: any) => ({
        symbol: m['1. symbol'],
        name: m['2. name'],
        type: m['3. type'],
        region: m['4. region'],
        matchScore: parseFloat(m['9. matchScore']),
      }))
      .slice(0, 10); // Limit to 10 results
    
    // Cache results
    searchCache.set(query, { results, timestamp: Date.now() });
    
    return results;
  } catch (error) {
    console.error('Stock search error:', error);
    if (cached) return cached.results;
    throw error;
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
