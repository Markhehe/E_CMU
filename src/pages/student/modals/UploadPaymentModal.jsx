import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../contexts/ToastContext';
import { DocumentService } from '../../../services/api';

export default function UploadPaymentModal({ isOpen, onClose, request, onSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [requestCopyFile, setRequestCopyFile] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [trackingCode, setTrackingCode] = useState(request?.displayId || '');
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToast();

  const handleFileChange = (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict UI Validation (Moved from API layer)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      addToast('Upload must be a PNG, JPEG, or WebP image.', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      addToast('Each image must be 2.5 MB or smaller.', 'error');
      e.target.value = '';
      return;
    }

    if (kind === 'receipt') {
      setSelectedFile(file);
    } else {
      setRequestCopyFile(file);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !requestCopyFile || !request) return;

    setIsUploading(true);
    try {
      await DocumentService.submitPaymentDetails(request.id, {
        paymentReference,
        receiptFile: selectedFile,
        requestCopyFile,
        trackingCode,
      });
      addToast('Payment receipt submitted for Registrar verification.', 'success');
      
      // Reset State & Close
      setSelectedFile(null);
      setRequestCopyFile(null);
      setPaymentReference('');
      if (onSuccess) await onSuccess();
      onClose();
    } catch (error) {
      addToast(error.message || 'Failed to submit payment proof.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!isUploading) onClose(); }} title="Upload Cash Payment Proof" maxWidth="520px">
      {request && (
        <form className="modal-form" onSubmit={handleUploadSubmit}>
          <p className="modal-text">Pay cash at the Finance Office. Upload both the receipt and the printed request form.</p>
          
          <label className="auth-label" htmlFor="trackingCode">Request tracking code</label>
          <input
            id="trackingCode"
            className="auth-input"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
            maxLength={6}
            pattern="[A-Fa-f0-9]{6}"
            required
            disabled={isUploading}
          />
          
          <label className="auth-label" htmlFor="requestCopyFile">Printed request copy</label>
          <input
            id="requestCopyFile"
            type="file"
            className="cash-payment-file-input"
            accept="image/png,image/jpeg,image/webp"
            required
            disabled={isUploading}
            onChange={(e) => handleFileChange(e, 'request')}
          />
          
          <label className="auth-label" htmlFor="paymentReceiptFile">Cash receipt</label>
          <input
            id="paymentReceiptFile"
            type="file"
            className="cash-payment-file-input"
            accept="image/png,image/jpeg,image/webp"
            required
            disabled={isUploading}
            onChange={(e) => handleFileChange(e, 'receipt')}
          />
          
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isUploading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isUploading || !selectedFile || !requestCopyFile}>
              {isUploading ? 'Uploading...' : 'Submit Proof'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}