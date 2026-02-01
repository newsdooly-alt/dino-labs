import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

// Pages
import Dashboard from "@/pages/Dashboard";
import Quests from "@/pages/Quests";
import Watchlist from "@/pages/Watchlist";
import Leaderboard from "@/pages/Leaderboard";
import MarketTrends from "@/pages/MarketTrends";
import StockDetail from "@/pages/StockDetail";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/quests" component={Quests} />
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/market-trends" component={MarketTrends} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/stock/:symbol" component={StockDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const complete = localStorage.getItem("onboarding_complete");
    if (!complete) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {showOnboarding && <Onboarding />}
      <Sidebar />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Layout>
          <Router />
        </Layout>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
