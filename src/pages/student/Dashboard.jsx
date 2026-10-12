import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
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

  const [uploadingRequestId, setUploadingRequestId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null); 
  const [commentingRequest, setCommentingRequest] = useState(null);
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);

  // File Upload Preview States
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setUploadingRequestId(null);
    setSelectedFile(null);
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

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); 
    addToast('Receipt uploaded successfully. Awaiting Finance verification.', 'success');
    setIsUploading(false);
    
    closeUploadModal();
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
                      {req.paymentMethod === 'Online' && !req.hasReceipt && req.status !== 'REJECTED' && (
                        <span className="status-alert">Awaiting Receipt</span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <div className="workflow-inline-actions">
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
          
          {activeMenuRequest.paymentMethod === 'Online' && !activeMenuRequest.hasReceipt && (
            <button type="button" className="highlight-action" onClick={() => { setUploadingRequestId(openMenuId); setOpenMenuId(null); }}>
              Upload Receipt
            </button>
          )}
          {activeMenuRequest.hasReceipt && (
            <button type="button" onClick={() => setOpenMenuId(null)}>View Uploaded Receipt</button>
          )}
        </div>
      )}

      {/* 5. Request Details Modal */}
      <RequestDetailsModal 
        isOpen={!!viewingRequest} 
        onClose={() => setViewingRequest(null)} 
        request={viewingRequest} 
      />
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

      {/* 6. Upload Receipt Modal */}
      <Modal 
        isOpen={!!uploadingRequestId} 
        closeUploadModal={closeUploadModal}
        onClose={closeUploadModal} 
        title="Upload Receipt"
      >
        <p className="modal-text">
          Please attach your GCash or Bank Transfer proof of payment for request <strong>{uploadingRequestId}</strong>.
        </p>
        <form className="modal-form" onSubmit={handleUploadSubmit} data-action-cooldown="protected">
          {previewUrl && (
            <div style={{ 
              width: '100%', 
              backgroundColor: '#f8f9fa', 
              border: '1px solid var(--border-light)', 
              borderRadius: '8px', 
              padding: '0.5rem', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              <img 
                src={previewUrl} 
                alt="Receipt Preview" 
                style={{ maxHeight: '240px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }} 
              />
            </div>
          )}

          <input 
            type="file" 
            accept="image/*" 
            required 
            disabled={isUploading} 
            className="form-input" 
            onChange={handleFileChange}
          />
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={closeUploadModal} disabled={isUploading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isUploading || !selectedFile}>
              {isUploading ? 'Uploading...' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

export default Dashboard;