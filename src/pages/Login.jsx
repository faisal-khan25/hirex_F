import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from '../hooks/useHooks';
import api from '../services/api';
import useSEO from '../hooks/useSeo';
import loadGoogleFont from '../utils/loadGoogleFont';
import './login.css';

// Fired once, as soon as this lazy chunk is evaluated — before it blocks
// on anything else — so the font request starts as early as possible
// without being render-blocking (see utils/loadGoogleFont.js).
loadGoogleFont('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

export default function Login() {
  useSEO({
    title: 'Login',
    description: 'Sign in to HireX to browse jobs, track applications, or manage your hiring pipeline.',
    url: 'https://hirex.in/login',
  });

  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { form, onChange } = useForm({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', form);
      login({ id: res.data.id, name: res.data.name, email: res.data.email, role: res.data.role }, res.data.token);
      const paths = { JOBSEEKER: '/jobseeker/browse', MANAGER: '/manager/jobs', ADMIN: '/admin/dashboard' };
      navigate(paths[res.data.role] || '/');
    } catch (e) {
      setError(e.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        
        {/* LEFT MARKETING PANEL */}
        <aside className="login-left-panel">
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
            <h1 className="left-title">Find your dream job simply and quickly</h1>
            <p className="left-subtitle">Discover curated opportunities matching your skillset and fast-track your professional growth.</p>
          </div>

          {/* Graphical Illustration Container */}
          <div className="illustration-container">
            {/* Background decorative elements */}
            <div className="bg-circle blue-circle"></div>
            <div className="bg-circle green-half-ring"></div>
            <span className="sparkle spark-blue">✦</span>
            <span className="sparkle spark-green">✦</span>

            {/* Professional Portrait (High-quality placeholder mimicking reference) */}
            <img 
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&auto=format&fit=crop" 
              alt="Successful candidate" 
              className="candidate-image"
            />

            {/* Floating Badge 1: Left */}
            <div className="floating-badge badge-left">
              <div className="avatar-group">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&auto=format" alt="User" />
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&auto=format" alt="User" />
                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&fit=crop&auto=format" alt="User" />
                <div className="avatar-more">+</div>
              </div>
              <div className="badge-text">
                <strong>100k+ Jobseekers</strong>
                <span>Got Hired</span>
              </div>
            </div>

            {/* Floating Badge 2: Right */}
            <div className="floating-badge badge-right">
              <div className="badge-icon-circle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="badge-text">
                <strong>Better Paths</strong>
                <span>To opportunities</span>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT INTERACTIVE FORM PANEL */}
        <section className="login-right-panel">
          <div className="right-header">
            <h2 className="welcome-title">Welcome back!</h2>
            <p className="welcome-subtitle">Access your projects, manage campaigns, and collaborate with our expert team.</p>
          </div>

          {/* Social Auth Grid */}
          <div className="social-auth-container">
            <button type="button" className="google-btn">
              <svg className="social-icon" width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>
            <button type="button" className="facebook-btn" aria-label="Continue with Facebook">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
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
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
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

            {/* Remember Me & Forgot Password Row */}
            <div className="form-options">
              <label className="remember-me">
                <input type="checkbox" id="remember" />
                <span>Remember me</span>
              </label>
              <span className="forgot-password">Forgot your password?</span>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="register-text">
            Don't have an account? <Link to="/register">Sign Up</Link>
          </div>

          {/* Footer Branding Links */}
          <footer className="form-footer">
            <div className="footer-links">
              <Link to="/terms-and-conditions">Terms of Service</Link>
              <Link to="/privacy-policy">Privacy Policy</Link>
            </div>
            <p className="copyright">HireX 2026. All rights reserved.</p>
          </footer>
        </section>

      </div>
    </div>
  );
}