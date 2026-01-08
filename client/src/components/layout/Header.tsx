import { useUser, useUpdateLanguage } from "@/hooks/use-user";
import { Flame, Zap, User as UserIcon, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function Header() {
  const { data: user } = useUser();
  const updateLanguage = useUpdateLanguage();

  const handleLanguageChange = (lang: 'en' | 'ko') => {
    updateLanguage.mutate(lang);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-lg border-b border-border px-6 py-4 flex items-center justify-between md:justify-end gap-6">
      
      {/* Mobile Title only visible on small screens */}
      <div className="md:hidden flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
             <path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
          </svg>
        </div>
        <span className="font-display font-bold text-lg">StockHero</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Globe className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleLanguageChange('en')}>
              English {user?.language === 'en' && "✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange('ko')}>
              한국어 {user?.language === 'ko' && "✓"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Streak Counter */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
          <Flame className={cn("w-5 h-5", user?.streak && user.streak > 0 && "fill-current animate-pulse")} />
          <span className="font-bold font-mono">{user?.streak || 0}</span>
        </div>

        {/* XP Counter */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary">
          <Zap className="w-5 h-5 fill-current" />
          <span className="font-bold font-mono">{user?.xp || 0} XP</span>
        </div>

        {/* Profile */}
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer">
          <UserIcon className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
