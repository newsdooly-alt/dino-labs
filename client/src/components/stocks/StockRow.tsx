import { type Stock } from "@shared/schema";
import { ArrowUpRight, ArrowDownRight, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRemoveFromWatchlist, useAddToWatchlist } from "@/hooks/use-watchlist";

interface StockRowProps {
  stock: Stock;
  isWatchlist?: boolean;
}

export function StockRow({ stock, isWatchlist = false }: StockRowProps) {
  const removeMutation = useRemoveFromWatchlist();
  const addMutation = useAddToWatchlist();
  
  const change = parseFloat(stock.changePercent || "0");
  const isPositive = change >= 0;
  
  return (
    <div className="group flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all hover:bg-card/80 mb-3 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center border border-border font-mono font-bold text-lg shadow-inner">
          {stock.symbol.substring(0, 2)}
        </div>
        <div>
          <h4 className="font-bold text-lg font-display">{stock.symbol}</h4>
          <p className="text-sm text-muted-foreground truncate max-w-[150px] md:max-w-xs">{stock.name}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-right">
           <div className="font-mono font-bold text-lg">${parseFloat(stock.lastPrice || "0").toFixed(2)}</div>
           <div className={cn(
             "flex items-center justify-end gap-1 text-sm font-bold",
             isPositive ? "text-primary" : "text-destructive"
           )}>
             {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
             {change.toFixed(2)}%
           </div>
        </div>
        
        {isWatchlist ? (
          <button 
            onClick={() => removeMutation.mutate(stock.symbol)}
            disabled={removeMutation.isPending}
            className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
            title="Remove from watchlist"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => addMutation.mutate(stock.symbol)}
            disabled={addMutation.isPending}
            className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all"
            title="Add to watchlist"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
