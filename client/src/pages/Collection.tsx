import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Trophy, Lock, Egg, Gift } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useEggs, DINO_CATALOG, EGG_VISUALS, type Dino, type Egg as EggType } from "@/hooks/use-eggs";
import { translations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import confetti from "canvas-confetti";

import dinoTrex from "../assets/images/dino-trex.png";
import dinoStego from "../assets/images/dino-stego.png";
import dinoPtero from "../assets/images/dino-ptero.png";
import dinoDiplo from "../assets/images/dino-diplo.png";
import dinoTrice from "../assets/images/dino-trice.png";
import dinoAnkylo from "../assets/images/dino-ankylo.png";
import dinoRaptor from "../assets/images/dino-raptor.png";
import dinoBronto from "../assets/images/dino-bronto.png";
import dinoSpino from "../assets/images/dino-spino.png";
import dinoParasaur from "../assets/images/dino-parasaur.png";

import eggSpeckled from "../assets/images/egg-speckled.png";
import eggGolden from "../assets/images/egg-golden.png";
import eggFrozen from "../assets/images/egg-frozen.png";
import eggVolcanic from "../assets/images/egg-volcanic.png";
import eggCrystal from "../assets/images/egg-crystal.png";
import eggMossy from "../assets/images/egg-mossy.png";

const DINO_IMAGES: Record<string, string> = {
  trex: dinoTrex,
  stego: dinoStego,
  ptero: dinoPtero,
  diplo: dinoDiplo,
  trice: dinoTrice,
  ankylo: dinoAnkylo,
  raptor: dinoRaptor,
  bronto: dinoBronto,
  spino: dinoSpino,
  parasaur: dinoParasaur,
};

const EGG_IMAGES: Record<string, string> = {
  speckled: eggSpeckled,
  golden: eggGolden,
  frozen: eggFrozen,
  volcanic: eggVolcanic,
  crystal: eggCrystal,
  mossy: eggMossy,
};

function EggCard({ egg, onHatch, t, lang }: { egg: EggType; onHatch: (id: string) => void; t: Record<string, string>; lang: string }) {
  const progress = (egg.currentXp / egg.requiredXp) * 100;
  const isReady = egg.currentXp >= egg.requiredXp;
  const eggVisualData = EGG_VISUALS.find(v => v.visual === egg.visual);
  const eggLabel = lang === "ko" ? (eggVisualData?.labelKo || "알") : (eggVisualData?.label || "Egg");

  const rarityLabels: Record<string, string> = {
    common: t.egg_common,
    rare: t.egg_rare,
    epic: t.egg_epic,
    legendary: t.egg_legendary,
    mystery: t.egg_mystery,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-card border border-border rounded-2xl p-4 relative",
        isReady && "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
      )}
      data-testid={`egg-card-${egg.id}`}
    >
      <div className="flex flex-col items-center">
        <motion.div
          animate={isReady ? {
            rotate: [-3, 3, -3],
            transition: { repeat: Infinity, duration: 0.3 }
          } : {}}
          className="relative w-20 h-20 mb-2"
        >
          <img
            src={EGG_IMAGES[egg.visual] || EGG_IMAGES.speckled}
            alt={eggLabel}
            className="w-full h-full object-contain"
          />
          {isReady && (
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </motion.div>
          )}
        </motion.div>

        <p className="font-semibold text-sm" data-testid={`text-egg-name-${egg.id}`}>{eggLabel}</p>
        <p className="text-xs text-muted-foreground">{rarityLabels[egg.rarity]}</p>

        <div className="mt-2 w-full space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {egg.currentXp} / {egg.requiredXp} XP
          </p>
        </div>

        {isReady && (
          <Button
            size="sm"
            onClick={() => onHatch(egg.id)}
            className="mt-2 w-full"
            data-testid={`button-hatch-${egg.id}`}
          >
            <Gift className="w-4 h-4 mr-1" />
            {t.tap_to_hatch}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function DinoCard({ dino, isUnlocked, t }: { dino: Omit<Dino, "unlockedAt"> & { unlockedAt?: number }; isUnlocked: boolean; t: Record<string, string> }) {
  const dinoImage = DINO_IMAGES[dino.id];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-card border border-border rounded-2xl p-4 relative",
        !isUnlocked && "opacity-50"
      )}
      data-testid={`dino-card-${dino.id}`}
    >
      {!isUnlocked && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-2xl">
          <Lock className="w-8 h-8 text-white/70" />
        </div>
      )}

      <div className="flex flex-col items-center">
        <div className="w-20 h-20 mb-2 relative">
          {dinoImage ? (
            <img
              src={dinoImage}
              alt={t[dino.translationKey as keyof typeof t] || dino.name}
              className={cn("w-full h-full object-contain rounded-xl", !isUnlocked && "grayscale")}
            />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ backgroundColor: dino.color + "20" }}
            >
              <svg viewBox="0 0 64 64" className="w-12 h-12">
                <circle cx="32" cy="32" r="28" fill={isUnlocked ? dino.color : "#888"} />
                <circle cx="24" cy="26" r="5" fill="white" />
                <circle cx="40" cy="26" r="5" fill="white" />
                <circle cx="24" cy="27" r="2.5" fill="#1a1a1a" />
                <circle cx="40" cy="27" r="2.5" fill="#1a1a1a" />
                <path d="M24 42 Q32 50 40 42" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {isUnlocked && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        <h3 className="font-bold text-sm text-center leading-tight" style={{ color: isUnlocked ? dino.color : undefined }} data-testid={`text-dino-name-${dino.id}`}>
          {isUnlocked ? (t[dino.translationKey as keyof typeof t] || dino.name) : "???"}
        </h3>

        <div className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-1",
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
          <p className="text-[11px] text-muted-foreground mt-2 text-center leading-tight" data-testid={`text-dino-fact-${dino.id}`}>
            {t[dino.factKey as keyof typeof t]}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function HatchModal({ dino, onClose, t }: { dino: Dino; onClose: () => void; t: Record<string, string> }) {
  const dinoImage = DINO_IMAGES[dino.id];

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
          className="flex justify-center"
        >
          {dinoImage ? (
            <img src={dinoImage} alt={dino.name} className="w-32 h-32 object-contain rounded-2xl" />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ backgroundColor: dino.color + "20" }}
            >
              <svg viewBox="0 0 64 64" className="w-16 h-16">
                <circle cx="32" cy="32" r="28" fill={dino.color} />
                <circle cx="24" cy="26" r="5" fill="white" />
                <circle cx="40" cy="26" r="5" fill="white" />
                <circle cx="24" cy="27" r="2.5" fill="#1a1a1a" />
                <circle cx="40" cy="27" r="2.5" fill="#1a1a1a" />
                <path d="M24 42 Q32 50 40 42" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          )}
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

export default function Collection() {
  const { data: user } = useUser();
  const { eggs, collection, hatchEgg, canHatch, totalEggsHatched, ensureStarterEgg, addEgg, hasActiveEgg } = useEggs();
  const [hatchedDino, setHatchedDino] = useState<Dino | null>(null);
  const [showStarterMsg, setShowStarterMsg] = useState(false);

  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang] as Record<string, string>;

  const incubatingEggs = eggs.filter(e => e.status === "incubating");
  const unlockedIds = collection.map(d => d.id);

  useEffect(() => {
    const starterEgg = ensureStarterEgg();
    if (starterEgg) {
      setShowStarterMsg(true);
      setTimeout(() => setShowStarterMsg(false), 5000);
    }
  }, [ensureStarterEgg]);

  const handleHatch = (eggId: string) => {
    if (!canHatch(eggId)) return;

    const dino = hatchEgg(eggId);
    if (dino) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.5 },
        colors: [dino.color, "#22c55e", "#fbbf24"],
      });
      setHatchedDino(dino);

      if (!hasActiveEgg()) {
        setTimeout(() => {
          addEgg("mystery");
        }, 2000);
      }
    }
  };

  const sortedDinos = DINO_CATALOG.map(catalogDino => {
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
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24 w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/10 rounded-2xl flex items-center justify-center">
          <Trophy className="w-8 h-8 text-purple-500" />
        </div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-collection-title">{t.my_collection}</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-collection-subtitle">{t.my_collection_subtitle}</p>
      </motion.div>

      <AnimatePresence>
        {showStarterMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center"
          >
            <Egg className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400" data-testid="text-starter-egg-msg">
              {t.starter_egg_msg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-8"
      >
        <div className="bg-card border border-border rounded-xl p-3 text-center" data-testid="card-incubating-stats">
          <div className="text-2xl font-bold text-amber-500" data-testid="text-incubating-count">
            {incubatingEggs.length}
          </div>
          <p className="text-xs text-muted-foreground">{t.incubating_eggs}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center" data-testid="card-collected-stats">
          <div className="text-2xl font-bold text-purple-500" data-testid="text-collected-count">
            {collection.length}
          </div>
          <p className="text-xs text-muted-foreground">{t.collected_dinos}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center" data-testid="card-hatched-stats">
          <div className="text-2xl font-bold text-green-500" data-testid="text-hatched-count">
            {totalEggsHatched}
          </div>
          <p className="text-xs text-muted-foreground">{t.total_eggs_hatched}</p>
        </div>
      </motion.div>

      {incubatingEggs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Egg className="w-5 h-5 text-amber-500" />
            {t.incubating_eggs}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {incubatingEggs.map((egg) => (
              <EggCard
                key={egg.id}
                egg={egg}
                onHatch={handleHatch}
                t={t}
                lang={lang}
              />
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-500" />
            {t.collected_dinos}
          </h2>
          <span className="text-sm font-medium text-muted-foreground" data-testid="text-collection-progress">
            {collection.length}/{DINO_CATALOG.length}
          </span>
        </div>

        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(collection.length / DINO_CATALOG.length) * 100}%` }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedDinos.map((dino, index) => (
            <motion.div
              key={dino.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.03 }}
            >
              <DinoCard
                dino={dino}
                isUnlocked={dino.isUnlocked}
                t={t}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

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
