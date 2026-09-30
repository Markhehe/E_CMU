import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/dashboard.css';

function SasoDashboard() {
  const { requests, isLoading, searchTerm, setSearchTerm, toggleClearance } = useRequests();
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const { addToast } = useToast();

  const handleClearanceUpdate = (id, isCleared) => {
    toggleClearance(id, isCleared);
    addToast(isCleared ? `Student cleared for request ${id}.` : `Hold placed on request ${id}.`, isCleared ? 'success' : 'error');
    setOpenMenuId(null);
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '80px', marginBottom: '2rem', gap: '2rem' }}>
        <div style={{ flex: '1 1 auto' }}>
          <h1>SASO Clearance Panel</h1>
          <p className="dashboard-subtext" style={{ margin: 0 }}>Manage student disciplinary holds and institutional liabilities.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flex: '0 0 auto' }}>
          {/* Premium Search UI */}
          <input 
            type="text" 
            placeholder="Search Name or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              padding: '0.65rem 1rem', borderRadius: '6px', border: '1px solid var(--border-light)', 
              width: '260px', fontSize: '0.9rem', backgroundColor: '#fff', outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--imperial-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(2, 35, 96, 0.05)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-light)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      </header>

      <div className="request-table-wrapper" style={{ minHeight: '400px', border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
        <table className="request-table" style={{ tableLayout: 'fixed', width: '100%', margin: 0 }}>
          <thead style={{ backgroundColor: '#f8f9fa' }}>
            <tr>
              <th style={{ width: '15%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Request ID</th>
              <th style={{ width: '25%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Student Details</th>
              <th style={{ width: '30%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Document Requested</th>
              <th style={{ width: '15%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Clearance Status</th>
              <th style={{ width: '15%', padding: '1rem', borderBottom: '1px solid var(--border-light)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>Loading records...</td></tr>
            ) : requests.length > 0 ? (
              requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1rem', fontWeight: '500', color: 'var(--imperial-blue)' }}>{req.id}</td>
                  <td style={{ padding: '1rem' }}>
                    <strong style={{ color: '#212529' }}>{req.studentName}</strong><br/>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>{req.studentId}</span>
                  </td>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#495057' }} title={req.docType}>
                    {req.docType}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {req.sasoCleared ? (
                      <span style={{ backgroundColor: 'rgba(32, 201, 151, 0.1)', color: '#12b886', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cleared</span>
                    ) : (
                      <span style={{ backgroundColor: 'rgba(245, 159, 0, 0.1)', color: '#f08c00', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Hold</span>
                    )}
                  </td>
                  <td className="actions-cell" style={{ padding: '1rem', textAlign: 'right' }}>
                    <button className="actions-button" onClick={(e) => toggleMenu(e, req.id)} style={{ padding: '4px 12px', fontSize: '1.2rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>⋮</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '6rem 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontWeight: '600', color: 'var(--imperial-blue)', fontSize: '1.1rem' }}>No matching requests found</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Try adjusting your search query.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openMenuId && (
        <div className="actions-menu-fixed" style={{ top: `${menuCoords.top}px`, right: `${menuCoords.right}px`, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border-light)', padding: '4px 0' }}>
          <button style={{ padding: '10px 16px', fontSize: '0.9rem', color: '#12b886', fontWeight: '500' }} onClick={() => handleClearanceUpdate(openMenuId, true)}>Grant Clearance</button>
          <button style={{ padding: '10px 16px', fontSize: '0.9rem', color: '#e03131', fontWeight: '500' }} onClick={() => handleClearanceUpdate(openMenuId, false)}>Place on Hold</button>
        </div>
      )}
    </div>
  );
}

export default SasoDashboard;