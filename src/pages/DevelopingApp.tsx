import React, { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { Lock, ArrowRight, Eye, EyeOff, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import logoZ from '../assets/developer/zarco_logo_z_no_bg.png';
import logo1 from '../assets/developer/zarco_logo_1.png';
import zarcoZLogo from '../assets/developer/zarco_Z-no_bg.png';
import { APP_CONFIG } from '../data/appConfig';

interface DevelopingAppProps {
  onUnlock: () => void;
}

export default function DevelopingApp({ onUnlock }: DevelopingAppProps) {
  const { settings } = useSettings();
  const { language, setLanguage } = useLanguage();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [logoLoaded, setLogoLoaded] = useState(false);

  const [logoSrc, setLogoSrc] = useState<string | null>(logo1);

  const restaurantName = settings?.name || APP_CONFIG.appName;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings?.developingPassword) {
      // If no password is set, allow access
      onUnlock();
      return;
    }

    if (password === settings.developingPassword) {
      onUnlock();
    } else {
      setError(
        language === 'pt'
          ? 'Palavra-passe incorreta. Por favor, tente novamente.'
          : 'Incorrect password. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#030f20] text-gray-100 flex flex-col items-center justify-between py-12 px-6 font-sans">
      {/* Top Section with Language Selector */}
      <div className="w-full max-w-md flex justify-end">
        <div className="flex items-center gap-1 bg-[#0c1e36] border border-[#173154] p-1 rounded-full shadow-sm">
          <button
            type="button"
            onClick={() => {
              setLanguage('en');
              setError('');
            }}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer",
              language === 'en'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            )}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => {
              setLanguage('pt');
              setError('');
            }}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer",
              language === 'pt'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            )}
          >
            PT
          </button>
        </div>
      </div>

      {/* Center Section: Lock Form */}
      <div className="w-full max-w-sm flex flex-col items-center text-center my-auto space-y-8">
        {/* Dynamic Logo with fallbacks */}
        <div className="flex flex-col items-center justify-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Brand Logo"
              className="h-24 w-auto object-contain max-w-[240px] animate-in fade-in zoom-in-95 duration-300"
              onLoad={() => setLogoLoaded(true)}
              onError={() => {
                if (logoSrc === logo1) {
                  setLogoSrc(logoZ); // try logoZ next
                } else {
                  setLogoSrc(null); // trigger Lock fallback
                }
              }}
            />
          ) : null}

          {(!logoSrc || !logoLoaded) && (
            <div className={cn(
              "p-4 bg-[#0c1e36] border border-[#173154] text-gray-300 rounded-2xl shadow-sm flex items-center justify-center",
              logoSrc && "hidden" // Only hide if we are still attempting to load an active logoSrc
            )}>
              <Lock size={32} />
            </div>
          )}

          {/* App Name Under Logo */}
          <div className="mt-4 text-xl font-black tracking-wider text-white uppercase">
            {APP_CONFIG.appName}
          </div>

          {/* Developed By Text closer to App Name */}
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-500">
            {language === 'pt' ? 'Desenvolvimento por Zarco Studios' : 'Under development by Zarco Studios'}
          </p>
        </div>

        {/* Texts */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tight">
            {language === 'pt' ? `Projeto ${restaurantName}` : `Project ${restaurantName}`}
          </h1>
          <p className="text-sm text-gray-300 max-w-xs mx-auto leading-relaxed">
            {language === 'pt'
              ? 'Esta aplicação encontra-se em desenvolvimento privado. Insira a palavra-passe para aceder.'
              : 'This application is currently under private development. Enter password to access.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder={language === 'pt' ? 'Palavra-passe de acesso' : 'Access password'}
              className="w-full pl-4 pr-12 py-3 bg-[#0c1e36] border border-[#173154] rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer p-0.5"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-500 text-left px-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-amber-500/10 active:scale-95 cursor-pointer"
          >
            <span>{language === 'pt' ? 'Aceder' : 'Enter'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      {/* Footer Section */}
      <div className="w-full max-w-md text-center text-[11px] text-gray-400 font-medium space-y-2 flex flex-col items-center">
        <div>
          <div>
            {language === 'pt' ? `Projeto ${restaurantName}` : `Project ${restaurantName}`}
          </div>
          <div>
            © 2026 {APP_CONFIG.companyName}. {language === 'pt' ? 'Todos os direitos reservados.' : 'All rights reserved.'}
          </div>
        </div>
        {zarcoZLogo && (
          <img 
            src={zarcoZLogo} 
            alt="Zarco Z Logo" 
            className="h-10 w-auto opacity-50 hover:opacity-90 transition-opacity mt-1" 
          />
        )}
      </div>
    </div>
  );
}
