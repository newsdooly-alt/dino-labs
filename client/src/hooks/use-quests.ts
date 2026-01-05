import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

const USER_ID = 1; // MVP User

export function useQuests() {
  return useQuery({
    queryKey: [api.quests.list.path, USER_ID],
    queryFn: async () => {
      const url = `${api.quests.list.path}?userId=${USER_ID}`;
      const res = await fetch(url, { credentials: "include" });
      
      // Auto-generate quests if empty (MVP hack)
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length === 0) {
           await fetch(api.quests.generate.path, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ userId: USER_ID })
           });
           // Re-fetch immediately
           const retryRes = await fetch(url, { credentials: "include" });
           return api.quests.list.responses[200].parse(await retryRes.json());
        }
        return api.quests.list.responses[200].parse(data);
      }
      
      throw new Error('Failed to fetch quests');
    },
  });
}

export function useCompleteQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questId, answerIndex }: { questId: number, answerIndex: number }) => {
      const url = buildUrl(api.quests.complete.path, { id: questId });
      const res = await fetch(url, {
        method: api.quests.complete.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerIndex, userId: USER_ID }),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to complete quest');
      return api.quests.complete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.quests.list.path, USER_ID] });
      queryClient.invalidateQueries({ queryKey: [api.users.get.path, USER_ID] });
    },
  });
}
