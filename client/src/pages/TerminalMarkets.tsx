import { useState, useCallback, useRef, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Newspaper, Target, ChevronDown, ChevronUp,
  GripVertical, RefreshCw, ExternalLink, Zap, Flame, ArrowUp, ArrowDown, Minus
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type WidgetId = "watch-grid" | "sector-map" | "market-pulse" | "gainers" | "news-feed" | "quest-status" | "macro-data";

interface ColumnLayout {
  left: WidgetId[];
  center: WidgetId[];
  right: WidgetId[];
}

const DEFAULT_LAYOUT: ColumnLayout = {
  left: ["watch-grid", "sector-map"],
  center: ["market-pulse", "gainers"],
  right: ["news-feed", "quest-status"],
};

const WIDGET_META: Record<WidgetId, { title: string; icon: React.ReactNode }> = {
  "watch-grid":   { title: "워치 그리드", icon: <TrendingUp className="w-3 h-3" /> },
  "sector-map":   { title: "섹터 맵", icon: <ArrowUp className="w-3 h-3" /> },
  "market-pulse": { title: "마켓 펄스", icon: <Flame className="w-3 h-3" /> },
  "gainers":      { title: "상승 / 하락", icon: <TrendingUp className="w-3 h-3" /> },
  "news-feed":    { title: "뉴스 피드", icon: <Newspaper className="w-3 h-3" /> },
  "quest-status": { title: "퀘스트 현황", icon: <Target className="w-3 h-3" /> },
  "macro-data":   { title: "매크로 데이터", icon: <Zap className="w-3 h-3" /> },
};

// ─── Layout Persistence ────────────────────────────────────────────────────────
function useLayoutPersistence(userId: number | string | undefined) {
  const key = `terminal-layout-${userId ?? "guest"}`;

  const [layout, setLayout] = useState<ColumnLayout>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : DEFAULT_LAYOUT;
    } catch { return DEFAULT_LAYOUT; }
  });

  const [panelSizes, setPanelSizes] = useState<number[]>(() => {
    try {
      const s = localStorage.getItem(`${key}-panels`);
      return s ? JSON.parse(s) : [20, 52, 28];
    } catch { return [20, 52, 28]; }
  });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const s = localStorage.getItem(`${key}-collapsed`);
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  });

  const saveLayout = useCallback((l: ColumnLayout) => {
    setLayout(l);
    localStorage.setItem(key, JSON.stringify(l));
  }, [key]);

  const savePanelSizes = useCallback((sizes: number[]) => {
    setPanelSizes(sizes);
    localStorage.setItem(`${key}-panels`, JSON.stringify(sizes));
  }, [key]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(`${key}-collapsed`, JSON.stringify(next));
      return next;
    });
  }, [key]);

  return { layout, panelSizes, collapsed, saveLayout, savePanelSizes, toggleCollapsed };
}

// ─── Widget Shell ──────────────────────────────────────────────────────────────
function WidgetShell({
  id, isCollapsed, onToggle,
  onDragStart, onDragOver, onDrop, isDragOver,
  children,
}: {
  id: WidgetId;
  isCollapsed: boolean;
  onToggle: () => void;
  onDragStart: (id: WidgetId) => void;
  onDragOver: (e: React.DragEvent, id: WidgetId) => void;
  onDrop: (targetId: WidgetId) => void;
  isDragOver: boolean;
  children: React.ReactNode;
}) {
  const meta = WIDGET_META[id];

  return (
    <div
      className={cn(
        "border border-border/60 rounded overflow-hidden flex flex-col shrink-0 transition-all",
        isDragOver && "ring-2 ring-primary/50 border-primary/30"
      )}
      onDragOver={e => { e.preventDefault(); onDragOver(e, id); }}
      onDrop={() => onDrop(id)}
    >
      {/* Title bar — drag handle */}
      <div
        draggable
        onDragStart={() => onDragStart(id)}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/40 border-b border-border/40 cursor-grab active:cursor-grabbing select-none shrink-0"
      >
        <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
        <span className="text-muted-foreground/70 shrink-0">{meta.icon}</span>
        <span className="text-[11px] font-semibold text-foreground/80 flex-1 truncate">{meta.title}</span>
        <button
          onClick={onToggle}
          className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
        >
          {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Drag-and-drop column ──────────────────────────────────────────────────────
function WidgetColumn({
  ids, collapsed, onToggle,
  onDragStart, onDragOver, onDrop, dragOverId,
  renderWidget,
}: {
  ids: WidgetId[];
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onDragStart: (id: WidgetId) => void;
  onDragOver: (e: React.DragEvent, id: WidgetId) => void;
  onDrop: (targetId: WidgetId) => void;
  dragOverId: WidgetId | null;
  renderWidget: (id: WidgetId) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 p-1 h-full overflow-y-auto overflow-x-hidden">
      {ids.map(id => (
        <WidgetShell
          key={id}
          id={id}
          isCollapsed={!!collapsed[id]}
          onToggle={() => onToggle(id)}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          isDragOver={dragOverId === id}
        >
          {renderWidget(id)}
        </WidgetShell>
      ))}
    </div>
  );
}

// ─── Widget: WatchGrid ─────────────────────────────────────────────────────────
function WatchGridWidget({ userId }: { userId?: number | string }) {
  const { data: user } = useUser();
  const symbols: string[] = user?.favoriteStocks?.length ? user.favoriteStocks : ["AAPL", "TSLA", "NVDA", "MSFT", "005930.KS"];

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/stocks/live", symbols.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`);
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const stocks = data?.stocks || {};

  return (
    <div className="font-mono text-[11px]">
      <div className="grid grid-cols-4 gap-0 px-2 py-1 bg-muted/20 border-b border-border/30 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
        <span>TICKER</span>
        <span className="text-right">LAST</span>
        <span className="text-right">CHG%</span>
        <span className="text-right">VOL</span>
      </div>
      {isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground/40 text-[10px]">
          <RefreshCw className="w-3 h-3 animate-spin mr-1" />로딩중
        </div>
      )}
      {symbols.map(sym => {
        const s = stocks[sym];
        const up = (s?.changePercent || 0) >= 0;
        return (
          <Link key={sym} href={`/stock/${sym}`} className="grid grid-cols-4 gap-0 px-2 py-1.5 border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer items-center">
            <span className="text-foreground font-semibold truncate">{sym.replace(".KS", "").replace("^", "")}</span>
            <span className="text-right text-foreground">
              {s ? s.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
            </span>
            <span className={cn("text-right font-semibold", s ? (up ? "text-green-500" : "text-red-500") : "text-muted-foreground/30")}>
              {s ? `${up ? "+" : ""}${(s.changePercent || 0).toFixed(2)}%` : "—"}
            </span>
            <span className="text-right text-muted-foreground/60">
              {s?.volume ? (s.volume > 1_000_000 ? `${(s.volume / 1_000_000).toFixed(1)}M` : `${(s.volume / 1000).toFixed(0)}K`) : "—"}
            </span>
          </Link>
        );
      })}
      <div className="px-2 py-1.5 text-[10px] text-muted-foreground/50">
        <Link href="/watchlist" className="hover:text-primary transition-colors flex items-center gap-1">
          <ExternalLink className="w-2.5 h-2.5" />관심종목 관리
        </Link>
      </div>
    </div>
  );
}

// ─── Widget: SectorMap ─────────────────────────────────────────────────────────
function SectorMapWidget() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/sector-returns"],
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const sectors: Array<{ sector: string; change: number }> = data?.sectors || [];

  return (
    <div className="px-2 py-1.5 font-mono text-[11px]">
      {isLoading && <div className="text-muted-foreground/40 text-[10px] py-2 text-center">로딩중...</div>}
      {sectors.length === 0 && !isLoading && (
        <div className="text-muted-foreground/40 text-[10px] py-2 text-center">
          데이터 없음<br />
          <Link href="/market-trends" className="text-primary hover:underline">시장 동향 보기</Link>
        </div>
      )}
      {sectors.slice(0, 10).map(sec => {
        const up = sec.change >= 0;
        const barW = Math.min(Math.abs(sec.change) * 8, 100);
        return (
          <div key={sec.sector} className="flex items-center gap-1.5 mb-1.5">
            <span className="w-20 truncate text-[10px] text-muted-foreground">{sec.sector}</span>
            <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
              <div
                className={cn("h-full rounded-sm transition-all", up ? "bg-green-500/60" : "bg-red-500/60")}
                style={{ width: `${barW}%`, marginLeft: up ? 0 : `${100 - barW}%` }}
              />
            </div>
            <span className={cn("w-12 text-right text-[10px] font-semibold", up ? "text-green-500" : "text-red-500")}>
              {up ? "+" : ""}{sec.change?.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Widget: MarketPulse ───────────────────────────────────────────────────────
function MarketPulseWidget() {
  const { data: mood } = useQuery<any>({
    queryKey: ["/api/market/mood"],
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const { data: live } = useQuery<any>({
    queryKey: ["/api/stocks/live", "pulse"],
    queryFn: async () => {
      const res = await fetch("/api/stocks/live?symbols=SPY,QQQ,^KS11,^N225,DX-Y.NYB");
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const stocks = live?.stocks || {};
  const fg = mood?.fearGreedIndex;
  const fgLabel = fg == null ? "—" : fg > 65 ? "탐욕" : fg > 45 ? "중립" : fg > 25 ? "공포" : "극공포";
  const fgColor = fg == null ? "text-muted-foreground" : fg > 65 ? "text-green-400" : fg > 45 ? "text-yellow-400" : fg > 25 ? "text-orange-400" : "text-red-400";

  const indices = [
    { label: "S&P500", sym: "SPY" },
    { label: "NASDAQ", sym: "QQQ" },
    { label: "KOSPI", sym: "^KS11" },
    { label: "NIKKEI", sym: "^N225" },
    { label: "USD", sym: "DX-Y.NYB" },
  ];

  return (
    <div className="font-mono text-[11px]">
      {/* Fear & Greed */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/30 bg-muted/10">
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">공포 & 탐욕</div>
          <div className={cn("text-2xl font-black", fgColor)}>{fg ?? "—"}</div>
          <div className={cn("text-[10px] font-semibold", fgColor)}>{fgLabel}</div>
        </div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-60 relative overflow-visible">
            {fg != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-foreground shadow-md"
                style={{ left: `${fg}%`, transform: "translate(-50%, -50%)" }}
              />
            )}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground/40 mt-0.5">
            <span>극공포</span><span>극탐욕</span>
          </div>
        </div>
      </div>

      {/* Index table */}
      {indices.map(({ label, sym }) => {
        const s = stocks[sym];
        const up = (s?.changePercent || 0) >= 0;
        return (
          <div key={sym} className="flex items-center justify-between px-3 py-1.5 border-b border-border/20 hover:bg-muted/20">
            <span className="text-muted-foreground/70 w-16">{label}</span>
            <span className="text-foreground font-semibold">
              {s ? s.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
            </span>
            <span className={cn("text-[10px] font-semibold w-16 text-right", s ? (up ? "text-green-500" : "text-red-500") : "text-muted-foreground/30")}>
              {s ? `${up ? "+" : ""}${(s.changePercent || 0).toFixed(2)}%` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Widget: Gainers/Losers ────────────────────────────────────────────────────
function GainersWidget() {
  const { data: gainers } = useQuery<any>({ queryKey: ["/api/market/gainers"], staleTime: 60000 });
  const { data: losers } = useQuery<any>({ queryKey: ["/api/market/losers"], staleTime: 60000 });

  const gList: any[] = gainers?.result || gainers?.quotes || [];
  const lList: any[] = losers?.result || losers?.quotes || [];

  return (
    <div className="font-mono text-[11px]">
      <div className="px-2 py-1 text-[10px] font-semibold text-green-500 bg-green-500/5 border-b border-border/30 flex items-center gap-1">
        <ArrowUp className="w-2.5 h-2.5" />상승 상위
      </div>
      {gList.slice(0, 5).map((s: any) => (
        <Link key={s.symbol} href={`/stock/${s.symbol}`} className="flex items-center justify-between px-2 py-1 border-b border-border/20 hover:bg-muted/20 transition-colors">
          <span className="font-semibold text-foreground truncate w-20">{s.symbol}</span>
          <span className="text-foreground">{s.regularMarketPrice?.toFixed(2) || s.price?.toFixed(2) || "—"}</span>
          <span className="text-green-500 font-semibold">+{(s.regularMarketChangePercent || s.changePercent || 0).toFixed(2)}%</span>
        </Link>
      ))}
      <div className="px-2 py-1 text-[10px] font-semibold text-red-500 bg-red-500/5 border-b border-border/30 flex items-center gap-1 mt-0.5">
        <ArrowDown className="w-2.5 h-2.5" />하락 상위
      </div>
      {lList.slice(0, 5).map((s: any) => (
        <Link key={s.symbol} href={`/stock/${s.symbol}`} className="flex items-center justify-between px-2 py-1 border-b border-border/20 hover:bg-muted/20 transition-colors">
          <span className="font-semibold text-foreground truncate w-20">{s.symbol}</span>
          <span className="text-foreground">{s.regularMarketPrice?.toFixed(2) || s.price?.toFixed(2) || "—"}</span>
          <span className="text-red-500 font-semibold">{(s.regularMarketChangePercent || s.changePercent || 0).toFixed(2)}%</span>
        </Link>
      ))}
      {gList.length === 0 && lList.length === 0 && (
        <div className="text-muted-foreground/40 text-[10px] py-4 text-center">
          <Link href="/market-trends" className="text-primary hover:underline">시장 동향 보기</Link>
        </div>
      )}
    </div>
  );
}

// ─── Widget: NewsFeed ─────────────────────────────────────────────────────────
function NewsFeedWidget() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/news"],
    staleTime: 120000,
    refetchInterval: 180000,
  });

  const news: any[] = Array.isArray(data) ? data : [];

  return (
    <div className="font-mono text-[11px]">
      {isLoading && <div className="text-muted-foreground/40 text-[10px] py-3 text-center">로딩중...</div>}
      {news.slice(0, 12).map((item, i) => (
        <a
          key={i}
          href={item.url || item.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-2.5 py-2 border-b border-border/20 hover:bg-muted/20 transition-colors group"
        >
          <div className="text-[10px] text-muted-foreground/50 mb-0.5 flex items-center gap-1">
            <span>{item.source?.name || item.publisher || "News"}</span>
            <ExternalLink className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-foreground/80 leading-snug line-clamp-2">
            {item.title}
          </div>
        </a>
      ))}
      {news.length === 0 && !isLoading && (
        <div className="text-muted-foreground/40 text-[10px] py-4 text-center">
          <Link href="/hot-issues" className="text-primary hover:underline">뉴스 보기</Link>
        </div>
      )}
    </div>
  );
}

// ─── Widget: QuestStatus ──────────────────────────────────────────────────────
function QuestStatusWidget() {
  const { data: user } = useUser();
  const { data: quests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/quests/daily"],
    staleTime: 60000,
  });

  const dailyQuests: any[] = Array.isArray(quests) ? quests : [];
  const completed = dailyQuests.filter(q => q.completed).length;
  const total = dailyQuests.length || 6;

  return (
    <div className="font-mono text-[11px]">
      {/* XP summary */}
      <div className="px-3 py-2 border-b border-border/30 bg-muted/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">오늘 퀘스트</span>
          <span className="text-[10px] font-semibold text-primary">{completed}/{total} 완료</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-0 border-b border-border/30">
        {[
          { label: "XP", value: (user?.xp || 0).toLocaleString(), color: "text-yellow-500" },
          { label: "스트릭", value: `${user?.streak || 0}일`, color: "text-orange-500" },
          { label: "레벨", value: user?.level || 1, color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-2 border-r border-border/20 last:border-0">
            <span className={cn("text-base font-black", s.color)}>{s.value}</span>
            <span className="text-[9px] text-muted-foreground/50">{s.label}</span>
          </div>
        ))}
      </div>
      {/* Quest list */}
      {isLoading && <div className="text-muted-foreground/40 text-[10px] py-2 text-center">로딩중...</div>}
      {dailyQuests.slice(0, 6).map((q, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/15">
          <div className={cn("w-3 h-3 rounded-full border shrink-0 flex items-center justify-center",
            q.completed ? "border-primary bg-primary/20" : "border-border"
          )}>
            {q.completed && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </div>
          <span className={cn("flex-1 truncate", q.completed ? "text-muted-foreground/50 line-through" : "text-foreground/80")}>
            {q.title || q.type || `퀘스트 ${i + 1}`}
          </span>
          <span className="text-[10px] text-yellow-500 shrink-0">{q.xpReward || 20}XP</span>
        </div>
      ))}
      <div className="px-2 py-1.5">
        <Link href="/quests" className="text-[10px] text-primary hover:underline flex items-center gap-1">
          <ExternalLink className="w-2.5 h-2.5" />퀘스트 시작
        </Link>
      </div>
    </div>
  );
}

// ─── Resize Handle ────────────────────────────────────────────────────────────
function ResizeHandle() {
  return (
    <PanelResizeHandle className="w-[5px] relative flex items-center justify-center bg-transparent hover:bg-primary/10 transition-colors cursor-col-resize shrink-0">
      <div className="w-px h-12 rounded-full bg-border/50 pointer-events-none" />
    </PanelResizeHandle>
  );
}

// ─── Main TerminalMarkets ─────────────────────────────────────────────────────
export default function TerminalMarkets() {
  const { data: user } = useUser();
  const { layout, panelSizes, collapsed, saveLayout, savePanelSizes, toggleCollapsed } = useLayoutPersistence(user?.id);

  const [draggedId, setDraggedId] = useState<WidgetId | null>(null);
  const [dragOverId, setDragOverId] = useState<WidgetId | null>(null);

  // Find which column a widget belongs to
  const findColumn = useCallback((id: WidgetId): keyof ColumnLayout | null => {
    if (layout.left.includes(id)) return "left";
    if (layout.center.includes(id)) return "center";
    if (layout.right.includes(id)) return "right";
    return null;
  }, [layout]);

  const handleDragStart = useCallback((id: WidgetId) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: WidgetId) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback((targetId: WidgetId) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const srcCol = findColumn(draggedId);
    const dstCol = findColumn(targetId);
    if (!srcCol || !dstCol) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const newLayout = {
      left: [...layout.left],
      center: [...layout.center],
      right: [...layout.right],
    };

    // Remove from source column
    newLayout[srcCol] = newLayout[srcCol].filter(id => id !== draggedId);
    // Insert before target in destination column
    const dstIdx = newLayout[dstCol].indexOf(targetId);
    newLayout[dstCol].splice(dstIdx, 0, draggedId);

    saveLayout(newLayout);
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, findColumn, layout, saveLayout]);

  // Handle drop on empty column area
  const handleColumnDrop = useCallback((col: keyof ColumnLayout, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId) return;
    const srcCol = findColumn(draggedId);
    if (!srcCol || srcCol === col) return;

    const newLayout = {
      left: [...layout.left],
      center: [...layout.center],
      right: [...layout.right],
    };
    newLayout[srcCol] = newLayout[srcCol].filter(id => id !== draggedId);
    newLayout[col] = [...newLayout[col], draggedId];
    saveLayout(newLayout);
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, findColumn, layout, saveLayout]);

  function renderWidget(id: WidgetId) {
    switch (id) {
      case "watch-grid": return <WatchGridWidget userId={user?.id} />;
      case "sector-map": return <SectorMapWidget />;
      case "market-pulse": return <MarketPulseWidget />;
      case "gainers": return <GainersWidget />;
      case "news-feed": return <NewsFeedWidget />;
      case "quest-status": return <QuestStatusWidget />;
      default: return <div className="text-muted-foreground/40 p-4 text-[11px]">위젯 없음</div>;
    }
  }

  const commonColProps = {
    collapsed,
    onToggle: toggleCollapsed,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    dragOverId,
    renderWidget,
  };

  return (
    <div
      className="h-full overflow-hidden"
      onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
    >
      <PanelGroup
        direction="horizontal"
        onLayout={savePanelSizes}
        className="h-full"
      >
        {/* ── Left Panel ── */}
        <Panel defaultSize={panelSizes[0]} minSize={12} maxSize={35}>
          <div
            className="h-full bg-background overflow-hidden"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleColumnDrop("left", e)}
          >
            <WidgetColumn ids={layout.left} {...commonColProps} />
          </div>
        </Panel>

        <ResizeHandle />

        {/* ── Center Panel ── */}
        <Panel defaultSize={panelSizes[1]} minSize={25}>
          <div
            className="h-full bg-background overflow-hidden"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleColumnDrop("center", e)}
          >
            <WidgetColumn ids={layout.center} {...commonColProps} />
          </div>
        </Panel>

        <ResizeHandle />

        {/* ── Right Panel ── */}
        <Panel defaultSize={panelSizes[2]} minSize={15} maxSize={45}>
          <div
            className="h-full bg-background overflow-hidden"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleColumnDrop("right", e)}
          >
            <WidgetColumn ids={layout.right} {...commonColProps} />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
