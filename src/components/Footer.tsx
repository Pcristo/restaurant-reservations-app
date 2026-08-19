import { FaFacebook, FaInstagram } from 'react-icons/fa';
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { MapPin, Phone, Mail, Clock, Music2, Globe, Map, MessageCircle, Video, Link2 } from 'lucide-react';
import dayjs from 'dayjs';
import { cn, getOptimizedUrl, formatDisplayTime } from '../lib/utils';
import { APP_CONFIG } from '../data/appConfig';

export default function Footer() {
  const { settings } = useSettings();
  const location = useLocation();
  const { language, t } = useLanguage();

  // Handle Google Maps Widget Scripts
  useEffect(() => {
    if (settings?.showGoogleMapsWidget && settings?.googleMapsWidget) {
      const container = document.createElement('div');
      container.innerHTML = settings.googleMapsWidget;
      const scripts = container.querySelectorAll('script');
      
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        if (oldScript.innerHTML) newScript.innerHTML = oldScript.innerHTML;
        document.body.appendChild(newScript);
      });

      return () => {
        scripts.forEach(s => {
          if (s.src) {
            const added = document.querySelector(`script[src="${s.src}"]`);
            if (added) added.remove();
          }
        });
      };
    }
  }, [settings?.showGoogleMapsWidget, settings?.googleMapsWidget]);

  const footerStyle = settings?.footerImageUrl || (settings?.useCloudinary && settings?.cloudinaryFooterImageUrl) ? {
    backgroundImage: `url(${getOptimizedUrl(settings?.footerImageUrl, settings, 'footer')})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {
    backgroundImage: 'url(https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2070)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return <FaFacebook size={20} />;
      case 'instagram': return <FaInstagram size={20} />;
      case 'tiktok': return <Music2 size={20} />;
      case 'youtube': return <Video size={20} />;
      case 'tripadvisor': return (
        <img 
          src="https://www.vectorlogo.zone/logos/tripadvisor/tripadvisor-icon.svg" 
          alt="TripAdvisor" 
          className="w-5 h-5"
          referrerPolicy="no-referrer"
        />
      );
      default: return null;
    }
  };

  return (
    <footer className={cn(
      "relative overflow-hidden transition-colors duration-300",
      settings?.theme === 'dark' ? "bg-gray-950 text-white" : "bg-gray-900 text-white"
    )} style={footerStyle}>
      {/* Overlay */}
      <div 
        className="absolute inset-0" 
        style={{ 
          backgroundColor: settings?.footerOverlay || '#000000',
          opacity: settings?.footerOverlayOpacity ?? 0.7
        }}
      />
      
      <div className={cn("relative mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand & Info */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              {settings?.showLogo !== false && (settings?.logoUrl || settings?.cloudinaryLogoUrl) && (
                <img 
                  src={getOptimizedUrl(settings?.logoUrl, settings, 'logo')} 
                  alt="Logo" 
                  className="w-auto rounded-lg object-contain" 
                  style={{ height: `${settings?.logoSize || 40}px` }}
                  referrerPolicy="no-referrer" 
                />
              )}
              {settings?.showRestaurantName !== false && (
                <h2 className="text-2xl font-bold text-amber-500 leading-tight">
                  {settings?.name || APP_CONFIG.appName}
                </h2>
              )}
            </div>
            <p className="text-gray-300 max-w-xs">
              {language === 'en'
                ? (settings?.descriptionEn || settings?.description || APP_CONFIG.description || t('public.hero_subtitle'))
                : (settings?.description || settings?.descriptionEn || APP_CONFIG.description || t('public.hero_subtitle'))}
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-gray-300">
                <MapPin className="text-amber-500 shrink-0 mt-1" size={18} />
                <span>{settings?.address || APP_CONFIG.address}</span>
              </div>
              
              {/* Primary Phone */}
              <div className="flex items-center gap-3 text-gray-300">
                <Phone className="text-amber-500 shrink-0" size={18} />
                <span>{settings?.phone || APP_CONFIG.phone}</span>
              </div>

              {/* Secondary Phone */}
              {settings?.secondaryPhone && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Phone className="text-amber-500 shrink-0" size={18} />
                  <span>{settings.secondaryPhone}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-gray-300">
                <Mail className="text-amber-500 shrink-0" size={18} />
                <span>{settings?.email || APP_CONFIG.email}</span>
              </div>
            </div>

            {/* Social Links */}
            {settings?.socialLinks && settings.socialLinks.length > 0 && (
              <div className="flex items-center gap-4 pt-4">
                {settings.socialLinks.map((link, index) => (
                  <a 
                    key={index} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:bg-amber-600 hover:text-white transition-all"
                  >
                    {getSocialIcon(link.platform)}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Opening Hours */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="text-amber-500" size={20} />
              {t('common.opening_hours')}
            </h3>
            <div className="space-y-2 text-gray-300">
              {settings?.openingHours ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                const hours = settings.openingHours[day];
                if (!hours) return null;
                return (
                  <div key={day} className="flex justify-between border-b border-gray-800 pb-1">
                    <span className="font-medium">{t(`days.${day.toLowerCase()}`)}</span>
                    <span>
                      {hours.closed ? t('common.closed') : (
                        <div className="text-right text-sm">
                          {hours.lunch?.active && (
                            <div>{t('common.lunch')}: {formatDisplayTime(hours.lunch.open, settings)} - {formatDisplayTime(hours.lunch.close, settings)}</div>
                          )}
                          {hours.dinner?.active && (
                            <div>{t('common.dinner')}: {formatDisplayTime(hours.dinner.open, settings)} - {formatDisplayTime(hours.dinner.close, settings)}</div>
                          )}
                          {!hours.lunch?.active && !hours.dinner?.active && (
                            <div>{formatDisplayTime(hours.open, settings)} - {formatDisplayTime(hours.close, settings)}</div>
                          )}
                        </div>
                      )}
                    </span>
                  </div>
                );
              }) : (
                <p>{t('common.loading')}</p>
              )}
            </div>
            
            {/* Special Schedules */}
            {settings?.specialSchedulesActive && settings.specialSchedules && settings.specialSchedules.filter(s => !s.closed).length > 0 && (
              <div className="pt-4 mt-4 border-t border-gray-800">
                <h4 className="text-amber-500 font-semibold mb-2">
                  {language === 'pt' ? 'Aberturas Especiais' : 'Special Openings'}
                </h4>
                <div className="space-y-3">
                  {settings.specialSchedules.filter(s => !s.closed).map(schedule => (
                    <div key={schedule.id} className="text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                       <div className="font-semibold text-gray-200 mb-1">
                         {language === 'pt' ? 'Aberto de ' : 'Open '} 
                         {dayjs(schedule.startDate).format('DD/MM/YYYY')} 
                         {schedule.startDate !== schedule.endDate && ` ${language === 'pt' ? 'a' : 'to'} ${dayjs(schedule.endDate).format('DD/MM/YYYY')}`}
                       </div>
                       <div className="text-gray-400 space-y-0.5">
                          {schedule.lunch?.active && (
                            <div>{t('common.lunch')}: {formatDisplayTime(schedule.lunch.open, settings)} - {formatDisplayTime(schedule.lunch.close, settings)}</div>
                          )}
                          {schedule.dinner?.active && (
                            <div>{t('common.dinner')}: {formatDisplayTime(schedule.dinner.open, settings)} - {formatDisplayTime(schedule.dinner.close, settings)}</div>
                          )}
                          {!schedule.lunch?.active && !schedule.dinner?.active && schedule.open && schedule.close && (
                            <div>{formatDisplayTime(schedule.open, settings)} - {formatDisplayTime(schedule.close, settings)}</div>
                          )}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Localization & Quick Links */}
          <div className="space-y-8">
            {/* Google Maps Widget */}
            {settings?.showGoogleMapsWidget && settings?.googleMapsWidget && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <MapPin className="text-amber-500" size={20} />
                  {t('common.localization')}
                </h3>
                <div className="rounded-xl overflow-hidden shadow-lg border border-gray-800 bg-gray-800/50 w-full relative">
                  <style dangerouslySetInnerHTML={{ __html: `
                    .footer-map-container iframe {
                      width: 100% !important;
                      height: 200px !important;
                      border: none !important;
                      display: block;
                    }
                  `}} />
                  <div 
                    className="footer-map-container"
                    dangerouslySetInnerHTML={{ 
                      __html: settings.googleMapsWidget.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, '') 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{t('common.quick_links')}</h3>
              <ul className="space-y-2.5 text-gray-300">
                {settings?.websiteUrl && (
                  <li>
                    <a href={settings.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors text-sm">{t('nav.website')}</a>
                  </li>
                )}
                <li>
                  <Link to="/privacy" className="hover:text-amber-500 transition-colors text-sm">{t('common.privacy_policy')}</Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-amber-500 transition-colors text-sm">{t('common.terms_conditions')}</Link>
                </li>
                <li>
                  <Link to="/cookies" className="hover:text-amber-500 transition-colors text-sm">{t('common.cookie_policy')}</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} {settings?.name || APP_CONFIG.appName}. {t('common.all_rights_reserved')}</p>
        </div>
      </div>
    </footer>
  );
}
