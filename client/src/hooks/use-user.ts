import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateUserRequest } from "@shared/routes";

// Hardcoded user ID for MVP
const USER_ID = 1;

export function useUser() {
  return useQuery({
    queryKey: [api.users.get.path, USER_ID],
    queryFn: async () => {
      // In a real app we'd check auth here. 
      // For MVP, if 404, we might create a default user or handle it in the UI.
      const url = buildUrl(api.users.get.path, { id: USER_ID });
      const res = await fetch(url, { credentials: "include" });
      
      // Auto-create user for demo if not found (hack for seamless MVP)
      if (res.status === 404) {
        const createRes = await fetch(api.users.create.path, {
          method: api.users.create.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: "StockHero", password: "password" }),
          credentials: "include"
        });
        return api.users.create.responses[201].parse(await createRes.json());
      }
      
      if (!res.ok) throw new Error('Failed to fetch user');
      return api.users.get.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.users.updateStreak.path, { id: USER_ID });
      const res = await fetch(url, {
        method: api.users.updateStreak.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update streak");
      return api.users.updateStreak.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.get.path, USER_ID] });
    },
  });
}
