import { Link, useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { LayoutDashboard, Target, LineChart, Award, Settings, LogOut, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const navItems = [
    { href: "/", label: t.dashboard, icon: LayoutDashboard },
    { href: "/quests", label: t.quests, icon: Target },
    { href: "/watchlist", label: t.watchlist, icon: LineChart },
    { href: "/market-trends", label: t.market_trends, icon: TrendingUp },
    { href: "/leaderboard", label: t.leaderboard, icon: Award },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-card border-r border-border p-6 z-50">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary animate-bounce-slow">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
             <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
             <path d="M2 16h12" />
             <path d="M7 8V5a3 3 0 0 1 6 0v3" />
             <path d="M12 8c4.4 0 8 3.6 8 8" />
             <path d="M22 16h-2" />
             <path d="M17 13l3-3 3 3" />
           </svg>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dinolingo</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-2xl text-base font-semibold transition-all duration-200 group",
            location === item.href 
              ? "bg-primary/10 text-primary shadow-[0_0_20px_rgba(34,197,94,0.15)]" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}>
            <item.icon className={cn(
              "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
              location === item.href && "fill-current"
            )} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-border pt-6">
         <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium" data-testid="link-settings">
            <Settings className="w-5 h-5" />
            {t.settings}
         </Link>
         <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors font-medium cursor-not-allowed opacity-50" data-testid="button-logout">
            <LogOut className="w-5 h-5" />
            {t.logout}
         </button>
      </div>
    </aside>
  );
}
