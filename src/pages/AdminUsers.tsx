import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { User, Shield, ShieldAlert, Trash2, Mail, Plus, X, CheckCircle2, AlertCircle, Key, Send, Pencil , MoreVertical, Settings, Lock, Unlock } from 'lucide-react';
import { cn } from '../lib/utils';
import { User as UserType } from '../types';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown';

export default function AdminUsers() {
  const { users, updateUserRole, updateUserStatus, updateUser, addUser, deleteUser, loading } = useUsers();
  const { isAdmin, user: currentUser, updatePassword, resetPassword } = useAuth();
  const { settings } = useSettings();
  const { t, language } = useLanguage();

  const roleOptions: DropdownOption[] = [
    {
      value: 'staff',
      label: t('common.staff'),
      icon: <ShieldAlert size={16} className="text-gray-500" />
    },
    {
      value: 'admin',
      label: t('common.admin'),
      icon: <Shield size={16} className="text-amber-600" />
    }
  ];

  const statusOptions: DropdownOption[] = [
    {
      value: 'active',
      label: t('common.active'),
      colorDot: 'bg-green-500',
      icon: <CheckCircle2 size={16} className="text-green-500" />
    },
    {
      value: 'inactive',
      label: t('common.inactive'),
      colorDot: 'bg-red-500',
      icon: <AlertCircle size={16} className="text-red-500" />
    }
  ];

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserType | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    status: 'active' as 'active' | 'inactive',
    staffNumber: ''
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [customDomain, setCustomDomain] = useState(() => localStorage.getItem('customUserDomain') || '@reservations.com');

  useEffect(() => {
    localStorage.setItem('customUserDomain', customDomain);
  }, [customDomain]);


  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDomainLocked, setIsDomainLocked] = useState(true);
  const settingsDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff' as 'admin' | 'staff',
    status: 'active' as 'active' | 'inactive',
    staffNumber: ''
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin');
    }
  }, [isAdmin, navigate]);

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isAdmin) return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.password !== newUser.confirmPassword) {
      toast.error(t('common.password_mismatch'));
      return;
    }
    const staffNum = newUser.staffNumber || (users.length + 1).toString().padStart(3, '0');
    const isDuplicate = users.some(u => u.staffNumber === staffNum);
    if (isDuplicate) {
      toast.error(
        language === 'pt'
          ? 'Este ID de Staff já está em uso!'
          : 'This Staff ID is already in use!'
      );
      return;
    }
    const suffix = customDomain.includes('.') ? customDomain : `${customDomain}.com`;
    const finalEmail = `${newUser.email}${suffix}`;
    const isEmailDuplicate = users.some(u => u.email.toLowerCase() === finalEmail.toLowerCase());
    if (isEmailDuplicate) {
      toast.error(
        language === 'pt'
          ? 'Este e-mail já está associado a outra conta!'
          : 'This email is already associated with another account!'
      );
      return;
    }
    try {
      await addUser({
        name: newUser.name,
        email: finalEmail,
        role: newUser.role,
        status: newUser.status,
        staffNumber: staffNum
      }, newUser.password);
      setIsModalOpen(false);
      setNewUser({ name: '', email: '', password: '', confirmPassword: '', role: 'staff', status: 'active', staffNumber: '' });
      toast.success(
        language === 'pt'
          ? 'Conta de staff criada com sucesso!'
          : 'Staff account created successfully!'
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t('public.error_desc'));
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    const staffNum = editForm.staffNumber;
    const isDuplicate = users.some(u => u.id !== userToEdit.id && u.staffNumber === staffNum);
    if (isDuplicate) {
      toast.error(
        language === 'pt'
          ? 'Este ID de Staff já está em uso!'
          : 'This Staff ID is already in use!'
      );
      return;
    }
    const suffix = customDomain.includes('.') ? customDomain : `${customDomain}.com`;
    const finalEmail = `${editForm.email}${suffix}`;
    const isEmailDuplicate = users.some(u => u.id !== userToEdit.id && u.email.toLowerCase() === finalEmail.toLowerCase());
    if (isEmailDuplicate) {
      toast.error(
        language === 'pt'
          ? 'Este e-mail já está associado a outra conta!'
          : 'This email is already associated with another account!'
      );
      return;
    }

    if (editPassword) {
      if (editPassword !== editConfirmPassword) {
        toast.error(t('common.password_mismatch'));
        return;
      }
      if (editPassword.length < 6) {
        toast.error(
          language === 'pt'
            ? 'A palavra-passe deve ter pelo menos 6 caracteres'
            : 'Password must be at least 6 characters'
        );
        return;
      }

      if (userToEdit.id === currentUser?.id) {
        try {
          await updatePassword(editPassword);
        } catch (error: any) {
          return;
        }
      } else {
        try {
          const res = await fetch('/api/admin/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userToEdit.id, newPassword: editPassword })
          });
          const data = await res.json();
          if (!data.success) {
            if (data.error && data.error.includes('identitytoolkit.googleapis.com')) {
              toast.error(language === 'pt' ? 'Deve iniciar sessão como o utilizador correspondente para alterar a palavra-passe.' : 'You must be logged in as the related user to change the password.', { duration: 6000 });
            } else {
              toast.error(data.error || (language === 'pt' ? 'Erro ao alterar a palavra-passe' : 'Failed to update user password'));
            }
            return;
          }
        } catch (pwErr: any) {
          console.error('Password change error:', pwErr);
          toast.error(pwErr.message || (language === 'pt' ? 'Erro ao alterar a palavra-passe' : 'Failed to update user password'));
          return;
        }
      }
    }

    try {
      await updateUser(userToEdit.id, {
        name: editForm.name,
        email: finalEmail,
        role: editForm.role,
        status: editForm.status,
        staffNumber: staffNum
      });
      setIsEditModalOpen(false);
      setUserToEdit(null);
      setEditPassword('');
      setEditConfirmPassword('');
      toast.success(
        language === 'pt'
          ? 'Utilizador atualizado com sucesso!'
          : 'User updated successfully!'
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t('public.error_desc'));
    }
  };

  const handleResetPassword = async (email: string) => {
    if (confirm(`Send password reset email to ${email}?`)) {
      try {
        await resetPassword(email);
      } catch (error: any) {
        console.error(error);
      }
    }
  };

  // Sort users: Current user first, then by staffNumber (smallest to largest)
  const sortedUsers = [...users].map((u, index) => ({
    ...u,
    displayId: u.staffNumber || (index + 1).toString().padStart(3, '0')
  })).sort((a, b) => {
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;
    const aId = parseInt(a.displayId, 10) || 9999;
    const bId = parseInt(b.displayId, 10) || 9999;
    return aId - bId;
  });

  return (
    <div className={cn("mx-auto py-8 px-4 sm:px-6 lg:px-8", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "max-w-5xl")}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('nav.users')}</h1>
          <p className="text-gray-500">{t('dashboard.manage_staff')}</p>
        </div>
        <div className="flex flex-row gap-3 items-center">
          
          <div className="relative" ref={settingsDropdownRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <MoreVertical size={20} />
            </button>
            
            <AnimatePresence>{isSettingsOpen && (
              <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }} transition={{ duration: 0.15, ease: "easeOut" }} className="absolute right-0 mt-2 w-[280px] bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50">
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Settings size={16} className="text-amber-600" />
                  {language === 'pt' ? 'Configurações de Login' : 'Login Settings'}
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      {language === 'pt' ? 'Sufixo de Domínio' : 'Domain Suffix'}
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={customDomain} 
                        onChange={e => setCustomDomain(e.target.value)}
                        placeholder="@reservations.com"
                        readOnly={isDomainLocked}
                        className={`w-full pl-3 pr-9 py-2 text-sm outline-none rounded-lg border transition-all ${isDomainLocked ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-default' : 'bg-white border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-gray-900 shadow-inner'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setIsDomainLocked(!isDomainLocked)}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${isDomainLocked ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-200' : 'text-amber-600 hover:bg-amber-50'}`}
                      >
                        {isDomainLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>)}</AnimatePresence></div>
          <button onClick={() => {
              const nextId = (users.length + 1).toString().padStart(3, '0');
              setNewUser(prev => ({ ...prev, staffNumber: nextId }));
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            {t('common.add_user')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 w-24">ID</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t('nav.users')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t('common.role')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t('common.status')}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUsers.map((u) => {
                const displayId = u.displayId;
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 bg-amber-50 text-amber-800 text-xs font-bold font-mono rounded-lg border border-amber-200/50">
                        {displayId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{u.name || u.email.split('@')[0]}</span>
                        <span className="text-xs text-gray-500">{u.email}</span>
                        {u.createdAt && (
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            Joined: {u.createdAt.toDate ? format(u.createdAt.toDate(), 'dd/MM/yyyy') : format(new Date(u.createdAt), 'dd/MM/yyyy')}
                          </span>
                        )}
                        {u.id === currentUser?.id && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[10px] font-bold uppercase mt-1 w-fit">
                            {language === 'pt' ? 'Sessão Iniciada' : 'Logged In'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.role === 'admin' ? (
                        <Shield className="text-amber-600" size={16} />
                      ) : (
                        <ShieldAlert className="text-gray-400" size={16} />
                      )}
                      <select 
                        value={u.role}
                        disabled={u.id === currentUser?.id}
                        onChange={(e) => updateUserRole(u.id, e.target.value as 'admin' | 'staff')}
                        className={cn(
                          "text-sm font-medium border-none bg-transparent focus:ring-0 p-0 outline-none cursor-pointer",
                          u.role === 'admin' ? "text-amber-700" : "text-gray-600"
                        )}
                      >
                        <option value="admin">{t('common.admin')}</option>
                        <option value="staff">{t('common.staff')}</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.status === 'active' ? (
                        <CheckCircle2 className="text-green-500" size={16} />
                      ) : (
                        <AlertCircle className="text-red-400" size={16} />
                      )}
                      <select 
                        value={u.status || 'active'}
                        disabled={u.id === currentUser?.id}
                        onChange={(e) => updateUserStatus(u.id, e.target.value as 'active' | 'inactive')}
                        className={cn(
                          "text-sm font-medium border-none bg-transparent focus:ring-0 p-0 outline-none cursor-pointer",
                          u.status === 'active' ? "text-green-700" : "text-red-600"
                        )}
                      >
                        <option value="active">{t('common.active')}</option>
                        <option value="inactive">{t('common.inactive')}</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setUserToEdit(u);
                          let emailPart = u.email || '';
                          const currentSuffix = customDomain.includes('.') ? customDomain : `${customDomain}.com`;
                          if (currentSuffix && emailPart.toLowerCase().endsWith(currentSuffix.toLowerCase())) {
                            emailPart = emailPart.slice(0, -currentSuffix.length);
                          }
                          setEditForm({
                            name: u.name || '',
                            email: emailPart,
                            role: u.role as 'admin' | 'staff',
                            status: u.status || 'active',
                            staffNumber: u.staffNumber || displayId
                          });
                          setEditPassword('');
                          setEditConfirmPassword('');
                          setIsEditModalOpen(true);
                        }}
                        title={language === 'pt' ? 'Editar Utilizador' : 'Edit User'}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        disabled={u.id === currentUser?.id}
                        onClick={() => {
                          setUserToDelete(u);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-lg font-bold text-gray-900">{t('common.new_user')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.name')}</label>
                <input
                  required
                  type="text"
                  maxLength={50}
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                  placeholder="John Doe"
                />
              </div>

              {/* Email and Staff ID side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.email')}</label>
                  <div className="relative flex items-center">
                    <input
                      required
                      type="text"
                      maxLength={100}
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value.replace(/\s/g, '') })}
                      onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white pr-[100px]"
                      placeholder="john"
                    />
                    <span className="absolute right-3 text-xs text-gray-400 pointer-events-none truncate max-w-[90px]">
                      {customDomain}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    {language === 'pt' ? 'ID do Staff (ex: 001)' : 'Staff ID (e.g., 001)'}
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={10}
                    value={newUser.staffNumber}
                    onChange={(e) => setNewUser({ ...newUser, staffNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-mono font-medium text-gray-900 bg-white"
                    placeholder="001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.password')}</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    maxLength={12}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, 12, t('common.password'))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.confirm_password')}</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    maxLength={12}
                    value={newUser.confirmPassword}
                    onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, 12, t('common.confirm_password'))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <p className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                {language === 'pt'
                  ? 'Assim que criada, a conta pode iniciar sessão imediatamente com este e-mail e palavra-passe.'
                  : 'Once created, the user can log in immediately using this email and password.'}
              </p>

              {/* Role and Status custom dropdowns side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <CustomDropdown
                    label={t('common.role')}
                    value={newUser.role}
                    onChange={(val) => setNewUser({ ...newUser, role: val as 'admin' | 'staff' })}
                    options={roleOptions}
                    buttonClassName="bg-white hover:bg-gray-50 border-gray-300"
                  />
                </div>
                <div>
                  <CustomDropdown
                    label={t('common.status')}
                    value={newUser.status}
                    onChange={(val) => setNewUser({ ...newUser, status: val as 'active' | 'inactive' })}
                    options={statusOptions}
                    buttonClassName="bg-white hover:bg-gray-50 border-gray-300"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-sm"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Edit User Modal */}
      {isEditModalOpen && userToEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-lg font-bold text-gray-900">{t('common.edit_user') || 'Edit User'}</h3>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setUserToEdit(null);
                  setEditPassword('');
                  setEditConfirmPassword('');
                }} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.name')}</label>
                <input
                  required
                  type="text"
                  maxLength={50}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                  placeholder="John Doe"
                />
              </div>

              {/* Email and Staff ID side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.email')}</label>
                  <div className="relative flex items-center">
                    <input
                      required
                      type="text"
                      maxLength={100}
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value.replace(/\s/g, '') })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white pr-[100px]"
                      placeholder="john"
                    />
                    <span className="absolute right-3 text-xs text-gray-400 pointer-events-none truncate max-w-[90px]">
                      {customDomain}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    {language === 'pt' ? 'ID do Staff (ex: 001)' : 'Staff ID (e.g., 001)'}
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={10}
                    value={editForm.staffNumber}
                    onChange={(e) => setEditForm({ ...editForm, staffNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-mono font-medium text-gray-900 bg-white"
                    placeholder="001"
                  />
                </div>
              </div>

              {/* Role and Status custom dropdowns side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <CustomDropdown
                    label={t('common.role')}
                    disabled={userToEdit.id === currentUser?.id}
                    value={editForm.role}
                    onChange={(val) => setEditForm({ ...editForm, role: val as 'admin' | 'staff' })}
                    options={roleOptions}
                    buttonClassName={cn("bg-white hover:bg-gray-50 border-gray-300", userToEdit.id === currentUser?.id && "!bg-white opacity-60")}
                  />
                </div>
                <div>
                  <CustomDropdown
                    label={t('common.status')}
                    disabled={userToEdit.id === currentUser?.id}
                    value={editForm.status}
                    onChange={(val) => setEditForm({ ...editForm, status: val as 'active' | 'inactive' })}
                    options={statusOptions}
                    buttonClassName={cn("bg-white hover:bg-gray-50 border-gray-300", userToEdit.id === currentUser?.id && "!bg-white opacity-60")}
                  />
                </div>
              </div>

              {/* Change Password Section */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                  <Key size={16} className="text-amber-600" />
                  {t('common.change_password')}
                </h4>
                <p className="text-[11px] text-gray-500 mb-3">
                  {language === 'pt' 
                    ? 'Deixe em branco para manter a palavra-passe atual.' 
                    : 'Leave blank to keep the current password.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.new_password')}</label>
                    <input
                      type="password"
                      minLength={6}
                      maxLength={12}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 12, t('common.new_password'))}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.confirm_new_password')}</label>
                    <input
                      type="password"
                      minLength={6}
                      maxLength={12}
                      value={editConfirmPassword}
                      onChange={(e) => setEditConfirmPassword(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 12, t('common.confirm_new_password'))}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setUserToEdit(null);
                    setEditPassword('');
                    setEditConfirmPassword('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-sm"
                >
                  {t('common.save') || 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {t('users.delete_title') || t('common.delete')}
              </h3>
              <p className="text-gray-500 mb-6">
                {t('users.delete_confirm') || `${t('common.delete')} ${userToDelete.name || userToDelete.email}?`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setUserToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={async () => {
                    if (userToDelete) {
                      await deleteUser(userToDelete.id);
                      setIsDeleteModalOpen(false);
                      setUserToDelete(null);
                      toast.success(t('res.delete_success'));
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
