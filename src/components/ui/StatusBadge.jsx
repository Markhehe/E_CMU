import './statusBadge.css';

// SVG Icons mapped by category for visual scanning
const icons = {
  sync: (
    <svg className="badge-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  clock: (
    <svg className="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg className="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const statusConfig = {
  'pending review': { class: 'status-pending-review', icon: icons.clock },
  'registrar review': { class: 'status-registrar-review', icon: icons.clock },
  'clearance review': { class: 'status-clearance-review', icon: icons.clock },
  'pending payment': { class: 'status-pending', icon: icons.clock },
  'pending clearance': { class: 'status-pending', icon: icons.clock },
  'paid': { class: 'status-paid', icon: icons.check },
  'processing': { class: 'status-processing', icon: icons.sync },
  'overdue': { class: 'status-danger', icon: icons.alert },
  'ready for pickup': { class: 'status-success', icon: icons.check },
  'fulfilled': { class: 'status-success', icon: icons.check },
  'cleared': { class: 'status-success', icon: icons.check },
  'rejected': { class: 'status-danger', icon: icons.alert },
  'on hold': { class: 'status-danger', icon: icons.alert },
};

export default function StatusBadge({ status }) {
  if (!status) return null;

  // 1. Normalize ugly database enums (e.g., READY_FOR_PICKUP -> Ready For Pickup)
  const normalizedString = String(status).replace(/_/g, ' ');
  const lookupKey = normalizedString.toLowerCase().trim();
  
  const config = statusConfig[lookupKey] || { class: 'status-default', icon: null };

  return (
    <span className={`status-badge ${config.class}`}>
      {config.icon}
      <span>{normalizedString}</span>
    </span>
  );
}