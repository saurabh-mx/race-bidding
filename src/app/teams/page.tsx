'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../landing.css';

type Team = {
  id: string;
  name: string;
  logo_url: string;
  captain_name: string;
  captain_image_url: string;
  status: string;
  races: number;
  wins: number;
  win_rate: number;
  avg_pos: number;
};

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase
        .from('racers')
        .select('*')
        .eq('type', 'TEAM')
        .order('name');
      if (data) setTeams(data);
      setIsLoading(false);
    };
    fetchTeams();
  }, []);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
          LOADING FRANCHISES...
        </p>
      </div>
    );
  }

  return (
    <main className="soulgrid-main" style={{ overflowY: 'auto' }}>
      <nav className="soulgrid-nav" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
            <div className="logo-container">
              <span className="logo-text">RACE<span className="logo-highlight">BET</span></span>
              <span className="logo-subtext">BET FOR THE GRID</span>
            </div>
          </div>
        </Link>
        <div className="nav-links">
          <Link href="/teams" style={{ color: '#fff' }}>TEAMS</Link>
          <Link href="/drivers">RACERS</Link>
          <Link href="#">RULES</Link>
          <Link href="/login">LIVE BET</Link>
        </div>
      </nav>

      <div className="container animate-in stagger-1" style={{ marginTop: '2rem', paddingBottom: '6rem', maxWidth: '96%', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem', borderBottom: '1px solid var(--accent-primary)', paddingBottom: '1.5rem' }}>
          <div>
            <h1 className="title-gradient" style={{ fontSize: '3.5rem', fontStyle: 'italic', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>FRANCHISES</h1>
            <p className="text-mono" style={{ color: 'var(--text-muted)', marginTop: '0.5rem', letterSpacing: '2px' }}>OFFICIAL RACEBET TEAMS</p>
          </div>
          <div className="text-mono" style={{ border: '1px solid var(--accent-primary)', background: 'rgba(242,24,24,0.1)', padding: '0.75rem 1.5rem', fontSize: '0.85rem', borderRadius: '4px', color: 'var(--accent-primary)' }}>
            {teams.length} ACTIVE
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '3rem' }}>
          {teams.map((team, idx) => (
            <div 
              key={team.id} 
              className={`animate-in stagger-${(idx % 4) + 1}`} 
              onClick={() => router.push(`/racer/${team.id}`)}
              style={{ 
                background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                display: 'flex', 
                flexDirection: 'column', 
                cursor: 'pointer', 
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                position: 'relative',
                minHeight: '520px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(242, 24, 24, 0.3), inset 0 0 20px rgba(242, 24, 24, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '380px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {team.captain_image_url || team.logo_url ? (
                  <img src={team.captain_image_url || team.logo_url} alt={team.name} style={{ width: '100%', height: '100%', objectFit: team.captain_image_url ? 'cover' : 'contain', objectPosition: 'top' }} />
                ) : (
                  <span className="text-mono" style={{ color: 'rgba(255,255,255,0.1)' }}>NO IMAGE</span>
                )}
                
                {/* Gradient overlay at bottom of image */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', background: 'linear-gradient(to top, rgba(10,10,10,1), transparent)' }}></div>
                
                {/* SOLD badge */}
                {team.status === 'SOLD' && (
                  <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 16px', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
                    <span className="text-mono" style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }}>SOLD</span>
                  </div>
                )}
              </div>

              {/* Spacer to push the inner card down */}
              <div style={{ height: '260px' }}></div>

              {/* Inner Black Card */}
              <div style={{ background: '#070707', borderRadius: '16px 16px 0 0', padding: '2rem', zIndex: 2, position: 'relative', flex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-mono" style={{ color: 'var(--accent-secondary)', fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase' }}>TEAM ENTITY</span>
                <h3 style={{ fontSize: '2.5rem', fontStyle: 'italic', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', lineHeight: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{team.name}</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', minHeight: '35px' }}>
                  {team.logo_url ? (
                    <img src={team.logo_url} style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  ) : (
                    <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-mono" style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>CAPTAIN: {team.captain_name || 'UNKNOWN'}</span>
                    <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}>OFFICIAL ROSTER</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.55rem', marginBottom: '0.75rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>OVERALL TELEMETRY</span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    {/* Top Left: RACES */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.75rem 0.75rem 0', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>RACES</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{team.races || 0}</span>
                    </div>
                    {/* Top Right: WINS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0 0.75rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>WINS</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{team.wins || 0}</span>
                    </div>
                    {/* Bottom Left: WIN RATE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.75rem 0 0', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>WIN RATE</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{team.win_rate || 0}%</span>
                    </div>
                    {/* Bottom Right: AVG POS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0 0 0.75rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>AVG POS</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{team.avg_pos || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
