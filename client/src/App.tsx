import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/use-auth";

// Pages
import Dashboard from "@/pages/Dashboard";
import Quests from "@/pages/Quests";
import Watchlist from "@/pages/Watchlist";
import Leaderboard from "@/pages/Leaderboard";
import MarketTrends from "@/pages/MarketTrends";
import StockDetail from "@/pages/StockDetail";
import Settings from "@/pages/Settings";
import MyEggs from "@/pages/MyEggs";
import Collection from "@/pages/Collection";
import Onboarding from "@/pages/Onboarding";
import Landing from "@/pages/Landing";
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
      <Route path="/settings" component={Settings} />
      <Route path="/eggs" component={MyEggs} />
      <Route path="/collection" component={Collection} />
      <Route path="/stock/:symbol" component={StockDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const complete = localStorage.getItem("onboarding_complete");
    if (!complete) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboarding_complete", "true");
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
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

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show loading state
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

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return <Landing />;
  }

  // Show app for authenticated users
  return (
    <AuthenticatedLayout>
      <Router />
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
