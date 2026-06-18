import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";
import { Terminal, Target, LineChart, Settings, LogOut, TrendingUp, Sparkles, Calendar, Briefcase, Search, Zap, Newspaper, BarChart2, Brain, MessageCircle, BookOpen, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { FeedbackModal } from "@/components/FeedbackModal";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { logout, isLoggingOut } = useAuth();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const navItems = [
    { href: "/hot-issues", label: lang === "ko" ? "실시간 뉴스" : lang === "ja" ? "ライブニュース" : "Live News", icon: Newspaper },
    { href: "/terminal", label: lang === "ko" ? "다이노터미널" : lang === "ja" ? "ターミナル" : "DinoTerminal", icon: Terminal },
    { href: "/quests", label: lang === "ko" ? "퀘스트" : t.quests, icon: Target },
    { href: "/market-trends", label: lang === "ko" ? "시장 동향" : t.market_trends, icon: TrendingUp },
    { href: "/search", label: lang === "ko" ? "종목 검색" : t.search_tab, icon: Search },
    { href: "/watchlist", label: lang === "ko" ? "관심 종목" : t.watchlist, icon: LineChart },
    { href: "/recommended", label: lang === "ko" ? "추천 종목" : "Recommendations", icon: Sparkles },
    { href: "/calendar", label: lang === "ko" ? "경제 캘린더" : "Economic Calendar", icon: Calendar },
    { href: "/investors", label: lang === "ko" ? "슈퍼 투자자" : t.super_investors, icon: Briefcase },
    { href: "/chart-master", label: lang === "ko" ? "차트 마스터" : lang === "ja" ? "チャートマスター" : "Chart Master", icon: BookOpen },
    { href: "/earnings", label: lang === "ko" ? "실적 Live" : lang === "ja" ? "決算ライブ" : "Earnings Live", icon: BarChart2 },
    { href: "/ai-portfolio", label: lang === "ko" ? "AI 포트폴리오" : lang === "ja" ? "AIポートフォリオ" : "AI Portfolio", icon: Brain },
    { href: "/chat", label: lang === "ko" ? "AI 주식 챗봇" : lang === "ja" ? "AI株式チャット" : "AI Stock Chat", icon: MessageCircle },
    { href: "/pro", label: lang === "ko" ? "프로 대시보드" : "Pro Dashboard", icon: Zap },
  ];

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 h-screen fixed left-0 top-0 bg-sidebar border-r border-sidebar-border z-50">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border shrink-0">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-[12px] font-black">
            D
          </div>
          <h1 className="text-[15px] font-display font-bold text-foreground tracking-tight">DinoInvest</h1>
        </div>

        {/* Instagram + Feedback strip */}
        <div className="px-3 py-2 border-b border-sidebar-border space-y-0.5">
          <a
            href="https://www.instagram.com/dino_labs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all group"
            data-testid="link-instagram"
          >
            <InstagramIcon className="w-3.5 h-3.5 shrink-0 text-[#E1306C] group-hover:text-[#E1306C]" />
            <span className="text-[#E1306C] font-semibold">dino_labs</span>
          </a>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all text-left"
            data-testid="button-open-feedback"
          >
            <Megaphone className="w-3.5 h-3.5 shrink-0" />
            {lang === "ko" ? "DinoLab에 Signal 보내기" : lang === "ja" ? "DinoLabにSignalを送る" : "Signal DinoLab"}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = item.href === "/hot-issues"
              ? (location === "/" || location === "/hot-issues" || location.startsWith("/hot-issues"))
              : location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 group",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <item.icon className={cn(
                  "w-4 h-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-3 py-3 space-y-0.5">
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all" data-testid="link-settings">
            <Settings className="w-4 h-4 shrink-0" />
            {t.settings}
          </Link>
          <button
            onClick={() => { localStorage.clear(); logout(); }}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-all disabled:opacity-50"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isLoggingOut ? "..." : t.logout}
          </button>
        </div>
      </aside>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
