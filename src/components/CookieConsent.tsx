import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { getOptimizedUrl, cn } from '../lib/utils';
import { X, Cookie, Shield, Eye, Settings, Check } from 'lucide-react';
import { APP_CONFIG } from '../data/appConfig';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const { language, t } = useLanguage();
  const { settings } = useSettings();
  const { user, isStaff, isAdmin } = useAuth();

  const [preferences, setPreferences] = useState({
    necessary: true,
    preferences: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Load saved preferences if available
    const savedPrefs = localStorage.getItem('cookie-preferences');
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setPreferences(prev => ({ ...prev, ...parsed, necessary: true }));
      } catch (e) {
        // ignore invalid JSON
      }
    }
  }, []);

  useEffect(() => {
    // Never show cookie consent banner if admin or staff is logged in
    if (isStaff || isAdmin || (user && user.role !== 'customer')) {
      setIsVisible(false);
      return;
    }

    // Real world consent: only show if user has not yet saved a choice
    const savedConsent = localStorage.getItem('cookie-consent');
    if (!savedConsent) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [user, isStaff, isAdmin]);

  useEffect(() => {
    const handleOpenSettings = () => {
      setIsCustomizeOpen(true);
      setIsVisible(true);
    };
    window.addEventListener('open-cookie-settings', handleOpenSettings);
    return () => window.removeEventListener('open-cookie-settings', handleOpenSettings);
  }, []);

  const handleChoice = (choice: 'accepted' | 'declined') => {
    localStorage.setItem('cookie-consent', choice);
    
    const consentObj = {
      necessary: true,
      preferences: choice === 'accepted',
      analytics: choice === 'accepted',
      marketing: choice === 'accepted',
    };
    localStorage.setItem('cookie-preferences', JSON.stringify(consentObj));
    
    setIsVisible(false);
    setIsCustomizeOpen(false);
  };

  const handleSaveCustom = () => {
    localStorage.setItem('cookie-consent', 'customized');
    localStorage.setItem('cookie-preferences', JSON.stringify(preferences));
    setIsVisible(false);
    setIsCustomizeOpen(false);
  };

  const isDark = settings?.theme === 'dark';
  const logoUrl = settings ? getOptimizedUrl(settings.logoUrl, settings, 'logo') : '';
  const hasLogo = settings?.showLogo !== false && logoUrl;

  const handleToggle = (key: 'preferences' | 'analytics' | 'marketing') => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {/* 1. Cookie Consent Bottom Banner */}
      <AnimatePresence>
        {isVisible && !isCustomizeOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-full max-w-4xl px-4"
          >
            <div className={cn(
              "backdrop-blur-md border rounded-3xl p-6 shadow-2xl flex flex-col lg:flex-row items-center gap-6 transition-colors duration-300",
              isDark 
                ? "bg-gray-900/95 border-gray-800 text-white" 
                : "bg-white/95 border-amber-100 text-gray-900"
            )}>
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
                <Cookie size={28} />
              </div>
              
              <div className="flex-1 text-center lg:text-left">
                <p className={cn(
                  "text-sm font-medium leading-relaxed",
                  isDark ? "text-gray-300" : "text-gray-600"
                )}>
                  {t('common.cookie_consent')}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 w-full lg:w-auto shrink-0">
                <button
                  onClick={() => handleChoice('declined')}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold rounded-xl transition-all uppercase tracking-wider",
                    isDark 
                      ? "text-gray-400 hover:text-white hover:bg-gray-800" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {language === 'pt' ? 'Rejeitar Todos' : 'Reject All'}
                </button>

                <button
                  onClick={() => setIsCustomizeOpen(true)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold rounded-xl transition-all border uppercase tracking-wider",
                    isDark 
                      ? "text-amber-400 border-amber-500/20 hover:bg-amber-500/10" 
                      : "text-amber-600 border-amber-200 hover:bg-amber-50"
                  )}
                >
                  {language === 'pt' ? 'Personalizar' : 'Customize'}
                </button>

                 <button
                  onClick={() => handleChoice('accepted')}
                  className="px-6 py-2.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-all shadow-md shadow-amber-500/10 uppercase tracking-wider"
                >
                  {t('common.cookie_accept')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Modern Customize Modal */}
      <AnimatePresence>
        {isCustomizeOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomizeOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className={cn(
                "relative w-full max-w-lg rounded-3xl p-8 shadow-2xl border transition-colors duration-300 overflow-hidden flex flex-col items-center",
                isDark 
                  ? "bg-gray-900 border-gray-800 text-white" 
                  : "bg-white border-gray-100 text-gray-900"
              )}
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsCustomizeOpen(false)}
                className={cn(
                  "absolute top-6 right-6 p-1.5 rounded-xl transition-colors cursor-pointer z-10",
                  isDark ? "text-gray-500 hover:text-white hover:bg-gray-800" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                )}
                title={language === 'pt' ? 'Fechar' : 'Close'}
              >
                <X size={20} />
              </button>

              {/* Top Restaurant Logo */}
              <div className="flex flex-col items-center justify-center mt-2 mb-6 text-center">
                {hasLogo ? (
                  <div className="mb-1 flex items-center justify-center" style={{ height: `${settings?.logoSize || 48}px` }}>
                    <img 
                      src={logoUrl} 
                      alt={settings?.name || "Logo"} 
                      style={{ height: `${settings?.logoSize || 48}px`, objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-1">
                    <Cookie size={32} />
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">
                  {language === 'pt' ? 'Preferências de Cookies' : 'Cookie Preferences'}
                </p>
              </div>

              {/* Consent Information */}
              <div className={cn(
                "w-full text-xs text-center px-2 mb-6 leading-relaxed",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                {language === 'pt' 
                  ? 'Personalize o seu consentimento de cookies abaixo de acordo com as suas preferências. Cookies essenciais são sempre necessários.' 
                  : 'Customize your cookie consent preferences below. Essential cookies are always required to proceed.'}
              </div>

              {/* Cookie Categories */}
              <div className="w-full space-y-4 max-h-[300px] overflow-y-auto pr-1 mb-8">
                
                {/* 1. Necessary */}
                <div className={cn(
                  "p-4 rounded-2xl border flex items-start gap-4 transition-colors",
                  isDark ? "bg-gray-950/40 border-gray-800" : "bg-gray-50/50 border-gray-100"
                )}>
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl shrink-0 mt-0.5">
                    <Shield size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        {language === 'pt' ? 'Necessários' : 'Necessary'}
                      </h4>
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10">
                        {language === 'pt' ? 'Sempre Ativo' : 'Always Active'}
                      </span>
                    </div>
                    <p className={cn(
                      "text-[11px] mt-1 leading-relaxed",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' 
                        ? 'Estes cookies são necessários para as funções básicas do website, como o fluxo de reservas e autenticação.' 
                        : 'These cookies are required for the basic functionality of the website, such as bookings and user login.'}
                    </p>
                  </div>
                </div>

                {/* 2. Preferences */}
                <div className={cn(
                  "p-4 rounded-2xl border flex items-start gap-4 transition-colors",
                  isDark ? "bg-gray-950/40 border-gray-800" : "bg-gray-50/50 border-gray-100"
                )}>
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0 mt-0.5">
                    <Settings size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        {language === 'pt' ? 'Preferências' : 'Preferences'}
                      </h4>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={preferences.preferences} 
                          onChange={() => handleToggle('preferences')}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                    <p className={cn(
                      "text-[11px] mt-1 leading-relaxed",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' 
                        ? 'Utilizados para memorizar as suas preferências, como idioma do website, ocultação automática do aviso de cookies, etc.' 
                        : 'Used to store preferences, such as your selected website language, automatic banner dismissal, etc.'}
                    </p>
                  </div>
                </div>

                {/* 3. Analytics */}
                <div className={cn(
                  "p-4 rounded-2xl border flex items-start gap-4 transition-colors",
                  isDark ? "bg-gray-950/40 border-gray-800" : "bg-gray-50/50 border-gray-100"
                )}>
                  <div className="p-2 bg-green-500/10 text-green-500 rounded-xl shrink-0 mt-0.5">
                    <Eye size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        {language === 'pt' ? 'Estatísticos' : 'Analytics'}
                      </h4>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={preferences.analytics} 
                          onChange={() => handleToggle('analytics')}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                    <p className={cn(
                      "text-[11px] mt-1 leading-relaxed",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' 
                        ? 'Ajudam-nos a analisar estatisticamente as visitas e o desempenho da nossa plataforma de reservas online.' 
                        : 'Help us measure visitors and analyze usage statistical patterns of our online booking platform.'}
                    </p>
                  </div>
                </div>

                {/* 4. Marketing */}
                <div className={cn(
                  "p-4 rounded-2xl border flex items-start gap-4 transition-colors",
                  isDark ? "bg-gray-950/40 border-gray-800" : "bg-gray-50/50 border-gray-100"
                )}>
                  <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl shrink-0 mt-0.5">
                    <Cookie size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Marketing
                      </h4>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={preferences.marketing} 
                          onChange={() => handleToggle('marketing')}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                    <p className={cn(
                      "text-[11px] mt-1 leading-relaxed",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' 
                        ? 'Servem para monitorizar interesses e oferecer campanhas de descontos ou promoções personalizadas.' 
                        : 'Used to track interests and deliver tailored promotional campaigns or custom discount banners.'}
                    </p>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="w-full flex gap-3">
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className={cn(
                    "flex-1 px-5 py-3 text-xs font-bold rounded-xl transition-all border uppercase tracking-wider",
                    isDark 
                      ? "text-gray-300 border-gray-700 hover:bg-gray-800" 
                      : "text-gray-600 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  {language === 'pt' ? 'Salvar Escolha' : 'Save Choice'}
                </button>
                <button
                  type="button"
                  onClick={() => handleChoice('accepted')}
                  className="flex-1 px-6 py-3 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 uppercase tracking-wider"
                >
                  {language === 'pt' ? 'Aceitar Todos' : 'Accept All'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
