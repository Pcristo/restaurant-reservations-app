import React from 'react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { FileText, Calendar, Scale, ShieldAlert, ArrowLeft, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { APP_CONFIG } from '../data/appConfig';

export default function TermsAndConditions() {
  const { settings } = useSettings();
  const { language, t } = useLanguage();

  const isDark = settings?.theme === 'dark';
  const restaurantName = settings?.name || APP_CONFIG.appName;
  const phone = settings?.phone || APP_CONFIG.phone;
  const email = settings?.email || APP_CONFIG.email;
  const maxGuests = settings?.maxOnlineGuests || 10;
  const gracePeriod = settings?.gracePeriod || 15;

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
            <FileText size={120} className="text-amber-500" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
              <Scale size={32} />
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-sm font-bold transition-colors leading-tight",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {restaurantName}
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-widest text-amber-500">
                {settings?.region === 'ireland' ? 'Legal Compliance Ireland' : 'Legal Compliance Portugal'}
              </span>
            </div>
          </div>
          <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight mb-4">
            {t('common.terms_conditions')}
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
                  <FileText size={18} /> 1. Introdução e Objeto
                </h2>
                <p>
                  Estes Termos e Condições regem a utilização da plataforma de reservas online e do website do <strong>{restaurantName}</strong>. Ao utilizar e efetuar uma reserva através deste serviço, o utilizador concorda expressamente em ficar vinculado aos presentes termos. Caso discorde de qualquer cláusula, solicitamos que não utilize a nossa plataforma de reservas.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Calendar size={18} /> 2. Política de Reservas de Mesas
                </h2>
                <div className="space-y-2">
                  <p>
                    A reserva de mesas no <strong>{restaurantName}</strong> está sujeita às seguintes regras:
                  </p>
                  <ul className="list-disc pl-6 space-y-1.5">
                    <li><strong>Limite de Pessoas:</strong> Através do sistema de reservas online, o limite máximo permitido por mesa/grupo é de <strong>{maxGuests} pessoas</strong>. Para grupos de dimensão superior, por favor, entre em contacto direto através do telefone {phone} ou e-mail {email}.</li>
                    <li><strong>Tolerância de Atraso:</strong> É garantida uma tolerância de até <strong>{gracePeriod} minutos</strong> relativamente à hora agendada. Após esse período, a reserva expira automaticamente, e a mesa será disponibilizada a outros clientes para assegurar a rotação correta.</li>
                    <li><strong>Alterações e Cancelamentos:</strong> Pedimos que qualquer alteração ou cancelamento de reserva seja comunicado com o máximo de antecedência possível, utilizando o link fornecido na confirmação de reserva ou ligando diretamente para o restaurante.</li>
                    <li><strong>No-Show (Não Comparecimento):</strong> O histórico de não comparência injustificada (no-show) pode originar a limitação de reservas futuras pelo mesmo utilizador.</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <ShieldAlert size={18} /> 3. Responsabilidade do Utilizador
                </h2>
                <p>
                  O utilizador compromete-se a fornecer informações verdadeiras, exatas e atualizadas (nome, telefone e e-mail) durante a reserva, e a não fazer reservas falsas ou especulativas. O uso abusivo ou fraudulento da plataforma poderá resultar no bloqueio de acesso ao painel de reservas.
                </p>
              </section>

              <section className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Scale size={18} /> {settings?.region === 'ireland' ? '4. Resolução Alternativa de Litígios (Irlanda)' : '4. Resolução Alternativa de Litígios (RAL)'}
                </h2>
                <p>
                  {settings?.region === 'ireland' ? (
                    'Em conformidade com a regulamentação europeia sobre resolução de litígios de consumo, informamos que em caso de litígio decorrente de uma relação de consumo na Irlanda, o consumidor pode recorrer a uma entidade de Resolução Alternativa de Litígios de Consumo Irlandesa.'
                  ) : (
                    'Em conformidade com o Artigo 18.º da Lei n.º 144/2015, informamos que em caso de litígio decorrente de uma relação de consumo, o consumidor pode recorrer a uma Entidade de Resolução Alternativa de Litígios de Consumo aplicável em Portugal.'
                  )}
                </p>
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                  <p className="font-bold text-amber-600 dark:text-amber-400">
                    {settings?.region === 'ireland' ? 'Entidades de Resolução Alternativa de Litígios (Irlanda):' : 'Entidades de Resolução Alternativa de Litígios (RAL):'}
                  </p>
                  {settings?.region === 'ireland' ? (
                    <ul className="list-disc pl-6 space-y-1 text-[10.5px]">
                      <li><strong>Competition and Consumer Protection Commission (CCPC)</strong> - <a href="https://www.ccpc.ie" target="_blank" rel="noopener noreferrer" className="hover:underline text-amber-500">www.ccpc.ie</a></li>
                      <li><strong>ECC Ireland (European Consumer Centre)</strong> - <a href="https://www.eccireland.ie" target="_blank" rel="noopener noreferrer" className="hover:underline text-amber-500">www.eccireland.ie</a></li>
                    </ul>
                  ) : (
                    <ul className="list-disc pl-6 space-y-1 text-[10.5px]">
                      <li><strong>Centro de Arbitragem de Conflitos de Consumo de Lisboa (CACCL)</strong> - www.centroarbitragemlisboa.pt</li>
                      <li><strong>Centro de Informação de Consumo e Arbitragem do Porto (CICAP)</strong> - www.cicap.pt</li>
                      <li><strong>Centro de Arbitragem de Conflitos de Consumo do Vale do Ave (TRIAVE)</strong> - www.triave.pt</li>
                      <li>Para outras regiões de Portugal ou informações mais detalhadas, consulte o Portal do Consumidor: <a href="https://www.consumidor.gov.pt" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">www.consumidor.gov.pt</a></li>
                    </ul>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Globe size={18} /> {settings?.region === 'ireland' ? '5. Reclamações e Direitos do Consumidor (Irlanda)' : '5. Livro de Reclamações Eletrónico'}
                </h2>
                {settings?.region === 'ireland' ? (
                  <p>
                    Nos termos do <strong>Consumer Rights Act 2022</strong> da Irlanda, qualquer reclamação ou inconformidade sobre o nosso serviço deve ser comunicada diretamente ao restaurante através do e-mail de contacto. Faremos todos os possíveis para resolver a situação com a máxima brevidade e de forma amigável. Se necessário, os consumidores têm direito de contactar a <strong>Competition and Consumer Protection Commission (CCPC)</strong> irlandesa para obter suporte e esclarecimentos legais.
                  </p>
                ) : (
                  <>
                    <p>
                      O <strong>{restaurantName}</strong> dispõe de Livro de Reclamações Físico no estabelecimento e de <strong>Livro de Reclamações Eletrónico</strong> nos termos da legislação portuguesa aplicável. Pode aceder e submeter uma reclamação formal online em:
                    </p>
                    <div className="flex justify-start">
                      <a 
                        href="https://www.livroreclamacoes.pt" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 bg-amber-600 text-white font-bold text-[12.5px] px-6 py-3 rounded-xl hover:bg-amber-700 transition-all shadow-md"
                      >
                        Aceder ao Livro de Reclamações Eletrónico
                      </a>
                    </div>
                  </>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <FileText size={18} /> 1. Introduction and Scope
                </h2>
                <p>
                  These Terms and Conditions govern the use of the online booking platform and website of <strong>{restaurantName}</strong>. By using and making a reservation through this service, the user expressly agrees to be bound by these terms. If you disagree with any clause, please do not use our booking platform.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Calendar size={18} /> 2. Table Reservation Policy
                </h2>
                <div className="space-y-2">
                  <p>
                    Table reservations at <strong>{restaurantName}</strong> are subject to the following rules:
                  </p>
                  <ul className="list-disc pl-6 space-y-1.5">
                    <li><strong>Group Size Limits:</strong> Through our online booking system, the maximum number of guests per table/group is <strong>{maxGuests} guests</strong>. For larger groups, please contact us directly via phone {phone} or email {email}.</li>
                    <li><strong>Grace Period:</strong> We guarantee a tolerance of up to <strong>{gracePeriod} minutes</strong> relative to the scheduled reservation time. After this period, the reservation will automatically expire, and the table will be released to other customers.</li>
                    <li><strong>Modifications and Cancellations:</strong> We request that any modifications or cancellations be made as far in advance as possible, using the link provided in your confirmation email or by calling the restaurant directly.</li>
                    <li><strong>No-Shows:</strong> Repeated failure to show up without prior cancellation may result in limits on future bookings under the same account/details.</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <ShieldAlert size={18} /> 3. User Responsibility
                </h2>
                <p>
                  The user agrees to provide true, accurate, and up-to-date information (name, phone number, and email) during the booking process, and to refrain from speculative or fraudulent reservations. Abusive behavior will result in booking access being blocked.
                </p>
              </section>

              <section className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Scale size={18} /> 4. Alternative Dispute Resolution (RAL)
                </h2>
                <p>
                  In compliance with Article 18 of Law no. 144/2015 in Portugal, we inform consumers that in case of consumer disputes, they have the right to resort to Alternative Consumer Dispute Resolution bodies.
                </p>
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                  <p className="font-bold text-amber-600 dark:text-amber-400">Alternative Dispute Resolution (RAL) Centers:</p>
                  <ul className="list-disc pl-6 space-y-1 text-[10.5px]">
                    <li><strong>Lisbon Consumer Conflict Arbitration Center (CACCL)</strong> - www.centroarbitragemlisboa.pt</li>
                    <li><strong>Porto Consumer Arbitration and Information Center (CICAP)</strong> - www.cicap.pt</li>
                    <li><strong>Ave Valley Consumer Conflict Arbitration Center (TRIAVE)</strong> - www.triave.pt</li>
                    <li>For other regions of Portugal or detailed information, please consult the Portuguese Consumer Portal at: <a href="https://www.consumidor.gov.pt" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">www.consumidor.gov.pt</a></li>
                  </ul>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                  <Globe size={18} /> 5. Electronic Complaints Book
                </h2>
                <p>
                  <strong>{restaurantName}</strong> provides a physical Complaints Book at the establishment and an <strong>Electronic Complaints Book</strong> as mandated by Portuguese law. You may access and submit a formal online complaint at:
                </p>
                <div className="flex justify-start">
                  <a 
                    href="https://www.livroreclamacoes.pt" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-2 bg-amber-600 text-white font-bold text-[12.5px] px-6 py-3 rounded-xl hover:bg-amber-700 transition-all shadow-md"
                  >
                    Access Electronic Complaints Book
                  </a>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
