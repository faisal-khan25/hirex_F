import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Contact.css';
import useSEO from '../hooks/useSeo';
import api from '../services/api';

const SUPPORT_CARDS = [
  { icon: '💬', title: 'Live Chat',       desc: 'Connect with an agent instantly during business hours.', cta: 'Start Chat',        href: '#cp-contact-form' },
  { icon: '📧', title: 'Email Support',  desc: 'Send a detailed query — we reply within 24 hours.',     cta: 'Send Email',        href: 'mailto:support@hirex.in' },
  { icon: '📞', title: 'Call Us',        desc: 'Speak to our team, Mon–Sat 9 AM – 6 PM IST.',           cta: 'Call Now',          href: 'tel:+918000000000' },
  { icon: '📖', title: 'Help Center',    desc: 'Browse hundreds of guides, FAQs and how-to articles.',  cta: 'Visit Help Center', href: '/#help' },
];

const INFO_ITEMS = [
  { icon: '📧', label: 'Email',       value: 'support@hirex.in',               href: 'mailto:support@hirex.in' },
  { icon: '📞', label: 'Phone',       value: '+91 80000 00000',                href: 'tel:+918000000000' },
  { icon: '🕘', label: 'Hours',       value: 'Mon–Sat, 9 AM – 6 PM IST',     href: null },
  { icon: '📍', label: 'Head Office', value: '4th Floor, Tech Park, Bengaluru — 560001', href: null },
];

const FAQS = [
  { q: 'How do I create an account?',       a: 'Click "Register" at the top right, choose Job Seeker or Recruiter, and complete the form in under 2 minutes.' },
  { q: 'Is HireX free for job seekers?',    a: 'Yes — 100% free. Browse jobs, apply, and track applications at no cost, ever.' },
  { q: 'How long does it take to respond?', a: 'Email queries are answered within 24 business hours. Live chat is immediate during working hours.' },
  { q: 'How do recruiters post jobs?',      a: 'Register as a Manager, log in to your dashboard, and click "Post a Job". Your listing goes live in minutes.' },
];

const OFFICES = [
  { city: 'Bengaluru (HQ)', icon: '🏙️', address: '4th Floor, Tech Park, Outer Ring Road, Bengaluru — 560001', phone: '+91 80000 00000', email: 'support@hirex.in' },
  { city: 'Mumbai',         icon: '🌆', address: '12th Floor, BKC Tower, Bandra Kurla Complex, Mumbai — 400051', phone: '+91 22000 00000', email: 'mumbai@hirex.in' },
  { city: 'Delhi NCR',      icon: '🏛️', address: '8th Floor, Cyber Hub, DLF Phase 2, Gurugram — 122002',        phone: '+91 11000 00000', email: 'delhi@hirex.in' },
];

export default function Contact() {
  const [openFaq, setOpenFaq] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', topic: '', message: '' });

  const updateField = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await api.post('/api/contact', form);
      setSubmitted(true);
    } catch (err) {
      const status = err.response?.status;
      if (!err.response || status === 404) {
        const body = encodeURIComponent(
          `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nTopic: ${form.topic}\n\n${form.message}`
        );
        window.location.href = `mailto:support@hirex.in?subject=${encodeURIComponent(form.topic || 'Contact form')}&body=${body}`;
        setSubmitted(true);
      } else {
        setSubmitError(err.response?.data?.error || 'Failed to send your message. Please try again or email us directly.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  useSEO({
    title: 'Contact Us',
    description: "Get in touch with the HireX team — email, call, or visit one of our offices across India. We typically respond within 24 hours.",
    url: 'https://hirex.in/contact',
  });

  return (
    <main className="cp-page">

      {/* ══ HERO ════════════════════════════════════════════ */}
      <section className="cp-hero">
        <div className="container cp-hero-inner">
          <span className="cp-hero-badge">
            <span className="cp-badge-dot"></span> Contact Us
          </span>
          <h1>
            We'd love to hear<br />
            <span>from you</span>
          </h1>
          <p className="cp-hero-desc">
            Job seeker, recruiter, or partner — our team is ready to help every step of the way.
          </p>
          <div className="cp-hero-stats">
            {[{ num: '< 24h', label: 'Response Time' }, { num: '10K+', label: 'Happy Users' }, { num: '4.8★', label: 'Support Rating' }].map(s => (
              <div key={s.label} className="cp-stat-box">
                <p className="cp-stat-num">{s.num}</p>
                <p className="cp-stat-label">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SUPPORT CHANNELS ════════════════════════════════ */}
      <section className="cp-support">
        <div className="container">
          <div className="cp-section-header">
            <h2 className="cp-section-title">How can we help?</h2>
            <p className="cp-section-sub">Choose the channel that works best for you</p>
          </div>
          <div className="cp-support-grid">
            {SUPPORT_CARDS.map(c => (
              <a key={c.title} href={c.href} className="cp-support-card">
                <div className="cp-support-icon-wrap">
                  <span className="cp-support-icon">{c.icon}</span>
                </div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
                <span className="cp-support-cta">{c.cta} →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FORM + DETAILS ══════════════════════════════════ */}
      <section className="cp-main">
        <div className="container cp-main-inner">

          {/* Left Side: Brand Details */}
          <div className="cp-details">
            <h2>Talk to our team</h2>
            <p className="cp-details-sub">
              Fill in the form or reach us via any channel below. We'll reply within one business day.
            </p>
            <ul className="cp-info-list">
              {INFO_ITEMS.map(item => (
                <li key={item.label}>
                  <div className="cp-info-icon-wrap">{item.icon}</div>
                  <div className="cp-info-content">
                    <strong>{item.label}</strong>
                    {item.href
                      ? <a href={item.href} className="cp-info-link">{item.value}</a>
                      : <span>{item.value}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="cp-social-row">
              <a href="https://linkedin.com/company/hirex" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="cp-social-btn cp-social-li">LN</a>
              <a href="https://twitter.com/hirex" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="cp-social-btn cp-social-tw">TW</a>
              <a href="https://github.com/hirex" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="cp-social-btn cp-social-gh">GH</a>
            </div>
          </div>

          {/* Right Side: Form Card */}
          <div className="cp-form-wrap" id="cp-contact-form">
            {submitted ? (
              <div className="cp-success">
                <div className="cp-success-icon">✓</div>
                <h3>Message Sent!</h3>
                <p>Thanks for reaching out. Our team will get back to you within 24 business hours.</p>
                <button className="cp-btn-reset" onClick={() => setSubmitted(false)}>Send another message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="cp-form">
                <p className="cp-form-title">Send us a message</p>
                <p className="cp-form-hint">Fields marked * are required.</p>
                
                <div className="cp-form-row">
                  <div className="cp-fg">
                    <label htmlFor="cp-name">Full Name *</label>
                    <input id="cp-name" type="text" placeholder="Rahul Sharma" required
                      value={form.name} onChange={updateField('name')} className="cp-input" />
                  </div>
                  <div className="cp-fg">
                    <label htmlFor="cp-email">Email *</label>
                    <input id="cp-email" type="email" placeholder="rahul@example.com" required
                      value={form.email} onChange={updateField('email')} className="cp-input" />
                  </div>
                </div>

                <div className="cp-form-row">
                  <div className="cp-fg">
                    <label htmlFor="cp-phone">Phone</label>
                    <input id="cp-phone" type="tel" placeholder="+91 98765 43210"
                      value={form.phone} onChange={updateField('phone')} className="cp-input" />
                  </div>
                  <div className="cp-fg">
                    <label htmlFor="cp-subject">Topic *</label>
                    <select id="cp-subject" required value={form.topic} onChange={updateField('topic')} className="cp-input cp-select">
                      <option value="">Select a topic</option>
                      <option>Job Seeker Support</option>
                      <option>Recruiter / Employer Support</option>
                      <option>Partnership Enquiry</option>
                      <option>Report a Bug</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="cp-fg">
                  <label htmlFor="cp-msg">Message *</label>
                  <textarea id="cp-msg" rows={5} placeholder="Describe your query in detail…" required
                    value={form.message} onChange={updateField('message')} className="cp-textarea" />
                </div>

                {submitError && <p className="cp-form-error">{submitError}</p>}
                
                <button type="submit" className="cp-submit-btn" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Message →'}
                </button>
              </form>
            )}
          </div>

        </div>
      </section>

      {/* ══ FAQ ═════════════════════════════════════════════ */}
      <section className="cp-faq">
        <div className="container">
          <div className="cp-section-header centered">
            <h2 className="cp-section-title">Frequently Asked Questions</h2>
            <p className="cp-section-sub">Quick answers to common queries</p>
          </div>
          <div className="cp-faq-list">
            {FAQS.map((faq, i) => (
              <div key={i} className={`cp-faq-item${openFaq === i ? ' open' : ''}`}>
                <button className="cp-faq-btn" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{faq.q}</span>
                  <span className="cp-faq-icon">+</span>
                </button>
                <div className="cp-faq-answer">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ OFFICES ═════════════════════════════════════════ */}
      <section className="cp-offices">
        <div className="container">
          <div className="cp-section-header centered">
            <h2 className="cp-section-title">Our Offices</h2>
            <p className="cp-section-sub">Visit us at any of our locations across India</p>
          </div>
          <div className="cp-offices-grid">
            {OFFICES.map(o => (
              <div key={o.city} className="cp-office-card">
                <div className="cp-office-emoji">{o.icon}</div>
                <h3>{o.city}</h3>
                <p className="cp-office-address">{o.address}</p>
                <div className="cp-office-links">
                  <a href={`tel:${o.phone.replace(/\s/g,'')}`} className="cp-office-link">
                    <span className="link-icon">📞</span> {o.phone}
                  </a>
                  <a href={`mailto:${o.email}`} className="cp-office-link">
                    <span className="link-icon">📧</span> {o.email}
                  </a>
                </div>
              </div>
            ))}
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