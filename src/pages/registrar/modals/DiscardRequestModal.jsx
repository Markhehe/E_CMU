import { useState } from 'react';
import Modal from '../../../components/ui/Modal';

export default function DiscardRequestModal({ isOpen, onClose, request, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDiscard = async () => {
    if (!request || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(request.id, 'rejected');
      onClose(); // Only close on success
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!isSubmitting) onClose(); }} title="Discard Request?">
      {request && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Are you sure you want to discard request{' '}
            <strong>{request.displayId || request.id}</strong>? The request will be marked as rejected.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isSubmitting}
              onClick={handleDiscard}
              style={{ backgroundColor: 'var(--danger, #b42318)' }}
            >
              {isSubmitting ? 'Discarding...' : 'Discard Request'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}