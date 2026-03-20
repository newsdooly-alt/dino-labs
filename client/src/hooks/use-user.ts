import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { UserProfile } from "@shared/schema";

export function useUser() {
  return useQuery<UserProfile | null>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const res = await fetch("/api/profiles/me", { credentials: "include" });
      
      if (res.status === 401) {
        return null;
      }
      
      if (!res.ok) throw new Error('Failed to fetch user profile');
      return res.json();
    },
    retry: false,
  });
}

export function useUpdateLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: 'en' | 'ko' | 'ja') => {
      const res = await fetch("/api/profiles/language", {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update language");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
    },
  });
}

export function useReplenishHearts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/profiles/hearts/replenish", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to replenish hearts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
    },
  });
}
