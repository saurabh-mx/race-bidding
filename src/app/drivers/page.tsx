'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../landing.css';
import { useModal } from '@/components/ModalProvider';

type Driver = {
  id: string;
  name: string;
  logo_url: string;
  status: string;
  races: number;
  wins: number;
  win_rate: number;
  avg_pos: number;
  team_name?: string;
  team_logo?: string;
  racer_role?: string;
  type?: string;
};

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const { showError } = useModal();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('C');
  const [newRole, setNewRole] = useState('RACER');
  const [newRaces, setNewRaces] = useState<number>(0);
  const [newWins, setNewWins] = useState<number>(0);
  const [newWinRate, setNewWinRate] = useState<number>(0);
  const [newAvgPos, setNewAvgPos] = useState<number>(0);
  const [newAcquisition, setNewAcquisition] = useState<number>(0);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile) setRole(profile.role);
      }
    };
    fetchRole();

    const fetchDrivers = async () => {
      const { data: driversData } = await supabase
        .from('racers')
        .select('*')
        .neq('type', 'TEAM')
        .neq('type', 'MONTHLY_TEAM')
        .neq('type', 'MONTHLY_RACER')
        .order('name');
        
      const { data: teamsData } = await supabase
        .from('racers')
        .select('*')
        .eq('type', 'TEAM');

      if (driversData) {
        const enrichedDrivers = driversData.map(driver => {
          let team_name = driver.team_name || '';
          let team_logo = '';
          if (teamsData) {
            // First check if a team perfectly matches the explicit team_name
            let myTeam = teamsData.find(t => t.name === driver.team_name);
            
            // Fallback to checking rosters if no explicit team_name or it didn't match
            if (!myTeam) {
              myTeam = teamsData.find(t => 
                t.captain_name === driver.name || 
                (t.roster && t.roster.includes(driver.name))
              );
            }
            
            if (myTeam) {
              team_name = myTeam.name;
              team_logo = myTeam.logo_url;
            }
          }
          return {
            ...driver,
            team_name,
            team_logo
          };
        });
        setDrivers(enrichedDrivers);
      }
      setIsLoading(false);
    };
    fetchDrivers();
  }, []);

  const handleAddRacer = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('racers').insert([{
      name: newName,
      type: newType,
      racer_role: newRole,
      races: newRaces,
      wins: newWins,
      win_rate: newWinRate,
      avg_pos: newAvgPos,
      acquisition: newAcquisition,
      current_bid: 0,
      status: 'ACTIVE'
    }]);
    
    if (error) {
      showError('Error', 'Error adding racer: ' + error.message);
    } else {
      setIsAddModalOpen(false);
      window.location.reload();
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
          LOADING DRIVERS...
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
          <Link href="/teams">TEAMS</Link>
          <Link href="/drivers" style={{ color: '#fff' }}>DRIVERS</Link>
          <Link href="#">RULES</Link>
          <Link href="/login">LIVE BET</Link>
        </div>
      </nav>

      <div className="container animate-in stagger-1" style={{ marginTop: '4rem', paddingBottom: '4rem', maxWidth: '1400px', width: '100%' }}>
        {role === 'admin' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
            <button 
              className="btn-primary" 
              onClick={() => setIsAddModalOpen(true)}
              style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 700 }}
            >
              + ADD RACER
            </button>
          </div>
        )}

        {[
          { title: 'CAPTAINS', list: drivers.filter(d => d.racer_role === 'CAPTAIN') },
          { title: 'RACERS', list: drivers.filter(d => d.racer_role !== 'CAPTAIN') }
        ].map(group => group.list.length > 0 && (
          <div key={group.title} style={{ marginBottom: '6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <h1 className="title-gradient" style={{ fontSize: '2.5rem', fontStyle: 'italic', textTransform: 'uppercase' }}>{group.title}</h1>
              <div className="text-mono" style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', fontSize: '0.75rem', borderRadius: '20px' }}>
                {group.list.length} DRIVERS
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {group.list.map((driver, idx) => (
            <div 
              key={driver.id} 
              className={`animate-in stagger-${(idx % 4) + 1}`} 
              onClick={() => router.push(`/racer/${driver.id}`)}
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
                minHeight: '480px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(242, 24, 24, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '350px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {driver.logo_url ? (
                  <img src={driver.logo_url} alt={driver.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                ) : (
                  <span className="text-mono" style={{ color: 'rgba(255,255,255,0.1)' }}>NO IMAGE</span>
                )}
                
                {/* Gradient overlay at bottom of image */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to top, rgba(10,10,10,1), transparent)' }}></div>
                
                {/* SOLD badge */}
                {driver.status === 'SOLD' && (
                  <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', padding: '4px 12px', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
                    <span className="text-mono" style={{ fontSize: '0.65rem', color: '#fff', fontWeight: 'bold' }}>SOLD</span>
                  </div>
                )}
              </div>

              {/* Spacer to push the inner card down */}
              <div style={{ height: '220px' }}></div>

              {/* Inner Black Card */}
              <div style={{ background: '#070707', borderRadius: '16px 16px 0 0', padding: '1.5rem', zIndex: 2, position: 'relative', flex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-mono" style={{ color: driver.racer_role === 'CAPTAIN' ? '#ffb300' : 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '2px', textTransform: 'uppercase' }}>{driver.racer_role || 'RACER'}</span>
                <h3 style={{ fontSize: '2rem', fontStyle: 'italic', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem', lineHeight: 1 }}>{driver.name}</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', minHeight: '35px' }}>
                  {driver.team_logo ? (
                    <img src={driver.team_logo} style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  ) : driver.team_name ? (
                    <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
                  ) : null}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{driver.team_name || 'FREE AGENT'}</span>
                    <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}>
                      {driver.type === 'INDIVIDUAL' ? '' : `CLASS ${driver.type} `}{driver.racer_role || 'RACER'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.55rem', marginBottom: '0.75rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>OVERALL TELEMETRY</span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    {/* Top Left: RACES */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.75rem 0.75rem 0', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>RACES</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{driver.races || 0}</span>
                    </div>
                    {/* Top Right: WINS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0 0.75rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>WINS</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{driver.wins || 0}</span>
                    </div>
                    {/* Bottom Left: WIN RATE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.75rem 0 0', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>WIN RATE</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{driver.win_rate || 0}%</span>
                    </div>
                    {/* Bottom Right: AVG POS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0 0 0.75rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>AVG POS</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{driver.avg_pos || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Racer Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', width: '90%', maxWidth: '500px', border: '1px solid var(--accent-primary)' }}>
            <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '2rem', textTransform: 'uppercase' }}>ADD NEW RACER</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>DRIVER NAME</label>
                <input 
                  type="text" 
                  className="input-base" 
                  style={{ width: '100%' }}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter racer name"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>CLASS</label>
                  <select className="input-base" style={{ width: '100%' }} value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="S">CLASS S</option>
                    <option value="X">CLASS X</option>
                    <option value="A">CLASS A</option>
                    <option value="B">CLASS B</option>
                    <option value="C">CLASS C</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>ROLE</label>
                  <select className="input-base" style={{ width: '100%' }} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                    <option value="CAPTAIN">CAPTAIN</option>
                    <option value="RACER">RACER</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>RACES</label>
                  <input type="number" className="input-base" style={{ width: '100%' }} value={newRaces} onChange={(e) => setNewRaces(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>WINS</label>
                  <input type="number" className="input-base" style={{ width: '100%' }} value={newWins} onChange={(e) => setNewWins(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>WIN RATE (%)</label>
                  <input type="number" step="0.1" className="input-base" style={{ width: '100%' }} value={newWinRate} onChange={(e) => setNewWinRate(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>AVG POS</label>
                  <input type="number" step="0.1" className="input-base" style={{ width: '100%' }} value={newAvgPos} onChange={(e) => setNewAvgPos(Number(e.target.value))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>ACQUISITION COST ($)</label>
                  <input type="number" className="input-base" style={{ width: '100%' }} value={newAcquisition} onChange={(e) => setNewAcquisition(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>CANCEL</button>
              <button className="btn-primary" onClick={handleAddRacer}>+ ADD DRIVER</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
