import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { DocumentService } from '../../services/api';
import '../../styles/createRequest.css';

const INITIAL_FORM_STATE = {
  docType: '',
  quantity: 1,
  purpose: '',
  collectionMethod: 'Pick-up',
  paymentMethod: 'Pay at the Office',
};

function CreateRequest() {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [catalog, setCatalog] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // Fetch the document catalog (with prices) when the component mounts
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const data = await DocumentService.getDocumentCatalog();
        setCatalog(data);
      } catch (err) {
        console.error("Failed to load document catalog", err);
        addToast("Failed to load document options.", "error");
      }
    };
    loadCatalog();
  }, [addToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Calculate the total price dynamically based on selection
  const selectedDocInfo = useMemo(() => {
    return catalog.find(doc => doc.name === formData.docType) || null;
  }, [catalog, formData.docType]);

  const totalPrice = selectedDocInfo ? selectedDocInfo.price * formData.quantity : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const requestPayload = {
        ...formData,
        studentId: currentUser?.id,
        studentName: currentUser?.name,
        totalPrice: totalPrice // Save the calculated total for the database
      };

      const response = await DocumentService.createRequest(requestPayload);
      
      // Save the generated ID and payload to show in the success message
      setSubmittedData({ ...requestPayload, id: response.id });
      addToast('Document request submitted successfully.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to submit request. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE);
    setSubmittedData(null);
  };

  if (submittedData) {
    return <SuccessMessage data={submittedData} onReset={handleReset} />;
  }

  return (
    <div className="request-page-container">
      <header className="request-header">
        <h1>Request a Document</h1>
        <p>Fill out the form below to request official university records.</p>
      </header>

      <form className="request-form card-ui" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="docType">Document Type</label>
          <select
            id="docType"
            name="docType"
            value={formData.docType}
            onChange={handleChange}
            required
          >
            <option value="" disabled>Select a document</option>
            {catalog.map((doc) => (
              <option key={doc.id} value={doc.name}>
                {doc.name} (₱{doc.price})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            max="10"
            value={formData.quantity}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="purpose">Purpose of Request</label>
          <textarea
            id="purpose"
            name="purpose"
            rows="3"
            placeholder="e.g. Employment requirement, further studies application"
            value={formData.purpose}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group half-width">
            <label htmlFor="collectionMethod">Collection Method</label>
            <select
              id="collectionMethod"
              name="collectionMethod"
              value={formData.collectionMethod}
              onChange={handleChange}
            >
              <option value="Pick-up">Pick-up at Registrar's Office</option>
              <option value="Delivery">Delivery (Additional Fee)</option>
            </select>
          </div>

          <div className="form-group half-width">
            <label htmlFor="paymentMethod">Payment Method</label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
            >
              <option value="Pay at the Office">Pay at the Office (Cashier)</option>
              <option value="Online">Online Payment (GCash/Bank)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Price Display */}
        {totalPrice > 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--parchment)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: 0, color: 'var(--imperial-blue)' }}>Total Estimated Fee: ₱{totalPrice}</h3>
          </div>
        )}

        <button 
          type="submit" 
          className="submit-button" 
          disabled={isSubmitting || !formData.docType}
          style={{ marginTop: '1.5rem' }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}

function SuccessMessage({ data, onReset }) {
  const isOnline = data.paymentMethod === 'Online';

  return (
    <div className="request-page-container">
      <div className="success-message card-ui" style={{ textAlign: 'center' }}>
        <svg 
          className="success-icon" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="var(--status-success)" 
          strokeWidth="2"
          style={{ width: '64px', height: '64px', margin: '0 auto 1rem auto' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        
        <h2 style={{ color: 'var(--imperial-blue)' }}>Request {data.id} Created!</h2>
        <p>Your request for <strong>{data.quantity}x {data.docType}</strong> has been saved.</p>
        
        {/* Conditional QR Code UI if Online Payment was selected */}
        {isOnline ? (
          <div style={{ margin: '2rem 0', padding: '1.5rem', border: '2px dashed var(--border-light)', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Scan to Pay: ₱{data.totalPrice}</h3>
            {/* Placeholder for actual QR code */}
            <div style={{ width: '150px', height: '150px', backgroundColor: '#e9ecef', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
              <span style={{ fontSize: '3rem' }}>📱</span>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Scan via GCash or Maya. <br/>
              <strong>Once paid, please go to your Dashboard to upload the screenshot.</strong>
            </p>
          </div>
        ) : (
          <div className="success-details" style={{ margin: '2rem 0', padding: '1rem', backgroundColor: 'var(--parchment)', borderRadius: '8px' }}>
            <p><strong>Payment:</strong> Please proceed to the Cashier.</p>
            <p><strong>Total Amount:</strong> ₱{data.totalPrice}</p>
          </div>
        )}

        <button onClick={onReset} className="submit-button mt-2">
          Submit Another Request
        </button>
      </div>
    </div>
  );
}

export default CreateRequest;