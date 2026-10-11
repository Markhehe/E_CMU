/**
 * API Service Module for E-CMU Portal
 * Clean, standard-compliant API layer with unified error handling,
 * request formatting, explicit workflow action endpoints, and bidrectional status mapping.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

/**
 * Universal fetch wrapper with automatic headers and error normalization
 */
async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (response.status === 204) return null;

    // Handle non-2xx HTTP responses cleanly
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorData = null;

      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        const textError = await response.text().catch(() => '');
        if (textError) errorMessage = textError;
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // Parse successful responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check your network connection.');
    }
    throw err;
  }
}

// System Workflow Status Mappings (Backend Status -> Human Readable UI Badge Label)
export const STATUS_LABELS = {
  submitted: 'PENDING PAYMENT',
  needs_information: 'ON HOLD',
  approved: 'PROCESSING',
  registrar_review: 'PROCESSING',
  registrar_approved: 'PROCESSING',
  registrar_rejected: 'REJECTED',
  saso_review: 'PROCESSING',
  saso_cleared: 'PROCESSING',
  saso_rejected: 'REJECTED',
  awaiting_payment: 'PENDING PAYMENT',
  payment_review: 'PENDING PAYMENT',
  paid: 'PROCESSING',
  processing: 'PROCESSING',
  ready: 'READY FOR PICKUP',
  ready_for_retrieval: 'READY FOR PICKUP',
  fulfilled: 'COMPLETED',
  rejected: 'REJECTED',
  cancelled: 'REJECTED',
};

// UI Badge Label -> Backend Status Normalizer
const UI_TO_BACKEND_STATUS = {
  'PENDING PAYMENT': 'submitted',
  'PROCESSING': 'processing',
  'READY FOR PICKUP': 'ready',
  'COMPLETED': 'fulfilled',
  'REJECTED': 'rejected',
  'ON HOLD': 'needs_information',
};

/**
 * Normalizes UI badge strings or raw strings to backend-compatible status codes
 */
export function toBackendStatus(status) {
  if (!status) return 'processing';
  const upperKey = String(status).trim().toUpperCase();
  return UI_TO_BACKEND_STATUS[upperKey] || String(status).toLowerCase();
}

/**
 * Generates clean 6-character fallback Display ID
 */
export function formatDisplayId(id, explicitCode) {
  if (explicitCode) return String(explicitCode).toUpperCase();
  if (!id) return 'REQ-UNKNOWN';
  return String(id).replace(/-/g, '').slice(-6).toUpperCase();
}

/**
 * Transforms raw server request objects into clean, predictable frontend domain models
 */
export function formatRequest(request = {}) {
  const submittedAt = request.submittedAt || request.submitted_at;
  let additionalDetails = request.additionalDetails || request.additional_details || {};
  if (typeof additionalDetails === 'string') {
    try {
      additionalDetails = JSON.parse(additionalDetails);
    } catch {
      additionalDetails = {};
    }
  }

  const rawStatus =  String(request.status || '').toLowerCase();

const receiptUrl =
    additionalDetails.receiptUrl ||
    additionalDetails.receipt_url ||
    request.receiptUrl ||
    request.receipt_url ||
    request.proofOfPayment ||
    request.proof_of_payment ||
    null;

  const paymentReference =
    additionalDetails.paymentReference ||
    additionalDetails.payment_reference ||
    request.paymentReference ||
    request.payment_reference ||
    null;

  const paymentMethod =
    additionalDetails.paymentMethod ||
    additionalDetails.payment_method ||
    request.paymentMethod ||
    request.payment_method ||
    'Not recorded';

  const hasReceipt = Boolean(
    receiptUrl ||
    paymentReference ||
    additionalDetails.hasReceipt ||
    additionalDetails.has_receipt ||
    request.hasReceipt ||
    request.has_receipt ||
    paymentMethod === 'Online'
  );

  return {
    id: String(request.id),
    displayId: formatDisplayId(request.id, request.displayCode || request.display_code),
    studentId: String(request.requesterId ?? request.requester_id ?? 'N/A'),
    studentName: request.requesterName || request.requester_name || 'Unknown Student',
    studentEmail: request.requesterEmail || request.requester_email || '',
    docType: request.documentTypeName || request.document_type_name || 'Document',
    documentTypeId: String(request.documentTypeId || request.document_type_id || ''),
    dateRequested: submittedAt ? new Date(submittedAt).toISOString().split('T')[0] : '',
    rawDate: submittedAt || null,
    quantity: Number(additionalDetails.quantity || 1),
    rawStatus,
    status: STATUS_LABELS[rawStatus] || rawStatus.toUpperCase(),
    paymentMethod,
    paymentReference,
    hasReceipt,
    receiptUrl,
    purpose: request.purpose || '',
    feeAmount: Number(request.feeAmount ?? request.fee_amount ?? 0),
    feeCurrency: request.feeCurrency || request.fee_currency || 'PHP',
    collectionMethod: additionalDetails.collectionMethod || 'Pickup',
    rejectionReason: request.rejectionReason || request.rejection_reason || null,
  };
}

export const AuthService = {
  async login(email, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register({ fullName, email, password }) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName,
        email,
        password,
        stakeholderType: 'student',
      }),
    });
  },

  async verifyEmail(email, code) {
    return apiRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  async resendConfirmation(email) {
    return apiRequest('/auth/resend-confirmation', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async me() {
    return apiRequest('/auth/me');
  },

  async logout() {
    return apiRequest('/auth/logout', { method: 'POST' });
  },
};

export const DocumentService = {
  async getDocumentCatalog() {
    const result = await apiRequest('/requests/document-types');
    const catalog = result.documentTypes || result || [];
    return catalog.map((doc) => ({
      id: String(doc.id),
      name: doc.name,
      price: Number(doc.base_fee ?? doc.baseFee ?? 0),
      currency: doc.currency || 'PHP',
      description: doc.description || '',
    }));
  },

  async getAllRequests() {
    const result = await apiRequest('/requests');
    const list = result.requests || (Array.isArray(result) ? result : []);
    return list.map(formatRequest);
  },

  async getRequestById(requestId) {
    const result = await apiRequest(`/requests/${encodeURIComponent(requestId)}`);
    return formatRequest(result.request || result);
  },

  async createRequest(requestData) {
    const result = await apiRequest('/requests', {
      method: 'POST',
      body: JSON.stringify({
        documentTypeId: requestData.documentTypeId,
        purpose: requestData.purpose,
        additionalDetails: {
          quantity: String(requestData.quantity || 1),
          collectionMethod: requestData.collectionMethod || 'Pickup',
          paymentMethod: requestData.paymentMethod || 'Cash',
        },
      }),
    });

    const req = result.request || result;
    return {
      id: String(req.id),
      displayId: formatDisplayId(req.id, req.displayCode || req.display_code),
      feeAmount: Number(req.feeAmount ?? req.fee_amount ?? 0),
      feeCurrency: req.feeCurrency || req.fee_currency || 'PHP',
    };
  },

  // Role Action: SASO Clearance Workflow
  async updateSasoClearance(requestId, isCleared, notes = '') {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/saso-clearance`, {
      method: 'POST',
      body: JSON.stringify({
        decision: isCleared ? 'approved' : 'rejected',
        notes,
      }),
    });
  },

  // Role Action: Generic Request Status Transition (Admin / Registrar / Finance)
  async updateRequestStatus(requestId, status, reason = '') {
    const backendStatus = toBackendStatus(status);
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: backendStatus, reason }),
    });
  },

  // Workflow Action: Payment Receipt & Reference Submission
  async submitPaymentDetails(requestId, { paymentMethod, paymentReference, receiptFile }) {
    if (receiptFile) {
      const formData = new FormData();
      formData.append('receipt', receiptFile);
      formData.append('paymentMethod', paymentMethod);
      if (paymentReference) formData.append('paymentReference', paymentReference);

      return apiRequest(`/requests/${encodeURIComponent(requestId)}/payment`, {
        method: 'POST',
        body: formData,
      });
    }

    return apiRequest(`/requests/${encodeURIComponent(requestId)}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, paymentReference }),
    });
  },
};