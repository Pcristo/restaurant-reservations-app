import React from 'react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { Cookie, Shield, Eye, Settings, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { APP_CONFIG } from '../data/appConfig';

export default function CookiePolicy() {
  const { settings } = useSettings();
  const { language, t } = useLanguage();

  const isDark = settings?.theme === 'dark';
  const restaurantName = settings?.name || APP_CONFIG.appName;

  return (
    <div className={cn(
      "min-h-screen py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 text-[0.79em]",
      isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            to="/" 
            className={cn(
              "inline-flex items-center gap-2 text-[12.5px] font-semibold transition-colors",
              isDark ? "text-amber-400 hover:text-amber-300" : "text-amber-600 hover:text-amber-700"
            )}
          >
            <ArrowLeft size={16} />
            {language === 'pt' ? 'Voltar ao Início' : 'Back to Home'}
          </Link>
        </div>

        {/* Header */}
        <div className={cn(
          "rounded-3xl p-8 md:p-12 mb-8 shadow-xl relative overflow-hidden",
          isDark ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-100"
        )}>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Cookie size={120} className="text-amber-500" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
              <Cookie size={32} />
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-sm font-bold transition-colors leading-tight",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {restaurantName}
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-widest text-amber-500">
                {settings?.region === 'ireland' ? 'Cookie Management (Ireland)' : 'Cookie Management (Portugal)'}
              </span>
            </div>
          </div>
          <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight mb-4">
            {t('common.cookie_policy')}
          </h1>
          <p className={cn(
            "text-[12.5px]",
            isDark ? "text-gray-400" : "text-gray-500"
          )}>
            {language === 'pt' 
              ? 'Última atualização: 13 de Julho de 2026' 
              : 'Last updated: July 13, 2026'}
          </p>
        </div>

        {/* Content */}
        <div className={cn(
          "rounded-3xl p-8 md:p-12 shadow-xl space-y-8 leading-relaxed",
          isDark ? "bg-gray-900 border border-gray-800 text-gray-300" : "bg-white border border-gray-100 text-gray-700"
        )}>
          {/* Interactive Consent Trigger */}
          <div className={cn(
            "flex flex-col sm:flex-row items-center justify-between p-6 rounded-2xl border gap-4 transition-colors mb-6",
            isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50/50 border-amber-100"
          )}>
            <div className="text-center sm:text-left">
              <h3 className={cn("font-bold text-[12.5px]", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Gerir Consentimento de Cookies' : 'Manage Cookie Consent'}
              </h3>
              <p className={cn("text-[10.5px] mt-1", isDark ? "text-gray-400" : "text-gray-500")}>
                {language === 'pt' 
                  ? 'Personalize ou altere as suas preferências de cookies a qualquer momento.' 
                  : 'Customize or change your cookie choices and preferences at any time.'}
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('cookie-consent');
                window.dispatchEvent(new Event('open-cookie-settings'));
              }}
              className="px-5 py-2.5 bg-amber-500 text-white text-[10.5px] font-bold rounded-xl hover:bg-amber-600 transition-all uppercase tracking-wider shadow-md shadow-amber-500/10 cursor-pointer"
            >
              {language === 'pt' ? 'Definições de Cookies' : 'Cookie Settings'}
            </button>
          </div>

          {language === 'pt' ? (
            <>
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Cookie size={18} /> 1. O que são Cookies?
                </h2>
                <p>
                  Cookies são pequenos ficheiros de texto guardados no seu computador ou dispositivo móvel através do seu navegador de internet (browser) quando visita um website. Estes ficheiros ajudam o website a reconhecer o seu dispositivo nas visitas seguintes, melhorando a velocidade e eficiência de navegação.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Settings size={18} /> 2. Que tipos de Cookies utilizamos?
                </h2>
                <p>
                  No website do <strong>{restaurantName}</strong>, utilizamos apenas cookies estritamente necessários para o funcionamento básico e segurança da plataforma de reservas online:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 space-y-2">
                    <h3 className="font-bold text-amber-500 text-[12.5px]">Cookies Técnicos e de Sessão (Essenciais)</h3>
                    <p className="text-[10.5px]">
                      Permitem-nos autenticar as suas credenciais de conta de forma segura (através de Firebase Auth), lembrar o estado da sua marcação provisória de mesa e armazenar a sua escolha de idioma (EN/PT) para que não tenha de selecionar novamente a cada clique.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 space-y-2">
                    <h3 className="font-bold text-amber-500 text-[12.5px]">Cookies de Preferência</h3>
                    <p className="text-[10.5px]">
                      Utilizados para guardar a informação sobre se já aceitou ou recusou a nossa barra flutuante de cookies (através de localStorage), evitando mostrar a mensagem de consentimento repetidamente.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Eye size={18} /> 3. Cookies de Terceiros
                </h2>
                <p>
                  Para disponibilizar o mapa de localização interativo integrado no nosso rodapé, podemos utilizar widgets de terceiros (como o Google Maps). Estes serviços externos podem descarregar cookies próprios para o seu navegador de forma a autenticar e melhorar as funções de geolocalização e mapas interativos.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Shield size={18} /> 4. Como pode controlar os Cookies?
                </h2>
                <p>
                  Pode a qualquer momento configurar o seu browser para aceitar, recusar ou apagar cookies armazenados. Tenha em consideração que ao desativar cookies essenciais e de sessão, partes significativas da nossa plataforma de reservas online (como o login ou a persistência das informações da sua mesa) podem deixar de funcionar corretamente.
                </p>
                <p>
                  {settings?.region === 'ireland' ? (
                    <>Esta política está em total conformidade com a regulamentação irlandesa de comunicações eletrónicas e cookies (S.I. No. 336/2011 - ePrivacy Regulations) e as diretrizes da <strong>Data Protection Commission (DPC)</strong> da Irlanda.</>
                  ) : (
                    <>Esta política está em total conformidade com a <strong>Lei n.º 46/2012</strong> de Portugal (Lei da Privacidade Eletrónica) que regula a utilização de cookies em redes públicas de comunicações.</>
                  )}
                </p>
                <p className="text-[12.5px]">
                  Para saber como gerir cookies no seu browser específico, consulte as secções de Ajuda ou Definições de Privacidade do Chrome, Safari, Firefox, Edge ou Opera.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Cookie size={18} /> 1. What are Cookies?
                </h2>
                <p>
                  Cookies are small text files saved on your computer or mobile device through your web browser when you visit a website. These files help the website recognize your device in future visits, improving navigation speed and efficiency.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Settings size={18} /> 2. What types of Cookies do we use?
                </h2>
                <p>
                  On the <strong>{restaurantName}</strong> website, we only use cookies strictly necessary for the basic functioning and security of the online booking platform:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 space-y-2">
                    <h3 className="font-bold text-amber-500 text-[12.5px]">Technical & Session Cookies (Essential)</h3>
                    <p className="text-[10.5px]">
                      They allow us to securely authenticate your account credentials (via Firebase Auth), remember the state of your temporary table booking, and store your language preference (EN/PT) so you don't have to select it again with every click.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 space-y-2">
                    <h3 className="font-bold text-amber-500 text-[12.5px]">Preference Cookies</h3>
                    <p className="text-[10.5px]">
                      Used to store information on whether you have accepted or declined our cookie consent banner (via localStorage), preventing us from showing you the consent bar repeatedly.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Eye size={18} /> 3. Third-Party Cookies
                </h2>
                <p>
                  To display the interactive location map integrated into our footer, we may use third-party widgets (like Google Maps). These external services may download their own cookies to your browser to authenticate and improve geolocalization features.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Shield size={18} /> 4. How can you control Cookies?
                </h2>
                <p>
                  You can configure your browser at any time to accept, decline, or delete stored cookies. Please note that by disabling essential and session cookies, significant parts of our online booking platform (like login or table selection state) may not function properly.
                </p>
                <p>
                  {settings?.region === 'ireland' ? (
                    <>This cookie usage is fully compliant with the Irish ePrivacy Regulations (<strong>S.I. No. 336/2011</strong>) and guidelines issued by the Irish <strong>Data Protection Commission (DPC)</strong>.</>
                  ) : (
                    <>This cookie usage is in compliance with <strong>Law n.º 46/2012</strong> (ePrivacy Law) regulating cookie usage on public communication networks in Portugal.</>
                  )}
                </p>
                <p className="text-[12.5px]">
                  To learn how to manage cookies in your specific browser, please refer to the Help or Privacy Settings sections of Google Chrome, Apple Safari, Mozilla Firefox, Microsoft Edge, or Opera.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
