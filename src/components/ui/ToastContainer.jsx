import { useEffect } from 'react';
import './toast.css';

function ToastItem({ toast, dismissToast, removeToast }) {
  useEffect(() => {
    let timer;
    if (toast.isClosing) {
      // If marked for closing, wait 300ms for the animation to finish, then delete
      timer = setTimeout(() => removeToast(toast.id), 300);
    } else if (toast.duration > 0) {
      // Normal auto-dismiss timer
      timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    }
    
    return () => clearTimeout(timer);
  }, [toast, dismissToast, removeToast]);

  return (
    <div 
      className={`toast ${toast.type} ${toast.isClosing ? 'toast-exit' : ''}`} 
      role="alert"
    >
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={() => dismissToast(toast.id)}
        aria-label="Close notification"
      >
        &times;
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, dismissToast, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          dismissToast={dismissToast} 
          removeToast={removeToast} 
        />
      ))}
    </div>
  );
}