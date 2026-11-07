import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import RequestCommentsModal from '../../components/ui/RequestCommentsModal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import RequestDisplaySelect from '../../components/ui/RequestDisplaySelect';
import RequestPagination from '../../components/ui/RequestPagination';
import { useRequestDisplay } from '../../hooks/useRequestDisplay';

// Extracted Modals
import WalkInRequestModal from './WalkInRequestModal';
import PaymentConfirmationModal from './modals/PaymentConfirmationModal';
import ChangeStatusModal from './modals/ChangeStatusModal';
import DiscardRequestModal from './modals/DiscardRequestModal';
import ViewReceiptModal from './modals/ViewReceiptModal';
import RequestEtaModal from './modals/RequestEtaModal';

import '../../styles/dashboard.css';

const REQUEST_STATUS_SUMMARY = [
  { status: 'PENDING REVIEW', label: 'Pending review' },
  { status: 'PENDING PAYMENT', label: 'Pending payment' },
  { status: 'PAID', label: 'Paid' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'OVERDUE', label: 'Overdue' },
  { status: 'READY FOR PICKUP', label: 'For pickup' },
  { status: 'ON HOLD', label: 'On hold' },
];

function RegistrarDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const appliedNotificationFilterKey = useRef(null);
  
  const {
    requests,
    allRequests,
    isLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    changeRequestStatus,
    showFulfilledRequests,
    setShowFulfilledRequests,
    showRejectedRequests,
    setShowRejectedRequests,
    reviewAsRegistrar,
    confirmPayment,
    startRequestProcessing,
    updateRequestEta,
    markReadyForPickup,
    markPickedUp,
    markCommentsRead,
    sortOption,
    setSortOption,
    refreshRequests,
  } = useRequests();

  const requestStatusCounts = useMemo(() => {
    const counts = Object.fromEntries(REQUEST_STATUS_SUMMARY.map(({ status }) => [status, 0]));
    allRequests.forEach((request) => {
      const status = request.status?.toUpperCase();
      if (Object.hasOwn(counts, status)) counts[status] += 1;
    });
    return counts;
  }, [allRequests]);

  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewingReceiptRequest, setViewingReceiptRequest] = useState(null);
  const [commentingRequest, setCommentingRequest] = useState(null);
  const [requestToDiscard, setRequestToDiscard] = useState(null);
  const [requestToChangeStatus, setRequestToChangeStatus] = useState(null);
  const [paymentConfirmationRequest, setPaymentConfirmationRequest] = useState(null);
  const [etaDialog, setEtaDialog] = useState(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setSearchTerm(debouncedSearch);
  }, [debouncedSearch, setSearchTerm]);

  useEffect(() => {
    const requestedFilter = location.state?.registrarStatusFilter;
    if (
      (requestedFilter === 'PENDING REVIEW' || requestedFilter === 'PENDING PAYMENT' || requestedFilter === 'OVERDUE')
      && appliedNotificationFilterKey.current !== location.key
    ) {
      appliedNotificationFilterKey.current = location.key;
      setStatusFilter(requestedFilter);
    }
  }, [location.key, location.state, setStatusFilter]);

  const activeMenuRequest = requests.find((req) => req.id === openMenuId);

  const {
    mode,
    setMode,
    visibleRequests,
    currentPage,
    totalPages,
    requestsPerPage,
    setCurrentPage,
    tableWrapperRef,
  } = useRequestDisplay(requests, 'registrar', 5, 'pagination');

  // --- Workflow Actions ---
  const handleRegistrarReview = async (id, decision) => {
    try {
      await reviewAsRegistrar(id, decision);
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleReadyForPickup = async (id) => {
    try {
      await markReadyForPickup(id);
    } finally {
      setOpenMenuId(null);
    }
  };

  const handlePickup = async (id) => {
    try {
      await markPickedUp(id);
    } finally {
      setOpenMenuId(null);
    }
  };

  const openStudentRecord = (studentIdentifier) => {
    setViewingRequest(null);
    navigate('/registrar/students', {
      state: { studentRecordIdentifier: studentIdentifier },
    });
  };

  return (
    <div className="dashboard-page registrar-dashboard-page">
      {/* 1. Header & Summary Cards */}
      <header className="dashboard-header registrar-dashboard-header">
        <div className="registrar-header-content">
          <h1 className="dashboard-title">Registrar Control Panel</h1>
          <p className="dashboard-subtext">Manage and process incoming student document requests.</p>
          <button type="button" className="btn-primary" onClick={() => setIsWalkInModalOpen(true)}>
            Enter Walk-in Request
          </button>
        </div>
        
        <section className="registrar-request-summary" aria-label="Request counts by status" aria-busy={isLoading}>
          {REQUEST_STATUS_SUMMARY.map(({ status, label }) => {
            const isActive = statusFilter === status;
            return (
              <button
                type="button"
                className={`registrar-request-summary-item${isActive ? ' is-active' : ''}`}
                key={status}
                aria-pressed={isActive}
                onClick={() => setStatusFilter((prev) => (prev === status ? 'ALL' : status))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setStatusFilter((prev) => (prev === status ? 'ALL' : status));
                  }
                }}
              >
                <span className="registrar-request-summary-count">{isLoading ? '—' : requestStatusCounts[status]}</span>
                <span className="registrar-request-summary-label">{label}</span>
              </button>
            );
          })}
        </section>
      </header>

      {/* 2. Toolbar */}
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
          <label className="request-status-toggle">
            <input
              type="checkbox"
              checked={showFulfilledRequests}
              onChange={(e) => setShowFulfilledRequests(e.target.checked)}
              disabled={statusFilter === 'FULFILLED'}
            />
            <span>Show fulfilled</span>
          </label>
          <label className="request-status-toggle">
            <input
              type="checkbox"
              checked={showRejectedRequests}
              onChange={(e) => setShowRejectedRequests(e.target.checked)}
              disabled={statusFilter === 'REJECTED'}
            />
            <span>Show rejected</span>
          </label>
          
          <select value={sortOption} onChange={(e) => {
            const nextSortOption = e.target.value;
            setSortOption(nextSortOption);
            if (nextSortOption === 'STATUS_ASC') setStatusFilter('ALL');
          }} className="toolbar-select">
            <option value="DATE_DESC">Sort: Date (Newest)</option>
            <option value="DATE_ASC">Sort: Date (Oldest)</option>
            <option value="STATUS_ASC">Sort: Status (Action Needed)</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="toolbar-select">
            <option value="ALL">Filter: All Statuses</option>
            <option value="PENDING REVIEW">Filter: Pending review</option>
            <option value="PENDING PAYMENT">Filter: Pending payment</option>
            <option value="PAID">Filter: Paid</option>
            <option value="PROCESSING">Filter: Processing</option>
            <option value="OVERDUE">Filter: Overdue</option>
            <option value="READY FOR PICKUP">Filter: For pickup</option>
            <option value="ON HOLD">Filter: On hold</option>
            <option value="CLEARANCE REVIEW">Filter: Clearance review</option>
            <option value="FULFILLED">Filter: Fulfilled</option>
            <option value="REJECTED">Filter: Rejected</option>
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
              <th className="col-id" style={{ width: '12%' }}>Request ID</th>
              <th className="col-student" style={{ width: '20%' }}>Student Details</th>
              <th className="col-doc" style={{ width: '18%' }}>Document</th>
              <th className="col-date" style={{ width: '12%' }}>Date</th>
              <th className="col-status" style={{ width: '13%', textAlign: 'center' }}>Status</th>
              <th className="col-actions" style={{ width: '25%', textAlign: 'right' }}>Actions</th>
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
                  onClick={() => setViewingRequest(req)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setViewingRequest(req);
                    }
                  }}
                >
                  <td className="doc-name-cell"><span className="doc-name">{req.displayId || req.id}</span></td>
                  <td>
                    <button
                      type="button"
                      className="student-record-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        const id = req.studentId && req.studentId !== 'N/A' ? req.studentId : req.studentEmail;
                        if (id) openStudentRecord(id);
                      }}
                    >
                      <strong style={{ color: '#212529' }}>{req.studentName}</strong>
                    </button>
                    <br />
                    <button
                      type="button"
                      className="student-record-link doc-meta"
                      onClick={(e) => {
                        e.stopPropagation();
                        const id = req.studentId && req.studentId !== 'N/A' ? req.studentId : req.studentEmail;
                        if (id) openStudentRecord(id);
                      }}
                    >
                      {req.studentId || 'N/A'}
                    </button>
                  </td>
                  <td className="doc-name-cell" title={req.docType}>
                    <span style={{ color: '#495057', fontWeight: '500' }}>{req.docType}</span>
                  </td>
                  <td>{formatDate(req.date || req.dateRequested)}</td>
                  <td className="col-status-cell" style={{ textAlign: 'center' }}>
                    <div className="status-stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StatusBadge status={req.status} />
                    </div>
                  </td>
                  
                  {/* Inline Action Buttons */}
                  <td className="actions-cell">
                    <div className="workflow-inline-actions">
                      {['pending_review', 'on_hold'].includes(req.rawStatus) && (
                        <button type="button" className="workflow-step-button is-positive" onClick={(e) => { e.stopPropagation(); handleRegistrarReview(req.id, 'approved'); }}>
                          Approve
                        </button>
                      )}

                      {req.rawStatus === 'pending_payment' && (
                        <button type="button" className="workflow-step-button is-positive" onClick={(e) => { e.stopPropagation(); setPaymentConfirmationRequest(req); }}>
                          Confirm Cash Receipt
                          {req.receiptUrl && req.requestCopyUrl && <span className="website-payment-proof-dot" />}
                        </button>
                      )}

                      {req.rawStatus === 'paid' && (
                        <button type="button" className="workflow-step-button is-positive" onClick={(e) => { e.stopPropagation(); setEtaDialog({ request: req, isUpdating: false }); }}>
                          Start Processing
                        </button>
                      )}

                      {['processing', 'overdue'].includes(req.rawStatus) && (
                        <button type="button" className="workflow-step-button is-positive" onClick={(e) => { e.stopPropagation(); handleReadyForPickup(req.id); }}>
                          Ready For Pickup
                        </button>
                      )}

                      {['processing', 'overdue'].includes(req.rawStatus) && (
                        <button type="button" className="workflow-step-button workflow-action-button" onClick={(e) => { e.stopPropagation(); setEtaDialog({ request: req, isUpdating: true }); }}>
                          Update ETA
                        </button>
                      )}

                      {['ready_for_pickup', 'ready_for_retrieval', 'ready'].includes(req.rawStatus) && (
                        <button type="button" className="workflow-step-button is-positive" onClick={(e) => { e.stopPropagation(); handlePickup(req.id); }}>
                          Record Pickup
                        </button>
                      )}

                      <button
                        type="button"
                        className={`workflow-step-button workflow-action-button${req.hasUnreadComments ? ' has-unread-comments' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setCommentingRequest(req); }}
                      >
                        Comment
                      </button>

                      <button
                        type="button"
                        className="actions-button"
                        onClick={(e) => { e.stopPropagation(); toggleMenu(e, req.id); }}
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
              <TableEmptyState colSpan={6} title="No matching requests found" subtext="Try adjusting your search query or status filter." />
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

      {/* 5. Floating Action Menu */}
      {openMenuId && activeMenuRequest && (
        <div className="actions-menu-fixed" style={menuCoords}>
          <button type="button" onClick={() => { setViewingRequest(activeMenuRequest); setOpenMenuId(null); }}>View Details</button>
          <button type="button" onClick={() => { setRequestToChangeStatus(activeMenuRequest); setOpenMenuId(null); }}>Change status</button>
          
          {activeMenuRequest.receiptUrl && (
            <button type="button" onClick={() => { setViewingReceiptRequest(activeMenuRequest); setOpenMenuId(null); }}>View Receipt</button>
          )}

          {['pending_review', 'on_hold', 'pending_payment', 'clearance_review', 'paid', 'processing', 'overdue', 'ready_for_pickup'].includes(activeMenuRequest.rawStatus) && (
            <>
              <div className="actions-menu-divider" />
              <button type="button" onClick={() => handleRegistrarReview(openMenuId, 'needs_information')}>Put on Hold</button>
              <button type="button" className="text-danger" onClick={() => { setRequestToDiscard(activeMenuRequest); setOpenMenuId(null); }}>
                Discard Request
              </button>
            </>
          )}

          {activeMenuRequest.rawStatus === 'ready_for_pickup' && (
            <>
              <div className="actions-menu-divider" />
              <button type="button" onClick={() => handleReadyForPickup(openMenuId)}>Resend Pickup Email</button>
            </>
          )}
        </div>
      )}

      {/* 6. Isolated Modals */}
      <RequestDetailsModal isOpen={!!viewingRequest} onClose={() => setViewingRequest(null)} request={viewingRequest} onOpenStudent={openStudentRecord} />
      <RequestCommentsModal isOpen={!!commentingRequest} onClose={() => setCommentingRequest(null)} request={commentingRequest} onCommentsRead={markCommentsRead} />
      <WalkInRequestModal isOpen={isWalkInModalOpen} onClose={() => setIsWalkInModalOpen(false)} onCreated={() => refreshRequests()} />
      
      <ChangeStatusModal 
        key={requestToChangeStatus?.id || 'closed'}
        isOpen={!!requestToChangeStatus} 
        onClose={() => setRequestToChangeStatus(null)} 
        request={requestToChangeStatus} 
        onSubmit={changeRequestStatus} 
      />
      
      <PaymentConfirmationModal 
        isOpen={!!paymentConfirmationRequest} 
        onClose={() => setPaymentConfirmationRequest(null)} 
        request={paymentConfirmationRequest} 
        onSubmit={confirmPayment} 
      />
      
      <DiscardRequestModal 
        isOpen={!!requestToDiscard} 
        onClose={() => setRequestToDiscard(null)} 
        request={requestToDiscard} 
        onSubmit={handleRegistrarReview} 
      />
      
      <ViewReceiptModal 
        isOpen={!!viewingReceiptRequest} 
        onClose={() => setViewingReceiptRequest(null)} 
        request={viewingReceiptRequest} 
      />

      {etaDialog && (
        <RequestEtaModal
          key={`${etaDialog.request.id}-${etaDialog.isUpdating ? 'update' : 'start'}`}
          isOpen
          onClose={() => setEtaDialog(null)}
          request={etaDialog.request}
          isUpdating={etaDialog.isUpdating}
          onSubmit={async (etaAt) => {
            const result = etaDialog.isUpdating
              ? await updateRequestEta(etaDialog.request.id, etaAt)
              : await startRequestProcessing(etaDialog.request.id, etaAt);
            if (result) setEtaDialog(null);
          }}
        />
      )}
    </div>
  );
}

export default RegistrarDashboard;