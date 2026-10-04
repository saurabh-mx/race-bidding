'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Bid = {
  id: string;
  racer_id: string;
  bidder_name: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  result: 'PENDING' | 'WON' | 'LOST';
  payout: number;
  created_at: string;
  racer_name?: string;
};

export default function UserProfile() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, login_id, display_name')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setRole(profile.role);
        setLoginId(profile.login_id);
        setDisplayName(profile.display_name || '');
      }

      await fetchMyBids(session.user.id);
    };

    init();
  }, [router]);

  const fetchMyBids = async (userId: string) => {
    setIsLoading(true);
    const { data: bids } = await supabase
      .from('bids')
      .select('*, racers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (bids) {
      setMyBids(bids.map((b: any) => ({
        ...b,
        result: b.result || 'PENDING',
        payout: b.payout || 0,
        racer_name: b.racers?.name || 'UNKNOWN'
      })));
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (isLoading) return null;

  // Stats calculation
  const approvedBids = myBids.filter(b => b.status === 'APPROVED');
  const totalInvested = approvedBids.reduce((sum, b) => sum + b.amount, 0);
  const totalPending = myBids.filter(b => b.status === 'PENDING').reduce((sum, b) => sum + b.amount, 0);
  
  const wonBids = approvedBids.filter(b => b.result === 'WON');
  const lostBids = approvedBids.filter(b => b.result === 'LOST');
  const activeBids = approvedBids.filter(b => b.result === 'PENDING');
  
  const totalWon = wonBids.reduce((sum, b) => sum + b.payout, 0);
  const totalLost = lostBids.reduce((sum, b) => sum + b.amount, 0);
  const totalProfit = totalWon - totalInvested + activeBids.reduce((sum, b) => sum + b.amount, 0); // unsettled bids counted at face value
  const netPL = wonBids.reduce((sum, b) => sum + (b.payout - b.amount), 0) - lostBids.reduce((sum, b) => sum + b.amount, 0);
  
  // P&L Graph Data - shows cumulative P&L over time
  let cumulativePL = 0;
  const chartData = approvedBids
    .filter(b => b.result !== 'PENDING')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(b => {
      if (b.result === 'WON') {
        cumulativePL += (b.payout - b.amount); // profit only
      } else if (b.result === 'LOST') {
        cumulativePL -= b.amount;
      }
      return {
        name: new Date(b.created_at).toLocaleDateString(),
        total: cumulativePL,
        amount: b.result === 'WON' ? b.payout : -b.amount,
        racer: b.racer_name,
        result: b.result
      };
    });

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
            <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBET. <span style={{ color: '#fff', fontSize: '1rem' }}>// PROFILE</span></h1>
          </div>
        </Link>
        <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
          <Link href="/teams" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>TEAMS</Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>DRIVERS</Link>
          <Link href="#" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RULES</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {(role === 'agent' || role === 'admin') && (
            <Link href="/pending" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
              PENDING BETS
            </Link>
          )}
          <div 
            className="text-mono hover-glow" 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '4px' }}
            onClick={() => router.push('/profile')}
            title="Go to Profile"
          >
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{(displayName || loginId).toUpperCase()}</span>
            <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : role === 'agent' ? 'var(--accent-secondary)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              OP: {role || 'UNKNOWN'}
            </span>
          </div>
          <button className="btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
            DISCONNECT
          </button>
        </div>
      </header>

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <h2 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem', textTransform: 'uppercase' }}>{(displayName || loginId).toUpperCase()} // DOSSIER</h2>
        
        {/* STATS ROW */}
        {(() => {
          // For agents: flip perspective to show HOUSE P&L
          const isAgent = role === 'agent' || role === 'admin';
          // House earned = what clients lost (their bet amounts on losing bets)
          const houseEarned = lostBids.reduce((sum, b) => sum + b.amount, 0);
          // House paid = what clients won (their payouts on winning bets)
          const housePaid = wonBids.reduce((sum, b) => sum + b.payout, 0);
          // House net = earned - paid
          const houseNet = houseEarned - housePaid;

          return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '3rem' }}>
          <div className="glass-panel animate-in" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.5rem', letterSpacing: '1px' }}>TOTAL INVESTED</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>${totalInvested.toLocaleString()}</p>
          </div>
          <div className="glass-panel animate-in" style={{ padding: '1.5rem', borderLeft: `4px solid ${isAgent ? '#00ff88' : '#00ff88'}` }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.5rem', letterSpacing: '1px' }}>{isAgent ? 'CLIENTS LOST (HOUSE WON)' : 'TOTAL WON'}</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#00ff88' }}>${isAgent ? houseEarned.toLocaleString() : totalWon.toLocaleString()}</p>
            <p className="text-mono" style={{ color: '#00ff88', fontSize: '0.65rem', marginTop: '0.25rem' }}>{isAgent ? `${lostBids.length} LOSING BET${lostBids.length !== 1 ? 'S' : ''}` : `${wonBids.length} WINNING BET${wonBids.length !== 1 ? 'S' : ''}`}</p>
          </div>
          <div className="glass-panel animate-in" style={{ padding: '1.5rem', borderLeft: '4px solid #ff4444' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.5rem', letterSpacing: '1px' }}>{isAgent ? 'CLIENTS WON (HOUSE PAID)' : 'TOTAL LOST'}</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#ff4444' }}>${isAgent ? housePaid.toLocaleString() : totalLost.toLocaleString()}</p>
            <p className="text-mono" style={{ color: '#ff4444', fontSize: '0.65rem', marginTop: '0.25rem' }}>{isAgent ? `${wonBids.length} WINNING BET${wonBids.length !== 1 ? 'S' : ''}` : `${lostBids.length} LOSING BET${lostBids.length !== 1 ? 'S' : ''}`}</p>
          </div>
          <div className="glass-panel animate-in" style={{ padding: '1.5rem', borderLeft: `4px solid ${(isAgent ? houseNet : netPL) >= 0 ? '#00ff88' : '#ff4444'}` }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.5rem', letterSpacing: '1px' }}>{isAgent ? 'RACEBET P&L' : 'NET P&L'}</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: (isAgent ? houseNet : netPL) >= 0 ? '#00ff88' : '#ff4444' }}>{(isAgent ? houseNet : netPL) >= 0 ? '+' : ''}${(isAgent ? houseNet : netPL).toLocaleString()}</p>
          </div>
          <div className="glass-panel animate-in" style={{ padding: '1.5rem', borderLeft: '4px solid #ffaa00' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.5rem', letterSpacing: '1px' }}>PENDING ESCROW</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#ffaa00' }}>${totalPending.toLocaleString()}</p>
            <p className="text-mono" style={{ color: '#ffaa00', fontSize: '0.65rem', marginTop: '0.25rem' }}>{activeBids.length} ACTIVE BET{activeBids.length !== 1 ? 'S' : ''}</p>
          </div>
        </div>
          );
        })()}

        {/* P&L GRAPH */}
        {chartData.length > 0 && (
          <div className="glass-panel animate-in" style={{ padding: '2rem', marginBottom: '3rem' }}>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginBottom: '1.5rem', letterSpacing: '2px' }}>PROFIT & LOSS TRAJECTORY</p>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ff4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#333" tick={{fill: '#666', fontSize: 10}} />
                  <YAxis stroke="#333" tick={{fill: '#666', fontSize: 10}} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #f21818', borderRadius: '0' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any) => [`$${value}`, 'Net P&L']}
                    labelStyle={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke={cumulativePL >= 0 ? '#00ff88' : '#ff4444'} 
                    fillOpacity={1} 
                    fill={cumulativePL >= 0 ? 'url(#colorProfit)' : 'url(#colorLoss)'} 
                    strokeWidth={2} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TRANSACTION LOG */}
        <div className="glass-panel animate-in" style={{ padding: '2rem' }}>
          <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginBottom: '1.5rem', letterSpacing: '2px' }}>TRANSACTION LOG</p>
          
          {myBids.length === 0 ? (
            <p className="text-mono" style={{ color: 'var(--text-muted)' }}>NO RECORDED TRANSACTIONS.</p>
          ) : (
            <>
              {/* Table Header */}
              <div className="text-mono" style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr', 
                padding: '0.75rem 0',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                letterSpacing: '2px',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
                marginBottom: '0.5rem'
              }}>
                <span>DATE</span>
                <span>BET ON</span>
                <span style={{ textAlign: 'right' }}>AMOUNT</span>
                <span style={{ textAlign: 'right' }}>PAYOUT</span>
                <span style={{ textAlign: 'right' }}>PROFIT</span>
                <span style={{ textAlign: 'right' }}>STATUS</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...myBids].filter(b => b.status !== 'REJECTED').reverse().map(bid => {
                  const profit = bid.result === 'WON' ? bid.payout - bid.amount : bid.result === 'LOST' ? -bid.amount : 0;
                  
                  return (
                    <div key={bid.id} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr',
                      padding: '1rem 0', 
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      alignItems: 'center',
                      borderLeft: bid.result === 'WON' ? '3px solid #00ff88' : bid.result === 'LOST' ? '3px solid #ff4444' : '3px solid transparent',
                      paddingLeft: '0.75rem'
                    }}>
                      <div>
                        <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(bid.created_at).toLocaleDateString()}</p>
                        <p className="text-mono" style={{ color: '#666', fontSize: '0.6rem' }}>{new Date(bid.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{bid.racer_name}</p>
                      <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                        ${bid.amount.toLocaleString()}
                      </p>
                      <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: bid.result === 'WON' ? '#00ff88' : 'var(--text-muted)', fontWeight: 'bold' }}>
                        {bid.result === 'WON' ? `$${bid.payout.toLocaleString()}` : bid.result === 'LOST' ? '$0' : '—'}
                      </p>
                      <p className="text-mono" style={{ 
                        textAlign: 'right', 
                        fontSize: '1rem', 
                        fontWeight: 900,
                        color: profit > 0 ? '#00ff88' : profit < 0 ? '#ff4444' : 'var(--text-muted)'
                      }}>
                        {bid.result === 'PENDING' ? '—' : `${profit >= 0 ? '+' : ''}$${profit.toLocaleString()}`}
                      </p>
                      <div style={{ textAlign: 'right' }}>
                        <span className="text-mono" style={{ 
                          fontSize: '0.65rem',
                          padding: '0.15rem 0.5rem',
                          background: bid.result === 'WON' ? 'rgba(0, 255, 136, 0.15)' : bid.result === 'LOST' ? 'rgba(255, 68, 68, 0.15)' : bid.status === 'APPROVED' ? 'rgba(242, 24, 24, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          color: bid.result === 'WON' ? '#00ff88' : bid.result === 'LOST' ? '#ff4444' : bid.status === 'APPROVED' ? 'var(--accent-primary)' : '#fff',
                          border: `1px solid ${bid.result === 'WON' ? '#00ff88' : bid.result === 'LOST' ? '#ff4444' : bid.status === 'APPROVED' ? 'var(--accent-primary)' : '#666'}`,
                          letterSpacing: '1px'
                        }}>
                          {bid.result !== 'PENDING' ? bid.result : bid.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
