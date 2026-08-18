import React from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../hooks/useSettings';
import { 
  BookOpen, CalendarCheck, Users, ShieldAlert, 
  LayoutDashboard, Clock, Settings, Shield, 
  BarChart3, Activity, List, PieChart, CalendarDays, TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Instructions() {
  const { language } = useLanguage();
  const { settings } = useSettings();
  const isDark = settings?.theme === 'dark';

  return (
    <div className="max-w-5xl mx-auto space-y-12 p-6 pb-20">
      <div className="text-center space-y-4">
        <h1 className={cn("text-4xl font-bold tracking-tight", isDark ? "text-white" : "text-gray-900")}>
          {language === 'pt' ? 'Manual do Sistema' : 'System Manual'}
        </h1>
        <p className={cn("text-lg max-w-2xl mx-auto", isDark ? "text-gray-400" : "text-gray-600")}>
          {language === 'pt' 
            ? 'Guia detalhado sobre a operação, gestão e administração da plataforma de reservas.' 
            : 'Detailed guide on operating, managing, and administering the reservation platform.'}
        </p>
      </div>

      <div className={cn("p-6 rounded-2xl border flex flex-col md:flex-row items-start gap-4", isDark ? "bg-blue-900/20 border-blue-800" : "bg-blue-50 border-blue-100")}>
        <ShieldAlert className={isDark ? "text-blue-400" : "text-blue-600"} size={32} />
        <div>
          <h3 className={cn("font-bold text-xl mb-2", isDark ? "text-blue-300" : "text-blue-800")}>
            {language === 'pt' ? 'Arquitetura Offline-First & Sincronização' : 'Offline-First Architecture & Sync'}
          </h3>
          <p className={isDark ? "text-blue-200/80" : "text-blue-900/80"}>
            {language === 'pt' 
              ? 'O sistema armazena as reservas de hoje e de amanhã localmente. Se ocorrer uma falha de internet, o Live View e as Listas de Reservas continuarão a funcionar. A sincronização será restabelecida automaticamente assim que a conexão for recuperada, prevenindo perda de dados ou interrupção do serviço.'
              : 'The system caches today and tomorrow\'s reservations locally. If an internet failure occurs, the Live View and Reservation Lists will continue to function. Synchronization will automatically resume once the connection is restored, preventing data loss or service interruption.'}
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className={cn("text-2xl font-bold border-b pb-2", isDark ? "border-gray-800 text-white" : "border-gray-200 text-gray-900")}>
          {language === 'pt' ? 'Módulos Operacionais (Staff & Admin)' : 'Operational Modules (Staff & Admin)'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Activity size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>Live View</h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'A central de gestão em tempo real do salão.' : 'The real-time dining room management center.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Arrastar e Largar:' : 'Drag & Drop:'}</strong> {language === 'pt' ? 'Arraste clientes da lista de espera diretamente para as mesas livres.' : 'Drag customers from the waiting list directly onto available tables.'}</li>
              <li>• <strong>{language === 'pt' ? 'Estados Rápidos:' : 'Quick Statuses:'}</strong> {language === 'pt' ? 'Altere o estado com um clique (ex: Sentado, Pago, Finalizado).' : 'Change status with one click (e.g., Seated, Paid, Finished).'}</li>
              <li>• <strong>{language === 'pt' ? 'Conflitos:' : 'Conflicts:'}</strong> {language === 'pt' ? 'O sistema avisa se tentar sentar um grupo numa mesa com reservas próximas.' : 'The system warns if you try to seat a group on a table with upcoming reservations.'}</li>
            </ul>
          </div>


          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Activity size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Live View / Cronograma' : 'Live View / Cronograma'}
              </h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'Linha do tempo de ocupação da sala ao vivo.' : 'Real-time room occupancy timeline.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Cronograma:' : 'Timeline:'}</strong> {language === 'pt' ? 'Visualize graficamente as reservas e os tempos de ocupação de cada mesa ao longo do dia.' : 'Graphically visualize bookings and the occupancy times of each table throughout the day.'}</li>
              <li>• <strong>{language === 'pt' ? 'Vista Dinâmica (Turnos):' : 'Dynamic View (Shifts):'}</strong> {language === 'pt' ? 'Alterna entre Almoço e Jantar, filtrando a lista de reservas e a grelha visual para simplificar a operação.' : 'Switch between Lunch and Dinner, filtering the reservation list and visual grid to simplify operations.'}</li>
              <li>• <strong>{language === 'pt' ? 'Bloqueio Rápido:' : 'Quick Blocking:'}</strong> {language === 'pt' ? 'Clique em qualquer espaço livre tracejado na linha do tempo para bloquear imediatamente uma mesa por indisponibilidade.' : 'Click any dashed available space on the timeline to instantly block a table due to unavailability.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><ShieldAlert size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Smart Alerts' : 'Smart Alerts'}
              </h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'Notificações proativas e verificação de erros no sistema.' : 'Proactive notifications and system error checking.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Atribuição de Mesas:' : 'Table Assignment:'}</strong> {language === 'pt' ? 'Alerta imediato se uma reserva não tiver mesa atribuída, ou se a mesa favorita solicitada pelo cliente não estiver disponível.' : 'Immediate alert if a reservation has no assigned table, or if the customer\'s requested favorite table is unavailable.'}</li>
              <li>• <strong>{language === 'pt' ? 'Avisos de Lotação:' : 'Capacity Warnings:'}</strong> {language === 'pt' ? 'Notifica quando a lotação atinge 85% do máximo (com base nos lugares totais das mesas criadas).' : 'Notifies when occupancy reaches 85% of maximum (based on total seats of active tables).'}</li>
              <li>• <strong>{language === 'pt' ? 'Ações Rápidas:' : 'Quick Actions:'}</strong> {language === 'pt' ? 'Os alertas inteligentes auto-resolvem-se quando os problemas na reserva são corrigidos, ou podem ser silenciados.' : 'Smart alerts self-resolve when reservation issues are fixed, or they can be manually dismissed.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><CalendarCheck size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Reservas' : 'Reservations'}
              </h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'Visão em lista de todas as marcações.' : 'List view of all bookings.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Pesquisa Avançada:' : 'Advanced Search:'}</strong> {language === 'pt' ? 'Filtre por data, estado ou nome do cliente.' : 'Filter by date, status, or customer name.'}</li>
              <li>• <strong>{language === 'pt' ? 'Inserção Manual:' : 'Manual Entry:'}</strong> {language === 'pt' ? 'Crie reservas para clientes que ligam (Walk-ins/Telefone).' : 'Create bookings for walk-ins or phone calls.'}</li>
              <li>• <strong>{language === 'pt' ? 'Atribuição Automática:' : 'Auto Assignment:'}</strong> {language === 'pt' ? 'O sistema sugere a melhor mesa consoante o número de pessoas.' : 'The system suggests the best table based on party size.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><LayoutDashboard size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Salas e Mesas' : 'Rooms & Tables'}
              </h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'Configuração da planta do restaurante.' : 'Restaurant floor plan configuration.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Organização:' : 'Organization:'}</strong> {language === 'pt' ? 'Crie múltiplas zonas (ex: Esplanada, Salão Principal).' : 'Create multiple zones (e.g., Terrace, Main Hall).'}</li>
              <li>• <strong>{language === 'pt' ? 'Capacidades:' : 'Capacities:'}</strong> {language === 'pt' ? 'Defina o limite de lugares para impedir overbooking online.' : 'Set seat limits to prevent online overbooking.'}</li>
              <li>• <strong>{language === 'pt' ? 'Disponibilidade:' : 'Availability:'}</strong> {language === 'pt' ? 'Bloqueie mesas partidas ou reserve-as para a gerência temporariamente.' : 'Block broken tables or reserve them for management temporarily.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><Users size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Base de Clientes' : 'Customer Base'}
              </h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'Gestão de perfis e histórico.' : 'Profile and history management.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Registo Obrigatório:' : 'Mandatory Registration:'}</strong> {language === 'pt' ? 'O cliente precisa de conta para agendar online, evitando spam.' : 'Customers need an account to book online, preventing spam.'}</li>
              <li>• <strong>{language === 'pt' ? 'Fidelização:' : 'Loyalty:'}</strong> {language === 'pt' ? 'Identifique "Clientes Regulares" e guarde as suas mesas favoritas.' : 'Identify "Regulars" and save their favorite tables.'}</li>
              <li>• <strong>{language === 'pt' ? 'Faltas (No-Shows):' : 'No-Shows:'}</strong> {language === 'pt' ? 'Aceda ao histórico de faltas para precaver abusos.' : 'Access no-show history to prevent abuse.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><PieChart size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                Dashboard
              </h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'Visão geral do desempenho e métricas diárias.' : 'Overview of daily performance and metrics.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Métricas de Hoje:' : 'Today\'s Metrics:'}</strong> {language === 'pt' ? 'Resumo de reservas, clientes esperados e taxas de ocupação.' : 'Summary of bookings, expected customers, and occupancy rates.'}</li>
              <li>• <strong>{language === 'pt' ? 'Tendências:' : 'Trends:'}</strong> {language === 'pt' ? 'Gráficos de reservas e faturação ao longo do tempo.' : 'Charts of bookings and revenue over time.'}</li>
              <li>• <strong>{language === 'pt' ? 'Alertas Rápidos:' : 'Quick Alerts:'}</strong> {language === 'pt' ? 'Identifique facilmente cancelamentos recentes ou necessidades de atenção.' : 'Easily identify recent cancellations or attention needs.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-cyan-100 text-cyan-600 rounded-xl"><CalendarDays size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Próximas Reservas' : 'Upcoming Bookings'}
              </h3>
            </div>
            <p className={cn("mb-4 text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              {language === 'pt' ? 'Lista detalhada das próximas reservas ordenadas por chegada.' : 'Detailed list of upcoming reservations sorted by arrival.'}
            </p>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Vista Cronológica:' : 'Chronological View:'}</strong> {language === 'pt' ? 'As reservas organizadas por data e hora de chegada.' : 'Bookings organized by date and arrival time.'}</li>
              <li>• <strong>{language === 'pt' ? 'Ações Rápidas:' : 'Quick Actions:'}</strong> {language === 'pt' ? 'Confirmar, cancelar ou editar detalhes diretamente da lista.' : 'Confirm, cancel, or edit details directly from the list.'}</li>
              <li>• <strong>{language === 'pt' ? 'Filtros de Turno:' : 'Shift Filters:'}</strong> {language === 'pt' ? 'Isole reservas específicas por turno de almoço ou jantar.' : 'Isolate specific bookings by lunch or dinner shift.'}</li>
            </ul>
          </div>
          
        </div>
      </div>

      <div className="space-y-8 pt-6">
        <div className="flex items-center gap-3 border-b pb-2">
          <Shield className={isDark ? "text-red-400" : "text-red-600"} size={28} />
          <h2 className={cn("text-2xl font-bold", isDark ? "border-gray-800 text-white" : "border-gray-200 text-gray-900")}>
            {language === 'pt' ? 'Módulos de Administração (Apenas Admin)' : 'Administration Modules (Admin Only)'}
          </h2>
        </div>
        <p className={cn("text-sm max-w-3xl", isDark ? "text-gray-400" : "text-gray-600")}>
          {language === 'pt' 
            ? 'As secções seguintes contêm definições críticas do negócio e informações sensíveis, pelo que o acesso é estritamente limitado a utilizadores com o nível de privilégio "Admin".' 
            : 'The following sections contain critical business settings and sensitive data, thus access is strictly limited to users with the "Admin" privilege level.'}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-red-900/10 border-red-900/30" : "bg-red-50/50 border-red-100")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl"><BarChart3 size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Estatísticas de Clientes' : 'Customer Stats'}
              </h3>
            </div>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Visitas:' : 'Visits:'}</strong> {language === 'pt' ? 'Número total de visitas concluídas pelo cliente.' : 'Total number of completed visits by the customer.'}</li>
              <li>• <strong>{language === 'pt' ? 'Reservas Online:' : 'Online Bookings:'}</strong> {language === 'pt' ? 'Quantidade de reservas feitas de forma autónoma pela plataforma.' : 'Number of reservations made autonomously through the platform.'}</li>
              <li>• <strong>{language === 'pt' ? 'Outros Canais:' : 'Other Channels:'}</strong> {language === 'pt' ? 'Reservas inseridas manualmente (telefone ou presencial).' : 'Manually entered reservations (phone or walk-in).'}</li>
              <li>• <strong>{language === 'pt' ? 'Última Visita:' : 'Last Visit:'}</strong> {language === 'pt' ? 'Data da deslocação mais recente do cliente ao restaurante.' : 'Date of the customer\'s most recent visit to the restaurant.'}</li>
              <li>• <strong>{language === 'pt' ? 'Faltas (No Shows):' : 'No Shows:'}</strong> {language === 'pt' ? 'Vezes em que o cliente reservou mas não compareceu.' : 'Times the customer booked but failed to show up.'}</li>
              <li>• <strong>{language === 'pt' ? 'Cancelamentos:' : 'Cancellations:'}</strong> {language === 'pt' ? 'Número de reservas canceladas antes da hora marcada.' : 'Number of reservations cancelled before the scheduled time.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-red-900/10 border-red-900/30" : "bg-red-50/50 border-red-100")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl"><Settings size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Definições da App' : 'App Settings'}
              </h3>
            </div>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Turnos de Funcionamento:' : 'Operating Shifts:'}</strong> {language === 'pt' ? 'Defina os intervalos de horas em que as reservas online e manuais são aceites.' : 'Define the time slots during which online and manual reservations are accepted.'}</li>
              <li>• <strong>{language === 'pt' ? 'Dias Fechados & Regras:' : 'Closed Days & Rules:'}</strong> {language === 'pt' ? 'Desative o calendário globalmente em pausas ou defina lotações máximas de segurança.' : 'Globally disable the calendar during breaks or enforce maximum safety capacities.'}</li>
              <li>• <strong>{language === 'pt' ? 'Estilo UI (Personalização):' : 'UI Styling (Customization):'}</strong> {language === 'pt' ? 'Modifique de forma fácil o logótipo, imagens de capa (hero), fonte principal e esquema de cores do restaurante.' : 'Easily modify the restaurant\'s logo, hero images, main font, and color scheme.'}</li>
              <li>• <strong>{language === 'pt' ? 'SEO - Title & Description:' : 'SEO - Title & Description:'}</strong> {language === 'pt' ? 'Controle o nome exato e a descrição que aparecem nos resultados de motores de busca (como o Google). Ajuda os novos clientes a encontrarem o seu espaço.' : 'Control the exact name and description that appear in search engine results (like Google). Helps new customers find your venue.'}</li>
              <li>• <strong>{language === 'pt' ? 'SEO - Imagem (Meta Image):' : 'SEO - Image (Meta Image):'}</strong> {language === 'pt' ? 'Defina a imagem de apresentação que é enviada ao partilhar o link de reservas através do WhatsApp, Facebook, iMessage, etc.' : 'Set the preview image that is shown when sharing the booking link via WhatsApp, Facebook, iMessage, etc.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-red-900/10 border-red-900/30" : "bg-red-50/50 border-red-100")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl"><Shield size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Gestão de Utilizadores' : 'User Management'}
              </h3>
            </div>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Staff vs Admin:' : 'Staff vs Admin:'}</strong> {language === 'pt' ? 'Os "Staff" (Empregados) gerem livremente as reservas do dia-a-dia, enquanto o acesso "Admin" é exigido para modificar definições críticas.' : '“Staff” users freely manage day-to-day bookings, while “Admin” access is required to modify critical settings.'}</li>
              <li>• <strong>{language === 'pt' ? 'Cargos e Permissões:' : 'Roles and Permissions:'}</strong> {language === 'pt' ? 'Promova rapidamente novos colegas a "Staff". Administradores têm salvaguardas para não removerem as suas próprias contas por engano.' : 'Quickly promote new colleagues to "Staff". Administrators have safeguards against accidentally removing their own accounts.'}</li>
              <li>• <strong>{language === 'pt' ? 'Revogação de Acesso:' : 'Access Revocation:'}</strong> {language === 'pt' ? 'Remova o acesso a ex-trabalhadores de forma imediata (clicando em "Nenhum"), garantindo a segurança contínua do seu negócio.' : 'Revoke access for former employees immediately (by selecting "None"), ensuring the continuous security of your business.'}</li>
            </ul>
          </div>

          <div className={cn("p-6 rounded-2xl border transition-all", isDark ? "bg-red-900/10 border-red-900/30" : "bg-red-50/50 border-red-100")}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl"><TrendingUp size={24} /></div>
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                {language === 'pt' ? 'Insights & Controlo de Reservas' : 'Insights & Bookings Control'}
              </h3>
            </div>
            <ul className={cn("space-y-3 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
              <li>• <strong>{language === 'pt' ? 'Estatísticas da App (Insights):' : 'App Insights:'}</strong> {language === 'pt' ? 'Consulte gráficos globais de desempenho, cancelamentos, receitas estimadas e compare períodos de ocupação de todo o sistema.' : 'View global performance charts, cancellations, estimated revenues, and compare occupancy periods across the system.'}</li>
              <li>• <strong>{language === 'pt' ? 'Reservas Online:' : 'Online Bookings:'}</strong> {language === 'pt' ? 'Marcações submetidas de forma autónoma pelos clientes através do website. São limitadas pelas configurações de lotação.' : 'Bookings submitted autonomously by customers through the website. These are strictly limited by your capacity settings.'}</li>
              <li>• <strong>{language === 'pt' ? 'Reservas Manuais:' : 'Manual Bookings:'}</strong> {language === 'pt' ? 'Marcações inseridas diretamente pela equipa (ex: clientes ao telefone). Estas podem contornar limites estritos de lotação online se necessário.' : 'Bookings entered directly by staff (e.g. phone calls). These can bypass strict online capacity limits if necessary.'}</li>
              <li>• <strong>{language === 'pt' ? 'Botão de Bloqueio Rápido:' : 'Quick Block Button:'}</strong> {language === 'pt' ? 'Na secção de configurações, tem acesso a um botão rápido para desativar e voltar a ativar instantaneamente as Reservas Online para lidar com dias de enchente imprevista.' : 'In the settings section, you have access to a quick toggle to instantly disable and re-enable Online Reservations to handle unexpected overcrowded days.'}</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}

