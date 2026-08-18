import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCustomers } from '../hooks/useCustomers';
import { useTables } from '../hooks/useTables';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { MdTableRestaurant } from 'react-icons/md';
import { Search, ChevronLeft, ChevronRight, User, Phone, Mail, FileText, Trash2, Edit2, Plus, X, BarChart3, Star, CheckCircle2, Shield, Calendar, LayoutGrid, List, Ban, Eye, EyeOff, ArrowDownAZ, ArrowUpAZ, MessageCircle, Utensils, MoreHorizontal } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { Customer } from '../types';
import { toast } from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';


const FavoriteTablesAccordion = ({ customer, tables, language }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="pt-1">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-max text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer list-none flex items-center gap-1.5 hover:text-amber-600 transition-colors outline-none"
      >
        <MdTableRestaurant size={16} className="shrink-0" />
        <span className={cn("transition-transform duration-300", isOpen && "rotate-180")}>▼</span>
      </button>
      <div className={cn("grid transition-all duration-300 ease-in-out", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-1.5 pr-8 mt-2 pb-1">
            {customer.favoriteTables.map((tableId: string, idx: number) => {
              const tbl = tables.find((t: any) => t.id === tableId);
              return (
                <span key={tableId} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-xs text-gray-700 px-2 py-1 rounded-lg">
                  <span className="font-bold text-amber-600">#{idx + 1}</span>
                  {tbl ? tbl.name : tableId}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminCustomers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, loading } = useCustomers();
  const { tables } = useTables();
  const { language, t } = useLanguage();

  const [registeredUsers, setRegisteredUsers] = useState<Record<string, { id?: string; email: string; status: string; createdAt?: any }>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersMap: Record<string, { id?: string; email: string; status: string; createdAt?: any }> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.role === 'customer') {
          usersMap[doc.id] = { id: doc.id,
            email: data.email || '',
            status: data.status || 'active',
            createdAt: data.createdAt
          };
          if (data.email) {
            usersMap[data.email.toLowerCase()] = { id: doc.id,
              email: data.email,
              status: data.status || 'active',
              createdAt: data.createdAt
            };
          }
        }
      });
      setRegisteredUsers(usersMap);
    }, (error) => {
      console.warn('Could not subscribe to users collection (likely non-admin role). Falling back to isRegistered flags.', error);
    });

    return () => unsubscribe();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, max: number, fieldName: string) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.currentTarget.value.length >= max) {
        toast.error(
          language === 'pt'
            ? `Limite de ${max} caracteres atingido para ${fieldName}`
            : `Maximum length of ${max} characters reached for ${fieldName}`,
          { id: 'char-limit-error' }
        );
      }
    }
  };
  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [filterType, setFilterType] = useState<'all' | 'registered' | 'suspended'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [revealedCustomerIds, setRevealedCustomerIds] = useState<Set<string>>(new Set());

  const toggleRevealCustomer = (id: string) => {
    setRevealedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const [expandedActionRow, setExpandedActionRow] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<{
    name: string;
    phone: string;
    email: string;
    notes: string;
    language: 'pt' | 'en';
    isRegular: boolean;
    favoriteTables: string[];
  }>({
    name: '',
    phone: '',
    email: '',
    notes: '',
    language: 'en',
    isRegular: false,
    favoriteTables: []
  });
  const [selectedTableToAdd, setSelectedTableToAdd] = useState('');

  const addFavoriteTable = (tableId: string, isEditing: boolean) => {
    if (!tableId) return;
    if (isEditing && editingCustomer) {
      const currentFavs = editingCustomer.favoriteTables || [];
      if (!currentFavs.includes(tableId)) {
        setEditingCustomer({
          ...editingCustomer,
          favoriteTables: [...currentFavs, tableId]
        });
      }
    } else {
      const currentFavs = newCustomer.favoriteTables || [];
      if (!currentFavs.includes(tableId)) {
        setNewCustomer({
          ...newCustomer,
          favoriteTables: [...currentFavs, tableId]
        });
      }
    }
    setSelectedTableToAdd('');
  };

  const removeFavoriteTable = (tableId: string, isEditing: boolean) => {
    if (isEditing && editingCustomer) {
      const currentFavs = editingCustomer.favoriteTables || [];
      setEditingCustomer({
        ...editingCustomer,
        favoriteTables: currentFavs.filter(id => id !== tableId)
      });
    } else {
      const currentFavs = newCustomer.favoriteTables || [];
      setNewCustomer({
        ...newCustomer,
        favoriteTables: currentFavs.filter(id => id !== tableId)
      });
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const isCustomerRegistered = (c: Customer) => {
    return !!(c.isRegistered || registeredUsers[c.id] || (c.email && registeredUsers[c.email.toLowerCase()]));
  };

  const filteredCustomers = customers
    .filter(c => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (c.name || '').toLowerCase().includes(searchLower) || 
                            (c.phone || '').includes(searchTerm) || 
                            (c.email || '').toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      if (filterType === 'registered') {
        return isCustomerRegistered(c);
      }
      if (filterType === 'suspended') {
        const regInfo = registeredUsers[c.id] || (c.email ? registeredUsers[c.email.toLowerCase()] : null);
        return regInfo?.status === 'suspended';
      }
      return true;
    })
    .sort((a, b) => {
      const nameA = (a.name || '').trim();
      const nameB = (b.name || '').trim();
      const comparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const totalItems = filteredCustomers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const effectiveCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCustomers = filteredCustomers.slice(
    (effectiveCurrentPage - 1) * itemsPerPage,
    effectiveCurrentPage * itemsPerPage
  );

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      await deleteCustomer(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div className={cn("mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col min-h-[calc(100vh-6rem)]", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className={cn(
            "text-3xl font-bold transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-900"
          )}>{t('nav.customers')}</h1>
          <p className={cn(
            "transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-500"
          )}>{t('dashboard.manage_customers')}</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && settings?.showCustomerInsights && (
            <Link
              to="/admin/customer-stats"
              className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-sm"
            >
              <BarChart3 size={20} />
              {t('nav.customer_stats')}
            </Link>
          )}
          <button
            onClick={() => { setNewCustomer({ name: '', phone: '', email: '', notes: '', language: language || 'en', isRegular: false, favoriteTables: [] }); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            {t('customers.add')}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          {/* Visually hidden inputs to trap browser autofill */}
          <div className="absolute opacity-0 w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true" tabIndex={-1}>
            <input type="text" name="trap_name" autoComplete="name" tabIndex={-1} />
            <input type="email" name="trap_email" autoComplete="email" tabIndex={-1} />
            <input type="tel" name="trap_phone" autoComplete="tel" tabIndex={-1} />
          </div>
          
          <input 
            type="search"
            name="search-customers-ignore"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-gray-900"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 w-full md:w-auto bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => {
              setFilterType('all');
              setCurrentPage(1);
            }}
            className={cn(
              "flex-1 md:flex-initial px-4 py-1.5 rounded-md text-sm font-semibold transition-all",
              filterType === 'all'
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            {language === 'pt' ? 'Todos' : 'All'}
          </button>
          <button
            onClick={() => {
              setFilterType('registered');
              setCurrentPage(1);
            }}
            className={cn(
              "flex-1 md:flex-initial px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
              filterType === 'registered'
                ? "bg-amber-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            <CheckCircle2 size={14} />
            {language === 'pt' ? 'Registados' : 'Registered'}
          </button>
          <button
            onClick={() => {
              setFilterType('suspended');
              setCurrentPage(1);
            }}
            className={cn(
              "flex-1 md:flex-initial px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
              filterType === 'suspended'
                ? "bg-rose-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            <Ban size={14} />
            {language === 'pt' ? 'Suspensos' : 'Suspended'}
          </button>
        </div>
        
        {/* Sort & View Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto ml-auto">
          {/* Sort Order (A-Z / Z-A) */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-1.5 bg-white text-gray-800 shadow-sm hover:text-amber-600 cursor-pointer"
              title={
                sortOrder === 'asc'
                  ? (language === 'pt' ? 'Ordenado de A a Z (clique para Z-A)' : 'Sorted A to Z (click for Z-A)')
                  : (language === 'pt' ? 'Ordenado de Z a A (clique para A-Z)' : 'Sorted Z to A (click for A-Z)')
              }
            >
              {sortOrder === 'asc' ? (
                <ArrowDownAZ size={16} className="text-amber-600 shrink-0" />
              ) : (
                <ArrowUpAZ size={16} className="text-amber-600 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {language === 'pt'
                  ? (sortOrder === 'asc' ? 'A - Z' : 'Z - A')
                  : (sortOrder === 'asc' ? 'A - Z' : 'Z - A')}
              </span>
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                viewMode === 'grid'
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              )}
              title={language === 'pt' ? 'Visualização em Grelha' : 'Grid View'}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                viewMode === 'list'
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              )}
              title={language === 'pt' ? 'Visualização em Lista' : 'List View'}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 font-medium">
            {language === 'pt' ? 'Nenhum cliente encontrado.' : 'No customers found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1">
          <AnimatePresence mode="wait">
              <motion.div
                key={currentPage + '-' + viewMode + '-' + filterType + '-' + sortOrder}
                initial={{ opacity: 0, scale: 0.98, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -6 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className={cn(
                  "grid w-full transition-all duration-300",
                  viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "grid-cols-1 gap-4"
                )}
              >
            {paginatedCustomers.map((customer) => {
              const regInfo = registeredUsers[customer.id] || (customer.email ? registeredUsers[customer.email.toLowerCase()] : null) || (customer.isRegistered ? { email: customer.email, status: 'active' } : null);
              const isRevealed = revealedCustomerIds.has(customer.id);

              const ActionButtons = (
                <>
                  <button 
                    onClick={() => toggleRevealCustomer(customer.id)}
                    className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-gray-100 rounded transition-colors"
                    title={isRevealed ? (language === 'pt' ? 'Ocultar contactos' : 'Hide contact details') : (language === 'pt' ? 'Mostrar contactos' : 'Show contact details')}
                  >
                    {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button 
                    onClick={() => setEditingCustomer(customer)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title={language === 'pt' ? 'Editar' : 'Edit'}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(customer.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title={language === 'pt' ? 'Eliminar' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  <div className="flex items-center ml-1">
                    <button 
                      onClick={() => setExpandedActionRow(expandedActionRow === customer.id ? null : customer.id)}
                      className={cn(
                        "p-1.5 rounded transition-colors", 
                        expandedActionRow === customer.id ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      )}
                      title={language === 'pt' ? 'Contactos' : 'Contacts'}
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    <div 
                      className={cn(
                        "flex items-center overflow-hidden transition-all duration-300 ease-in-out",
                        expandedActionRow === customer.id ? "max-w-[150px] opacity-100 ml-1" : "max-w-0 opacity-0"
                      )}
                    >
                      <div className="flex items-center gap-1 p-0.5">
                        {customer.email ? (
                          <a
                            href={`mailto:${customer.email}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors flex items-center justify-center no-underline hover:no-underline"
                            title={language === 'pt' ? `Enviar email para ${customer.name}` : `Send email to ${customer.name}`}
                          >
                            <Mail size={14} />
                          </a>
                        ) : (
                          <span className="p-1.5 text-gray-300 rounded cursor-not-allowed" title={language === 'pt' ? 'Sem email' : 'No email'}>
                            <Mail size={14} />
                          </span>
                        )}

                        {customer.phone ? (
                          <>
                            <a
                              href={`tel:${customer.phone}`}
                              className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors flex items-center justify-center no-underline hover:no-underline"
                              title={language === 'pt' ? `Ligar para ${customer.name}` : `Call ${customer.name}`}
                            >
                              <Phone size={14} />
                            </a>
                            <div className="scale-90 origin-center">
                              <WhatsAppButton 
                                phone={customer.phone} 
                                customerName={customer.name}
                                region={settings?.region}
                                defaultCountryCode={settings?.defaultCountryCode}
                                language={language}
                                iconSize={14}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="p-1.5 text-gray-300 rounded cursor-not-allowed">
                               <Phone size={14} />
                            </span>
                            <div className="scale-90 origin-center opacity-50">
                              <WhatsAppButton 
                                 phone={null}
                                 language={language}
                                 iconSize={14}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
              
              return (
                <motion.div layout={!settings?.compactAdminViews} key={customer.id} className={cn("bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden", settings?.compactAdminViews ? "py-2.5 px-4 space-y-1.5" : "p-4 space-y-2.5", !settings?.compactAdminViews && "transition-all duration-300")}>
                  <div className={cn("flex w-full gap-3", viewMode === 'list' ? "items-center flex-row justify-between" : "items-start flex-col")}>
                    {/* Left Side (Grid) / Main Content (List) */}
                    <div className={cn("flex flex-1 min-w-0 pr-2", viewMode === 'list' ? "flex-row items-center gap-4" : "flex-col items-start gap-2 w-full")}>
                      <div className={cn("flex items-center justify-between", viewMode === 'list' ? "w-auto" : "w-full")}>
                        {/* P / Avatar Circle */}
                        <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold shrink-0">
                          {customer.name.charAt(0)}
                        </div>
                        
                        {/* Actions in Grid View */}
                        {viewMode === 'grid' && (
                          <div className="flex items-center gap-0.5 shrink-0 justify-end mt-[-5px]">
                            {ActionButtons}
                          </div>
                        )}
                      </div>
                      
                      {/* Name and Contact Info */}
                      <div className={cn("flex flex-col gap-1.5", viewMode === 'list' ? "flex-1" : "")}>
                        {/* Name */}
                        <h3 className="font-bold text-gray-900 flex flex-wrap items-center gap-1.5 shrink-0 mt-1">
                          <span>{customer.name}</span>
                          {customer.isRegular && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider">
                              <Star size={10} className="fill-amber-600 text-amber-600" />
                              REGULAR
                            </span>
                          )}
                          {regInfo && (
                            <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider">
                              <CheckCircle2 size={10} />
                              {language === 'pt' ? 'Registado' : 'Registered'}
                            </span>
                          )}
                        </h3>
                        
                        {/* Phone and Email */}
                        <div className={cn("flex", viewMode === 'list' ? "flex-row flex-wrap items-center gap-4" : "flex-col gap-1.5")}>
                          {customer.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0">
                              <Phone size={14} className="text-gray-400 shrink-0" />
                              <a 
                                href={`tel:${customer.phone}`}
                                className={cn(
                                  "text-gray-700 hover:text-amber-600 font-medium transition-all inline-block no-underline hover:no-underline",
                                  !isRevealed && "blur-[4px] select-none pointer-events-none"
                                )}
                                style={{ textDecoration: 'none' }}
                              >
                                {customer.phone}
                              </a>
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0">
                              <Mail size={14} className="text-gray-400 shrink-0" />
                              <a 
                                href={`mailto:${customer.email}`}
                                className={cn(
                                  "text-gray-700 hover:text-amber-600 font-medium transition-all inline-block no-underline hover:no-underline",
                                  !isRevealed && "blur-[4px] select-none pointer-events-none"
                                )}
                                style={{ textDecoration: 'none' }}
                              >
                                {customer.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions in List View */}
                    {viewMode === 'list' && (
                      <div className="flex items-center gap-0.5 shrink-0 justify-end mt-[-5px]">
                        {ActionButtons}
                      </div>
                    )}
                  </div>
                  {(regInfo?.email && regInfo.email.toLowerCase() !== customer.email?.toLowerCase() || regInfo?.status || (customer.notes && customer.notes !== 'Auto-created on registration') || (customer.favoriteTables && customer.favoriteTables.length > 0)) && (
                    <div className="space-y-1.5 text-sm text-gray-600 pt-1 border-t border-gray-50">
                      {regInfo && regInfo.email && regInfo.email.toLowerCase() !== customer.email?.toLowerCase() && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail size={14} className="text-gray-400 shrink-0" />
                          <span className={cn("transition-all", !isRevealed && "blur-[4px] select-none")}>
                            {language === 'pt' ? 'Email de login:' : 'Login email:'} {regInfo.email}
                          </span>
                        </div>
                      )}
                      {regInfo && regInfo.status && (
                        <div className="flex items-center gap-2 text-xs">
                          <Shield size={14} className="text-gray-400 shrink-0" />
                          <span>
                            {language === 'pt' ? 'Conta:' : 'Account:'}{' '}
                            <span className={cn(
                              "font-semibold",
                              regInfo.status === 'active' ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {regInfo.status === 'active' 
                                ? (language === 'pt' ? 'Ativa' : 'Active') 
                                : (language === 'pt' ? 'Inativa' : 'Inactive')}
                            </span>
                          </span>
                        </div>
                      )}
                      {customer.notes && customer.notes !== 'Auto-created on registration' && (
                        <div className="flex items-start gap-2 pr-8">
                          <FileText size={14} className="text-gray-400 mt-0.5 shrink-0" />
                          <span className="italic">"{customer.notes}"</span>
                        </div>
                      )}
                      {customer.favoriteTables && customer.favoriteTables.length > 0 && (
                        <FavoriteTablesAccordion customer={customer} tables={tables} language={language} />
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
            </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagination Controls */}
          {totalPages > 0 && (
            <div className="mt-auto pt-8 flex items-center justify-between px-4">
              <p className="text-sm text-gray-500 font-medium">
                {language === 'pt' ? 'Página' : 'Page'} {effectiveCurrentPage} {language === 'pt' ? 'de' : 'of'} {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.max(prev - 1, 1));
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 250);
                  }}
                  disabled={effectiveCurrentPage === 1}
                  className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 250);
                  }}
                  disabled={effectiveCurrentPage === totalPages}
                  className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold mb-4">{t('customers.delete_title')}</h3>
            <p className="text-gray-600 mb-6">{t('customers.delete_confirm')}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Add/Edit */}
      {(showAddModal || editingCustomer) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-xl font-bold">
                {editingCustomer ? t('customers.edit_details') : t('customers.add')}
              </h3>
              <button 
                onClick={() => { 
                  setShowAddModal(false); 
                  setEditingCustomer(null); 
                  setSelectedTableToAdd('');
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <form 
              autoComplete="off"
              onSubmit={async (e) => {
                e.preventDefault();

                const targetEmail = editingCustomer ? editingCustomer.email : newCustomer.email;
                if (targetEmail) {
                  const emailExists = customers.some(c => 
                    c.email?.trim().toLowerCase() === targetEmail.trim().toLowerCase() && 
                    c.id !== (editingCustomer?.id || '')
                  );
                  if (emailExists) {
                    toast.error(language === 'pt' ? 'Já existe um cliente com este email.' : 'A customer with this email already exists.');
                    return;
                  }
                }

                try {
                  if (editingCustomer) {
                    await updateCustomer(editingCustomer.id, {
                      name: editingCustomer.name,
                      phone: editingCustomer.phone,
                      email: editingCustomer.email || '',
                      notes: editingCustomer.notes || '',
                      language: editingCustomer.language || 'en',
                      isRegular: editingCustomer.isRegular || false,
                      favoriteTables: editingCustomer.favoriteTables || []
                    });
                    setEditingCustomer(null);
                  } else {
                    await addCustomer(newCustomer);
                    setShowAddModal(false);
                    setNewCustomer({
                      name: '',
                      phone: '',
                      email: '',
                      notes: '',
                      language: (language as 'pt' | 'en') || 'en',
                      isRegular: false,
                      favoriteTables: []
                    });
                  }
                  setSelectedTableToAdd('');
                } catch (err: any) {
                  console.error(err);
                  toast.error(err.message || "Error saving customer");
                }
              }} 
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
                <input 
                  required
                  type="text"
                  name="customer_new_name_no_autofill"
                  autoComplete="off"
                  maxLength={50}
                  value={editingCustomer ? editingCustomer.name : newCustomer.name}
                  onChange={(e) => editingCustomer ? setEditingCustomer({ ...editingCustomer, name: e.target.value }) : setNewCustomer({ ...newCustomer, name: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
                <div className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-amber-500 bg-white">
                  <PhoneInput
                    defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                    autoComplete="off"
                    name="customer_new_phone_no_autofill"
                    value={editingCustomer ? editingCustomer.phone : newCustomer.phone}
                    onChange={(val) => editingCustomer ? setEditingCustomer({ ...editingCustomer, phone: val || '' }) : setNewCustomer({ ...newCustomer, phone: val || '' })}
                    className="w-full text-sm outline-none text-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email')}</label>
                  <input 
                    type="email"
                    name="customer_new_email_no_autofill"
                    autoComplete="off"
                    maxLength={100}
                    value={editingCustomer ? (editingCustomer.email || '') : newCustomer.email}
                    onChange={(e) => editingCustomer ? setEditingCustomer({ ...editingCustomer, email: e.target.value }) : setNewCustomer({ ...newCustomer, email: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-gray-900"
                  />
                </div>
                <div className="flex flex-col items-end">
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-right w-full">{language === 'pt' ? 'Idioma Preferido' : 'Preferred Language'}</label>
                  <div className="flex bg-gray-100 p-1 rounded-lg w-fit h-[42px] items-center">
                    <button
                      type="button"
                      onClick={() => editingCustomer ? setEditingCustomer({ ...editingCustomer, language: 'pt' }) : setNewCustomer({ ...newCustomer, language: 'pt' })}
                      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${(editingCustomer ? editingCustomer.language : newCustomer.language) === 'pt' ? 'bg-white shadow text-amber-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                    >PT</button>
                    <button
                      type="button"
                      onClick={() => editingCustomer ? setEditingCustomer({ ...editingCustomer, language: 'en' }) : setNewCustomer({ ...newCustomer, language: 'en' })}
                      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${(editingCustomer ? editingCustomer.language : newCustomer.language) !== 'pt' ? 'bg-white shadow text-amber-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                    >EN</button>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">{t('common.notes')}</label>
                  
                  {/* Regular Customer Checkbox */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="modal-isRegular"
                      checked={editingCustomer ? (editingCustomer.isRegular || false) : newCustomer.isRegular}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (editingCustomer) {
                          setEditingCustomer({ ...editingCustomer, isRegular: checked });
                        } else {
                          setNewCustomer({ ...newCustomer, isRegular: checked });
                        }
                      }}
                      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                    />
                    <label htmlFor="modal-isRegular" className="text-xs font-medium text-gray-500 select-none">
                      {language === 'en' ? 'Regular' : 'Regular'}
                    </label>
                  </div>
                </div>
                <textarea 
                  value={editingCustomer ? (editingCustomer.notes || '') : newCustomer.notes}
                  onChange={(e) => editingCustomer ? setEditingCustomer({ ...editingCustomer, notes: e.target.value }) : setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, 300, t('common.notes'))}
                  rows={3}
                  maxLength={300}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none text-gray-900"
                />
              </div>

              {/* Favorite Tables Management */}
              <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
                <label className="block text-sm font-bold text-gray-700">
                  {language === 'en' ? 'Favorite Tables (Choice Priority)' : 'Mesas Favoritas (Ordem de Escolha)'}
                </label>
                
                {/* List current choices */}
                {((editingCustomer ? editingCustomer.favoriteTables : newCustomer.favoriteTables) || []).length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {((editingCustomer ? editingCustomer.favoriteTables : newCustomer.favoriteTables) || []).map((tableId, index) => {
                      const tbl = tables.find(t => t.id === tableId);
                      return (
                        <div key={tableId} className="flex items-center justify-between bg-gray-50 border border-gray-100 p-2 rounded-lg text-xs">
                          <span className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-[10px]">
                              {index + 1}
                            </span>
                            <span className="font-semibold text-gray-800">
                              {tbl ? tbl.name : tableId}
                            </span>
                            <span className="text-gray-400">
                              ({tbl ? `${tbl.seats} ${t('common.seats') || 'seats'}` : ''})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFavoriteTable(tableId, !!editingCustomer)}
                            className="text-[10px] text-red-500 hover:text-red-700 font-semibold px-1.5 py-0.5 rounded hover:bg-red-50"
                          >
                            {t('common.remove') || 'Remove'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Dropdown to add next choice */}
                <div className="flex gap-2">
                  <select
                    value={selectedTableToAdd}
                    onChange={(e) => setSelectedTableToAdd(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">
                      {language === 'en' ? '-- Select Table to Add --' : '-- Escolha a Mesa para Adicionar --'}
                    </option>
                    {tables
                      .filter(tbl => !((editingCustomer ? editingCustomer.favoriteTables : newCustomer.favoriteTables) || []).includes(tbl.id))
                      .map(tbl => (
                        <option key={tbl.id} value={tbl.id}>
                          {tbl.name} ({tbl.seats} {t('common.seats') || 'seats'})
                        </option>
                      ))
                    }
                  </select>
                  <button
                    type="button"
                    onClick={() => addFavoriteTable(selectedTableToAdd, !!editingCustomer)}
                    disabled={!selectedTableToAdd}
                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    + {language === 'en' ? 'Add' : 'Adicionar'}
                  </button>
                </div>
              </div>

                            {/* User Account Management (if registered) */}
              {editingCustomer && (editingCustomer.isRegistered || registeredUsers[editingCustomer.id] || (editingCustomer.email && registeredUsers[editingCustomer.email.toLowerCase()])) && (
                <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
                  <label className="block text-sm font-bold text-gray-700">
                    {language === 'pt' ? 'Gestão de Conta de Utilizador' : 'User Account Management'}
                  </label>
                  
                  {(() => {
                    const regInfo = registeredUsers[editingCustomer.id] || (editingCustomer.email ? registeredUsers[editingCustomer.email.toLowerCase()] : null) || (editingCustomer.isRegistered ? { id: editingCustomer.id, email: editingCustomer.email, status: 'active' } : null);
                      
                    if (!regInfo || !regInfo.id) return null;
                    
                    return (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{regInfo.email}</p>
                            <p className="text-xs text-gray-500">
                              {language === 'pt' ? 'Estado:' : 'Status:'}{' '}
                              <span className={regInfo.status === 'active' ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                                {regInfo.status === 'active' 
                                  ? (language === 'pt' ? 'Ativa' : 'Active') 
                                  : (language === 'pt' ? 'Inativa (Suspensa)' : 'Inactive (Suspended)')}
                              </span>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const newStatus = regInfo.status === 'active' ? 'inactive' : 'active';
                                  // Handle legacy users collection entries
                                  if (regInfo.email) {
                                    const q = query(collection(db, 'users'), where('email', '==', regInfo.email.toLowerCase()));
                                    const snap = await getDocs(q);
                                    const updatePromises = snap.docs.map(d => updateDoc(doc(db, 'users', d.id), { status: newStatus }));
                                    await Promise.all(updatePromises);
                                  } else {
                                    await updateDoc(doc(db, 'users', regInfo.id), { status: newStatus });
                                  }
                                  
                                  // Update the customer record itself (since new customers don't have a users entry)
                                  await updateCustomer(editingCustomer.id, { status: newStatus });
                                  toast.success(
                                    language === 'pt' 
                                      ? `Conta ${newStatus === 'active' ? 'ativada' : 'suspensa'} com sucesso!` 
                                      : `Account ${newStatus === 'active' ? 'activated' : 'suspended'} successfully!`
                                  );
                                } catch (error) {
                                  console.error(error);
                                  toast.error(language === 'pt' ? 'Erro ao atualizar estado.' : 'Error updating status.');
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                                regInfo.status === 'active'
                                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              )}
                            >
                              {regInfo.status === 'active' 
                                ? (language === 'pt' ? 'Suspender' : 'Suspend') 
                                : (language === 'pt' ? 'Ativar' : 'Activate')}
                            </button>
                            
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(language === 'pt' ? 'Tem a certeza que deseja eliminar a conta deste utilizador? O cliente permanecerá na lista de clientes, mas não poderá fazer login.' : 'Are you sure you want to delete this user account? The customer will remain in the customers list but will not be able to log in.')) {
                                  try {
                                    // Handle legacy users collection entries
                                    if (regInfo.email) {
                                      const q = query(collection(db, 'users'), where('email', '==', regInfo.email.toLowerCase()));
                                      const snap = await getDocs(q);
                                      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'users', d.id)));
                                      await Promise.all(deletePromises);
                                    } else {
                                      await deleteDoc(doc(db, 'users', regInfo.id));
                                    }
                                    
                                    // Handle Firebase Auth deletion for customer
                                    let authUid = editingCustomer.authUid;
                                    if (authUid) {
                                      try {
                                        const res = await fetch('/api/admin/delete-user', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ uid: authUid })
                                        });
                                        if (!res.ok) console.error('Failed to delete auth user');
                                      } catch (e) {
                                        console.error('Error calling delete API:', e);
                                      }
                                    }
                                    
                                    // Mark customer as unregistered
                                    await updateCustomer(editingCustomer.id, { isRegistered: false, authUid: null });
                                    
                                    toast.success(language === 'pt' ? 'Conta eliminada com sucesso.' : 'Account deleted successfully.');
                                  } catch (error) {
                                    console.error(error);
                                    toast.error(language === 'pt' ? 'Erro ao eliminar conta.' : 'Error deleting account.');
                                  }
                                }
                              }}
                              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                            >
                              {language === 'pt' ? 'Eliminar Conta' : 'Delete Account'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                <button 
                  type="button"
                  onClick={() => { 
                    setShowAddModal(false); 
                    setEditingCustomer(null); 
                    setSelectedTableToAdd('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-semibold"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-amber-600 text-white py-2 rounded-lg font-bold hover:bg-amber-700 transition-colors text-sm shadow-sm"
                >
                  {editingCustomer ? t('common.save') : t('customers.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
