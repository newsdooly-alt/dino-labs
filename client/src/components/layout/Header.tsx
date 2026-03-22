import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { Flame, Zap, User as UserIcon, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { MobileMenu } from "@/components/MobileMenu";
import { translations } from "@/lib/translations";

export function Header() {
  const { data: user } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-lg border-b border-border px-4 md:px-6 py-4 flex items-center justify-between md:justify-end gap-4 md:gap-6">
        
        <div className="md:hidden flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
            aria-label={t.menu}
            data-testid="button-hamburger-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                 <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
              </svg>
            </div>
            <span className="font-display font-bold text-lg">DinoInvest</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Flame className={cn("w-4 h-4 md:w-5 md:h-5", user?.streak && user.streak > 0 && "fill-current animate-pulse")} />
            <span className="font-bold font-mono text-sm md:text-base">{user?.streak || 0}</span>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary">
            <Zap className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            <span className="font-bold font-mono text-sm md:text-base">{user?.xp || 0} <span className="hidden sm:inline">XP</span></span>
          </div>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer shrink-0"
            data-testid="button-profile"
          >
            <UserIcon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </button>
        </div>
      </header>

      <UserMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  );
}
