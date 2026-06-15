import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Quest } from "@shared/schema";

export function useQuests() {
  return useQuery<Quest[]>({
    queryKey: ["/api/quests"],
    queryFn: async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/quests/daily?tz=${encodeURIComponent(tz)}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch quests');
      return res.json();
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
