import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Egg, Award, ChartLine, Users, TrendingUp, Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Egg className="w-6 h-6 text-primary" />
            </div>
            <span className="font-bold text-xl">US Stock Hero</span>
          </div>
          <Button asChild data-testid="button-login-nav">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      <main className="pt-20">
        <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Learn Stocks the
                <span className="text-primary block">Fun Way</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                Master the US stock market with daily quests, collect dinosaur eggs, 
                and hatch unique dinos while learning to invest like a pro!
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild className="shadow-lg" data-testid="button-get-started">
                  <a href="/api/login">Get Started Free</a>
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Award className="w-4 h-4 text-primary" />
                  Free forever
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-primary" />
                  Join thousands of learners
                </span>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-3xl" />
              <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20">
                <div className="text-center space-y-3">
                  <Egg className="w-20 h-20 md:w-28 md:h-28 text-primary mx-auto" />
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    <span className="font-bold text-lg">Dino</span>
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">Your Stock Learning Buddy</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="font-serif text-3xl font-bold text-center mb-12">
            Why You'll Love Learning With Dino
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 bg-background/50 hover:bg-background transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Daily Quests</h3>
              <p className="text-muted-foreground">
                Complete fun quizzes about financial terms, chart patterns, 
                and market news. Learn something new every day!
              </p>
            </Card>

            <Card className="p-6 bg-background/50 hover:bg-background transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <Egg className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Collect Dino Eggs</h3>
              <p className="text-muted-foreground">
                Earn mystery eggs by completing quests. Watch them hatch into 
                unique dinosaurs with fun trading-themed facts!
              </p>
            </Card>

            <Card className="p-6 bg-background/50 hover:bg-background transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <ChartLine className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Real Market Data</h3>
              <p className="text-muted-foreground">
                Track real stocks, view live charts, and build your watchlist. 
                Practice with actual market conditions!
              </p>
            </Card>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="bg-primary/10 rounded-3xl p-8 md:p-12">
            <h2 className="font-serif text-3xl font-bold mb-4">
              Ready to Start Your Journey?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Join now and get your first mystery egg when you complete your daily quests!
            </p>
            <Button size="lg" asChild data-testid="button-join-now">
              <a href="/api/login">Join Now - It's Free!</a>
            </Button>
          </div>
        </section>

        <footer className="border-t border-border/50 py-8 mt-16">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>© 2026 US Stock Hero. Learn investing the fun way.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
