import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RestaurantSettings, RestaurantSEO } from '../../types';
import { useLanguage } from '../../hooks/useLanguage';
import { cn, getOptimizedUrl } from '../../lib/utils';
import {
  Globe,
  Search,
  Share2,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Smartphone,
  Monitor,
  Info,
  Code2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCcw,
  Palette,
  X,
  Cloud,
  Trash2,
  Compass
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface RestaurantSEOSettingsProps {
  formData: RestaurantSettings;
  setFormData: React.Dispatch<React.SetStateAction<RestaurantSettings>>;
  uploadingField: string | null;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, field: string) => Promise<void>;
  theme?: 'light' | 'dark';
}

function isColorBright(hex?: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const num = parseInt(full, 16);
  if (isNaN(num)) return false;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

export const RestaurantSEOSettings: React.FC<RestaurantSEOSettingsProps> = ({
  formData,
  setFormData,
  uploadingField,
  handleFileUpload,
  theme = 'light',
}) => {
  const { t, language } = useLanguage();
  const isDark = theme === 'dark';

  // Language tab for bilingual SEO editing
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'pt'>(language === 'pt' ? 'pt' : 'en');
  // Preview mode toggles
  const [googlePreviewMode, setGooglePreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [socialPreviewMode, setSocialPreviewMode] = useState<'facebook' | 'twitter'>('facebook');
  // Collapsible cards state
  const [showJsonLd, setShowJsonLd] = useState(false);
  const [hasCopiedJsonLd, setHasCopiedJsonLd] = useState(false);

  // Safe access to seo object
  const seo: RestaurantSEO = formData.seo || {};

  const updateSEO = (updates: Partial<RestaurantSEO>) => {
    setFormData(prev => ({
      ...prev,
      seo: {
        ...(prev.seo || {}),
        ...updates
      }
    }));
  };

  // Helper values for current language view
  const currentTitle = activeLangTab === 'pt' ? (seo.seoTitlePt ?? '') : (seo.seoTitleEn ?? '');
  const currentDesc = activeLangTab === 'pt' ? (seo.metaDescriptionPt ?? '') : (seo.metaDescriptionEn ?? '');
  const currentKeywords = activeLangTab === 'pt' ? (seo.keywordsPt ?? '') : (seo.keywords ?? '');
  const currentSocialTitle = activeLangTab === 'pt' ? (seo.socialTitlePt ?? '') : (seo.socialTitle ?? '');
  const currentSocialDesc = activeLangTab === 'pt' ? (seo.socialDescriptionPt ?? '') : (seo.socialDescription ?? '');

  // Live Effective Values for Search Snippet & Previews
  const effectiveTitle = currentTitle ||
    seo.seoTitle ||
    `${formData.name || 'Restaurant'} | ${seo.cuisineType || 'Restaurant'} | ${seo.city || 'Fine Dining'}`;

  const effectiveDesc = currentDesc ||
    seo.metaDescription ||
    (activeLangTab === 'pt' ? formData.description : (formData.descriptionEn || formData.description)) ||
    'Experience exceptional dining with authentic flavors and handcrafted dishes. Book your table online for an unforgettable culinary journey.';

  const effectiveSocialTitle = currentSocialTitle || effectiveTitle;
  const effectiveSocialDesc = currentSocialDesc || effectiveDesc;
  const effectiveSocialImage = (formData.useCloudinary && seo.cloudinarySocialImageUrl)
    ? seo.cloudinarySocialImageUrl
    : (seo.socialImageUrl || seo.cloudinarySocialImageUrl || '');

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const effectiveCanonicalUrl = seo.canonicalUrl || seo.ogUrl || `${originUrl}/`;
  const effectiveSiteName = seo.siteName || formData.name || 'Restaurant';

  // Favicon for Google SERP Preview (Admin configured custom favicon or default)
  const customFavicon = getOptimizedUrl(formData.faviconUrl, formData, 'favicon') ||
    (formData.useCloudinary && formData.cloudinaryFaviconUrl ? formData.cloudinaryFaviconUrl : formData.faviconUrl) ||
    '';
  const effectiveFavicon = customFavicon.trim() !== '' ? customFavicon.trim() : '/favicon.svg';
  const isCustomFavicon = customFavicon.trim() !== '';

  // Custom Box Background Color for Social Preview Simulator
  const customSocialBoxBg = seo.socialPreviewCardBg || '';
  const isCustomSocialBoxBg = Boolean(customSocialBoxBg && customSocialBoxBg.trim() !== '');

  // Auto-fill from restaurant profile
  const handleAutoFillFromProfile = () => {
    const defaultCity = formData.address ? formData.address.split(',').pop()?.trim() || '' : '';
    const name = formData.name || 'Restaurant';
    const cuisine = seo.cuisineType || 'Contemporary Dining';

    updateSEO({
      seoTitleEn: seo.seoTitleEn || `${name} | ${cuisine} | Table Reservations`,
      seoTitlePt: seo.seoTitlePt || `${name} | ${cuisine} | Reservas de Mesa`,
      metaDescriptionEn: seo.metaDescriptionEn || formData.descriptionEn || formData.description || `Reserve your table at ${name}. Enjoy authentic ${cuisine} and exceptional fine dining. Instant online confirmation.`,
      metaDescriptionPt: seo.metaDescriptionPt || formData.description || `Faça a sua reserva no ${name}. Desfrute de excelente gastronomia ${cuisine} e serviço de excelência. Confirmação imediata online.`,
      keywords: seo.keywords || `${name}, restaurant, reservations, fine dining, online booking, ${cuisine}, ${defaultCity}`,
      keywordsPt: seo.keywordsPt || `${name}, restaurante, reservas, gastronomia, reservar mesa, ${cuisine}, ${defaultCity}`,
      streetAddress: seo.streetAddress || formData.address || '',
      city: seo.city || defaultCity,
      country: seo.country || (formData.region === 'ireland' ? 'Ireland' : 'Portugal'),
      socialTitle: seo.socialTitle || `${name} - Book Your Table Online`,
      socialTitlePt: seo.socialTitlePt || `${name} - Reserve a Sua Mesa Online`,
      socialDescription: seo.socialDescription || formData.descriptionEn || formData.description || `Book your table online at ${name}.`,
      socialDescriptionPt: seo.socialDescriptionPt || formData.description || `Reserve a sua mesa online no ${name}.`,
      socialImageUrl: seo.socialImageUrl || '',
      cloudinarySocialImageUrl: seo.cloudinarySocialImageUrl || '',
      allowIndexing: seo.allowIndexing !== undefined ? seo.allowIndexing : true,
    });

    toast.success(t('settings.seo_sync_success'));
  };

  // SEO Health Score Calculation (0 to 100%)
  const healthChecklist = useMemo(() => {
    const titleLen = (currentTitle || seo.seoTitle || '').length;
    const descLen = (currentDesc || seo.metaDescription || '').length;
    const hasCuisine = Boolean(seo.cuisineType && seo.cuisineType.trim());
    const hasAddress = Boolean((seo.streetAddress || formData.address) && seo.city);
    const hasImage = Boolean(effectiveSocialImage);
    const hasKeywords = Boolean((currentKeywords || seo.keywords || '').trim());
    const hasLocalLinks = Boolean(seo.googleBusinessUrl || seo.googleMapsUrl);
    const isIndexingAllowed = seo.allowIndexing !== false;
    const hasCoordinates = Boolean(seo.latitude && seo.longitude);

    const items = [
      {
        id: 'title',
        label: language === 'pt' ? 'Título SEO configurado (30-60 caracteres)' : 'SEO Title configured (30-60 characters)',
        passed: titleLen >= 30 && titleLen <= 65,
        warning: titleLen > 0 && (titleLen < 30 || titleLen > 65),
        points: 20,
        tip: titleLen === 0 
          ? (language === 'pt' ? 'Adicione um título descritivo para os resultados de pesquisa.' : 'Add a descriptive title for search engine results.')
          : titleLen < 30 
            ? (language === 'pt' ? 'Título curto. Adicione o tipo de cozinha ou cidade.' : 'Title is short. Add cuisine type or city name.')
            : (language === 'pt' ? 'Título demasiado longo (>65 caracteres). Pode ser cortado no Google.' : 'Title is too long (>65 chars). May get truncated on Google.')
      },
      {
        id: 'desc',
        label: language === 'pt' ? 'Meta Descrição ideal (120-160 caracteres)' : 'Meta Description optimal (120-160 characters)',
        passed: descLen >= 120 && descLen <= 165,
        warning: descLen > 0 && (descLen < 120 || descLen > 165),
        points: 20,
        tip: descLen === 0 
          ? (language === 'pt' ? 'Adicione uma meta descrição cativante com chamada para reserva.' : 'Add an engaging meta description with a call to reserve.')
          : descLen < 120 
            ? (language === 'pt' ? 'Descrição curta. Descreva pratos especiais ou localização.' : 'Description is short. Mention specialty dishes or location.')
            : (language === 'pt' ? 'Descrição longa (>165 caracteres). O Google irá truncar o texto.' : 'Description is long (>165 chars). Google will truncate the snippet.')
      },
      {
        id: 'cuisine',
        label: language === 'pt' ? 'Tipo de Cozinha / Restaurante especificado' : 'Restaurant Cuisine / Type specified',
        passed: hasCuisine,
        points: 15,
        tip: language === 'pt' ? 'Ajuda clientes a encontrar o restaurante por categorias como "Marisco", "Italiano", etc.' : 'Helps diners discover your venue for searches like "Seafood", "Italian", etc.'
      },
      {
        id: 'location',
        label: language === 'pt' ? 'Morada e Cidade configuradas para SEO Local' : 'Address and City configured for Local SEO',
        passed: hasAddress,
        points: 15,
        tip: language === 'pt' ? 'Essencial para aparecer nos resultados de mapa "restaurantes perto de mim".' : 'Crucial for ranking in local "restaurants near me" searches.'
      },
      {
        id: 'social_img',
        label: language === 'pt' ? 'Imagem de Partilha Social (Open Graph)' : 'Social Sharing Image (Open Graph)',
        passed: hasImage,
        points: 10,
        tip: language === 'pt' ? 'Garante cartões visuais atraentes no WhatsApp e redes sociais.' : 'Ensures attractive rich previews when links are shared on WhatsApp & social media.'
      },
      {
        id: 'keywords',
        label: language === 'pt' ? 'Palavras-chave de pesquisa adicionadas' : 'Search engine keywords added',
        passed: hasKeywords,
        points: 10,
        tip: language === 'pt' ? 'Ajuda os motores de busca a indexar temas gastronómicos relevantes.' : 'Helps search engines understand your culinary offerings and specialties.'
      },
      {
        id: 'indexing',
        label: language === 'pt' ? 'Indexação em Motores de Busca ativada' : 'Search Engine Indexing enabled',
        passed: isIndexingAllowed,
        points: 10,
        tip: isIndexingAllowed 
          ? (language === 'pt' ? 'O seu site está visível para indexação no Google.' : 'Your site is visible for Google indexing.')
          : (language === 'pt' ? 'Aviso: O site está com noindex ativo!' : 'Warning: Site has noindex enabled!')
      }
    ];

    const totalPoints = items.reduce((sum, item) => sum + (item.passed ? item.points : (item.warning ? item.points * 0.5 : 0)), 0);
    const score = Math.round(totalPoints);

    return { items, score };
  }, [currentTitle, currentDesc, currentKeywords, seo, formData, effectiveSocialImage, language]);

  // Generate Schema.org JSON-LD string
  const jsonLdString = useMemo(() => {
    const sameAs: string[] = [];
    if (seo.googleBusinessUrl) sameAs.push(seo.googleBusinessUrl);
    if (seo.googleMapsUrl) sameAs.push(seo.googleMapsUrl);
    if (formData.socialLinks) {
      formData.socialLinks.forEach(l => { if (l.url) sameAs.push(l.url); });
    }

    const openingHoursSpec: any[] = [];
    if (formData.openingHours) {
      Object.entries(formData.openingHours).forEach(([day, hours]) => {
        if (!hours || hours.closed) return;
        const dayMap: Record<string, string> = {
          Monday: 'https://schema.org/Monday',
          Tuesday: 'https://schema.org/Tuesday',
          Wednesday: 'https://schema.org/Wednesday',
          Thursday: 'https://schema.org/Thursday',
          Friday: 'https://schema.org/Friday',
          Saturday: 'https://schema.org/Saturday',
          Sunday: 'https://schema.org/Sunday',
        };
        const dayOfWeek = dayMap[day] || `https://schema.org/${day}`;
        if (hours.lunch?.active) {
          openingHoursSpec.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek,
            opens: hours.lunch.open || '12:00',
            closes: hours.lunch.close || '15:00'
          });
        }
        if (hours.dinner?.active) {
          openingHoursSpec.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek,
            opens: hours.dinner.open || '19:00',
            closes: hours.dinner.close || '23:00'
          });
        }
        if (!hours.lunch?.active && !hours.dinner?.active && hours.open && hours.close) {
          openingHoursSpec.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek,
            opens: hours.open,
            closes: hours.close
          });
        }
      });
    }

    const data: any = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: formData.name || 'Restaurant',
      image: effectiveSocialImage || undefined,
      description: effectiveDesc,
      telephone: formData.phone || formData.secondaryPhone || undefined,
      email: formData.email || undefined,
      url: effectiveCanonicalUrl,
      priceRange: seo.priceRange || '€€',
      servesCuisine: seo.cuisineType || 'Contemporary',
      acceptsReservations: 'True',
      address: {
        '@type': 'PostalAddress',
        streetAddress: seo.streetAddress || formData.address || '',
        addressLocality: seo.city || '',
        addressRegion: seo.stateCounty || '',
        postalCode: seo.postalCode || '',
        addressCountry: seo.country || (formData.region === 'ireland' ? 'IE' : 'PT')
      },
      openingHoursSpecification: openingHoursSpec.length > 0 ? openingHoursSpec : undefined,
      sameAs: sameAs.length > 0 ? sameAs : undefined
    };

    if (seo.latitude && seo.longitude) {
      data.geo = {
        '@type': 'GeoCoordinates',
        latitude: parseFloat(String(seo.latitude)),
        longitude: parseFloat(String(seo.longitude))
      };
    }

    return JSON.stringify(data, null, 2);
  }, [formData, seo, effectiveSocialImage, effectiveDesc, effectiveCanonicalUrl]);

  const handleCopyJsonLd = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(jsonLdString);
    setHasCopiedJsonLd(true);
    toast.success(t('settings.seo_jsonld_copied'), { id: 'seo-jsonld-toast' });
    setTimeout(() => setHasCopiedJsonLd(false), 2500);
  };

  // Keyword preset suggestions by editing language tab
  const keywordSuggestionsEn = [
    'Online Table Booking',
    'Fine Dining Experience',
    'Fresh Seafood & Fish',
    'Traditional Portuguese',
    'Romantic Dinner',
    'Outdoor Terrace & Patio',
    'Wine & Craft Cocktails',
    'Chef Specials',
    'Business Lunch',
    'Group Reservations',
    'Tasting Menu',
    'Scenic Sea View',
    'Vegetarian Options',
    'Live Music & Ambience',
    'Private Dining & Events',
    'Sunday Brunch'
  ];

  const keywordSuggestionsPt = [
    'Reservar Mesa Online',
    'Alta Gastronomia',
    'Peixe & Marisco Fresco',
    'Tradicional Portuguesa',
    'Jantar Romântico',
    'Restaurante com Esplanada',
    'Vinhos & Cocktails de Autor',
    'Especialidades do Chef',
    'Almoço de Negócios',
    'Reservas de Grupo',
    'Menú de Degustação',
    'Vista Mar Panorâmica',
    'Opções Vegetarianas & Vegan',
    'Música ao Vivo & Ambiente',
    'Eventos & Celebrações',
    'Prato do Dia'
  ];

  const currentKeywordSuggestions = activeLangTab === 'pt' ? keywordSuggestionsPt : keywordSuggestionsEn;

  const handleAddKeywordChip = (keyword: string) => {
    const field = activeLangTab === 'pt' ? 'keywordsPt' : 'keywords';
    const current = (activeLangTab === 'pt' ? seo.keywordsPt : seo.keywords) || '';
    const list = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!list.includes(keyword)) {
      list.push(keyword);
      updateSEO({ [field]: list.join(', ') });
    }
  };

  // Cuisine preset suggestions by editing language tab
  const cuisineSuggestionsEn = [
    'Traditional Portuguese',
    'Fresh Seafood & Shellfish',
    'Mediterranean',
    'Steakhouse & Grill',
    'Italian & Pasta',
    'Contemporary / Fusion',
    'Tapas & Small Plates',
    'Asian & Sushi',
    'Vegetarian & Organic',
    'French & Bistro',
    'Regional Madeira / Azores',
    'Gourmet Burgers',
    'Gastropub & Craft Cocktails',
    'Fine Dining & Tasting Menu',
    'Barbecue & Smokehouse',
    'Mexican & Latin'
  ];

  const cuisineSuggestionsPt = [
    'Tradicional Portuguesa',
    'Peixe Fresco & Marisqueira',
    'Mediterrânica',
    'Carnes & Grelhados / Steakhouse',
    'Italiana & Massas / Pizzaria',
    'Contemporânea / Fusão',
    'Tapas & Petiscos',
    'Sushi & Asiática',
    'Vegetariana & Orgânica',
    'Francesa & Bistrô',
    'Regional Madeirense / Açoriana',
    'Hambúrgueres Artesanais',
    'Gastropub & Bar de Cocktails',
    'Alta Gastronomia / Fine Dining',
    'Churrascaria & Rodízio',
    'Mexicana & Tacos'
  ];

  const currentCuisineSuggestions = activeLangTab === 'pt' ? cuisineSuggestionsPt : cuisineSuggestionsEn;

  const priceOptions = [
    { value: '€', label: '€ (Inexpensive)', desc: 'Under €15' },
    { value: '€€', label: '€€ (Moderate)', desc: '€15 – €35' },
    { value: '€€€', label: '€€€ (Expensive)', desc: '€35 – €70' },
    { value: '€€€€', label: '€€€€ (Fine Dining)', desc: '€70+' }
  ];

  return (
    <div className={cn(
      "p-6 rounded-xl shadow-sm border space-y-8 lg:col-span-3 transition-colors duration-300",
      isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
    )}>
      {/* 1. Main Header */}
      <div className={cn(
        "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b transition-colors",
        isDark ? "border-gray-800" : "border-gray-100"
      )}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Globe size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className={cn(
                "text-xl font-bold tracking-tight transition-colors",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {t('settings.seo')}
              </h2>
              <p className={cn(
                "text-xs mt-0.5",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                {t('settings.seo_desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Action button & Health Score Badge */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Health Score Pill */}
          <div className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all",
            healthChecklist.score >= 80 
              ? (isDark ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-800")
              : healthChecklist.score >= 50
                ? (isDark ? "bg-amber-950/40 border-amber-800 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800")
                : (isDark ? "bg-rose-950/40 border-rose-800 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800")
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              healthChecklist.score >= 80 ? "bg-emerald-500" : healthChecklist.score >= 50 ? "bg-amber-500" : "bg-rose-500"
            )} />
            <span>{t('settings.seo_health_score')}: <strong>{healthChecklist.score}%</strong></span>
          </div>

          {/* Auto-fill Button */}
          <button
            type="button"
            onClick={handleAutoFillFromProfile}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm",
              isDark 
                ? "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-white" 
                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Sparkles size={14} className="text-amber-500" />
            {t('settings.seo_sync_details')}
          </button>
        </div>
      </div>

      {/* Language Switcher Tabs */}
      <div className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b pb-3 transition-colors",
        isDark ? "border-gray-800" : "border-gray-200"
      )}>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-xs font-bold uppercase tracking-wider",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>
            {language === 'pt' ? 'Idioma de Edição:' : 'Editing Language:'}
          </span>
          <div className={cn(
            "flex items-center rounded-lg p-1 border transition-colors shadow-inner",
            isDark ? "bg-gray-800 border-gray-700" : "bg-gray-200/80 border-gray-300"
          )}>
            <button
              type="button"
              onClick={() => setActiveLangTab('en')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                activeLangTab === 'en'
                  ? (isDark 
                      ? "bg-gray-700 text-amber-400 shadow-sm border border-gray-600" 
                      : "bg-white text-amber-600 shadow-sm border border-gray-200")
                  : (isDark 
                      ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100")
              )}
            >
              English (EN)
            </button>
            <button
              type="button"
              onClick={() => setActiveLangTab('pt')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                activeLangTab === 'pt'
                  ? (isDark 
                      ? "bg-gray-700 text-amber-400 shadow-sm border border-gray-600" 
                      : "bg-white text-amber-600 shadow-sm border border-gray-200")
                  : (isDark 
                      ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100")
              )}
            >
              Português (PT)
            </button>
          </div>
        </div>

        <span className={cn(
          "text-[11px] italic hidden sm:inline",
          isDark ? "text-gray-400" : "text-gray-500"
        )}>
          {language === 'pt' ? 'Defina títulos e descrições específicos para cada língua.' : 'Configure language-specific titles and meta tags.'}
        </span>
      </div>

      {/* Grid of Modular SEO Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* CARD 1: Basic SEO Information */}
        <div className={cn(
          "p-5 rounded-2xl border space-y-5 transition-colors duration-200",
          isDark ? "bg-gray-800/40 border-gray-800" : "bg-gray-50/70 border-gray-200/70"
        )}>
          <div className="flex items-center justify-between border-b pb-3 border-gray-200/80 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-amber-600 dark:text-amber-400" />
              <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
                {t('settings.seo_basic_title')}
              </h3>
            </div>
            <span className={cn(
              "text-[10px] uppercase font-bold px-2.5 py-1 rounded-md border transition-colors",
              isDark ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-700"
            )}>
              {activeLangTab.toUpperCase()}
            </span>
          </div>

          {/* SEO Title Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t('settings.seo_title')}
              </label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={cn(
                  "font-mono font-bold",
                  currentTitle.length >= 30 && currentTitle.length <= 60 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : currentTitle.length > 60 
                      ? "text-amber-600 dark:text-amber-400" 
                      : "text-gray-400"
                )}>
                  {currentTitle.length} / 60
                </span>
                <span className="text-[10px] text-gray-400">chars</span>
              </div>
            </div>
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => {
                const key = activeLangTab === 'pt' ? 'seoTitlePt' : 'seoTitleEn';
                updateSEO({ [key]: e.target.value, seoTitle: e.target.value });
              }}
              placeholder={t('settings.seo_title_placeholder')}
              className={cn(
                "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('settings.seo_title_desc')} <span className="text-amber-600 dark:text-amber-400 font-medium">(~60 chars recommended)</span>
            </p>
          </div>

          {/* Meta Description Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t('settings.seo_meta_desc')}
              </label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={cn(
                  "font-mono font-bold",
                  currentDesc.length >= 130 && currentDesc.length <= 160 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : currentDesc.length > 160 
                      ? "text-amber-600 dark:text-amber-400" 
                      : "text-gray-400"
                )}>
                  {currentDesc.length} / 160
                </span>
                <span className="text-[10px] text-gray-400">chars</span>
              </div>
            </div>
            <textarea
              rows={3}
              value={currentDesc}
              onChange={(e) => {
                const key = activeLangTab === 'pt' ? 'metaDescriptionPt' : 'metaDescriptionEn';
                updateSEO({ [key]: e.target.value, metaDescription: e.target.value });
              }}
              placeholder={t('settings.seo_meta_desc_placeholder')}
              className={cn(
                "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('settings.seo_meta_desc_desc')} <span className="text-amber-600 dark:text-amber-400 font-medium">(140–160 chars recommended)</span>
            </p>
          </div>

          {/* Keywords Input with Quick Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              {t('settings.seo_keywords')}
            </label>
            <input
              type="text"
              value={currentKeywords}
              onChange={(e) => {
                const key = activeLangTab === 'pt' ? 'keywordsPt' : 'keywords';
                updateSEO({ [key]: e.target.value, keywords: e.target.value });
              }}
              placeholder={t('settings.seo_keywords_placeholder')}
              className={cn(
                "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('settings.seo_keywords_desc')}
            </p>

            {/* Quick Suggestions Chips */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span className="font-semibold uppercase tracking-wider">
                  {activeLangTab === 'pt' ? 'Sugestões Rápidas de Palavras-Chave:' : 'Quick Keyword Suggestions:'}
                </span>
                <span className="text-[10px] italic">
                  {activeLangTab === 'pt' ? 'Clique para adicionar' : 'Click to add'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {currentKeywordSuggestions.map((kw, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAddKeywordChip(kw)}
                    className={cn(
                      "text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all shadow-2xs",
                      isDark
                        ? "bg-gray-800 border-gray-700 text-gray-300 hover:border-amber-500 hover:text-amber-300 hover:bg-gray-750"
                        : "bg-white border-gray-200 text-gray-600 hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50/50"
                    )}
                  >
                    + {kw}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Website / Brand Name (og:site_name) */}
          <div className="space-y-1.5 pt-3 border-t border-gray-200/80 dark:border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t('settings.seo_site_name')}
              </label>
              <span className="text-[10px] font-mono text-gray-400">og:site_name</span>
            </div>
            <input
              type="text"
              value={seo.siteName || ''}
              onChange={(e) => updateSEO({ siteName: e.target.value })}
              placeholder={formData.name || t('settings.seo_site_name_placeholder')}
              className={cn(
                "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('settings.seo_site_name_desc')}
            </p>
          </div>

          {/* Canonical / Open Graph URL (og:url) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t('settings.seo_og_url')}
              </label>
              <span className="text-[10px] font-mono text-gray-400">og:url / canonical</span>
            </div>
            <input
              type="url"
              value={seo.ogUrl ?? seo.canonicalUrl ?? ''}
              onChange={(e) => updateSEO({ ogUrl: e.target.value, canonicalUrl: e.target.value })}
              placeholder={effectiveCanonicalUrl}
              className={cn(
                "w-full px-3.5 py-2.5 text-sm font-mono border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('settings.seo_og_url_desc')}
            </p>
          </div>
        </div>

        {/* CARD 2: Local SEO & Rich Snippets */}
        <div className={cn(
          "p-5 rounded-2xl border space-y-5 transition-colors duration-200",
          isDark ? "bg-gray-800/40 border-gray-800" : "bg-gray-50/70 border-gray-200/70"
        )}>
          <div className="flex items-center justify-between border-b pb-3 border-gray-200/80 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-amber-600 dark:text-amber-400" />
              <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
                {t('settings.seo_local_title')}
              </h3>
            </div>
            <span className="text-[10px] text-gray-400">Schema.org Rich Cards</span>
          </div>

          {/* Cuisine Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              {t('settings.seo_cuisine_type')}
            </label>
            <input
              type="text"
              value={seo.cuisineType || ''}
              onChange={(e) => updateSEO({ cuisineType: e.target.value })}
              placeholder={t('settings.seo_cuisine_placeholder')}
              className={cn(
                "w-full px-3.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span className="font-semibold uppercase tracking-wider">
                  {activeLangTab === 'pt' ? 'Sugestões de Tipo de Cozinha:' : 'Cuisine Type Suggestions:'}
                </span>
                <span className="text-[10px] italic">
                  {activeLangTab === 'pt' ? 'Clique para selecionar' : 'Click to select'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {currentCuisineSuggestions.map((cuisine, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateSEO({ cuisineType: cuisine })}
                    className={cn(
                      "text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all shadow-2xs text-left",
                      seo.cuisineType === cuisine
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : isDark
                          ? "bg-gray-800 border-gray-700 text-gray-300 hover:border-amber-500 hover:bg-gray-750"
                          : "bg-white border-gray-200 text-gray-700 hover:border-amber-500 hover:bg-amber-50/50"
                    )}
                  >
                    {cuisine}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              {t('settings.seo_price_range')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {priceOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateSEO({ priceRange: opt.value })}
                  className={cn(
                    "py-2 px-2.5 rounded-lg border text-center transition-all",
                    (seo.priceRange || '€€') === opt.value
                      ? (isDark ? "bg-amber-600 text-white border-amber-500 shadow-sm" : "bg-amber-600 text-white border-amber-600 shadow-sm")
                      : (isDark ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50")
                  )}
                >
                  <div className="text-xs font-bold">{opt.value}</div>
                  <div className="text-[10px] opacity-80">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Location Fields (City, State, Postal Code, Country) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                {t('settings.seo_city')}
              </label>
              <input
                type="text"
                value={seo.city || ''}
                onChange={(e) => updateSEO({ city: e.target.value })}
                placeholder="e.g. Funchal / Lisbon"
                className={cn(
                  "w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                {t('settings.seo_state')}
              </label>
              <input
                type="text"
                value={seo.stateCounty || ''}
                onChange={(e) => updateSEO({ stateCounty: e.target.value })}
                placeholder="e.g. Madeira / Dublin"
                className={cn(
                  "w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                {t('settings.seo_postal_code')}
              </label>
              <input
                type="text"
                value={seo.postalCode || ''}
                onChange={(e) => updateSEO({ postalCode: e.target.value })}
                placeholder="e.g. 9000-001"
                className={cn(
                  "w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                {t('settings.seo_country')}
              </label>
              <input
                type="text"
                value={seo.country || (formData.region === 'ireland' ? 'Ireland' : 'Portugal')}
                onChange={(e) => updateSEO({ country: e.target.value })}
                placeholder="Portugal"
                className={cn(
                  "w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>
          </div>

          {/* Street Address */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                {t('settings.seo_address')}
              </label>
              {formData.address && !seo.streetAddress && (
                <button
                  type="button"
                  onClick={() => updateSEO({ streetAddress: formData.address })}
                  className="text-[10px] text-amber-600 hover:underline"
                >
                  Use profile address
                </button>
              )}
            </div>
            <input
              type="text"
              value={seo.streetAddress || formData.address || ''}
              onChange={(e) => updateSEO({ streetAddress: e.target.value })}
              placeholder="123 Gourmet St"
              className={cn(
                "w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
              )}
            />
          </div>

          {/* Local Links (Google Business & Maps) */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                {t('settings.seo_google_business')}
              </label>
              <input
                type="url"
                value={seo.googleBusinessUrl || ''}
                onChange={(e) => updateSEO({ googleBusinessUrl: e.target.value })}
                placeholder="https://g.page/r/..."
                className={cn(
                  "w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                {t('settings.seo_google_maps')}
              </label>
              <input
                type="url"
                value={seo.googleMapsUrl || ''}
                onChange={(e) => updateSEO({ googleMapsUrl: e.target.value })}
                placeholder="https://maps.google.com/?cid=..."
                className={cn(
                  "w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>

            {/* Geo Coordinates */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  {t('settings.seo_latitude')}
                </label>
                <input
                  type="text"
                  value={seo.latitude || ''}
                  onChange={(e) => updateSEO({ latitude: e.target.value })}
                  placeholder="e.g. 32.6500"
                  className={cn(
                    "w-full px-3 py-2 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                  )}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  {t('settings.seo_longitude')}
                </label>
                <input
                  type="text"
                  value={seo.longitude || ''}
                  onChange={(e) => updateSEO({ longitude: e.target.value })}
                  placeholder="e.g. -16.9088"
                  className={cn(
                    "w-full px-3 py-2 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                  )}
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              {t('settings.seo_geo_hint')}
            </p>
          </div>
        </div>

        {/* CARD 3: Social Sharing (Open Graph & Twitter Cards) */}
        <div className={cn(
          "p-5 rounded-2xl border space-y-5 transition-colors duration-200",
          isDark ? "bg-gray-800/40 border-gray-800" : "bg-gray-50/70 border-gray-200/70"
        )}>
          <div className="flex items-center justify-between border-b pb-3 border-gray-200/80 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-amber-600 dark:text-amber-400" />
              <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
                {t('settings.seo_social_title')}
              </h3>
            </div>
            <span className="text-[10px] text-gray-400">Open Graph & Twitter</span>
          </div>

          {/* Social Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              {t('settings.seo_social_share_title')}
            </label>
            <input
              type="text"
              value={currentSocialTitle}
              onChange={(e) => {
                const key = activeLangTab === 'pt' ? 'socialTitlePt' : 'socialTitle';
                updateSEO({ [key]: e.target.value });
              }}
              placeholder={effectiveTitle}
              className={cn(
                "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <p className="text-[11px] text-gray-400 italic">
              {t('settings.seo_social_share_title_hint')}
            </p>
          </div>

          {/* Social Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              {t('settings.seo_social_share_desc')}
            </label>
            <textarea
              rows={2}
              value={currentSocialDesc}
              onChange={(e) => {
                const key = activeLangTab === 'pt' ? 'socialDescriptionPt' : 'socialDescription';
                updateSEO({ [key]: e.target.value });
              }}
              placeholder={effectiveDesc}
              className={cn(
                "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-colors",
                isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              )}
            />
            <p className="text-[11px] text-gray-400 italic">
              {t('settings.seo_social_share_desc_hint')}
            </p>
          </div>

          {/* Social Share Image Input & Cloudinary Upload */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-amber-600 dark:text-amber-400" />
                {t('settings.seo_social_image')}
              </label>

              <div className="flex items-center gap-2">
                {formData.heroImageUrl && !effectiveSocialImage && (
                  <button
                    type="button"
                    onClick={() => {
                      updateSEO({ 
                        socialImageUrl: formData.heroImageUrl, 
                        cloudinarySocialImageUrl: formData.cloudinaryHeroImageUrl || formData.heroImageUrl 
                      });
                      toast.success(language === 'pt' ? 'Imagem hero definida como imagem de partilha.' : 'Hero image set as social share image.');
                    }}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-medium"
                  >
                    Use Hero Image
                  </button>
                )}

                {effectiveSocialImage && (
                  <button
                    type="button"
                    onClick={() => {
                      updateSEO({
                        socialImageUrl: '',
                        cloudinarySocialImageUrl: ''
                      });
                      toast.success(
                        language === 'pt'
                          ? 'Imagem de partilha social removida.'
                          : 'Social share image cleared.'
                      );
                    }}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer",
                      isDark
                        ? "border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <RotateCcw size={11} />
                    {t('settings.seo_social_image_clear')}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.useCloudinary && seo.cloudinarySocialImageUrl ? seo.cloudinarySocialImageUrl : (seo.socialImageUrl || seo.cloudinarySocialImageUrl || '')}
                  onChange={(e) => updateSEO({ socialImageUrl: e.target.value, cloudinarySocialImageUrl: e.target.value })}
                  placeholder="https://example.com/banner-1200x630.jpg"
                  className={cn(
                    "flex-1 px-3.5 py-2.5 text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                  )}
                />
                {formData.useCloudinary && (
                  <label className={cn(
                    "cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 border",
                    uploadingField === 'socialImageUrl'
                      ? "opacity-50 cursor-wait bg-gray-200 text-gray-500"
                      : isDark
                        ? "bg-amber-900/30 border-amber-800 text-amber-300 hover:bg-amber-900/50"
                        : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                  )}>
                    <Cloud size={14} className={uploadingField === 'socialImageUrl' ? 'animate-pulse' : 'text-amber-600'} />
                    <span>{uploadingField === 'socialImageUrl' ? (language === 'pt' ? 'A enviar...' : 'Uploading...') : (language === 'pt' ? 'Enviar' : 'Upload')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'socialImageUrl')}
                      disabled={uploadingField === 'socialImageUrl'}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('settings.seo_social_image_desc')}
              </p>
            </div>

            {/* Image Preview & Aspect Ratio Indicator */}
            {effectiveSocialImage ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {t('settings.seo_social_image_active')}
                  </span>
                  <span className="font-mono text-[10px]">1200 × 630 (1.91:1)</span>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 aspect-[1.91/1] max-h-48 bg-gray-100 dark:bg-gray-800 shadow-xs">
                  <img
                    src={effectiveSocialImage}
                    alt="Social share preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono backdrop-blur-xs">
                    1200 × 630 px
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 p-5 rounded-xl border border-dashed text-center border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 space-y-1">
                <ImageIcon className="mx-auto text-gray-400 dark:text-gray-500" size={22} />
                <p className="text-xs text-white font-medium">
                  {t('settings.seo_social_no_image')}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {language === 'pt' 
                    ? 'Insira um URL acima ou envie uma imagem (1200×630px).' 
                    : 'Enter an image URL above or upload an image (1200×630px).'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CARD 4: Live SERP & Social Previews */}
        <div className={cn(
          "p-5 rounded-2xl border space-y-5 transition-colors duration-200",
          isDark ? "bg-gray-800/40 border-gray-800" : "bg-gray-50/70 border-gray-200/70"
        )}>
          <div className="flex items-center justify-between border-b pb-3 border-gray-200/80 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Monitor size={18} className="text-amber-600 dark:text-amber-400" />
              <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
                {t('settings.seo_preview_title')}
              </h3>
            </div>

            {/* Google vs Social Preview View Toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setGooglePreviewMode('desktop')}
                className={cn(
                  "p-1.5 rounded-md text-xs font-semibold transition-all",
                  googlePreviewMode === 'desktop'
                    ? "bg-amber-600 text-white"
                    : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                )}
                title="Desktop Google Preview"
              >
                <Monitor size={14} />
              </button>
              <button
                type="button"
                onClick={() => setGooglePreviewMode('mobile')}
                className={cn(
                  "p-1.5 rounded-md text-xs font-semibold transition-all",
                  googlePreviewMode === 'mobile'
                    ? "bg-amber-600 text-white"
                    : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                )}
                title="Mobile Google Preview"
              >
                <Smartphone size={14} />
              </button>
            </div>
          </div>

          {/* 1. Google SERP Simulator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                {t('settings.seo_google_preview')} ({googlePreviewMode === 'desktop' ? 'Desktop' : 'Mobile'})
              </span>
              <div className="flex items-center gap-2">
                {isCustomFavicon && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        faviconUrl: '',
                        cloudinaryFaviconUrl: ''
                      }));
                      toast.success(
                        language === 'pt'
                          ? 'Favicon reposto para o padrão.'
                          : 'Favicon reset to default.'
                      );
                    }}
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer",
                      isDark
                        ? "border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white bg-gray-800/80"
                        : "border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900 bg-white"
                    )}
                    title={language === 'pt' ? 'Repor para o padrão' : 'Reset to default'}
                  >
                    <RotateCcw size={10} className="text-amber-600 dark:text-amber-400" />
                    <span>{language === 'pt' ? 'Padrão' : 'Default'}</span>
                  </button>
                )}
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  isCustomFavicon
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                )}>
                  {isCustomFavicon ? t('settings.favicon_custom') : t('settings.favicon_default')}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">google.com</span>
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-xl border transition-all font-sans shadow-sm",
              googlePreviewMode === 'mobile' ? "max-w-sm mx-auto" : "w-full",
              isDark ? "bg-[#202124] border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-800"
            )}>
              {/* Site URL & Breadcrumb */}
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 shadow-2xs">
                  <img
                    src={effectiveFavicon}
                    alt={formData.name ? `${formData.name} Favicon` : 'Favicon'}
                    className="w-full h-full object-contain p-0.5 bg-white"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (!img.src.endsWith('/favicon.svg')) {
                        img.src = '/favicon.svg';
                      }
                    }}
                  />
                </div>
                <div className="leading-tight overflow-hidden text-ellipsis">
                  <div className="text-[12px] font-medium text-gray-900 dark:text-gray-200 truncate">
                    {effectiveSiteName}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {effectiveCanonicalUrl} › book
                  </div>
                </div>
              </div>

              {/* Title Link */}
              <h4 className="text-[16px] leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer line-clamp-2">
                {effectiveTitle}
              </h4>

              {/* Meta Description Snippet */}
              <p className="text-[13px] leading-relaxed text-[#4d5156] dark:text-[#bdc1c6] mt-1 line-clamp-2">
                {effectiveDesc}
              </p>

              {/* Rich snippet badges */}
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ★ 4.9 (150+)
                </span>
                <span>•</span>
                <span>{seo.cuisineType || 'Restaurant'}</span>
                <span>•</span>
                <span>{seo.priceRange || '€€'}</span>
                {seo.city && (
                  <>
                    <span>•</span>
                    <span>{seo.city}</span>
                  </>
                )}
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">Reservations available</span>
              </div>
            </div>
          </div>

          {/* 2. Social Share Card Simulator (Facebook/WhatsApp) */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                {t('settings.seo_social_preview')} (WhatsApp / Social Card)
              </span>
              <span className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                effectiveSocialImage 
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              )}>
                {effectiveSocialImage ? t('settings.seo_social_image_active') : t('settings.seo_social_image_none')}
              </span>
            </div>

            {/* Customizer: Preview Card Box Background Color */}
            <div className={cn(
              "p-3.5 rounded-xl border transition-all space-y-2.5",
              isDark ? "bg-gray-900/40 border-gray-700/80" : "bg-white border-gray-200"
            )}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Palette size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className={cn("text-xs font-bold", isDark ? "text-gray-200" : "text-gray-800")}>
                      {t('settings.seo_social_box_bg_color')}
                    </span>
                    <span className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                      isCustomSocialBoxBg
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                    )}>
                      {isCustomSocialBoxBg ? t('settings.seo_social_box_bg_custom') : t('settings.seo_social_box_bg_default')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {t('settings.seo_social_box_bg_color_desc')}
                  </p>
                </div>

                {/* Color Input Square and Hex Code */}
                <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customSocialBoxBg.startsWith('#') ? customSocialBoxBg : (isDark ? '#18191a' : '#ffffff')}
                      onChange={(e) => updateSEO({ socialPreviewCardBg: e.target.value })}
                      className={cn(
                        "h-9 w-9 p-0.5 border rounded-lg cursor-pointer transition-colors shadow-2xs",
                        isDark ? "bg-gray-800 border-gray-700 hover:border-gray-600" : "bg-white border-gray-300 hover:border-gray-400"
                      )}
                      title={t('settings.seo_social_box_bg_color')}
                    />
                    <span className={cn(
                      "text-xs font-mono select-all px-2 py-1 rounded-md border",
                      isDark ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-700"
                    )}>
                      {customSocialBoxBg || (isDark ? '#18191a' : '#ffffff')}
                    </span>
                  </div>

                  {isCustomSocialBoxBg && (
                    <button
                      type="button"
                      onClick={() => updateSEO({ socialPreviewCardBg: '' })}
                      className={cn(
                        "p-1.5 rounded-lg border text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors",
                        isDark ? "border-gray-700 hover:bg-gray-800" : "border-gray-200 hover:bg-gray-100"
                      )}
                      title={t('settings.seo_social_box_bg_reset')}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Informational Disclaimer Banner */}
              <div className={cn(
                "flex items-start gap-2 text-[11px] leading-relaxed p-2.5 rounded-lg border transition-colors",
                isDark
                  ? "bg-gray-800/80 text-gray-300 border-gray-700/80"
                  : "bg-gray-100 text-gray-600 border-gray-200"
              )}>
                <Info size={14} className={cn("shrink-0 mt-0.5", isDark ? "text-gray-400" : "text-gray-500")} />
                <span>
                  {t('settings.seo_social_box_bg_disclaimer')}
                </span>
              </div>
            </div>

            {/* Social Share Card Preview */}
            <div className={cn(
              "rounded-xl border overflow-hidden shadow-sm transition-all",
              isDark ? "bg-[#242526] border-gray-700" : "bg-[#f0f2f5] border-gray-200"
            )}>
              {effectiveSocialImage ? (
                <div className="aspect-[1.91/1] w-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                  <img
                    src={effectiveSocialImage}
                    alt="Social card banner"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}
              <div
                className={cn(
                  "p-3.5 space-y-1.5 transition-colors duration-200",
                  !isCustomSocialBoxBg && (isDark ? "bg-[#18191a]" : "bg-white")
                )}
                style={isCustomSocialBoxBg ? { backgroundColor: customSocialBoxBg } : undefined}
              >
                <div
                  className={cn(
                    "text-[10px] uppercase font-bold tracking-wider truncate",
                    isCustomSocialBoxBg
                      ? (isColorBright(customSocialBoxBg) ? "text-gray-500" : "text-gray-400")
                      : "text-gray-400"
                  )}
                >
                  {typeof window !== 'undefined' ? window.location.hostname : 'restaurant.com'}
                </div>
                <div
                  className={cn(
                    "text-xs font-bold line-clamp-1",
                    isCustomSocialBoxBg
                      ? (isColorBright(customSocialBoxBg) ? "text-gray-900" : "text-gray-100")
                      : "text-gray-900 dark:text-gray-100"
                  )}
                >
                  {effectiveSocialTitle}
                </div>
                <div
                  className={cn(
                    "text-[11px] line-clamp-2 leading-relaxed",
                    isCustomSocialBoxBg
                      ? (isColorBright(customSocialBoxBg) ? "text-gray-600" : "text-gray-300")
                      : "text-gray-500 dark:text-gray-400"
                  )}
                >
                  {effectiveSocialDesc}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* CARD 5: SEO Health Checklist & Recommendations */}
      <div className={cn(
        "p-5 rounded-2xl border space-y-4 transition-colors duration-200",
        isDark ? "bg-gray-800/40 border-gray-800" : "bg-gray-50/70 border-gray-200/70"
      )}>
        <div className="flex items-center justify-between border-b pb-3 border-gray-200/80 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-amber-600 dark:text-amber-400" />
            <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
              {t('settings.seo_recommendations')}
            </h3>
          </div>
          <span className="text-xs font-bold">
            {healthChecklist.items.filter(i => i.passed).length} of {healthChecklist.items.length} completed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {healthChecklist.items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-3 rounded-xl border flex items-start gap-3 transition-all",
                item.passed
                  ? (isDark ? "bg-emerald-950/20 border-emerald-900/40" : "bg-emerald-50/40 border-emerald-100")
                  : item.warning
                    ? (isDark ? "bg-amber-950/20 border-amber-900/40" : "bg-amber-50/40 border-amber-100")
                    : (isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")
              )}
            >
              <div className="mt-0.5 shrink-0">
                {item.passed ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : item.warning ? (
                  <AlertTriangle size={16} className="text-amber-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
              </div>
              <div className="space-y-0.5 flex-1">
                <div className={cn(
                  "text-xs font-semibold",
                  item.passed 
                    ? (isDark ? "text-emerald-300" : "text-emerald-900")
                    : item.warning
                      ? (isDark ? "text-amber-300" : "text-amber-900")
                      : (isDark ? "text-gray-300" : "text-gray-700")
                )}>
                  {item.label}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {item.tip}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CARD 6: Advanced Settings & Structured Data (JSON-LD) */}
      <div className={cn(
        "p-5 rounded-2xl border space-y-5 transition-colors duration-200",
        isDark ? "bg-gray-800/40 border-gray-800" : "bg-gray-50/70 border-gray-200/70"
      )}>
        <div className="flex items-center justify-between border-b pb-3 border-gray-200/80 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-amber-600 dark:text-amber-400" />
            <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
              {t('settings.seo_advanced_title')}
            </h3>
          </div>
          <span className="text-[10px] text-gray-400">Robots & Canonical</span>
        </div>

        {/* Indexing Switch */}
        <div className={cn(
          "p-4 rounded-xl border flex items-center justify-between gap-4 transition-all",
          seo.allowIndexing !== false
            ? (isDark ? "bg-gray-800/60 border-gray-700" : "bg-white border-gray-200")
            : (isDark ? "bg-rose-950/20 border-rose-900/50" : "bg-rose-50 border-rose-200")
        )}>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-bold",
                seo.allowIndexing !== false ? (isDark ? "text-white" : "text-gray-900") : "text-rose-600 font-bold"
              )}>
                {t('settings.seo_indexing_toggle')}
              </span>
              <span className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase",
                seo.allowIndexing !== false
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              )}>
                {seo.allowIndexing !== false ? 'index, follow' : 'noindex, nofollow'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {seo.allowIndexing !== false ? t('settings.seo_indexing_on_desc') : t('settings.seo_indexing_off_desc')}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={seo.allowIndexing !== false}
              onChange={(e) => updateSEO({ allowIndexing: e.target.checked })}
              className="sr-only peer"
            />
            <div className={cn(
              "w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
              isDark ? "bg-gray-800" : "bg-gray-200"
            )}></div>
          </label>
        </div>

        {/* Custom Canonical URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {t('settings.seo_canonical_url')}
          </label>
          <input
            type="url"
            value={seo.canonicalUrl ?? seo.ogUrl ?? ''}
            onChange={(e) => updateSEO({ canonicalUrl: e.target.value, ogUrl: e.target.value })}
            placeholder={effectiveCanonicalUrl}
            className={cn(
              "w-full px-3.5 py-2.5 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
              isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
            )}
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('settings.seo_canonical_desc')}
          </p>
        </div>

        {/* Structured Data (Schema.org JSON-LD) Code Viewer */}
        <div className="space-y-2 pt-2 border-t border-gray-200/80 dark:border-gray-800">
          <div 
            onClick={() => setShowJsonLd(prev => !prev)}
            className="flex justify-between items-center cursor-pointer select-none group py-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {t('settings.seo_jsonld_title')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyJsonLd}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all",
                  hasCopiedJsonLd
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : isDark 
                      ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700" 
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                {hasCopiedJsonLd ? <Check size={13} /> : <Copy size={13} />}
                <span>{hasCopiedJsonLd ? 'Copied!' : t('settings.seo_copy_jsonld')}</span>
              </button>

              <div
                className="p-1.5 text-gray-400 group-hover:text-amber-600 rounded-lg transition-colors"
                title={showJsonLd ? "Collapse" : "Expand"}
              >
                <motion.div
                  animate={{ rotate: showJsonLd ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('settings.seo_jsonld_desc')}
          </p>

          <AnimatePresence initial={false}>
            {showJsonLd && (
              <motion.div
                key="jsonld-accordion-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                className="overflow-hidden"
              >
                <div className="relative mt-2 pt-1 pb-0.5">
                  <pre className={cn(
                    "p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-72 border leading-relaxed",
                    isDark ? "bg-[#1e1e1e] border-gray-800 text-emerald-400" : "bg-gray-900 border-gray-800 text-emerald-400"
                  )}>
                    {jsonLdString}
                  </pre>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                    <span>Google schema standard validator:</span>
                    <a
                      href="https://search.google.com/test/rich-results"
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                    >
                      <span>{t('settings.seo_test_rich_results')}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
export default RestaurantSEOSettings;
