import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import Mail from 'lucide-react/dist/esm/icons/mail';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';

// ─── Password strength calculator ───
const getPasswordStrength = (pass) => {
  if (!pass) return { level: 0, label: '', segments: [false, false, false] };
  const hasUpper = /[A-Z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  const hasSpecial = /[^A-Za-z0-9]/.test(pass);
  const isLong = pass.length >= 10;

  const score =
    (pass.length >= 6 ? 1 : 0) +
    ((hasUpper || hasNumber) ? 1 : 0) +
    ((hasSpecial || isLong) ? 1 : 0);

  if (score === 1) return { level: 1, label: 'Weak', segments: [true, false, false] };
  if (score === 2) return { level: 2, label: 'Almost there', segments: [true, true, false] };
  if (score >= 3) return { level: 3, label: 'Strong 💪', segments: [true, true, true] };
  return { level: 0, label: '', segments: [false, false, false] };
};

const segmentColors = [
  { active: '#ef4444', glow: 'rgba(239,68,68,0.6)' },
  { active: '#f59e0b', glow: 'rgba(245,158,11,0.6)' },
  { active: '#10b981', glow: 'rgba(16,185,129,0.6)' },
];

// ─── Verify Email Success Screen ───
const VerifyEmailScreen = ({ email, onBack }) => (
  <div className="auth-verify-screen ag-animate-in">
    <div className="auth-verify-icon">
      <Mail size={32} className="auth-verify-mail" />
      <div className="auth-verify-check">
        <CheckCircle size={18} />
      </div>
    </div>
    <h2 className="auth-verify-title">Check your inbox!</h2>
    <p className="auth-verify-body">
      We sent a confirmation link to<br />
      <span className="auth-verify-email">{email}</span>
    </p>
    <p className="auth-verify-hint">
      Click the link in the email to activate your account. Check your spam folder if you don't see it.
    </p>
    <button onClick={onBack} className="auth-verify-back">
      <ArrowLeft size={16} />
      Back to Sign In
    </button>
  </div>
);

// ─── Forgot Password Success Screen ───
const ForgotPasswordScreen = ({ email, onBack }) => (
  <div className="auth-verify-screen ag-animate-in">
    <div className="auth-verify-icon">
      <Mail size={32} className="auth-verify-mail" style={{ color: '#a5b4fc' }} />
    </div>
    <h2 className="auth-verify-title" style={{ background: 'linear-gradient(135deg,#a5b4fc,#c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
      Reset Link Sent
    </h2>
    <p className="auth-verify-body">
      We sent a password reset link to<br />
      <span className="auth-verify-email">{email}</span>
    </p>
    <button onClick={onBack} className="auth-verify-back">
      <ArrowLeft size={16} />
      Back to Sign In
    </button>
  </div>
);

// ─── Smart Password Input ───
const PasswordInput = ({ value, onChange, placeholder = '••••••••', showStrength = false, required }) => {
  const [show, setShow] = useState(false);
  const strength = showStrength ? getPasswordStrength(value) : null;

  return (
    <div className="auth-field-wrapper">
      <div className="auth-input-group">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          className="auth-input auth-input--password"
          autoComplete={showStrength ? 'new-password' : 'current-password'}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className={`auth-eye-btn ${show ? 'auth-eye-btn--active' : ''}`}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {/* Energy Bar — only for Sign Up */}
      {showStrength && value.length > 0 && (
        <div className="auth-strength-wrapper">
          <div className="auth-strength-bar">
            {segmentColors.map((seg, i) => (
              <div
                key={i}
                className="auth-strength-segment"
                style={{
                  background: strength.segments[i] ? seg.active : 'rgba(255,255,255,0.06)',
                  boxShadow: strength.segments[i] ? `0 0 8px ${seg.glow}` : 'none',
                  transition: 'background 0.35s ease, box-shadow 0.35s ease',
                }}
              />
            ))}
          </div>
          {strength.label && (
            <span
              className="auth-strength-label"
              style={{ color: segmentColors[strength.level - 1]?.active }}
            >
              {strength.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN AUTH COMPONENT
// ═══════════════════════════════════════════════════════════════
const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Please enter your email first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://attendance-tracker-pro-delta.vercel.app/reset-password',
    });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      setShowForgot(true);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else if (isSignUp) {
      setShowVerify(true);
    }
  };

  // Flip animation handler
  const handleToggleMode = useCallback(() => {
    setIsFlipping(true);
    setTimeout(() => {
      setIsSignUp(s => !s);
      setPassword('');
      setIsFlipping(false);
    }, 220);
  }, []);

  // ─── Verify Email Screen ───
  if (showVerify) {
    return (
      <div className="auth-scene">
        <AuthOrbs />
        <div className="auth-card">
          <VerifyEmailScreen email={email} onBack={() => { setShowVerify(false); setIsSignUp(false); }} />
        </div>
      </div>
    );
  }

  // ─── Forgot Password Sent Screen ───
  if (showForgot) {
    return (
      <div className="auth-scene">
        <AuthOrbs />
        <div className="auth-card">
          <ForgotPasswordScreen email={email} onBack={() => setShowForgot(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-scene">
      <AuthOrbs />

      {/* ─── The Card (with flip animation) ─── */}
      <div className={`auth-card ${isFlipping ? 'auth-card--flipping' : ''}`}>

        {/* Brand Mark */}
        <div className="auth-brand">
          <div className="auth-brand-dot" />
          <span className="auth-brand-name">Attendance Pro</span>
        </div>

        {/* Heading */}
        <div className="auth-heading-block">
          <h2 className="auth-heading">
            {isSignUp ? 'Create Account' : 'Welcome back'}
          </h2>
          <p className="auth-subheading">
            {isSignUp
              ? 'Start tracking your attendance today'
              : 'Sign in to your personal dashboard'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="auth-form">

          {/* Email */}
          <div className="auth-field-wrapper">
            <label className="auth-label">Email Address</label>
            <input
              type="email"
              placeholder="name@university.edu"
              value={email}
              className="auth-input"
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="auth-field-wrapper">
            <div className="auth-label-row">
              <label className="auth-label">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="auth-forgot-link"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              showStrength={isSignUp}
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
          >
            {loading
              ? <span className="auth-spinner" />
              : isSignUp ? 'Create My Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="auth-toggle-section">
          <span className="auth-toggle-text">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            type="button"
            onClick={handleToggleMode}
            className="auth-toggle-btn"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Ambient Background Orbs (pure CSS animated, zero JS cost) ───
const AuthOrbs = () => (
  <div aria-hidden="true" className="auth-orbs">
    <div className="auth-orb auth-orb--1" />
    <div className="auth-orb auth-orb--2" />
    <div className="auth-orb auth-orb--3" />
  </div>
);

export default Auth;