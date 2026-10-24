import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import { DocumentService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentClearancePanel from '../../components/ui/StudentClearancePanel';
import { useStudentClearance } from '../../hooks/useStudentClearance';
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
  const {
    clearance,
    isLoading: isClearanceLoading,
    isUploading: isClearanceUploading,
    isDeleting: isClearanceDeleting,
    isVerified: hasVerifiedClearance,
    submitClearance,
    deletePendingClearance,
  } = useStudentClearance();
  const { requests, isLoading, refreshRequests, markCommentsRead } = useRequests();
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const { addToast } = useToast();

  const [paymentRequest, setPaymentRequest] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewingReceiptRequest, setViewingReceiptRequest] = useState(null);
  const [previewingUpload, setPreviewingUpload] = useState(null);
  const [commentingRequest, setCommentingRequest] = useState(null);
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);
  const [selectedClearanceFile, setSelectedClearanceFile] = useState(null);
  const [selectedClearancePreview, setSelectedClearancePreview] = useState(null);
  const [clearanceFileInputKey, setClearanceFileInputKey] = useState(0);
  const clearancePreviewRef = useRef(null);

  // File Upload Preview States
  const [selectedFile, setSelectedFile] = useState(null);
  const [requestCopyFile, setRequestCopyFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [requestCopyPreviewUrl, setRequestCopyPreviewUrl] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  useEffect(() => () => {
    if (clearancePreviewRef.current) {
      URL.revokeObjectURL(clearancePreviewRef.current);
    }
  }, []);

  const handleClearanceFileChange = (file) => {
    if (clearancePreviewRef.current) {
      URL.revokeObjectURL(clearancePreviewRef.current);
      clearancePreviewRef.current = null;
    }

    setSelectedClearanceFile(file);
    if (!file) setClearanceFileInputKey((key) => key + 1);
    if (file?.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      clearancePreviewRef.current = previewUrl;
      setSelectedClearancePreview(previewUrl);
    } else {
      setSelectedClearancePreview(null);
    }
  };

  const handleFileChange = (e, kind) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        addToast('Upload must be a PNG, JPEG, or WebP image.', 'error');
        e.target.value = '';
        if (kind === 'receipt') {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setSelectedFile(null);
          setPreviewUrl(null);
        } else {
          if (requestCopyPreviewUrl) URL.revokeObjectURL(requestCopyPreviewUrl);
          setRequestCopyFile(null);
          setRequestCopyPreviewUrl(null);
        }
        return;
      }
      if (file.size > 2.5 * 1024 * 1024) {
        addToast('Each uploaded image must be 2.5 MB or smaller.', 'error');
        e.target.value = '';
        if (kind === 'receipt') {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setSelectedFile(null);
          setPreviewUrl(null);
        } else {
          if (requestCopyPreviewUrl) URL.revokeObjectURL(requestCopyPreviewUrl);
          setRequestCopyFile(null);
          setRequestCopyPreviewUrl(null);
        }
        return;
      }
      if (kind === 'receipt') {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        if (requestCopyPreviewUrl) URL.revokeObjectURL(requestCopyPreviewUrl);
        setRequestCopyFile(file);
        setRequestCopyPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setPaymentRequest(null);
    setPreviewingUpload(null);
    setSelectedFile(null);
    setRequestCopyFile(null);
    setPaymentReference('');
    setTrackingCode('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (requestCopyPreviewUrl) URL.revokeObjectURL(requestCopyPreviewUrl);
    setPreviewUrl(null);
    setRequestCopyPreviewUrl(null);
  };

  const studentRequests = requests.filter(req => req.requesterId === currentUser?.id);

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

  const handleCreateRequestClick = () => {
    if (!hasVerifiedClearance) {
      addToast('Clearance required.', 'warning');
      setIsClearanceModalOpen(true);
      return;
    }

    setIsCreateRequestOpen(true);
  };

  const openPaymentModal = (request) => {
    setPaymentRequest(request);
    setTrackingCode(request.displayId);
    setOpenMenuId(null);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !requestCopyFile || !paymentRequest) return;

    setIsUploading(true);
    try {
      await DocumentService.submitPaymentDetails(paymentRequest.id, {
        paymentReference,
        receiptFile: selectedFile,
        requestCopyFile,
        trackingCode,
      });
      addToast('Payment receipt submitted for Registrar verification.', 'success');
      await refreshRequests();
      setPaymentRequest(null);
      setPreviewingUpload(null);
      setSelectedFile(null);
      setRequestCopyFile(null);
      setPaymentReference('');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (requestCopyPreviewUrl) URL.revokeObjectURL(requestCopyPreviewUrl);
      setPreviewUrl(null);
      setRequestCopyPreviewUrl(null);
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
    <div className="dashboard-page student-dashboard-page">

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
            * Note: Clearance requirements vary by document.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreateRequestClick}
            disabled={isClearanceLoading}
            title={isClearanceLoading ? 'Loading clearance status.' : undefined}
          >
            + Create a Document Request
          </button>
          <RequestDisplaySelect mode={mode} onChange={setMode} />
        </div>
      </header>

      <StudentClearancePanel
        clearance={clearance}
        isLoading={isClearanceLoading}
        isUploading={isClearanceUploading}
        isDeleting={isClearanceDeleting}
        onSubmit={submitClearance}
        onDelete={deletePendingClearance}
        selectedFile={selectedClearanceFile}
        selectedImagePreview={selectedClearancePreview}
        fileInputKey={clearanceFileInputKey}
        onSelectedFileChange={handleClearanceFileChange}
      />

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
              <th className="col-status" style={{ width: '15%' }}>Payment &amp; Status</th>
              <th className="col-actions" style={{ width: '25%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton columns={4} rows={5} />
            ) : studentRequests.length === 0 ? (
              <TableEmptyState
                colSpan={4}
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
                  <td className="col-status-cell" style={{ textAlign: 'center' }}>
                    <div className="status-stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StatusBadge status={req.status} />
                      {req.rawStatus === 'payment_review' && (
                        <span className="status-alert">Receipt submitted - awaiting Registrar</span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <div className="workflow-inline-actions">
                      {['approved', 'awaiting_payment', 'payment_review'].includes(req.rawStatus) && !req.hasReceipt ? (
                          <button
                            type="button"
                            className="workflow-step-button is-payment-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPaymentModal(req);
                            }}
                          >
                            Upload payment proof
                          </button>
                        ) : null}
                      <button
                        type="button"
                        className={`workflow-step-button workflow-action-button${req.hasUnreadComments ? ' has-unread-comments' : ''}`}
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
            {viewingReceiptRequest.requestCopyUrl && (
              <a href={viewingReceiptRequest.requestCopyUrl} target="_blank" rel="noreferrer">
                View uploaded request copy
              </a>
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
        isOpen={isClearanceModalOpen}
        onClose={() => setIsClearanceModalOpen(false)}
        title="Clearance required"
        maxWidth="620px"
      >
        <StudentClearancePanel
          clearance={clearance}
          isLoading={isClearanceLoading}
          isUploading={isClearanceUploading}
          isDeleting={isClearanceDeleting}
          onSubmit={submitClearance}
          onDelete={deletePendingClearance}
          selectedFile={selectedClearanceFile}
          selectedImagePreview={selectedClearancePreview}
          fileInputKey={clearanceFileInputKey}
          onSelectedFileChange={handleClearanceFileChange}
        />
      </Modal>

      <Modal
        isOpen={isCreateRequestOpen}
        onClose={() => setIsCreateRequestOpen(false)}
        title="Create a Document Request"
        maxWidth="700px"
      >
        <div className="request-create-modal">
          <CreateRequest
            embedded
            onRequestCreated={refreshRequests}
            clearanceState={{
              clearance,
              isLoading: isClearanceLoading,
              isUploading: isClearanceUploading,
              isDeleting: isClearanceDeleting,
              isVerified: hasVerifiedClearance,
              submitClearance,
              deletePendingClearance,
              selectedFile: selectedClearanceFile,
              selectedImagePreview: selectedClearancePreview,
              fileInputKey: clearanceFileInputKey,
              onSelectedFileChange: handleClearanceFileChange,
            }}
          />
        </div>
      </Modal>

      {/* 6. Cash payment proof upload */}
      <Modal
        isOpen={!!paymentRequest}
        onClose={closeUploadModal}
        title="Upload Cash Payment Proof"
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
            <p className="modal-text">
              Pay cash at the Finance Office. Upload a photo of the receipt and the printed request showing its tracking code, or show the physical receipt to the Registrar.
            </p>
            <form className="modal-form" onSubmit={handleUploadSubmit} data-action-cooldown="protected">
              <label className="auth-label" htmlFor="trackingCode">Request tracking code</label>
              <input
                id="trackingCode"
                className="auth-input"
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value.toUpperCase())}
                maxLength={6}
                pattern="[A-Fa-f0-9]{6}"
                required
                disabled={isUploading}
              />
              <label className="auth-label" htmlFor="requestCopyFile">Printed request copy</label>
              <div className="cash-payment-file-row">
                <input
                  id="requestCopyFile"
                  type="file"
                  className="cash-payment-file-input"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  disabled={isUploading}
                  onChange={(event) => handleFileChange(event, 'request')}
                />
                {requestCopyPreviewUrl && (
                  <button
                    type="button"
                    className="cash-payment-preview-button"
                    onClick={() => setPreviewingUpload({
                      src: requestCopyPreviewUrl,
                      title: 'Printed request copy',
                    })}
                    aria-label="Preview printed request copy"
                  >
                    Preview
                  </button>
                )}
              </div>
              <label className="auth-label" htmlFor="paymentReceiptFile">Cash receipt</label>
              <div className="cash-payment-file-row">
                <input
                  id="paymentReceiptFile"
                  type="file"
                  className="cash-payment-file-input"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  disabled={isUploading}
                  onChange={(event) => handleFileChange(event, 'receipt')}
                />
                {previewUrl && (
                  <button
                    type="button"
                    className="cash-payment-preview-button"
                    onClick={() => setPreviewingUpload({
                      src: previewUrl,
                      title: 'Cash receipt',
                    })}
                    aria-label="Preview cash receipt"
                  >
                    Preview
                  </button>
                )}
              </div>
              <label className="auth-label" htmlFor="paymentReference">
                Receipt/reference number (optional)
              </label>
              <input
                id="paymentReference"
                className="auth-input payment-reference-input"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                maxLength={255}
                disabled={isUploading}
              />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeUploadModal} disabled={isUploading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isUploading || !selectedFile || !requestCopyFile}>
                  {isUploading ? 'Uploading...' : 'Submit Proof'}
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(previewingUpload)}
        onClose={() => setPreviewingUpload(null)}
        title={previewingUpload?.title || 'Uploaded file preview'}
        maxWidth="620px"
        zIndex={10001}
      >
        {previewingUpload && (
          <img
            className="cash-payment-image-preview"
            src={previewingUpload.src}
            alt={`${previewingUpload.title} preview`}
          />
        )}
      </Modal>

    </div>
  );
}

export default Dashboard;