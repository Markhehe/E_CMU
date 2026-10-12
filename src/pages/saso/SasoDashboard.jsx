/**
 * Component: SasoDashboard (SASO Clearance Panel)
 * Manages student clearance holds, disciplinary reviews, and clearance status toggles
 * for university document requests.
 */

import { useState, useEffect } from 'react';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import ClearanceBadge from '../../components/ui/ClearanceBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import RequestCommentsModal from '../../components/ui/RequestCommentsModal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import RequestDisplaySelect from '../../components/ui/RequestDisplaySelect';
import RequestPagination from '../../components/ui/RequestPagination';
import { useRequestDisplay } from '../../hooks/useRequestDisplay';
import '../../styles/dashboard.css';

function SasoDashboard() {
  const {
    requests,
    isLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    toggleClearance,
    markCommentsRead,
    sortOption,
    setSortOption,
  } = useRequests();

  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setSearchTerm(debouncedSearch);
  }, [debouncedSearch, setSearchTerm]);

  const [viewingRequest, setViewingRequest] = useState(null);
  const [commentingRequest, setCommentingRequest] = useState(null);

  const {
    mode,
    setMode,
    visibleRequests,
    currentPage,
    totalPages,
    requestsPerPage,
    setCurrentPage,
    tableWrapperRef,
  } = useRequestDisplay(requests, 'saso', 5, 'pagination');

  const activeMenuRequest = requests.find((req) => req.id === openMenuId);

  const handleClearanceUpdate = async (id, isCleared) => {
    try {
      await toggleClearance(id, isCleared);
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
      {/* 1. Page Header */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">SASO Clearance Panel</h1>
        <p className="dashboard-subtext">
          Manage student disciplinary holds and institutional liabilities.
        </p>
      </header>

      {/* 2. Table Toolbar */}
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
            <option value="SASO REVIEW">Filter: Awaiting clearance</option>
            <option value="ON HOLD">Filter: On hold</option>
            <option value="PENDING PAYMENT">Filter: Pending</option>
            <option value="PROCESSING">Filter: Processing</option>
            <option value="READY FOR PICKUP">Filter: Ready</option>
            <option value="COMPLETED">Filter: Completed</option>
          </select>

          <RequestDisplaySelect mode={mode} onChange={setMode} />
        </div>
      </div>

      {/* 3. The Table */}
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
              <th className="col-id" style={{ width: '8%' }}>
                ID
              </th>
              <th className="col-student" style={{ width: '10%' }}>
                Student
              </th>
              <th className="col-doc" style={{ width: '12%' }}>
                Document
              </th>
              <th className="col-date" style={{ width: '8%' }}>
                Date
              </th>
              <th className="col-clearance" style={{ width: '12%', textAlign: 'center' }}>
                Clearance
              </th>
              <th className="col-status" style={{ width: '10%', textAlign: 'center' }}>
                Status
              </th>
              <th className="col-actions" style={{ width: '25%', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton columns={7} rows={5} />
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
                  <td className="doc-name-cell" title={req.docType} style={{ color: '#495057' }}>
                    {req.docType}
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  
                  {/* Center-aligned Clearance Badge Cell */}
                  <td className="col-clearance-cell" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ClearanceBadge isCleared={req.sasoCleared} />
                    </div>
                  </td>

                  {/* Center-aligned Status Badge Cell */}
                  <td className="col-status-cell" style={{ textAlign: 'center' }}>
                    <div className="status-stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StatusBadge status={req.status} />
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
                      {['registrar_approved', 'saso_review'].includes(req.rawStatus) && (
                        <button
                          type="button"
                          className="workflow-step-button is-positive"
                          data-action-cooldown="protected"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleClearanceUpdate(req.id, true);
                          }}
                        >
                          Clear
                        </button>
                      )}
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
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <TableEmptyState
                colSpan={7}
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

      {/* 5. Context Action Menu */}
      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords} data-action-context={activeMenuRequest.id}>
          <button type="button" onClick={() => handleViewDetails(activeMenuRequest)}>
            View Request Details
          </button>
          {['registrar_approved', 'saso_review'].includes(activeMenuRequest.rawStatus) && (
            <>
              <div className="actions-menu-divider" />
              <button
                type="button"
                className="text-danger"
                data-action-cooldown="protected"
                onClick={() => handleClearanceUpdate(openMenuId, false)}
              >
                Place on Hold
              </button>
            </>
          )}
        </div>
      )}

      {/* 6. Details Modal */}
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
    </div>
  );
}

export default SasoDashboard;