import { Trophy, Medal, User, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

interface LeaderboardEntry {
  id: string;
  nickname: string;
  totalXp: number;
  level: number;
  streak: number;
  isMe: boolean;
}

export default function Leaderboard() {
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const isKo = lang === "ko";

  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const allEntries = leaderboard || [];
  const top10 = allEntries.slice(0, 10);
  const myEntry = allEntries.find(u => u.isMe);
  const myRank = myEntry ? allEntries.indexOf(myEntry) + 1 : null;
  const isMyEntryInTop10 = myRank !== null && myRank <= 10;

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto w-full pb-28">
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-4" data-testid="text-leaderboard-title">
          {isKo ? "리더보드" : "Leaderboard"}
        </h1>
        <p className="text-muted-foreground text-lg" data-testid="text-leaderboard-subtitle">
          {isKo ? "Top 10 트레이더 순위입니다." : "Top 10 traders ranking."}
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
          {top10.map((u, idx) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "flex items-center gap-3 p-4 md:grid md:grid-cols-12 md:gap-4 md:p-6 transition-colors",
                u.isMe ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
              )}
              data-testid={`row-leaderboard-${idx}`}
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
                <div className={cn(
                  "w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 border",
                  u.isMe ? "bg-primary/20 border-primary/30" : "bg-background border-border"
                )}>
                  <User className={cn("w-4 h-4 md:w-5 md:h-5", u.isMe ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm md:text-lg flex items-center gap-2 flex-wrap">
                    <span className="truncate">{u.nickname}</span>
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
                  {u.totalXp.toLocaleString()}
                </div>
              </div>
            </motion.div>
          ))}

          {top10.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {isKo ? "아직 랭킹 데이터가 없습니다." : "No ranking data yet."}
            </div>
          )}
        </div>
      </div>

      {myEntry && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] md:left-[var(--sidebar-width,16rem)]" data-testid="sticky-my-rank">
          <div className="max-w-4xl mx-auto flex items-center gap-3 p-4 md:px-10">
            <div className="shrink-0 flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{isKo ? "내 순위" : "My Rank"}</div>
                <div className="font-bold text-lg text-primary" data-testid="text-my-rank">#{myRank}</div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{myEntry.nickname}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {isKo ? `${myEntry.streak}일 연속` : `${myEntry.streak} day streak`} <Flame className="w-3 h-3 text-orange-500" />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-xs text-muted-foreground">{isKo ? "레벨" : "Level"}</div>
              <div className="font-bold text-secondary">{myEntry.level}</div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-xs text-muted-foreground">{isKo ? "총 XP" : "Total XP"}</div>
              <div className="font-mono font-bold" data-testid="text-my-xp">{myEntry.totalXp.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
