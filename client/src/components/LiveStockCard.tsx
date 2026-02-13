import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertCircle, ChevronRight, RefreshCw, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cleanCompanyName } from "@/lib/stockUtils";

interface LiveStockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isMarketOpen: boolean;
  lastUpdated: string;
  lastUpdatedFormatted?: string;
  isStale: boolean;
  isKorean?: boolean;
  currency?: string;
}

interface LiveStockResponse {
  quotes: LiveStockQuote[];
  dinoMessage: string | null;
  isMarketOpen: boolean;
  fetchedAtFormatted?: string;
  source?: string;
}

interface LiveStockCardProps {
  symbols: string[];
  showDinoMessage?: boolean;
  clickable?: boolean;
}

// Client-side fallback stock prices when API completely fails
const clientFallbackPrices: Record<string, { price: number; name: string }> = {
  "SPY": { price: 580.50, name: "SPDR S&P 500 ETF" },
  "QQQ": { price: 495.25, name: "Invesco QQQ Trust" },
  "DIA": { price: 425.75, name: "SPDR Dow Jones ETF" },
  "AAPL": { price: 195.50, name: "Apple Inc." },
  "MSFT": { price: 425.00, name: "Microsoft Corporation" },
  "GOOGL": { price: 175.25, name: "Alphabet Inc." },
  "AMZN": { price: 195.75, name: "Amazon.com Inc." },
  "NVDA": { price: 875.50, name: "NVIDIA Corporation" },
  "TSLA": { price: 245.00, name: "Tesla Inc." },
  "META": { price: 525.25, name: "Meta Platforms Inc." },
};

export function LiveStockCard({ symbols, showDinoMessage = true, clickable = true }: LiveStockCardProps) {
  const [, navigate] = useLocation();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  const { formatPrice, isKoreanStock } = useCurrency();
  
  const { data, isLoading, error, refetch, isRefetching } = useQuery<LiveStockResponse>({
    queryKey: ["/api/stocks/live", symbols.join(",")],
    queryFn: async () => {
      console.log("[Stock Debug] Fetching quotes for:", symbols.join(", "));
      try {
        const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("[Stock Debug] API error:", res.status, errData);
          throw new Error(errData.dinoMessage || "Failed to fetch quotes");
        }
        const result = await res.json();
        console.log("[Stock Debug] Data fetched:", JSON.stringify(result));
        return result;
      } catch (err) {
        console.error("[Stock Debug] Fetch failed:", err);
        throw err;
      }
    },
    staleTime: 1000 * 30, // 30 seconds - data considered fresh for 30s
    refetchInterval: 1000 * 60, // Refetch every 1 minute for fresh data
    gcTime: 1000 * 60, // Cache expires after 1 minute (was cacheTime in v4)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  // Generate client-side fallback quotes
  const clientFallbackQuotes: LiveStockQuote[] = symbols.map(symbol => {
    const fallback = clientFallbackPrices[symbol.toUpperCase()] || { price: 100.00, name: symbol };
    return {
      symbol: symbol.toUpperCase(),
      name: fallback.name,
      price: fallback.price,
      change: 0,
      changePercent: 0,
      isMarketOpen: false,
      lastUpdated: new Date().toISOString(),
      isStale: true,
    };
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {symbols.map((s) => (
          <div key={s} className="flex items-center justify-between">
            <div>
              <div className="h-4 bg-muted rounded w-12 mb-1" />
              <div className="h-3 bg-muted rounded w-24" />
            </div>
            <div className="text-right">
              <div className="h-4 bg-muted rounded w-16 mb-1" />
              <div className="h-3 bg-muted rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Don't show full loading screen during refetch - keep showing data with a subtle indicator

  // Always show stock data - use API data if available, otherwise client fallback
  // This ensures stock section is NEVER blank
  const hasValidData = data?.quotes && data.quotes.length > 0 && data.quotes.some(q => q.price > 0);
  const quotes = hasValidData ? data.quotes : clientFallbackQuotes;
  const showFallbackBanner = error || !hasValidData;

  return (
    <div className="space-y-2">
      {showFallbackBanner && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 pb-2 border-b border-border">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {t.showing_recent_prices}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-6 px-2 gap-1"
            data-testid="button-retry-stocks"
          >
            <RefreshCw className="w-3 h-3" />
            {t.retry}
          </Button>
        </div>
      )}
      
      {quotes.map((quote) => (
        <div 
          key={quote.symbol} 
          className={cn(
            "flex items-center justify-between p-2 rounded-lg transition-colors",
            clickable && "cursor-pointer hover-elevate"
          )}
          onClick={clickable ? () => navigate(`/stock/${quote.symbol}`) : undefined}
          data-testid={`stock-${quote.symbol}`}
        >
          <div className="flex items-center gap-3">
            <div>
              <h4 className="font-bold">{cleanCompanyName(quote.name || quote.symbol)}</h4>
              <p className="text-xs text-muted-foreground">{quote.symbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="font-mono font-medium">
                {quote.price > 0 
                  ? formatPrice(quote.price, { nativeCurrency: (quote.isKorean || isKoreanStock(quote.symbol)) ? 'KRW' : 'USD' })
                  : "--"}
                {quote.isStale && <span className="text-xs text-muted-foreground ml-1">*</span>}
              </div>
              <div className={cn(
                "text-xs font-bold",
                quote.changePercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
              </div>
            </div>
            {clickable && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      ))}
      
      {/* Market status and last updated info */}
      <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground" data-testid="stock-status-bar">
        <div className="flex items-center gap-1" data-testid="market-status">
          {data?.isMarketOpen ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
              <span>{t.market_open}</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
              <span>{t.market_closed}</span>
            </>
          )}
        </div>
        {data?.fetchedAtFormatted && (
          <span data-testid="last-updated">{t.last_updated}: {data.fetchedAtFormatted}</span>
        )}
      </div>
      
      {/* Dino message for market closed or other info - always show when market closed */}
      {showDinoMessage && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground italic text-center" data-testid="dino-market-message">
            {data?.isMarketOpen === false 
              ? t.dino_market_closed_message 
              : (showFallbackBanner ? null : data?.dinoMessage)}
          </p>
        </div>
      )}
    </div>
  );
}
