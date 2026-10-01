'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    
    const cleanId = loginId.toLowerCase().trim();
    const pseudoEmail = cleanId.includes('@') ? cleanId : `${cleanId}@racebid.com`;

    try {
      if (isSignUp) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: pseudoEmail,
          password: password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert([
            { id: authData.user.id, login_id: loginId, role: 'VIEWER' }
          ]);
          
          if (profileError) {
             console.error('Profile creation failed', profileError);
             throw new Error(profileError.message || 'Failed to create user profile in the database.');
          }
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: pseudoEmail,
          password: password,
        });

        if (authError) throw authError;
      }
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 className="title-gradient" style={{ fontSize: '1.8rem', color: '#f21818' }}>RACEBID.</h1>
        </Link>
      </header>
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel animate-in" style={{ padding: '3.5rem', width: '100%', maxWidth: '480px' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: '#fff' }}>
              {isSignUp ? 'INITIATE' : 'IDENTIFY'}
            </h2>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', letterSpacing: '3px' }}>
              SECURE TERMINAL // {isSignUp ? 'CREATE ACCOUNT' : 'LOGIN PROTOCOL'}
            </p>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(242,24,24,0.1)', color: 'var(--accent-secondary)', padding: '1rem', borderLeft: '3px solid var(--accent-primary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              [ERROR] {errorMsg}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="loginId" className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                &gt; PILOT_ID
              </label>
              <input 
                id="loginId"
                type="text" 
                className="input-base" 
                placeholder="e.g. RACER-8842" 
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="password" className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                &gt; PASSKEY
              </label>
              <input 
                id="password"
                type="password" 
                className="input-base" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>



            <button 
              type="submit" 
              className="btn-primary" 
              style={{ marginTop: '1.5rem', padding: '1rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'PROCESSING...' : (isSignUp ? 'AUTHORIZE_NEW' : 'ENGAGE')}</span>
              <span className="text-mono" style={{ fontSize: '1.2rem' }}>&gt;&gt;</span>
            </button>
          </form>

          <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>STATUS: {isSignUp ? 'AWAITING REGISTRATION' : 'AWAITING INPUT'}</span>
              <button 
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg(null);
                }}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textDecoration: 'underline' }}
                className="text-mono"
              >
                {isSignUp ? '[ SWITCH TO LOGIN ]' : '[ SWITCH TO SIGN UP ]'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
