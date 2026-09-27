'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createWidget, listWidgets, type Widget } from '../lib/api/widgets';

export function useWidgets() {
  const { getToken, isLoaded, userId, orgId } = useAuth();
  return useQuery<Widget[]>({
    queryKey: ['widgets', userId, orgId],
    enabled: isLoaded && !!userId,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Sign-in required');
      return listWidgets(token);
    },
  });
}

export function useCreateWidget() {
  const { getToken, userId, orgId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Sign-in required');
      return createWidget(token, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['widgets', userId, orgId],
      });
    },
  });
}
