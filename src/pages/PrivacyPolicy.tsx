import React from 'react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { Shield, Eye, Lock, FileText, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { APP_CONFIG } from '../data/appConfig';

export default function PrivacyPolicy() {
  const { settings } = useSettings();
  const { language, t } = useLanguage();

  const isDark = settings?.theme === 'dark';
  const restaurantName = settings?.name || APP_CONFIG.appName;
  const email = settings?.email || APP_CONFIG.email;
  const address = settings?.address || APP_CONFIG.address;

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
            <Shield size={120} className="text-amber-500" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
              <Shield size={32} />
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-sm font-bold transition-colors leading-tight",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {restaurantName}
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-widest text-amber-500">
                {settings?.region === 'ireland' ? 'GDPR / Irish Data Protection Act Compliant' : 'RGPD / GDPR Compliant'}
              </span>
            </div>
          </div>
          <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight mb-4">
            {t('common.privacy_policy')}
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
          {language === 'pt' ? (
            <>
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <FileText size={18} /> 1. Introdução e Enquadramento Legal
                </h2>
                <p>
                  A privacidade e segurança dos seus dados pessoais são fundamentais para o <strong>{restaurantName}</strong>. Esta Política de Privacidade explica detalhadamente como recolhemos, utilizamos, processamos e protegemos os seus dados quando utiliza a nossa plataforma de reservas online, em total conformidade com o <strong>Regulamento Geral sobre a Proteção de Dados (RGPD) - Regulamento (UE) 2016/679</strong> do Parlamento Europeu e do Conselho, bem como com {settings?.region === 'ireland' ? 'a lei de proteção de dados aplicável na Irlanda (Data Protection Act 2018)' : 'a legislação nacional aplicável em Portugal (Lei n.º 58/2019)'}.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Eye size={18} /> 2. Dados que Recolhemos e Finalidade
                </h2>
                <p>
                  Ao realizar uma reserva de mesa ou registar-se na nossa plataforma, recolhemos os seguintes dados estritamente necessários para a execução do serviço:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Nome Completo:</strong> Para identificação e personalização da reserva.</li>
                  <li><strong>Contacto Telefónico:</strong> Essencial para verificação da reserva através de códigos e comunicação rápida em caso de imprevistos ou alterações de turnos.</li>
                  <li><strong>Endereço de E-mail:</strong> Para envio de confirmações de reserva automáticas, recibos e notificações relativas à sua conta.</li>
                  <li><strong>Observações / Preferências Alimentares (Opcional):</strong> Informações facultadas voluntariamente relativas a alergias alimentares ou pedidos de mesa para garantir o seu conforto e segurança.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Lock size={18} /> 3. Fundamento Jurídico e Período de Retenção
                </h2>
                <p>
                  O processamento dos seus dados pessoais baseia-se na <strong>execução de um contrato</strong> (gestão da reserva da mesa) e no <strong>consentimento explícito</strong> do utilizador (quando aplicável, como para envio de comunicações de marketing).
                </p>
                <p>
                  Conservamos os seus dados apenas durante o período necessário para as finalidades descritas nesta política ou para cumprir obrigações fiscais e legais vigentes em {settings?.region === 'ireland' ? 'Irlanda' : 'Portugal'}. Os dados de reserva inativa são arquivados ou eliminados de forma segura após o decurso do prazo estipulado por lei.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Shield size={18} /> 4. Partilha e Segurança dos Dados
                </h2>
                <p>
                  O <strong>{restaurantName}</strong> garante que não comercializa nem partilha os seus dados pessoais com terceiros para fins publicitários. Os dados são acedidos apenas pela equipa interna do restaurante para gestão das reservas e por subcontratantes tecnológicos autorizados (como serviços seguros de alojamento em cloud e SMS gateways), sob estritos acordos de confidencialidade.
                </p>
                <p>
                  Implementamos medidas de segurança físicas, técnicas e organizativas robustas (incluindo encriptação SSL/TLS e firewalls) para proteger os seus dados contra perda, acesso indevido ou destruição acidental.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <RefreshCw size={18} /> 5. Os Seus Direitos
                </h2>
                <p>
                  Nos termos do RGPD, assistem-lhe os seguintes direitos relativos aos seus dados pessoais:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Direito de Acesso:</strong> Obter confirmação sobre se os seus dados estão a ser processados e aceder a uma cópia dos mesmos.</li>
                  <li><strong>Direito de Retificação:</strong> Corrigir dados inexatos ou incompletos na sua conta de cliente.</li>
                  <li><strong>Direito de Apagamento ("Esquecimento"):</strong> Solicitar a eliminação permanente dos seus dados pessoais.</li>
                  <li><strong>Direito de Portabilidade:</strong> Receber os seus dados num formato estruturado e de leitura automática.</li>
                  <li><strong>Direito de Oposição:</strong> Opor-se a qualquer momento ao processamento dos dados para marketing direto.</li>
                </ul>
                <p className="mt-2">
                  Para exercer qualquer um destes direitos, poderá contactar-nos diretamente através do e-mail: <a href={`mailto:${email}`} className="text-amber-500 hover:underline">{email}</a> ou por escrito para a nossa morada oficial: <strong>{address}</strong>.
                </p>
              </section>

              <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-base font-bold text-amber-500">{settings?.region === 'ireland' ? 'Autoridade de Controlo (Irlanda)' : 'Autoridade de Controlo'}</h2>
                <p className="text-[12.5px]">
                  {settings?.region === 'ireland' ? (
                    <>Caso considere que os seus direitos não foram respeitados, tem o direito de apresentar uma reclamação à autoridade nacional de controlo na Irlanda: a <strong>Data Protection Commission (DPC)</strong> (www.dataprotection.ie).</>
                  ) : (
                    <>Caso considere que os seus direitos não foram respeitados, tem o direito de apresentar uma reclamação à autoridade nacional de controlo em Portugal: a <strong>Comissão Nacional de Proteção de Dados (CNPD)</strong> (www.cnpd.pt).</>
                  )}
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <FileText size={18} /> 1. Introduction and Legal Framework
                </h2>
                <p>
                  The privacy and security of your personal data are fundamental to <strong>{restaurantName}</strong>. This Privacy Policy explains in detail how we collect, use, process, and protect your data when using our online booking platform, in full compliance with the <strong>General Data Protection Regulation (GDPR) - Regulation (EU) 2016/679</strong> of the European Parliament and of the Council, as well as {settings?.region === 'ireland' ? 'applicable national legislation in Ireland (Data Protection Act 2018)' : 'applicable national legislation in Portugal'}.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Eye size={18} /> 2. Data We Collect and Purpose
                </h2>
                <p>
                  When making a table reservation or registering on our platform, we collect the following data strictly necessary for the execution of the service:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Full Name:</strong> For identification and personalization of the booking.</li>
                  <li><strong>Phone Number:</strong> Essential for booking verification via code and fast communication in case of unforeseen circumstances or shift changes.</li>
                  <li><strong>Email Address:</strong> For sending automatic booking confirmations, receipts, and notifications related to your account.</li>
                  <li><strong>Special Requests / Dietary Preferences (Optional):</strong> Voluntarily provided information regarding allergies or seating requests to ensure your comfort and safety.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Lock size={18} /> 3. Legal Basis and Retention Period
                </h2>
                <p>
                  The processing of your personal data is based on the <strong>performance of a contract</strong> (table reservation management) and the <strong>explicit consent</strong> of the user (where applicable, such as for marketing communications).
                </p>
                <p>
                  We retain your data only for the period necessary for the purposes described in this policy or to comply with fiscal and legal obligations in force in {settings?.region === 'ireland' ? 'Ireland' : 'Portugal'}. Inactive booking data is securely archived or deleted after the expiration of the legally mandated period.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Shield size={18} /> 4. Data Sharing and Security
                </h2>
                <p>
                  <strong>{restaurantName}</strong> guarantees that we do not sell or share your personal data with third parties for marketing purposes. Data is accessed only by the restaurant's internal team for reservation management and by authorized technological subcontractors (such as secure cloud hosting and SMS gateway services), under strict confidentiality agreements.
                </p>
                <p>
                  We implement robust physical, technical, and organizational security measures (including SSL/TLS encryption and firewalls) to protect your data against loss, misuse, or accidental destruction.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <RefreshCw size={18} /> 5. Your Rights
                </h2>
                <p>
                  Under the GDPR, you have the following rights regarding your personal data:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Right of Access:</strong> To obtain confirmation on whether your data is being processed and access a copy of it.</li>
                  <li><strong>Right to Rectification:</strong> To correct inaccurate or incomplete details in your customer profile.</li>
                  <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> To request the permanent deletion of your personal data.</li>
                  <li><strong>Right to Portability:</strong> To receive your data in a structured, machine-readable format.</li>
                  <li><strong>Right to Object:</strong> To object at any time to data processing for direct marketing.</li>
                </ul>
                <p className="mt-2">
                  To exercise any of these rights, you can contact us directly via email at <a href={`mailto:${email}`} className="text-amber-500 hover:underline">{email}</a> or in writing to our official address: <strong>{address}</strong>.
                </p>
              </section>

              <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-base font-bold text-amber-500">Supervisory Authority</h2>
                <p className="text-[12.5px]">
                  {settings?.region === 'ireland' ? (
                    <>If you consider that your rights have not been respected, you have the right to lodge a complaint with the national supervisory authority in Ireland: <strong>Data Protection Commission (DPC)</strong> (www.dataprotection.ie).</>
                  ) : (
                    <>If you consider that your rights have not been respected, you have the right to lodge a complaint with the national supervisory authority in Portugal: <strong>Comissão Nacional de Proteção de Dados (CNPD)</strong> (www.cnpd.pt).</>
                  )}
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
