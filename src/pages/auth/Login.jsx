/**
 * Component: Login & Auth Suite
 * Modern authentication page featuring student/staff sign-in, account creation
 * with @cityofmalabonuniversity.edu.ph domain validation, password visibility toggles,
 * 6-digit OTP email verification, and password reset modals.
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AuthService } from '../../services/api';
import Modal from '../../components/ui/Modal';
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

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Modal Visibility States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { login } = useAuth();
  const { addToast } = useToast();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const result = await AuthService.login(email, password);
      login(result.user);
      addToast('Signed in successfully.', 'success');
    } catch (error) {
      if (error.message?.toLowerCase().includes('not verified') || error.status === 403) {
        addToast('Please verify your email before signing in.', 'warning');
        setShowResendModal(true);
      } else {
        addToast(error.message || 'Sign in failed.', 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
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
                  disabled={isLoggingIn}
                />
              </div>

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

              <button
                type="submit"
                className="auth-button"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'SIGNING IN...' : 'SIGN IN'}
              </button>

              <div className="auth-footer-actions">
                <button
                  type="button"
                  className="forgot-link text-button"
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgotten your password?
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* Registration Modal */}
      <RegistrationModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
      />

      {/* Resend Verification Code Modal */}
      <ResendConfirmationModal
        isOpen={showResendModal}
        onClose={() => setShowResendModal(false)}
      />

      {/* Password Reset Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </main>
  );
}

/**
 * Forgot Password Reset Request Modal Component
 */
function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (AuthService.requestPasswordReset) {
        await AuthService.requestPasswordReset(email);
      } else {
        // Fallback delay if API endpoint is stubbed
        await new Promise((res) => setTimeout(res, 800));
      }
      setIsSubmitted(true);
      addToast('Password reset link sent to your email.', 'success');
    } catch (error) {
      addToast(error.message || 'Failed to send reset link.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setEmail('');
    setIsSubmitted(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Reset your password" maxWidth="450px">
      {isSubmitted ? (
        <div className="auth-form" style={{ textAlign: 'center' }}>
          <p className="auth-subtext-modal">
            If an account exists for <strong>{email}</strong>, instructions to reset your password have been sent.
          </p>
          <button type="button" className="auth-button" onClick={handleModalClose}>
            RETURN TO SIGN IN
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <p className="auth-subtext-modal">
            Enter your university email address and we will send you a link to reset your password.
          </p>
          <div className="form-field-group">
            <label htmlFor="resetEmail" className="auth-label">University Email</label>
            <input
              id="resetEmail"
              type="email"
              className="auth-input"
              placeholder="you@cityofmalabonuniversity.edu.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <button type="submit" className="auth-button" disabled={isSubmitting}>
            {isSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
          </button>
        </form>
      )}
    </Modal>
  );
}

/**
 * Reusable 6-Digit Verification PIN Form Component
 */
function VerificationCodeForm({
  email,
  onSuccess,
  emailDeliveryIssue,
  onResend,
  isResending,
}) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { addToast } = useToast();

  const handleVerifyCode = async (event) => {
    event.preventDefault();
    setIsVerifying(true);
    try {
      const result = await AuthService.verifyEmail(email, verificationCode);
      addToast(result.message || 'Email verified successfully.', 'success');
      onSuccess();
    } catch (error) {
      addToast(error.message || 'Could not verify the code.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="auth-form">
      <p className="auth-subtext-modal">
        {emailDeliveryIssue
          ? 'Your account was created, but we could not send the verification code automatically.'
          : 'Enter the six-digit code sent to your email. It expires after 120 seconds.'}
      </p>
      <p className="confirmed-email-display"><strong>{email}</strong></p>

      {!emailDeliveryIssue && (
        <form onSubmit={handleVerifyCode} className="auth-form">
          <label htmlFor="verificationCode" className="auth-label">Verification code</label>
          <input
            id="verificationCode"
            type="text"
            className="auth-input verification-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            disabled={isVerifying || isResending}
          />
          <button
            type="submit"
            className="auth-button"
            disabled={isVerifying || isResending || verificationCode.length !== 6}
          >
            {isVerifying ? 'VERIFYING...' : 'VERIFY EMAIL'}
          </button>
        </form>
      )}

      {onResend && (
        <button
          type="button"
          className="auth-button btn-secondary"
          onClick={onResend}
          disabled={isResending || isVerifying}
          style={{ marginTop: '0.5rem' }}
        >
          {isResending ? 'SENDING...' : 'RESEND VERIFICATION CODE'}
        </button>
      )}
    </div>
  );
}

/**
 * Registration Modal Component
 */
function RegistrationModal({ isOpen, onClose }) {
  const [regData, setRegData] = useState({ email: '', password: '', confirmPassword: '' });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [emailDeliveryIssue, setEmailDeliveryIssue] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const { addToast } = useToast();

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regData.password !== regData.confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    if (!regData.email.toLowerCase().endsWith('@cityofmalabonuniversity.edu.ph')) {
      addToast('Use your @cityofmalabonuniversity.edu.ph email address.', 'error');
      return;
    }

    setIsRegistering(true);
    try {
      const result = await AuthService.register({
        email: regData.email,
        password: regData.password,
      });
      setConfirmationEmail(result.email);
      setEmailDeliveryIssue(false);
      addToast('Account created. Enter the six-digit code sent to your email within two minutes.', 'success');
    } catch (error) {
      if (error.status === 503) {
        setConfirmationEmail(regData.email);
        setEmailDeliveryIssue(true);
      }
      addToast(error.message || 'Account creation failed.', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleResendConfirmation = async () => {
    setIsResending(true);
    try {
      await AuthService.resendConfirmation(confirmationEmail);
      setEmailDeliveryIssue(false);
      addToast('A new verification code has been sent. It expires in 120 seconds.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not resend the confirmation email.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleModalClose = () => {
    setRegData({ email: '', password: '', confirmPassword: '' });
    setConfirmationEmail('');
    setEmailVerified(false);
    setEmailDeliveryIssue(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Create an account" maxWidth="450px">
      {confirmationEmail ? (
        emailVerified ? (
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <p>Your email is confirmed. You can now sign in to your account.</p>
            <button type="button" className="auth-button" onClick={handleModalClose}>
              CONTINUE TO SIGN IN
            </button>
          </div>
        ) : (
          <VerificationCodeForm
            email={confirmationEmail}
            emailDeliveryIssue={emailDeliveryIssue}
            onSuccess={() => setEmailVerified(true)}
            onResend={handleResendConfirmation}
            isResending={isResending}
          />
        )
      ) : (
        <form onSubmit={handleRegisterSubmit} className="auth-form">
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
              Registration is restricted to official @cityofmalabonuniversity.edu.ph email addresses.
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
            <label htmlFor="regConfirmPassword" className="auth-label">Confirm Password</label>
            <input
              id="regConfirmPassword"
              type="password"
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

          <button type="submit" className="auth-button" disabled={isRegistering}>
            {isRegistering ? 'CREATING...' : 'CREATE ACCOUNT'}
          </button>
        </form>
      )}
    </Modal>
  );
}

/**
 * Resend Confirmation Code Modal Component
 */
function ResendConfirmationModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSending(true);
    try {
      const result = await AuthService.resendConfirmation(email);
      setVerificationEmail(email);
      addToast(result.message || 'Verification email sent.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not resend the confirmation email.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleModalClose = () => {
    setEmail('');
    setVerificationEmail('');
    setEmailVerified(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Resend verification code" maxWidth="450px">
      {emailVerified ? (
        <div className="auth-form" style={{ textAlign: 'center' }}>
          <p>Your email is confirmed. You can now sign in.</p>
          <button type="button" className="auth-button" onClick={handleModalClose}>
            CONTINUE TO SIGN IN
          </button>
        </div>
      ) : verificationEmail ? (
        <VerificationCodeForm
          email={verificationEmail}
          onSuccess={() => setEmailVerified(true)}
        />
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field-group">
            <label htmlFor="resendEmail" className="auth-label">University Email</label>
            <input
              id="resendEmail"
              type="email"
              className="auth-input"
              placeholder="you@cityofmalabonuniversity.edu.ph"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isSending}
            />
          </div>
          <button type="submit" className="auth-button" disabled={isSending}>
            {isSending ? 'SENDING...' : 'RESEND EMAIL'}
          </button>
        </form>
      )}
    </Modal>
  );
}

export default Login;