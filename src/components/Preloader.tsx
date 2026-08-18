import React from 'react';
import { motion } from 'motion/react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { getOptimizedUrl, cn } from '../lib/utils';
import { APP_CONFIG } from '../data/appConfig';
import zarcoLogo1 from '../assets/developer/zarco_logo_1.png';

const Preloader: React.FC = () => {
  const { settings, loading } = useSettings();
  const { language, t } = useLanguage();
  const logo = settings?.logoUrl || (settings?.useCloudinary && settings?.cloudinaryLogoUrl);

  const getBgClass = () => {
    const bgType = settings?.preloaderBg || 'white';
    if (bgType === 'dark') {
      return "bg-[#030f20]";
    }
    if (bgType === 'brand') {
      return "";
    }
    return "bg-white";
  };

  const getInlineStyle = () => {
    const bgType = settings?.preloaderBg || 'white';
    if (bgType === 'brand' && settings?.primaryColor) {
      return { backgroundColor: settings.primaryColor };
    }
    return {};
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        getBgClass()
      )}
      style={getInlineStyle()}
    >
      <div className="relative">
        {/* Spinning Outer Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-18px] border-4 border-amber-600 border-t-transparent rounded-full shadow-lg shadow-amber-200/50"
        />
        
        {/* Spinning Inner Ring (Opposite direction) */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 1.42, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-11px] border-2 border-amber-400 border-b-transparent rounded-full opacity-50"
        />

        {/* Logo Container (No square box background) */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.8,
            scale: { type: "spring", damping: 15, stiffness: 100 }
          }}
          className="w-32 h-32 flex items-center justify-center p-2 z-10"
        >
          {loading ? (
            <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          ) : logo ? (
            <img 
              src={getOptimizedUrl(settings?.logoUrl, settings, 'logo')} 
              alt={settings?.name || "Logo"} 
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-2xl font-black text-amber-600 italic">
              {settings?.name?.charAt(0) || "D"}
            </div>
          )}
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap text-center"
        >
          <span className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">
            {t('common.loading')}
          </span>
          <div className="flex justify-center gap-1 mt-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="w-1.5 h-1.5 bg-amber-500 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Footer Info: App Name from Config & Developed by Zarco */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="absolute bottom-6 inset-x-0 flex flex-col items-center justify-center gap-1 text-center pointer-events-none select-none z-20 px-4"
      >
        <span className={cn(
          "text-xs font-bold tracking-wider uppercase",
          settings?.preloaderBg === 'dark' ? "text-gray-400" : "text-gray-500"
        )}>
          {APP_CONFIG.appName}
        </span>
        <div className={cn(
          "flex items-center justify-center gap-1.5 text-[12px] font-medium scale-[1.08]", // Increased text size and overall scale by 8%
          settings?.preloaderBg === 'dark' ? "text-gray-400" : "text-gray-500"
        )}>
          <span>{language === 'pt' ? 'Desenvolvido por' : 'Developed by'}</span>
          <img 
            src={zarcoLogo1} 
            alt="Zarco" 
            className="h-5 sm:h-[22px] w-auto object-contain opacity-85 scale-[1.06] origin-left inline-block"
            referrerPolicy="no-referrer"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Preloader;
