import LegalPage from './LegalPage';

const LAST_UPDATED = 'July 3, 2026';

const sections = [
  {
    id: 'introduction',
    heading: 'Introduction',
    content: (
      <>
        <p>
          HireX ("HireX", "we", "us", or "our") operates an online platform that connects
          job seekers with recruiters and hiring managers, and provides AI-assisted tools
          such as resume screening and interview practice. This Privacy Policy explains what
          information we collect, how we use it, who we share it with, and the choices you
          have when you use our website, mobile experience, and related services
          (collectively, the "Platform").
        </p>
        <p>
          By creating an account or otherwise using the Platform, you agree to the
          collection and use of information as described in this Policy. If you do not
          agree, please do not use the Platform.
        </p>
      </>
    ),
  },
  {
    id: 'information-we-collect',
    heading: 'Information We Collect',
    content: (
      <>
        <p>We collect information in three ways: information you give us directly, information collected automatically, and information from third parties.</p>
        <p className="legal-subheading">Information you provide</p>
        <ul>
          <li>Account details — name, email address, password, phone number, and role (job seeker, recruiter, or admin).</li>
          <li>Profile content — resume/CV files, work history, education, skills, portfolio links, and a profile photo, if you choose to add one.</li>
          <li>Communications — messages sent through our in-app chat, support requests, and survey responses.</li>
          <li>Recruiter and company details — company name, job postings, and hiring preferences, for recruiter accounts.</li>
        </ul>
        <p className="legal-subheading">Information collected automatically</p>
        <ul>
          <li>Device and log data — IP address, browser type, operating system, and pages visited.</li>
          <li>Usage data — searches performed, jobs viewed or saved, and interactions with AI-driven features.</li>
          <li>Cookies and similar technologies, described further in "Cookies and Tracking Technologies" below.</li>
        </ul>
        <p className="legal-subheading">Information from third parties</p>
        <p>
          We may receive information from identity providers if you sign in with a third-party
          account, and, where permitted, from background-check or verification providers
          engaged by a recruiter.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-information',
    heading: 'How We Use Your Information',
    content: (
      <>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Create and maintain your account and authenticate your sign-ins.</li>
          <li>Match job seekers with relevant roles and help recruiters find suitable candidates.</li>
          <li>Operate AI-assisted features, including resume parsing, ATS screening, and mock interview tools.</li>
          <li>Send service notifications, application updates, and — where you've opted in — product communications.</li>
          <li>Monitor, secure, and improve the Platform, including diagnosing technical issues.</li>
          <li>Detect, investigate, and prevent fraud, abuse, and violations of our Terms & Conditions.</li>
          <li>Comply with legal obligations and enforce our agreements.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'resume-and-profile-data',
    heading: 'Resume and Profile Data',
    content: (
      <>
        <p>
          When you upload a resume or build a profile, we extract structured details such as
          contact information, employment history, education, and skills so that this data can
          power search, matching, and autofill across the Platform. You control what appears on
          your public profile, and you can update or remove your resume at any time from your
          account settings.
        </p>
        <p>
          Job seekers may set their profile visibility (for example, visible to all recruiters,
          visible only to recruiters they apply to, or hidden from search) — recruiters can only
          view the level of detail permitted by your visibility setting.
        </p>
      </>
    ),
  },
  {
    id: 'ai-interview-ats-data',
    heading: 'AI Interview & ATS Data Processing',
    content: (
      <>
        <p>
          Our AI interview tool records your spoken or written responses to practice or
          screening questions and generates feedback such as suggested talking points, pacing,
          and clarity notes. Our Applicant Tracking System (ATS) screening feature analyzes
          resume content against a job's stated requirements to produce a relevance score for
          recruiters.
        </p>
        <ul>
          <li>AI-generated scores and summaries are decision-support signals, not automatic accept/reject decisions — a human recruiter remains responsible for hiring decisions.</li>
          <li>Interview recordings and transcripts are retained only as long as needed for the purpose you used the feature for (for example, the length of an active application), unless you ask us to delete them sooner.</li>
          <li>You may request a copy of AI-generated assessments about you, and you may ask that a decision informed by an AI score be reviewed by a person.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cookies-and-tracking',
    heading: 'Cookies and Tracking Technologies',
    content: (
      <>
        <p>
          We use cookies and similar technologies (such as local storage and pixel tags) to keep
          you signed in, remember your preferences, understand how the Platform is used, and
          measure the performance of our pages.
        </p>
        <ul>
          <li><strong>Essential cookies</strong> — required for login, security, and core site functions; these cannot be turned off.</li>
          <li><strong>Preference cookies</strong> — remember settings like language or saved filters.</li>
          <li><strong>Analytics cookies</strong> — help us understand aggregate usage patterns so we can improve the Platform.</li>
        </ul>
        <p>
          You can control non-essential cookies through your browser settings or our cookie
          preference banner. Disabling certain cookies may limit some Platform features.
        </p>
      </>
    ),
  },
  {
    id: 'data-sharing-with-recruiters',
    heading: 'Data Sharing with Recruiters',
    content: (
      <>
        <p>
          When you apply to a job or make your profile visible to recruiters, we share the
          relevant profile and application information — such as your resume, work history, and
          application answers — with the recruiter or hiring team for that role.
        </p>
        <p>
          We do not sell your personal information to third parties. We may share limited
          information with service providers who help us operate the Platform (for example,
          cloud hosting, email delivery, and analytics providers), each bound by contractual
          confidentiality and data-protection obligations, and where required by law, regulation,
          or valid legal process.
        </p>
      </>
    ),
  },
  {
    id: 'data-security',
    heading: 'Data Security',
    content: (
      <p>
        We use administrative, technical, and physical safeguards designed to protect your
        information, including encryption of data in transit, access controls limiting who can
        view personal data, and regular review of our security practices. No method of
        transmission or storage is completely secure, so while we work hard to protect your
        information, we cannot guarantee its absolute security.
      </p>
    ),
  },
  {
    id: 'data-retention',
    heading: 'Data Retention',
    content: (
      <p>
        We retain personal information for as long as your account is active or as needed to
        provide the Platform, comply with our legal obligations, resolve disputes, and enforce
        our agreements. When you delete your account, we delete or anonymize your personal
        information within a reasonable period, except where we are required or permitted to
        retain it for longer — for example, to comply with a legal obligation or resolve an
        active dispute.
      </p>
    ),
  },
  {
    id: 'user-rights',
    heading: 'User Rights (View, Update, Delete Account)',
    content: (
      <>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li><strong>View</strong> the personal information we hold about you.</li>
          <li><strong>Update or correct</strong> inaccurate or incomplete information directly from your account settings.</li>
          <li><strong>Delete</strong> your account and associated personal data.</li>
          <li><strong>Export</strong> a copy of your data in a portable format.</li>
          <li><strong>Object to or restrict</strong> certain processing, including some uses of AI-driven scoring.</li>
        </ul>
        <p>
          You can exercise most of these rights directly from your account settings. For anything
          not available in-product, contact us using the details in "Contact Information" below,
          and we will respond within a reasonable timeframe.
        </p>
      </>
    ),
  },
  {
    id: 'third-party-services',
    heading: 'Third-Party Services',
    content: (
      <p>
        The Platform may link to or integrate with third-party services, such as identity
        providers for sign-in, calendar tools for interview scheduling, or job-board syndication
        partners. Those services have their own privacy practices, and we encourage you to review
        their policies — we are not responsible for the content or privacy practices of
        third-party sites or services.
      </p>
    ),
  },
  {
    id: 'childrens-privacy',
    heading: "Children's Privacy",
    content: (
      <p>
        The Platform is intended for use by individuals who are at least 18 years old, or the
        applicable age of majority in their jurisdiction, and is not directed to children. We do
        not knowingly collect personal information from children. If we learn that we have
        collected personal information from a child without appropriate consent, we will take
        steps to delete that information promptly.
      </p>
    ),
  },
  {
    id: 'changes-to-this-policy',
    heading: 'Changes to this Privacy Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices
        or for legal, operational, or regulatory reasons. If we make material changes, we will
        update the "Last updated" date above and, where appropriate, provide additional notice
        such as an in-app banner or email. We encourage you to review this page periodically.
      </p>
    ),
  },
  {
    id: 'contact-information',
    heading: 'Contact Information',
    content: (
      <p>
        If you have questions, concerns, or requests regarding this Privacy Policy or your
        personal information, please reach out through our{' '}
        <a href="/contact">Contact page</a>, and our team will get back to you as soon as
        possible.
      </p>
    ),
  },
];

function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro="This Privacy Policy describes how HireX collects, uses, and protects your information when you use our job search, recruiting, and AI-assisted hiring tools."
      sections={sections}
      relatedLink={{ to: '/terms-and-conditions', label: 'Terms & Conditions' }}
    />
  );
}

export default PrivacyPolicy;