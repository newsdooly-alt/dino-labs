import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Quest, UserProfile } from "@shared/schema";
import { saveQuestsOffline, loadQuestsOffline } from "@/lib/offlineStorage";
import { queryClient } from "@/lib/queryClient";

function getCachedUserId(): string | null {
  const profile = queryClient.getQueryData<UserProfile>(["/api/profiles/me"]);
  return profile?.id ?? null;
}

export function useQuests() {
  return useQuery<Quest[]>({
    queryKey: ["/api/quests"],
    queryFn: async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        const res = await fetch(`/api/quests/daily?tz=${encodeURIComponent(tz)}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch quests");
        const data: Quest[] = await res.json();
        const userId = getCachedUserId();
        if (userId) {
          await saveQuestsOffline(userId, data);
        }
        return data;
      } catch (networkErr) {
        const userId = getCachedUserId();
        if (userId) {
          const cached = await loadQuestsOffline(userId);
          if (cached && cached.length > 0) {
            console.log("[useQuests] Offline — serving from IndexedDB cache");
            return cached as Quest[];
          }
        }
        throw networkErr;
      }
    },
    retry: false,
  });
}

export function useCompleteQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questId, answerIndex }: { questId: number, answerIndex: number }) => {
      const url = buildUrl(api.quests.complete.path, { id: questId });
      const res = await fetch(url, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerIndex }),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to complete quest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
    },
  });
}
