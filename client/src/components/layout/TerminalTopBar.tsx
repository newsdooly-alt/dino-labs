import { Link, useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useState, useEffect, useRef, useCallback } from "react";
import { Flame, Zap, User, Search, Bot, Newspaper, Terminal, TrendingUp, BookOpen, Calendar, Trophy, DollarSign, Users, Wallet, Megaphone } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { MobileMenu } from "@/components/MobileMenu";
import { FeedbackModal } from "@/components/FeedbackModal";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { searchStockDatabase, getDisplayTicker, getExchangeLabel, type StockEntry } from "@/lib/stockDatabase";
import { containsLocalized } from "@/lib/stockNames";
import { AnimatePresence, motion } from "framer-motion";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

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

const EXCHANGE_COLORS: Record<string, string> = {
  KOSPI:  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  KOSDAQ: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  NASDAQ: "bg-primary/10 text-primary",
  NYSE:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  AMEX:   "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  TSE:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function TerminalTopBar() {
  const [location, navigate] = useLocation();
  const { data: user } = useUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [suggestions, setSuggestions] = useState<StockEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const lang = (user?.language || "ko") as "ko" | "en" | "ja";

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function getTabLabel(tab: typeof TABS[0]) {
    if (lang === "en") return tab.en;
    if (lang === "ja") return tab.ja;
    return tab.label;
  }

  // Compute suggestions whenever searchVal changes
  useEffect(() => {
    const trimmed = searchVal.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      setActiveIndex(-1);
      return;
    }
    const results = searchStockDatabase(trimmed, 8);
    setSuggestions(results);
    setDropdownOpen(results.length > 0);
    setActiveIndex(-1);
  }, [searchVal]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = useCallback((entry: StockEntry) => {
    setSearchVal("");
    setSuggestions([]);
    setDropdownOpen(false);
    setActiveIndex(-1);
    navigate(`/terminal?symbol=${encodeURIComponent(entry.ticker)}`);
  }, [navigate]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectSuggestion(suggestions[activeIndex]);
      return;
    }
    if (searchVal.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`);
      setSearchVal("");
      setSuggestions([]);
      setDropdownOpen(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setActiveIndex(-1);
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

        {/* Instagram + Feedback — between logo and tabs */}
        <div className="flex items-stretch border-r border-border shrink-0">
          <a
            href="https://instagram.com/dino_labs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 text-[11px] font-semibold text-[#E1306C] hover:bg-pink-500/8 transition-colors"
            data-testid="link-instagram-pc"
          >
            <InstagramIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:block">dino_labs</span>
          </a>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="flex items-center gap-1 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
            data-testid="button-pc-feedback"
          >
            <Megaphone className="w-3 h-3 shrink-0" />
            <span className="hidden lg:block">피드백</span>
          </button>
        </div>

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

        {/* Search with autocomplete */}
        <div ref={containerRef} className="flex items-center px-2.5 border-l border-border shrink-0 relative">
          <form onSubmit={handleSearch} className="flex items-center">
            <div className="relative flex items-center">
              <Search className="w-3 h-3 absolute left-2 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setDropdownOpen(true);
                }}
                placeholder={lang === "ko" ? "종목... AAPL, 삼성" : lang === "ja" ? "銘柄..." : "Search..."}
                className="h-6 pl-6 pr-2.5 text-[11px] rounded border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 w-36 placeholder:text-muted-foreground/50 transition-all"
                data-testid="input-topbar-search"
                autoComplete="off"
              />
            </div>
          </form>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {dropdownOpen && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.1 }}
                className="absolute top-full right-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl z-[200] overflow-hidden"
                data-testid="search-autocomplete-dropdown"
              >
                {suggestions.map((entry, idx) => {
                  const displayTicker = getDisplayTicker(entry.ticker);
                  const exchangeLabel = getExchangeLabel(entry.ticker);
                  const badgeColor = EXCHANGE_COLORS[exchangeLabel] ?? "bg-muted text-muted-foreground";
                  const isActive = idx === activeIndex;

                  return (
                    <button
                      key={entry.ticker}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(entry);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        isActive ? "bg-primary/10" : "hover:bg-muted/60",
                        idx < suggestions.length - 1 && "border-b border-border/40"
                      )}
                      data-testid={`autocomplete-result-${entry.ticker}`}
                    >
                      {/* Names column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] font-semibold text-foreground truncate">
                            {lang === "ko" || lang === "ja" ? entry.ko : entry.en}
                          </span>
                        </div>
                        {(lang === "ko" || lang === "ja") && (
                          <p className="text-[10px] text-muted-foreground/60 truncate leading-tight">{entry.en}</p>
                        )}
                      </div>

                      {/* Ticker + exchange */}
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <span className="text-[11px] font-mono font-bold text-foreground/80">{displayTicker}</span>
                        <span className={cn("text-[9px] px-1 py-0.5 rounded font-semibold leading-none", badgeColor)}>
                          {exchangeLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Footer hint */}
                <div className="px-3 py-1.5 bg-muted/30 border-t border-border/40 flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground/50">
                    {lang === "ko" ? "↑↓ 탐색  ↵ 선택  Esc 닫기" : "↑↓ navigate  ↵ select  Esc close"}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 ml-auto">
                    {lang === "ko" ? "Enter: 전체 검색" : "Enter: full search"}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
