import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

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
}

export function LiveStockCard({ symbols, showDinoMessage = true }: LiveStockCardProps) {
  const { data, isLoading, error } = useQuery<LiveStockResponse>({
    queryKey: ["/api/stocks/live", symbols.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.dinoMessage || "Failed to fetch quotes");
      }
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
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

  if (error) {
    const errorMsg = (error as Error).message;
    let dinoMessage = "Dino is having trouble fetching stock data. Please try again later!";
    if (errorMsg.includes("Rate limit") || errorMsg.includes("rate limit")) {
      dinoMessage = "Dino is tired from all the searching! The free API limit (25/day) has been reached. Try again tomorrow!";
    } else if (errorMsg.includes("API key") || errorMsg.includes("not configured")) {
      dinoMessage = "Dino needs an API key! Please add ALPHA_VANTAGE_API_KEY to Replit Secrets.";
    }
    
    return (
      <div className="text-center py-4 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-primary/60" />
        <p className="text-sm italic">{dinoMessage}</p>
      </div>
    );
  }

  const quotes = data?.quotes || [];

  return (
    <div className="space-y-4">
      {quotes.map((quote) => (
        <div key={quote.symbol} className="flex items-center justify-between" data-testid={`stock-${quote.symbol}`}>
          <div>
            <h4 className="font-bold">{quote.symbol}</h4>
            <p className="text-xs text-muted-foreground">{quote.name}</p>
          </div>
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
