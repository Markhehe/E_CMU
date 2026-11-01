import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../contexts/ToastContext';
import { DocumentService } from '../../../services/api';

export default function DeleteRequestModal({ isOpen, onClose, request, onSuccess }) {
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const { addToast } = useToast();

  const handleDelete = async () => {
    if (!request || isDeletingRequest) return;

    setIsDeletingRequest(true);
    try {
      await DocumentService.deletePendingRequest(request.id);
      addToast('Request deleted.', 'success');
      if (onSuccess) await onSuccess();
      onClose();
    } catch (error) {
      addToast(error.message || 'Failed to delete the request.', 'error');
    } finally {
      setIsDeletingRequest(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeletingRequest) onClose();
      }}
      title="Delete request?"
    >
      {request && (
        <>
          <p className="modal-text">
            Delete request <strong>{request.displayId || request.id}</strong>? This action cannot be undone.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isDeletingRequest}
            >
              Keep request
            </button>
            <button
              type="button"
              className="btn-danger" 
              onClick={handleDelete}
              disabled={isDeletingRequest}
            >
              {isDeletingRequest ? 'Deleting...' : 'Delete request'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}