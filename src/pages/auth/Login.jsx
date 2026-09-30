import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import cmuLogo from '../../assets/cmulogo.png'; 
import '../../styles/global.css';
import './login.css';

function Login() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  const { login } = useAuth();
  const { addToast } = useToast();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    // Simulate network delay for Capstone presentation realism
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const loginInput = studentId.toLowerCase();
    
    // ==========================================
    // CAPSTONE DEMO LOGIC (Mock Authentication)
    // ==========================================
    if (loginInput.includes('admin') || loginInput.includes('registrar')) {
      login({ id: 'ADMIN-01', name: 'Registrar Admin', role: 'ADMIN', initials: 'AD' });
      addToast('Welcome back, Registrar.', 'success');
      
    } else if (loginInput.includes('finance')) {
      login({ id: 'FIN-01', name: 'Finance Officer', role: 'FINANCE', initials: 'FO' });
      addToast('Welcome back, Finance.', 'success');
      
    } else if (loginInput.includes('saso')) {
      login({ id: 'SASO-01', name: 'SASO Director', role: 'SASO', initials: 'SA' });
      addToast('Welcome back, SASO.', 'success');
      
    } else {
      // Default fallback to Student
      login({ id: '2023-0145', name: 'Yuan Atanacio', role: 'STUDENT', initials: 'YA' });
      addToast('Successfully signed in.', 'success');
    }
    
    setIsLoggingIn(false);
  };

  return (
    <main className="login-page">
      <div className="login-panel">
        
        <section className="login-left">
          <img src={cmuLogo} alt="City of Malabon University Logo" className="login-left-logo" />
          <div className="login-left-text">
            <h3>City of Malabon University</h3>
            <p>Office of The Registrar</p>
          </div>
        </section>

        <section className="login-right">
          <div className="login-right-content">
            <h1 className="login-brand">
              E-CMU <span>PORTAL</span>
            </h1>
            <h2>Sign in</h2>
            <p className="login-subtext">
              or{' '}
              <button 
                type="button" 
                className="gold-link text-button" 
                onClick={() => setShowRegisterModal(true)}
              >
                create an account
              </button>
            </p>

            <form onSubmit={handleLoginSubmit} className="auth-form">
              <label htmlFor="studentId" className="auth-label">Please enter your details</label>
              <input
                id="studentId"
                type="text"
                className="auth-input"
                placeholder="Type 'saso', 'finance', 'admin', or 'Student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                autoComplete="username"
                required
                disabled={isLoggingIn}
              />
              <input
                id="password"
                type="password"
                className="auth-input"
                placeholder="Password (any password works for demo)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={isLoggingIn}
              />

              <button 
                type="submit" 
                className="auth-button"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
              <button type="button" className="forgot-link text-button">
                Forgotten your password?
              </button>
            </form>
          </div>
        </section>
      </div>

      {showRegisterModal && (
        <RegistrationModal onClose={() => setShowRegisterModal(false)} />
      )}
    </main>
  );
}

function RegistrationModal({ onClose }) {
  const [regData, setRegData] = useState({ name: '', email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  
  const { addToast } = useToast();

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setIsRegistering(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log('Registration Payload:', regData);
    
    addToast('Account creation request sent to admin.', 'success');
    setIsRegistering(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button 
          className="modal-close" 
          onClick={onClose}
          aria-label="Close Modal"
        >
          &times;
        </button>
        <h2>Create an account</h2>
        
        <form onSubmit={handleRegisterSubmit} className="auth-form">
          <label htmlFor="regName" className="auth-label">Full Name</label>
          <input 
            id="regName" 
            type="text" 
            className="auth-input" 
            placeholder="Yuan Atanacio" 
            value={regData.name}
            onChange={(e) => setRegData({...regData, name: e.target.value})}
            autoComplete="name"
            required 
            disabled={isRegistering}
          />
          
          <label htmlFor="regEmail" className="auth-label">Student ID/Email</label>
          <input 
            id="regEmail" 
            type="text" 
            className="auth-input" 
            placeholder="e.g. 2023-0145" 
            value={regData.email}
            onChange={(e) => setRegData({...regData, email: e.target.value})}
            autoComplete="email"
            required 
            disabled={isRegistering}
          />
          
          <label htmlFor="regPassword" className="auth-label">Password</label>
          <input 
            id="regPassword" 
            type="password" 
            className="auth-input" 
            placeholder="Create a strong password" 
            value={regData.password}
            onChange={(e) => setRegData({...regData, password: e.target.value})}
            autoComplete="new-password"
            required 
            disabled={isRegistering}
          />
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={isRegistering}
          >
            {isRegistering ? 'CREATING...' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;