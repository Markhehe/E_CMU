import { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { DocumentService } from '../../services/api';
import StudentClearancePanel from '../../components/ui/StudentClearancePanel';
import { useStudentClearance } from '../../hooks/useStudentClearance';
import '../../styles/createRequest.css';

const INITIAL_FORM_STATE = {
  docType: '',
  quantity: 1,
  purpose: '',
  collectionMethod: 'Pick-up',
  paymentMethod: 'Pay at the Office',
};

function formatCurrency(amount, currency = 'PHP') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function CreateRequest({ embedded = false, onRequestCreated, clearanceState }) {
  const { addToast } = useToast();
  const localClearanceState = useStudentClearance({ enabled: !clearanceState });
  const {
    clearance,
    isLoading: isClearanceLoading,
    isUploading: isClearanceUploading,
    isDeleting: isClearanceDeleting,
    isVerified: hasVerifiedClearance,
    submitClearance,
    deletePendingClearance,
  } = clearanceState || localClearanceState;

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [catalog, setCatalog] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errors, setErrors] = useState({});

  // Fetch the document catalog (with prices) when the component mounts
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const data = await DocumentService.getDocumentCatalog();
        setCatalog(data);
      } catch (err) {
        console.error('Failed to load document catalog', err);
        addToast('Failed to load document options.', 'error');
      }
    };
    loadCatalog();
  }, [addToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-specific error as user interacts
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Calculate the total price dynamically based on selection
  const selectedDocInfo = useMemo(() => {
    return catalog.find((doc) => doc.name === formData.docType) || null;
  }, [catalog, formData.docType]);

  const totalPrice = selectedDocInfo ? selectedDocInfo.price * Number(formData.quantity) : 0;

  if (isClearanceLoading || !hasVerifiedClearance) {
    return (
      <div className="request-page-container">
        <StudentClearancePanel
          clearance={clearance}
          isLoading={isClearanceLoading}
          isUploading={isClearanceUploading}
          isDeleting={isClearanceDeleting}
          onSubmit={submitClearance}
          onDelete={deletePendingClearance}
          selectedFile={clearanceState?.selectedFile}
          selectedImagePreview={clearanceState?.selectedImagePreview}
          fileInputKey={clearanceState?.fileInputKey}
          onSelectedFileChange={clearanceState?.onSelectedFileChange}
        />
      </div>
    );
  }

  // Validation function
  const validateForm = () => {
    const newErrors = {};

    if (!formData.docType) {
      newErrors.docType = 'Please select a document type.';
    }

    if (!formData.purpose || !formData.purpose.trim()) {
      newErrors.purpose = 'Please specify the purpose of your request.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Client-Side Validation Check
    if (!validateForm()) {
      addToast('Please select a document type before submitting.', 'error');
      return; // Stop form submission
    }

    setIsSubmitting(true);

    try {
      const requestPayload = {
        ...formData,
        documentTypeId: selectedDocInfo.id,
        totalPrice: totalPrice, // Save the calculated total for the database
      };

      const response = await DocumentService.createRequest(requestPayload);
      onRequestCreated?.();

      // Save the generated ID and payload to show in the success message
      setSubmittedData({
        ...requestPayload,
        id: response.id,
        displayId: response.displayId,
        totalPrice: response.feeAmount,
        currency: response.feeCurrency,
      });
      addToast('Document request submitted successfully.', 'success');
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to submit request. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE);
    setSubmittedData(null);
    setErrors({});
  };

  if (submittedData) {
    return <SuccessMessage data={submittedData} onReset={handleReset} />;
  }

  return (
    <div className="request-page-container">
      {!embedded && (
        <header className="request-header">
          <h1>Request a Document</h1>
          <p>Fill out the form below to request official university records.</p>
        </header>
      )}

      <form
        className={`request-form card-ui${embedded ? ' request-form-embedded' : ''}`}
        onSubmit={handleSubmit}
        data-action-cooldown="protected"
        noValidate
      >
        {/* Document Type Selection */}
        <div className="form-group">
          <label htmlFor="docType">
            Document Type <span style={{ color: '#e03131' }}>*</span>
          </label>
          <select
            id="docType"
            name="docType"
            value={formData.docType}
            onChange={handleChange}
            className={errors.docType ? 'input-error' : ''}
            style={errors.docType ? { borderColor: '#e03131', backgroundColor: '#fff5f5' } : {}}
          >
            <option value="">Select a document</option>
            {catalog.map((doc) => (
              <option key={doc.id} value={doc.name}>
                {doc.name} ({formatCurrency(doc.price, doc.currency)})
              </option>
            ))}
          </select>
          {errors.docType && (
            <span style={{ color: '#e03131', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
              {errors.docType}
            </span>
          )}
        </div>

        {/* Quantity */}
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

        {/* Purpose */}
        <div className="form-group">
          <label htmlFor="purpose">
            Purpose of Request <span style={{ color: '#e03131' }}>*</span>
          </label>
          <textarea
            id="purpose"
            name="purpose"
            rows="3"
            placeholder="e.g. Employment requirement, further studies application"
            value={formData.purpose}
            onChange={handleChange}
            className={errors.purpose ? 'input-error' : ''}
            style={errors.purpose ? { borderColor: '#e03131', backgroundColor: '#fff5f5' } : {}}
          />
          {errors.purpose && (
            <span style={{ color: '#e03131', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
              {errors.purpose}
            </span>
          )}
        </div>

        {/* Collection & Payment Methods */}
        <div className="form-row">
          <div className="form-group half-width">
            <label>Collection Method</label>
            <p>Pick-up at Registrar&apos;s Office</p>
          </div>

          <div className="form-group half-width">
            <label>Payment Method</label>
            <p>Cash at the Finance Office</p>
          </div>
        </div>

        {/* Dynamic Price Display */}
        {totalPrice > 0 && selectedDocInfo && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'var(--parchment)',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--imperial-blue)' }}>
              Total Estimated Fee: {formatCurrency(totalPrice, selectedDocInfo.currency)}
            </h3>
          </div>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting}
          style={{ marginTop: '1.5rem' }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}

function SuccessMessage({ data, onReset }) {
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

        <h2 style={{ color: 'var(--imperial-blue)' }}>Request {data.displayId || data.id} Created!</h2>
        <p>
          Your request for <strong>{data.quantity}x {data.docType}</strong> has been saved.
        </p>

        <div className="success-details" style={{
          margin: '2rem 0',
          padding: '1rem',
          backgroundColor: 'var(--parchment)',
          borderRadius: '8px',
        }}>
          <p><strong>Payment:</strong> Bring a printed copy of this request and pay cash at the Finance Office.</p>
          <p><strong>Total Amount:</strong> {formatCurrency(data.totalPrice, data.currency)}</p>
        </div>

        <button onClick={onReset} className="submit-button mt-2">
          Submit Another Request
        </button>
      </div>
    </div>
  );
}

export default CreateRequest;