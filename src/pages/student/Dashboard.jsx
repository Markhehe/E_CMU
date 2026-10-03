import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/ui/StatusBadge';
import ClearanceBadge from '../../components/ui/ClearanceBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import Modal from '../../components/ui/Modal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import '../../styles/dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { requests, isLoading } = useRequests();
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const { addToast } = useToast();

  const [uploadingRequestId, setUploadingRequestId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null); 

  // ==========================================
  // NEW: FILE UPLOAD PREVIEW STATES
  // ==========================================
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
    if (previewUrl) URL.revokeObjectURL(previewUrl); // Clear memory
    setPreviewUrl(null);
  };
  // ==========================================

  const studentRequests = requests.filter(req => req.studentId === currentUser?.id);
  const activeMenuRequest = studentRequests.find(req => req.id === openMenuId);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return; // Safety check

    setIsUploading(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); 
    addToast('Receipt uploaded successfully. Awaiting Finance verification.', 'success');
    setIsUploading(false);
    
    closeUploadModal(); // Use the new cleanup function
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null); 
  };

  return (
    <div className="dashboard-page">
      
      {/* 1. Page Header (Now matches Admin/Finance/SASO styling) */}
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: 'var(--imperial-blue)', fontFamily: 'var(--font-heading)' }}>
          Student Dashboard
        </h1>
        <p className="dashboard-subtext" style={{ margin: '0.25rem 0 0 0' }}>
          Track the status of your documents, payments, and clearances.
        </p>
        <p className="header-note" style={{ marginTop: '0.25rem' }}>
          * Note: Clearance requirements vary by document. Not all requests require SASO approval.
        </p>
      </header>

      {/* 2. Table Toolbar (Right-aligned above the table) */}
      <div 
        className="table-toolbar" 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '0.75rem',
          marginTop: '-2.5rem', // Preserved your specific margin
          marginBottom: '1.5rem'
        }}
      >
        <button 
          className="btn-primary" 
          onClick={() => navigate('/student/create-request')}
        >
          + Request New Document
        </button>
      </div>

      {/* 3. The Table */}
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
              <TableSkeleton columns={5} rows={5} />
            ) : studentRequests.length === 0 ? (
              <TableEmptyState 
                colSpan={5} 
                title="No active requests" 
                subtext="When you request a document, it will appear here." 
              />
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

      {/* 4. Action Menu */}
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

      {/* 5. Reusable Request Details Modal */}
      <RequestDetailsModal 
        isOpen={!!viewingRequest} 
        onClose={() => setViewingRequest(null)} 
        request={viewingRequest} 
      />

      {/* 6. Upload Receipt Modal */}
      <Modal 
        isOpen={!!uploadingRequestId} 
        onClose={closeUploadModal} 
        title="Upload Receipt"
      >
        <p className="modal-text">
          Please attach your GCash or Bank Transfer proof of payment for request <strong>{uploadingRequestId}</strong>.
        </p>
        <form className="modal-form" onSubmit={handleUploadSubmit}>
          
          {/* NEW: THE PREVIEW BOX */}
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