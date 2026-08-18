import React, { useEffect } from 'react';
import { RestaurantSettings } from '../types';
import { updateFavicon, getOptimizedUrl } from '../lib/utils';

interface SEOHeadProps {
  settings?: RestaurantSettings | null;
  language?: 'en' | 'pt';
}

export const SEOHead: React.FC<SEOHeadProps> = ({ settings, language = 'en' }) => {
  useEffect(() => {
    if (!settings) return;

    // Update Favicon (custom or fallback to default)
    updateFavicon(settings.faviconUrl, settings);

    const isPt = language === 'pt';
    const seo = settings.seo;

    // 1. Title
    const title = (isPt ? seo?.seoTitlePt : seo?.seoTitleEn) ||
      seo?.seoTitle ||
      (isPt 
        ? `${settings.name || 'Restaurante'} | Reserva de Mesa Online` 
        : `${settings.name || 'Restaurant'} | Online Table Reservations`);

    document.title = title;

    // Helper to set or create meta tag
    const setMetaTag = (nameAttr: 'name' | 'property', attrValue: string, content: string) => {
      if (!content) return;
      let element = document.querySelector(`meta[${nameAttr}="${attrValue}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(nameAttr, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Meta Description
    const description = (isPt ? seo?.metaDescriptionPt : seo?.metaDescriptionEn) ||
      seo?.metaDescription ||
      (isPt ? settings.description : settings.descriptionEn) ||
      settings.description ||
      'Book your table online directly with instant confirmation.';

    setMetaTag('name', 'description', description);

    // 3. Keywords
    const keywords = (isPt ? seo?.keywordsPt : seo?.keywords) ||
      seo?.keywords ||
      `${settings.name}, restaurant, reservations, table booking, fine dining, ${seo?.city || ''}, ${seo?.cuisineType || ''}`;

    setMetaTag('name', 'keywords', keywords);

    // 4. Robots / Indexing
    const robotsContent = seo?.allowIndexing === false ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
    setMetaTag('name', 'robots', robotsContent);

    // 5. Canonical URL
    const canonicalHref = seo?.canonicalUrl || seo?.ogUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
    if (canonicalHref) {
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', canonicalHref);
    }

    // 6. Social Sharing (Open Graph)
    const socialTitle = (isPt ? seo?.socialTitlePt : seo?.socialTitle) || seo?.socialTitle || title;
    const socialDescription = (isPt ? seo?.socialDescriptionPt : seo?.socialDescription) || seo?.socialDescription || description;
    const siteName = seo?.siteName || settings.name || 'Restaurant';
    const ogUrl = seo?.ogUrl || canonicalHref;
    
    // Dedicated social share image (no fallback to hero/logo if empty)
    const rawSocialImage = (settings.useCloudinary && seo?.cloudinarySocialImageUrl)
      ? seo.cloudinarySocialImageUrl
      : (seo?.socialImageUrl || seo?.cloudinarySocialImageUrl || '');
    const socialImage = rawSocialImage ? getOptimizedUrl(rawSocialImage, settings, 'social') : '';

    setMetaTag('property', 'og:title', socialTitle);
    setMetaTag('property', 'og:description', socialDescription);
    setMetaTag('property', 'og:type', 'restaurant.restaurant');
    setMetaTag('property', 'og:site_name', siteName);
    setMetaTag('property', 'og:url', ogUrl);
    setMetaTag('property', 'og:locale', isPt ? 'pt_PT' : 'en_US');
    if (socialImage && socialImage.trim() !== '') {
      setMetaTag('property', 'og:image', socialImage.trim());
      setMetaTag('property', 'og:image:alt', settings.name || 'Restaurant');
    } else {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) ogImg.remove();
      const ogImgAlt = document.querySelector('meta[property="og:image:alt"]');
      if (ogImgAlt) ogImgAlt.remove();
    }

    // 7. Twitter Cards
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', socialTitle);
    setMetaTag('name', 'twitter:description', socialDescription);
    if (socialImage && socialImage.trim() !== '') {
      setMetaTag('name', 'twitter:image', socialImage.trim());
    } else {
      const twImg = document.querySelector('meta[name="twitter:image"]');
      if (twImg) twImg.remove();
    }

    // 8. Schema.org JSON-LD Structured Data
    const sameAsLinks: string[] = [];
    if (seo?.googleBusinessUrl) sameAsLinks.push(seo.googleBusinessUrl);
    if (seo?.googleMapsUrl) sameAsLinks.push(seo.googleMapsUrl);
    if (settings.socialLinks) {
      settings.socialLinks.forEach(link => {
        if (link.url) sameAsLinks.push(link.url);
      });
    }

    // Build OpeningHoursSpecification array
    const openingHoursSpec: any[] = [];
    if (settings.openingHours) {
      Object.entries(settings.openingHours).forEach(([day, hours]) => {
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

        // If lunch is active
        if (hours.lunch?.active) {
          openingHoursSpec.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek,
            opens: hours.lunch.open || '12:00',
            closes: hours.lunch.close || '15:00'
          });
        }
        // If dinner is active
        if (hours.dinner?.active) {
          openingHoursSpec.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek,
            opens: hours.dinner.open || '19:00',
            closes: hours.dinner.close || '23:00'
          });
        }
        // If neither session specified, use general open/close
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

    const jsonLdData: any = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: settings.name || 'Restaurant',
      image: socialImage || undefined,
      description: description,
      telephone: settings.phone || settings.secondaryPhone || undefined,
      email: settings.email || undefined,
      url: canonicalHref,
      priceRange: seo?.priceRange || '€€',
      servesCuisine: seo?.cuisineType || 'Contemporary',
      acceptsReservations: 'True',
      address: {
        '@type': 'PostalAddress',
        streetAddress: seo?.streetAddress || settings.address || '',
        addressLocality: seo?.city || '',
        addressRegion: seo?.stateCounty || '',
        postalCode: seo?.postalCode || '',
        addressCountry: seo?.country || (settings.region === 'ireland' ? 'IE' : 'PT')
      },
      openingHoursSpecification: openingHoursSpec.length > 0 ? openingHoursSpec : undefined,
      sameAs: sameAsLinks.length > 0 ? sameAsLinks : undefined
    };

    if (seo?.latitude && seo?.longitude) {
      jsonLdData.geo = {
        '@type': 'GeoCoordinates',
        latitude: parseFloat(String(seo.latitude)),
        longitude: parseFloat(String(seo.longitude))
      };
    }

    let scriptTag = document.getElementById('schema-restaurant-jsonld') as HTMLScriptElement;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'schema-restaurant-jsonld';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(jsonLdData, null, 2);

    return () => {
      // Optional cleanup on unmount if needed
    };
  }, [settings, language]);

  return null;
};
