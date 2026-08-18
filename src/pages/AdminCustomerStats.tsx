import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer, Reservation } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../hooks/useSettings';
import { Users, Phone, Mail, XCircle, UserCheck, Clock, Search, ChevronRight, ChevronLeft, Star, AlertCircle, ArrowDown, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';

type FilterType = 'all' | 'most_visits' | 'most_cancellations' | 'most_no_shows';

export default function AdminCustomerStats() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const { settings, loading: settingsLoading } = useSettings();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (!authLoading && !settingsLoading && !isAdmin) {
      navigate('/admin');
    }
  }, [isAdmin, authLoading, settingsLoading, navigate]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      console.error('Error in customers listener:', error);
    });

    const unsubReservations = onSnapshot(collection(db, 'reservations'), (snapshot) => {
      setReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation)));
      setLoading(false);
    }, (error) => {
      console.error('Error in reservations listener:', error);
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubReservations();
    };
  }, [isAdmin, authLoading]);

  // Pre-calculate stats for each customer
  const customerStatsMap = useMemo(() => {
    const map = new Map<string, {
      visits: number;
      noShows: number;
      cancellations: number;
      lastVisit: string | null;
      onlineBookings: number;
      otherBookings: number;
    }>();

    customers.forEach(customer => {
      const customerRes = reservations.filter(res => 
        (customer.email && res.customerEmail && res.customerEmail.toLowerCase() === customer.email.toLowerCase()) || 
        (customer.phone && res.customerPhone === customer.phone) ||
        (res.customerUid === customer.id)
      );

      const visits = customerRes.filter(r => ['completed', 'arrived'].includes(r.status)).length;
      const noShows = customerRes.filter(r => r.status === 'no-show').length;
      const cancellations = customerRes.filter(r => r.status === 'cancelled').length;
      
      const visitDates = customerRes
        .filter(r => ['completed', 'arrived'].includes(r.status))
        .map(r => r.date)
        .sort((a, b) => b.localeCompare(a));
      
      const lastVisit = visitDates.length > 0 ? visitDates[0] : null;
      const onlineBookings = customerRes.filter(r => r.source === 'public').length;
      const otherBookings = customerRes.filter(r => r.source === 'admin' || !r.source).length;

      map.set(customer.id, { visits, noShows, cancellations, lastVisit, onlineBookings, otherBookings });
    });

    return map;
  }, [customers, reservations]);

  // Leaders summary for KPI cards
  const topStats = useMemo(() => {
    let topVisitsCust: { customer: Customer; count: number } | null = null;
    let topCancCust: { customer: Customer; count: number } | null = null;
    let topNoShowCust: { customer: Customer; count: number } | null = null;

    customers.forEach(c => {
      const stats = customerStatsMap.get(c.id);
      if (!stats) return;

      if (!topVisitsCust || stats.visits > topVisitsCust.count) {
        if (stats.visits > 0) topVisitsCust = { customer: c, count: stats.visits };
      }
      if (!topCancCust || stats.cancellations > topCancCust.count) {
        if (stats.cancellations > 0) topCancCust = { customer: c, count: stats.cancellations };
      }
      if (!topNoShowCust || stats.noShows > topNoShowCust.count) {
        if (stats.noShows > 0) topNoShowCust = { customer: c, count: stats.noShows };
      }
    });

    return { topVisitsCust, topCancCust, topNoShowCust };
  }, [customers, customerStatsMap]);

  // Filter & sort customer list
  const processedCustomers = useMemo(() => {
    let result = customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm))
    );

    if (filterType === 'most_visits') {
      result = [...result].sort((a, b) => {
        const visitsA = customerStatsMap.get(a.id)?.visits || 0;
        const visitsB = customerStatsMap.get(b.id)?.visits || 0;
        return visitsB - visitsA;
      });
    } else if (filterType === 'most_cancellations') {
      result = [...result].sort((a, b) => {
        const cancA = customerStatsMap.get(a.id)?.cancellations || 0;
        const cancB = customerStatsMap.get(b.id)?.cancellations || 0;
        return cancB - cancA;
      });
    } else if (filterType === 'most_no_shows') {
      result = [...result].sort((a, b) => {
        const nsA = customerStatsMap.get(a.id)?.noShows || 0;
        const nsB = customerStatsMap.get(b.id)?.noShows || 0;
        return nsB - nsA;
      });
    }

    return result;
  }, [customers, searchTerm, filterType, customerStatsMap]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const totalPages = Math.ceil(processedCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = processedCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading || settingsLoading) return <div className="p-8 text-center">{t('common.loading')}</div>;

  return (
    <div className={cn("mx-auto py-8 px-4 sm:px-6 lg:px-8", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className={cn(
            "text-3xl font-bold flex items-center gap-3 transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            <Users className="text-amber-600" size={32} />
            {t('nav.customer_stats')}
          </h1>
          <p className={cn(
            "transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-500"
          )}>{t('dashboard.manage_customers')}</p>
        </div>
      </div>

      {/* Control Bar: Filter Pills + Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter size={14} />
            {language === 'pt' ? 'Filtrar por:' : 'Filter by:'}
          </span>
          
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
              filterType === 'all'
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {language === 'pt' ? 'Todos' : 'All'}
          </button>

          <button
            onClick={() => setFilterType('most_visits')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1",
              filterType === 'most_visits'
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            <UserCheck size={14} />
            {language === 'pt' ? 'Mais Visitas' : 'Most Visits'}
          </button>

          <button
            onClick={() => setFilterType('most_cancellations')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1",
              filterType === 'most_cancellations'
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-orange-50 text-orange-700 hover:bg-orange-100"
            )}
          >
            <XCircle size={14} />
            {language === 'pt' ? 'Mais Cancelamentos' : 'Most Cancellations'}
          </button>

          <button
            onClick={() => setFilterType('most_no_shows')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1",
              filterType === 'most_no_shows'
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            )}
          >
            <AlertCircle size={14} />
            {language === 'pt' ? 'Mais Faltas' : 'Most No-Shows'}
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          />
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t('common.name')} / {t('common.phone')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t('common.email')}</th>
                <th className={cn(
                  "px-6 py-4 text-sm font-semibold text-center transition-colors",
                  filterType === 'most_visits' ? "bg-emerald-50 text-emerald-800" : "text-gray-600"
                )}>
                  <div className="flex items-center justify-center gap-1">
                    <span>{t('common.visits')}</span>
                    {filterType === 'most_visits' && <ArrowDown size={14} className="text-emerald-600" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-center">{language === 'pt' ? 'Reservas Online' : 'Online Bookings'}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-center">{language === 'pt' ? 'Outros Canais' : 'Other Channels'}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t('common.last_visit')}</th>
                <th className={cn(
                  "px-6 py-4 text-sm font-semibold text-center transition-colors",
                  filterType === 'most_no_shows' ? "bg-rose-50 text-rose-800" : "text-gray-600"
                )}>
                  <div className="flex items-center justify-center gap-1">
                    <span>{t('common.no_shows')}</span>
                    {filterType === 'most_no_shows' && <ArrowDown size={14} className="text-rose-600" />}
                  </div>
                </th>
                <th className={cn(
                  "px-6 py-4 text-sm font-semibold text-center transition-colors",
                  filterType === 'most_cancellations' ? "bg-orange-50 text-orange-800" : "text-gray-600"
                )}>
                  <div className="flex items-center justify-center gap-1">
                    <span>{t('common.cancellations')}</span>
                    {filterType === 'most_cancellations' && <ArrowDown size={14} className="text-orange-600" />}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.map((customer) => {
                const stats = customerStatsMap.get(customer.id) || {
                  visits: 0,
                  noShows: 0,
                  cancellations: 0,
                  lastVisit: null,
                  onlineBookings: 0,
                  otherBookings: 0,
                };

                return (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-gray-900">{customer.name}</span>
                        {customer.isRegular && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wider border border-amber-200">
                            <Star size={8} className="fill-amber-600 text-amber-600" />
                            REGULAR
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center flex-wrap gap-2 mt-1">
                        {customer.phone ? (
                          <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-gray-600 hover:text-amber-600">
                            <Phone size={10} /> {customer.phone}
                          </a>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Phone size={10} /> —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.email ? (
                        <a 
                          href={`mailto:${customer.email}`}
                          className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors no-underline"
                          title={`Email ${customer.email}`}
                        >
                          <Mail size={14} className="text-gray-400 hover:text-blue-500" />
                          {customer.email}
                        </a>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-center transition-colors",
                      filterType === 'most_visits' && "bg-emerald-50/30 font-bold"
                    )}>
                      <span className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm",
                        stats.visits > 5 ? "bg-emerald-100 text-emerald-700" : (stats.visits > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600")
                      )}>
                        {stats.visits}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                        {stats.onlineBookings}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-gray-50 text-gray-600 text-xs font-semibold">
                        {stats.otherBookings}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {stats.lastVisit ? (
                        <div className="text-sm text-gray-700 flex items-center gap-2">
                          <Clock size={14} className="text-amber-500" />
                          {format(parseISO(stats.lastVisit), 'dd/MM/yyyy')}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-center transition-colors",
                      filterType === 'most_no_shows' && "bg-rose-50/30"
                    )}>
                      <span className={cn(
                        "text-sm font-bold px-2 py-1 rounded-lg",
                        stats.noShows > 0 ? "bg-rose-100 text-rose-700" : "text-gray-400"
                      )}>
                        {stats.noShows}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-center transition-colors",
                      filterType === 'most_cancellations' && "bg-orange-50/30"
                    )}>
                      <span className={cn(
                        "text-sm font-bold px-2 py-1 rounded-lg",
                        stats.cancellations > 0 ? "bg-orange-100 text-orange-700" : "text-gray-400"
                      )}>
                        {stats.cancellations}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {processedCustomers.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Users className="mx-auto mb-4 text-gray-200" size={48} />
              <p>{t('common.no_search_results')}</p>
            </div>
          )}
        </div>
        {totalPages > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
            <div className="text-sm text-gray-500">
              {language === 'pt' ? 'Mostrando' : 'Showing'} <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> {language === 'pt' ? 'a' : 'to'} <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, processedCustomers.length)}</span> {language === 'pt' ? 'de' : 'of'} <span className="font-medium">{processedCustomers.length}</span> {language === 'pt' ? 'clientes' : 'customers'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-gray-700 px-2">
                {language === 'pt' ? 'Página' : 'Page'} {currentPage} {language === 'pt' ? 'de' : 'of'} {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

