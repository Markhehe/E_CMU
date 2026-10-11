import { useState, useEffect } from 'react';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import RequestDisplaySelect from '../../components/ui/RequestDisplaySelect';
import RequestPagination from '../../components/ui/RequestPagination';
import { useRequestDisplay } from '../../hooks/useRequestDisplay';
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
    setSortOption,
  } = useRequests();

  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const [viewingRequest, setViewingRequest] = useState(null);

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setSearchTerm(debouncedSearch);
  }, [debouncedSearch, setSearchTerm]);

  const activeMenuRequest = requests.find((req) => req.id === openMenuId);

  const {
    mode,
    setMode,
    visibleRequests,
    currentPage,
    totalPages,
    requestsPerPage,
    setCurrentPage,
  } = useRequestDisplay(requests, 'admin', 5, 'pagination');

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateStatus(id, newStatus);
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null);
  };

  return (
    <div className="dashboard-page">
      {/* 1. Clean Title Header */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">Registrar Control Panel</h1>
        <p className="dashboard-subtext">
          Manage and process incoming student document requests.
        </p>
      </header>

      {/* 2. Dedicated Table Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            placeholder="Search Name or ID..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="toolbar-input"
          />
        </div>

        <div className="toolbar-right">
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
            <option value="ALL">Filter: All Statuses</option>
            <option value="PENDING PAYMENT">Filter: Pending</option>
            <option value="PROCESSING">Filter: Processing</option>
            <option value="READY FOR PICKUP">Filter: Ready</option>
            <option value="COMPLETED">Filter: Completed</option>
          </select>

          <RequestDisplaySelect mode={mode} onChange={setMode} />
        </div>
      </div>

      {/* 3. The Table */}
      <div className={`request-table-wrapper${mode === 'pagination' ? ' is-paginated' : ''}`}>
        <table className="request-table">
          <thead>
            <tr>
              <th className="col-id" style={{ width: '10%' }}>
                Request ID
              </th>
              <th className="col-student" style={{ width: '15%' }}>
                Student Details
              </th>
              <th className="col-doc" style={{ width: '15%' }}>
                Document
              </th>
              <th className="col-date" style={{ width: '10%' }}>
                Date
              </th>
              <th className="col-status" style={{ width: '10%', textAlign: 'center' }}>
                Status
              </th>
              <th className="col-actions" style={{ width: '8%', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : requests.length > 0 ? (
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
                  <td className="doc-name-cell">
                    <span className="doc-name">{req.displayId || req.id}</span>
                  </td>
                  <td>
                    <strong style={{ color: '#212529' }}>{req.studentName}</strong>
                    <br />
                    <span className="doc-meta">{req.studentId || 'N/A'}</span>
                  </td>
                  <td className="doc-name-cell" title={req.docType}>
                    <span style={{ color: '#495057', fontWeight: '500' }}>{req.docType}</span>
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>

                  {/* Center-aligned Status Badge Cell */}
                  <td className="col-status-cell" style={{ textAlign: 'center' }}>
                    <div className="status-stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StatusBadge status={req.status} />
                    </div>
                  </td>

                  <td className="actions-cell">
                    <button
                      type="button"
                      className="actions-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMenu(event, req.id);
                      }}
                      aria-label="Open Actions Menu"
                      aria-expanded={openMenuId === req.id}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <TableEmptyState
                colSpan={6}
                title="No matching requests found"
                subtext="Try adjusting your search query or status filter."
              />
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Pagination */}
      {!isLoading && mode === 'pagination' && (
        <RequestPagination
          currentPage={currentPage}
          totalPages={totalPages}
          requestsPerPage={requestsPerPage}
          totalRequests={requests.length}
          onPageChange={setCurrentPage}
        />
      )}

      {/* 5. Action Menu */}
      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords}>
          <button type="button" onClick={() => handleViewDetails(activeMenuRequest)}>
            View Details
          </button>
          <div className="actions-menu-divider" />
          <button type="button" onClick={() => handleStatusUpdate(openMenuId, 'PROCESSING')}>
            Mark as Processing
          </button>
          <button type="button" onClick={() => handleStatusUpdate(openMenuId, 'READY FOR PICKUP')}>
            Ready for Pickup
          </button>
          <div className="actions-menu-divider" />
          <button
            type="button"
            style={{ color: '#28a745' }}
            onClick={() => handleStatusUpdate(openMenuId, 'COMPLETED')}
          >
            Mark as Completed
          </button>
          <button
            type="button"
            style={{ color: '#dc3545' }}
            onClick={() => handleStatusUpdate(openMenuId, 'REJECTED')}
          >
            Reject Request
          </button>
        </div>
      )}

      {/* 6. Details Modal */}
      <RequestDetailsModal
        isOpen={!!viewingRequest}
        onClose={() => setViewingRequest(null)}
        request={viewingRequest}
      />
    </div>
  );
}

export default AdminDashboard;