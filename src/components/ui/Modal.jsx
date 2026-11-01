import { useEffect } from 'react';
import { createPortal } from 'react-dom'; // 1. Import createPortal

const Modal = ({ isOpen, onClose, title, children, maxWidth = '420px', zIndex = 9999 }) => {
  // 1. Accessibility & UX: Handle Escape key and Scroll Locking
  useEffect(() => {
    if (!isOpen) return;

    // Lock background scrolling
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // Cleanup on unmount or close
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 2. Teleport the modal DOM nodes outside of the dashboard container
  return createPortal(
    <div
      className="modal-overlay"
      style={{ zIndex }}
      onClick={onClose}
      aria-hidden="true" // Hides the overlay itself from screen readers
    >
      <div
        className="modal-content card-ui"
        style={{ maxWidth, width: '100%' }} // Added width: 100% to ensure it respects the maxWidth properly
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          &times;
        </button>

        {title && (
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
        )}

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body // <-- This forces the modal to center relative to the browser window, ignoring the sidebar completely
  );
};

export default Modal;