/**
 * Component: FinanceDashboard (Finance Control Panel)
 * Manages cashier over-the-counter payments, online receipt verification (GCash/Bank),
 * and payment status updates for university document requests.
 */

import { useState, useEffect } from 'react';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import Modal from '../../components/ui/Modal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import RequestDisplaySelect from '../../components/ui/RequestDisplaySelect';
import RequestPagination from '../../components/ui/RequestPagination';
import { useRequestDisplay } from '../../hooks/useRequestDisplay';
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
    setSortOption,
  } = useRequests();

  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setSearchTerm(debouncedSearch);
  }, [debouncedSearch, setSearchTerm]);

  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewingReceiptRequest, setViewingReceiptRequest] = useState(null);

  // Filter requests relevant to finance verification
  const financeRequests = requests.filter(
    (req) =>
      req.status === 'PENDING PAYMENT' ||
      req.status === 'PROCESSING' ||
      req.hasReceipt ||
      req.paymentMethod === 'Online'
  );

  const {
    mode,
    setMode,
    visibleRequests,
    currentPage,
    totalPages,
    requestsPerPage,
    setCurrentPage,
  } = useRequestDisplay(financeRequests, 'finance', 5, 'pagination');

  const activeMenuRequest = financeRequests.find((req) => req.id === openMenuId);

  const handleVerifyPayment = async (id) => {
    try {
      await updateStatus(id, 'PROCESSING');
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null);
  };

  const handleViewReceipt = (request) => {
    setViewingReceiptRequest(request);
    setOpenMenuId(null);
  };

  return (
    <div className="dashboard-page">
      {/* 1. Page Header */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">Finance Control Panel</h1>
        <p className="dashboard-subtext">
          Verify online receipts and log over-the-counter cashier payments.
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

          <RequestDisplaySelect mode={mode} onChange={setMode} />
        </div>
      </div>

      {/* 3. The Table */}
      <div className={`request-table-wrapper${mode === 'pagination' ? ' is-paginated' : ''}`}>
        <table className="request-table">
          <thead>
            <tr>
              <th className="col-id" style={{ width: '10%' }}>
                ID
              </th>
              <th className="col-student" style={{ width: '15%' }}>
                Student Details
              </th>
              <th className="col-date" style={{ width: '10%' }}>
                Date
              </th>
              <th className="col-payment" style={{ width: '15%' }}>
                Payment Method
              </th>
              {/* Center-aligned STATUS Header */}
              <th className="col-status" style={{ width: '10%', textAlign: 'center' }}>
                Status
              </th>
              <th className="col-actions" style={{ width: '10%', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : financeRequests.length > 0 ? (
              visibleRequests.map((req) => (
                <tr
                  key={req.id}
                  className="request-row-clickable"
                  tabIndex={0}
                  aria-label={`View details for request ${req.id}`}
                  onClick={() => handleViewDetails(req)}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
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
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  <td style={{ color: '#495057', fontWeight: '500' }}>
                    {req.paymentMethod || 'Not recorded'}
                  </td>

                  {/* Center-aligned STATUS Cell */}
                  <td className="col-status-cell" style={{ textAlign: 'center' }}>
                    <div className="status-stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StatusBadge status={req.status} />
                      {req.paymentMethod === 'Online' &&
                        req.hasReceipt &&
                        req.status === 'PENDING PAYMENT' && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#12b886',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Receipt Uploaded
                          </span>
                        )}
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
                title="No matching payments found"
                subtext="Try adjusting your search query or payment filter."
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
          totalRequests={financeRequests.length}
          onPageChange={setCurrentPage}
        />
      )}

      {/* 5. Action Context Menu */}
      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords}>
          <button type="button" onClick={() => handleViewDetails(activeMenuRequest)}>
            View Request Details
          </button>

          {(activeMenuRequest.hasReceipt ||
            activeMenuRequest.paymentMethod === 'Online' ||
            activeMenuRequest.receiptUrl ||
            activeMenuRequest.paymentReference) && (
            <button type="button" onClick={() =>handleViewReceipt(activeMenuRequest)}>
              View Proof of Payment
            </button>
          )}

          <div className="actions-menu-divider" />

          <button
            type="button"
            className="highlight-action"
            onClick={() => handleVerifyPayment(openMenuId)}
          >
            Verify & Confirm Payment
          </button>
        </div>
      )}

      {/* 6. Request Details Modal */}
      <RequestDetailsModal
        isOpen={!!viewingRequest}
        onClose={() => setViewingRequest(null)}
        request={viewingRequest}
      />

      {/* 7. Proof of Payment Receipt Modal */}
      <Modal
        isOpen={!!viewingReceiptRequest}
        onClose={() => setViewingReceiptRequest(null)}
        title="Proof of Payment"
      >
        {viewingReceiptRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p className="dashboard-subtext" style={{ marginTop: 0, marginBottom: '1rem', textAlign: 'center' }}>
              Attached receipt for Request <strong>{viewingReceiptRequest.displayId || viewingReceiptRequest.id}</strong>
            </p>

            {viewingReceiptRequest.receiptUrl ? (
              <div
                style={{
                  width: '100%',
                  maxHeight: '380px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={viewingReceiptRequest.receiptUrl}
                  alt={`Proof of payment for request ${viewingReceiptRequest.displayId}`}
                  style={{ maxHeight: '360px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '240px',
                  backgroundColor: '#f8f9fa',
                  border: '2px dashed var(--border-light)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  padding: '1rem',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</span>
                <strong style={{ color: '#495057', fontSize: '0.95rem' }}>Receipt Attachment Uploaded</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Method: {viewingReceiptRequest.paymentMethod}
                  {viewingReceiptRequest.paymentReference && (
                    <> &nbsp;|&nbsp; Ref: <strong>{viewingReceiptRequest.paymentReference}</strong></>
                  )}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setViewingReceiptRequest(null)}
              >
                Close
              </button>
              {viewingReceiptRequest.status === 'PENDING PAYMENT' && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    handleVerifyPayment(viewingReceiptRequest.id);
                    setViewingReceiptRequest(null);
                  }}
                >
                  Confirm Payment
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default FinanceDashboard;