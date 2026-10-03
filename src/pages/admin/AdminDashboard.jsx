import { useState, useEffect } from 'react';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState'; // NEW: Imported Empty State
import '../../styles/dashboard.css';

function AdminDashboard() {
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
  const [viewingRequest, setViewingRequest] = useState(null); 
  
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setSearchTerm(debouncedSearch);
  }, [debouncedSearch, setSearchTerm]);

  const activeMenuRequest = requests.find(req => req.id === openMenuId);

  const handleStatusUpdate = (id, newStatus) => {
    updateStatus(id, newStatus);
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
          Registrar Control Panel
        </h1>
        <p className="dashboard-subtext" style={{ margin: '0.25rem 0 0 0' }}>
          Manage and process incoming student document requests.
        </p>
      </header>

      {/* 2. The Table Toolbar */}
      <div 
        className="table-toolbar" 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '0.75rem',
          marginTop: '-1.5rem',
          marginBottom: '1rem'
        }}
      >
        <input 
          type="text" 
          placeholder="Search Name or ID..." 
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
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
          <option value="DOC_ASC">Sort: Document (A-Z)</option>
          <option value="STATUS_ASC">Sort: Status (Action Needed)</option>
          <option value="STATUS_DESC">Sort: Status (Completed First)</option>
        </select>

        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="toolbar-select"
        >
          <option value="ALL">Filter: All Statuses</option>
          <option value="PENDING PAYMENT">Filter: Pending</option>
          <option value="PROCESSING">Filter: Processing</option>
          <option value="READY FOR PICKUP">Filter: Ready</option>
          <option value="COMPLETED">Filter: Completed</option>
        </select>
      </div>

      {/* 3. The Table */}
      <div className="request-table-wrapper">
        <table className="request-table">
          <thead>
            <tr>
              <th className="col-id" style={{ width: '15%' }}>Request ID</th>
              <th className="col-student" style={{ width: '25%' }}>Student Details</th>
              <th className="col-doc">Document</th>
              <th className="col-date">Date</th>
              <th className="col-status">Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : requests.length > 0 ? (
              requests.map((req) => (
                <tr key={req.id}>
                  <td className="doc-name-cell">
                    <span className="doc-name">{req.id}</span>
                  </td>
                  <td>
                    <strong style={{ color: '#212529' }}>{req.studentName}</strong><br/>
                    <span className="doc-meta">{req.studentId}</span>
                  </td>
                  <td className="doc-name-cell" title={req.docType}>
                    <span style={{ color: '#495057', fontWeight: '500' }}>{req.docType}</span>
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  <td>
                    <StatusBadge status={req.status} />
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
                title="No matching requests found" 
                subtext="Try adjusting your search query or status filter." 
              />
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Action Menu */}
      {openMenuId && activeMenuRequest && (
        <div 
          className="actions-menu-fixed"
          style={menuCoords}
        >
          <button onClick={() => handleViewDetails(activeMenuRequest)}>View Details</button>
          
          <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }}></div>
          
          <button onClick={() => handleStatusUpdate(openMenuId, 'PROCESSING')}>Mark as Processing</button>
          <button onClick={() => handleStatusUpdate(openMenuId, 'READY FOR PICKUP')}>Ready for Pickup</button>
          
          <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }}></div>
          
          <button style={{ color: 'var(--status-success, #28a745)' }} onClick={() => handleStatusUpdate(openMenuId, 'COMPLETED')}>Mark as Completed</button>
          <button style={{ color: 'var(--status-danger, #dc3545)' }} onClick={() => handleStatusUpdate(openMenuId, 'REJECTED')}>Reject Request</button>
        </div>
      )}

      {/* 5. Details Modal */}
      <RequestDetailsModal 
        isOpen={!!viewingRequest} 
        onClose={() => setViewingRequest(null)} 
        request={viewingRequest} 
      />
    </div>
  );
}

export default AdminDashboard;