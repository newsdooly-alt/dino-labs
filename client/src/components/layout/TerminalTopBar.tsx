import { Link, useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef } from "react";
import { Flame, Zap, User, Search, Bot, Settings, LogOut, ChevronDown } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { MobileMenu } from "@/components/MobileMenu";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

const TABS = [
  { label: "시장", en: "Markets", ja: "市場", href: "/" },
  { label: "모니터", en: "Monitor", ja: "モニター", href: "/watchlist" },
  { label: "차트", en: "Chart", ja: "チャート", href: "/pro" },
  { label: "뉴스", en: "News", ja: "ニュース", href: "/hot-issues" },
  { label: "포트폴리오", en: "Portfolio", ja: "ポートフォリオ", href: "/ai-portfolio" },
  { label: "투자자", en: "Investors", ja: "投資家", href: "/investors" },
  { label: "퀘스트", en: "Quests", ja: "クエスト", href: "/quests" },
  { label: "AI", en: "AI", ja: "AI", href: "/chat" },
  { label: "다이노터미널", en: "DinoTerminal", ja: "DinoTerminal", href: "/terminal", highlight: true },
];

const TOP_MENUS = [
  {
    label: "Markets",
    items: [
      { label: "시장 대시보드", href: "/" },
      { label: "시장 동향", href: "/market-trends" },
      { label: "핫 이슈", href: "/hot-issues" },
      { label: "실적 Live", href: "/earnings" },
      { label: "경제 캘린더", href: "/calendar" },
    ]
  },
  {
    label: "Portfolio",
    items: [
      { label: "관심 종목", href: "/watchlist" },
      { label: "AI 포트폴리오", href: "/ai-portfolio" },
      { label: "추천 종목", href: "/recommended" },
    ]
  },
  {
    label: "Research",
    items: [
      { label: "슈퍼 투자자", href: "/investors" },
      { label: "종목 검색", href: "/search" },
      { label: "프로 대시보드", href: "/pro" },
    ]
  },
  {
    label: "Tools",
    items: [
      { label: "차트 마스터", href: "/chart-master" },
      { label: "경제 캘린더", href: "/calendar" },
      { label: "설정", href: "/settings" },
    ]
  },
  {
    label: "AI",
    items: [
      { label: "AI 주식 챗봇", href: "/chat" },
      { label: "AI 포트폴리오", href: "/ai-portfolio" },
      { label: "퀘스트 (AI 퀴즈)", href: "/quests" },
    ]
  },
];

function DropdownMenu({ menu }: { menu: typeof TOP_MENUS[0] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-0.5 px-2.5 h-full text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wide">
        {menu.label}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-0 w-44 bg-card border border-border rounded-lg shadow-xl z-[200] py-1 overflow-hidden">
          {menu.items.map(item => (
            <Link key={item.href} href={item.href} className="block px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TerminalTopBar() {
  const [location] = useLocation();
  const { data: user } = useUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const lang = (user?.language || "ko") as "ko" | "en" | "ja";

  function getTabLabel(tab: typeof TABS[0]) {
    if (lang === "en") return tab.en;
    if (lang === "ja") return tab.ja;
    return tab.label;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchVal.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchVal.trim())}`;
      setSearchVal("");
    }
  }

  return (
    <>
      {/* ── DESKTOP terminal bar ─────────────────────────────────────── */}
      <header className="hidden md:flex h-10 items-stretch border-b border-border bg-card shrink-0 z-50">

        {/* Logo */}
        <div className="flex items-center gap-2 px-3 border-r border-border shrink-0">
          <div className="w-5 h-5 bg-primary/20 rounded flex items-center justify-center text-primary text-[10px] font-black">D</div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-foreground font-mono">DinoInvest</span>
        </div>

        {/* Top-level dropdown menus */}
        <div className="flex items-stretch border-r border-border shrink-0">
          {TOP_MENUS.map(m => <DropdownMenu key={m.label} menu={m} />)}
        </div>

        {/* Tab strip */}
        <nav className="flex items-stretch overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(tab => {
            const active = tab.href === "/" ? location === "/" : location.startsWith(tab.href);
            const isHighlight = (tab as any).highlight;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-1 px-3 text-[11px] font-semibold border-b-2 transition-all whitespace-nowrap shrink-0",
                  active
                    ? "border-primary text-primary bg-primary/5"
                    : isHighlight
                    ? "border-primary/30 text-primary/70 hover:text-primary hover:bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                {isHighlight && <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse shrink-0" />}
                {getTabLabel(tab)}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Command search */}
        <form onSubmit={handleSearch} className="flex items-center px-3 border-l border-border shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3 h-3 absolute left-2 text-muted-foreground pointer-events-none" />
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder={lang === "ko" ? "종목 검색... AAPL, 삼성" : lang === "ja" ? "銘柄検索... AAPL" : "Search symbol..."}
              className="h-6 pl-6 pr-3 text-[11px] rounded border border-border bg-muted/50 focus:outline-none focus:border-primary w-44 placeholder:text-muted-foreground/50 font-mono"
            />
          </div>
        </form>

        {/* AI button */}
        <Link href="/chat" className="flex items-center gap-1 px-3 text-[11px] font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors border-l border-primary/30 shrink-0">
          <Bot className="w-3 h-3" />
          AI
        </Link>

        {/* User stats */}
        <div className="flex items-center gap-3 px-3 border-l border-border shrink-0 font-mono">
          <span className="flex items-center gap-1 text-[11px] text-orange-500">
            <Flame className="w-3 h-3 fill-current" />
            {user?.streak || 0}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-yellow-500">
            <Zap className="w-3 h-3 fill-current" />
            {(user?.xp || 0).toLocaleString()}
          </span>
          <button
            onClick={() => setUserMenuOpen(true)}
            className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
          >
            <User className="w-3 h-3 text-primary" />
          </button>
        </div>
      </header>

      {/* ── MOBILE header (unchanged experience) ────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 w-full bg-background/80 backdrop-blur-lg border-b border-border px-3 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-base">DinoInvest</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-sm font-bold">
            <Flame className="w-4 h-4 fill-current" />
            {user?.streak || 0}
          </span>
          <span className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm font-bold">
            <Zap className="w-4 h-4 fill-current" />
            {user?.xp || 0}
          </span>
          <button
            onClick={() => setUserMenuOpen(true)}
            className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30"
          >
            <User className="w-4 h-4 text-primary" />
          </button>
        </div>
      </header>

      <UserMenu isOpen={userMenuOpen} onClose={() => setUserMenuOpen(false)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
