import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import { DocumentService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import ClearanceBadge from '../../components/ui/ClearanceBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import RequestCommentsModal from '../../components/ui/RequestCommentsModal';
import Modal from '../../components/ui/Modal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import RequestDisplaySelect from '../../components/ui/RequestDisplaySelect';
import RequestPagination from '../../components/ui/RequestPagination';
import { useRequestDisplay } from '../../hooks/useRequestDisplay';
import CreateRequest from './CreateRequest';
import '../../styles/dashboard.css';

function Dashboard() {
  const { currentUser } = useAuth();
  const { requests, isLoading, refreshRequests, markCommentsRead } = useRequests();
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const { addToast } = useToast();

  const [paymentRequest, setPaymentRequest] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewingReceiptRequest, setViewingReceiptRequest] = useState(null);
  const [commentingRequest, setCommentingRequest] = useState(null);
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);

  // File Upload Preview States
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Pay at the Office');
  const [isSavingPaymentMethod, setIsSavingPaymentMethod] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        addToast('Receipt must be a PNG, JPEG, or WebP image.', 'error');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        addToast('Receipt image must be 5 MB or smaller.', 'error');
        e.target.value = '';
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setPaymentRequest(null);
    setSelectedFile(null);
    setPaymentReference('');
    setSelectedPaymentMethod('Pay at the Office');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const studentRequests = requests.filter(req => req.studentId === currentUser?.id);

  const {
    mode,
    setMode,
    visibleRequests,
    currentPage,
    totalPages,
    requestsPerPage,
    setCurrentPage,
    tableWrapperRef,
  } = useRequestDisplay(studentRequests, 'student', 5, 'pagination');

  const activeMenuRequest = studentRequests.find(req => req.id === openMenuId);

  const openPaymentModal = (request) => {
    setPaymentRequest(request);
    setSelectedPaymentMethod(request.paymentMethod);
    setOpenMenuId(null);
  };

  const handlePaymentMethodChange = async () => {
    if (!paymentRequest || isSavingPaymentMethod || selectedPaymentMethod === paymentRequest.paymentMethod) return;

    setIsSavingPaymentMethod(true);
    try {
      await DocumentService.updateRequestPaymentMethod(paymentRequest.id, selectedPaymentMethod);
      setPaymentRequest((current) => current
        ? { ...current, paymentMethod: selectedPaymentMethod }
        : current);
      setSelectedFile(null);
      setPaymentReference('');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      await refreshRequests();
      addToast('Payment method updated.', 'success');
    } catch (error) {
      addToast(error.message || 'Failed to update payment method.', 'error');
    } finally {
      setIsSavingPaymentMethod(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !paymentRequest || paymentRequest.paymentMethod !== 'Online') return;

    setIsUploading(true);
    try {
      await DocumentService.submitPaymentDetails(paymentRequest.id, {
        paymentMethod: 'Online',
        paymentReference,
        receiptFile: selectedFile,
      });
      addToast('Payment marked as sent. Receipt submitted for Finance verification.', 'success');
      await refreshRequests();
      setPaymentRequest(null);
      setSelectedFile(null);
      setPaymentReference('');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    } catch (error) {
      addToast(error.message || 'Failed to submit payment proof.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null);
  };

  return (
    <div className="dashboard-page">

      {/* 1. Integrated Header and Action Toolbar */}
      <header className="dashboard-header-container">
        <div className="header-content">
          <h1 className="dashboard-title">
            Student Dashboard
          </h1>
          <p className="dashboard-subtext">
            Track the status of your documents, payments, and clearances.
          </p>
          <p className="header-note">
            * Note: Clearance requirements vary by document. Not all requests require SASO approval.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsCreateRequestOpen(true)}
          >
            + Create a Document Request
          </button>
          <RequestDisplaySelect mode={mode} onChange={setMode} />
        </div>
      </header>

      {/* 2. The Table */}
      <p className="table-scroll-hint">Scroll sideways to view all columns</p>
      <div
        ref={tableWrapperRef}
        className={`request-table-wrapper${mode === 'pagination' ? ' is-paginated' : ''}`}
        tabIndex={0}
        role="region"
        aria-label="Requests table. Scroll horizontally to view all columns."
      >
        <table className="request-table">
          <thead>
            <tr>
              <th className="col-doc" style={{ width: '26%' }}>Document</th>
              <th className="col-date" style={{ width: '16%' }}>Date Requested</th>
              <th className="col-clearance" style={{ width: '18%' }}>SASO Clearance</th>
              <th className="col-status" style={{ width: '15%' }}>Payment &amp; Status</th>
              <th className="col-actions" style={{ width: '25%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton columns={5} rows={5} />
            ) : studentRequests.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                title="No active requests"
                subtext="When you request a document, it will appear here."
              />
            ) : (
              visibleRequests.map((req) => (
                <tr
                  key={req.id}
                  className="request-row-clickable"
                  tabIndex={0}
                  aria-label={`View details for request ${req.id}`}
                  onClick={() => handleViewDetails(req)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      handleViewDetails(req);
                    }
                  }}
                >
                  <td className="doc-name-cell" title={req.docType}>
                    <button
                      type="button"
                      className="doc-name dashboard-request-document"
                      aria-label={`View details for ${req.docType}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleViewDetails(req);
                      }}
                    >
                      {req.docType}
                    </button>
                    <div className="doc-meta">ID: {req.displayId || req.id} &nbsp;|&nbsp; QTY: {req.quantity}</div>
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  <td><ClearanceBadge isCleared={req.sasoCleared} /></td>
                  <td className="col-status-cell" style={{ textAlign: 'center' }}>
                    <div className="status-stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StatusBadge status={req.status} />
                      {req.paymentMethod === 'Online' &&
                        !req.hasReceipt &&
                        ['awaiting_payment', 'payment_review'].includes(req.rawStatus) && (
                          <span className="status-alert">Awaiting Receipt</span>
                        )}
                      {req.paymentMethod === 'Online' && req.hasReceipt && (
                        <span className="status-alert">Payment sent - awaiting Finance</span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <div className="workflow-inline-actions">
                      {req.rawStatus === 'awaiting_payment' ||
                        (req.paymentMethod === 'Online' &&
                          !req.hasReceipt &&
                          req.rawStatus === 'payment_review') ? (
                          <button
                            type="button"
                            className="workflow-step-button is-payment-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPaymentModal(req);
                            }}
                          >
                            {req.rawStatus === 'awaiting_payment' ? 'Payment Options' : 'Upload Receipt'}
                          </button>
                        ) : null}
                      <button
                        type="button"
                        className={`workflow-step-button${req.hasUnreadComments ? ' has-unread-comments' : ''}`}
                        aria-label={req.hasUnreadComments ? 'Comments, unread comments' : 'Comments'}
                        onClick={(event) => {
                          event.stopPropagation();
                          setCommentingRequest(req);
                        }}
                      >
                        Comments
                      </button>
                      <button
                        type="button"
                        className="actions-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleMenu(event, req.id);
                        }}
                      >
                        ⋮
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Pagination Footer */}
      {!isLoading && mode === 'pagination' && (
        <RequestPagination
          currentPage={currentPage}
          totalPages={totalPages}
          requestsPerPage={requestsPerPage}
          totalRequests={studentRequests.length}
          onPageChange={setCurrentPage}
        />
      )}

      {/* 4. Action Context Menu */}
      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords}>
          <button type="button" onClick={() => handleViewDetails(activeMenuRequest)}>View Details</button>
          {activeMenuRequest.hasReceipt && (
            <button type="button" onClick={() => {
              setViewingReceiptRequest(activeMenuRequest);
              setOpenMenuId(null);
            }}>View Uploaded Receipt</button>
          )}
        </div>
      )}

      {/* 5. Request Details Modal */}
      <RequestDetailsModal
        isOpen={!!viewingRequest}
        onClose={() => setViewingRequest(null)}
        request={viewingRequest}
      />
      <Modal
        isOpen={!!viewingReceiptRequest}
        onClose={() => setViewingReceiptRequest(null)}
        title="Uploaded Payment Receipt"
      >
        {viewingReceiptRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p className="modal-text">
              Payment sent for request <strong>{viewingReceiptRequest.displayId}</strong>.
              {viewingReceiptRequest.paymentSentAt && (
                <> Submitted {formatDate(viewingReceiptRequest.paymentSentAt)}.</>
              )}
            </p>
            {viewingReceiptRequest.receiptUrl && (
              <img
                src={viewingReceiptRequest.receiptUrl}
                alt={`Payment receipt for request ${viewingReceiptRequest.displayId}`}
                style={{ maxHeight: '360px', maxWidth: '100%', objectFit: 'contain', alignSelf: 'center' }}
              />
            )}
          </div>
        )}
      </Modal>
      {commentingRequest && (
        <RequestCommentsModal
          isOpen
          onClose={() => setCommentingRequest(null)}
          request={commentingRequest}
          onCommentsRead={markCommentsRead}
        />
      )}

      <Modal
        isOpen={isCreateRequestOpen}
        onClose={() => setIsCreateRequestOpen(false)}
        title="Create a Document Request"
        maxWidth="700px"
      >
        <div className="request-create-modal">
          <CreateRequest embedded onRequestCreated={refreshRequests} />
        </div>
      </Modal>

      {/* 6. Online Payment and Receipt Modal */}
      <Modal
        isOpen={!!paymentRequest}
        onClose={closeUploadModal}
        title="Payment Method / Receipt"
        maxWidth="520px"
      >
        {paymentRequest && (
          <>
            <p className="modal-text">
              Payment for request <strong>{paymentRequest.displayId}</strong>:{' '}
              <strong>{new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: paymentRequest.feeCurrency || 'PHP',
              }).format(paymentRequest.feeAmount)}</strong>
            </p>
            {paymentRequest.rawStatus === 'awaiting_payment' && (
              <>
                <label className="auth-label" htmlFor="requestPaymentMethod">
                  Payment method
                </label>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <select
                    id="requestPaymentMethod"
                    className="auth-input"
                    value={selectedPaymentMethod}
                    onChange={(event) => setSelectedPaymentMethod(event.target.value)}
                    disabled={isSavingPaymentMethod || isUploading}
                  >
                    <option value="Online">Online Payment (GCash/Bank)</option>
                    <option value="Pay at the Office">Pay at the Office (Cashier)</option>
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handlePaymentMethodChange}
                    disabled={
                      isSavingPaymentMethod ||
                      isUploading ||
                      selectedPaymentMethod === paymentRequest.paymentMethod
                    }
                  >
                    {isSavingPaymentMethod ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            )}
            {paymentRequest.rawStatus === 'awaiting_payment' &&
              paymentRequest.paymentMethod === 'Online' && (
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div
                  role="img"
                  aria-label="Mock QR code placeholder"
                  style={{
                    width: '160px',
                    height: '160px',
                    backgroundColor: '#e9ecef',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    fontSize: '3rem',
                  }}
                >
                  📱
                </div>
                <p className="dashboard-subtext" style={{ marginBottom: 0 }}>
                  Mock QR placeholder for testing only. No payment will be processed.
                  Scan with your payment app, then attach your receipt below.
                </p>
              </div>
            )}
            {paymentRequest.paymentMethod === 'Pay at the Office' ? (
              <p className="modal-text">
                Please pay at the Cashier’s Office. You can switch back to online payment any time before payment is confirmed.
              </p>
            ) : (
              <>
                <p className="modal-text">
                  Attach a picture of your GCash or bank transfer receipt for Finance to verify.
                </p>
                <form className="modal-form" onSubmit={handleUploadSubmit} data-action-cooldown="protected">
              <label className="auth-label" htmlFor="paymentReference">
                Payment reference number (optional)
              </label>
              <input
                id="paymentReference"
                className="auth-input payment-reference-input"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                maxLength={255}
                disabled={isUploading}
              />

              <input
                id="paymentReceiptFile"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-required="true"
                disabled={isUploading}
                className="receipt-file-input"
                aria-label="Choose payment receipt image"
                onChange={handleFileChange}
              />
              {previewUrl ? (
                <div className="receipt-selected-card">
                  <img src={previewUrl} alt="Selected receipt preview" />
                  <div className="receipt-selected-info">
                    <strong>Receipt ready to upload</strong>
                    <span>{selectedFile.name}</span>
                    <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Image preview</span>
                  </div>
                  <label
                    className="receipt-change-button"
                    htmlFor="paymentReceiptFile"
                  >
                    Change
                  </label>
                </div>
              ) : (
                <label className="receipt-upload-zone" htmlFor="paymentReceiptFile">
                  <span className="receipt-upload-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
                    </svg>
                  </span>
                  <strong>Choose your receipt image</strong>
                  <span>PNG, JPG, or WebP · Up to 5 MB</span>
                  <span className="receipt-upload-browse">Browse files</span>
                </label>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeUploadModal} disabled={isUploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isUploading || !selectedFile}>
                  {isUploading ? 'Uploading...' : 'Submit'}
                </button>
              </div>
                </form>
              </>
            )}
          </>
        )}
      </Modal>

    </div>
  );
}

export default Dashboard;