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
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let isMounted = true;
    
    const loadCatalog = async () => {
      setIsCatalogLoading(true);
      try {
        const data = await DocumentService.getDocumentCatalog();
        if (isMounted) setCatalog(data);
      } catch (err) {
        console.error('Failed to load document catalog', err);
        if (isMounted) addToast('Failed to load document options.', 'error');
      } finally {
        if (isMounted) setIsCatalogLoading(false);
      }
    };
    
    loadCatalog();
    return () => { isMounted = false; };
  }, [addToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const selectedDocInfo = useMemo(() => {
    return catalog.find((doc) => doc.name === formData.docType) || null;
  }, [catalog, formData.docType]);

  // Fixed the syntax error in the price calculation
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

  const validateForm = () => {
    const newErrors = {};
    if (!formData.docType) newErrors.docType = 'Please select a document type.';
    if (!formData.purpose || !formData.purpose.trim()) newErrors.purpose = 'Please specify the purpose of your request.';
    if (formData.quantity < 1 || formData.quantity > 10) newErrors.quantity = 'Quantity must be between 1 and 10.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast('Please correct the highlighted errors.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const requestPayload = {
        ...formData,
        documentTypeId: selectedDocInfo.id,
        totalPrice: totalPrice,
      };

      const response = await DocumentService.createRequest(requestPayload);
      onRequestCreated?.();

      setSubmittedData({
        ...requestPayload,
        id: response.id,
        displayId: response.displayId,
        totalPrice: response.feeAmount || totalPrice,
        currency: response.feeCurrency || selectedDocInfo.currency,
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
        className={`request-form card-ui ${embedded ? 'request-form-embedded' : ''}`}
        onSubmit={handleSubmit}
        data-action-cooldown="protected"
        noValidate
      >
        <div className="form-group">
          <label htmlFor="docType">
            Document Type <span className="required-asterisk">*</span>
          </label>
          <select
            id="docType"
            name="docType"
            value={formData.docType}
            onChange={handleChange}
            className={errors.docType ? 'input-error' : ''}
            disabled={isCatalogLoading}
          >
            <option value="">{isCatalogLoading ? 'Loading catalog...' : 'Select a document'}</option>
            {catalog.map((doc) => (
              <option key={doc.id} value={doc.name}>
                {doc.name} ({formatCurrency(doc.price, doc.currency)})
              </option>
            ))}
          </select>
          {errors.docType && <span className="error-message">{errors.docType}</span>}
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
            className={errors.quantity ? 'input-error' : ''}
          />
          {errors.quantity && <span className="error-message">{errors.quantity}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="purpose">
            Purpose of Request <span className="required-asterisk">*</span>
          </label>
          <textarea
            id="purpose"
            name="purpose"
            rows="3"
            placeholder="e.g. Employment requirement, further studies application"
            value={formData.purpose}
            onChange={handleChange}
            className={errors.purpose ? 'input-error' : ''}
          />
          {errors.purpose && <span className="error-message">{errors.purpose}</span>}
        </div>

        <div className="form-row">
          <div className="form-group half-width">
            <label>Collection Method</label>
            <p className="static-field-value">Pick-up at Registrar&apos;s Office</p>
          </div>

          <div className="form-group half-width">
            <label>Payment Method</label>
            <p className="static-field-value">Cash at the Finance Office</p>
          </div>
        </div>

        {totalPrice > 0 && selectedDocInfo && (
          <div className="price-summary-box">
            <h3>Total Estimated Fee: {formatCurrency(totalPrice, selectedDocInfo.currency)}</h3>
          </div>
        )}

        <button
          type="submit"
          className="submit-button mt-4"
          disabled={isSubmitting || isCatalogLoading}
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
      <div className="success-message card-ui text-center">
        <svg
          className="success-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        <h2>Request {data.displayId || data.id} Created!</h2>
        <p>Your request for <strong>{data.quantity}x {data.docType}</strong> has been saved.</p>

        <div className="success-details-box">
          <p><strong>Payment:</strong> Bring a printed copy of this request and pay cash at the Finance Office.</p>
          <p><strong>Total Amount:</strong> {formatCurrency(data.totalPrice, data.currency)}</p>
        </div>

        <button onClick={onReset} className="submit-button mt-4">
          Submit Another Request
        </button>
      </div>
    </div>
  );
}

export default CreateRequest;