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
  const [searchQuery, setSearchQuery] = useState('');
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
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [teams, setTeams] = useState<any[]>([]);

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
      // Monthly team excluded
        .neq('type', 'MONTHLY_RACER')
        .order('name');
        
      const { data: teamsData } = await supabase
        .from('racers')
        .select('*')
        .eq('type', 'TEAM');
      
      if (teamsData) setTeams(teamsData);

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
            logo_url: driver.logo_url || (driver.name?.toUpperCase() === 'EL-DRAGO' ? '/soulgrid/EL-DRAGO.webp' : ''),
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
      logo_url: newLogoUrl,
      team_name: newTeamName || null,
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
          LOADING RACERS...
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
          <Link href="/drivers" style={{ color: '#fff' }}>RACERS</Link>
          <Link href="#">RULES</Link>
          <Link href="/login">LIVE BET</Link>
        </div>
      </nav>

      <div className="container animate-in stagger-1" style={{ marginTop: '2rem', paddingBottom: '6rem', maxWidth: '96%', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="SEARCH RACERS OR TEAMS..." 
            className="input-base text-mono" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: '400px', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
          />
          {role === 'admin' && (
            <button 
              className="btn-primary" 
              onClick={() => setIsAddModalOpen(true)}
              style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 700 }}
            >
              + ADD RACER
            </button>
          )}
        </div>

        {(() => {
          const filteredDrivers = drivers.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()) || (d.team_name && d.team_name.toLowerCase().includes(searchQuery.toLowerCase())));
          return [
            { title: 'CAPTAINS', list: filteredDrivers.filter(d => d.racer_role === 'CAPTAIN' || d.type === 'CAPTAIN' || d.type === 'INDIVIDUAL') },
            { title: 'S RACERS', list: filteredDrivers.filter(d => d.racer_role !== 'CAPTAIN' && d.type !== 'CAPTAIN' && d.type !== 'INDIVIDUAL' && d.type === 'S') },
            { title: 'X RACERS', list: filteredDrivers.filter(d => d.racer_role !== 'CAPTAIN' && d.type !== 'CAPTAIN' && d.type !== 'INDIVIDUAL' && d.type === 'X') },
            { title: 'A RACERS', list: filteredDrivers.filter(d => d.racer_role !== 'CAPTAIN' && d.type !== 'CAPTAIN' && d.type !== 'INDIVIDUAL' && d.type === 'A') },
            { title: 'B RACERS', list: filteredDrivers.filter(d => d.racer_role !== 'CAPTAIN' && d.type !== 'CAPTAIN' && d.type !== 'INDIVIDUAL' && d.type === 'B') },
            { title: 'C RACERS', list: filteredDrivers.filter(d => d.racer_role !== 'CAPTAIN' && d.type !== 'CAPTAIN' && d.type !== 'INDIVIDUAL' && d.type === 'C') },
            { title: 'OTHER RACERS', list: filteredDrivers.filter(d => d.racer_role !== 'CAPTAIN' && d.type !== 'CAPTAIN' && d.type !== 'INDIVIDUAL' && !['S','X','A','B','C'].includes(d.type || '')) }
          ].map(group => group.list.length > 0 && (
          <div key={group.title} style={{ marginBottom: '6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem', borderBottom: '1px solid var(--accent-primary)', paddingBottom: '1.5rem' }}>
              <div>
                <h1 className="title-gradient" style={{ fontSize: '3.5rem', fontStyle: 'italic', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>{group.title}</h1>
                <p className="text-mono" style={{ color: 'var(--text-muted)', marginTop: '0.5rem', letterSpacing: '2px' }}>OFFICIAL ROSTER</p>
              </div>
              <div className="text-mono" style={{ border: '1px solid var(--accent-primary)', background: 'rgba(242,24,24,0.1)', padding: '0.75rem 1.5rem', fontSize: '0.85rem', borderRadius: '4px', color: 'var(--accent-primary)' }}>
                {group.list.length} ACTIVE
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '3rem' }}>
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
                {driver.logo_url ? (
                  <img src={driver.logo_url} alt={driver.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                ) : (
                  <span className="text-mono" style={{ color: 'rgba(255,255,255,0.1)' }}>NO IMAGE</span>
                )}
                
                {/* Gradient overlay at bottom of image */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', background: 'linear-gradient(to top, rgba(10,10,10,1), transparent)' }}></div>
                
                {/* SOLD badge */}
                {driver.status === 'SOLD' && (
                  <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 16px', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
                    <span className="text-mono" style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }}>SOLD</span>
                  </div>
                )}
              </div>

              {/* Spacer to push the inner card down */}
              <div style={{ height: '260px' }}></div>

              {/* Inner Black Card */}
              <div style={{ background: '#070707', borderRadius: '16px 16px 0 0', padding: '2rem', zIndex: 2, position: 'relative', flex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-mono" style={{ color: driver.racer_role === 'CAPTAIN' || driver.type === 'CAPTAIN' ? '#ffb300' : 'var(--accent-secondary)', fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase' }}>{driver.type === 'CAPTAIN' ? 'CAPTAIN' : (driver.racer_role || 'RACER')}</span>
                <h3 style={{ fontSize: '2.5rem', fontStyle: 'italic', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', lineHeight: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{driver.name}</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', minHeight: '35px' }}>
                  {driver.team_logo ? (
                    <img src={driver.team_logo} style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  ) : driver.team_name ? (
                    <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
                  ) : null}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{driver.team_name || 'FREE AGENT'}</span>
                    <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}>
                      {driver.type === 'CAPTAIN' ? 'CAPTAIN' : (driver.type === 'INDIVIDUAL' ? '' : `${driver.type} `)}{driver.type !== 'CAPTAIN' ? (driver.racer_role || 'RACER') : ''}
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
        ))})()}
      </div>

      {/* Add Racer Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '2rem' }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--accent-primary)' }}>
            <h2 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>SYSTEM CONFIG // NEW ENTITY</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); handleAddRacer(); }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '3rem', marginBottom: '3rem' }}>
                
                {/* Column 1: Primary Entity Data */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 className="text-mono" style={{ color: 'var(--accent-primary)' }}>[ PRIMARY DATA ]</h3>
                  
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>ENTITY_NAME</label>
                    <input type="text" className="input-base" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Enter racer name" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>RACER CLASS</label>
                    <select className="input-base" value={newType} onChange={e => setNewType(e.target.value)} style={{ appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', width: '100%' }}>
                      <option value="CAPTAIN">CLASS CAPTAIN</option>
                      <option value="S">CLASS S</option>
                      <option value="X">CLASS X</option>
                      <option value="A">CLASS A</option>
                      <option value="B">CLASS B</option>
                      <option value="C">CLASS C</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>LOGO_URL (OPTIONAL)</label>
                    <input type="text" className="input-base" value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} placeholder="https://..." style={{ width: '100%' }} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                    <div>
                      <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>RACER ROLE</label>
                      <select className="input-base" value={newRole} onChange={e => setNewRole(e.target.value)} style={{ appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', width: '100%' }}>
                        <option value="RACER">RACER</option>
                        <option value="CAPTAIN">CAPTAIN</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>TEAM ASSIGNMENT</label>
                      <select className="input-base" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} style={{ appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', width: '100%' }}>
                        <option value="">-- FREE AGENT --</option>
                        {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Column 2: Telemetry Configuration */}
                <div style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', alignSelf: 'start' }}>
                  <h4 className="text-mono" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>[ TELEMETRY CONFIG ]</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>RACES COMPLETED</label>
                      <input type="number" className="input-base" value={newRaces} onChange={e => setNewRaces(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>TOTAL WINS</label>
                      <input type="number" className="input-base" value={newWins} onChange={e => setNewWins(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>WIN RATE (%)</label>
                      <input type="number" step="0.1" className="input-base" value={newWinRate} onChange={e => setNewWinRate(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>AVERAGE POSITION</label>
                      <input type="number" step="0.1" className="input-base" value={newAvgPos} onChange={e => setNewAvgPos(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>ACQUISITION COST ($)</label>
                      <input type="number" className="input-base" value={newAcquisition} onChange={e => setNewAcquisition(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>

              </div>
              
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1rem' }}>COMMIT SYSTEM CHANGES</button>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)} style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>ABORT</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
