import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useNetworkSync } from '../hooks/useNetworkSync';

export const SyncIndicator: React.FC = () => {
  const { syncState, statusText } = useNetworkSync();

  // Only render banner/pill when not in steady-state 'online'
  if (syncState === 'online') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none select-none max-w-md">
      <AnimatePresence mode="wait">
        {syncState === 'offline' && (
          <motion.div
            key="offline-pill"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-950/90 text-amber-200 border border-amber-500/30 shadow-xl backdrop-blur-md text-xs font-medium"
          >
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping absolute opacity-75" />
              <WifiOff size={15} className="text-amber-400 relative z-10" />
            </div>
            <span>{statusText}</span>
          </motion.div>
        )}

        {syncState === 'syncing' && (
          <motion.div
            key="syncing-pill"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-sky-950/90 text-sky-200 border border-sky-500/30 shadow-xl backdrop-blur-md text-xs font-medium"
          >
            <RefreshCw size={15} className="text-sky-400 animate-spin" />
            <span>{statusText}</span>
          </motion.div>
        )}

        {syncState === 'synced' && (
          <motion.div
            key="synced-pill"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-950/90 text-emerald-200 border border-emerald-500/30 shadow-xl backdrop-blur-md text-xs font-medium"
          >
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span>{statusText}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
