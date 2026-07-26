import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export interface WatchlistItem {
  id: string;
  symbol: string;
  stockName: string;
  sector?: string;
  lastPrice?: string;
  lastNewsScore?: number;
  trackNews: boolean;
  trackEvents: boolean;
  trackTechnicals: boolean;
  addedAt: string;
}

export interface WatchlistAlert {
  id: string;
  symbol: string;
  alertType: string;
  title: string;
  description?: string;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  firedAt: string;
}

/**
 * Hook for managing server-side watchlist with real-time persistence.
 * Replaces localStorage-only approach with full database backing.
 */
export function useServerWatchlist() {
  const queryClient = useQueryClient();

  // Fetch user's watchlist
  const { data: watchlist = [], isLoading, error } = useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist');
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      const data = await res.json();
      return data.watchlist || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch watchlist alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['watchlist-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist/alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      return data.alerts || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Add stock to watchlist
  const addMutation = useMutation({
    mutationFn: async (payload: { symbol: string; stockName: string; sector?: string }) => {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add to watchlist');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Remove stock from watchlist
  const removeMutation = useMutation({
    mutationFn: async (watchlistId: string) => {
      const res = await fetch(`/api/watchlist/${watchlistId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove from watchlist');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Update watchlist item preferences
  const updateMutation = useMutation({
    mutationFn: async (payload: { watchlistId: string; trackNews?: boolean; trackEvents?: boolean; trackTechnicals?: boolean }) => {
      const res = await fetch(`/api/watchlist/${payload.watchlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update watchlist');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Mark alert as read
  const markAlertReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/watchlist/alerts/${alertId}/read`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark alert as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-alerts'] });
    },
  });

  // Archive alert
  const archiveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/watchlist/alerts/${alertId}/archive`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to archive alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-alerts'] });
    },
  });

  // Helper: Check if stock is in watchlist
  const isWatched = useCallback((symbol: string) => {
    return watchlist.some(item => item.symbol === symbol);
  }, [watchlist]);

  // Helper: Toggle stock in watchlist
  const toggleWatch = useCallback(async (symbol: string, stockName: string, sector?: string) => {
    if (isWatched(symbol)) {
      const item = watchlist.find(w => w.symbol === symbol);
      if (item) {
        await removeMutation.mutateAsync(item.id);
      }
    } else {
      await addMutation.mutateAsync({ symbol, stockName, sector });
    }
  }, [isWatched, watchlist, addMutation, removeMutation]);

  // Helper: Get watchlist item by symbol
  const getWatchlistItem = useCallback((symbol: string) => {
    return watchlist.find(item => item.symbol === symbol);
  }, [watchlist]);

  // Helper: Get unread alerts count
  const unreadAlertsCount = alerts.filter(a => !a.isRead).length;

  return {
    watchlist,
    alerts,
    isLoading,
    error,
    isWatched,
    toggleWatch,
    getWatchlistItem,
    unreadAlertsCount,
    addToWatchlist: addMutation.mutateAsync,
    removeFromWatchlist: removeMutation.mutateAsync,
    updateWatchlistItem: updateMutation.mutateAsync,
    markAlertAsRead: markAlertReadMutation.mutateAsync,
    archiveAlert: archiveAlertMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
