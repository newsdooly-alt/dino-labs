import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-12 h-12 text-destructive" />
        </div>
        <h1 className="text-4xl font-display font-bold mb-4">404 Page Not Found</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          Looks like this page got delisted. Let's get you back to the market.
        </p>
        <Link href="/">
          <button className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-1 transition-all">
            Return to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
