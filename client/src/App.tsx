import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TerminalTopBar } from "@/components/layout/TerminalTopBar";
import { IndexStrip } from "@/components/layout/IndexStrip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeColorProvider } from "@/contexts/ThemeColorContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { useAuth } from "@/hooks/use-auth";

// Pages
import TerminalMarkets from "@/pages/TerminalMarkets";
import Dashboard from "@/pages/Dashboard";
import Quests from "@/pages/Quests";
import Watchlist from "@/pages/Watchlist";
import MarketTrends from "@/pages/MarketTrends";
import StockDetail from "@/pages/StockDetail";
import Recommended from "@/pages/Recommended";
import Settings from "@/pages/Settings";
import Collection from "@/pages/Collection";
import Onboarding from "@/pages/Onboarding";
import Landing from "@/pages/Landing";
import EconomicCalendar from "@/pages/EconomicCalendar";
import SuperInvestors from "@/pages/SuperInvestors";
import GlobalSearch from "@/pages/GlobalSearch";
import AdvancedDashboard from "@/pages/AdvancedDashboard";
import HotIssues from "@/pages/HotIssues";
import EarningsLive from "@/pages/EarningsLive";
import AIPortfolio from "@/pages/AIPortfolio";
import StockChat from "@/pages/StockChat";
import ChartMaster from "@/pages/ChartMaster";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

// Desktop router (terminal tab routes)
function DesktopRouter() {
  return (
    <Switch>
      <Route path="/" component={TerminalMarkets} />
      <Route path="/quests" component={Quests} />
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/market-trends" component={MarketTrends} />
      <Route path="/calendar" component={EconomicCalendar} />
      <Route path="/investors" component={SuperInvestors} />
      <Route path="/settings" component={Settings} />
      <Route path="/eggs" component={Collection} />
      <Route path="/collection" component={Collection} />
      <Route path="/recommended" component={Recommended} />
      <Route path="/search" component={GlobalSearch} />
      <Route path="/stock/:symbol" component={StockDetail} />
      <Route path="/pro" component={AdvancedDashboard} />
      <Route path="/hot-issues" component={HotIssues} />
      <Route path="/earnings" component={EarningsLive} />
      <Route path="/ai-portfolio" component={AIPortfolio} />
      <Route path="/chat" component={StockChat} />
      <Route path="/chart-master" component={ChartMaster} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Mobile router (same pages but scrollable)
function MobileRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/quests" component={Quests} />
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/market-trends" component={MarketTrends} />
      <Route path="/calendar" component={EconomicCalendar} />
      <Route path="/investors" component={SuperInvestors} />
      <Route path="/settings" component={Settings} />
      <Route path="/eggs" component={Collection} />
      <Route path="/collection" component={Collection} />
      <Route path="/recommended" component={Recommended} />
      <Route path="/search" component={GlobalSearch} />
      <Route path="/stock/:symbol" component={StockDetail} />
      <Route path="/pro" component={AdvancedDashboard} />
      <Route path="/hot-issues" component={HotIssues} />
      <Route path="/earnings" component={EarningsLive} />
      <Route path="/ai-portfolio" component={AIPortfolio} />
      <Route path="/chat" component={StockChat} />
      <Route path="/chart-master" component={ChartMaster} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout({ children }: { children?: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const complete = localStorage.getItem("onboarding_complete");
    if (!complete) setShowOnboarding(true);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboarding_complete", "true");
    setShowOnboarding(false);
  };

  return (
    <>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

      {/* ─── DESKTOP: Terminal layout (full-height, no scroll on outer) ─── */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden bg-background text-foreground">
        <TerminalTopBar />
        <IndexStrip />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <DesktopRouter />
        </main>
      </div>

      {/* ─── MOBILE: Classic scrollable layout ──────────────────────────── */}
      <div className="md:hidden min-h-screen bg-background text-foreground">
        <TerminalTopBar />
        <main className="flex-1">
          <MobileRouter />
        </main>
      </div>
    </>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <TimezoneProvider>
            <ThemeColorProvider>
              <TooltipProvider>
                <AppContent />
                <Toaster />
              </TooltipProvider>
            </ThemeColorProvider>
          </TimezoneProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
