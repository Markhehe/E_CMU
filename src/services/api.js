/**
 * API Service Module for E-CMU Portal
 * Clean, standard-compliant API layer strictly focused on data transport,
 * error normalization, and request formatting.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

// Helper purely for data transformation, not UI validation
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the file data.'));
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

export const STATUS_LABELS = {
  pending_review: 'PENDING REVIEW',
  on_hold: 'ON HOLD',
  pending_payment: 'PENDING PAYMENT',
  clearance_review: 'CLEARANCE REVIEW',
  paid: 'PAID',
  processing: 'PROCESSING',
  ready: 'READY FOR PICKUP',
  ready_for_retrieval: 'READY FOR PICKUP',
  fulfilled: 'FULFILLED',
  rejected: 'REJECTED',
};

export function formatDisplayId(id, explicitCode) {
  if (explicitCode) return String(explicitCode).toUpperCase();
  if (!id) return 'REQ-UNKNOWN';
  return String(id).replace(/-/g, '').slice(-6).toUpperCase();
}

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

  const rawStatus = String(request.status || '').toLowerCase();
  
  const receiptUrl = additionalDetails.receiptUrl || additionalDetails.receipt_url || 
                     request.receiptUrl || request.receipt_url || 
                     request.proofOfPayment || request.proof_of_payment || null;

  const paymentReference = additionalDetails.paymentReference || additionalDetails.payment_reference || 
                           request.paymentReference || request.payment_reference || null;
  const orNumber = additionalDetails.orNumber || additionalDetails.or_number ||
                   request.orNumber || request.or_number || null;

  const paymentMethod = additionalDetails.paymentMethod || additionalDetails.payment_method || 
                        request.paymentMethod || request.payment_method || 'Not recorded';

  const hasReceipt = Boolean(
    receiptUrl || additionalDetails.hasReceipt || additionalDetails.has_receipt || 
    request.hasReceipt || request.has_receipt
  );

  return {
    id: String(request.id),
    displayId: formatDisplayId(request.id, request.displayCode || request.display_code),
    requesterId: String(request.requesterId ?? request.requester_id ?? 'N/A'),
    studentId: String(request.requesterStudentId || request.requester_student_id || request.studentId || 'N/A'),
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
    orNumber,
    requestCopyUrl: additionalDetails.requestCopyUrl || additionalDetails.request_copy_url || null,
    hasReceipt,
    receiptUrl,
    paymentSentAt: additionalDetails.paymentSentAt || additionalDetails.payment_sent_at || null,
    paymentConfirmationEmail: additionalDetails.paymentConfirmationEmail || additionalDetails.payment_confirmation_email || null,
    purpose: request.purpose || '',
    feeAmount: Number(request.feeAmount ?? request.fee_amount ?? 0),
    feeCurrency: request.feeCurrency || request.fee_currency || 'PHP',
    collectionMethod: additionalDetails.collectionMethod || 'Pickup',
    commentCount: Number(request.commentCount ?? request.comment_count ?? 0),
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
  async requestPasswordReset(email) {
    return apiRequest('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async verifyPasswordResetCode(email, code) {
    return apiRequest('/auth/password-reset/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },
  async completePasswordReset(resetToken, newPassword) {
    return apiRequest('/auth/password-reset/complete', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword }),
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
  async changeRequestStatus(requestId, status) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  async deletePendingRequest(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' });
  },
  async confirmRequestPayment(requestId, { method, amount, currency, providerReference, notes }) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        method, amount, currency, status: 'succeeded', providerReference, notes,
      }),
    });
  },
  async markRequestReadyForPickup(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/ready-for-pickup`, { method: 'POST' });
  },
  async startRequestProcessing(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/start-processing`, { method: 'POST' });
  },
  async markRequestPickedUp(requestId) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/pickup`, { method: 'POST' });
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
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/comments/read`, { method: 'POST' });
  },
  async updateRequestPaymentMethod(requestId, paymentMethod) {
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/payment-method`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  },

  // UI validation removed. API layer strictly processes the data.
  async submitPaymentDetails(requestId, { paymentReference, receiptFile, requestCopyFile, orNumber }) {
    const receiptDataUrl = await readFileAsDataUrl(receiptFile);
    const requestCopyDataUrl = await readFileAsDataUrl(requestCopyFile);
    
    return apiRequest(`/requests/${encodeURIComponent(requestId)}/payment-proof`, {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod: 'Pay at the Office',
        paymentReference,
        orNumber,
        receiptDataUrl,
        requestCopyDataUrl,
      }),
    });
  },
};

export const ClearanceService = {
  async getMine() {
    const result = await apiRequest('/requests/clearance/me');
    return result.clearance;
  },
  
  // UI validation removed. API layer strictly processes the data.
  async submit(file) {
    const fileData = await readFileAsDataUrl(file);
    return apiRequest('/requests/clearance', {
      method: 'POST',
      body: JSON.stringify({ fileData, originalName: file.name }),
    });
  },
  async deletePending(id) {
    return apiRequest(`/requests/clearance/${encodeURIComponent(id)}`, { method: 'DELETE' });
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

export const NotificationService = {
  async getMine() {
    const result = await apiRequest('/requests/notifications');
    return {
      notifications: result.notifications || [],
      unreadCount: Number(result.unreadCount || 0),
    };
  },
  async markRead(notificationId) {
    return apiRequest(`/requests/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
  },
  async markAllRead() {
    return apiRequest('/requests/notifications/read-all', { method: 'POST' });
  },
};

export const RegistrarStaffService = {
  async list() {
    const result = await apiRequest('/admin/registrar-staff');
    return result.staff || [];
  },
  async create({ fullName, email, password }) {
    const result = await apiRequest('/admin/registrar-staff', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    });
    return result.staff;
  },
  async setActive(id, active) {
    const result = await apiRequest(`/admin/registrar-staff/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
    return result.staff;
  },
  async remove(id) {
    return apiRequest(`/admin/registrar-staff/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};