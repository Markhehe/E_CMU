import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import ClearanceBadge from '../../components/ui/ClearanceBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import Modal from '../../components/ui/Modal';
import TableSkeleton from '../../components/ui/TableSkeleton'; // NEW: Imported Skeleton
import '../../styles/dashboard.css';

function Dashboard() {
  const { currentUser } = useAuth();
  const { requests, isLoading } = useRequests();
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const { addToast } = useToast();

  const [uploadingRequestId, setUploadingRequestId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null); 

  const studentRequests = requests.filter(req => req.studentId === currentUser?.id);
  const activeMenuRequest = studentRequests.find(req => req.id === openMenuId);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); 
    addToast('Receipt uploaded successfully. Awaiting Finance verification.', 'success');
    setIsUploading(false);
    setUploadingRequestId(null);
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null); 
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header-container">
        <div className="header-content">
          <h1>Student Dashboard</h1>
          <p className="dashboard-subtext">
            Track the status of your documents, payments, and clearances.
          </p>
          <p className="header-note">
            * Note: Clearance requirements vary by document. Not all requests require SASO approval.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-primary" onClick={() => window.location.href = '/student/create-request'}>
            + Request Document
          </button>
        </div>
      </header>

      <div className="request-table-wrapper">
        <table className="request-table">
          <thead>
            <tr>
              <th className="col-doc">Document</th>
              <th className="col-date">Date Requested</th>
              <th className="col-clearance">SASO Clearance</th>
              <th className="col-status">Payment & Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // NEW: Render the Skeleton Loader (5 columns for Students)
              <TableSkeleton columns={5} rows={5} />
            ) : studentRequests.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '6rem 0' }}>
                  <p className="doc-name" style={{ fontSize: '1.1rem', margin: 0 }}>No active requests</p>
                  <p className="dashboard-subtext" style={{ marginTop: '0.5rem' }}>When you request a document, it will appear here.</p>
                </td>
              </tr>
            ) : (
              studentRequests.map((req) => (
                <tr key={req.id}>
                  <td className="doc-name-cell" title={req.docType}>
                    <span className="doc-name">{req.docType}</span>
                    <div className="doc-meta">ID: {req.id} &nbsp;|&nbsp; QTY: {req.quantity}</div>
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  <td><ClearanceBadge isCleared={req.sasoCleared} /></td>
                  <td>
                    <div className="status-stack">
                      <StatusBadge status={req.status} />
                      {req.paymentMethod === 'Online' && !req.hasReceipt && req.status !== 'REJECTED' && (
                        <span className="status-alert">Awaiting Receipt</span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <button className="actions-button" onClick={(e) => toggleMenu(e, req.id)}>⋮</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords}>
          <button onClick={() => handleViewDetails(activeMenuRequest)}>View Details</button>
          
          {activeMenuRequest.paymentMethod === 'Online' && !activeMenuRequest.hasReceipt && (
            <button className="highlight-action" onClick={() => { setUploadingRequestId(openMenuId); setOpenMenuId(null); }}>
              Upload Receipt
            </button>
          )}
          {activeMenuRequest.hasReceipt && (
            <button onClick={() => setOpenMenuId(null)}>View Uploaded Receipt</button>
          )}
        </div>
      )}

      {/* Reusable Request Details Modal */}
      <RequestDetailsModal 
        isOpen={!!viewingRequest} 
        onClose={() => setViewingRequest(null)} 
        request={viewingRequest} 
      />

      {/* Upload Receipt Modal */}
      <Modal 
        isOpen={!!uploadingRequestId} 
        onClose={() => !isUploading && setUploadingRequestId(null)} 
        title="Upload Receipt"
      >
        <p className="modal-text">
          Please attach your GCash or Bank Transfer proof of payment for request <strong>{uploadingRequestId}</strong>.
        </p>
        <form className="modal-form" onSubmit={handleUploadSubmit}>
          <input type="file" accept="image/*" required disabled={isUploading} className="form-input" />
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setUploadingRequestId(null)} disabled={isUploading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

export default Dashboard;