'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useModal } from '@/components/ModalProvider';

type Driver = {
  id: string;
  name: string;
  type?: string;
  racer_role?: string;
  logo_url?: string;
  team_name?: string;
  races?: number;
  wins?: number;
  win_rate?: number;
  avg_pos?: number;
  acquisition?: number;
};

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
  current_bid: number;
  acquisition: number;
  roster: string[];
  // Derived fields
  drivers?: Driver[];
  derivedCaptainImage?: string;
  totalWins?: number;
  totalRaces?: number;
  derivedWinRate?: number;
  derivedAvgPos?: number;
  totalAcquisition?: number;
  budgetLeft?: number;
};

export default function TeamsPage() {
  const router = useRouter();
  const { showError, showConfirm } = useModal();
  const [teams, setTeams] = useState<Team[]>([]);
  const [individuals, setIndividuals] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'valuation' | 'wins' | 'win_rate' | 'name'>('valuation');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SOLD'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [loginId, setLoginId] = useState<string>('');
  
  // Add Team Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogoUrl, setNewTeamLogoUrl] = useState('');
  const [newCaptainName, setNewCaptainName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Auth & Profile
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, display_name, login_id')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile) {
          setRole(profile.role);
          setDisplayName(profile.display_name || '');
          setLoginId(profile.login_id || '');
        }
      }

      // 2. Fetch all individual drivers for dynamic team rosters and stats
      const { data: indData } = await supabase
        .from('racers')
        .select('*')
        .neq('type', 'TEAM')
        .order('name');
      const allIndividuals: Driver[] = indData || [];
      setIndividuals(allIndividuals);

      // 3. Fetch all teams
      const { data: teamsData } = await supabase
        .from('racers')
        .select('*')
        .eq('type', 'TEAM')
        .order('name');

      if (teamsData) {
        const enrichedTeams: Team[] = teamsData.map(team => {
          // Find drivers associated with this team
          const teamDrivers = allIndividuals.filter(d => 
            d.team_name === team.name || 
            d.name === team.captain_name || 
            (team.roster && Array.isArray(team.roster) && team.roster.includes(d.name))
          );
          
          // De-duplicate drivers
          const uniqueDrivers = Array.from(new Map(teamDrivers.map(d => [d.id, d])).values());

          // Find captain object
          const captainObj = team.captain_name ? allIndividuals.find(d => d.name === team.captain_name) : null;
          const derivedCaptainImage = team.captain_image_url || captainObj?.logo_url || '';

          // Calculate dynamic telemetry
          let totalWins = (team.wins || 0);
          let totalRaces = (team.races || 0);
          
          if (uniqueDrivers.length > 0) {
            totalWins = uniqueDrivers.reduce((sum, d) => sum + (d.wins || 0), 0) + (team.wins || 0);
            totalRaces = uniqueDrivers.reduce((sum, d) => sum + (d.races || 0), 0) + (team.races || 0);
          }
          
          const derivedWinRate = totalRaces > 0 ? Math.round((totalWins / totalRaces) * 100) : (team.win_rate || 0);
          
          let derivedAvgPos = team.avg_pos || 0;
          const driversWithPos = uniqueDrivers.filter(d => (d.avg_pos || 0) > 0);
          if (driversWithPos.length > 0) {
            const sumPos = driversWithPos.reduce((sum, d) => sum + (d.avg_pos || 0), 0);
            derivedAvgPos = Math.round(sumPos / driversWithPos.length);
          }

          // Calculate budget spent from $1,500,000 cap
          let totalAcq = 0;
          if (captainObj && captainObj.acquisition) totalAcq += captainObj.acquisition;
          
          // Roster members acquisition
          uniqueDrivers.forEach(d => {
            if (d.name !== team.captain_name && d.acquisition) {
              totalAcq += d.acquisition;
            }
          });
          const budgetLeft = 1500000 - totalAcq;

          return {
            ...team,
            drivers: uniqueDrivers,
            derivedCaptainImage,
            totalWins,
            totalRaces,
            derivedWinRate,
            derivedAvgPos,
            totalAcquisition: totalAcq,
            budgetLeft,
          };
        });

        setTeams(enrichedTeams);
      }

      setIsLoading(false);
    };

    fetchData();
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      showError('Validation Error', 'Team name is required.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('racers').insert([{
      name: newTeamName.trim(),
      type: 'TEAM',
      logo_url: newTeamLogoUrl.trim(),
      captain_name: newCaptainName || null,
      status: 'ACTIVE',
      current_bid: 0,
      races: 0,
      wins: 0,
      win_rate: 0,
      avg_pos: 0,
      roster: ['', '', '', '', '']
    }]);

    setIsSubmitting(false);

    if (error) {
      showError('Failed to create team', error.message);
    } else {
      showConfirm('Team Created', `Franchise "${newTeamName}" created successfully!`, () => {
        setIsAddModalOpen(false);
        window.location.reload();
      });
    }
  };

  // Filtered & Sorted Teams
  const processedTeams = useMemo(() => {
    return teams
      .filter(t => {
        const matchesSearch = 
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.captain_name && t.captain_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (t.drivers && t.drivers.some(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())));
        
        const matchesStatus = 
          statusFilter === 'ALL' ? true : t.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'valuation') return (b.current_bid || 0) - (a.current_bid || 0);
        if (sortBy === 'wins') return (b.totalWins || 0) - (a.totalWins || 0);
        if (sortBy === 'win_rate') return (b.derivedWinRate || 0) - (a.derivedWinRate || 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [teams, searchQuery, sortBy, statusFilter]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
          DECRYPTING TEAM FRANCHISES...
        </p>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', paddingBottom: '6rem' }}>
      {/* Top Header */}
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
            <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBET.</h1>
          </div>
        </Link>

        <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
          <Link 
            href="/teams" 
            className="text-mono" 
            style={{ 
              color: 'var(--accent-primary)', 
              textDecoration: 'none', 
              fontSize: '0.85rem', 
              letterSpacing: '1px',
              fontWeight: 700,
              borderBottom: '2px solid var(--accent-primary)',
              paddingBottom: '4px'
            }}
          >
            TEAMS
          </Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>
            RACERS
          </Link>
          <Link href="/rules" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>
            RULES
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {loginId ? (
            <div 
              className="text-mono hover-glow" 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '4px' }}
              onClick={() => router.push('/profile')}
              title="Go to Profile"
            >
              <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{(displayName || loginId).toUpperCase()}</span>
              <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : (role === 'agent' || role === 'management') ? 'var(--accent-secondary)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                OP: {role || 'UNKNOWN'}
              </span>
            </div>
          ) : (
            <Link href="/login" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', textDecoration: 'none' }}>
              LOGIN
            </Link>
          )}

          <button className="btn-secondary" onClick={() => router.push('/dashboard')} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
            &lt; DASHBOARD
          </button>
        </div>
      </header>

      <div className="container animate-in stagger-1" style={{ marginTop: '2.5rem', maxWidth: '96%', width: '100%' }}>
        
        {/* Hero Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', borderBottom: '1px solid rgba(242, 24, 24, 0.3)', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--accent-primary)', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px var(--accent-primary)' }}></span>
              <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', letterSpacing: '3px' }}>OFFICIAL CONSTRUCTORS</span>
            </div>
            <h1 className="title-gradient" style={{ fontSize: '3.8rem', fontStyle: 'italic', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
              FRANCHISES
            </h1>
            <p className="text-mono" style={{ color: 'var(--text-muted)', marginTop: '0.5rem', letterSpacing: '1px', fontSize: '0.85rem' }}>
              TEAM ROSTERS, FINANCIAL VALUATIONS, AND HISTORIC CONSTRUCTOR TELEMETRY
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 1.25rem', textAlign: 'center' }}>
              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block', letterSpacing: '1px' }}>FRANCHISES</span>
              <span className="text-mono" style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 900 }}>{teams.length}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 1.25rem', textAlign: 'center' }}>
              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block', letterSpacing: '1px' }}>BUDGET CAP</span>
              <span className="text-mono" style={{ color: '#00ff88', fontSize: '1.4rem', fontWeight: 900 }}>$1.5M</span>
            </div>
            {role === 'admin' && (
              <button 
                className="btn-primary" 
                onClick={() => setIsAddModalOpen(true)}
                style={{ padding: '0.85rem 1.75rem', fontSize: '0.85rem', fontWeight: 700 }}
              >
                + CREATE TEAM
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '1.5rem', flexWrap: 'wrap', background: 'rgba(15,15,15,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '280px', maxWidth: '450px' }}>
            <input 
              type="text" 
              placeholder="SEARCH TEAMS, CAPTAINS, OR DRIVERS..." 
              className="input-base text-mono" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem 1rem 0.75rem 2.5rem', 
                background: 'rgba(0,0,0,0.6)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                color: '#fff', 
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          </div>

          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {(['ALL', 'ACTIVE', 'SOLD'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className="text-mono"
                style={{
                  background: statusFilter === status ? 'var(--accent-primary)' : 'transparent',
                  color: statusFilter === status ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>SORT BY:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="input-base text-mono"
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <option value="valuation">VALUATION ($ HIGH-LOW)</option>
              <option value="wins">MOST WINS</option>
              <option value="win_rate">WIN RATE (%)</option>
              <option value="name">TEAM NAME (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Team Franchises Grid */}
        {processedTeams.length === 0 ? (
          <div className="glass-panel" style={{ padding: '5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '1.2rem', letterSpacing: '2px' }}>
              NO FRANCHISES MATCHING CRITERIA
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2.5rem' }}>
            {processedTeams.map((team, idx) => {
              const driverCount = (team.drivers || []).length;
              const hasBudget = (team.budgetLeft || 0) >= 0;

              return (
                <div 
                  key={team.id} 
                  className={`animate-in stagger-${(idx % 4) + 1}`} 
                  onClick={() => router.push(`/racer/${team.id}`)}
                  style={{ 
                    background: '#090909',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    display: 'flex', 
                    flexDirection: 'column', 
                    cursor: 'pointer', 
                    overflow: 'hidden',
                    transition: 'all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    position: 'relative',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(242, 24, 24, 0.25), inset 0 0 20px rgba(242, 24, 24, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                  }}
                >
                  {/* Top Banner with Team Emblem / Background */}
                  <div style={{ 
                    position: 'relative', 
                    height: '200px', 
                    background: 'linear-gradient(135deg, rgba(20,5,5,0.9) 0%, rgba(5,5,5,1) 100%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '2rem',
                    overflow: 'hidden',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {/* Watermark Logo Background */}
                    {team.logo_url && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)', 
                        width: '180%', 
                        height: '180%', 
                        opacity: 0.08, 
                        backgroundImage: `url(${team.logo_url})`,
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                        filter: 'blur(10px)',
                        pointerEvents: 'none'
                      }}></div>
                    )}

                    {/* Left Top Badges */}
                    <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '0.5rem', zIndex: 2 }}>
                      <span className="text-mono" style={{ 
                        background: 'rgba(0,0,0,0.7)', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        color: 'var(--accent-primary)', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        padding: '4px 10px', 
                        borderRadius: '6px',
                        letterSpacing: '1px'
                      }}>
                        CONSTRUCTOR
                      </span>
                      {team.status === 'SOLD' && (
                        <span className="text-mono" style={{ 
                          background: 'rgba(242, 24, 24, 0.2)', 
                          border: '1px solid var(--accent-primary)', 
                          color: '#fff', 
                          fontSize: '0.7rem', 
                          fontWeight: 700, 
                          padding: '4px 10px', 
                          borderRadius: '6px' 
                        }}>
                          SOLD
                        </span>
                      )}
                    </div>

                    {/* Top Right Valuation Tag */}
                    <div style={{ position: 'absolute', top: '16px', right: '16px', textAlign: 'right', zIndex: 2 }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>VALUATION</span>
                      <span className="text-mono" style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 900 }}>
                        ${(team.current_bid || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Main Team Square Emblem Block */}
                    <div style={{ 
                      width: '120px', 
                      height: '120px', 
                      minWidth: '120px',
                      aspectRatio: '1 / 1', 
                      borderRadius: '16px', 
                      background: 'rgba(10,10,10,0.8)', 
                      border: '1px solid rgba(255, 255, 255, 0.15)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                      zIndex: 1
                    }}>
                      {team.logo_url ? (
                        <img 
                          src={team.logo_url} 
                          alt={team.name} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain', 
                            padding: '12px' 
                          }} 
                        />
                      ) : (
                        <span className="text-mono" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>NO LOGO</span>
                      )}
                      
                      {/* Fade Overlay (subtle vignette) */}
                      <div style={{ 
                        position: 'absolute', 
                        bottom: 0, 
                        left: 0, 
                        right: 0, 
                        height: '15%', 
                        background: 'linear-gradient(to top, rgba(10,10,10,0.4) 0%, transparent 100%)', 
                        pointerEvents: 'none' 
                      }}></div>
                    </div>
                  </div>

                  {/* Team Details Body */}
                  <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '1.25rem' }}>
                    
                    {/* Team Name */}
                    <div>
                      <h2 style={{ 
                        fontSize: '2rem', 
                        fontStyle: 'italic', 
                        fontWeight: 900, 
                        textTransform: 'uppercase', 
                        margin: 0, 
                        lineHeight: 1.1, 
                        color: '#fff',
                        letterSpacing: '-0.5px'
                      }}>
                        {team.name}
                      </h2>
                    </div>

                    {/* Captain Banner */}
                    <div style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.06)', 
                      borderRadius: '10px', 
                      padding: '0.75rem 1rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {team.derivedCaptainImage ? (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: '#111' }}>
                            <img src={team.derivedCaptainImage} alt={team.captain_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                            👤
                          </div>
                        )}
                        <div>
                          <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block', letterSpacing: '1px' }}>CAPTAIN</span>
                          <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase' }}>
                            {team.captain_name || 'UNASSIGNED'}
                          </span>
                        </div>
                      </div>

                      <span className="text-mono" style={{ 
                        background: 'rgba(242, 24, 24, 0.1)', 
                        border: '1px solid var(--accent-primary)', 
                        color: 'var(--accent-secondary)', 
                        fontSize: '0.65rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '4px' 
                      }}>
                        LEADER
                      </span>
                    </div>

                    {/* Team Roster Preview Chips */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '1px' }}>
                          ROSTER LINEUP ({driverCount} / 6)
                        </span>
                        <span className="text-mono" style={{ color: driverCount >= 6 ? '#00ff88' : '#ffaa00', fontSize: '0.65rem', fontWeight: 700 }}>
                          {driverCount >= 6 ? 'FULL GRID' : `${6 - driverCount} SLOTS OPEN`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {(team.drivers || []).length === 0 ? (
                          <span className="text-mono" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
                            NO DRIVERS SIGNED YET
                          </span>
                        ) : (
                          (team.drivers || []).map((driver) => (
                            <div 
                              key={driver.id} 
                              style={{ 
                                background: 'rgba(255,255,255,0.04)', 
                                border: '1px solid rgba(255,255,255,0.08)', 
                                padding: '4px 8px', 
                                borderRadius: '6px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.35rem' 
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                                {driver.name}
                              </span>
                              {driver.type && (
                                <span className="text-mono" style={{ fontSize: '0.6rem', color: '#ffaa00', fontWeight: 800 }}>
                                  [{driver.type}]
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Telemetry Bento Grid */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(4, 1fr)', 
                      gap: '0.5rem', 
                      background: 'rgba(0,0,0,0.5)', 
                      border: '1px solid rgba(255,255,255,0.05)', 
                      borderRadius: '10px', 
                      padding: '0.75rem' 
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>RACES</span>
                        <span className="text-mono" style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 900 }}>{team.totalRaces || 0}</span>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>WINS</span>
                        <span className="text-mono" style={{ color: '#00e5ff', fontSize: '1.1rem', fontWeight: 900 }}>{team.totalWins || 0}</span>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>WIN %</span>
                        <span className="text-mono" style={{ color: '#f21818', fontSize: '1.1rem', fontWeight: 900 }}>{team.derivedWinRate || 0}%</span>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>AVG POS</span>
                        <span className="text-mono" style={{ color: '#cc44ff', fontSize: '1.1rem', fontWeight: 900 }}>{team.derivedAvgPos || 0}</span>
                      </div>
                    </div>

                    {/* Budget & Action Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>BUDGET REMAINING</span>
                        <span className="text-mono" style={{ color: hasBudget ? '#00ff88' : '#ff2a2a', fontSize: '0.95rem', fontWeight: 800 }}>
                          ${(team.budgetLeft || 0).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 700 }}>
                          ENTER PADDOCK &gt;
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Team Modal (Admin Only) */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <div className="glass-panel animate-in" style={{ padding: '2.5rem', width: '90%', maxWidth: '520px', border: '1px solid var(--accent-primary)' }}>
            <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
              REGISTER NEW FRANCHISE
            </h2>
            
            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>TEAM NAME</label>
                <input 
                  type="text" 
                  className="input-base" 
                  value={newTeamName} 
                  onChange={e => setNewTeamName(e.target.value)} 
                  placeholder="e.g. Apex Hyperdrive" 
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>TEAM LOGO URL</label>
                <input 
                  type="text" 
                  className="input-base" 
                  value={newTeamLogoUrl} 
                  onChange={e => setNewTeamLogoUrl(e.target.value)} 
                  placeholder="/soulgrid/... or https://..." 
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>ASSIGN CAPTAIN (OPTIONAL)</label>
                <select 
                  className="input-base" 
                  value={newCaptainName} 
                  onChange={e => setNewCaptainName(e.target.value)}
                  style={{ width: '100%', appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                >
                  <option value="">-- NO CAPTAIN ASSIGNED --</option>
                  {individuals.map(ind => (
                    <option key={ind.id} value={ind.name}>{ind.name} ({ind.type || 'RACER'})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  CANCEL
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'CREATING...' : 'CONFIRM CONSTRUCTOR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
