import { useState } from 'react';
import Modal from '../../../components/ui/Modal';

export default function PaymentConfirmationModal({ isOpen, onClose, request, onSubmit, onReject }) {
  const [paymentProofSource, setPaymentProofSource] = useState(() => (
    request?.receiptUrl && request?.requestCopyUrl ? 'uploaded' : 'physical'
  ));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejectingProof, setIsRejectingProof] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const hasUploadedProof = Boolean(request?.receiptUrl && request?.requestCopyUrl);

  const handleSubmit = async () => {
    if (!request || isSubmitting) return;
    const isUploadedProof = paymentProofSource === 'uploaded';
    
    setIsSubmitting(true);
    try {
      const result = await onSubmit(request.id, {
        method: 'cash',
        amount: request.feeAmount,
        currency: request.feeCurrency || 'PHP',
        notes: isUploadedProof
          ? 'Cash payment proof and printed request verified from website upload'
          : 'Physical cash receipt and printed request verified by Registrar',
      });
      if (result) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!request || isSubmitting || !rejectionReason.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await onReject(request.id, rejectionReason.trim());
      if (result) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!isSubmitting) onClose(); }} title="Confirm payment" maxWidth="700px">
      {request && (
        <div className="payment-confirmation-dialog">
          <p className="payment-confirmation-code">
            Request code: <strong>{request.displayId || request.id}</strong>
          </p>
          <p className="payment-confirmation-context">
            Confirm that the cash payment for <strong>{request.studentName}</strong>&apos;s {request.docType} request has been received.
          </p>
          
          <fieldset className="payment-proof-source">
            <legend>How was the payment proof presented?</legend>
            <label>
              <input 
                type="radio" 
                value="physical" 
                checked={paymentProofSource === 'physical'} 
                onChange={() => setPaymentProofSource('physical')} 
                disabled={isSubmitting} 
              />
              <span>Shown physically</span>
            </label>
            <label>
              <input 
                type="radio" 
                value="uploaded" 
                checked={paymentProofSource === 'uploaded'} 
                onChange={() => setPaymentProofSource('uploaded')} 
                disabled={isSubmitting || !hasUploadedProof} 
              />
              <span>Uploaded on the website</span>
            </label>
          </fieldset>

          {isRejectingProof && (
            <div className="payment-proof-rejection">
              <label className="auth-label" htmlFor="payment-proof-rejection-reason">
                Reason for rejecting the uploaded proof
              </label>
              <textarea
                id="payment-proof-rejection-reason"
                className="auth-input"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                maxLength={240}
                minLength={3}
                rows={3}
                required
                disabled={isSubmitting}
                placeholder="Explain what needs to be corrected so the student can resubmit."
              />
            </div>
          )}

          {/* Restored and updated Image Preview Logic */}
          {paymentProofSource === 'uploaded' && (
            <div className="payment-proof-preview">
              <p>
                Uploaded request code: <strong>{request.displayId || request.id}</strong>
              </p>
              {request.orNumber && (
                <p>
                  O.R. No.: <strong>{request.orNumber}</strong>
                </p>
              )}
              
              {hasUploadedProof ? (
                <div className="payment-proof-preview-images">
                  {request.receiptUrl && (
                    <figure>
                      <a href={request.receiptUrl} target="_blank" rel="noreferrer">
                        <img
                          src={request.receiptUrl}
                          alt={`Uploaded cash receipt for request ${request.displayId || request.id}`}
                        />
                      </a>
                      <figcaption>Cash receipt</figcaption>
                    </figure>
                  )}
                  {request.requestCopyUrl && (
                    <figure>
                      <a href={request.requestCopyUrl} target="_blank" rel="noreferrer">
                        <img
                          src={request.requestCopyUrl}
                          alt={`Uploaded printed request copy for request ${request.displayId || request.id}`}
                        />
                      </a>
                      <figcaption>Printed request copy</figcaption>
                    </figure>
                  )}
                </div>
              ) : (
                <p className="payment-proof-preview-missing" role="alert">
                  No website-uploaded receipt and request copy are available for this request. Select “Shown physically” to continue.
                </p>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose} 
              disabled={isSubmitting}
            >
              Cancel
            </button>
            {hasUploadedProof && onReject && !isRejectingProof && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsRejectingProof(true)}
                disabled={isSubmitting}
              >
                Reject proof
              </button>
            )}
            {isRejectingProof ? (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsRejectingProof(false)}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleReject}
                  disabled={isSubmitting || rejectionReason.trim().length < 3}
                  style={{ backgroundColor: 'var(--danger, #b42318)' }}
                >
                  {isSubmitting ? 'Rejecting...' : 'Reject proof'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || (paymentProofSource === 'uploaded' && !hasUploadedProof)}
              >
                {isSubmitting ? 'Confirming...' : 'Confirm payment'}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}