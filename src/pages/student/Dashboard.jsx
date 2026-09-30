import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRequests } from '../../hooks/useRequests';
import { useActionMenu } from '../../hooks/useActionMenu';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import '../../styles/dashboard.css';

function Dashboard() {
  const { currentUser } = useAuth();
  const { requests, isLoading } = useRequests();
  const { openMenuId, setOpenMenuId, menuCoords, toggleMenu } = useActionMenu();
  const { addToast } = useToast();

  const [uploadingRequestId, setUploadingRequestId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const studentRequests = requests.filter(req => req.studentId === currentUser?.id);
  const activeMenuRequest = studentRequests.find(req => req.id === openMenuId);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    
    await new Promise(resolve => setTimeout(resolve, 1200)); 
    
    addToast('Receipt uploaded successfully. Awaiting Finance verification.', 'success');
    setIsUploading(false);
    setUploadingRequestId(null);
  };

  return (
    <div className="dashboard-page">
      {/* PREMIUM HEADER: Flexbox added to push the CTA button to the right */}
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: '80px', marginBottom: '2rem', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto' }}>
          <h1>Student Dashboard</h1>
          <p className="dashboard-subtext" style={{ marginBottom: '0.5rem' }}>
            Track the status of your documents, payments, and clearances.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
            * Note: Clearance requirements vary by document. Not all requests require SASO approval.
          </p>
        </div>

        {/* TOP-RIGHT CALL TO ACTION BUTTON */}
        <div style={{ flex: '0 0 auto', marginTop: '4px' }}>
          <button 
            onClick={() => window.location.href = '/student/create-request'}
            style={{ 
              padding: '0.65rem 1.25rem', 
              backgroundColor: 'var(--imperial-blue)', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '6px', 
              fontSize: '0.9rem', 
              fontWeight: '500', 
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2, 35, 96, 0.15)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            + Request Document
          </button>
        </div>
      </header>

      {/* CONSISTENT TABLE WRAPPER: The table headers are now always visible */}
      <div className="request-table-wrapper" style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden', minHeight: '400px' }}>
        <table className="request-table" style={{ tableLayout: 'fixed', width: '100%', margin: 0 }}>
          <thead style={{ backgroundColor: '#f8f9fa' }}>
            <tr>
              <th style={{ width: '25%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Document</th>
              <th style={{ width: '15%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Date Requested</th>
              <th style={{ width: '15%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>SASO Clearance</th>
              <th style={{ width: '20%', padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>Payment & Status</th>
              <th style={{ width: '10%', padding: '1rem', borderBottom: '1px solid var(--border-light)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                  Loading your requests...
                </td>
              </tr>
            ) : studentRequests.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '6rem 0' }}>
                  {/* PREMIUM EMPTY STATE: Centered inside the table */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontWeight: '600', color: 'var(--imperial-blue)', fontSize: '1.1rem' }}>No active requests</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>When you request a document, it will appear here.</p>
                  </div>
                </td>
              </tr>
            ) : (
              studentRequests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td className="doc-name" style={{ padding: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.docType}>
                    <span style={{ fontWeight: '500', color: 'var(--imperial-blue)' }}>{req.docType}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.3px' }}>
                      ID: {req.id} &nbsp;|&nbsp; QTY: {req.quantity}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: '#495057' }}>
                    {formatDate(req.date || req.dateRequested)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {req.sasoCleared ? (
                      <span style={{ 
                        backgroundColor: 'rgba(32, 201, 151, 0.1)', color: '#12b886', padding: '4px 8px', borderRadius: '4px', 
                        fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>
                        Cleared
                      </span>
                    ) : (
                      <span style={{ 
                        backgroundColor: 'rgba(245, 159, 0, 0.1)', color: '#f08c00', padding: '4px 8px', borderRadius: '4px', 
                        fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>
                        Pending Hold
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                      <StatusBadge status={req.status} />
                      {req.paymentMethod === 'Online' && !req.hasReceipt && req.status !== 'REJECTED' && (
                        <span style={{ 
                          fontSize: '0.7rem', color: '#e03131', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' 
                        }}>
                          Awaiting Receipt
                        </span>
                      )}
                    </div>
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
            )}
          </tbody>
        </table>
      </div>

      {openMenuId && activeMenuRequest && (
        <div 
          className="actions-menu-fixed"
          style={{ 
            top: `${menuCoords.top}px`, right: `${menuCoords.right}px`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border-light)', padding: '4px 0'
          }}
        >
          <button 
            style={{ padding: '10px 16px', fontSize: '0.9rem' }}
            onClick={() => {
              console.log('View Details for:', openMenuId);
              setOpenMenuId(null);
            }}
          >
            View Details
          </button>
          
          {activeMenuRequest.paymentMethod === 'Online' && !activeMenuRequest.hasReceipt && (
            <button 
              style={{ padding: '10px 16px', fontSize: '0.9rem', color: 'var(--imperial-blue)', fontWeight: '500' }}
              onClick={() => {
                setUploadingRequestId(openMenuId);
                setOpenMenuId(null);
              }}
            >
              Upload Receipt
            </button>
          )}

          {activeMenuRequest.hasReceipt && (
            <button 
              style={{ padding: '10px 16px', fontSize: '0.9rem' }}
              onClick={() => setOpenMenuId(null)}
            >
              View Uploaded Receipt
            </button>
          )}
        </div>
      )}

      {uploadingRequestId && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9999, 
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-ui" style={{ 
            backgroundColor: 'white', padding: '2.5rem', borderRadius: '12px', width: '90%', maxWidth: '420px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, color: 'var(--imperial-blue)', fontFamily: 'var(--font-serif-body)', fontSize: '1.5rem' }}>
              Upload Receipt
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              Please attach your GCash or Bank Transfer proof of payment for request <strong>{uploadingRequestId}</strong>.
            </p>
            
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <input 
                type="file" 
                accept="image/*" 
                required
                disabled={isUploading}
                style={{ 
                  padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '6px',
                  backgroundColor: '#f8f9fa', fontSize: '0.9rem'
                }}
              />

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setUploadingRequestId(null)} 
                  disabled={isUploading}
                  style={{ 
                    flex: 1, padding: '0.85rem', backgroundColor: 'transparent', 
                    border: '1px solid var(--border-light)', color: '#495057', borderRadius: '6px', 
                    cursor: 'pointer', fontWeight: '500', transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                  onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading}
                  style={{ 
                    flex: 1, padding: '0.85rem', backgroundColor: 'var(--imperial-blue)', 
                    color: 'white', border: 'none', borderRadius: '6px', 
                    cursor: 'pointer', fontWeight: '500', boxShadow: '0 4px 12px rgba(2, 35, 96, 0.2)'
                  }}
                >
                  {isUploading ? 'Uploading...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;