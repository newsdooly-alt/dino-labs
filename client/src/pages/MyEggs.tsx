import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Egg, Sparkles, Lock, CheckCircle, Gift } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useEggs, type Egg as EggType, type Dino } from "@/hooks/use-eggs";
import { translations } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { Link } from "wouter";

function EggIcon({ rarity, className }: { rarity: string; className?: string }) {
  const colors: Record<string, string> = {
    common: "#a3e635",
    rare: "#38bdf8",
    epic: "#a855f7",
    legendary: "#fbbf24",
    mystery: "#f472b6",
  };
  
  return (
    <svg viewBox="0 0 64 80" className={className} fill="none">
      <ellipse cx="32" cy="45" rx="28" ry="32" fill={colors[rarity] || colors.common} />
      <ellipse cx="32" cy="45" rx="22" ry="26" fill="white" fillOpacity="0.3" />
      <ellipse cx="24" cy="35" rx="6" ry="8" fill="white" fillOpacity="0.4" />
      <path d="M12 45c0-16 10-32 20-32s20 16 20 32" stroke="white" strokeWidth="2" strokeOpacity="0.5" fill="none" />
      {rarity === "mystery" && (
        <text x="32" y="50" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">?</text>
      )}
    </svg>
  );
}

function DinoAvatar({ dino, size = "lg" }: { dino: Dino; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "w-24 h-24" : "w-16 h-16";
  
  return (
    <div 
      className={cn(sizeClass, "rounded-full flex items-center justify-center")}
      style={{ backgroundColor: dino.color + "20" }}
    >
      <svg viewBox="0 0 64 64" className={size === "lg" ? "w-16 h-16" : "w-10 h-10"}>
        <circle cx="32" cy="32" r="28" fill={dino.color} />
        <circle cx="24" cy="26" r="5" fill="white" />
        <circle cx="40" cy="26" r="5" fill="white" />
        <circle cx="24" cy="27" r="2.5" fill="#1a1a1a" />
        <circle cx="40" cy="27" r="2.5" fill="#1a1a1a" />
        <path d="M24 42 Q32 50 40 42" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="18" cy="32" rx="3" ry="4" fill={dino.color} opacity="0.6" />
        <ellipse cx="46" cy="32" rx="3" ry="4" fill={dino.color} opacity="0.6" />
      </svg>
    </div>
  );
}

interface HatchModalProps {
  dino: Dino;
  onClose: () => void;
  t: Record<string, string>;
}

function HatchModal({ dino, onClose, t }: HatchModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="bg-card border border-border rounded-3xl p-8 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-hatch-success"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <DinoAvatar dino={dino} size="lg" />
        </motion.div>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold mt-6 mb-2" data-testid="text-new-dino-title">
            {t.new_dino_unlocked}
          </h2>
          <p className="text-lg text-muted-foreground mb-4">
            {t.you_hatched} <span className="font-bold" style={{ color: dino.color }}>{t[dino.translationKey as keyof typeof t]}</span>
          </p>
          
          <div className="bg-muted/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-muted-foreground">{t.dino_fun_fact}</span>
            </div>
            <p className="text-sm" data-testid="text-dino-fact">{t[dino.factKey as keyof typeof t]}</p>
          </div>
          
          <Button
            onClick={onClose}
            className="w-full h-12"
            data-testid="button-close-hatch-modal"
          >
            {t.awesome}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function EggCard({ egg, onHatch, t }: { egg: EggType; onHatch: (id: string) => void; t: Record<string, string> }) {
  const progress = (egg.currentXp / egg.requiredXp) * 100;
  const isReady = egg.currentXp >= egg.requiredXp;
  
  const rarityLabels: Record<string, string> = {
    common: t.egg_common,
    rare: t.egg_rare,
    epic: t.egg_epic,
    legendary: t.egg_legendary,
    mystery: t.egg_mystery,
  };
  
  const statusColors: Record<string, string> = {
    locked: "bg-gray-500",
    incubating: "bg-amber-500",
    hatched: "bg-green-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "bg-card border border-border rounded-2xl p-4 relative overflow-hidden",
        isReady && "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
      )}
      data-testid={`egg-card-${egg.id}`}
    >
      {egg.status === "locked" && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
          <Lock className="w-8 h-8 text-white/70" />
        </div>
      )}
      
      {egg.status === "hatched" && (
        <div className="absolute top-2 right-2 z-10">
          <CheckCircle className="w-6 h-6 text-green-500" />
        </div>
      )}
      
      <div className="flex flex-col items-center">
        <motion.div
          animate={isReady ? { 
            rotate: [-2, 2, -2],
            transition: { repeat: Infinity, duration: 0.3 }
          } : {}}
          className="relative"
        >
          <EggIcon rarity={egg.rarity} className="w-20 h-24" />
          {isReady && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="w-6 h-6 text-yellow-400" />
            </motion.div>
          )}
        </motion.div>
        
        <div className="mt-3 text-center w-full">
          <p className="font-semibold text-sm" data-testid={`text-egg-rarity-${egg.id}`}>
            {rarityLabels[egg.rarity]}
          </p>
          
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white mt-1",
            statusColors[egg.status]
          )} data-testid={`badge-egg-status-${egg.id}`}>
            {egg.status === "locked" && t.egg_locked}
            {egg.status === "incubating" && (isReady ? t.egg_ready : t.egg_incubating)}
            {egg.status === "hatched" && t.egg_hatched}
          </div>
          
          {egg.status === "incubating" && (
            <div className="mt-3 space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {egg.currentXp} / {egg.requiredXp} {t.xp_to_hatch}
              </p>
            </div>
          )}
          
          {isReady && egg.status === "incubating" && (
            <Button
              size="sm"
              onClick={() => onHatch(egg.id)}
              className="mt-3 w-full"
              data-testid={`button-hatch-${egg.id}`}
            >
              <Gift className="w-4 h-4 mr-2" />
              {t.tap_to_hatch}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function MyEggs() {
  const { data: user } = useUser();
  const { eggs, collection, hatchEgg, canHatch, totalEggsHatched } = useEggs();
  const [hatchedDino, setHatchedDino] = useState<Dino | null>(null);
  
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang] as Record<string, string>;
  
  const incubatingEggs = eggs.filter(e => e.status === "incubating");

  const handleHatch = (eggId: string) => {
    if (!canHatch(eggId)) return;
    
    const dino = hatchEgg(eggId);
    if (dino) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [dino.color, "#22c55e", "#fbbf24"],
      });
      setHatchedDino(dino);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24 w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-2xl flex items-center justify-center">
          <Egg className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-eggs-title">{t.eggs_title}</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-eggs-subtitle">{t.eggs_subtitle}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-4 mb-8"
      >
        <div className="bg-card border border-border rounded-xl p-4 text-center" data-testid="card-incubating-stats">
          <div className="text-3xl font-bold text-amber-500" data-testid="text-incubating-count">
            {incubatingEggs.length}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="label-incubating">{t.egg_incubating}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center" data-testid="card-hatched-stats">
          <div className="text-3xl font-bold text-green-500" data-testid="text-hatched-count">
            {totalEggsHatched}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="label-hatched">{t.total_eggs_hatched}</p>
        </div>
      </motion.div>

      {incubatingEggs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 bg-muted/50 rounded-full flex items-center justify-center">
            <Egg className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-eggs">{t.no_eggs}</h3>
          <p className="text-muted-foreground mb-4" data-testid="text-no-eggs-hint">{t.no_eggs_hint}</p>
          <Link href="/quests">
            <Button data-testid="button-go-to-quests">
              {t.daily_quests}
            </Button>
          </Link>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
        >
          {incubatingEggs.map((egg) => (
            <EggCard
              key={egg.id}
              egg={egg}
              onHatch={handleHatch}
              t={t}
            />
          ))}
        </motion.div>
      )}

      {collection.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{t.dino_collection}</h2>
            <Link href="/collection">
              <Button variant="outline" size="sm" data-testid="button-view-collection">
                {t.view_all}
              </Button>
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {collection.slice(0, 5).map((dino) => (
              <div key={dino.id} className="flex-shrink-0">
                <DinoAvatar dino={dino} size="sm" />
              </div>
            ))}
            {collection.length > 5 && (
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-medium text-muted-foreground">+{collection.length - 5}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {hatchedDino && (
          <HatchModal
            dino={hatchedDino}
            onClose={() => setHatchedDino(null)}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
