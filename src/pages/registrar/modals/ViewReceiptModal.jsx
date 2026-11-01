import Modal from '../../../components/ui/Modal';

export default function ViewReceiptModal({ isOpen, onClose, request }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Proof of Payment" maxWidth="750px">
      {request && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <p className="modal-text" style={{ margin: 0, textAlign: 'center' }}>
            Payment proof for request <strong>{request.displayId || request.id}</strong>
          </p>
          {request.paymentReference && (
            <p className="modal-text" style={{ margin: 0 }}>
              Payment reference: <strong>{request.paymentReference}</strong>
            </p>
          )}
          
          {/* Layout for showing both images */}
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', width: '100%', flexWrap: 'wrap', marginTop: '1rem' }}>
            {request.receiptUrl && (
              <figure style={{ margin: 0, flex: '1 1 300px', textAlign: 'center' }}>
                <a href={request.receiptUrl} target="_blank" rel="noreferrer">
                  <img
                    src={request.receiptUrl}
                    alt="Cash receipt"
                    style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: '6px', border: '1px solid #eaeaea' }}
                  />
                </a>
                <figcaption style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Cash receipt</figcaption>
              </figure>
            )}
            
            {request.requestCopyUrl && (
              <figure style={{ margin: 0, flex: '1 1 300px', textAlign: 'center' }}>
                <a href={request.requestCopyUrl} target="_blank" rel="noreferrer">
                  <img
                    src={request.requestCopyUrl}
                    alt="Printed request copy"
                    style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: '6px', border: '1px solid #eaeaea' }}
                  />
                </a>
                <figcaption style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Printed request copy</figcaption>
              </figure>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}