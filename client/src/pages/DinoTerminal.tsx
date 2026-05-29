import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Newspaper, Target, Bot, Search,
  Star, BarChart2, Flame, Zap, User, ArrowUp, ArrowDown,
  ExternalLink, RefreshCw, ChevronRight, Calendar,
  Briefcase, BookOpen, MessageCircle, LogOut, Settings
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

// ── Types ─────────────────────────────────────────────────────────────────────
type TabId = "market" | "chart" | "news" | "portfolio" | "ai";

const TABS: { id: TabId; ko: string; en: string; icon: React.ReactNode }[] = [
  { id: "market",    ko: "시장",    en: "Market",  icon: <TrendingUp className="w-4 h-4" /> },
  { id: "chart",     ko: "차트",    en: "Chart",   icon: <BarChart2 className="w-4 h-4" /> },
  { id: "news",      ko: "뉴스",    en: "News",    icon: <Newspaper className="w-4 h-4" /> },
  { id: "portfolio", ko: "포트폴리오", en: "Portfolio", icon: <Star className="w-4 h-4" /> },
  { id: "ai",        ko: "AI",      en: "AI",      icon: <Bot className="w-4 h-4" /> },
];

const INDEX_SYMS = ["SPY", "QQQ", "^KS11", "BTC-USD", "GC=F", "^IXIC"];
const INDEX_LBL: Record<string, string> = {
  "SPY": "S&P", "QQQ": "QQQ", "^KS11": "KOSPI",
  "BTC-USD": "BTC", "GC=F": "GOLD", "^IXIC": "NASDAQ",
};

// ── Scrolling ticker ───────────────────────────────────────────────────────────
function TickerStrip({ stocks }: { stocks: Record<string, any> }) {
  return (
    <div className="overflow-hidden h-6 flex items-center">
      <div className="flex gap-4 animate-[ticker_20s_linear_infinite] whitespace-nowrap">
        {[...INDEX_SYMS, ...INDEX_SYMS].map((sym, i) => {
          const s = stocks[sym];
          const up = (s?.changePercent || 0) >= 0;
          return (
            <span key={`${sym}-${i}`} className="flex items-center gap-1 text-[10px] font-mono shrink-0">
              <span className="text-muted-foreground/60">{INDEX_LBL[sym]}</span>
              <span className="text-foreground font-semibold">
                {s ? (sym === "BTC-USD"
                  ? (s.price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : (s.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                  : "—"}
              </span>
              {s && (
                <span className={cn("text-[9px] font-semibold", up ? "text-green-400" : "text-red-400")}>
                  {up ? "▲" : "▼"}{Math.abs(s.changePercent || 0).toFixed(2)}%
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function MiniClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-[9px] font-mono text-muted-foreground/50">
      {t.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function Card({ title, children, action, actionHref }: {
  title: string; children: React.ReactNode; action?: string; actionHref?: string;
}) {
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/40">
        <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">{title}</span>
        {action && actionHref && (
          <Link href={actionHref} className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
            {action}<ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ── SECTION: 시장 ─────────────────────────────────────────────────────────────
function MarketSection({ lang }: { lang: string }) {
  const { data: user } = useUser();
  const symbols: string[] = user?.favoriteStocks?.length
    ? user.favoriteStocks.slice(0, 8)
    : ["AAPL", "TSLA", "NVDA", "MSFT", "005930.KS", "^KS11"];

  const { data: live } = useQuery<any>({
    queryKey: ["/api/stocks/live", "terminal-market"],
    queryFn: async () => {
      const all = Array.from(new Set([...INDEX_SYMS, ...symbols]));
      const res = await fetch(`/api/stocks/live?symbols=${all.join(",")}`);
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const { data: mood } = useQuery<any>({
    queryKey: ["/api/market/mood"],
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const { data: sectorData } = useQuery<any>({
    queryKey: ["/api/sector-returns"],
    staleTime: 60000,
  });

  const stocks = live?.stocks || {};
  const fg = mood?.fearGreedIndex;
  const fgLabel = fg == null ? "—" : fg > 65 ? "탐욕" : fg > 45 ? "중립" : fg > 25 ? "공포" : "극공포";
  const fgColor = fg == null ? "text-muted-foreground" : fg > 65 ? "text-green-400" : fg > 45 ? "text-yellow-400" : fg > 25 ? "text-orange-400" : "text-red-400";

  const sectors: any[] = sectorData?.sectors || [];

  return (
    <div className="px-3 py-2">
      {/* Fear & Greed */}
      <Card title="마켓 펄스">
        <div className="px-3 py-2.5 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-0.5">공포&탐욕</div>
            <div className={cn("text-3xl font-black leading-none", fgColor)}>{fg ?? "—"}</div>
            <div className={cn("text-[10px] font-semibold", fgColor)}>{fgLabel}</div>
          </div>
          <div className="flex-1">
            <div className="relative h-2.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-70 mb-1">
              {fg != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-foreground shadow"
                  style={{ left: `${fg}%`, transform: "translate(-50%, -50%)" }}
                />
              )}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/40">
              <span>극공포</span><span>극탐욕</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {[
                { label: "SPY", sym: "SPY" },
                { label: "QQQ", sym: "QQQ" },
                { label: "KOSPI", sym: "^KS11" },
              ].map(({ label, sym }) => {
                const s = stocks[sym];
                const up = (s?.changePercent || 0) >= 0;
                return (
                  <div key={sym} className={cn("rounded px-1.5 py-1 text-center border", up ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20")}>
                    <div className="text-[9px] text-muted-foreground/60">{label}</div>
                    <div className={cn("text-[11px] font-bold", up ? "text-green-400" : "text-red-400")}>
                      {s ? `${up ? "+" : ""}${(s.changePercent || 0).toFixed(2)}%` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Watchlist */}
      <Card title="워치그리드" action="전체보기" actionHref="/watchlist">
        <div className="font-mono">
          <div className="grid grid-cols-4 px-3 py-1 bg-muted/20 border-b border-border/30 text-[9px] text-muted-foreground/50 uppercase tracking-wide">
            <span>종목</span>
            <span className="text-right">가격</span>
            <span className="text-right">등락%</span>
            <span className="text-right">거래량</span>
          </div>
          {symbols.slice(0, 6).map(sym => {
            const s = stocks[sym];
            const up = (s?.changePercent || 0) >= 0;
            return (
              <Link key={sym} href={`/stock/${sym}`} className="grid grid-cols-4 px-3 py-2 border-b border-border/15 hover:bg-muted/20 active:bg-muted/40 transition-colors items-center">
                <span className="text-[11px] font-semibold text-foreground truncate">
                  {sym.replace(".KS", "").replace("^", "")}
                </span>
                <span className="text-right text-[11px] text-foreground">
                  {s ? s.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                </span>
                <span className={cn("text-right text-[11px] font-semibold", s ? (up ? "text-green-400" : "text-red-400") : "text-muted-foreground/30")}>
                  {s ? `${up ? "+" : ""}${(s.changePercent || 0).toFixed(2)}%` : "—"}
                </span>
                <span className="text-right text-[10px] text-muted-foreground/50">
                  {s?.volume ? (s.volume > 1_000_000 ? `${(s.volume / 1_000_000).toFixed(1)}M` : `${(s.volume / 1000).toFixed(0)}K`) : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Sector map */}
      {sectors.length > 0 && (
        <Card title="섹터 맵" action="시장동향" actionHref="/market-trends">
          <div className="px-3 py-2 space-y-1.5">
            {sectors.slice(0, 6).map((sec: any) => {
              const up = sec.change >= 0;
              const barW = Math.min(Math.abs(sec.change || 0) * 10, 100);
              return (
                <div key={sec.sector} className="flex items-center gap-2">
                  <span className="w-24 truncate text-[10px] text-muted-foreground/70 shrink-0">{sec.sector}</span>
                  <div className="flex-1 h-2.5 bg-muted/30 rounded-sm overflow-hidden">
                    <div
                      className={cn("h-full rounded-sm transition-all", up ? "bg-green-500/60" : "bg-red-500/60")}
                      style={{ width: `${barW}%`, marginLeft: up ? 0 : `${100 - barW}%` }}
                    />
                  </div>
                  <span className={cn("w-14 text-right text-[10px] font-bold font-mono shrink-0", up ? "text-green-400" : "text-red-400")}>
                    {up ? "+" : ""}{(sec.change || 0).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: "시장 동향", href: "/market-trends", icon: <TrendingUp className="w-4 h-4" /> },
          { label: "실적 Live", href: "/earnings", icon: <BarChart2 className="w-4 h-4" /> },
          { label: "경제 캘린더", href: "/calendar", icon: <Calendar className="w-4 h-4" /> },
        ].map(item => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors">
            <span className="text-primary">{item.icon}</span>
            <span className="text-[10px] font-medium text-foreground/70">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── SECTION: 차트 ─────────────────────────────────────────────────────────────
function ChartSection({ lang }: { lang: string }) {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const POPULAR = [
    { sym: "AAPL", name: "애플" }, { sym: "TSLA", name: "테슬라" },
    { sym: "NVDA", name: "엔비디아" }, { sym: "005930.KS", name: "삼성전자" },
    { sym: "MSFT", name: "마이크로소프트" }, { sym: "AMZN", name: "아마존" },
    { sym: "META", name: "메타" }, { sym: "GOOGL", name: "구글" },
    { sym: "035420.KS", name: "NAVER" }, { sym: "035720.KS", name: "카카오" },
    { sym: "^KS11", name: "KOSPI" }, { sym: "^IXIC", name: "NASDAQ" },
  ];

  function goChart(sym: string) {
    navigate(`/stock/${sym}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim().toUpperCase();
    if (q) {
      navigate(`/stock/${q}`);
    }
  }

  return (
    <div className="px-3 py-2">
      {/* Search */}
      <Card title="종목 검색">
        <div className="px-3 py-2.5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="AAPL, 005930.KS, BTC-USD..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-muted/30 focus:outline-none focus:border-primary font-mono placeholder:text-muted-foreground/40"
              />
            </div>
            <button type="submit" className="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-primary-foreground active:opacity-80 transition-opacity shrink-0">
              GO
            </button>
          </form>
        </div>
      </Card>

      {/* Pro Dashboard */}
      <Link href="/pro" className="flex items-center justify-between px-4 py-3 mb-2 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 active:bg-primary/15 transition-colors">
        <div>
          <div className="text-sm font-bold text-primary">프로 대시보드</div>
          <div className="text-[11px] text-muted-foreground/60">차트 + 스크리너 + 지표</div>
        </div>
        <ChevronRight className="w-5 h-5 text-primary" />
      </Link>

      {/* Popular symbols */}
      <Card title="인기 종목">
        <div className="grid grid-cols-3 gap-px bg-border/20">
          {POPULAR.map(({ sym, name }) => (
            <button
              key={sym}
              onClick={() => goChart(sym)}
              className="flex flex-col items-center justify-center py-3 bg-background hover:bg-muted/30 active:bg-muted/50 transition-colors"
            >
              <span className="text-[11px] font-bold text-foreground font-mono">{sym.replace(".KS", "").replace("^", "")}</span>
              <span className="text-[10px] text-muted-foreground/60">{name}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Chart Master link */}
      <Link href="/chart-master" className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">차트 마스터</div>
            <div className="text-[11px] text-muted-foreground/60">24개 패턴 학습</div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
      </Link>
    </div>
  );
}

// ── SECTION: 뉴스 ─────────────────────────────────────────────────────────────
function NewsSection({ lang }: { lang: string }) {
  const { data: newsData } = useQuery<any[]>({
    queryKey: ["/api/news"],
    staleTime: 120000,
    refetchInterval: 180000,
  });

  const { data: calData } = useQuery<any>({
    queryKey: ["/api/economic-calendar"],
    queryFn: async () => {
      const now = new Date();
      const res = await fetch(`/api/economic-calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      return res.json();
    },
    staleTime: 300000,
  });

  const news: any[] = Array.isArray(newsData) ? newsData : [];
  const today = new Date().getDate();
  const calEvents: any[] = (calData?.events || []).filter((e: any) => {
    const d = new Date(e.date || "").getDate();
    return d >= today && d <= today + 7;
  }).slice(0, 5);

  return (
    <div className="px-3 py-2">
      {/* Hot issues link */}
      <Link href="/hot-issues" className="flex items-center justify-between px-4 py-3 mb-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">오늘의 핫 이슈</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
      </Link>

      {/* News feed */}
      <Card title="뉴스 피드" action="전체" actionHref="/hot-issues">
        {news.length === 0 && (
          <div className="flex items-center justify-center py-6 text-muted-foreground/40 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />로딩중
          </div>
        )}
        {news.slice(0, 10).map((item: any, i: number) => (
          <a
            key={i}
            href={item.url || item.link || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2.5 border-b border-border/20 hover:bg-muted/20 active:bg-muted/40 transition-colors group"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-semibold",
                i === 0 ? "bg-red-500/15 text-red-400" : "bg-muted/50 text-muted-foreground/50"
              )}>
                {i === 0 ? "🔥 HOT" : item.source?.name || item.publisher || "News"}
              </span>
              <ExternalLink className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[12px] text-foreground/80 leading-snug line-clamp-2">{item.title}</p>
          </a>
        ))}
      </Card>

      {/* Upcoming events */}
      {calEvents.length > 0 && (
        <Card title="이번 주 경제 지표" action="캘린더" actionHref="/calendar">
          {calEvents.map((ev: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-border/15">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                ev.importance === "high" ? "bg-red-400" :
                ev.importance === "medium" ? "bg-orange-400" : "bg-blue-400"
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-foreground/80 truncate">{ev.name || ev.title}</div>
                <div className="text-[10px] text-muted-foreground/50">{ev.date}</div>
              </div>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0",
                ev.importance === "high" ? "bg-red-500/15 text-red-400" :
                ev.importance === "medium" ? "bg-orange-500/15 text-orange-400" : "bg-blue-500/15 text-blue-400"
              )}>
                {ev.importance === "high" ? "HIGH" : ev.importance === "medium" ? "MED" : "LOW"}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── SECTION: 포트폴리오 ────────────────────────────────────────────────────────
function PortfolioSection({ lang }: { lang: string }) {
  const { data: user } = useUser();

  const QUICK_LINKS = [
    { label: "관심 종목", href: "/watchlist", icon: <Star className="w-4 h-4" /> },
    { label: "AI 포트폴리오", href: "/ai-portfolio", icon: <Bot className="w-4 h-4" /> },
    { label: "추천 종목", href: "/recommended", icon: <TrendingUp className="w-4 h-4" /> },
    { label: "슈퍼 투자자", href: "/investors", icon: <Briefcase className="w-4 h-4" /> },
    { label: "종목 검색", href: "/search", icon: <Search className="w-4 h-4" /> },
    { label: "실적 Live", href: "/earnings", icon: <BarChart2 className="w-4 h-4" /> },
  ];

  const symbols: string[] = user?.favoriteStocks?.length
    ? user.favoriteStocks.slice(0, 6)
    : ["AAPL", "TSLA", "NVDA"];

  const { data: live } = useQuery<any>({
    queryKey: ["/api/stocks/live", "portfolio-tab"],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`);
      return res.json();
    },
    refetchInterval: 20000,
    staleTime: 15000,
  });

  const stocks = live?.stocks || {};

  return (
    <div className="px-3 py-2">
      {/* User stats */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: "보유 XP", value: (user?.xp || 0).toLocaleString(), color: "text-yellow-400", icon: <Zap className="w-4 h-4" /> },
          { label: "스트릭", value: `${user?.streak || 0}일`, color: "text-orange-400", icon: <Flame className="w-4 h-4" /> },
          { label: "레벨", value: `Lv.${user?.level || 1}`, color: "text-primary", icon: <Star className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-3 rounded-lg border border-border/50 bg-muted/20">
            <span className={cn("mb-0.5", s.color)}>{s.icon}</span>
            <span className={cn("text-lg font-black", s.color)}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground/50">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Watchlist */}
      <Card title="관심 종목" action="전체" actionHref="/watchlist">
        <div className="font-mono">
          {symbols.map(sym => {
            const s = stocks[sym];
            const up = (s?.changePercent || 0) >= 0;
            return (
              <Link key={sym} href={`/stock/${sym}`} className="flex items-center justify-between px-3 py-2 border-b border-border/15 hover:bg-muted/20 active:bg-muted/40 transition-colors">
                <div>
                  <div className="text-[12px] font-bold text-foreground">{sym.replace(".KS", "").replace("^", "")}</div>
                  <div className="text-[10px] text-muted-foreground/50">
                    {s?.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "—"}
                  </div>
                </div>
                <span className={cn("text-[13px] font-bold", s ? (up ? "text-green-400" : "text-red-400") : "text-muted-foreground/30")}>
                  {s ? `${up ? "+" : ""}${(s.changePercent || 0).toFixed(2)}%` : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Quick links grid */}
      <Card title="빠른 메뉴">
        <div className="grid grid-cols-2 gap-px bg-border/20">
          {QUICK_LINKS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 active:bg-muted/50 transition-colors"
            >
              <span className="text-primary">{item.icon}</span>
              <span className="text-[12px] font-medium">{item.label}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground/30 ml-auto" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SECTION: AI ────────────────────────────────────────────────────────────────
function AISection({ lang }: { lang: string }) {
  const { data: user } = useUser();
  const { data: quests } = useQuery<any[]>({
    queryKey: ["/api/quests/daily"],
    staleTime: 60000,
  });

  const dailyQuests: any[] = Array.isArray(quests) ? quests : [];
  const completed = dailyQuests.filter(q => q.completed).length;
  const total = dailyQuests.length || 6;

  const AI_FEATURES = [
    { label: "AI 주식 챗봇", desc: "주식 관련 질문 · 분석", href: "/chat", icon: <MessageCircle className="w-5 h-5" />, color: "text-blue-400" },
    { label: "AI 포트폴리오", desc: "AI 맞춤 포트폴리오", href: "/ai-portfolio", icon: <Bot className="w-5 h-5" />, color: "text-purple-400" },
    { label: "차트 마스터", desc: "24가지 패턴 학습", href: "/chart-master", icon: <BookOpen className="w-5 h-5" />, color: "text-green-400" },
    { label: "슈퍼 투자자", desc: "13F 포트폴리오 분석", href: "/investors", icon: <Briefcase className="w-5 h-5" />, color: "text-yellow-400" },
  ];

  return (
    <div className="px-3 py-2">
      {/* Quest progress */}
      <Card title="오늘의 퀘스트" action="시작" actionHref="/quests">
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{completed}/{total} 완료</span>
            <span className="text-[11px] text-yellow-400 font-mono font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" />{user?.xp || 0} XP
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(completed / Math.max(total, 1)) * 100}%` }}
            />
          </div>
          {dailyQuests.slice(0, 4).map((q, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-border/15 last:border-0">
              <div className={cn("w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                q.completed ? "border-primary bg-primary/20" : "border-border"
              )}>
                {q.completed && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className={cn("flex-1 text-[12px]", q.completed ? "text-muted-foreground/50 line-through" : "text-foreground/80")}>
                {q.title || q.type || `퀘스트 ${i + 1}`}
              </span>
              <span className="text-[10px] text-yellow-400 font-mono shrink-0">{q.xpReward || 20}XP</span>
            </div>
          ))}
          {dailyQuests.length === 0 && (
            <Link href="/quests" className="block text-center text-sm text-primary py-2">
              퀘스트 시작하기 →
            </Link>
          )}
        </div>
      </Card>

      {/* AI feature grid */}
      <Card title="AI 기능">
        <div className="divide-y divide-border/15">
          {AI_FEATURES.map(feat => (
            <Link key={feat.href} href={feat.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 active:bg-muted/40 transition-colors">
              <div className={cn("w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center shrink-0", feat.color)}>
                {feat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">{feat.label}</div>
                <div className="text-[11px] text-muted-foreground/60">{feat.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
            </Link>
          ))}
        </div>
      </Card>

      {/* Quick AI Chat */}
      <Link href="/chat" className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:opacity-80 transition-opacity">
        <MessageCircle className="w-4 h-4" />
        AI 주식 챗봇 열기
      </Link>
    </div>
  );
}

// ── Main DinoTerminal ─────────────────────────────────────────────────────────
export default function DinoTerminal() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try { return (localStorage.getItem("dino-terminal-tab") as TabId) || "market"; }
    catch { return "market"; }
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { data: user } = useUser();
  const { logout } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);

  const lang = user?.language || "ko";

  // Fetch index data for ticker strip
  const { data: live } = useQuery<any>({
    queryKey: ["/api/stocks/live", "dino-terminal-strip"],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${INDEX_SYMS.join(",")}`);
      return res.json();
    },
    refetchInterval: 20000,
    staleTime: 15000,
  });

  const stocks = live?.stocks || {};

  function switchTab(id: TabId) {
    setActiveTab(id);
    localStorage.setItem("dino-terminal-tab", id);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] bg-background overflow-hidden">
      {/* ── Terminal Header ───────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card">
        {/* Top row: logo + stats */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-5 h-5 bg-primary/20 rounded flex items-center justify-center text-primary text-[9px] font-black">D</div>
            <span className="text-[11px] font-black tracking-widest uppercase text-foreground font-mono">DINO TERMINAL</span>
          </div>
          <div className="flex-1 min-w-0">
            <TickerStrip stocks={stocks} />
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-1">
            <MiniClock />
            <button onClick={() => setUserMenuOpen(true)} className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 hover:ring-1 hover:ring-primary transition-all">
              <User className="w-3 h-3 text-primary" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-0 overflow-x-auto px-3 py-1" style={{ scrollbarWidth: "none" }}>
          <span className="flex items-center gap-1 text-[10px] text-orange-400 font-mono mr-3 shrink-0">
            <Flame className="w-3 h-3 fill-current" />
            <span className="font-bold">{user?.streak || 0}</span>일 스트릭
          </span>
          <span className="flex items-center gap-1 text-[10px] text-yellow-400 font-mono mr-3 shrink-0">
            <Zap className="w-3 h-3 fill-current" />
            <span className="font-bold">{(user?.xp || 0).toLocaleString()}</span> XP
          </span>
          <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0">
            Lv.{user?.level || 1}
          </span>
          <div className="flex-1" />
          <Link href="/settings" className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors shrink-0">
            <Settings className="w-3 h-3" />설정
          </Link>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
        {activeTab === "market"    && <MarketSection lang={lang} />}
        {activeTab === "chart"     && <ChartSection lang={lang} />}
        {activeTab === "news"      && <NewsSection lang={lang} />}
        {activeTab === "portfolio" && <PortfolioSection lang={lang} />}
        {activeTab === "ai"        && <AISection lang={lang} />}
      </div>

      {/* ── Bottom Tab Bar ────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-card grid grid-cols-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all touch-manipulation",
              activeTab === tab.id
                ? "text-primary border-t-2 border-primary -mt-px"
                : "text-muted-foreground/60 border-t-2 border-transparent hover:text-foreground"
            )}
          >
            {tab.icon}
            <span className="text-[10px] font-semibold leading-none">{lang === "en" ? tab.en : tab.ko}</span>
          </button>
        ))}
      </div>

      <UserMenu isOpen={userMenuOpen} onClose={() => setUserMenuOpen(false)} />
    </div>
  );
}
