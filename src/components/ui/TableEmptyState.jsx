function TableEmptyState({ colSpan, title, subtext }) {
  return (
    <tr className="empty-state-row">
      <td colSpan={colSpan} className="empty-state-cell">
        <svg 
          width="56" 
          height="56" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          style={{ color: '#ced4da', marginBottom: '1.25rem' }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <circle cx="11.5" cy="14.5" r="2.5"></circle>
          <line x1="13.27" y1="16.27" x2="15.5" y2="18.5"></line>
        </svg>
        
        <p className="doc-name" style={{ fontSize: '1.1rem', margin: 0, color: '#495057' }}>
          {title}
        </p>
        <p className="dashboard-subtext" style={{ marginTop: '0.5rem', maxWidth: '300px', margin: '0.5rem auto 0 auto' }}>
          {subtext}
        </p>
      </td>
    </tr>
  );
}

export default TableEmptyState;