'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type UserProfile = {
  id: string;
  login_id: string;
  role: string;
  totalInvested: number;
  totalWon: number;
  totalLost: number;
  netPL: number;
  betCount: number;
  bets: BetDetail[];
};

type BetDetail = {
  id: string;
  racer_name: string;
  racer_type: string;
  amount: number;
  status: string;
  result: string;
  payout: number;
  created_at: string;
};

export default function ManagementPanel() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, login_id')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setRole(profile.role);
        setLoginId(profile.login_id);
      }

      if (profile?.role !== 'admin' && profile?.role !== 'management') {
        router.replace('/dashboard');
        return;
      }

      await loadData();
    };

    init();
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);

    // Fetch all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, login_id, role')
      .order('login_id');

    if (!profiles) {
      setIsLoading(false);
      return;
    }

    // Fetch all bids with racer info (approved only for P&L)
    const { data: allBids } = await supabase
      .from('bids')
      .select('*, racers(name, type)')
      .order('created_at', { ascending: false });

    // Build user profiles with real P&L data
    const userProfiles: UserProfile[] = profiles.map((p: any) => {
      const userBids = (allBids || []).filter((b: any) => b.user_id === p.id && b.status === 'APPROVED');
      
      const totalInvested = userBids.reduce((sum: number, b: any) => sum + b.amount, 0);
      const wonBids = userBids.filter((b: any) => b.result === 'WON');
      const lostBids = userBids.filter((b: any) => b.result === 'LOST');
      
      const totalWon = wonBids.reduce((sum: number, b: any) => sum + (b.payout || 0), 0);
      const totalLost = lostBids.reduce((sum: number, b: any) => sum + b.amount, 0);
      const netPL = wonBids.reduce((sum: number, b: any) => sum + ((b.payout || 0) - b.amount), 0) - totalLost;
      
      const bets: BetDetail[] = userBids.map((b: any) => ({
        id: b.id,
        racer_name: b.racers?.name || 'UNKNOWN',
        racer_type: b.racers?.type || 'UNKNOWN',
        amount: b.amount,
        status: b.status,
        result: b.result || 'PENDING',
        payout: b.payout || 0,
        created_at: b.created_at
      }));
      
      return {
        id: p.id,
        login_id: p.login_id,
        role: p.role,
        totalInvested,
        totalWon,
        totalLost,
        netPL,
        betCount: userBids.length,
        bets
      };
    });

    setUsers(userProfiles);
    setFilteredUsers(userProfiles);
    setIsLoading(false);
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u => u.login_id.toLowerCase().includes(q)));
    }
  }, [searchQuery, users]);

  if (isLoading || (role !== 'admin' && role !== 'management')) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
        LOADING MANAGEMENT PANEL...
      </p>
    </div>
  );

  // Global stats
  const totalVolume = users.reduce((sum, u) => sum + u.totalInvested, 0);
  const totalPayout = users.reduce((sum, u) => sum + u.totalWon, 0);
  const housePL = totalVolume - totalPayout;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
            <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBET. <span style={{ color: '#fff', fontSize: '1rem' }}>// MANAGEMENT</span></h1>
          </div>
        </Link>
        <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
          <Link href="/teams" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>TEAMS</Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>DRIVERS</Link>
          <Link href="#" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RULES</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/pending" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
            PENDING BETS
          </Link>
          <div className="text-mono" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{loginId.toUpperCase()}</span>
            <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              OP: {role || 'UNKNOWN'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => router.push('/dashboard')} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
              BACK
            </button>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 className="title-gradient" style={{ fontSize: '2rem' }}>USER MANAGEMENT</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="SEARCH USER..."
              className="input-base text-mono"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem', minWidth: '300px', letterSpacing: '1px' }}
            />
            <button onClick={loadData} className="btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem' }}>
              REFRESH
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL USERS</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{users.length}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL BET VOLUME</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-primary)' }}>${totalVolume.toLocaleString()}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL PAYOUTS</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#00ff88' }}>${totalPayout.toLocaleString()}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>ACTIVE BETTORS</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#ffaa00' }}>{users.filter(u => u.betCount > 0).length}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>HOUSE P&L</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: housePL >= 0 ? '#00ff88' : '#ff4444' }}>{housePL >= 0 ? '+' : ''}${housePL.toLocaleString()}</p>
          </div>
        </div>

        {/* User List */}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {/* Table Header */}
          <div className="text-mono" style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 0.75fr 1fr 1fr 1fr 1fr 0.75fr', 
            padding: '1rem 1.5rem',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            letterSpacing: '2px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span>USER</span>
            <span style={{ textAlign: 'right' }}>ROLE</span>
            <span style={{ textAlign: 'right' }}>INVESTED</span>
            <span style={{ textAlign: 'right' }}>WON</span>
            <span style={{ textAlign: 'right' }}>LOST</span>
            <span style={{ textAlign: 'right' }}>NET P&L</span>
            <span style={{ textAlign: 'right' }}>BETS</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="glass-panel text-mono" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              NO USERS FOUND.
            </div>
          ) : (
            filteredUsers.map(user => (
              <div 
                key={user.id}
                className="glass-panel"
                onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.75fr 1fr 1fr 1fr 1fr 0.75fr',
                  padding: '1.25rem 1.5rem',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderLeft: selectedUser?.id === user.id ? '4px solid var(--accent-primary)' : '4px solid transparent',
                  background: selectedUser?.id === user.id ? 'rgba(242, 24, 24, 0.05)' : undefined
                }}
              >
                <div>
                  <p style={{ fontWeight: 900, color: '#fff', fontSize: '1rem' }}>{user.login_id.toUpperCase()}</p>
                </div>
                <p className="text-mono" style={{ 
                  textAlign: 'right', 
                  fontSize: '0.75rem', 
                  color: user.role === 'admin' ? '#ff2a2a' : user.role === 'management' ? '#ffaa00' : 'var(--text-muted)',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>{user.role}</p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                  ${user.totalInvested.toLocaleString()}
                </p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#00ff88', fontWeight: 'bold' }}>
                  ${user.totalWon.toLocaleString()}
                </p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#ff4444', fontWeight: 'bold' }}>
                  ${user.totalLost.toLocaleString()}
                </p>
                <p className="text-mono" style={{ 
                  textAlign: 'right', 
                  fontSize: '1rem', 
                  color: user.netPL > 0 ? '#00ff88' : user.netPL < 0 ? '#ff4444' : 'var(--text-muted)', 
                  fontWeight: 900 
                }}>
                  {user.netPL >= 0 ? '+' : ''}${user.netPL.toLocaleString()}
                </p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#fff' }}>
                  {user.betCount}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Expanded User Detail */}
        {selectedUser && selectedUser.bets.length > 0 && (
          <div className="glass-panel animate-in" style={{ marginTop: '1rem', padding: '2rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                BET HISTORY — <span style={{ color: 'var(--accent-primary)' }}>{selectedUser.login_id.toUpperCase()}</span>
              </h3>
              <button onClick={() => setSelectedUser(null)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.7rem' }}>
                CLOSE
              </button>
            </div>

            {/* Bet history header */}
            <div className="text-mono" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.25fr 1.25fr 0.75fr 0.75fr 0.75fr 0.75fr 0.75fr', 
              padding: '0.75rem 1rem',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              letterSpacing: '2px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '0.5rem'
            }}>
              <span>DATE</span>
              <span>BET ON</span>
              <span>TYPE</span>
              <span style={{ textAlign: 'right' }}>AMOUNT</span>
              <span style={{ textAlign: 'right' }}>PAYOUT</span>
              <span style={{ textAlign: 'right' }}>PROFIT</span>
              <span style={{ textAlign: 'right' }}>RESULT</span>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {selectedUser.bets.map(bet => {
                const profit = bet.result === 'WON' ? bet.payout - bet.amount : bet.result === 'LOST' ? -bet.amount : 0;
                
                return (
                  <div 
                    key={bet.id}
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1.25fr 1.25fr 0.75fr 0.75fr 0.75fr 0.75fr 0.75fr', 
                      padding: '0.75rem 1rem',
                      background: bet.result === 'WON' ? 'rgba(0, 255, 136, 0.05)' : bet.result === 'LOST' ? 'rgba(255, 68, 68, 0.05)' : 'rgba(255,255,255,0.02)',
                      borderLeft: bet.result === 'WON' ? '3px solid #00ff88' : bet.result === 'LOST' ? '3px solid #ff4444' : '3px solid #555',
                      alignItems: 'center'
                    }}
                  >
                    <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(bet.created_at).toLocaleDateString()} {new Date(bet.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>{bet.racer_name}</span>
                    <span className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{bet.racer_type}</span>
                    <span className="text-mono" style={{ textAlign: 'right', fontSize: '0.95rem', color: '#fff', fontWeight: 'bold' }}>
                      ${bet.amount.toLocaleString()}
                    </span>
                    <span className="text-mono" style={{ textAlign: 'right', fontSize: '0.95rem', color: bet.result === 'WON' ? '#00ff88' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {bet.result === 'WON' ? `$${bet.payout.toLocaleString()}` : bet.result === 'LOST' ? '$0' : '—'}
                    </span>
                    <span className="text-mono" style={{ 
                      textAlign: 'right', 
                      fontSize: '0.95rem', 
                      fontWeight: 900,
                      color: profit > 0 ? '#00ff88' : profit < 0 ? '#ff4444' : '#888'
                    }}>
                      {bet.result === 'PENDING' ? '—' : `${profit >= 0 ? '+' : ''}$${profit.toLocaleString()}`}
                    </span>
                    <span className="text-mono" style={{ 
                      textAlign: 'right', 
                      fontSize: '0.75rem', 
                      fontWeight: 900,
                      color: bet.result === 'WON' ? '#00ff88' : bet.result === 'LOST' ? '#ff4444' : '#888',
                      letterSpacing: '1px'
                    }}>
                      {bet.result}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
