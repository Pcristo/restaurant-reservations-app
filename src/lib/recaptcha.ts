let isLoaded = false;

export const loadReCaptcha = (siteKey: string) => {
  if (isLoaded || !siteKey || typeof window === 'undefined') return;
  
  if (document.getElementById('recaptcha-v3-script')) {
    isLoaded = true;
    return;
  }

  const script = document.createElement('script');
  script.id = 'recaptcha-v3-script';
  script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    isLoaded = true;
  };
  document.body.appendChild(script);
};

export const executeReCaptcha = async (action: string): Promise<string | null> => {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    console.warn('reCAPTCHA site key is not configured. Using mock verification.');
    return 'mock-token';
  }

  if (typeof window === 'undefined') {
    return null;
  }

  loadReCaptcha(siteKey);

  return new Promise((resolve) => {
    const checkAndExecute = () => {
      const grecaptcha = (window as any).grecaptcha;
      if (grecaptcha && grecaptcha.ready) {
        grecaptcha.ready(() => {
          grecaptcha
            .execute(siteKey, { action })
            .then((token: string) => {
              resolve(token);
            })
            .catch((err: any) => {
              console.error('reCAPTCHA execution error:', err);
              resolve('error-token');
            });
        });
      } else {
        setTimeout(checkAndExecute, 100);
      }
    };
    checkAndExecute();
  });
};
