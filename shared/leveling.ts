export function calculateLevel(totalXp: number): number {
  let level = 1;
  let xpNeeded = 0;
  while (true) {
    const nextLevelXp = Math.floor(100 * Math.pow(level, 1.2));
    if (xpNeeded + nextLevelXp > totalXp) break;
    xpNeeded += nextLevelXp;
    level++;
  }
  return level;
}

export function xpForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.2));
}

export function xpProgressInLevel(totalXp: number): { currentXpInLevel: number; xpNeededForNext: number; percent: number } {
  let level = 1;
  let xpConsumed = 0;
  while (true) {
    const nextLevelXp = Math.floor(100 * Math.pow(level, 1.2));
    if (xpConsumed + nextLevelXp > totalXp) {
      const currentXpInLevel = totalXp - xpConsumed;
      return {
        currentXpInLevel,
        xpNeededForNext: nextLevelXp,
        percent: Math.min(100, Math.round((currentXpInLevel / nextLevelXp) * 100)),
      };
    }
    xpConsumed += nextLevelXp;
    level++;
  }
}
