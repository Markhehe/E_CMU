import { useState, useEffect } from 'react';
import Modal from '../../../components/ui/Modal';

const DIRECT_STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_for_pickup', label: 'For pickup' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'clearance_review', label: 'Clearance review' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ChangeStatusModal({ isOpen, onClose, request, onSubmit }) {
  const [selectedNextStatus, setSelectedNextStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen && request) {
      setSelectedNextStatus(request.rawStatus);
    }
  }, [isOpen, request]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!request || !selectedNextStatus || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(request.id, selectedNextStatus);
      onClose(); // Only close on success
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!isSubmitting) onClose(); }} title="Change request status">
      {request && (
        <form className="auth-form" onSubmit={handleSubmit}>
          <p>
            Change status for request <strong>{request.displayId || request.id}</strong>.
          </p>
          <p className="doc-meta">
            This directly changes the request status and records it in the history. It does not record a payment or send a pickup email.
          </p>
          <label className="auth-label" htmlFor="request-status-selection">New status</label>
          <select
            id="request-status-selection"
            className="auth-input"
            value={selectedNextStatus}
            onChange={(e) => setSelectedNextStatus(e.target.value)}
            disabled={isSubmitting}
            required
          >
            <option value="" disabled>Select a status</option>
            {DIRECT_STATUS_OPTIONS.map(({ value, label }) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          <div className="workflow-inline-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || selectedNextStatus === request.rawStatus}>
              {isSubmitting ? 'Updating...' : 'Update status'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}