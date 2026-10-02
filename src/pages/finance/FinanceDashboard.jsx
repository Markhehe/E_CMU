import { useState } from 'react';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import Modal from '../../components/ui/Modal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState'; // NEW: Imported Empty State
import '../../styles/dashboard.css';

function FinanceDashboard() {
  const { 
    requests, 
    isLoading, 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter, 
    updateStatus,
    sortOption,
    setSortOption
  } = useRequests();
  
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const { addToast } = useToast();
  
  const [viewingRequest, setViewingRequest] = useState(null); 
  const [viewingReceiptId, setViewingReceiptId] = useState(null);

  const financeRequests = requests.filter(req => 
    req.status === 'PENDING PAYMENT' || req.status === 'PROCESSING' || req.hasReceipt
  );

  const activeMenuRequest = financeRequests.find(req => req.id === openMenuId);

  const handleVerifyPayment = (id) => {
    updateStatus(id, 'PROCESSING');
    addToast(`Payment verified for request ${id}.`, 'success');
    setOpenMenuId(null);
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null); 
  };

  return (
    <div className="dashboard-page">
      
      {/* 1. Page Header */}
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: 'var(--imperial-blue)', fontFamily: 'var(--font-heading)' }}>
          Finance Control Panel
        </h1>
        <p className="dashboard-subtext" style={{ margin: '0.25rem 0 0 0' }}>
          Verify online receipts and log over-the-counter payments.
        </p>
      </header>

      {/* 2. Table Toolbar */}
      <div 
        className="table-toolbar" 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '0.75rem',
          marginTop: '0.5rem',
          marginBottom: '1rem'
        }}
      >
        <input 
          type="text" 
          placeholder="Search Name or ID..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="toolbar-input"
        />
        
        <select 
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="toolbar-select"
        >
          <option value="DATE_DESC">Sort: Date (Newest)</option>
          <option value="DATE_ASC">Sort: Date (Oldest)</option>
          <option value="ID_ASC">Sort: ID (Ascending)</option>
          <option value="ID_DESC">Sort: ID (Descending)</option>
          <option value="NAME_ASC">Sort: Name (A-Z)</option>
          <option value="NAME_DESC">Sort: Name (Z-A)</option>
          <option value="STATUS_ASC">Sort: Status (Action Needed)</option>
          <option value="STATUS_DESC">Sort: Status (Completed First)</option>
        </select>

        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="toolbar-select"
        >
          <option value="ALL">Filter: All Payments</option>
          <option value="PENDING PAYMENT">Filter: Pending</option>
          <option value="PROCESSING">Filter: Verified</option>
        </select>
      </div>

      {/* 3. The Table */}
      <div className="request-table-wrapper">
        <table className="request-table">
          <thead>
            <tr>
              <th className="col-id" style={{ width: '12%' }}>ID</th>
              <th className="col-student" style={{ width: '23%' }}>Student Details</th>
              <th className="col-date" style={{ width: '15%' }}>Date</th>
              <th className="col-payment" style={{ width: '17%' }}>Payment Method</th>
              <th className="col-status" style={{ width: '25%' }}>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : financeRequests.length > 0 ? (
              financeRequests.map((req) => (
                <tr key={req.id}>
                  <td className="doc-name-cell">
                    <span className="doc-name">{req.id}</span>
                  </td>
                  <td>
                    <strong style={{ color: '#212529' }}>{req.studentName}</strong><br/>
                    <span className="doc-meta">{req.studentId}</span>
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  <td style={{ color: '#495057' }}>{req.paymentMethod}</td>
                  <td>
                    <div className="status-stack">
                      <StatusBadge status={req.status} />
                      {req.paymentMethod === 'Online' && req.hasReceipt && req.status === 'PENDING PAYMENT' && (
                        <span style={{ fontSize: '0.7rem', color: '#12b886', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Receipt Uploaded
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="actions-button" 
                      onClick={(e) => toggleMenu(e, req.id)}
                      aria-label="Open Actions Menu"
                      aria-expanded={openMenuId === req.id}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              // NEW: Reusable Graphic Empty State
              <TableEmptyState 
                colSpan={6} 
                title="No matching payments found" 
                subtext="Try adjusting your search query or filter." 
              />
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Action Menu */}
      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords}>
          <button onClick={() => handleViewDetails(activeMenuRequest)}>
            View Request Details
          </button>

          {activeMenuRequest.hasReceipt && (
            <button onClick={() => { setViewingReceiptId(activeMenuRequest.id); setOpenMenuId(null); }}>
              View Proof of Payment
            </button>
          )}
          
          <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }}></div>
          
          <button 
            className="highlight-action"
            onClick={() => handleVerifyPayment(openMenuId)}
          >
            Verify & Confirm Payment
          </button>
        </div>
      )}

      {/* 5. Modals */}
      <RequestDetailsModal 
        isOpen={!!viewingRequest} 
        onClose={() => setViewingRequest(null)} 
        request={viewingRequest} 
      />

      <Modal 
        isOpen={!!viewingReceiptId} 
        onClose={() => setViewingReceiptId(null)} 
        title="Proof of Payment"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p className="dashboard-subtext" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
            Receipt for Request <strong>{viewingReceiptId}</strong>
          </p>
          <div style={{ 
            width: '100%', height: '350px', backgroundColor: '#f8f9fa', 
            border: '2px dashed var(--border-light)', borderRadius: '8px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            [ Receipt Image Placeholder ]
          </div>
          <button 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '1.5rem' }} 
            onClick={() => setViewingReceiptId(null)}
          >
            Close
          </button>
        </div>
      </Modal>

    </div>
  );
}

export default FinanceDashboard;