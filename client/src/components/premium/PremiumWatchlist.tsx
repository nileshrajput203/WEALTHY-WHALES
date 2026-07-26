import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServerWatchlist } from '@/hooks/useServerWatchlist';
import { PremiumCard, PremiumGrid, PremiumBadge, PremiumStat } from './PremiumCard';
import { Trash2, Bell, TrendingUp, TrendingDown, Star, Settings } from 'lucide-react';
import { COLORS, MOTION_VARIANTS } from './DesignTokens';

interface PremiumWatchlistProps {
  onStockClick?: (symbol: string) => void;
}

export const PremiumWatchlist: React.FC<PremiumWatchlistProps> = ({ onStockClick }) => {
  const { watchlist, isLoading, removeFromWatchlist, isRemoving } = useServerWatchlist();
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (watchlist.length === 0) {
    return (
      <motion.div
        variants={MOTION_VARIANTS.fadeIn}
        initial="initial"
        animate="animate"
        className="flex flex-col items-center justify-center h-64 text-center"
      >
        <Star className="h-16 w-16 text-neutral-600 mb-4" />
        <h3 className="text-xl font-semibold text-neutral-300 mb-2">No stocks in watchlist</h3>
        <p className="text-neutral-500">Add stocks to track news, events, and technical patterns</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={MOTION_VARIANTS.fadeIn}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PremiumStat
          label="Watchlist Size"
          value={watchlist.length}
          icon={<Star className="h-4 w-4" />}
        />
        <PremiumStat
          label="Avg News Score"
          value={(watchlist.reduce((sum, w) => sum + (w.lastNewsScore || 0), 0) / watchlist.length).toFixed(1)}
          unit="pts"
          icon={<Bell className="h-4 w-4" />}
        />
        <PremiumStat
          label="Tracking News"
          value={watchlist.filter(w => w.trackNews).length}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <PremiumStat
          label="Tracking Events"
          value={watchlist.filter(w => w.trackEvents).length}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      {/* Watchlist Items Grid */}
      <PremiumGrid cols={2} gap="md">
        <AnimatePresence>
          {watchlist.map((item, idx) => (
            <motion.div
              key={item.id}
              variants={MOTION_VARIANTS.slideInUp}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ delay: idx * 0.05 }}
              onClick={() => {
                setSelectedStock(item.id);
                onStockClick?.(item.symbol);
              }}
            >
              <PremiumCard
                variant="glass"
                hover
                className="cursor-pointer group"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white group-hover:text-primary-400 transition-colors">
                        {item.symbol}
                      </h3>
                      <p className="text-sm text-neutral-400">{item.stockName}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWatchlist(item.id);
                      }}
                      disabled={isRemoving}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Price Info */}
                  {item.lastPrice && (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">₹{item.lastPrice}</span>
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {item.sector && (
                      <PremiumBadge label={item.sector} variant="info" size="sm" />
                    )}
                    {item.trackNews && (
                      <PremiumBadge label="News" variant="primary" size="sm" icon={<Bell className="h-3 w-3" />} />
                    )}
                    {item.trackEvents && (
                      <PremiumBadge label="Events" variant="success" size="sm" />
                    )}
                    {item.trackTechnicals && (
                      <PremiumBadge label="Technicals" variant="warning" size="sm" />
                    )}
                  </div>

                  {/* News Score */}
                  {item.lastNewsScore !== undefined && (
                    <div className="pt-2 border-t border-neutral-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-400">News Sentiment</span>
                        <div className="flex items-center gap-1">
                          <div className="w-20 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full ${
                                item.lastNewsScore > 0 ? 'bg-green-500' : item.lastNewsScore < 0 ? 'bg-red-500' : 'bg-yellow-500'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.abs(item.lastNewsScore)}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-neutral-300 w-8 text-right">
                            {item.lastNewsScore > 0 ? '+' : ''}{item.lastNewsScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Settings */}
                  <button className="w-full mt-2 px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    <Settings className="h-4 w-4" />
                    Preferences
                  </button>
                </div>
              </PremiumCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </PremiumGrid>
    </motion.div>
  );
};

export default PremiumWatchlist;
