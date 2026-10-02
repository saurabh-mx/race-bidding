'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkSession();
  }, [router]);



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
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google authentication failed.');
      setIsLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '60px', width: 'auto', borderRadius: '50%' }} />
            <h1 className="title-gradient" style={{ fontSize: '1.8rem', color: '#f21818' }}>RACEBET.</h1>
          </div>
        </Link>
      </header>
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="animate-in" style={{ 
          background: '#0a0a0a', 
          borderLeft: '3px solid #f21818',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '4rem 3rem', 
          width: '100%', 
          maxWidth: '440px',
          position: 'relative'
        }}>
          {/* Top right cut corner decorative element */}
          <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '20px', height: '20px', background: 'rgba(255,255,255,0.2)', clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>

          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '3rem', fontStyle: 'italic', fontWeight: 900, marginBottom: '0.5rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '-1px' }}>
              IDENTIFY
            </h2>
            <p className="text-mono" style={{ color: '#f21818', fontSize: '0.65rem', letterSpacing: '4px', fontWeight: 700 }}>
              SECURE TERMINAL // LOGIN PROTOCOL
            </p>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(242,24,24,0.1)', color: 'var(--accent-secondary)', padding: '1rem', borderLeft: '3px solid var(--accent-primary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              [ERROR] {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <button 
              type="button" 
              style={{ 
                padding: '1.25rem', 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '1rem', 
                background: '#fff', 
                color: '#000', 
                border: 'none',
                cursor: 'pointer',
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: '0.9rem'
              }}
              disabled={isLoading}
              onClick={handleGoogleLogin}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{isLoading ? 'PROCESSING...' : 'SIGN IN WITH GOOGLE'}</span>
            </button>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
            <p className="text-mono" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: '1px' }}>
              STATUS: AWAITING INPUT
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
