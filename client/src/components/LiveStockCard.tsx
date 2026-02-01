import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertCircle, ChevronRight, RefreshCw, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";

interface LiveStockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isMarketOpen: boolean;
  lastUpdated: string;
  isStale: boolean;
}

interface LiveStockResponse {
  quotes: LiveStockQuote[];
  dinoMessage: string | null;
  isMarketOpen: boolean;
}

interface LiveStockCardProps {
  symbols: string[];
  showDinoMessage?: boolean;
  clickable?: boolean;
}

export function LiveStockCard({ symbols, showDinoMessage = true, clickable = true }: LiveStockCardProps) {
  const [, navigate] = useLocation();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  
  const { data, isLoading, error, refetch, isRefetching } = useQuery<LiveStockResponse>({
    queryKey: ["/api/stocks/live", symbols.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.dinoMessage || "Failed to fetch quotes");
      }
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
    retry: 2,
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

  if (isRefetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">{t.loading_stock_data}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <AlertCircle className="w-6 h-6 text-destructive/60" />
        </div>
        <p className="text-sm text-muted-foreground italic">
          {t.dino_stock_error}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
          data-testid="button-retry-stocks"
        >
          <RefreshCw className="w-4 h-4" />
          {t.retry}
        </Button>
      </div>
    );
  }

  const quotes = data?.quotes || [];

  return (
    <div className="space-y-2">
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
              <h4 className="font-bold">{quote.symbol}</h4>
              <p className="text-xs text-muted-foreground">{quote.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="font-mono font-medium">
                {quote.price > 0 ? `$${quote.price.toFixed(2)}` : "--"}
                {quote.isStale && <span className="text-xs text-muted-foreground ml-1">*</span>}
              </div>
              <div className={cn(
                "text-xs font-bold",
                quote.changePercent >= 0 ? "text-primary" : "text-destructive"
              )}>
                {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
              </div>
            </div>
            {clickable && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      ))}
      
      {showDinoMessage && data?.dinoMessage && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground italic text-center">
            {data.dinoMessage}
          </p>
        </div>
      )}
    </div>
  );
}
