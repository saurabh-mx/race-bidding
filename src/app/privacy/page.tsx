'use client';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
      <header className="glass-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <img src="/logo.png" alt="Race Bidding" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
             <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBID.</h1>
           </div>
        </Link>
      </header>

      <div className="container" style={{ marginTop: '2rem', flex: 1 }}>
        <div className="glass-panel animate-in" style={{ padding: '3rem', maxWidth: '800px', margin: '0 auto' }}>
          <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>PRIVACY POLICY</h1>
          
          <div className="text-mono" style={{ color: 'var(--text-muted)', lineHeight: '1.8', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <p><strong>Last Updated:</strong> October 2026</p>
            
            <section>
              <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>1. INTRODUCTION</h2>
              <p>Welcome to RaceBidding. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website.</p>
            </section>
            
            <section>
              <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>2. DATA WE COLLECT</h2>
              <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
              <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li><strong>Identity Data:</strong> includes your name and Google profile information if you use Google OAuth.</li>
                <li><strong>Contact Data:</strong> includes your email address.</li>
                <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, and browser type.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>3. HOW WE USE YOUR DATA</h2>
              <p>We will only use your personal data for the following purposes:</p>
              <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>To register you as a new user.</li>
                <li>To manage your account and authentication securely.</li>
                <li>To enable you to participate in the RaceBidding platform.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>4. DATA SECURITY</h2>
              <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. Authentication is securely managed via Supabase.</p>
            </section>

            <p style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', fontSize: '0.75rem' }}>
              For any privacy-related inquiries, please contact the developer via the email provided in the Google OAuth consent screen.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
