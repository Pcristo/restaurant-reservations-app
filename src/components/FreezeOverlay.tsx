import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { cn, getOptimizedUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function FreezeOverlay() {
  const { settings } = useSettings();
  const { language, t } = useLanguage();
  const { isStaff } = useAuth();
  const [isFrozen, setIsFrozen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const freezeEnabled = settings?.freezeEnabled || false;
  const freezeTime = (settings?.freezeTime || 5) * 60 * 1000; // convert minutes to ms
  const correctPassword = settings?.appUnlockPin || '';

  const handleActivity = useCallback(() => {
    if (!isFrozen) {
      setLastActivity(Date.now());
    }
  }, [isFrozen]);

  useEffect(() => {
    if (!freezeEnabled || !isStaff) {
      setIsFrozen(false);
      return;
    }

    // Reset timer when login state changes or feature enabled
    setLastActivity(Date.now());

    // Event listeners for activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, handleActivity));

    // Timer check
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity >= freezeTime) {
        setIsFrozen(true);
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [freezeEnabled, isStaff, lastActivity, freezeTime, handleActivity]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      setIsFrozen(false);
      setPassword('');
      setError(false);
      setLastActivity(Date.now());
    } else {
      setError(true);
      setPassword('');
      // Shake effect or feedback
      setTimeout(() => setError(false), 2000);
    }
  };

  if (!freezeEnabled || !isStaff || !isFrozen) return null;

  return (
    <AnimatePresence>
      <motion.div 
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/90 backdrop-blur-xl"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className={cn(
            "w-full max-w-sm p-8 rounded-3xl border shadow-2xl transition-all duration-300",
            settings?.theme === 'dark' ? "bg-gray-900 border-orange-500/50" : "bg-white border-orange-500"
          )}
        >
          <div className="flex flex-col items-center text-center">
            <div className="flex flex-col items-center gap-3 mb-6">
              {(settings?.logoUrl || settings?.cloudinaryLogoUrl) && (
                <img 
                  src={getOptimizedUrl(settings?.logoUrl, settings, 'logo')} 
                  alt={settings.name || 'Logo'} 
                  className="w-auto object-contain max-h-16 mb-1"
                  referrerPolicy="no-referrer"
                />
              )}
              {settings?.name && (
                <h3 className={cn(
                  "text-lg font-bold transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-gray-300" : "text-gray-600"
                )}>
                  {settings.name}
                </h3>
              )}
            </div>

            <hr className="w-full border-t border-orange-500 mb-6 opacity-50" />
            
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center mb-2 rotate-3 transition-colors duration-300",
              error ? "bg-red-100 text-red-600" : (settings?.theme === 'dark' ? "bg-orange-500/20 text-orange-400" : "bg-orange-50 text-orange-600")
            )}>
              <Lock size={40} className={cn(error && "animate-shake")} />
            </div>

            <h2 className={cn(
              "text-2xl font-bold mb-2 transition-colors duration-300",
              settings?.theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              {language === 'pt' ? <>Congelar App <br />(Auto-Bloqueio)</> : (t('settings.freeze_app') || 'Freeze Application')}
            </h2>
            <p className={cn(
              "text-sm mb-8 transition-colors duration-300",
              settings?.theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              {language === 'pt' 
                ? 'Este aplicativo está congelado por segurança. Por favor, insira a senha do administrador para continuar.' 
                : 'This application is frozen for security. Please enter the administrator password to continue.'}
            </p>

            <form onSubmit={handleUnlock} className="w-full relative pt-6">
              <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center">
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-red-500 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <AlertCircle size={12} />
                      {language === 'pt' ? 'Senha inválida' : 'Invalid Password'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative mb-4">
                <input 
                  type="password"
                  autoFocus
                  value={password}
                  maxLength={4}
                  onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={language === 'pt' ? 'Introduza o PIN (4 dígitos)...' : 'Enter PIN (4 digits)...'}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 transition-all duration-300 text-center text-lg font-bold tracking-widest",
                    settings?.theme === 'dark' 
                      ? "bg-gray-800 border-gray-700 text-white focus:ring-red-900" 
                      : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-red-100"
                  )}
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <Unlock size={20} />
                {language === 'pt' ? 'Desbloquear Aplicação' : 'Unlock Application'}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
