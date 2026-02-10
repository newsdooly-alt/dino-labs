import { Trophy, Medal, User, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";

const mockUsers = [
  { id: 2, username: "BullMarketKing", xp: 12500, level: 42, streak: 12 },
  { id: 1, username: "DinoExplorer", xp: 8450, level: 28, streak: 5, isMe: true },
  { id: 3, username: "CryptoQueen", xp: 7200, level: 24, streak: 8 },
  { id: 4, username: "DiamondHands", xp: 6100, level: 21, streak: 3 },
  { id: 5, username: "WallStreetWolf", xp: 4500, level: 15, streak: 0 },
];

export default function Leaderboard() {
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const isKo = lang === "ko";

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto w-full">
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-4" data-testid="text-leaderboard-title">
          {isKo ? "리더보드" : "Leaderboard"}
        </h1>
        <p className="text-muted-foreground text-lg" data-testid="text-leaderboard-subtitle">
          {isKo ? "다른 트레이더들과 비교해보세요." : "See how you stack up against other traders."}
        </p>
      </div>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
        <div className="hidden md:grid grid-cols-12 gap-4 p-6 border-b border-border bg-muted/30 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-2 text-center">{isKo ? "순위" : "Rank"}</div>
          <div className="col-span-6">{isKo ? "사용자" : "User"}</div>
          <div className="col-span-2 text-center">{isKo ? "레벨" : "Level"}</div>
          <div className="col-span-2 text-right">{isKo ? "총 XP" : "Total XP"}</div>
        </div>

        <div className="divide-y divide-border">
          {mockUsers.map((u, idx) => (
            <div 
              key={u.id} 
              className={cn(
                "flex items-center gap-3 p-4 md:grid md:grid-cols-12 md:gap-4 md:p-6 transition-colors",
                u.isMe ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
              )}
              data-testid={`row-leaderboard-${u.id}`}
            >
              <div className="shrink-0 md:col-span-2 md:flex md:justify-center">
                {idx === 0 ? (
                  <Trophy className="w-7 h-7 md:w-8 md:h-8 text-yellow-400 fill-current animate-bounce" />
                ) : idx === 1 ? (
                  <Medal className="w-7 h-7 md:w-8 md:h-8 text-gray-300 fill-current" />
                ) : idx === 2 ? (
                  <Medal className="w-7 h-7 md:w-8 md:h-8 text-amber-600 fill-current" />
                ) : (
                  <span className="font-mono font-bold text-lg md:text-xl text-muted-foreground">#{idx + 1}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0 md:col-span-6 flex items-center gap-3 md:gap-4">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm md:text-lg flex items-center gap-2 flex-wrap">
                    <span className="truncate">{u.username}</span>
                    {u.isMe && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full shrink-0">{isKo ? "나" : "You"}</span>}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                    {isKo ? `${u.streak}일 연속` : `${u.streak} day streak`} <Flame className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />
                  </div>
                </div>
              </div>
              
              <div className="shrink-0 text-right md:col-span-2 md:text-center">
                <div className="text-xs text-muted-foreground md:hidden">{isKo ? "레벨" : "Lv"}</div>
                <div className="font-bold text-sm md:text-lg text-secondary">
                  {u.level}
                </div>
              </div>
              
              <div className="shrink-0 text-right md:col-span-2">
                <div className="text-xs text-muted-foreground md:hidden">XP</div>
                <div className="font-mono font-bold text-sm md:text-base">
                  {u.xp.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
