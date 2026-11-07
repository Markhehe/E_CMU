import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import StudentClearancePanel from '../../components/ui/StudentClearancePanel';
import { useStudentClearance } from '../../hooks/useStudentClearance';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import RequestCommentsModal from '../../components/ui/RequestCommentsModal';
import Modal from '../../components/ui/Modal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import RequestPagination from '../../components/ui/RequestPagination';
import StudentActiveDocumentsPanel from '../../components/ui/StudentActiveDocumentsPanel';
import { useRequestDisplay } from '../../hooks/useRequestDisplay';
import CreateRequest from './CreateRequest';

// NEW: Extracted Modals (You will need to create these files)
import UploadPaymentModal from './modals/UploadPaymentModal';
import DeleteRequestModal from './modals/DeleteRequestModal';

import '../../styles/dashboard.css';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const {
    clearance,
    isLoading: isClearanceLoading,
    isUploading: isClearanceUploading,
    isDeleting: isClearanceDeleting,
    isVerified: hasVerifiedClearance,
    submitClearance,
    deletePendingClearance,
  } = useStudentClearance();
  
  const {
    requests,
    isLoading,
    refreshRequests,
    markCommentsRead,
    requestEtaUpdate,
  } = useRequests();
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();

  // Modal State Management
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewingReceiptRequest, setViewingReceiptRequest] = useState(null);
  const [commentingRequest, setCommentingRequest] = useState(null);
  const [focusCommentId, setFocusCommentId] = useState(null);
  const [notificationDetails, setNotificationDetails] = useState(null);
  const [overdueRequest, setOverdueRequest] = useState(null);
  const [isRequestingEta, setIsRequestingEta] = useState(false);
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);

  // Clearance File State
  const [selectedClearanceFile, setSelectedClearanceFile] = useState(null);
  const [selectedClearancePreview, setSelectedClearancePreview] = useState(null);
  const [clearanceFileInputKey, setClearanceFileInputKey] = useState(0);

  const handleClearanceFileChange = (file) => {
    setSelectedClearanceFile(file);
    if (!file) setClearanceFileInputKey((key) => key + 1);
    
    if (file?.type.startsWith('image/')) {
      setSelectedClearancePreview(URL.createObjectURL(file));
    } else {
      setSelectedClearancePreview(null);
    }
  };

  const studentRequests = useMemo(
    () => requests.filter((req) => req.requesterId === currentUser?.id),
    [currentUser?.id, requests],
  );

  // Handle Hash Navigation (for Clearance section)
  useEffect(() => {
    if (location.hash !== '#student-clearance') return;
    const timeoutId = window.setTimeout(() => {
      document.getElementById('student-clearance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [location.hash]);

  // Handle Incoming Notifications from Router State
  useEffect(() => {
    const notification = location.state?.notification;
    if (!notification || isLoading) return;

    const timeoutId = window.setTimeout(() => {
      // Reset all modals first
      setViewingRequest(null);
      setCommentingRequest(null);
      setNotificationDetails(null);
      setOverdueRequest(null);
      setViewingReceiptRequest(null);
      setPaymentRequest(null);
      setIsCreateRequestOpen(false);
      setIsClearanceModalOpen(false);

      const request = studentRequests.find((item) => item.id === String(notification.requestId));
      
      if (notification.type.startsWith('clearance_') || notification.type === 'request_declined') {
        setNotificationDetails(notification);
      } else if (request) {
        if (notification.type === 'request_comment') {
          setFocusCommentId(notification.commentId);
          setCommentingRequest(request);
        } else if (notification.type === 'document_overdue') {
          setOverdueRequest(request);
        } else {
          setViewingRequest(request);
        }
      } else {
        addToast('The request linked to this notification is no longer available.', 'info');
      }
      navigate({ pathname: location.pathname, hash: location.hash }, { replace: true, state: null });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [addToast, isLoading, location.hash, location.pathname, location.state, navigate, studentRequests]);

  const {
    mode,
    visibleRequests,
    currentPage,
    totalPages,
    requestsPerPage,
    setCurrentPage,
    tableWrapperRef,
  } = useRequestDisplay(studentRequests, 'student-pagination', 5, 'pagination');

  const activeMenuRequest = studentRequests.find(req => req.id === openMenuId);

  const handleCreateRequestClick = () => {
    if (!hasVerifiedClearance) {
      addToast('Clearance required.', 'warning');
      setIsClearanceModalOpen(true);
      return;
    }
    setIsCreateRequestOpen(true);
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null);
  };

  const handleRequestEtaUpdate = async () => {
    if (!overdueRequest || isRequestingEta) return;
    setIsRequestingEta(true);
    try {
      const result = await requestEtaUpdate(overdueRequest.id);
      if (result) setOverdueRequest(null);
    } finally {
      setIsRequestingEta(false);
    }
  };

  return (
    <div className="dashboard-page student-dashboard-page">
      <header className="dashboard-header-container">
        <div className="header-content">
          <h1 className="dashboard-title">Student Dashboard</h1>
          <p className="dashboard-subtext">Track the status of your documents, payments, and clearances.</p>
          <p className="header-note">* Note: This portal assumes that online payment is available for the finance office and a method of delivery is available.</p>
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
        </div>
      </header>

      <div className="student-dashboard-overview">
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
        <StudentActiveDocumentsPanel
          requests={studentRequests}
          onViewDetails={handleViewDetails}
          onViewOverdue={setOverdueRequest}
        />
      </div>

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
              <TableEmptyState colSpan={4} title="No active requests" subtext="When you request a document, it will appear here." />
            ) : (
              visibleRequests.map((req) => (
                <tr
                  key={req.id}
                  className="request-row-clickable"
                  tabIndex={0}
                  aria-label={`View details for request ${req.id}`}
                  onClick={() => handleViewDetails(req)}
                >
                  <td className="doc-name-cell">
                    <button
                      type="button"
                      className="doc-name dashboard-request-document"
                      onClick={(e) => { e.stopPropagation(); handleViewDetails(req); }}
                    >
                      {req.docType}
                    </button>
                    <div className="doc-meta">ID: {req.displayId || req.id} &nbsp;|&nbsp; QTY: {req.quantity}</div>
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  <td className="col-status-cell" style={{ textAlign: 'center' }}>
                    <div className="status-stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StatusBadge status={req.status} />
                      {req.rawStatus === 'pending_payment' && req.hasReceipt && (
                        <span className="status-alert">Receipt submitted - awaiting Registrar</span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <div className="workflow-inline-actions">
                      {req.rawStatus === 'pending_payment' && !req.hasReceipt && (
                        <button
                          type="button"
                          className="workflow-step-button is-payment-action"
                          onClick={(e) => { e.stopPropagation(); setPaymentRequest(req); setOpenMenuId(null); }}
                        >
                          Upload payment proof
                        </button>
                      )}
                      <button
                        type="button"
                        className={`workflow-step-button workflow-action-button${req.hasUnreadComments ? ' has-unread-comments' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setCommentingRequest(req); }}
                      >
                        Comments <span className="request-comment-count">{req.commentCount}</span>
                      </button>
                      <button
                        type="button"
                        className="actions-button"
                        onClick={(e) => { e.stopPropagation(); toggleMenu(e, req.id); }}
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

      {!isLoading && mode === 'pagination' && (
        <RequestPagination
          currentPage={currentPage}
          totalPages={totalPages}
          requestsPerPage={requestsPerPage}
          totalRequests={studentRequests.length}
          onPageChange={setCurrentPage}
        />
      )}

      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords}>
          <button type="button" onClick={() => handleViewDetails(activeMenuRequest)}>View Details</button>
          {activeMenuRequest.hasReceipt && (
            <button type="button" onClick={() => { setViewingReceiptRequest(activeMenuRequest); setOpenMenuId(null); }}>
              View Uploaded Receipt
            </button>
          )}
          {activeMenuRequest.rawStatus === 'pending_review' && (
            <button type="button" className="text-danger" onClick={() => { setRequestToDelete(activeMenuRequest); setOpenMenuId(null); }}>
              Delete request
            </button>
          )}
        </div>
      )}

      {/* --- EXTRACTED MODALS --- */}
      <UploadPaymentModal 
        isOpen={!!paymentRequest} 
        onClose={() => setPaymentRequest(null)} 
        request={paymentRequest} 
        onSuccess={refreshRequests} 
      />
      
      <DeleteRequestModal 
        isOpen={!!requestToDelete} 
        onClose={() => setRequestToDelete(null)} 
        request={requestToDelete} 
        onSuccess={refreshRequests} 
      />

      {/* --- LIGHTWEIGHT MODALS REMAIN INLINE --- */}
      <RequestDetailsModal isOpen={!!viewingRequest} onClose={() => setViewingRequest(null)} request={viewingRequest} />
      <RequestCommentsModal isOpen={!!commentingRequest} onClose={() => setCommentingRequest(null)} request={commentingRequest} onCommentsRead={markCommentsRead} focusCommentId={focusCommentId} />
      
      <Modal isOpen={isClearanceModalOpen} onClose={() => setIsClearanceModalOpen(false)} title="Clearance required" maxWidth="620px">
        <StudentClearancePanel
          clearance={clearance} isLoading={isClearanceLoading} isUploading={isClearanceUploading} isDeleting={isClearanceDeleting}
          onSubmit={submitClearance} onDelete={deletePendingClearance} selectedFile={selectedClearanceFile}
          selectedImagePreview={selectedClearancePreview} fileInputKey={clearanceFileInputKey} onSelectedFileChange={handleClearanceFileChange}
        />
      </Modal>

      <Modal
        isOpen={Boolean(overdueRequest)}
        onClose={() => setOverdueRequest(null)}
        title="Document is overdue"
        maxWidth="520px"
      >
        {overdueRequest && (
          <div className="student-overdue-details">
            <p>
              The estimated time of availability for <strong>{overdueRequest.docType}</strong>
              {' '}({overdueRequest.displayId}) has passed, and the document has not been marked ready.
            </p>
            {overdueRequest.etaUpdateRequestedAt ? (
              <p className="student-overdue-requested" role="status">
                Your request for an ETA update has been sent to the Registrar.
              </p>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleRequestEtaUpdate}
                disabled={isRequestingEta}
              >
                {isRequestingEta ? 'Sending request...' : 'Request for ETA update'}
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isCreateRequestOpen} onClose={() => setIsCreateRequestOpen(false)} title="Create a Document Request" maxWidth="700px">
        <div className="request-create-modal">
          <CreateRequest embedded onRequestCreated={refreshRequests} clearanceState={{ clearance, isLoading: isClearanceLoading, isUploading: isClearanceUploading, isDeleting: isClearanceDeleting, isVerified: hasVerifiedClearance, submitClearance, deletePendingClearance, selectedFile: selectedClearanceFile, selectedImagePreview: selectedClearancePreview, fileInputKey: clearanceFileInputKey, onSelectedFileChange: handleClearanceFileChange }} />
          <p className="request-review-note">Note: Wait for the Registrar to review your request.</p>
        </div>
      </Modal>
      
      <Modal isOpen={!!notificationDetails} onClose={() => setNotificationDetails(null)} title={notificationDetails?.title || 'Notification'} maxWidth="520px">
        {notificationDetails && (
          <div className="student-notification-details">
            <p>{notificationDetails.message}</p>
          </div>
        )}
      </Modal>
      
      <Modal isOpen={!!viewingReceiptRequest} onClose={() => setViewingReceiptRequest(null)} title="Uploaded Payment Receipt">
        {viewingReceiptRequest && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <p className="modal-text">Payment for <strong>{viewingReceiptRequest.displayId}</strong>.</p>
             {viewingReceiptRequest.receiptUrl && (
               <img src={viewingReceiptRequest.receiptUrl} alt="Receipt" style={{ maxHeight: '360px', objectFit: 'contain' }} />
             )}
             {viewingReceiptRequest.requestCopyUrl && (
               <a href={viewingReceiptRequest.requestCopyUrl} target="_blank" rel="noreferrer">View request copy</a>
             )}
           </div>
        )}
      </Modal>

    </div>
  );
}

export default Dashboard;