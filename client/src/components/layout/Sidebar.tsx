import { Link, useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";
import { Terminal, Target, LineChart, Settings, LogOut, TrendingUp, Sparkles, Calendar, Briefcase, Search, Zap, Newspaper, BarChart2, Brain, MessageCircle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { logout, isLoggingOut } = useAuth();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];

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
    <aside className="hidden md:flex flex-col w-60 h-screen fixed left-0 top-0 bg-sidebar border-r border-sidebar-border z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border shrink-0">
        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-[12px] font-black">
          D
        </div>
        <h1 className="text-[15px] font-display font-bold text-foreground tracking-tight">DinoInvest</h1>
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
  );
}
