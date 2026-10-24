import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { DocumentService } from '../../services/api';

function WalkInRequestModal({ isOpen, onClose, onCreated }) {
  const [studentId, setStudentId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    DocumentService.getDocumentCatalog()
      .then((documents) => {
        if (isCurrent) setCatalog(documents);
      })
      .catch((error) => addToast(error.message || 'Failed to load documents.', 'error'));
    return () => {
      isCurrent = false;
    };
  }, [isOpen, addToast]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await DocumentService.createWalkInRequest({
        studentId: studentId.trim(),
        documentTypeId,
        purpose: purpose.trim(),
        quantity: Number(quantity),
      });
      addToast(`Walk-in request ${result.request.display_code} submitted.`, 'success');
      setStudentId('');
      setDocumentTypeId('');
      setPurpose('');
      setQuantity(1);
      onCreated();
      onClose();
    } catch (error) {
      addToast(error.message || 'Failed to enter walk-in request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enter Walk-in Request" maxWidth="560px">
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="modal-text">Confirm the student has verified clearance before entering a walk-in request.</p>
        <label className="auth-label" htmlFor="walkin-student-id">Student ID</label>
        <input
          id="walkin-student-id"
          className="auth-input"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          maxLength={64}
          required
          disabled={isSubmitting}
        />
        <label className="auth-label" htmlFor="walkin-document">Document</label>
        <select
          id="walkin-document"
          className="auth-input"
          value={documentTypeId}
          onChange={(event) => setDocumentTypeId(event.target.value)}
          required
          disabled={isSubmitting}
        >
          <option value="">Select a document</option>
          {catalog.map((document) => (
            <option key={document.id} value={document.id}>{document.name}</option>
          ))}
        </select>
        <label className="auth-label" htmlFor="walkin-purpose">Purpose</label>
        <textarea
          id="walkin-purpose"
          className="auth-input"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          maxLength={2000}
          rows={3}
          required
          disabled={isSubmitting}
        />
        <label className="auth-label" htmlFor="walkin-quantity">Quantity</label>
        <input
          id="walkin-quantity"
          className="auth-input"
          type="number"
          min={1}
          max={10}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
          disabled={isSubmitting}
        />
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting || catalog.length === 0}>
            {isSubmitting ? 'Submitting...' : 'Submit Walk-in Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default WalkInRequestModal;
