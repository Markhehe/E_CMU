import './statusBadge.css';

// Keys converted to lowercase for foolproof case-insensitive matching
const statusStyles = {
  'pending payment': 'status-pending',
  'pending clearance': 'status-pending', 
  'processing': 'status-processing',
  'ready for pickup': 'status-success',
  'cleared': 'status-success', 
  'rejected': 'status-danger',
  'on hold': 'status-danger',
};

function StatusBadge({ status }) {
  // Keep the original string for display
  const originalStatus = status?.trim() || 'Unknown';
  
  // Convert to lowercase strictly for the dictionary lookup
  const lookupKey = originalStatus.toLowerCase();
  
  const className = statusStyles[lookupKey] || 'status-default';

  return (
    <span className={`status-badge ${className}`}>
      {originalStatus}
    </span>
  );
}

export default StatusBadge;