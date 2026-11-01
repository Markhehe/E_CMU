import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { DocumentService } from '../../services/api';

const INITIAL_STATE = {
  studentId: '',
  documentTypeId: '',
  purpose: '',
  quantity: 1,
};

function WalkInRequestModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [catalog, setCatalog] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  // 1. Fetch catalog when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    let isCurrent = true;
    setIsLoadingCatalog(true);

    DocumentService.getDocumentCatalog()
      .then((documents) => {
        if (isCurrent) setCatalog(documents);
      })
      .catch((error) => {
        if (isCurrent) addToast(error.message || 'Failed to load documents.', 'error');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCatalog(false);
      });

    return () => { isCurrent = false; };
  }, [isOpen, addToast]);

  // 2. STALE STATE FIX: Reset the form completely whenever the modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(INITIAL_STATE);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    try {
      const result = await DocumentService.createWalkInRequest({
        studentId: formData.studentId.trim(),
        documentTypeId: formData.documentTypeId,
        purpose: formData.purpose.trim(),
        quantity: Number(formData.quantity),
      });
      
      const displayCode = result?.request?.display_code || result?.displayId || 'Unknown ID';
      addToast(`Walk-in request ${displayCode} submitted.`, 'success');
      
      onCreated();
      onClose(); // The useEffect will handle the state reset automatically
    } catch (error) {
      addToast(error.message || 'Failed to enter walk-in request.', 'error');
      setIsSubmitting(false); // Only toggle false on error, onClose handles success
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enter Walk-in Request" maxWidth="560px">
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="modal-text">Confirm the student has verified clearance before entering a walk-in request.</p>
        
        <label className="auth-label" htmlFor="walkin-student-id">Student ID</label>
        <input
          id="walkin-student-id"
          name="studentId"
          className="auth-input"
          value={formData.studentId}
          onChange={handleChange}
          maxLength={64}
          required
          disabled={isSubmitting}
        />
        
        <label className="auth-label" htmlFor="walkin-document">Document</label>
        <select
          id="walkin-document"
          name="documentTypeId"
          className="auth-input"
          value={formData.documentTypeId}
          onChange={handleChange}
          required
          disabled={isSubmitting || isLoadingCatalog}
        >
          <option value="">{isLoadingCatalog ? 'Loading catalog...' : 'Select a document'}</option>
          {catalog.map((document) => (
            <option key={document.id} value={document.id}>{document.name}</option>
          ))}
        </select>
        
        <label className="auth-label" htmlFor="walkin-purpose">Purpose</label>
        <textarea
          id="walkin-purpose"
          name="purpose"
          className="auth-input"
          value={formData.purpose}
          onChange={handleChange}
          maxLength={2000}
          rows={3}
          required
          disabled={isSubmitting}
        />
        
        <label className="auth-label" htmlFor="walkin-quantity">Quantity</label>
        <input
          id="walkin-quantity"
          name="quantity"
          className="auth-input"
          type="number"
          min={1}
          max={10}
          value={formData.quantity}
          onChange={handleChange}
          required
          disabled={isSubmitting}
        />
        
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isSubmitting || catalog.length === 0 || isLoadingCatalog}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Walk-in Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default WalkInRequestModal;