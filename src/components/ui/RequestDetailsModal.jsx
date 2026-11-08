/**
 * Component: RequestDetailsModal
 * Clean, standard-compliant modal displaying complete document request metadata,
 * payment details, clearance status, and request purpose.
 */

import Modal from './Modal';
import StatusBadge from './StatusBadge';
import { formatDate } from '../../utils/formatters';

function formatCurrency(amount, currency = 'PHP') {
  if (amount == null || isNaN(amount)) return 'N/A';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

const RequestDetailsModal = ({ isOpen, onClose, request, onOpenStudent }) => {
  if (!request) return null;

  const studentIdentifier =
    request.studentId && request.studentId !== 'N/A'
      ? request.studentId
      : request.studentEmail;

  const renderStudentLink = (value) => (
    studentIdentifier && onOpenStudent ? (
      <button
        type="button"
        className="student-record-link"
        style={valueStyle}
        onClick={() => onOpenStudent(studentIdentifier)}
      >
        {value}
      </button>
    ) : (
      <span style={valueStyle}>{value}</span>
    )
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Details" maxWidth="520px">
      <div className="request-details-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* Detail Items List */}
        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Request ID</span>
          <span style={valueStyle}>{request.displayId || request.id}</span>
        </div>

        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Student Name</span>
          {renderStudentLink(request.studentName || 'N/A')}
        </div>

        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Student ID</span>
          {renderStudentLink(request.studentId || 'Not available')}
        </div>

        {request.studentEmail && (
          <div className="detail-row" style={rowStyle}>
            <span style={labelStyle}>Email Address</span>
            <span style={valueStyle}>{request.studentEmail}</span>
          </div>
        )}

        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Document</span>
          <span style={{ ...valueStyle, color: 'var(--imperial-blue)', fontWeight: '700' }}>
            {request.docType}
          </span>
        </div>

        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Quantity</span>
          <span style={valueStyle}>{request.quantity || 1}</span>
        </div>

        {request.feeAmount != null && (
          <div className="detail-row" style={rowStyle}>
            <span style={labelStyle}>Total Fee</span>
            <span style={valueStyle}>
              {formatCurrency(request.feeAmount, request.feeCurrency)}
            </span>
          </div>
        )}

        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Date Requested</span>
          <span style={valueStyle}>{formatDate(request.date || request.dateRequested)}</span>
        </div>

        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Payment Method</span>
          <span style={valueStyle}>{request.paymentMethod || 'Not recorded'}</span>
        </div>

        {request.hasReceipt && (
          <div className="detail-row" style={rowStyle}>
            <span style={labelStyle}>Payment Sent</span>
            <span style={valueStyle}>
              Receipt submitted
              {request.paymentSentAt ? ` on ${formatDate(request.paymentSentAt)}` : ''}
            </span>
          </div>
        )}

        {request.paymentConfirmationEmail && (
          <section
            aria-label="Payment confirmation email"
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
            }}
          >
            <strong style={{ color: 'var(--imperial-blue)' }}>
              Payment confirmation email queued
            </strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.84rem', color: '#495057' }}>
              Email queued for {request.paymentConfirmationEmail.to}: payment received for{' '}
              {request.paymentConfirmationEmail.requestCode} -{' '}
              {request.paymentConfirmationEmail.documentName},{' '}
              {formatCurrency(
                request.paymentConfirmationEmail.amount,
                request.paymentConfirmationEmail.currency,
              )}{' '}
              via {request.paymentConfirmationEmail.method}.
              {request.paymentConfirmationEmail.reference && (
                <> Reference: {request.paymentConfirmationEmail.reference}.</>
              )}
            </p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Delivery is handled by the configured SMTP server.
            </p>
          </section>
        )}

        <div className="detail-row" style={rowStyle}>
          <span style={labelStyle}>Collection Method</span>
          <span style={valueStyle}>{request.collectionMethod || 'Pick-up'}</span>
        </div>

        <div className="detail-row" style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Current Status</span>
          <span>
            <StatusBadge status={request.status} />
          </span>
        </div>

        {request.etaAt && !['ready_for_pickup', 'ready_for_retrieval', 'ready'].includes(request.rawStatus) && (
          <div className="detail-row" style={rowStyle}>
            <span style={labelStyle}>Estimated Time of Availability</span>
            <span style={valueStyle}>
              {new Intl.DateTimeFormat('en-PH', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }).format(new Date(request.etaAt))}
            </span>
          </div>
        )}

        {/* Dedicated Purpose Box */}
        <div
          className="purpose-box"
          style={{
            marginTop: '0.5rem',
            padding: '0.85rem 1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '0.78rem',
              fontWeight: '700',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '0.35rem',
              letterSpacing: '0.5px',
            }}
          >
            Purpose of Request
          </span>
          <p
            style={{
              margin: 0,
              fontSize: '0.88rem',
              color: '#495057',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {request.purpose?.trim() || 'No purpose was specified.'}
          </p>
        </div>

      </div>
    </Modal>
  );
};

// Internal Layout Helper Styles
const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '0.55rem',
  borderBottom: '1px solid var(--border-light)',
};

const labelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  fontWeight: '500',
};

const valueStyle = {
  color: '#495057',
  fontSize: '0.85rem',
  fontWeight: '600',
  textAlign: 'right',
};

export default RequestDetailsModal;