import LegalPage from './LegalPage';

const LAST_UPDATED = 'July 3, 2026';

const sections = [
  {
    id: 'acceptance-of-terms',
    heading: 'Acceptance of Terms',
    content: (
      <p>
        These Terms & Conditions ("Terms") govern your access to and use of the HireX
        platform, including our website, mobile experience, and related services
        (collectively, the "Platform"). By creating an account or otherwise using the
        Platform, you agree to be bound by these Terms and by our{' '}
        <a href="/privacy-policy">Privacy Policy</a>. If you do not agree, please do not use
        the Platform.
      </p>
    ),
  },
  {
    id: 'eligibility',
    heading: 'Eligibility',
    content: (
      <p>
        You must be at least 18 years old, or the age of majority in your jurisdiction, and
        able to form a binding contract to use the Platform. By using the Platform, you
        represent that you meet these requirements and that any information you provide during
        registration is accurate and current.
      </p>
    ),
  },
  {
    id: 'user-accounts',
    heading: 'User Accounts',
    content: (
      <>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activity that occurs under your account. Please notify us promptly if you
          suspect any unauthorized use of your account.
        </p>
        <ul>
          <li>Each person or organization may maintain only one active account per role, unless we agree otherwise in writing.</li>
          <li>You agree to provide accurate registration information and to keep it up to date.</li>
          <li>We may suspend or terminate accounts that violate these Terms, as described in "Account Suspension or Termination" below.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'job-seeker-responsibilities',
    heading: 'Job Seeker Responsibilities',
    content: (
      <ul>
        <li>Provide truthful and accurate information in your profile, resume, and applications.</li>
        <li>Use the Platform only to search and apply for genuine employment opportunities.</li>
        <li>Do not misrepresent your identity, qualifications, or work eligibility.</li>
        <li>Respect recruiters' and employers' communications and avoid sending unsolicited or abusive messages.</li>
      </ul>
    ),
  },
  {
    id: 'recruiter-responsibilities',
    heading: 'Recruiter Responsibilities',
    content: (
      <ul>
        <li>Post only genuine, lawful job opportunities with accurate descriptions, compensation ranges where required, and requirements.</li>
        <li>Use candidate information solely for legitimate recruitment and hiring purposes.</li>
        <li>Comply with applicable employment, anti-discrimination, and data-protection laws when reviewing candidates and making hiring decisions.</li>
        <li>Do not use the Platform to collect candidate data for purposes unrelated to recruiting, such as unsolicited marketing.</li>
      </ul>
    ),
  },
  {
    id: 'ai-interview-usage',
    heading: 'AI Interview Usage',
    content: (
      <>
        <p>
          The AI interview feature is a practice and screening tool that generates automated
          feedback and, where enabled by a recruiter, a summary shared with that recruiter. It
          is intended to support — not replace — human judgment in hiring decisions.
        </p>
        <ul>
          <li>Responses you provide during an AI interview may be recorded, transcribed, and analyzed as described in our Privacy Policy.</li>
          <li>You should not treat AI-generated feedback as a guarantee of interview or hiring outcomes.</li>
          <li>Attempting to manipulate, exploit, or reverse-engineer the AI interview system is prohibited.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ats-resume-screening',
    heading: 'ATS Resume Screening',
    content: (
      <p>
        Our Applicant Tracking System (ATS) screening tool analyzes resumes against job
        requirements to help recruiters prioritize applications. Job seekers acknowledge that
        automated screening may affect how quickly or prominently their application is reviewed,
        and recruiters acknowledge that ATS scores are a decision-support signal that should be
        combined with human review before making final hiring decisions.
      </p>
    ),
  },
  {
    id: 'acceptable-use-policy',
    heading: 'Acceptable Use Policy',
    content: (
      <p>
        You agree to use the Platform only for lawful purposes and in a way that does not
        infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the
        Platform. You will comply with all applicable laws and regulations in connection with
        your use of the Platform.
      </p>
    ),
  },
  {
    id: 'prohibited-activities',
    heading: 'Prohibited Activities',
    content: (
      <ul>
        <li>Posting false, misleading, or fraudulent job listings, resumes, or profile information.</li>
        <li>Scraping, harvesting, or bulk-collecting data from the Platform without our written permission.</li>
        <li>Uploading malicious code, attempting to breach security, or interfering with the Platform's normal operation.</li>
        <li>Impersonating another person or entity, or misrepresenting your affiliation with any person or entity.</li>
        <li>Using the Platform to harass, discriminate against, or discriminate on the basis of any protected characteristic.</li>
        <li>Circumventing or attempting to circumvent fees, access controls, or usage limits.</li>
      </ul>
    ),
  },
  {
    id: 'intellectual-property',
    heading: 'Intellectual Property',
    content: (
      <p>
        The Platform, including its design, text, graphics, logos, and underlying software, is
        owned by HireX or our licensors and is protected by intellectual property laws. You
        retain ownership of the content you upload, such as your resume or job postings, but you
        grant us a non-exclusive, worldwide, royalty-free license to host, display, and process
        that content as needed to operate and improve the Platform.
      </p>
    ),
  },
  {
    id: 'limitation-of-liability',
    heading: 'Limitation of Liability',
    content: (
      <p>
        To the fullest extent permitted by law, HireX and its affiliates will not be liable for
        any indirect, incidental, special, consequential, or punitive damages, or any loss of
        profits, data, or goodwill, arising from your use of or inability to use the Platform,
        including any hiring or employment decisions made using information obtained through the
        Platform. The Platform is provided "as is" and "as available" without warranties of any
        kind, to the extent permitted by law.
      </p>
    ),
  },
  {
    id: 'account-suspension-termination',
    heading: 'Account Suspension or Termination',
    content: (
      <p>
        We may suspend or terminate your access to the Platform, with or without notice, if we
        believe you have violated these Terms, engaged in fraudulent or unlawful activity, or
        created risk or possible legal exposure for HireX or other users. You may also close
        your account at any time from your account settings. Certain provisions of these Terms,
        such as intellectual property and limitation of liability, will survive termination.
      </p>
    ),
  },
  {
    id: 'governing-law',
    heading: 'Governing Law',
    content: (
      <p>
        These Terms are governed by the laws of the jurisdiction in which HireX is
        established, without regard to conflict-of-law principles, unless otherwise required by
        applicable local law. Any disputes arising from these Terms or your use of the Platform
        will be subject to the exclusive jurisdiction of the courts located there, except where
        applicable law provides otherwise.
      </p>
    ),
  },
  {
    id: 'changes-to-the-terms',
    heading: 'Changes to the Terms',
    content: (
      <p>
        We may revise these Terms from time to time to reflect changes in our services, or for
        legal or operational reasons. If we make material changes, we will update the "Last
        updated" date above and, where appropriate, notify you through the Platform or by email.
        Continuing to use the Platform after changes take effect constitutes acceptance of the
        revised Terms.
      </p>
    ),
  },
  {
    id: 'contact-information',
    heading: 'Contact Information',
    content: (
      <p>
        If you have questions about these Terms & Conditions, please reach out through our{' '}
        <a href="/contact">Contact page</a>, and our team will get back to you as soon as
        possible.
      </p>
    ),
  },
];

function TermsAndConditions() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms & Conditions"
      lastUpdated={LAST_UPDATED}
      intro="These Terms & Conditions explain the rules for using HireX, including your responsibilities as a job seeker or recruiter and how our AI-assisted hiring tools may be used."
      sections={sections}
      relatedLink={{ to: '/privacy-policy', label: 'Privacy Policy' }}
    />
  );
}

export default TermsAndConditions;