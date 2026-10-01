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
        const { error: authError } = await supabase.auth.signUp({
          email: pseudoEmail,
          password: password,
          options: {
            data: {
              login_id: loginId
            }
          }
        });

        if (authError) throw authError;
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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication failed.');
      setIsLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Bidding" style={{ height: '60px', width: 'auto', borderRadius: '50%' }} />
            <h1 className="title-gradient" style={{ fontSize: '1.8rem', color: '#f21818' }}>RACEBID.</h1>
          </div>
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
              style={{ marginTop: '0.5rem', padding: '1rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'PROCESSING...' : (isSignUp ? 'AUTHORIZE_NEW' : 'ENGAGE')}</span>
              <span className="text-mono" style={{ fontSize: '1.2rem' }}>&gt;&gt;</span>
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            </div>
            
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ padding: '1rem', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', background: '#fff', color: '#000', border: 'none' }}
              disabled={isLoading}
              onClick={handleGoogleLogin}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span style={{ fontWeight: 'bold' }}>SIGN IN WITH GOOGLE</span>
            </button>
          </form>

          <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
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
