import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import BackToTop from './BackToTop';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDocumentMode = location.pathname.includes('/print/section-document');
  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  
  return (
    <div className={cn(
      "min-h-screen flex flex-col transition-colors duration-300",
      isDocumentMode ? "bg-white text-gray-900" : (settings?.theme === 'dark' ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900")
    )}>
      {!isDocumentMode && <Navbar />}
      <main className={cn(
        "flex-grow transition-all duration-300",
        isDocumentMode ? "pt-0 bg-white" : (isAdmin ? "pt-24" : "pt-16")
      )}>
        {children}
      </main>
      {!isDocumentMode && <Footer />}
      {!isDocumentMode && <BackToTop />}
    </div>
  );
}
