import { cn } from "@/lib/utils";

interface ProgressBarProps {
  current: number;
  max: number;
  color?: "primary" | "secondary" | "accent";
  className?: string;
  showText?: boolean;
}

export function ProgressBar({ current, max, color = "primary", className, showText = true }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  
  const colorMap = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    accent: "bg-accent",
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">
        {showText && <span>Progress</span>}
        {showText && <span>{Math.round(percentage)}%</span>}
      </div>
      <div className="h-4 w-full bg-muted rounded-full overflow-hidden shadow-inner border border-white/5">
        <div 
          className={cn("h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)]", colorMap[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
