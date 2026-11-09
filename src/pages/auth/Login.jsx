/**
 * Component: Login & Auth Suite
 * Modern authentication page featuring student/staff sign-in, account creation
 * with @cityofmalabonuniversity.edu.ph domain validation, password visibility toggles,
 * and email-verified password reset.
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AuthService } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Guide from '../Guide';
import cmuLogo from '../../assets/cmulogo.png';
import '../../styles/global.css';
import './login.css';

// SVG Password Visibility Icons
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

const REGISTRATION_POLICIES = {
  terms: {
    title: 'Terms and Conditions',
    sections: [
      {
        heading: 'Using the portal',
        paragraphs: [
          'The E-CMU Portal supports student document requests, clearance submissions, payment-proof uploads, and request status updates for City of Malabon University.',
          'Use the portal only for your own legitimate university transactions. Provide accurate information, use your official university email, and keep your password confidential.',
        ],
      },
      {
        heading: 'Requests and records',
        paragraphs: [
          'Submitting a request does not guarantee approval, completion by a particular date, or release of a document. The Registrar and other responsible university offices review submissions and may ask you to correct or provide additional information.',
          'You are responsible for ensuring that uploaded documents and payment information are accurate and belong to your transaction. Follow the instructions shown in the portal and retain any relevant receipts.',
        ],
      },
      {
        heading: 'Acceptable use and availability',
        paragraphs: [
          'Do not misuse the portal, attempt to access another person’s account or records, submit false information, or interfere with the portal’s operation.',
          'The portal may be changed, temporarily unavailable, or have features disabled for maintenance or operational reasons. The university may restrict access when necessary to protect users or the service.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'Information collected',
        paragraphs: [
          'The portal handles account details such as your university email, student identity and profile information, as well as information you submit for document requests, clearance review, payment verification, and communications with university staff.',
          'The portal also processes account and request activity needed to provide and protect its services.',
        ],
      },
      {
        heading: 'How information is used',
        paragraphs: [
          'Information is used to verify accounts, identify student records, process and review requests, confirm submitted payment proof, communicate status changes, and maintain the security and operation of the portal.',
        ],
      },
      {
        heading: 'Access, sharing, and retention',
        paragraphs: [
          'Relevant information is available to authorized university personnel who handle your account, document requests, clearance, or payment verification. It may also be processed by service providers supporting the portal, subject to their role in providing those services.',
          'Records are retained as needed to provide the service and meet university recordkeeping, operational, or legal requirements. Handle your password carefully and contact the Registrar through official university channels if you have a question or concern about your information.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    sections: [
      {
        heading: 'Essential sign-in cookie',
        paragraphs: [
          'The portal uses an essential, HTTP-only authentication cookie to keep your session signed in and make authenticated requests. It is configured as a same-site cookie and expires after 30 minutes.',
          'This cookie is necessary for account and portal functions. The portal does not use cookies for advertising or cross-site advertising tracking.',
        ],
      },
      {
        heading: 'Managing cookies',
        paragraphs: [
          'You can manage or clear cookies through your browser settings. Blocking essential cookies may prevent you from signing in or using protected portal features.',
        ],
      },
    ],
  },
};

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginVerificationRequired, setLoginVerificationRequired] = useState(false);
  const [loginVerificationCode, setLoginVerificationCode] = useState('');
  const [isVerifyingLogin, setIsVerifyingLogin] = useState(false);
  const [resetStep, setResetStep] = useState('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const { login } = useAuth();
  const { addToast } = useToast();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const result = await AuthService.login(email, password);
      if (result.verificationRequired) {
        setLoginVerificationRequired(true);
        setLoginVerificationCode('');
        addToast(result.message, 'info');
        return;
      }
      login(result.user);
      addToast('Signed in successfully.', 'success');
    } catch (error) {
      addToast(error.message || 'Sign in failed.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyStudentLogin = async (event) => {
    event.preventDefault();
    setIsVerifyingLogin(true);
    try {
      const result = await AuthService.verifyStudentLoginCode(email, loginVerificationCode);
      login(result.user);
      setLoginVerificationRequired(false);
      setLoginVerificationCode('');
      addToast('Signed in successfully.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not verify the sign-in code.', 'error');
    } finally {
      setIsVerifyingLogin(false);
    }
  };

  const handleResendStudentLoginCode = async () => {
    setIsVerifyingLogin(true);
    try {
      const result = await AuthService.resendStudentLoginCode(email, password);
      setLoginVerificationCode('');
      addToast(result.message || 'A new sign-in code has been sent.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not resend the sign-in code.', 'error');
    } finally {
      setIsVerifyingLogin(false);
    }
  };

  const handleReturnToLoginCredentials = () => {
    setLoginVerificationRequired(false);
    setLoginVerificationCode('');
  };

  const handleRequestPasswordReset = async (event) => {
    event.preventDefault();
    setIsResettingPassword(true);
    try {
      const result = await AuthService.requestPasswordReset(resetEmail);
      setResetStep('verify');
      addToast(result.message, 'success');
    } catch (error) {
      addToast(error.message || 'Could not request a password reset.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleVerifyPasswordResetCode = async (event) => {
    event.preventDefault();
    setIsResettingPassword(true);
    try {
      const result = await AuthService.verifyPasswordResetCode(resetEmail, resetCode);
      setResetToken(result.resetToken);
      setResetStep('new-password');
      addToast('Email verified. Choose a new password.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not verify the reset code.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleResendPasswordResetCode = async () => {
    setIsResettingPassword(true);
    try {
      const result = await AuthService.requestPasswordReset(resetEmail);
      setResetCode('');
      addToast(result.message, 'success');
    } catch (error) {
      addToast(error.message || 'Could not resend the reset code.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSetNewPassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmNewPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }

    setIsResettingPassword(true);
    try {
      const result = await AuthService.completePasswordReset(resetToken, newPassword);
      setEmail(resetEmail);
      setPassword('');
      setResetCode('');
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetStep('login');
      addToast(result.message, 'success');
    } catch (error) {
      addToast(error.message || 'Could not reset your password.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleReturnToLogin = () => {
    setResetStep('login');
    setResetCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  return (
    <main className="login-page">
      <div className="login-panel">
        {/* Left University Identity Section */}
        <section className="login-left">
          <img src={cmuLogo} alt="City of Malabon University Logo" className="login-left-logo" />
          <div className="login-left-text">
            <h3>City of Malabon University</h3>
            <p>Office of The Registrar</p>
          </div>
        </section>

        {/* Right Auth Portal Section */}
        <section className="login-right">
          <div className="login-right-content">
            <h1 className="login-brand">
              E-CMU <span>PORTAL</span>
            </h1>
            <h2>
              {resetStep === 'login'
                ? loginVerificationRequired ? 'Verify student sign-in' : 'Sign in'
                : resetStep === 'request'
                  ? 'Forgot password'
                  : resetStep === 'verify'
                    ? 'Verify your email'
                    : 'Choose a new password'}
            </h2>
            <p className="login-subtext">
              {resetStep === 'login'
                ? loginVerificationRequired
                  ? `Enter the six-digit sign-in code sent to ${email}.`
                  : <>or{' '}
                    <button
                      type="button"
                      className="gold-link text-button"
                      onClick={() => setShowRegisterModal(true)}
                    >
                      create an account
                    </button>
                  </>
                : resetStep === 'request'
                  ? 'Enter your university email and we will send a password reset code if an account matches.'
                  : resetStep === 'verify'
                    ? `Enter the six-digit reset code sent to ${resetEmail}.`
                    : 'Enter your new password twice to finish resetting your account.'}
            </p>

            {resetStep === 'login' ? (
              <form
                onSubmit={loginVerificationRequired ? handleVerifyStudentLogin : handleLoginSubmit}
                className="auth-form"
              >
                <div className="form-field-group">
                  <label htmlFor="email" className="auth-label">University Email</label>
                  <input
                    id="email"
                    type="email"
                    className="auth-input"
                    placeholder="you@cityofmalabonuniversity.edu.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    disabled={isLoggingIn || loginVerificationRequired}
                  />
                </div>

                {loginVerificationRequired ? (
                  <div className="form-field-group">
                    <label htmlFor="studentLoginCode" className="auth-label">Six-digit sign-in code</label>
                    <input
                      id="studentLoginCode"
                      type="text"
                      className="auth-input verification-code-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="123456"
                      value={loginVerificationCode}
                      onChange={(event) => setLoginVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={isVerifyingLogin}
                    />
                  </div>
                ) : (
                  <div className="form-field-group">
                    <label htmlFor="password" className="auth-label">Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        disabled={isLoggingIn}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-button"
                  disabled={loginVerificationRequired
                    ? isVerifyingLogin || loginVerificationCode.length !== 6
                    : isLoggingIn}
                >
                  {loginVerificationRequired
                    ? isVerifyingLogin ? 'VERIFYING...' : 'VERIFY AND SIGN IN'
                    : isLoggingIn ? 'SIGNING IN...' : 'SIGN IN'}
                </button>

                {loginVerificationRequired ? (
                  <>
                    <button
                      type="button"
                      className="forgot-link text-button"
                      onClick={handleResendStudentLoginCode}
                      disabled={isVerifyingLogin}
                    >
                      {isVerifyingLogin ? 'SENDING...' : 'Resend code'}
                    </button>
                    <button
                      type="button"
                      className="forgot-link text-button"
                      onClick={handleReturnToLoginCredentials}
                      disabled={isVerifyingLogin}
                    >
                      Back to sign in
                    </button>
                  </>
                ) : (
                  <div className="auth-footer-actions">
                    <button
                      type="button"
                      className="forgot-link text-button"
                      onClick={() => {
                        setResetEmail(email);
                        setResetStep('request');
                      }}
                    >
                      Forgotten your password?
                    </button>
                    <button
                      type="button"
                      className="forgot-link text-button"
                      onClick={() => setShowGuideModal(true)}
                    >
                      Student guide
                    </button>
                  </div>
                )}
              </form>
            ) : resetStep === 'request' ? (
              <form onSubmit={handleRequestPasswordReset} className="auth-form">
                <div className="form-field-group">
                  <label htmlFor="resetEmail" className="auth-label">University Email</label>
                  <input
                    id="resetEmail"
                    type="email"
                    className="auth-input"
                    placeholder="you@cityofmalabonuniversity.edu.ph"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    autoComplete="email"
                    required
                    disabled={isResettingPassword}
                  />
                </div>
                <button type="submit" className="auth-button" disabled={isResettingPassword}>
                  {isResettingPassword ? 'SENDING...' : 'SEND RESET CODE'}
                </button>
                <button type="button" className="forgot-link text-button" onClick={handleReturnToLogin}>
                  Back to sign in
                </button>
              </form>
            ) : resetStep === 'verify' ? (
              <form onSubmit={handleVerifyPasswordResetCode} className="auth-form">
                <div className="form-field-group">
                  <label htmlFor="resetCode" className="auth-label">Six-digit reset code</label>
                  <input
                    id="resetCode"
                    type="text"
                    className="auth-input verification-code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    disabled={isResettingPassword}
                  />
                </div>
                <button type="submit" className="auth-button" disabled={isResettingPassword || resetCode.length !== 6}>
                  {isResettingPassword ? 'VERIFYING...' : 'VERIFY CODE'}
                </button>
                <button
                  type="button"
                  className="forgot-link text-button"
                  onClick={handleResendPasswordResetCode}
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? 'SENDING...' : 'Resend code'}
                </button>
                <button type="button" className="forgot-link text-button" onClick={handleReturnToLogin}>
                  Back to sign in
                </button>
              </form>
            ) : (
              <form onSubmit={handleSetNewPassword} className="auth-form">
                <div className="form-field-group">
                  <label htmlFor="newPassword" className="auth-label">New password</label>
                  <input
                    id="newPassword"
                    type="password"
                    className="auth-input"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    disabled={isResettingPassword}
                  />
                </div>
                <div className="form-field-group">
                  <label htmlFor="confirmNewPassword" className="auth-label">Re-enter new password</label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    className="auth-input"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    required
                    disabled={isResettingPassword}
                  />
                </div>
                <button type="submit" className="auth-button" disabled={isResettingPassword}>
                  {isResettingPassword ? 'UPDATING PASSWORD...' : 'RESET PASSWORD'}
                </button>
                <button type="button" className="forgot-link text-button" onClick={handleReturnToLogin}>
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* Registration Modal */}
      <RegistrationModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
      />

      <Modal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        title="Student Guide"
        maxWidth="900px"
      >
        <div className="login-guide-modal-content">
          <Guide />
        </div>
      </Modal>

    </main>
  );
}

/**
 * Registration Modal Component
 */
function RegistrationModal({ isOpen, onClose }) {
  const [regData, setRegData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStep, setRegistrationStep] = useState('details');
  const [registrationCode, setRegistrationCode] = useState('');
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
  const [hasAgreedToDataProtection, setHasAgreedToDataProtection] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  const { addToast } = useToast();

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!hasAgreedToTerms || !hasAgreedToDataProtection) {
      addToast('Please confirm both agreements before creating an account.', 'error');
      return;
    }
    if (!regData.email.toLowerCase().endsWith('@cityofmalabonuniversity.edu.ph')) {
      addToast('Use your @cityofmalabonuniversity.edu.ph email address.', 'error');
      return;
    }
    if (regData.password !== regData.confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }

    setIsRegistering(true);
    try {
      const result = await AuthService.register({
        email: regData.email,
        password: regData.password,
      });
      setRegistrationStep('verify');
      setRegistrationCode('');
      addToast(result.message || 'Enter the verification code sent to your university email.', 'success');
    } catch (error) {
      if (error.status === 429) {
        setRegistrationStep('verify');
        setRegistrationCode('');
        addToast(error.message || 'A verification code was recently sent. Check your email.', 'info');
      } else {
        addToast(error.message || 'Account creation failed.', 'error');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerifyRegistrationCode = async (event) => {
    event.preventDefault();
    setIsRegistering(true);
    try {
      const result = await AuthService.verifyRegistrationCode(regData.email, registrationCode);
      addToast(result.message || 'Email verified. You can now sign in.', 'success');
      handleModalClose();
    } catch (error) {
      addToast(error.message || 'Could not verify the registration code.', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleResendRegistrationCode = async () => {
    setIsRegistering(true);
    try {
      const result = await AuthService.resendRegistrationCode(regData.email);
      setRegistrationCode('');
      addToast(result.message || 'A new verification code has been sent.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not resend the verification code.', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleModalClose = () => {
    if (selectedPolicy) {
      setSelectedPolicy(null);
      return;
    }

    setRegData({ email: '', password: '', confirmPassword: '' });
    setHasAgreedToTerms(false);
    setHasAgreedToDataProtection(false);
    setSelectedPolicy(null);
    setRegistrationStep('details');
    setRegistrationCode('');
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title={registrationStep === 'verify' ? 'Verify your university email' : 'Create an account'}
        maxWidth="450px"
      >
        {registrationStep === 'verify' ? (
          <form onSubmit={handleVerifyRegistrationCode} className="auth-form">
            <p className="auth-hint">
              Enter the six-digit verification code sent to <strong>{regData.email}</strong>.
              The code expires after 10 minutes.
            </p>
            <div className="form-field-group">
              <label htmlFor="registrationCode" className="auth-label">Six-digit verification code</label>
              <input
                id="registrationCode"
                type="text"
                className="auth-input verification-code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={registrationCode}
                onChange={(event) => setRegistrationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                disabled={isRegistering}
              />
            </div>
            <button type="submit" className="auth-button" disabled={isRegistering || registrationCode.length !== 6}>
              {isRegistering ? 'VERIFYING...' : 'VERIFY EMAIL'}
            </button>
            <button
              type="button"
              className="forgot-link text-button"
              onClick={handleResendRegistrationCode}
              disabled={isRegistering}
            >
              {isRegistering ? 'SENDING...' : 'Resend code'}
            </button>
            <button
              type="button"
              className="forgot-link text-button"
              onClick={() => setRegistrationStep('details')}
              disabled={isRegistering}
            >
              Back to registration details
            </button>
          </form>
        ) : (
        <form onSubmit={handleRegisterSubmit} className="auth-form">
          <p className="registration-disclaimer" role="note">
            Student accounts are activated after you verify the code sent to your university email.
          </p>

            <div className="form-field-group">
              <label htmlFor="regEmail" className="auth-label">University Email</label>
              <input
                id="regEmail"
                type="email"
                className="auth-input"
                placeholder="you@cityofmalabonuniversity.edu.ph"
                value={regData.email}
                onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                autoComplete="email"
                required
                disabled={isRegistering}
              />
              <p className="auth-hint">
                Use your official student email. The part before @ must match the StudentId on file with the Registrar.
              </p>
            </div>

            <div className="form-field-group">
              <label htmlFor="regPassword" className="auth-label">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="regPassword"
                  type={showRegPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Create a strong password"
                  value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={isRegistering}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowRegPassword((prev) => !prev)}
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                >
                  {showRegPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="form-field-group">
              <label htmlFor="regConfirmPassword" className="auth-label">Re-enter password</label>
              <input
                id="regConfirmPassword"
                type={showRegPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Re-enter your password"
                value={regData.confirmPassword}
                onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isRegistering}
              />
            </div>

            <div className="registration-consent-group">
              <div className="registration-consent">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  checked={hasAgreedToTerms}
                  onChange={(e) => setHasAgreedToTerms(e.target.checked)}
                  required
                  disabled={isRegistering}
                />
                <span>
                  <label htmlFor="acceptTerms">I agree to the </label>
                  <button type="button" className="registration-policy-link" onClick={() => setSelectedPolicy('terms')}>
                    Terms and Conditions
                  </button>
                  .
                </span>
              </div>
              <div className="registration-consent">
                <input
                  id="acceptDataProtection"
                  type="checkbox"
                  checked={hasAgreedToDataProtection}
                  onChange={(e) => setHasAgreedToDataProtection(e.target.checked)}
                  required
                  disabled={isRegistering}
                />
                <span>
                  <label htmlFor="acceptDataProtection">I acknowledge the </label>
                  <button type="button" className="registration-policy-link" onClick={() => setSelectedPolicy('privacy')}>
                    Privacy Policy
                  </button>
                  .
                </span>
              </div>
              <p className="registration-policy-notice">
                Read our{' '}
                <button type="button" className="registration-policy-link" onClick={() => setSelectedPolicy('cookies')}>
                  Cookie Policy
                </button>
                .
              </p>
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={isRegistering || !hasAgreedToTerms || !hasAgreedToDataProtection}
            >
              {isRegistering ? 'CREATING...' : 'CREATE ACCOUNT'}
            </button>
        </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(selectedPolicy)}
        onClose={() => setSelectedPolicy(null)}
        title={selectedPolicy ? REGISTRATION_POLICIES[selectedPolicy].title : ''}
        maxWidth="620px"
        zIndex={10001}
      >
        {selectedPolicy && (
          <div className="registration-policy-content">
            {REGISTRATION_POLICIES[selectedPolicy].sections.map((section) => (
              <section key={section.heading}>
                <h3>{section.heading}</h3>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

export default Login;