import { Link, useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useState } from "react";
import { Flame, Zap, User, Search, Bot, Newspaper, Terminal, TrendingUp, BookOpen, Calendar, Trophy, DollarSign, Users, Wallet, Star } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { MobileMenu } from "@/components/MobileMenu";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

const TABS = [
  { label: "뉴스",    en: "News",      ja: "ニュース",  href: "/hot-issues",    icon: Newspaper,  highlight: true },
  { label: "터미널",  en: "Terminal",  ja: "端末",      href: "/terminal",      icon: Terminal },
  { label: "시장",    en: "Market",    ja: "市場",      href: "/market-trends", icon: TrendingUp },
  { label: "차트공부", en: "Chart Study", ja: "チャート学習", href: "/chart-master", icon: BookOpen },
  { label: "캘린더",  en: "Calendar",  ja: "カレンダー",href: "/calendar",      icon: Calendar },
  { label: "실적",    en: "Earnings",  ja: "決算",      href: "/earnings",      icon: DollarSign },
  { label: "투자자",  en: "Investors", ja: "投資家",    href: "/investors",     icon: Users },
  { label: "퀘스트",  en: "Quests",    ja: "クエスト",  href: "/quests",        icon: Trophy },
  { label: "챗봇",    en: "AI Chat",   ja: "AIチャット",href: "/chat",          icon: Bot },
  { label: "포트폴리오",en:"Portfolio",ja: "ポートフォリオ",href:"/portfolio",icon: Wallet },
];

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
      <header className="hidden md:flex h-10 items-stretch border-b border-border bg-card shrink-0 z-50 shadow-sm">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 px-3 border-r border-border shrink-0 hover:bg-muted/40 transition-colors">
          <div className="w-5 h-5 bg-primary rounded flex items-center justify-center text-primary-foreground text-[10px] font-black tracking-tight">D</div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-foreground font-mono hidden lg:block">DinoInvest</span>
        </Link>

        {/* Tab strip */}
        <nav className="flex items-stretch overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(tab => {
            const active = tab.href === "/hot-issues"
              ? (location === "/" || location === "/hot-issues" || location.startsWith("/hot-issues"))
              : location.startsWith(tab.href);
            const isHighlight = (tab as any).highlight;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-1 px-2.5 text-[11px] font-medium border-b-2 transition-all whitespace-nowrap shrink-0",
                  active
                    ? "border-primary text-primary bg-primary/8 font-semibold"
                    : isHighlight
                    ? "border-transparent text-primary/60 hover:text-primary hover:bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("w-3 h-3 shrink-0", active ? "text-primary" : "text-muted-foreground/70")} />
                {isHighlight && !active && (
                  <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                )}
                <span>{getTabLabel(tab)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center px-2.5 border-l border-border shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3 h-3 absolute left-2 text-muted-foreground pointer-events-none" />
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder={lang === "ko" ? "종목... AAPL, 삼성" : lang === "ja" ? "銘柄..." : "Search..."}
              className="h-6 pl-6 pr-2.5 text-[11px] rounded border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 w-36 placeholder:text-muted-foreground/50 transition-all"
            />
          </div>
        </form>

        {/* User stats */}
        <div className="flex items-center gap-2 px-2.5 border-l border-border shrink-0">
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-orange-500">
            <Flame className="w-3 h-3 fill-current" />
            {user?.streak || 0}
          </span>
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
            <Zap className="w-3 h-3 fill-current" />
            {(user?.xp || 0).toLocaleString()}
          </span>
          <button
            onClick={() => setUserMenuOpen(true)}
            className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25 hover:bg-primary/25 hover:border-primary/40 transition-all cursor-pointer"
          >
            <User className="w-3 h-3 text-primary" />
          </button>
        </div>
      </header>

      {/* ── MOBILE header ────────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 w-full bg-card/95 backdrop-blur-lg border-b border-border px-4 py-2.5 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <span className="font-bold text-[15px] tracking-tight">DinoInvest</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[12px] font-bold">
            <Flame className="w-3.5 h-3.5 fill-current" />
            {user?.streak || 0}
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[12px] font-bold">
            <Zap className="w-3.5 h-3.5 fill-current" />
            {user?.xp || 0}
          </span>
          <button
            onClick={() => setUserMenuOpen(true)}
            className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25"
          >
            <User className="w-3.5 h-3.5 text-primary" />
          </button>
        </div>
      </header>

      <UserMenu isOpen={userMenuOpen} onClose={() => setUserMenuOpen(false)} />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
