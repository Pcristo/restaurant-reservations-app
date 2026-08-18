import React from 'react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { Wrench, Mail, Phone, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_CONFIG } from '../data/appConfig';

export default function Maintenance() {
  const { settings } = useSettings();
  const { language } = useLanguage();

  const isDark = settings?.theme === 'dark';
  const restaurantName = settings?.name || APP_CONFIG.appName;

  // Custom maintenance message fallback
  const defaultMsgPt = 'De momento o nosso sistema de reservas online encontra-se em manutenção programada para melhorarmos o nosso serviço. Por favor, tente novamente mais tarde ou contacte-nos diretamente.';
  const defaultMsgEn = 'Our online booking system is currently undergoing scheduled maintenance to improve our service. Please try again later or contact us directly.';

  const message = language === 'pt'
    ? (settings?.maintenanceMessage || defaultMsgPt)
    : (settings?.maintenanceMessageEn || defaultMsgEn);

  const showHero = settings?.maintenanceShowHero;
  const heroUrl = settings?.heroImageUrl || (settings?.useCloudinary && settings?.cloudinaryHeroImageUrl) || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1920&q=80";

  const backgroundStyle = showHero ? {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.55)), url(${heroUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : undefined;

  return (
    <div 
      style={backgroundStyle}
      className={cn(
        "min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300",
        isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
      )}
    >
      <div className="max-w-xl w-full space-y-6 text-center flex flex-col items-center">
        {/* Animated Icon - Kept OUTSIDE the box */}
        <div className="p-4 bg-amber-500/10 text-amber-500 rounded-3xl animate-pulse">
          <Wrench size={48} className="animate-bounce" style={{ animationDuration: '3s' }} />
        </div>

        {/* Custom Card with restaurant name, maintenance status, message, and contacts */}
        <div className={cn(
          "w-full rounded-3xl p-10 md:p-12 shadow-2xl border text-sm leading-relaxed space-y-8 transition-all duration-300 min-h-[450px] flex flex-col justify-center items-center",
          isDark ? "bg-gray-900 border-gray-800 text-gray-300" : "bg-white border-gray-100 text-gray-600"
        )}>
          {/* Header info inside the box */}
          <div className="flex flex-col items-center space-y-4 w-full">
            <h1 className={cn(
              "text-3xl md:text-4xl font-extrabold tracking-tight",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {restaurantName}
            </h1>
            
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 uppercase tracking-wider">
              <Clock size={12} />
              {language === 'pt' ? 'Em Manutenção' : 'Under Maintenance'}
            </div>
          </div>

          {/* Message inside the box */}
          <p className={cn(
            "text-base md:text-lg font-medium leading-relaxed max-w-md mx-auto",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>
            {message}
          </p>

          {/* Contact Details inside the box */}
          {(settings?.phone || settings?.email) && (
            <div className={cn(
              "border-t pt-8 space-y-4 w-full max-w-sm",
              isDark ? "border-gray-800" : "border-gray-100"
            )}>
              <p className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                {language === 'pt' ? 'Contacte-nos' : 'Contact Us'}
              </p>
              
              <div className="flex flex-col items-center justify-center gap-2.5">
                {settings?.phone && (
                  <a 
                    href={`tel:${settings.phone}`}
                    className="inline-flex items-center gap-2 font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                  >
                    <Phone size={14} />
                    <span>{settings.phone}</span>
                  </a>
                )}
                
                {settings?.email && (
                  <a 
                    href={`mailto:${settings.email}`}
                    className="inline-flex items-center gap-2 font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                  >
                    <Mail size={14} />
                    <span>{settings.email}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
