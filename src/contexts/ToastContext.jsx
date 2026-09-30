// src/contexts/ToastContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
import ToastContainer from '../components/ui/ToastContainer';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // useCallback prevents React from recreating this function every render
  const addToast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9); // Generate random ID
    
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss the toast after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* 
        Placing the container here ensures it sits at the absolute 
        root of your app, acting globally. 
      */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// Custom hook so any file can just call `const { addToast } = useToast();`
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};