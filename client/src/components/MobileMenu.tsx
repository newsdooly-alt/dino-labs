import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Home, Target, TrendingUp, Star, User, Settings, Trophy, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { cn } from "@/lib/utils";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { path: "/", icon: Home, translationKey: "mobile_menu_dashboard" as const },
  { path: "/quests", icon: Target, translationKey: "mobile_menu_quests" as const },
  { path: "/collection", icon: Trophy, translationKey: "mobile_menu_collection" as const },
  { path: "/market-trends", icon: TrendingUp, translationKey: "mobile_menu_trends" as const },
  { path: "/recommended", icon: Sparkles, translationKey: "mobile_menu_recommended" as const },
  { path: "/watchlist", icon: Star, translationKey: "mobile_menu_watchlist" as const },
  { path: "/leaderboard", icon: User, translationKey: "mobile_menu_profile" as const },
  { path: "/settings", icon: Settings, translationKey: "mobile_menu_settings" as const },
];

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const [location] = useLocation();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const handleNavigation = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
            onClick={onClose}
            data-testid="mobile-menu-backdrop"
          />
          
          <motion.nav
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 h-full w-72 bg-card border-r border-border shadow-2xl z-50 md:hidden overflow-hidden"
            data-testid="mobile-menu-sidebar"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-green-600 to-emerald-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
                      <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
                    </svg>
                  </div>
                  <span className="font-display font-bold text-xl text-white">Dinolingo</span>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  aria-label={t.close_menu}
                  data-testid="button-close-mobile-menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 py-4 px-3 space-y-1">
                {menuItems.map((item) => {
                  const isActive = location === item.path;
                  const Icon = item.icon;
                  
                  return (
                    <Link key={item.path} href={item.path}>
                      <button
                        onClick={handleNavigation}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all duration-200",
                          isActive
                            ? "bg-green-600 text-white shadow-lg shadow-green-600/30"
                            : "text-foreground hover-elevate"
                        )}
                        data-testid={`mobile-nav-${item.path.replace("/", "") || "dashboard"}`}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isActive
                            ? "bg-white/20"
                            : "bg-green-600/10"
                        )}>
                          <Icon className={cn(
                            "w-5 h-5",
                            isActive ? "text-white" : "text-green-600"
                          )} />
                        </div>
                        <span className="font-medium text-base">{t[item.translationKey]}</span>
                      </button>
                    </Link>
                  );
                })}
              </div>

              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user?.username || "Guest"}</p>
                    <p className="text-xs text-muted-foreground">{t.level} {user?.level || 1}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
