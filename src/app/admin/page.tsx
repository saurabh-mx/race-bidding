'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useModal } from '@/components/ModalProvider';
import { AccessibleButton, InfoCard } from '@/components/SeniorComponents';
type Role = 'viewer' | 'agent' | 'management' | 'admin';

type Profile = {
  id: string;
  login_id: string;
  role: Role;
};

type AuditLog = {
  id: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
};

type LoginLog = {
  id: string;
  user_id: string;
  created_at: string;
};

type Racer = {
  id: string;
  name: string;
  type: string;
  tournament_points?: number;
};

type Bid = {
  id: string;
  amount: number;
  racer_id: string;
  bidder_name: string;
  status?: string;
  created_at?: string;
  profiles: {
    login_id: string;
  };
};

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [winningRacerId, setWinningRacerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboardEdit, setShowLeaderboardEdit] = useState(false);
  const [editingPoints, setEditingPoints] = useState<Record<string, number>>({});
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardTab, setLeaderboardTab] = useState<'RACERS' | 'TEAMS'>('RACERS');
  const [isResetting, setIsResetting] = useState(false);
  const { showError, showConfirm, showSuccess } = useModal();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
        
      if (!profile || profile.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }
      
      setRole(profile.role);

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('login_id', { ascending: true });
        
      if (allProfiles) setProfiles(allProfiles);

      const { data: allLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);
        
      if (allLogs) setLogs(allLogs);

      const { data: allLoginLogs } = await supabase
        .from('login_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (allLoginLogs) setLoginLogs(allLoginLogs);

      if (allLoginLogs) setLoginLogs(allLoginLogs);

      const fetchRacers = async () => {
        const { data: allRacers } = await supabase.from('racers').select('id, name, type, tournament_points').order('name', { ascending: true });
        if (allRacers) setRacers(allRacers);
      };
      await fetchRacers();
      
      const fetchBids = async () => {
        const { data: activeBids } = await supabase
          .from('bids')
          .select('id, amount, racer_id, bidder_name, status, created_at, profiles(login_id)')
          .in('status', ['APPROVED', 'PENDING'])
          .eq('result', 'PENDING');
        // @ts-expect-error
        if (activeBids) setBids(activeBids);
      };
      await fetchBids();

      setIsLoading(false);

      // Realtime subscription for bids
      const bidsSub = supabase.channel(`admin-bids-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
          fetchBids();
        })
        .subscribe();

      // Realtime subscription for racers
      const racersSub = supabase.channel(`admin-racers-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'racers' }, () => {
          fetchRacers();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(bidsSub);
        supabase.removeChannel(racersSub);
      };
    };

    init();
  }, [router]);

  const payouts = useMemo(() => {
    if (!winningRacerId) return null;
    
    // Calculate winning pool
    const winningBids = bids.filter(b => b.racer_id === winningRacerId);
    const winningPool = winningBids.reduce((sum, b) => sum + b.amount, 0);
    
    // Calculate losing pool
    const losingBids = bids.filter(b => b.racer_id !== winningRacerId);
    const losingPool = losingBids.reduce((sum, b) => sum + b.amount, 0);
    
    const houseEdge = losingPool * 0.5;
    const distributedPool = losingPool - houseEdge;
    
    const bettors = winningBids.map(bid => {
      const share = winningPool > 0 ? (bid.amount / winningPool) : 0;
      const profit = share * distributedPool;
      const totalPayout = bid.amount + profit;
      return {
        id: bid.id,
        name: bid.bidder_name || (bid.profiles as any)?.login_id || 'Unknown',
        betAmount: bid.amount,
        profit,
        totalPayout
      };
    });
    
    return {
      winningPool,
      losingPool,
      houseEdge,
      distributedPool,
      bettors: bettors.sort((a, b) => b.totalPayout - a.totalPayout)
    };
  }, [bids, winningRacerId]);

  const handleRoleChange = async (profileId: string, newRole: Role) => {
    // Update local state optimistically
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
    
    // Update Supabase
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)
      .select();

    if (error || !data || data.length === 0) {
      console.error(error || new Error("Update blocked by RLS policies (0 rows updated)"));
      showError('Update Failed', error ? 'Failed to update role: ' + error.message : 'Role update blocked by permissions.');
      // Revert if error
      const { data: oldProfiles } = await supabase.from('profiles').select('*').order('login_id');
      if (oldProfiles) setProfiles(oldProfiles);
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const newLog = {
          user_id: session.user.id,
          action: 'ROLE_UPDATE',
          details: `Changed role of user ${profileId} to ${newRole}`
        };
        await supabase.from('audit_logs').insert([newLog]);
        setLogs(prev => [{...newLog, id: Date.now().toString(), created_at: new Date().toISOString()} as AuditLog, ...prev]);
      }
    }
  };

  const handleOpenLeaderboardEdit = () => {
    const initialPoints: Record<string, number> = {};
    racers.forEach(r => {
      initialPoints[r.id] = r.tournament_points || 0;
    });
    setEditingPoints(initialPoints);
    setLeaderboardSearch('');
    setLeaderboardTab('RACERS');
    setShowLeaderboardEdit(true);
  };

  const handleSaveLeaderboardPoints = async () => {
    try {
      const updates = Object.keys(editingPoints).map(racerId => {
        return supabase
          .from('racers')
          .update({ tournament_points: editingPoints[racerId] })
          .eq('id', racerId);
      });
      await Promise.all(updates);

      const { data: allRacers } = await supabase
        .from('racers')
        .select('id, name, type, tournament_points')
        .order('name', { ascending: true });
        
      if (allRacers) setRacers(allRacers);
      
      showSuccess('Success', 'Leaderboard points updated successfully.');
      setShowLeaderboardEdit(false);
    } catch (err: any) {
      showError('Error', 'Failed to update points: ' + err.message);
    }
  };

  const handleResetAllPoints = () => {
    showConfirm(
      'RESET ALL POINTS',
      'Are you sure you want to reset ALL tournament points to 0 for all captains and teams? This will immediately clear all points on the leaderboard and cannot be undone.',
      async () => {
        try {
          setIsResetting(true);
          let { error } = await supabase
            .from('racers')
            .update({ tournament_points: 0 })
            .not('id', 'is', null);

          if (error) {
            const updates = racers.map(r => 
              supabase.from('racers').update({ tournament_points: 0 }).eq('id', r.id)
            );
            await Promise.all(updates);
          }

          const { data: allRacers } = await supabase
            .from('racers')
            .select('id, name, type, tournament_points')
            .order('name', { ascending: true });
            
          if (allRacers) {
            setRacers(allRacers);
            const zeroedPoints: Record<string, number> = {};
            allRacers.forEach(r => {
              zeroedPoints[r.id] = 0;
            });
            setEditingPoints(zeroedPoints);
          }

          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.from('audit_logs').insert([{
              user_id: session.user.id,
              action: 'RESET_LEADERBOARD_POINTS',
              details: 'Admin reset all tournament points to 0 for all racers and teams'
            }]);
          }

          showSuccess('Success', 'All tournament points have been reset to 0.');
        } catch (err: any) {
          showError('Reset Failed', 'Failed to reset points: ' + err.message);
        } finally {
          setIsResetting(false);
        }
      },
      true
    );
  };

  const handleCancelBet = async (bidId: string, amount: number, racerId: string) => {
    if (!window.confirm('Are you sure you want to completely VOID this bet? This cannot be undone.')) return;
    
    try {
      const { error: updateError } = await supabase
        .from('bids')
        .update({ status: 'CANCELLED', result: 'VOID' })
        .eq('id', bidId);
        
      if (updateError) throw updateError;
      
      // Refund the racer's pool
      const racer = racers.find(r => r.id === racerId);
      if (racer) {
        const { data: rData } = await supabase.from('racers').select('current_bid').eq('id', racerId).single();
        if (rData) {
          await supabase.from('racers').update({ current_bid: Math.max(0, rData.current_bid - amount) }).eq('id', racerId);
        }
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('audit_logs').insert([{
          user_id: session.user.id,
          action: 'CANCEL_BET',
          details: `Admin cancelled bet ${bidId} for $${amount}`
        }]);
      }
      showSuccess('Bet Cancelled', 'The bet has been successfully voided and the pool has been adjusted.');
    } catch (err: any) {
      showError('Cancellation Failed', err.message);
    }
  };

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
        VERIFYING CLEARANCE LEVEL...
      </p>
    </div>
  );

  return (
    <main style={{ paddingBottom: '4rem', minHeight: '100vh' }}>
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
             <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>
               RACEBET. <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 'bold' }}>&lt; DASHBOARD</span>
             </h1>
           </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="text-mono" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>OPERATOR STATUS</span>
            <span style={{ fontSize: '0.85rem', color: '#ff2a2a', fontWeight: 900, textTransform: 'uppercase' }}>
              {role || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </header>

      <div className="container" style={{ marginTop: '2rem' }}>
        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '3rem', textTransform: 'uppercase' }}>Admin Oversight</h2>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.5rem', letterSpacing: '2px', display: 'flex', alignItems: 'center' }}>
              <span className="pulse-indicator"></span> 
              GLOBAL ACCESS CONTROL
            </p>
          </div>
          <div>
            <AccessibleButton 
              variant="primary" 
              onClick={handleOpenLeaderboardEdit}
              style={{ fontSize: '0.85rem' }}
            >
              EDIT LEADERBOARD PTS
            </AccessibleButton>
          </div>
        </div>

        <div className="glass-panel animate-in" style={{ padding: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>EMAIL_ID</th>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>USER_ID</th>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>CURRENT_ROLE</th>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{profile.login_id}</td>
                  <td className="text-mono" style={{ padding: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{profile.id}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className="text-mono" style={{ 
                      background: profile.role === 'admin' ? 'rgba(255, 42, 42, 0.2)' : (profile.role === 'management' || profile.role === 'agent') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      color: profile.role === 'admin' ? '#ff2a2a' : (profile.role === 'management' || profile.role === 'agent') ? 'var(--accent-secondary)' : '#fff',
                      border: `1px solid ${profile.role === 'admin' ? '#ff2a2a' : (profile.role === 'management' || profile.role === 'agent') ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
                      padding: '0.25rem 0.5rem', 
                      fontSize: '0.75rem', 
                      fontWeight: 700 
                    }}>
                      {profile.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <select 
                      className="input-base text-mono" 
                      value={profile.role}
                      onChange={(e) => handleRoleChange(profile.id, e.target.value as Role)}
                      style={{ padding: '0.5rem', width: 'auto' }}
                    >
                      <option value="viewer">VIEWER</option>
                      <option value="agent">AGENT</option>
                      <option value="management">MANAGEMENT</option>
                      <option value="admin">ADMIN</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase' }}>Payout Calculator</h2>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', letterSpacing: '1px' }}>
              RESOLVE RACE & DISTRIBUTE POOLS
            </p>
          </div>
        </div>

        <div className="glass-panel animate-in" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
            <label className="text-mono" style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>SELECT WINNER:</label>
            <select 
              className="input-base text-mono" 
              value={winningRacerId}
              onChange={(e) => setWinningRacerId(e.target.value)}
              style={{ width: '300px', background: 'rgba(0,0,0,0.5)', padding: '0.5rem' }}
            >
              <option value="">-- CHOOSE WINNING RACER --</option>
              {racers.map(racer => (
                <option key={racer.id} value={racer.id}>{racer.name} ({racer.type})</option>
              ))}
            </select>
          </div>

          {payouts ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <InfoCard title="WINNING POOL" style={{ padding: '24px' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', margin: 0 }}>${payouts.winningPool.toLocaleString()}</p>
                </InfoCard>
                <InfoCard title="LOSING POOL" style={{ padding: '24px' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-muted)', margin: 0 }}>${payouts.losingPool.toLocaleString()}</p>
                </InfoCard>
                <InfoCard title="HOUSE EDGE (50%)" style={{ padding: '24px', border: '2px solid #ff2a2a', background: 'rgba(255,42,42,0.1)' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ff2a2a', margin: 0 }}>${payouts.houseEdge.toLocaleString()}</p>
                </InfoCard>
                <InfoCard title="DISTRIBUTED" style={{ padding: '24px', border: '2px solid #00ff88', background: 'rgba(0,255,136,0.1)' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#00ff88', margin: 0 }}>${payouts.distributedPool.toLocaleString()}</p>
                </InfoCard>
              </div>

              {payouts.bettors.length === 0 ? (
                <p className="text-mono" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>NO BETS PLACED ON THIS RACER.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                      <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>BETTOR NAME / CID</th>
                      <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>INITIAL BET</th>
                      <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>PROFIT</th>
                      <th className="text-mono" style={{ padding: '1rem', color: '#00ff88', textAlign: 'right' }}>TOTAL PAYOUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.bettors.map(bettor => (
                      <tr key={bettor.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="text-mono" style={{ padding: '1rem', color: '#fff', fontWeight: 'bold' }}>{bettor.name}</td>
                        <td className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>${bettor.betAmount.toLocaleString()}</td>
                        <td className="text-mono" style={{ padding: '1rem', color: 'rgba(255,255,255,0.8)', textAlign: 'right' }}>+${Math.floor(bettor.profit).toLocaleString()}</td>
                        <td className="text-mono" style={{ padding: '1rem', color: '#00ff88', textAlign: 'right', fontWeight: 900, fontSize: '1.25rem' }}>${Math.floor(bettor.totalPayout).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <p className="text-mono" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>SELECT A WINNING RACER TO CALCULATE PAYOUTS.</p>
          )}
        </div>

        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase' }}>Active Bets Oversight</h2>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', letterSpacing: '1px' }}>
              REVIEW AND VOID ACTIVE BIDS
            </p>
          </div>
        </div>

        <div className="glass-panel animate-in" style={{ padding: '2rem' }}>
          {bids.length === 0 ? (
            <p className="text-mono" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>NO ACTIVE BETS FOUND IN THE SYSTEM.</p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', position: 'sticky', top: 0, background: 'rgba(20,5,5,0.9)', backdropFilter: 'blur(10px)' }}>
                    <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>TIME</th>
                    <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>BETTOR</th>
                    <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>RACER / TEAM</th>
                    <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>AMOUNT</th>
                    <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>STATUS</th>
                    <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map(bid => {
                    const r = racers.find(r => r.id === bid.racer_id);
                    return (
                      <tr key={bid.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="text-mono" style={{ padding: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                          {bid.created_at ? new Date(bid.created_at).toLocaleTimeString() : 'N/A'}
                        </td>
                        <td className="text-mono" style={{ padding: '1rem', color: '#fff', fontWeight: 'bold' }}>{bid.bidder_name || (bid.profiles as any)?.login_id}</td>
                        <td className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>{r ? r.name : 'Unknown'}</td>
                        <td className="text-mono" style={{ padding: '1rem', color: '#fff', textAlign: 'right', fontWeight: 'bold' }}>${bid.amount.toLocaleString()}</td>
                        <td className="text-mono" style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{ 
                            background: bid.status === 'APPROVED' ? 'rgba(0,255,136,0.1)' : 'rgba(255,166,0,0.1)',
                            color: bid.status === 'APPROVED' ? '#00ff88' : 'orange',
                            padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem'
                          }}>
                            {bid.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <AccessibleButton 
                            variant="danger"
                            onClick={() => handleCancelBet(bid.id, bid.amount, bid.racer_id)}
                            style={{ fontSize: '0.75rem', padding: '8px 16px', minHeight: '36px', minWidth: 'auto', display: 'inline-block' }}
                          >
                            VOID
                          </AccessibleButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase' }}>System Audit Logs</h2>
          </div>
        </div>

        <div className="glass-panel animate-in" style={{ padding: '2rem' }}>
          {logs.length === 0 ? (
            <p className="text-mono" style={{ color: 'var(--text-muted)' }}>NO AUDIT LOGS FOUND.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>TIMESTAMP</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>ROLE</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>USER</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>ACTION</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const userProfile = profiles.find(p => p.id === log.user_id);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="text-mono" style={{ padding: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="text-mono" style={{ padding: '1rem', color: 'var(--accent-primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {userProfile?.role || 'SYSTEM'}
                      </td>
                      <td className="text-mono" style={{ padding: '1rem', color: '#fff' }}>
                        {userProfile?.login_id || log.user_id}
                      </td>
                      <td className="text-mono" style={{ padding: '1rem', color: '#ff2a2a', fontWeight: 'bold' }}>
                        {log.action}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase' }}>Login Audit</h2>
          </div>
        </div>

        <div className="glass-panel animate-in" style={{ padding: '2rem' }}>
          {loginLogs.length === 0 ? (
            <p className="text-mono" style={{ color: 'var(--text-muted)' }}>NO LOGIN LOGS FOUND.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>TIMESTAMP</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>PILOT_ID / USER_ID</th>
                </tr>
              </thead>
              <tbody>
                {loginLogs.map(log => {
                  const profile = profiles.find(p => p.id === log.user_id);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="text-mono" style={{ padding: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        {profile?.login_id || log.user_id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* LEADERBOARD EDIT MODAL */}
      {showLeaderboardEdit && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel animate-in" style={{ 
            padding: '2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 10px 40px rgba(242, 24, 24, 0.2)'
          }}>
            <h3 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase', textAlign: 'center' }}>
              EDIT LEADERBOARD
            </h3>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Adjust tournament points manually. This directly affects the positions shown on the leaderboard.
            </p>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexDirection: 'column' }}>
              <input 
                type="text" 
                placeholder="Search name..." 
                className="input-base" 
                value={leaderboardSearch}
                onChange={e => setLeaderboardSearch(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className={leaderboardTab === 'RACERS' ? 'btn-primary' : 'btn-secondary'} 
                  onClick={() => setLeaderboardTab('RACERS')}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  CAPTAINS
                </button>
                <button 
                  className={leaderboardTab === 'TEAMS' ? 'btn-primary' : 'btn-secondary'} 
                  onClick={() => setLeaderboardTab('TEAMS')}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  TEAMS
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th className="text-mono" style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>NAME</th>
                    <th className="text-mono" style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>TYPE</th>
                    <th className="text-mono" style={{ padding: '0.5rem', color: 'var(--text-muted)', width: '80px', textAlign: 'right' }}>CURRENT</th>
                    <th className="text-mono" style={{ padding: '0.5rem', color: 'var(--text-muted)', width: '120px' }}>NEW POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {racers.filter(r => {
                    const matchesSearch = r.name.toLowerCase().includes(leaderboardSearch.toLowerCase());
                    const matchesTab = leaderboardTab === 'TEAMS' ? r.type === 'TEAM' : r.type !== 'TEAM';
                    return matchesSearch && matchesTab;
                  }).sort((a,b) => (editingPoints[b.id] || 0) - (editingPoints[a.id] || 0)).map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>{r.name}</td>
                      <td className="text-mono" style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.type === 'INDIVIDUAL' ? 'CAPTAIN' : r.type}</td>
                      <td className="text-mono" style={{ padding: '0.5rem', color: 'var(--accent-primary)', fontSize: '0.9rem', textAlign: 'right', fontWeight: 'bold' }}>
                        {r.tournament_points || 0}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input 
                          type="number"
                          className="input-base"
                          style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
                          value={editingPoints[r.id] ?? ''}
                          onChange={(e) => setEditingPoints(prev => ({ ...prev, [r.id]: parseInt(e.target.value) || 0 }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={handleResetAllPoints} 
                disabled={isResetting}
                style={{ 
                  flex: '1 1 180px', 
                  padding: '1rem 0.5rem', 
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  background: 'rgba(255, 42, 42, 0.12)',
                  color: '#ff4d4d',
                  border: '1px solid rgba(255, 42, 42, 0.5)',
                  borderRadius: '4px',
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {isResetting ? 'RESETTING...' : 'RESET ALL POINTS'}
              </button>
              <button 
                type="button"
                onClick={() => setShowLeaderboardEdit(false)} 
                className="btn-secondary" 
                style={{ flex: '1 1 100px', padding: '1rem', fontSize: '1rem' }}
              >
                CANCEL
              </button>
              <button 
                type="button"
                onClick={handleSaveLeaderboardPoints} 
                className="btn-primary" 
                style={{ flex: '1 1 140px', padding: '1rem', fontSize: '1rem' }}
              >
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
