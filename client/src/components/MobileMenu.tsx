import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Home, Target, TrendingUp, Wallet, User, Settings, Calendar, Briefcase, Search, Newspaper, BarChart2, Brain, MessageCircle, BookOpen, Terminal, Megaphone } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { FeedbackModal } from "@/components/FeedbackModal";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

const menuItems = [
  { path: "/hot-issues",   icon: Newspaper, translationKey: "mobile_menu_hot_issues" as const, highlight: true },
  { path: "/terminal",     icon: Terminal,  translationKey: "mobile_menu_terminal" as const },
  { path: "/quests",       icon: Target,   translationKey: "mobile_menu_quests" as const },
  { path: "/market-trends",icon: TrendingUp,translationKey: "mobile_menu_trends" as const },
  { path: "/search",       icon: Search,   translationKey: "mobile_menu_search" as const },
  { path: "/portfolio",    icon: Wallet,   translationKey: "mobile_menu_portfolio" as const },
  { path: "/calendar",     icon: Calendar,  translationKey: "mobile_menu_calendar" as const },
  { path: "/earnings",     icon: BarChart2, translationKey: "mobile_menu_earnings" as const },
  { path: "/ai-portfolio", icon: Brain,    translationKey: "mobile_menu_ai_portfolio" as const },
  { path: "/chat",         icon: MessageCircle, translationKey: "mobile_menu_chat" as const },
  { path: "/investors",    icon: Briefcase,translationKey: "mobile_menu_investors" as const },
  { path: "/chart-master", icon: BookOpen,  translationKey: "mobile_menu_chart_master" as const },
  { path: "/settings",     icon: Settings, translationKey: "mobile_menu_settings" as const },
];

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const [location] = useLocation();
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleNavigation = () => {
    onClose();
  };

  return (
    <>
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
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-primary">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
                        <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
                      </svg>
                    </div>
                    <span className="font-display font-bold text-xl text-white">DinoInvest</span>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors touch-manipulation"
                    aria-label={t.close_menu}
                    data-testid="button-close-mobile-menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Instagram + Feedback strip */}
                <div className="px-3 py-2 border-b border-border flex gap-2">
                  <a
                    href="https://www.instagram.com/dino_labs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#f9ce34]/10 via-[#ee2a7b]/10 to-[#6228d7]/10 border border-[#ee2a7b]/20 hover:border-[#ee2a7b]/40 transition-colors"
                    data-testid="link-mobile-instagram"
                  >
                    <InstagramIcon className="w-4 h-4 shrink-0 text-[#E1306C]" />
                    <span className="text-[12px] font-semibold text-[#E1306C]">dino_labs</span>
                  </a>
                  <button
                    onClick={() => { onClose(); setTimeout(() => setFeedbackOpen(true), 320); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                    data-testid="button-mobile-feedback"
                  >
                    <Megaphone className="w-4 h-4 text-primary" />
                    <span className="text-[12px] font-semibold text-primary">Signal</span>
                  </button>
                </div>

                <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                  {menuItems.map((item) => {
                    const isActive = location === item.path;
                    const Icon = item.icon;
                    const isHighlight = (item as any).highlight;
                    
                    return (
                      <Link key={item.path} href={item.path}>
                        <button
                          onClick={handleNavigation}
                          className={cn(
                            "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all duration-200",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                              : isHighlight
                              ? "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
                              : "text-foreground hover-elevate"
                          )}
                          data-testid={`mobile-nav-${item.path.replace("/", "") || "dashboard"}`}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isActive ? "bg-white/20" : isHighlight ? "bg-primary/20" : "bg-primary/10"
                          )}>
                            <Icon className={cn(
                              "w-5 h-5",
                              isActive ? "text-white" : "text-primary"
                            )} />
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            <span className="font-medium text-base">{t[item.translationKey]}</span>
                            {isHighlight && !isActive && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground uppercase tracking-wide">NEW</span>
                            )}
                          </div>
                        </button>
                      </Link>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-border">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
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

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
