import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { Flame, Zap, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";

export function Header() {
  const { data: user } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-lg border-b border-border px-6 py-4 flex items-center justify-between md:justify-end gap-6">
        
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
               <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
            </svg>
          </div>
          <span className="font-display font-bold text-lg">Dinolingo</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
            <Flame className={cn("w-5 h-5", user?.streak && user.streak > 0 && "fill-current animate-pulse")} />
            <span className="font-bold font-mono">{user?.streak || 0}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary">
            <Zap className="w-5 h-5 fill-current" />
            <span className="font-bold font-mono">{user?.xp || 0} XP</span>
          </div>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer"
            data-testid="button-profile"
          >
            <UserIcon className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      <UserMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}
