import React from 'react';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import ClearanceBadge from './ClearanceBadge';
import { formatDate } from '../../utils/formatters';

const RequestDetailsModal = ({ isOpen, onClose, request }) => {
  if (!request) return null;

  // Reusable styles for the rows to keep the code clean
  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', 
    padding: '0.75rem 0', borderBottom: '1px solid var(--border-light)'
  };
  const labelStyle = { color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' };
  const valueStyle = { color: '#495057', fontSize: '0.9rem', fontWeight: '600', textAlign: 'right' };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Details" maxWidth="500px">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        
        <div style={rowStyle}>
          <span style={labelStyle}>Request ID</span>
          <span style={valueStyle}>{request.id}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Student Name</span>
          <span style={valueStyle}>{request.studentName}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Document</span>
          <span style={{...valueStyle, color: 'var(--imperial-blue)'}}>{request.docType}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Quantity</span>
          <span style={valueStyle}>{request.quantity}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Date Requested</span>
          <span style={valueStyle}>{formatDate(request.date || request.dateRequested)}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Payment Method</span>
          <span style={valueStyle}>{request.paymentMethod}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>SASO Clearance</span>
          <span><ClearanceBadge isCleared={request.sasoCleared} /></span>
        </div>

        <div style={{ ...rowStyle, borderBottom: 'none', paddingTop: '1rem' }}>
          <span style={labelStyle}>Current Status</span>
          <span><StatusBadge status={request.status} /></span>
        </div>

      </div>
    </Modal>
  );
};

export default RequestDetailsModal;