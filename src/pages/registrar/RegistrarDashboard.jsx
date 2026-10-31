import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import RequestDetailsModal from '../../components/ui/RequestDetailsModal';
import RequestCommentsModal from '../../components/ui/RequestCommentsModal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import TableEmptyState from '../../components/ui/TableEmptyState';
import RequestDisplaySelect from '../../components/ui/RequestDisplaySelect';
import RequestPagination from '../../components/ui/RequestPagination';
import { useRequestDisplay } from '../../hooks/useRequestDisplay';
import WalkInRequestModal from './WalkInRequestModal';
import '../../styles/dashboard.css';

const REQUEST_STATUS_SUMMARY = [
  { status: 'PENDING REVIEW', label: 'Pending review' },
  { status: 'PENDING PAYMENT', label: 'Pending payment' },
  { status: 'PAID', label: 'Paid' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'READY FOR PICKUP', label: 'For pickup' },
  { status: 'ON HOLD', label: 'On hold' },
];

const DIRECT_STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_for_pickup', label: 'For pickup' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'clearance_review', label: 'Clearance review' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
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
  const [selectedNextStatus, setSelectedNextStatus] = useState('');
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [paymentConfirmationRequest, setPaymentConfirmationRequest] = useState(null);
  const [paymentProofSource, setPaymentProofSource] = useState('physical');
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setSearchTerm(debouncedSearch);
  }, [debouncedSearch, setSearchTerm]);

  useEffect(() => {
    const requestedFilter = location.state?.registrarStatusFilter;
    if (
      (requestedFilter === 'PENDING REVIEW' || requestedFilter === 'PENDING PAYMENT')
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

  const openPaymentConfirmation = (request) => {
    setPaymentProofSource(request.receiptUrl && request.requestCopyUrl ? 'uploaded' : 'physical');
    setPaymentConfirmationRequest(request);
    setOpenMenuId(null);
  };

  const handleConfirmPayment = async () => {
    if (!paymentConfirmationRequest || isConfirmingPayment) return;
    const request = paymentConfirmationRequest;
    const isUploadedProof = paymentProofSource === 'uploaded';
    setIsConfirmingPayment(true);
    try {
      const result = await confirmPayment(request.id, {
        method: 'cash',
        amount: request.feeAmount,
        currency: request.feeCurrency || 'PHP',
        notes: isUploadedProof
          ? 'Cash payment proof and printed request verified from website upload'
          : 'Physical cash receipt and printed request verified by Registrar',
      });
      if (result) setPaymentConfirmationRequest(null);
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleViewDetails = (request) => {
    setViewingRequest(request);
    setOpenMenuId(null);
  };

  const openStudentRecord = (studentIdentifier) => {
    setViewingRequest(null);
    navigate('/registrar/students', {
      state: { studentRecordIdentifier: studentIdentifier },
    });
  };

  const openChangeStatus = (request) => {
    setRequestToChangeStatus(request);
    setSelectedNextStatus(request.rawStatus);
    setOpenMenuId(null);
  };

  const handleChangeStatus = async (event) => {
    event.preventDefault();
    if (!requestToChangeStatus || !selectedNextStatus || isChangingStatus) return;

    setIsChangingStatus(true);
    try {
      const result = await changeRequestStatus(requestToChangeStatus.id, selectedNextStatus);
      if (result) setRequestToChangeStatus(null);
    } finally {
      setIsChangingStatus(false);
    }
  };

  return (
    <div className="dashboard-page registrar-dashboard-page">
      {/* 1. Clean Title Header */}
      <header className="dashboard-header registrar-dashboard-header">
        <div className="registrar-header-content">
          <h1 className="dashboard-title">Registrar Control Panel</h1>
          <p className="dashboard-subtext">
            Manage and process incoming student document requests.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsWalkInModalOpen(true)}
          >
            Enter Walk-in Request
          </button>
        </div>
        <section
          className="registrar-request-summary"
          aria-label="Request counts by status"
          aria-busy={isLoading}
        >
          {REQUEST_STATUS_SUMMARY.map(({ status, label }) => (
            <button
              type="button"
              className={`registrar-request-summary-item${statusFilter === status ? ' is-active' : ''}`}
              key={status}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              <span className="registrar-request-summary-count">
                {isLoading ? '—' : requestStatusCounts[status]}
              </span>
              <span className="registrar-request-summary-label">{label}</span>
            </button>
          ))}
        </section>
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
          <label className="request-status-toggle">
            <input
              type="checkbox"
              checked={showFulfilledRequests}
              onChange={(event) => setShowFulfilledRequests(event.target.checked)}
              disabled={statusFilter === 'FULFILLED'}
            />
            <span>Show fulfilled</span>
          </label>
          <label className="request-status-toggle">
            <input
              type="checkbox"
              checked={showRejectedRequests}
              onChange={(event) => setShowRejectedRequests(event.target.checked)}
              disabled={statusFilter === 'REJECTED'}
            />
            <span>Show rejected</span>
          </label>
          <select
            value={sortOption}
            onChange={(e) => {
              const nextSortOption = e.target.value;
              setSortOption(nextSortOption);
              if (nextSortOption === 'STATUS_ASC') setStatusFilter('ALL');
            }}
            className="toolbar-select"
          >
            <option value="DATE_DESC">Sort: Date (Newest)</option>
            <option value="DATE_ASC">Sort: Date (Oldest)</option>
            <option value="STATUS_ASC">Sort: Status (Action Needed)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="toolbar-select"
          >
            <option value="ALL">Filter: All Statuses</option>
            <option value="PENDING REVIEW">Filter: Pending review</option>
            <option value="PENDING PAYMENT">Filter: Pending payment</option>
            <option value="PAID">Filter: Paid</option>
            <option value="PROCESSING">Filter: Processing</option>
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
              <th className="col-actions" style={{ width: '25%', textAlign: 'right' }}>
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
                    <button
                      type="button"
                      className="student-record-link"
                      onClick={(event) => {
                        event.stopPropagation();
                        const identifier = req.studentId && req.studentId !== 'N/A'
                          ? req.studentId
                          : req.studentEmail;
                        if (identifier) openStudentRecord(identifier);
                      }}
                    >
                      <strong style={{ color: '#212529' }}>{req.studentName}</strong>
                    </button>
                    <br />
                    <button
                      type="button"
                      className="student-record-link doc-meta"
                      onClick={(event) => {
                        event.stopPropagation();
                        const identifier = req.studentId && req.studentId !== 'N/A'
                          ? req.studentId
                          : req.studentEmail;
                        if (identifier) openStudentRecord(identifier);
                      }}
                    >
                      {req.studentId || 'N/A'}
                    </button>
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
                    <div className="workflow-inline-actions">
                      <button
                        type="button"
                        className={`workflow-step-button workflow-action-button${req.hasUnreadComments ? ' has-unread-comments' : ''}`}
                        aria-label={req.hasUnreadComments ? 'Comments, unread comments' : 'Comments'}
                        onClick={(event) => {
                          event.stopPropagation();
                          setCommentingRequest(req);
                        }}
                      >
                        Comments
                      </button>
                      {['pending_review', 'on_hold'].includes(req.rawStatus) && (
                        <button
                          type="button"
                          className="workflow-step-button is-positive"
                          data-action-cooldown="protected"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRegistrarReview(req.id, 'approved');
                          }}
                          title="Approve this request for payment"
                        >
                          Approve
                        </button>
                      )}
                      {req.rawStatus === 'pending_payment' && (
                        <button
                          type="button"
                          className="workflow-step-button is-positive"
                          aria-label={
                            req.receiptUrl && req.requestCopyUrl
                              ? 'Confirm cash receipt, website payment proof uploaded'
                              : 'Confirm cash receipt'
                          }
                          data-action-cooldown="protected"
                          onClick={(event) => {
                            event.stopPropagation();
                            openPaymentConfirmation(req);
                          }}
                        >
                          Confirm cash receipt
                          {req.receiptUrl && req.requestCopyUrl && (
                            <span className="website-payment-proof-dot" aria-hidden="true" />
                          )}
                        </button>
                      )}
                      {req.rawStatus === 'paid' && (
                        <button
                          type="button"
                          className="workflow-step-button is-positive"
                          data-action-cooldown="protected"
                          onClick={(event) => {
                            event.stopPropagation();
                            startRequestProcessing(req.id);
                          }}
                        >
                          Start processing
                        </button>
                      )}
                      {req.rawStatus === 'processing' && (
                        <button
                          type="button"
                          className="workflow-step-button is-positive"
                          data-action-cooldown="protected"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleReadyForPickup(req.id);
                          }}
                        >
                          Ready for pickup
                        </button>
                      )}
                      {['ready_for_retrieval', 'ready'].includes(req.rawStatus) && (
                        <button
                          type="button"
                          className="workflow-step-button is-positive"
                          data-action-cooldown="protected"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePickup(req.id);
                          }}
                        >
                          Record pickup
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
        <div className="actions-menu-fixed" style={menuCoords} data-action-context={activeMenuRequest.id}>
          <button type="button" onClick={() => handleViewDetails(activeMenuRequest)}>
            View Details
          </button>
          <button type="button" onClick={() => openChangeStatus(activeMenuRequest)}>
            Change status
          </button>
          {activeMenuRequest.receiptUrl && (
            <button
              type="button"
              onClick={() => {
                setViewingReceiptRequest(activeMenuRequest);
                setOpenMenuId(null);
              }}
            >
              View Receipt
            </button>
          )}
          {[
            'pending_review',
            'on_hold',
            'pending_payment',
            'clearance_review',
            'paid',
            'processing',
            'ready_for_pickup',
          ].includes(activeMenuRequest.rawStatus) && (
            <>
              <div className="actions-menu-divider" />
              <button
                type="button"
                data-action-cooldown="protected"
                onClick={() => handleRegistrarReview(openMenuId, 'needs_information')}
              >
                Put on Hold
              </button>
              <button
                type="button"
                className="text-danger"
                data-action-cooldown="protected"
                onClick={() => {
                  setRequestToDiscard(activeMenuRequest);
                  setOpenMenuId(null);
                }}
              >
                Discard Request
              </button>
            </>
          )}
          {activeMenuRequest.rawStatus === 'ready_for_pickup' && (
            <>
              <div className="actions-menu-divider" />
              <button
                type="button"
                data-action-cooldown="protected"
                onClick={() => handleReadyForPickup(openMenuId)}
              >
                Resend Pickup Email
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
        onOpenStudent={openStudentRecord}
      />
      <Modal
        isOpen={Boolean(requestToChangeStatus)}
        onClose={() => {
          if (!isChangingStatus) setRequestToChangeStatus(null);
        }}
        title="Change request status"
      >
        {requestToChangeStatus && (
          <form className="auth-form" onSubmit={handleChangeStatus}>
            <p>
              Change status for request{' '}
              <strong>{requestToChangeStatus.displayId || requestToChangeStatus.id}</strong>.
            </p>
            <p className="doc-meta">
              This directly changes the request status and records it in the status history. It does not record a payment or send a pickup email.
            </p>
            <label className="auth-label" htmlFor="request-status-selection">
              New status
            </label>
            <select
              id="request-status-selection"
              className="auth-input"
              value={selectedNextStatus}
              onChange={(event) => setSelectedNextStatus(event.target.value)}
              disabled={isChangingStatus}
              required
            >
              <option value="" disabled>Select a status</option>
              {DIRECT_STATUS_OPTIONS.map(({ value, label }) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
            <div className="workflow-inline-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRequestToChangeStatus(null)}
                disabled={isChangingStatus}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isChangingStatus || selectedNextStatus === requestToChangeStatus.rawStatus}
              >
                {isChangingStatus ? 'Updating...' : 'Update status'}
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(paymentConfirmationRequest)}
        onClose={() => {
          if (!isConfirmingPayment) setPaymentConfirmationRequest(null);
        }}
        title="Confirm payment"
        maxWidth="700px"
      >
        {paymentConfirmationRequest && (
          <div className="payment-confirmation-dialog">
            <p className="payment-confirmation-code">
              Request code: <strong>{paymentConfirmationRequest.displayId || paymentConfirmationRequest.id}</strong>
            </p>
            <p className="payment-confirmation-context">
              Confirm that the cash payment for <strong>{paymentConfirmationRequest.studentName}</strong>&apos;s{' '}
              {paymentConfirmationRequest.docType} request has been received.
              {' '}Student ID: <strong>{paymentConfirmationRequest.studentId || 'Not available'}</strong>.
              {' '}Amount: <strong>{new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: paymentConfirmationRequest.feeCurrency || 'PHP',
              }).format(paymentConfirmationRequest.feeAmount)}</strong>.
            </p>
            <fieldset className="payment-proof-source">
              <legend>How was the payment proof presented?</legend>
              <label>
                <input
                  type="radio"
                  name="payment-proof-source"
                  value="physical"
                  checked={paymentProofSource === 'physical'}
                  onChange={() => setPaymentProofSource('physical')}
                  disabled={isConfirmingPayment}
                />
                <span>Shown physically</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="payment-proof-source"
                  value="uploaded"
                  checked={paymentProofSource === 'uploaded'}
                  onChange={() => setPaymentProofSource('uploaded')}
                  disabled={isConfirmingPayment || !(paymentConfirmationRequest.receiptUrl && paymentConfirmationRequest.requestCopyUrl)}
                />
                <span>Uploaded on the website</span>
              </label>
            </fieldset>
            {paymentProofSource === 'uploaded' && (
              <div className="payment-proof-preview">
                <p>
                  Uploaded request code: <strong>{paymentConfirmationRequest.displayId || paymentConfirmationRequest.id}</strong>
                </p>
                {paymentConfirmationRequest.paymentReference && (
                  <p>
                    Receipt/reference number: <strong>{paymentConfirmationRequest.paymentReference}</strong>
                  </p>
                )}
                {paymentConfirmationRequest.receiptUrl && paymentConfirmationRequest.requestCopyUrl ? (
                  <div className="payment-proof-preview-images">
                    <figure>
                      <a href={paymentConfirmationRequest.receiptUrl} target="_blank" rel="noreferrer">
                        <img
                          src={paymentConfirmationRequest.receiptUrl}
                          alt={`Uploaded cash receipt for request ${paymentConfirmationRequest.displayId || paymentConfirmationRequest.id}`}
                        />
                      </a>
                      <figcaption>Cash receipt</figcaption>
                    </figure>
                    <figure>
                      <a href={paymentConfirmationRequest.requestCopyUrl} target="_blank" rel="noreferrer">
                        <img
                          src={paymentConfirmationRequest.requestCopyUrl}
                          alt={`Uploaded printed request copy for request ${paymentConfirmationRequest.displayId || paymentConfirmationRequest.id}`}
                        />
                      </a>
                      <figcaption>Printed request copy</figcaption>
                    </figure>
                  </div>
                ) : (
                  <p className="payment-proof-preview-missing" role="alert">
                    No website-uploaded receipt and request copy are available for this request. Select “Shown physically” to continue.
                  </p>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPaymentConfirmationRequest(null)}
                disabled={isConfirmingPayment}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmPayment}
                disabled={isConfirmingPayment || (
                  paymentProofSource === 'uploaded'
                  && !(paymentConfirmationRequest.receiptUrl && paymentConfirmationRequest.requestCopyUrl)
                )}
              >
                {isConfirmingPayment ? 'Confirming...' : 'Confirm payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={!!viewingReceiptRequest}
        onClose={() => setViewingReceiptRequest(null)}
        title="Proof of Payment"
        maxWidth="560px"
      >
        {viewingReceiptRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p className="modal-text" style={{ margin: 0, textAlign: 'center' }}>
              Receipt for request{' '}
              <strong>{viewingReceiptRequest.displayId || viewingReceiptRequest.id}</strong>
            </p>
            {viewingReceiptRequest.paymentReference && (
              <p className="modal-text" style={{ margin: 0 }}>
                Payment reference: <strong>{viewingReceiptRequest.paymentReference}</strong>
              </p>
            )}
            <a
              href={viewingReceiptRequest.receiptUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open receipt image for request ${viewingReceiptRequest.displayId || viewingReceiptRequest.id}`}
              style={{ alignSelf: 'center', maxWidth: '100%' }}
            >
              <img
                src={viewingReceiptRequest.receiptUrl}
                alt={`Payment receipt for request ${viewingReceiptRequest.displayId || viewingReceiptRequest.id}`}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: '6px',
                }}
              />
            </a>
          </div>
        )}
      </Modal>
      {commentingRequest && (
        <RequestCommentsModal
          isOpen
          onClose={() => setCommentingRequest(null)}
          request={commentingRequest}
          onCommentsRead={markCommentsRead}
        />
      )}
      <Modal
        isOpen={!!requestToDiscard}
        onClose={() => setRequestToDiscard(null)}
        title="Discard Request?"
      >
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Are you sure you want to discard request{' '}
          <strong>{requestToDiscard?.displayId || requestToDiscard?.id}</strong>? The request will be marked as rejected.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRequestToDiscard(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            data-action-cooldown="protected"
            disabled={!requestToDiscard}
            onClick={async () => {
              const request = requestToDiscard;
              if (!request) return;
              setRequestToDiscard(null);
              await handleRegistrarReview(request.id, 'rejected');
            }}
            style={{ backgroundColor: 'var(--danger, #b42318)' }}
          >
            Discard Request
          </button>
        </div>
      </Modal>
      <WalkInRequestModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onCreated={() => refreshRequests()}
      />
    </div>
  );
}

export default RegistrarDashboard;