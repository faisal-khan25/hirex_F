import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from '../hooks/useHooks';
import api from '../services/api';
import useSEO from '../hooks/useSeo';
import loadGoogleFont from '../utils/loadGoogleFont';
import './Register.css';

// Fired once, as soon as this lazy chunk is evaluated — before it blocks
// on anything else — so the font request starts as early as possible
// without being render-blocking (see utils/loadGoogleFont.js).
loadGoogleFont('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { form, onChange } = useForm({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'JOBSEEKER'
  });

  useSEO({
    title: 'Create Account',
    description: "Join HireX — India's #1 job platform. Create a free profile, apply to 50,000+ jobs, and connect with top recruiters in minutes.",
    url: 'https://hirex.in/register',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/register', form);

      login(
        {
          id: res.data.id,
          name: res.data.name,
          email: res.data.email,
          role: res.data.role
        },
        res.data.token
      );

      if (res.data.role === 'MANAGER') {
        navigate('/manager/company');
      } else {
        navigate('/jobseeker/browse');
      }

    } catch (e) {
      setError(
        e.response?.data?.error || 'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-wrapper">
      <div className="register-card">

        {/* LEFT MARKETING PANEL */}
        <aside className="register-left-panel">
          {/* Logo */}
          <div className="left-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="logo-icon">
              <circle cx="12" cy="12" r="10" stroke="#0086f0" strokeWidth="2.5" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#4ade80" strokeWidth="2" />
              <path d="M2 12h20" stroke="#0086f0" strokeWidth="2" />
            </svg>
            <span className="logo-text">Hire<span className="logo-highlight">X</span></span>
          </div>

          <div className="left-headline-container">
            <h1 className="left-title">Start your professional journey with us</h1>
            <p className="left-subtitle">Create a profile to easily apply to verified jobs, receive tailored vacancy alerts, and catch recruiters' attention.</p>
          </div>

          {/* Graphics & Floating Badges Container */}
          <div className="illustration-container">
            <div className="bg-circle blue-circle"></div>
            <div className="bg-circle green-half-ring"></div>
            <span className="sparkle spark-blue">✦</span>
            <span className="sparkle spark-green">✦</span>

            <img 
              src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&auto=format&fit=crop" 
              alt="Professional Career Growth" 
              className="candidate-image"
            />

            {/* Floating Badge Left */}
            <div className="floating-badge badge-left">
              <div className="avatar-group">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&auto=format" alt="User" width="26" height="26" loading="lazy" decoding="async" />
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&auto=format" alt="User" width="26" height="26" loading="lazy" decoding="async" />
                <div className="avatar-more">+</div>
              </div>
              <div className="badge-text">
                <strong>50k+ Active Jobs</strong>
                <span>Updated hourly</span>
              </div>
            </div>

            {/* Floating Badge Right */}
            <div className="floating-badge badge-right">
              <div className="badge-icon-circle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="badge-text">
                <strong>Direct Hiring</strong>
                <span>With top HRs</span>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT INTERACTIVE FORM PANEL */}
        <section className="register-right-panel">
          
          {/* Top Navigation switch */}
          <div className="login-link">
            Already Registered? <Link to="/login">Login here</Link>
          </div>

          <div className="right-header">
            <h2 className="welcome-title">Create your HireX profile</h2>
            <p className="welcome-subtitle">Search & apply to jobs from India's No.1 Job Site</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Dynamic Role Switcher */}
          <div className="role-toggle">
            {[
              { value: 'JOBSEEKER', label: '👤 Job Seeker' },
              { value: 'MANAGER', label: '🏢 Recruiter' }
            ].map((opt) => (
              <label
                key={opt.value}
                className={`role-btn ${form.role === opt.value ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={form.role === opt.value}
                  onChange={onChange}
                />
                {opt.label}
              </label>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            
            {/* Full Name */}
            <div className="form-group">
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="What is your full name? *"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="form-group">
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="Enter Email ID * (We will send updates here)"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field with Hide/Show Toggle */}
            <div className="form-group">
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Create password * (Min 6 characters)"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Modernized Mobile Number Input */}
            <div className="form-group">
              <div className="phone-box">
                <span className="country-code">
                  🇮🇳 +91
                </span>
                <input
                  id="reg-phone"
                  name="phone"
                  value={form.phone}
                  onChange={onChange}
                  placeholder="Enter 10-digit mobile number *"
                  type="tel"
                  autoComplete="tel-national"
                  required
                />
              </div>
              <small className="field-hint">Recruiters will use this number to contact you</small>
            </div>

            {/* Registration Submit Button */}
            <button
              type="submit"
              className="register-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Register now'}
            </button>
          </form>

          {/* Social login divider */}
          <div className="divider">
            <span>Or register with</span>
          </div>

          {/* Google Sign-up Action */}
          <button type="button" className="google-btn">
            <svg className="social-icon" width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign up with Google</span>
          </button>

          <p className="terms">
            By clicking Register, you agree to our{' '}
            <Link to="/terms-and-conditions">Terms of Service</Link> &{' '}
            <Link to="/privacy-policy">Privacy Policy</Link>
          </p>
        </section>

      </div>
    </div>
  );
}