import { createContext, useContext, useState, useCallback } from 'react';
import ToastContainer from '../components/ui/ToastContainer';

const ToastContext = createContext(null);
const MAX_VISIBLE_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Step 2: Instantly deletes the toast from the DOM (called after animation finishes)
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Step 1: Marks the toast for deletion so it plays the exit animation
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.map(t => 
      t.id === id ? { ...t, isClosing: true } : t
    ));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast = { id, message, type, duration, isClosing: false };

    setToasts((prev) => {
      const activeToasts = prev.filter(t => !t.isClosing);
      let nextToasts = [...prev, newToast];

      // If we exceed the max, gracefully dismiss the oldest active toast
      if (activeToasts.length >= MAX_VISIBLE_TOASTS) {
        const oldestId = activeToasts[0].id;
        nextToasts = nextToasts.map(t => 
          t.id === oldestId ? { ...t, isClosing: true } : t
        );
      }
      return nextToasts;
    });
  }, []);

  return (
    // We expose `dismissToast` as `removeToast` so the rest of your app gets the animation automatically
    <ToastContext.Provider value={{ addToast, removeToast: dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};