import { useState, useEffect, useCallback } from "react";

export type EggRarity = "common" | "rare" | "epic" | "legendary" | "mystery";
export type EggStatus = "locked" | "incubating" | "hatched";

export interface Egg {
  id: string;
  rarity: EggRarity;
  status: EggStatus;
  currentXp: number;
  requiredXp: number;
  dinoId?: string;
  createdAt: number;
  hatchedAt?: number;
}

export interface Dino {
  id: string;
  name: string;
  translationKey: string;
  factKey: string;
  rarity: EggRarity;
  color: string;
  unlockedAt: number;
}

const DINO_CATALOG: Omit<Dino, "unlockedAt">[] = [
  { id: "bull", name: "Bull Dino", translationKey: "dino_bull", factKey: "dino_bull_fact", rarity: "common", color: "#22c55e" },
  { id: "bear", name: "Bear Dino", translationKey: "dino_bear", factKey: "dino_bear_fact", rarity: "common", color: "#ef4444" },
  { id: "chart", name: "Chart Dino", translationKey: "dino_chart", factKey: "dino_chart_fact", rarity: "common", color: "#3b82f6" },
  { id: "news", name: "News Dino", translationKey: "dino_news", factKey: "dino_news_fact", rarity: "rare", color: "#f59e0b" },
  { id: "dividend", name: "Dividend Dino", translationKey: "dino_dividend", factKey: "dino_dividend_fact", rarity: "rare", color: "#8b5cf6" },
  { id: "growth", name: "Growth Dino", translationKey: "dino_growth", factKey: "dino_growth_fact", rarity: "epic", color: "#10b981" },
  { id: "value", name: "Value Dino", translationKey: "dino_value", factKey: "dino_value_fact", rarity: "epic", color: "#06b6d4" },
  { id: "tech", name: "Tech Dino", translationKey: "dino_tech", factKey: "dino_tech_fact", rarity: "legendary", color: "#ec4899" },
  { id: "global", name: "Global Dino", translationKey: "dino_global", factKey: "dino_global_fact", rarity: "legendary", color: "#14b8a6" },
  { id: "crypto", name: "Crypto Dino", translationKey: "dino_crypto", factKey: "dino_crypto_fact", rarity: "legendary", color: "#f97316" },
];

const XP_REQUIREMENTS: Record<EggRarity, number> = {
  common: 100,
  rare: 250,
  epic: 500,
  legendary: 1000,
  mystery: 150,
};

const RARITY_WEIGHTS: Record<EggRarity, number> = {
  common: 50,
  rare: 30,
  epic: 15,
  legendary: 5,
  mystery: 0,
};

const STORAGE_KEY = "dinolingo_eggs";
const COLLECTION_KEY = "dinolingo_collection";

function generateEggId(): string {
  return `egg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomDino(rarity: EggRarity, existingDinos: Dino[]): Omit<Dino, "unlockedAt"> | null {
  const unlockedIds = existingDinos.map(d => d.id);
  
  let eligibleDinos: Omit<Dino, "unlockedAt">[];
  
  if (rarity === "mystery") {
    const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    const random = Math.random() * totalWeight;
    let cumulative = 0;
    let selectedRarity: EggRarity = "common";
    
    for (const [r, weight] of Object.entries(RARITY_WEIGHTS)) {
      cumulative += weight;
      if (random <= cumulative) {
        selectedRarity = r as EggRarity;
        break;
      }
    }
    
    eligibleDinos = DINO_CATALOG.filter(d => d.rarity === selectedRarity && !unlockedIds.includes(d.id));
  } else {
    eligibleDinos = DINO_CATALOG.filter(d => d.rarity === rarity && !unlockedIds.includes(d.id));
  }
  
  if (eligibleDinos.length === 0) {
    eligibleDinos = DINO_CATALOG.filter(d => !unlockedIds.includes(d.id));
  }
  
  if (eligibleDinos.length === 0) {
    const randomIndex = Math.floor(Math.random() * DINO_CATALOG.length);
    return DINO_CATALOG[randomIndex];
  }
  
  const randomIndex = Math.floor(Math.random() * eligibleDinos.length);
  return eligibleDinos[randomIndex];
}

export function useEggs() {
  const [eggs, setEggs] = useState<Egg[]>([]);
  const [collection, setCollection] = useState<Dino[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedEggs = localStorage.getItem(STORAGE_KEY);
      const storedCollection = localStorage.getItem(COLLECTION_KEY);
      
      if (storedEggs) {
        setEggs(JSON.parse(storedEggs));
      }
      if (storedCollection) {
        setCollection(JSON.parse(storedCollection));
      }
    } catch (error) {
      console.error("Failed to load eggs from localStorage:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eggs));
    }
  }, [eggs, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
    }
  }, [collection, isLoading]);

  const addEgg = useCallback((rarity: EggRarity = "mystery") => {
    const newEgg: Egg = {
      id: generateEggId(),
      rarity,
      status: "incubating",
      currentXp: 0,
      requiredXp: XP_REQUIREMENTS[rarity],
      createdAt: Date.now(),
    };
    
    setEggs(prev => [...prev, newEgg]);
    return newEgg;
  }, []);

  const addXpToEggs = useCallback((xp: number) => {
    setEggs(prev => prev.map(egg => {
      if (egg.status !== "incubating") return egg;
      
      const newXp = egg.currentXp + xp;
      return {
        ...egg,
        currentXp: Math.min(newXp, egg.requiredXp),
      };
    }));
  }, []);

  const canHatch = useCallback((eggId: string) => {
    const egg = eggs.find(e => e.id === eggId);
    return egg && egg.status === "incubating" && egg.currentXp >= egg.requiredXp;
  }, [eggs]);

  const hatchEgg = useCallback((eggId: string): Dino | null => {
    const egg = eggs.find(e => e.id === eggId);
    if (!egg || !canHatch(eggId)) return null;

    const newDinoData = getRandomDino(egg.rarity, collection);
    if (!newDinoData) return null;

    const newDino: Dino = {
      ...newDinoData,
      unlockedAt: Date.now(),
    };

    setEggs(prev => prev.map(e => 
      e.id === eggId 
        ? { ...e, status: "hatched" as EggStatus, dinoId: newDino.id, hatchedAt: Date.now() }
        : e
    ));

    setCollection(prev => [...prev, newDino]);

    return newDino;
  }, [eggs, collection, canHatch]);

  const removeEgg = useCallback((eggId: string) => {
    setEggs(prev => prev.filter(e => e.id !== eggId));
  }, []);

  const resetAll = useCallback(() => {
    setEggs([]);
    setCollection([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COLLECTION_KEY);
  }, []);

  const getIncubatingEggs = useCallback(() => {
    return eggs.filter(e => e.status === "incubating");
  }, [eggs]);

  const getHatchedEggs = useCallback(() => {
    return eggs.filter(e => e.status === "hatched");
  }, [eggs]);

  return {
    eggs,
    collection,
    isLoading,
    addEgg,
    addXpToEggs,
    canHatch,
    hatchEgg,
    removeEgg,
    resetAll,
    getIncubatingEggs,
    getHatchedEggs,
    totalEggsHatched: eggs.filter(e => e.status === "hatched").length,
    dinoCatalog: DINO_CATALOG,
  };
}
