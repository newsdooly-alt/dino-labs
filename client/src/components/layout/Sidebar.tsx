import { Link, useLocation } from "wouter";
import { LayoutDashboard, Target, LineChart, Award, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/quests", label: "Quests", icon: Target },
    { href: "/watchlist", label: "Watchlist", icon: LineChart },
    { href: "/leaderboard", label: "Leaderboard", icon: Award },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-card border-r border-border p-6 z-50">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary animate-bounce-slow">
           {/* Simple Owl Icon Construction */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
             <path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
             <path d="M12 12a5 5 0 0 0-5 5v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2a5 5 0 0 0-5-5z" />
             <path d="M16 12a5 5 0 0 1 4 4v2" />
             <path d="M8 12a5 5 0 0 0-4 4v2" />
           </svg>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">StockHero</h1>
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
         <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium">
            <Settings className="w-5 h-5" />
            Settings
         </Link>
         <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors font-medium cursor-not-allowed opacity-50">
            <LogOut className="w-5 h-5" />
            Logout
         </button>
      </div>
    </aside>
  );
}
