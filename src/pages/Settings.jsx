import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/dashboard.css'; // Reusing your global layout styles

function Settings() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="dashboard-page">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: 'var(--imperial-blue)', fontFamily: 'var(--font-heading)' }}>
          Account Settings
        </h1>
        <p className="dashboard-subtext" style={{ margin: '0.25rem 0 0 0' }}>
          Manage your personal information and portal preferences.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        
        {/* Settings Navigation Sidebar */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('profile')}
            style={{ 
              padding: '0.75rem 1rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'profile' ? '600' : '500',
              backgroundColor: activeTab === 'profile' ? '#e9ecef' : 'transparent',
              color: activeTab === 'profile' ? 'var(--imperial-blue)' : '#495057'
            }}
          >
            Profile Information
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            style={{ 
              padding: '0.75rem 1rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'security' ? '600' : '500',
              backgroundColor: activeTab === 'security' ? '#e9ecef' : 'transparent',
              color: activeTab === 'security' ? 'var(--imperial-blue)' : '#495057'
            }}
          >
            Security & Password
          </button>
          <button 
            onClick={() => setActiveTab('preferences')}
            style={{ 
              padding: '0.75rem 1rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'preferences' ? '600' : '500',
              backgroundColor: activeTab === 'preferences' ? '#e9ecef' : 'transparent',
              color: activeTab === 'preferences' ? 'var(--imperial-blue)' : '#495057'
            }}
          >
            Preferences
          </button>
        </div>

        {/* Settings Content Area */}
        <div style={{ flex: 1, backgroundColor: '#fff', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '2rem' }}>
          
          {activeTab === 'profile' && (
            <div>
              <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: 'var(--imperial-blue)' }}>Profile Information</h2>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-light)', marginBottom: '1.5rem' }} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '0.5rem' }}>Full Name</label>
                  <input type="text" defaultValue={currentUser?.name || ''} className="form-input" style={{ width: '100%' }} disabled />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '0.5rem' }}>Role</label>
                  <input type="text" defaultValue={currentUser?.role || ''} className="form-input" style={{ width: '100%', textTransform: 'capitalize' }} disabled />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '0.5rem' }}>Email Address</label>
                  <input type="email" defaultValue={currentUser?.email || 'user@cityofmalabonuniversity.edu.ph'} className="form-input" style={{ width: '100%' }} disabled />
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
                * Note: Profile information is synced with the university database and cannot be changed here. Contact MIS for corrections.
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: 'var(--imperial-blue)' }}>Change Password</h2>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-light)', marginBottom: '1.5rem' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '0.5rem' }}>Current Password</label>
                  <input type="password" placeholder="••••••••" className="form-input" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#495057', marginBottom: '0.5rem' }}>New Password</label>
                  <input type="password" placeholder="••••••••" className="form-input" style={{ width: '100%' }} />
                </div>
                <button className="btn-primary" style={{ marginTop: '1rem', width: 'max-content' }}>Update Password</button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div>
              <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: 'var(--imperial-blue)' }}>System Preferences</h2>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-light)', marginBottom: '1.5rem' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input type="checkbox" id="email-notifs" defaultChecked style={{ width: '16px', height: '16px' }} />
                <label htmlFor="email-notifs" style={{ fontSize: '0.95rem', color: '#495057' }}>Enable Email Notifications for document status updates</label>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default Settings;