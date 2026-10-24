/**
 * API Service Module for E-CMU Portal
 * Clean, standard-compliant API layer with unified error handling,
 * request formatting, explicit workflow action endpoints, and bidrectional status mapping.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the receipt image.'));
    reader.readAsDataURL(file);
  });
}

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
      throw new Error(
        'Unable to connect to the server. Please check your network connection.',
        { cause: err }
      );
    }
    throw err;
  }
}

// System Workflow Status Mappings (Backend Status -> Human Readable UI Badge Label)
export const STATUS_LABELS = {
  submitted: 'PENDING REVIEW',
  registrar_review: 'REGISTRAR REVIEW',
  needs_information: 'ON HOLD',
  approved: 'PENDING PAYMENT',
  registrar_approved: 'CLEARANCE REVIEW',
  registrar_rejected: 'REJECTED',
  saso_review: 'CLEARANCE REVIEW',
  saso_cleared: 'PENDING PAYMENT',
  saso_rejected: 'REJECTED',
  awaiting_payment: 'PENDING PAYMENT',
  payment_review: 'PENDING PAYMENT',
  paid: 'PAID',
  processing: 'PROCESSING',
  ready: 'READY FOR PICKUP',
  ready_for_retrieval: 'READY FOR PICKUP',
  fulfilled: 'FULFILLED',
  rejected: 'REJECTED',
  cancelled: 'REJECTED',
};

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
    additionalDetails.hasReceipt ||
    additionalDetails.has_receipt ||
    request.hasReceipt ||
    request.has_receipt
  );

  return {
    id: String(request.id),
    displayId: formatDisplayId(request.id, request.displayCode || request.display_code),
    requesterId: String(request.requesterId ?? request.requester_id ?? 'N/A'),
    studentId: String(
      request.requesterStudentId ||
      request.requester_student_id ||
      request.studentId ||
      'N/A'
    ),
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
    requestCopyUrl: additionalDetails.requestCopyUrl || additionalDetails.request_copy_url || null,
    hasReceipt,
    receiptUrl,
    paymentSentAt: additionalDetails.paymentSentAt || additionalDetails.payment_sent_at || null,
    paymentConfirmationEmail:
      additionalDetails.paymentConfirmationEmail ||
      additionalDetails.payment_confirmation_email ||
      null,
    purpose: request.purpose || '',
    feeAmount: Number(request.feeAmount ?? request.fee_amount ?? 0),
    feeCurrency: request.feeCurrency || request.fee_currency || 'PHP',
    collectionMethod: additionalDetails.collectionMethod || 'Pickup',
    rejectionReason: request.rejectionReason || request.rejection_reason || null,
    hasUnreadComments: Boolean(request.hasUnreadComments ?? request.has_unread_comments),
  };
}

export const AuthService = {
  async login(email, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register({ email, password }) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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

  async updateProfile({ contactPhone, contactAddress }) {
    return apiRequest('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ contactPhone, contactAddress }),
    });
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

  async createWalkInRequest(requestData) {
    return apiRequest('/requests/walk-in', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  // Registrar clearance verification
  async updateClearance(requestId, isCleared, notes = '') {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/clearance`, {
      method: 'POST',
      body: JSON.stringify({
        decision: isCleared ? 'approved' : 'needs_information',
        comment: notes,
      }),
    });
  },

  async submitRegistrarReview(requestId, decision, comment = '') {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/registrar-review`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    });
  },

  async confirmRequestPayment(requestId, { method, amount, currency, providerReference, notes }) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        method,
        amount,
        currency,
        status: 'succeeded',
        providerReference,
        notes,
      }),
    });
  },

  async markRequestReadyForPickup(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/ready-for-pickup`, {
      method: 'POST',
    });
  },

  async startRequestProcessing(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/start-processing`, {
      method: 'POST',
    });
  },

  async markRequestPickedUp(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/pickup`, {
      method: 'POST',
    });
  },

  async getRequestComments(requestId) {
    const result = await apiRequest(`/requests/${encodeURIComponent(requestId)}/comments`);
    return result.comments || [];
  },

  async addRequestComment(requestId, { comment, visibility }) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment, visibility }),
    });
  },

  async deleteRequestComment(requestId, commentId) {
    return apiRequest(
      `/requests/${encodeURIComponent(requestId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' }
    );
  },

  async markRequestCommentsRead(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/comments/read`, {
      method: 'POST',
    });
  },

  async updateRequestPaymentMethod(requestId, paymentMethod) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/payment-method`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  },

  // Workflow Action: Payment Receipt & Reference Submission
  async submitPaymentDetails(
    requestId,
    { paymentReference, receiptFile, requestCopyFile, trackingCode },
  ) {
    if (!receiptFile) {
      throw new Error('Choose a receipt image before submitting.');
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(receiptFile.type)) {
      throw new Error('Receipt must be a PNG, JPEG, or WebP image.');
    }
    if (!requestCopyFile) {
      throw new Error('Choose a picture of the printed request with its tracking code.');
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(requestCopyFile.type)) {
      throw new Error('Request copy must be a PNG, JPEG, or WebP image.');
    }
    const maxProofFileSize = 2.5 * 1024 * 1024;
    if (receiptFile.size > maxProofFileSize || requestCopyFile.size > maxProofFileSize) {
      throw new Error('Each uploaded image must be 2.5 MB or smaller.');
    }
    const receiptDataUrl = await readFileAsDataUrl(receiptFile);
    const requestCopyDataUrl = await readFileAsDataUrl(requestCopyFile);
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/payment-proof`, {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod: 'Pay at the Office',
        paymentReference,
        receiptDataUrl,
        requestCopyDataUrl,
        trackingCode,
      }),
    });
  },
};

export const ClearanceService = {
  async getMine() {
    const result = await apiRequest('/requests/clearance/me');
    return result.clearance;
  },

  async submit(file) {
    if (!file) throw new Error('Choose your clearance file before submitting.');
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error('Clearance file must be a PDF, PNG, JPEG, or WebP.');
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      throw new Error('Clearance file must be 5 MB or smaller.');
    }
    const fileData = await readFileAsDataUrl(file);
    return apiRequest('/requests/clearance', {
      method: 'POST',
      body: JSON.stringify({ fileData, originalName: file.name }),
    });
  },

  async deletePending(id) {
    return apiRequest(`/requests/clearance/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getPending() {
    const result = await apiRequest('/requests/clearances');
    return result.clearances || [];
  },

  async getArchive(query = '') {
    const search = query ? `?q=${encodeURIComponent(query)}` : '';
    const result = await apiRequest(`/requests/clearances/archive${search}`);
    return result.clearances || [];
  },

  async searchStudents(query) {
    const result = await apiRequest(`/requests/students/search?q=${encodeURIComponent(query)}`);
    return result.students || [];
  },

  async getStudentProfile(studentId) {
    return apiRequest(`/requests/students/${encodeURIComponent(studentId)}`);
  },

  async review(id, decision, comment = '') {
    return apiRequest(`/requests/clearances/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    });
  },

  async invalidate(id, comment) {
    return apiRequest(`/requests/clearances/${encodeURIComponent(id)}/invalidate`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },
};