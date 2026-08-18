import React, { useState, useCallback } from 'react';
import { useLanguage } from './useLanguage';

export const useConfirm = () => {
  const { language } = useLanguage();
  const [promise, setPromise] = useState<{ resolve: (value: boolean) => void } | null>(null);
  const [message, setMessage] = useState('');

  const confirm = useCallback((msg: string) => {
    return new Promise<boolean>((resolve) => {
      setMessage(msg);
      setPromise({ resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    promise?.resolve(true);
    setPromise(null);
  }, [promise]);

  const handleCancel = useCallback(() => {
    promise?.resolve(false);
    setPromise(null);
  }, [promise]);

  const ConfirmationDialog = useCallback(() => {
    if (!promise) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 transition-all">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl scale-100 transition-all">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {language === 'pt' ? 'Atenção' : 'Attention'}
          </h3>
          <p className="text-gray-600 mb-6 text-sm">{message}</p>
          <div className="flex justify-end gap-3">
            <button 
              onClick={handleCancel} 
              className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
            >
              {language === 'pt' ? 'Cancelar' : 'Cancel'}
            </button>
            <button 
              onClick={handleConfirm} 
              className="px-5 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
            >
              {language === 'pt' ? 'Confirmar' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [promise, message, language, handleCancel, handleConfirm]);

  return { confirm, ConfirmationDialog };
};
