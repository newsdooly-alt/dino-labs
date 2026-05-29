import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const INDEX_SYMBOLS = ["SPY", "QQQ", "^IXIC", "^KS11", "^N225", "GC=F", "CL=F", "BTC-USD"];
const INDEX_LABELS: Record<string, string> = {
  "SPY": "S&P500",
  "QQQ": "QQQ",
  "^IXIC": "NASDAQ",
  "^KS11": "KOSPI",
  "^N225": "NIKKEI",
  "GC=F": "GOLD",
  "CL=F": "OIL",
  "BTC-USD": "BTC",
};

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-muted-foreground/60 font-mono text-[10px]">
      {t.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} KST
    </span>
  );
}

export function IndexStrip() {
  const { data } = useQuery<any>({
    queryKey: ["/api/stocks/live", "index-strip"],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${INDEX_SYMBOLS.join(",")}`);
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const { data: mood } = useQuery<any>({
    queryKey: ["/api/market/mood"],
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const stocks = data?.stocks || {};

  return (
    <div className="hidden md:flex h-7 items-center px-2 gap-0 border-b border-border bg-muted/20 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
      {INDEX_SYMBOLS.map((sym) => {
        const s = stocks[sym];
        const up = (s?.changePercent || 0) >= 0;
        return (
          <span key={sym} className="flex items-center gap-1.5 px-2.5 border-r border-border/40 whitespace-nowrap shrink-0 font-mono">
            <span className="text-[10px] text-muted-foreground/70">{INDEX_LABELS[sym]}</span>
            {s ? (
              <>
                <span className="text-[11px] text-foreground font-semibold">
                  {sym === "BTC-USD"
                    ? s.price?.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : s.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={cn("text-[10px] font-semibold", up ? "text-green-500" : "text-red-500")}>
                  {up ? "▲" : "▼"}{Math.abs(s.changePercent || 0).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground/30">…</span>
            )}
          </span>
        );
      })}

      {/* Fear & Greed */}
      {mood?.fearGreedIndex !== undefined && (
        <span className="flex items-center gap-1.5 px-2.5 border-r border-border/40 whitespace-nowrap shrink-0 font-mono">
          <span className="text-[10px] text-muted-foreground/70">F&G</span>
          <span className={cn(
            "text-[11px] font-bold",
            mood.fearGreedIndex > 65 ? "text-green-400" :
            mood.fearGreedIndex > 45 ? "text-yellow-400" :
            mood.fearGreedIndex > 25 ? "text-orange-400" : "text-red-400"
          )}>
            {mood.fearGreedIndex}
          </span>
          <span className="text-[9px] text-muted-foreground/50">
            {mood.fearGreedIndex > 65 ? "탐욕" : mood.fearGreedIndex > 45 ? "중립" : mood.fearGreedIndex > 25 ? "공포" : "극공포"}
          </span>
        </span>
      )}

      <div className="flex-1" />

      {/* Clock */}
      <span className="px-3 shrink-0">
        <Clock />
      </span>
    </div>
  );
}
