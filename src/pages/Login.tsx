import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User as AppUser } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { Users, User as UserIcon, LogIn, Mail, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { loadReCaptcha, executeReCaptcha } from '../lib/recaptcha';

export default function Login() {
  const { signIn, signInWithEmail, signUpWithEmail, user, isAdmin, isStaff, isCustomer, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const mode = queryParams.get('mode');
  const roleParam = queryParams.get('role');

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

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  
  const [activeForm, setActiveForm] = useState<'customer' | 'staff' | null>(() => {
    if (roleParam === 'customer' || roleParam === 'staff') {
      return roleParam;
    }
    return null;
  });

  const [isNewUser, setIsNewUser] = useState(mode === 'signup');

  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      loadReCaptcha(siteKey);
    }
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const r = params.get('role');
    const m = params.get('mode');
    if (r === 'customer' || r === 'staff') {
      setActiveForm(r);
    } else {
      setActiveForm(null);
    }
    setIsNewUser(m === 'signup');
  }, [location.search]);

  const handleCancel = () => {
    setActiveForm(null);
    navigate('/login', { replace: true });
  };

  const resetForms = () => {
    setCustomerEmail('');
    setCustomerPassword('');
    setStaffEmail('');
    setStaffPassword('');
    setConfirmPassword('');
    setName('');
    setIsNewUser(false);
  };
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user && !authLoading) {
      // Determine default destination
      let destination = '/';
      if (isCustomer) {
        destination = '/my-bookings';
      } else if (isStaff) {
        destination = '/admin';
      }

      // Check if 'from' path is accessible by the user
      const from = (location.state as any)?.from?.pathname;
      if (from) {
        const isAdminPath = from.startsWith('/admin/users') || from.startsWith('/admin/settings');
        const isStaffPath = from.startsWith('/admin');
        
        // Only allow redirect to admin/settings or admin/users if user is actually an admin
        if (isAdminPath) {
          if (isAdmin) destination = from;
          else destination = '/admin'; // Redirect staff to dashboard if they tried to access admin-only page
        } else if (isStaffPath) {
          if (isStaff) destination = from;
        } else if (from === '/my-bookings') {
          if (user.role === 'customer' || isStaff) destination = from;
        }
      }

      navigate(destination, { replace: true });
    }
  }, [user, isAdmin, isStaff, isCustomer, authLoading, navigate, location]);

  const handleGoogleSignIn = async (role: 'staff' | 'customer') => {
    try {
      await signIn(role, role === 'customer' ? isNewUser : false);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await executeReCaptcha(isNewUser ? 'signup' : 'login');
      if (!token || token === 'error-token') {
        toast.error(t('captcha.robot_alert') || 'Please complete the reCAPTCHA verification check.');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('reCAPTCHA failed:', err);
    }
    
    const email = activeForm === 'customer' ? customerEmail : staffEmail;
    const password = activeForm === 'customer' ? customerPassword : staffPassword;

    try {
      if (isNewUser) {
        if (password !== confirmPassword) {
          toast.error(t('common.password_mismatch'));
          setLoading(false);
          return;
        }
        // Save intended role so the Auth listener knows what to set
        localStorage.setItem('intendedRole', activeForm || 'customer');
        await signUpWithEmail(email, password, name);
      } else {
        // Save intended role so the Auth listener can validate it
        localStorage.setItem('intendedRole', activeForm || 'customer');
        await signInWithEmail(email, password);
      }
    } catch (error: any) {
      console.error('Auth failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading && !activeForm && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-600 border-t-transparent shadow-md"></div>
          <p className="text-gray-500 font-medium animate-pulse">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gray-900 mb-4">
          {mode === 'signup' ? t('login.signup_title') : t('login.title')}
        </h1>
        <p className="text-gray-500 max-w-md mx-auto">
          {mode === 'signup' ? t('login.signup_desc') : t('login.desc')}
        </p>
      </div>

      <div className="max-w-4xl w-full flex justify-center">
        <div className={cn(
          "w-full",
          activeForm === null ? "grid grid-cols-1 md:grid-cols-2 gap-8" : "max-w-md"
        )}>
          {/* Customer Login/Signup Card */}
          {(activeForm === null || activeForm === 'customer') && (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center text-center group hover:border-amber-200 transition-all w-full">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <UserIcon size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {mode === 'signup' ? t('login.signup_title') : t('login.customer')}
              </h2>
              
              {activeForm !== 'customer' ? (
                <div className="w-full space-y-3">
                  <p className="text-gray-500 mb-8 flex-grow">
                    {mode === 'signup' ? t('login.signup_desc') : t('login.customer_desc')}
                  </p>
                  <button
                    onClick={() => handleGoogleSignIn('customer')}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
                  >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    Google
                  </button>
                  <button
                    onClick={() => {
                      resetForms();
                      setActiveForm('customer');
                      setIsNewUser(mode === 'signup');
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg"
                  >
                    <LogIn size={20} />
                    Email & Password
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailAuth} className="w-full space-y-4">
                  {isNewUser && (
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        required
                        type="text"
                        maxLength={50}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                        placeholder={t('common.name')}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="email"
                      maxLength={100}
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                      placeholder={t('common.email')}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="password"
                      minLength={6}
                      maxLength={12}
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 12, t('common.password'))}
                      placeholder={isNewUser ? t('common.password') : t('common.password')}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                  </div>
                  {isNewUser && (
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        required
                        type="password"
                        minLength={6}
                        maxLength={12}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 12, t('common.confirm_password'))}
                        placeholder={t('common.confirm_password')}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      disabled={loading}
                      type="submit"
                      className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg"
                    >
                      {loading ? t('common.loading') : (isNewUser ? t('nav.signup') : t('nav.login'))}
                    </button>
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase">{t('common.or')}</span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGoogleSignIn('customer')}
                      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
                    >
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                      {isNewUser ? t('login.google_signup') : t('login.google')}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-gray-500 text-sm font-medium hover:text-gray-700 mt-2"
                    >
                      {t('common.cancel')}
                    </button>
                    {!isNewUser && (
                      <button
                        type="button"
                        onClick={() => setIsNewUser(true)}
                        className="text-amber-600 text-xs font-semibold hover:underline"
                      >
                        {t('login.no_account')}
                      </button>
                    )}
                    {isNewUser && (
                      <button
                        type="button"
                        onClick={() => setIsNewUser(false)}
                        className="text-amber-600 text-xs font-semibold hover:underline"
                      >
                        {t('login.have_account')}
                      </button>
                    )}

                    {/* Google reCAPTCHA v3 Compliance Notice */}
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 mt-2 border-t border-gray-100 pt-3">
                      <ShieldCheck size={14} className="text-amber-600 animate-pulse" />
                      <span>{language === 'pt' ? 'Protegido por Google reCAPTCHA v3' : 'Protected by Google reCAPTCHA v3'}</span>
                      <span>•</span>
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="hover:underline">Privacy</a>
                      <span>•</span>
                      <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="hover:underline">Terms</a>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Staff Login Card */}
          {(activeForm === null || activeForm === 'staff') && (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center text-center group hover:border-blue-200 transition-all w-full">
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('login.staff')}</h2>
              
              {activeForm !== 'staff' ? (
                <div className="w-full space-y-3">
                  <p className="text-gray-500 mb-8 flex-grow">
                    {t('login.staff_desc')}
                  </p>
                  <button
                    onClick={() => handleGoogleSignIn('staff')}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
                  >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    Google
                  </button>
                  <button
                    onClick={() => {
                      resetForms();
                      setActiveForm('staff');
                      setIsNewUser(false);
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg"
                  >
                    <LogIn size={20} />
                    Email & Password
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailAuth} className="w-full space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="email"
                      maxLength={100}
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                      placeholder={t('common.email')}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="password"
                      maxLength={12}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 12, t('common.password'))}
                      placeholder={t('common.password')}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      disabled={loading}
                      type="submit"
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
                    >
                      {loading ? t('common.loading') : t('nav.login')}
                    </button>
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase">{t('common.or')}</span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGoogleSignIn('staff')}
                      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
                    >
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                      {t('login.google')}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-gray-500 text-sm font-medium hover:text-gray-700 mt-2"
                    >
                      {t('common.cancel')}
                    </button>

                    {/* Google reCAPTCHA v3 Compliance Notice */}
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 mt-2 border-t border-gray-100 pt-3">
                      <ShieldCheck size={14} className="text-amber-600 animate-pulse" />
                      <span>{language === 'pt' ? 'Protegido por Google reCAPTCHA v3' : 'Protected by Google reCAPTCHA v3'}</span>
                      <span>•</span>
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="hover:underline">Privacy</a>
                      <span>•</span>
                      <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="hover:underline">Terms</a>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
