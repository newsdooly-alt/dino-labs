import { useState, useEffect, useCallback } from "react";

export type EggRarity = "common" | "rare" | "epic" | "legendary" | "mystery";
export type EggStatus = "locked" | "incubating" | "hatched";
export type EggVisual = "speckled" | "golden" | "frozen" | "volcanic" | "crystal" | "mossy";

export interface Egg {
  id: string;
  rarity: EggRarity;
  visual: EggVisual;
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
  species: string;
  translationKey: string;
  factKey: string;
  rarity: EggRarity;
  color: string;
  unlockedAt: number;
}

export const DINO_CATALOG: Omit<Dino, "unlockedAt">[] = [
  { id: "trex", name: "Rexy", species: "T-Rex", translationKey: "dino_trex", factKey: "dino_trex_fact", rarity: "legendary", color: "#dc2626" },
  { id: "stego", name: "Spike", species: "Stegosaurus", translationKey: "dino_stego", factKey: "dino_stego_fact", rarity: "rare", color: "#16a34a" },
  { id: "ptero", name: "Sky", species: "Pterodactyl", translationKey: "dino_ptero", factKey: "dino_ptero_fact", rarity: "epic", color: "#2563eb" },
  { id: "diplo", name: "Stretch", species: "Diplodocus", translationKey: "dino_diplo", factKey: "dino_diplo_fact", rarity: "rare", color: "#7c3aed" },
  { id: "trice", name: "Shield", species: "Triceratops", translationKey: "dino_trice", factKey: "dino_trice_fact", rarity: "epic", color: "#ea580c" },
  { id: "ankylo", name: "Tank", species: "Ankylosaurus", translationKey: "dino_ankylo", factKey: "dino_ankylo_fact", rarity: "common", color: "#854d0e" },
  { id: "raptor", name: "Dash", species: "Velociraptor", translationKey: "dino_raptor", factKey: "dino_raptor_fact", rarity: "common", color: "#0d9488" },
  { id: "bronto", name: "Thunder", species: "Brontosaurus", translationKey: "dino_bronto", factKey: "dino_bronto_fact", rarity: "common", color: "#6366f1" },
  { id: "spino", name: "Fin", species: "Spinosaurus", translationKey: "dino_spino", factKey: "dino_spino_fact", rarity: "legendary", color: "#be185d" },
  { id: "parasaur", name: "Echo", species: "Parasaurolophus", translationKey: "dino_parasaur", factKey: "dino_parasaur_fact", rarity: "rare", color: "#0891b2" },
];

export const EGG_VISUALS: { visual: EggVisual; label: string; labelKo: string; colors: [string, string] }[] = [
  { visual: "speckled", label: "Speckled Egg", labelKo: "점박이 알", colors: ["#a3e635", "#65a30d"] },
  { visual: "golden", label: "Golden Egg", labelKo: "황금 알", colors: ["#fbbf24", "#d97706"] },
  { visual: "frozen", label: "Frozen Egg", labelKo: "얼음 알", colors: ["#67e8f9", "#0891b2"] },
  { visual: "volcanic", label: "Volcanic Egg", labelKo: "화산 알", colors: ["#f87171", "#dc2626"] },
  { visual: "crystal", label: "Crystal Egg", labelKo: "크리스탈 알", colors: ["#c084fc", "#9333ea"] },
  { visual: "mossy", label: "Mossy Egg", labelKo: "이끼 알", colors: ["#86efac", "#22c55e"] },
];

const XP_REQUIREMENTS: Record<EggRarity, number> = {
  common: 700,
  rare: 1000,
  epic: 1400,
  legendary: 2000,
  mystery: 850,
};

const RARITY_WEIGHTS: Record<EggRarity, number> = {
  common: 45,
  rare: 30,
  epic: 18,
  legendary: 7,
  mystery: 0,
};

const STORAGE_KEY = "dinolingo_eggs_v2";
const COLLECTION_KEY = "dinolingo_collection_v2";
const STARTER_EGG_KEY = "dinolingo_starter_egg_given";

function generateEggId(): string {
  return `egg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomEggVisual(): EggVisual {
  const visuals: EggVisual[] = ["speckled", "golden", "frozen", "volcanic", "crystal", "mossy"];
  return visuals[Math.floor(Math.random() * visuals.length)];
}

function getRandomRarityFromMystery(): EggRarity {
  const totalWeight = Object.entries(RARITY_WEIGHTS)
    .filter(([k]) => k !== "mystery")
    .reduce((a, [, b]) => a + b, 0);
  const random = Math.random() * totalWeight;
  let cumulative = 0;

  for (const [r, weight] of Object.entries(RARITY_WEIGHTS)) {
    if (r === "mystery") continue;
    cumulative += weight;
    if (random <= cumulative) {
      return r as EggRarity;
    }
  }
  return "common";
}

function getRandomDino(rarity: EggRarity, existingDinos: Dino[]): Omit<Dino, "unlockedAt"> | null {
  const unlockedIds = existingDinos.map(d => d.id);

  let selectedRarity = rarity;
  if (rarity === "mystery") {
    selectedRarity = getRandomRarityFromMystery();
  }

  let eligibleDinos = DINO_CATALOG.filter(d => d.rarity === selectedRarity && !unlockedIds.includes(d.id));

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

  const ensureStarterEgg = useCallback(() => {
    const hasStarter = localStorage.getItem(STARTER_EGG_KEY);
    if (!hasStarter && eggs.length === 0) {
      const starterEgg: Egg = {
        id: generateEggId(),
        rarity: "common",
        visual: "speckled",
        status: "incubating",
        currentXp: 0,
        requiredXp: XP_REQUIREMENTS.common,
        createdAt: Date.now(),
      };
      setEggs([starterEgg]);
      localStorage.setItem(STARTER_EGG_KEY, "true");
      return starterEgg;
    }
    return null;
  }, [eggs.length]);

  const addEgg = useCallback((rarity: EggRarity = "mystery") => {
    const newEgg: Egg = {
      id: generateEggId(),
      rarity,
      visual: getRandomEggVisual(),
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

    setEggs(prev => prev.filter(e => e.id !== eggId));

    setCollection(prev => [...prev, newDino]);

    return newDino;
  }, [eggs, collection, canHatch]);

  const removeEgg = useCallback((eggId: string) => {
    setEggs(prev => prev.filter(e => e.id !== eggId));
  }, []);

  const hasActiveEgg = useCallback(() => {
    return eggs.some(e => e.status === "incubating");
  }, [eggs]);

  const resetAll = useCallback(() => {
    setEggs([]);
    setCollection([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COLLECTION_KEY);
    localStorage.removeItem(STARTER_EGG_KEY);
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
    hasActiveEgg,
    ensureStarterEgg,
    resetAll,
    getIncubatingEggs,
    getHatchedEggs,
    totalEggsHatched: eggs.filter(e => e.status === "hatched").length,
    dinoCatalog: DINO_CATALOG,
  };
}
