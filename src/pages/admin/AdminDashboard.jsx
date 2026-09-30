import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import '../../styles/dashboard.css';

function AdminDashboard() {
  const { 
    requests, 
    isLoading, 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter, 
    updateStatus 
  } = useRequests();

  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();

  const handleStatusUpdate = (id, newStatus) => {
    updateStatus(id, newStatus);
    setOpenMenuId(null); 
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        minHeight: '80px', 
        marginBottom: '2rem',
        gap: '2rem'
      }}>
        <div style={{ flex: '1 1 auto' }}>
          <h1>Registrar Control Panel</h1>
          <p className="dashboard-subtext" style={{ margin: 0 }}>
            Manage and process incoming student document requests.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flex: '0 0 auto' }}>
          {/* Premium Search Bar - No Icons, rely on placeholder, typography, and spacing */}
          <input 
            type="text" 
            placeholder="Search Name or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              padding: '0.65rem 1rem', 
              borderRadius: '6px', 
              border: '1px solid var(--border-light)', 
              width: '260px',
              fontSize: '0.9rem',
              backgroundColor: '#fff',
              outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--imperial-blue)';
              e.target.style.boxShadow = '0 0 0 3px rgba(2, 35, 96, 0.05)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-light)';
              e.target.style.boxShadow = 'none';
            }}
          />
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ 
              padding: '0.65rem 1rem', 
              borderRadius: '6px', 
              border: '1px solid var(--border-light)',
              backgroundColor: '#fff',
              fontSize: '0.9rem',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING PAYMENT">Pending Payment</option>
            <option value="PROCESSING">Processing</option>
            <option value="READY FOR PICKUP">Ready for Pickup</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </header>

      <div className="request-table-wrapper" style={{ minHeight: '400px', border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
        <table className="request-table" style={{ tableLayout: 'fixed', width: '100%', margin: 0 }}>
          <thead style={{ backgroundColor: '#f8f9fa' }}>
            <tr>
              <th style={{ width: '15%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Request ID</th>
              <th style={{ width: '25%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Student Details</th>
              <th style={{ width: '25%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Document</th>
              <th style={{ width: '15%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Date</th>
              <th style={{ width: '12%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Status</th>
              <th style={{ width: '8%', padding: '1rem', borderBottom: '1px solid var(--border-light)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                  Loading student requests...
                </td>
              </tr>
            ) : requests.length > 0 ? (
              requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1rem', fontWeight: '500', color: 'var(--imperial-blue)' }}>{req.id}</td>
                  <td style={{ padding: '1rem' }}>
                    <strong style={{ color: '#212529' }}>{req.studentName}</strong><br/>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>{req.studentId}</span>
                  </td>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.docType}>
                    <span style={{ color: '#495057' }}>{req.docType}</span>
                  </td>
                  <td style={{ padding: '1rem', color: '#495057' }}>{formatDate(req.date || req.dateRequested)}</td>
                  <td style={{ padding: '1rem' }}>
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="actions-cell" style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      className="actions-button"
                      onClick={(e) => toggleMenu(e, req.id)}
                      aria-label="Open Actions Menu"
                      aria-expanded={openMenuId === req.id}
                      style={{ padding: '4px 12px', fontSize: '1.2rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '6rem 0' }}>
                  {/* Premium Empty State: No icons, just clean typographic hierarchy */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontWeight: '600', color: 'var(--imperial-blue)', fontSize: '1.1rem' }}>
                      No matching requests found
                    </p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Try adjusting your search query or status filter.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openMenuId && (
        <div 
          className="actions-menu-fixed"
          style={{ 
            top: `${menuCoords.top}px`, 
            right: `${menuCoords.right}px`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid var(--border-light)',
            padding: '4px 0'
          }}
        >
          {/* Actions are strictly related to the Registrar's duties */}
          <button style={{ padding: '10px 16px', fontSize: '0.9rem' }} onClick={() => handleStatusUpdate(openMenuId, 'PROCESSING')}>Mark as Processing</button>
          <button style={{ padding: '10px 16px', fontSize: '0.9rem' }} onClick={() => handleStatusUpdate(openMenuId, 'READY FOR PICKUP')}>Ready for Pickup</button>
          
          <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }}></div>
          
          <button style={{ padding: '10px 16px', fontSize: '0.9rem', color: 'var(--status-success, #28a745)' }} onClick={() => handleStatusUpdate(openMenuId, 'COMPLETED')}>Mark as Completed</button>
          <button style={{ padding: '10px 16px', fontSize: '0.9rem', color: 'var(--status-danger, #dc3545)' }} onClick={() => handleStatusUpdate(openMenuId, 'REJECTED')}>Reject Request</button>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;