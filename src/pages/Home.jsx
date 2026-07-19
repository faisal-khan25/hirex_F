import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useSEO from '../hooks/useSeo';
import './home.css';

const STATS = [
  { num: '50K+', label: 'Jobs Posted' },
  { num: '2L+',   label: 'Job Seekers' },
  { num: '10K+', label: 'Recruiters'  },
  { num: '95%',  label: 'Placement Rate' },
];

const FEATURED_JOBS = [
  { logo: 'G', logoBg: '#ea4335', title: 'Senior Frontend Developer', company: 'Google India', loc: 'North, India, In. Namigoat', sal: '₹10,000' },
  { logo: 'T', logoBg: '#1d4ed8', title: 'Senior Frontend Developer', company: 'Tata, India', loc: 'North, India, In. Namigoat', sal: '₹10,000' },
  { logo: 'TA', logoBg: '#0284c7', title: 'Senior Frontend Developer', company: 'TATA India', loc: 'North, India, In. Namigoat', sal: '₹1,000' },
  { logo: 'G', logoBg: '#10b981', title: 'Senior Frontend Developer', company: 'Gaws, India', loc: 'North, India, In. Namigoat', sal: '₹10,000' },
];

const JOB_CATEGORIES = [
  { icon: '💻', label: 'Software Dev', count: '12,400+' },
  { icon: '📈', label: 'Sales & Mktg', count: '4,200+'  },
  { icon: '🎨', label: 'Design & UX',  count: '2,800+'  },
];

const PLATFORM_FEATURES = [
  {
    illus: '🧑‍💼',
    title: 'Smart Job Matching',
    desc: 'AI-powered recommendations surface the most relevant roles based on your skills, experience, and preferences.',
  },
  {
    illus: '🔒',
    title: 'Verified Companies',
    desc: 'Every employer on HireX is verified. Apply with confidence knowing you are talking to real recruiters.',
  },
  {
    illus: '🖥️',
    title: 'Real-time Tracking',
    desc: 'Track every application in one dashboard — from applied to interview to offer, in real time.',
  },
];

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useSEO({
    title: "India's #1 Job Platform",
    description: "HireX connects professionals with top companies across India.",
    url: 'https://hirex.in',
  });

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash]);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <main className="home-page">

      {/* ══ HERO SECTION ══════════════════════════════════════ */}
      <section id="home" className="hero-section">
        <div className="container hero-content">
          <div className="hero-badge">
            <span className="badge-dot"></span> India's #1 Job Platform
          </div>
          <h1 className="hero-title">
            Find Your Next <span>Dream Job</span>
          </h1>
          <p className="hero-desc">HireX connects professionals with top companies.</p>
          <div className="hero-buttons">
            <Link to="/jobs" className="btn-primary">Browse Jobs</Link>
            {!user && <Link to="/register" className="btn-secondary">Upload Resume</Link>}
          </div>
        </div>

        {/* Realistic High-Quality Office Banner Graphic (Layered under the hero content) */}
        <div className="hero-banner-container">
          <img 
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&h=450&q=80" 
            alt="Office Team Banner" 
            loading="eager" 
            decoding="async" 
            className="hero-banner-image"
          />
          <div className="banner-overlay-fade"></div>
        </div>
      </section>

      {/* ══ OVERLAPPING STATS SECTION ═════════════════════════ */}
      <section className="stats-section">
        <div className="container stats-grid">
          {STATS.map((s) => (
            <div key={s.label} className="stat-card">
              <h2>{s.num}</h2>
              <p>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURED JOB OPENINGS ═════════════════════════════ */}
      <section className="featured-section">
        <div className="container">
          <p className="section-subtitle">FEATURED JOB OPENINGS</p>
          <div className="featured-grid">
            {FEATURED_JOBS.map((job, index) => (
              <article key={index} className="job-card">
                <div className="job-card-header">
                  <div className="company-logo-badge" style={{ backgroundColor: job.logoBg }}>
                    {job.logo}
                  </div>
                  <div className="job-meta-info">
                    <h4>{job.title}</h4>
                    <span className="company-name">{job.company}</span>
                  </div>
                </div>
                <div className="job-card-body">
                  <div className="job-spec-item">
                    <span className="spec-icon">📍</span> {job.loc}
                  </div>
                  <div className="job-spec-item">
                    <span className="spec-icon">💼</span> Salary: {job.sal}
                  </div>
                </div>
                <Link to="/jobs" className="btn-view-details">View Details</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PLATFORM FEATURES ═════════════════════════════════ */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="centered-header">
            <h2>Platform Features</h2>
            <p>Everything you need to land your next job, simple and automated.</p>
          </div>
          <div className="features-grid">
            {PLATFORM_FEATURES.map((pf, i) => (
              <div key={i} className="feature-card">
                <div className="feature-emoji">{pf.illus}</div>
                <h3>{pf.title}</h3>
                <p>{pf.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CATEGORIES ════════════════════════════════════════ */}
      <section className="categories-section">
        <div className="container">
          <div className="section-header-left">
            <h2>Browse by Category</h2>
            <p>Explore thousands of openings across every industry</p>
          </div>
          <div className="categories-grid-layout">
            {JOB_CATEGORIES.map((cat) => (
              <Link to="/jobs" key={cat.label} className="cat-card">
                <span className="cat-emoji">{cat.icon}</span>
                <div className="cat-text">
                  <h3>{cat.label}</h3>
                  <p>{cat.count} jobs</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ABOUT US ══════════════════════════════════════════ */}
      <section id="about" className="about-section">
        <div className="container split-columns">
          <div className="split-text">
            <h2>Why Professionals Choose HireX</h2>
            <p>We believe finding a job shouldn't be a job itself. HireX streamlines the connection between top-tier technical talents and modern progressive workspaces across India.</p>
            <p>With verified listings, rapid application review cycles, and interactive transparent communication paths, we bridge the gap efficiently.</p>
          </div>
          <div className="split-visual-cards">
            <div className="visual-glass-card">
              <h3>Fast Application</h3>
              <p>Apply in 1-click using your pre-saved profiles.</p>
            </div>
            <div className="visual-glass-card">
              <h3>Zero Spam</h3>
              <p>Strictly verified recruiters and true openings.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FAQ / HELP SECTION ════════════════════════════════ */}
      <section id="help" className="faq-section">
        <div className="container split-columns">
          <div className="split-text">
            <h2>Frequently Asked Questions</h2>
            <p>Got questions about finding jobs, recruiting, or your account security? We're here to guide you every step of the way.</p>
          </div>
          <div className="faq-accordion">
            <details className="accordion-item">
              <summary>How is HireX different from other portals?</summary>
              <div className="accordion-content">
                <p>Unlike massive sites, we thoroughly screen recruiters and jobs to block spam. Your data remains secure with strict control limits.</p>
              </div>
            </details>
            <details className="accordion-item">
              <summary>Does it cost anything to apply for jobs?</summary>
              <div className="accordion-content">
                <p>No, applying for roles on HireX is completely free for job seekers. There are no hidden subscription charges.</p>
              </div>
            </details>
            <details className="accordion-item">
              <summary>How can I track my application status?</summary>
              <div className="accordion-content">
                <p>Navigate directly to your central private dashboard to inspect real-time application timeline progress.</p>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ══ NEWSLETTER / CALL TO ACTION ════════════════════════ */}
      <section className="newsletter-section">
        <div className="container">
          <div className="newsletter-box">
            <h2>Get Tailored Job Alerts Weekly</h2>
            <p>Don't miss the next opening. Subscribe to our modern curated list of tech jobs tailored directly to your stack.</p>
            {subscribed ? (
              <div className="subscribe-success">🎉 Thank you for subscribing! We'll send alerts to your inbox.</div>
            ) : (
              <form onSubmit={handleSubscribe} className="newsletter-form">
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  aria-label="Email address"
                  className="newsletter-input"
                />
                <button type="submit" className="btn-subscribe">Subscribe</button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ══ SYSTEM FOOTER ═════════════════════════════════════ */}
      <footer className="footer-section">
        <div className="container footer-top-grid">
          
          <div className="footer-brand-column">
            <div className="footer-logo">
              <span className="logo-dot"></span> HireX
            </div>
            <p className="footer-description">
              India's premium high-transparency tech employment network. Matching top developers with validated, forward-thinking workspaces.
            </p>
            <div className="social-links">
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">LN</a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">TW</a>
              <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">GH</a>
            </div>
          </div>

          <div className="footer-links-column">
            <h3>For Candidates</h3>
            <ul>
              <li><Link to="/jobs">Browse Openings</Link></li>
              <li><Link to="/jobs">Explore Salaries</Link></li>
              <li><Link to="/profile">Resume Builder</Link></li>
              <li><Link to="/jobs">Application Tracker</Link></li>
            </ul>
          </div>

          <div className="footer-links-column">
            <h3>For Employers</h3>
            <ul>
              <li><Link to="/register">Post a Job</Link></li>
              <li><Link to="/about">Talent Solutions</Link></li>
              <li><Link to="/help">Pricing Models</Link></li>
              <li><Link to="/about">Employer Branding</Link></li>
            </ul>
          </div>

          <div className="footer-links-column">
            <h3>Company</h3>
            <ul>
              <li><Link to="/about">About HireX</Link></li>
              <li><Link to="/blog">Careers Hub</Link></li>
              <li><Link to="/about">Success Stories</Link></li>
              <li><Link to="/help">Contact Support</Link></li>
            </ul>
          </div>

        </div>

        <div className="container footer-divider"></div>

        <div className="container footer-bottom-flex">
          <p className="copyright-text">
            © 2026 HireX India. Made for developers, by developers.
          </p>
          <div className="legal-links">
            <Link to="/about">Privacy Policy</Link>
            <Link to="/about">Terms of Service</Link>
            <Link to="/help">Cookie Preferences</Link>
          </div>
        </div>
      </footer>

    </main>
  );
}