import { motion } from "framer-motion";
import { Sparkles, Trophy, Lock } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useEggs, type Dino } from "@/hooks/use-eggs";
import { translations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function DinoCard({ dino, isUnlocked, t }: { dino: Omit<Dino, "unlockedAt"> & { unlockedAt?: number }; isUnlocked: boolean; t: Record<string, string> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={isUnlocked ? { scale: 1.02 } : {}}
      className={cn(
        "bg-card border border-border rounded-2xl p-5 relative overflow-hidden transition-all",
        !isUnlocked && "opacity-60"
      )}
      data-testid={`dino-card-${dino.id}`}
    >
      {!isUnlocked && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-2xl">
          <div className="text-center">
            <Lock className="w-8 h-8 text-white/70 mx-auto mb-2" />
            <span className="text-sm text-white/70">{t.egg_locked}</span>
          </div>
        </div>
      )}
      
      <div className="flex items-start gap-4">
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: dino.color + "20" }}
        >
          <svg viewBox="0 0 64 64" className="w-10 h-10">
            <circle cx="32" cy="32" r="28" fill={dino.color} />
            <circle cx="24" cy="26" r="5" fill="white" />
            <circle cx="40" cy="26" r="5" fill="white" />
            <circle cx="24" cy="27" r="2.5" fill="#1a1a1a" />
            <circle cx="40" cy="27" r="2.5" fill="#1a1a1a" />
            <path d="M24 42 Q32 50 40 42" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg" style={{ color: isUnlocked ? dino.color : undefined }} data-testid={`text-dino-name-${dino.id}`}>
              {t[dino.translationKey as keyof typeof t]}
            </h3>
            {isUnlocked && (
              <Sparkles className="w-4 h-4 text-yellow-500" />
            )}
          </div>
          
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2",
            dino.rarity === "common" && "bg-gray-500/20 text-gray-600 dark:text-gray-400",
            dino.rarity === "rare" && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
            dino.rarity === "epic" && "bg-purple-500/20 text-purple-600 dark:text-purple-400",
            dino.rarity === "legendary" && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
          )} data-testid={`badge-dino-rarity-${dino.id}`}>
            {dino.rarity === "common" && t.egg_common}
            {dino.rarity === "rare" && t.egg_rare}
            {dino.rarity === "epic" && t.egg_epic}
            {dino.rarity === "legendary" && t.egg_legendary}
          </div>
          
          {isUnlocked && (
            <p className="text-sm text-muted-foreground" data-testid={`text-dino-fact-${dino.id}`}>
              {t[dino.factKey as keyof typeof t]}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Collection() {
  const { data: user } = useUser();
  const { collection, dinoCatalog, totalEggsHatched } = useEggs();
  
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang] as Record<string, string>;
  
  const unlockedIds = collection.map(d => d.id);
  
  const sortedDinos = dinoCatalog.map(catalogDino => {
    const unlockedDino = collection.find(d => d.id === catalogDino.id);
    return {
      ...catalogDino,
      unlockedAt: unlockedDino?.unlockedAt,
      isUnlocked: unlockedIds.includes(catalogDino.id),
    };
  }).sort((a, b) => {
    if (a.isUnlocked && !b.isUnlocked) return -1;
    if (!a.isUnlocked && b.isUnlocked) return 1;
    return 0;
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/10 rounded-2xl flex items-center justify-center">
          <Trophy className="w-8 h-8 text-purple-500" />
        </div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-collection-title">{t.collection_title}</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-collection-subtitle">{t.collection_subtitle}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-4 mb-8"
      >
        <div className="bg-card border border-border rounded-xl p-4 text-center" data-testid="card-unlocked-stats">
          <div className="text-3xl font-bold text-purple-500" data-testid="text-unlocked-count">
            {collection.length}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="label-unlocked">{t.dinos_unlocked}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center" data-testid="card-total-hatched">
          <div className="text-3xl font-bold text-green-500" data-testid="text-total-hatched">
            {totalEggsHatched}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="label-total-hatched">{t.total_eggs_hatched}</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(collection.length / dinoCatalog.length) * 100}%` }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            />
          </div>
          <span className="text-sm font-medium" data-testid="text-collection-progress">
            {collection.length}/{dinoCatalog.length}
          </span>
        </div>
      </motion.div>

      {collection.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 bg-muted/50 rounded-full flex items-center justify-center">
            <Trophy className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-collection-empty">{t.collection_empty}</h3>
          <p className="text-muted-foreground mb-4" data-testid="text-collection-empty-hint">{t.collection_empty_hint}</p>
          <Link href="/eggs">
            <Button data-testid="button-go-to-eggs">
              {t.my_eggs}
            </Button>
          </Link>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {sortedDinos.map((dino, index) => (
            <motion.div
              key={dino.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <DinoCard
                dino={dino}
                isUnlocked={dino.isUnlocked}
                t={t}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
