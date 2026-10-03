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



  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      router.push('/dashboard');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
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
              MANAGEMENT
            </h2>
            <p className="text-mono" style={{ color: '#f21818', fontSize: '0.65rem', letterSpacing: '4px', fontWeight: 700 }}>
              SECURE TERMINAL // ADMIN LOGIN
            </p>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(242,24,24,0.1)', color: 'var(--accent-secondary)', padding: '1rem', borderLeft: '3px solid var(--accent-primary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              [ERROR] {errorMsg}
            </div>
          )}

          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>EMAIL</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  padding: '1rem', 
                  color: '#fff',
                  fontFamily: 'monospace'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>PASSWORD</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  padding: '1rem', 
                  color: '#fff',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <button 
              type="submit" 
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
                fontSize: '0.9rem',
                marginTop: '1rem'
              }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'PROCESSING...' : 'AUTHORIZE ACCESS'}</span>
            </button>
          </form>

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
