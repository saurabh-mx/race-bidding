'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useModal } from '@/components/ModalProvider';
import { verifySecurityCode } from '@/app/actions';
import Leaderboard from '@/components/Leaderboard';
import BetLeaderboard from '@/components/BetLeaderboard';
import { AccessibleButton, AccessibleInput, InfoCard } from '@/components/SeniorComponents';

type Role = 'viewer' | 'agent' | 'management' | 'admin';

type Racer = {
  id: string;
  name: string;
  type: 'TEAM' | 'INDIVIDUAL' | 'WEEKLY' | 'MONTHLY_RACER';
  current_bid: number;
  status: 'ACTIVE' | 'CLOSED';
  captain_name?: string;
  roster?: string[];
  team_name?: string;
  displayTeam?: string;
  racer_role?: string;
  acquisition?: number;
  betting_window_end?: string | null;
  is_posted?: boolean;
};

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [data, setData] = useState<Racer[]>([]);
  const [biddingId, setBiddingId] = useState<string | null>(null);
  const [isTeamBettingOpen, setIsTeamBettingOpen] = useState(false);
  const [isIndBettingOpen, setIsIndBettingOpen] = useState(false);
  const [isMonthlyBettingOpen, setIsMonthlyBettingOpen] = useState(false);
  const [latestTeamWinner, setLatestTeamWinner] = useState<string>('NONE');
  const [latestRacerWinner, setLatestRacerWinner] = useState<string>('NONE');

  useEffect(() => {
    const handleTeamBetStatus = (e: any) => setIsTeamBettingOpen(e.detail);
    const handleIndBetStatus = (e: any) => setIsIndBettingOpen(e.detail);
    const handleMonthlyBetStatus = (e: any) => setIsMonthlyBettingOpen(e.detail);
    window.addEventListener('team-betting-status', handleTeamBetStatus);
    window.addEventListener('ind-betting-status', handleIndBetStatus);
    window.addEventListener('monthly-betting-status', handleMonthlyBetStatus);
    return () => {
      window.removeEventListener('team-betting-status', handleTeamBetStatus);
      window.removeEventListener('ind-betting-status', handleIndBetStatus);
      window.removeEventListener('monthly-betting-status', handleMonthlyBetStatus);
    };
  }, []);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [bettorName, setBettorName] = useState<string>('');
  const [cid, setCid] = useState<string>('');
  const [imageLink, setImageLink] = useState<string>('');
  const [positionPrediction, setPositionPrediction] = useState<string>('');
  const [loginId, setLoginId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'TEAM' | 'INDIVIDUAL' | 'MONTHLY'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [activeRace, setActiveRace] = useState<any>(null);
  const [editModalRacerId, setEditModalRacerId] = useState<string | null>(null);
  const [adjustingBetRacerId, setAdjustingBetRacerId] = useState<string | null>(null);
  const [adjustBetAmount, setAdjustBetAmount] = useState<string>('');
  
  const [isSecurityVerified, setIsSecurityVerified] = useState(false);
  const [securityCodeInput, setSecurityCodeInput] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('securityVerified') === 'true') {
      setIsSecurityVerified(true);
    }
  }, []);

  const { showError, showConfirm } = useModal();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/login');
        return;
      }
      
      setUserId(session.user.id);

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

      const { data: racers } = await supabase
        .from('racers')
        .select('*')
        .order('current_bid', { ascending: false });
        
      if (racers) setData(racers);
      
      const { data: settings } = await supabase
        .from('app_settings')
        .select('latest_team_winner, latest_racer_winner, current_round_id')
        .eq('id', 1)
        .single();
      if (settings) {
        if (settings.latest_team_winner) setLatestTeamWinner(settings.latest_team_winner);
        if (settings.latest_racer_winner) setLatestRacerWinner(settings.latest_racer_winner);
        
        if (settings.current_round_id) {
          const { data: raceInfo } = await supabase.from('races').select('*').eq('id', settings.current_round_id).single();
          if (raceInfo) setActiveRace(raceInfo);
        }
      }
      
      setIsLoading(false);
    };

    init();

    const channelSettings = supabase.channel('dashboard_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
        if (payload.new.latest_team_winner !== undefined) {
          setLatestTeamWinner(payload.new.latest_team_winner);
        }
        if (payload.new.latest_racer_winner !== undefined) {
          setLatestRacerWinner(payload.new.latest_racer_winner);
        }
      })
      .subscribe();

    const channel = supabase.channel('realtime_racers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'racers' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setData(prev => prev.map(item => item.id === payload.new.id ? payload.new as Racer : item).sort((a,b) => b.current_bid - a.current_bid));
        } else if (payload.eventType === 'INSERT') {
          setData(prev => [payload.new as Racer, ...prev].sort((a,b) => b.current_bid - a.current_bid));
        } else if (payload.eventType === 'DELETE') {
          setData(prev => prev.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channelSettings);
    };
  }, [router]);

  const handleBid = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!biddingId || !bidAmount || isNaN(Number(bidAmount)) || !userId) return;
    if (!loginId) {
      showError('Missing Information', "Profile not fully set up.");
      return;
    }
    
    const amount = Number(bidAmount);
    const racer = data.find(r => r.id === biddingId);
    if (!racer || amount <= 0) {
      showError('Invalid Bet', "Bet amount must be greater than zero.");
      return;
    }

    const isViewer = role === 'viewer';
    
    // Fetch current round_id
    const { data: settings } = await supabase.from('app_settings').select('current_round_id').single();
    const roundId = settings?.current_round_id || 1;

    // Validate min_bet
    const { data: raceInfo } = await supabase.from('races').select('*').eq('id', roundId).single();
    const minBet = racer.type === 'TEAM' ? (raceInfo?.team_min_bet || 0) : (raceInfo?.racer_min_bet || 0);

    if (amount < minBet) {
      showError('Invalid Bet', `Bet amount must be at least $${minBet} for this participant.`);
      return;
    }

    const { error: bidError } = await supabase.from('bids').insert([
      { 
        racer_id: biddingId, 
        user_id: userId, 
        amount, 
        bidder_name: loginId, 
        status: isViewer ? 'PENDING' : 'APPROVED', 
        round_id: roundId,
        position_prediction: positionPrediction,
        bettor_name: bettorName,
        cid: cid,
        image_link: imageLink
      }
    ]);

    if (!bidError) {
      if (!isViewer) {
        await supabase.from('racers')
          .update({ current_bid: racer.current_bid + amount })
          .eq('id', biddingId);
          
        await supabase.from('audit_logs').insert([{
          user_id: userId,
          action: 'PLACE_BID',
          details: `${loginId} placed an approved bet of $${amount} on ${racer?.name} (ID: ${biddingId})`
        }]);
        showConfirm('Success', `Bid placed successfully!`, () => {});
      } else {
        await supabase.from('audit_logs').insert([{
          user_id: userId,
          action: 'PENDING_BID',
          details: `${loginId} submitted a pending bet of $${amount} on ${racer?.name} (ID: ${biddingId})`
        }]);
        showConfirm('Pending Approval', `Your bet of $${amount} has been submitted and is pending AGENT approval.`, () => {});
      }
    } else {
      console.error('Bid error:', bidError);
      showError('Transaction Failed', bidError.message);
    }
    
    setBiddingId(null);
    setBidAmount('');
    setBettorName('');
    setCid('');
    setImageLink('');
    setPositionPrediction('');
  };

  const handleAdjustBet = async (racerId: string, amountChange: number) => {
    const racer = data.find(r => r.id === racerId);
    if (!racer) return;
    
    const newBid = Math.max(0, racer.current_bid + amountChange);
    
    const { error } = await supabase.from('racers').update({ current_bid: newBid }).eq('id', racerId);
    if (error) {
      showError('Failed', 'Failed to adjust bet: ' + error.message);
    } else {
      await supabase.from('audit_logs').insert([{
        user_id: userId,
        action: 'ADJUST_BET',
        details: `${loginId} manually adjusted bet for ${racer.name} by ${amountChange > 0 ? '+' : ''}$${amountChange}. New total: $${newBid}`
      }]);
      showConfirm('Success', `Total bet adjusted successfully to $${newBid}`, () => {});
      setEditModalRacerId(null);
    }
  };

  const handleDeleteRacerBets = (racerId: string) => {
    showConfirm('DELETE ALL BETS', 'Are you sure you want to delete ALL pending bets for this racer? This will reset their total to $0 and delete the bet history.', async () => {
      const racer = data.find(r => r.id === racerId);
      if (!racer) return;
      
      try {
        await supabase.from('bids').update({ result: 'REFUNDED' }).eq('racer_id', racerId).eq('result', 'PENDING');
        await supabase.from('racers').update({ current_bid: 0 }).eq('id', racerId);
        
        await supabase.from('audit_logs').insert([{
          user_id: userId,
          action: 'DELETE_BETS',
          details: `${loginId} deleted all pending bets for ${racer.name}.`
        }]);
        
        showConfirm('Success', `All bets deleted for ${racer.name}`, () => {});
        setEditModalRacerId(null);
      } catch (err: any) {
        showError('Failed', 'Failed to delete bets: ' + err.message);
      }
    });
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('securityVerified');
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await verifySecurityCode(securityCodeInput);
    if (isValid) {
      sessionStorage.setItem('securityVerified', 'true');
      setIsSecurityVerified(true);
    } else {
      showError('Access Denied', 'Invalid security code.');
      setSecurityCodeInput('');
    }
  };



  const renderCard = (racer: Racer, index: number) => {
    const isTeam = racer.type === 'TEAM';
    
    let teamMembers: Racer[] = [];
    let myTeamName = racer.team_name;
    
    if (isTeam) {
      teamMembers = data.filter(r => r.team_name === racer.name);
      if (teamMembers.length === 0) {
        teamMembers = data.filter(r => r.captain_name === racer.name || (racer.roster && racer.roster.includes(r.name)));
      }
    } else {
      if (!myTeamName) {
        const parentTeam = data.find(t => t.type === 'TEAM' && (t.captain_name === racer.name || (t.roster && t.roster.includes(racer.name))));
        if (parentTeam) myTeamName = parentTeam.name;
      }
    }

    return (
      <div 
        key={racer.id} 
        className={`glass-panel bid-card animate-in stagger-${(index % 3) + 1}`} 
        style={{ 
          padding: '2rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem', 
          cursor: 'pointer', 
          minHeight: '350px',
          position: 'relative',
          border: '1px solid rgba(242, 24, 24, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(242, 24, 24, 0.05)',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
          e.currentTarget.style.boxShadow = '0 10px 40px rgba(242, 24, 24, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'rgba(242, 24, 24, 0.3)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(242, 24, 24, 0.05)';
        }}
        onClick={() => router.push(`/racer/${racer.id}`)}
      >
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', fontSize: '10rem', opacity: 0.03, fontWeight: 900, pointerEvents: 'none', zIndex: 0 }}>
          {index + 1}
        </div>
        
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
              ID: {racer.id.split('-')[0].toUpperCase()}
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', marginTop: '0.25rem', color: '#fff' }}>
              {racer.name} <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>↗</span>
            </h3>
            {myTeamName && !isTeam && (
              <div style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                <span className="text-mono" style={{ background: 'rgba(255,255,255,0.1)', padding: '0.15rem 0.5rem', borderRadius: '2px', fontSize: '0.6rem', letterSpacing: '1px' }}>
                  TEAM {myTeamName}
                </span>
              </div>
            )}
          </div>
          
          <span className="text-mono" style={{ 
            background: racer.type === 'TEAM' ? 'rgba(255,255,255,0.1)' : 'rgba(242, 24, 24, 0.2)',
            color: racer.type === 'TEAM' ? '#fff' : 'var(--accent-secondary)',
            border: `1px solid ${racer.type === 'TEAM' ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)'}`,
            padding: '0.25rem 0.5rem', 
            fontSize: '0.65rem', 
            fontWeight: 700 
          }}>
            {racer.type === 'INDIVIDUAL' ? '' : `${racer.type} `}{racer.type !== 'TEAM' ? (racer.racer_role || 'RACER') : ''}
          </span>
        </div>
        
        {isTeam ? (
          <div style={{ margin: '1.5rem 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', letterSpacing: '2px', marginBottom: '1rem' }}>
              TEAM ROSTER
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              {teamMembers.length > 0 ? teamMembers.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
                  <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem' }}>{m.name}</span>
                  <span className="text-mono" style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem' }}>${m.current_bid.toLocaleString()}</span>
                </div>
              )) : (
                <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>[ NO DRIVERS ASSIGNED ]</span>
              )}
            </div>
            
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '1px' }}>TOTAL FRANCHISE<br/>VALUATION</span>
              <span className="text-mono" style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>
                <span style={{ color: 'var(--accent-primary)', fontSize: '1rem' }}>$</span>
                {teamMembers.reduce((sum, m) => sum + m.current_bid, 0).toLocaleString()}
              </span>
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.65rem', letterSpacing: '1px' }}>TEAM CURRENT_BET</span>
              <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <span style={{ fontSize: '0.85rem' }}>$</span>
                {racer.current_bid.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ margin: '1.5rem 0' }}>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', letterSpacing: '2px' }}>
              CURRENT_BET
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '1.5rem' }}>$</span>
              <p className="bid-amount">{racer.current_bid.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(() => {
            const isWindowOpen = racer.type === 'TEAM' 
              ? isTeamBettingOpen 
              : (racer.type === 'MONTHLY_RACER' ? isMonthlyBettingOpen : isIndBettingOpen);
            
            // Can always bet if window is open. If closed, ONLY admin can bet.
            const canBet = isWindowOpen || role === 'admin';
            
            return (
              <AccessibleButton 
                variant={canBet ? "primary" : "secondary"}
                style={{ flex: 1, display: 'flex', justifyContent: 'space-between', opacity: canBet ? 1 : 0.5, padding: '12px 16px', minWidth: '0' }}
                disabled={!canBet}
                onClick={(e: React.MouseEvent) => { 
                  e.stopPropagation(); 
                  setBiddingId(racer.id); 
                  setBidAmount('');
                }}
              >
                <span>{canBet ? 'PLACE BET' : 'BETS CLOSED'}</span>
                <span className="text-mono">&gt;</span>
              </AccessibleButton>
            );
          })()}
          
          {(role === 'agent' || role === 'management' || role === 'admin') && (
            <AccessibleButton variant="secondary" style={{ flex: '0 0 auto', padding: '12px 16px', minWidth: '0' }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setEditModalRacerId(racer.id); }}>
              EDIT
            </AccessibleButton>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
        ESTABLISHING SECURE CONNECTION...
      </p>
    </div>
  );

  return (
    <main style={{ paddingBottom: '4rem' }}>
      <header className="glass-header">
        <Link href="/" style={{ textDecoration: 'none' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
             <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBET.</h1>
           </div>
        </Link>
        <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
          <Link href="/teams" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>TEAMS</Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RACERS</Link>
          <Link href="#" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RULES</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {(role === 'agent' || role === 'management' || role === 'admin') && (
            <>
              {role === 'admin' && (
                <Link href="/admin" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid #cc44ff', color: '#cc44ff' }}>
                  ADMIN
                </Link>
              )}
              <Link href="/management" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid #ffaa00', color: '#ffaa00' }}>
                MANAGEMENT
              </Link>
              <Link href="/pending" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
                PENDING BETS
              </Link>
              {(role === 'management' || role === 'admin') && (
                <>
                  <Link href="/streamer" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid #00ff88', color: '#00ff88', background: 'rgba(0,255,136,0.1)' }}>
                    STREAMER MODE
                  </Link>
                  <Link href="/streamer/panel" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid #00ff88', color: '#00ff88' }}>
                    STREAMER PANEL
                  </Link>
                </>
              )}
            </>
          )}
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => router.push('/profile')} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderColor: 'var(--accent-primary)', color: '#fff' }}>
              PROFILE
            </button>
            <button className="btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
              DISCONNECT
            </button>
          </div>
        </div>
      </header>

      <div style={{ 
        width: '98%', 
        margin: '2rem auto', 
        display: 'grid', 
        gridTemplateColumns: 'minmax(320px, 350px) 1fr minmax(320px, 350px)', 
        gap: '2rem', 
        alignItems: 'start' 
      }}>
        
        {/* LEADERBOARD SIDEBAR */}
        <div style={{ position: 'sticky', top: '100px', height: 'calc(100vh - 120px)' }}>
          <Leaderboard />
        </div>

        {/* MAIN CONTENT */}
        <div style={{ minWidth: 0 }}>
          <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '3rem', textTransform: 'uppercase' }}>Live Terminal</h2>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.5rem', letterSpacing: '2px', display: 'flex', alignItems: 'center' }}>
              <span className="pulse-indicator"></span> 
              GLOBAL BET NETWORK SYNCED
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '1px' }}>LATEST TEAM WINNER</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>{latestTeamWinner}</p>
            </div>
            <div style={{ textAlign: 'right', marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '1px' }}>LATEST RACER WINNER</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>{latestRacerWinner}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {['ALL', 'TEAM', 'INDIVIDUAL', 'MONTHLY'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'ALL' | 'TEAM' | 'INDIVIDUAL' | 'MONTHLY')}
              className={activeTab === tab ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}
            >
              {tab === 'ALL' ? 'ALL BETS' : `${tab} BETS`}
            </button>
          ))}
        </div>

        <div className="grid-3">
          {data.filter(r => r.is_posted === true && ((activeTab === 'ALL' && !r.type.startsWith('MONTHLY_')) || (activeTab === 'INDIVIDUAL' && r.type !== 'TEAM' && !r.type.startsWith('MONTHLY_')) || (activeTab === 'MONTHLY' && r.type === 'MONTHLY_RACER') || r.type === activeTab)).length === 0 ? (
             <div className="glass-panel text-mono animate-in" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                NO ACTIVE BETS DETECTED.<br/><br/>
                AWAITING AGENT TO POST BETS.
             </div>
          ) : (
            data.filter(r => r.is_posted === true && ((activeTab === 'ALL' && !r.type.startsWith('MONTHLY_')) || (activeTab === 'INDIVIDUAL' && r.type !== 'TEAM' && !r.type.startsWith('MONTHLY_')) || (activeTab === 'MONTHLY' && r.type === 'MONTHLY_RACER') || r.type === activeTab)).map((racer, idx) => renderCard(racer, idx))
          )}
        </div>
        </div>

        {/* BET POOLS SIDEBAR */}
        <div style={{ position: 'sticky', top: '100px', height: 'calc(100vh - 120px)' }}>
          <BetLeaderboard />
        </div>
      </div>

      {biddingId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', width: '90%', maxWidth: '500px', border: '1px solid var(--accent-primary)' }}>
            <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '1rem', textTransform: 'uppercase', textAlign: 'center' }}>PLACE BET</h2>
            
            {(() => {
              const r = data.find(r => r.id === biddingId);
              const minBet = r?.type === 'TEAM' ? (activeRace?.team_min_bet || 0) : (activeRace?.racer_min_bet || 0);
              const isBetValid = Number(bidAmount) >= minBet;
              
              return (
                <>
                  <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '2rem' }}>
                    Minimum bet required: ${minBet}
                  </p>
                  
                  <form onSubmit={handleBid} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                <AccessibleInput 
                  label="BET AMOUNT ($)"
                  id="betAmount"
                  type="number" 
                  value={bidAmount}
                  onChange={(e: any) => setBidAmount(e.target.value)}
                  placeholder="Enter bet amount..."
                  required
                  autoFocus
                />

              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>POSITION PREDICTION</label>
                <select 
                  className="input-base" 
                  value={positionPrediction}
                  onChange={(e) => setPositionPrediction(e.target.value)}
                  style={{ width: '100%', appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                  required
                >
                  <option value="" disabled>-- SELECT POSITION --</option>
                  {(r?.type === 'TEAM' ? 
                    ['1-3', '4-6', '7-9', '10-13', '13-15'] : 
                    ['1-3', '4-6', '7-10', '11-15', '16-20', '21-25', '26-30', '31-35', '36-40', '41-45']
                  ).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <AccessibleInput 
                label="BETTOR NAME"
                id="bettorName"
                type="text" 
                value={bettorName}
                onChange={(e: any) => setBettorName(e.target.value)}
                placeholder="Enter bettor's name..."
                required
              />

              <AccessibleInput 
                label="CID"
                id="cid"
                type="text" 
                value={cid}
                onChange={(e: any) => setCid(e.target.value)}
                placeholder="Enter CID..."
                required
              />

              <AccessibleInput 
                label="IMAGE LINK (RECEIPT)"
                id="imageLink"
                type="url" 
                value={imageLink}
                onChange={(e: any) => setImageLink(e.target.value)}
                placeholder="https://..."
              />

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <AccessibleButton variant="secondary" onClick={() => setBiddingId(null)}>CANCEL</AccessibleButton>
                <AccessibleButton 
                  variant={isBetValid ? "primary" : "secondary"} 
                  disabled={!isBetValid}
                  style={{ opacity: isBetValid ? 1 : 0.5 }}
                >
                  CONFIRM BET
                </AccessibleButton>
              </div>
            </form>
            </>
          );
        })()}
          </div>
        </div>
      )}

      {editModalRacerId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', width: '90%', maxWidth: '400px', border: '1px solid var(--accent-primary)' }}>
            <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '1rem', textTransform: 'uppercase', textAlign: 'center' }}>MANAGE RACER</h2>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Select an action for this participant.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
              <AccessibleButton variant="primary" onClick={() => {
                setAdjustingBetRacerId(editModalRacerId);
                setAdjustBetAmount('');
              }} style={{ width: '100%' }}>ADJUST TOTAL BET</AccessibleButton>
              
              <AccessibleButton variant="danger" onClick={() => {
                handleDeleteRacerBets(editModalRacerId);
              }} style={{ width: '100%' }}>DELETE ALL BETS</AccessibleButton>
              
              <AccessibleButton variant="secondary" onClick={() => {
                router.push(`/racer/${editModalRacerId}`);
              }} style={{ width: '100%' }}>EDIT RACER PROFILE</AccessibleButton>
            </div>
            
            <div style={{ marginTop: '2rem' }}>
              <AccessibleButton variant="secondary" onClick={() => setEditModalRacerId(null)} style={{ width: '100%' }}>CLOSE</AccessibleButton>
            </div>
          </div>
        </div>
      )}

      {adjustingBetRacerId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', width: '90%', maxWidth: '400px', border: '1px solid var(--accent-primary)' }}>
            <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '1rem', textTransform: 'uppercase', textAlign: 'center' }}>ADJUST BET</h2>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '2rem' }}>
              Enter amount to ADD to total bet (use negative number to subtract).
            </p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (adjustBetAmount && !isNaN(Number(adjustBetAmount))) {
                handleAdjustBet(adjustingBetRacerId, Number(adjustBetAmount));
                setAdjustingBetRacerId(null);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>AMOUNT ($)</label>
                <input 
                  type="number" 
                  className="input-base" 
                  value={adjustBetAmount}
                  onChange={(e) => setAdjustBetAmount(e.target.value)}
                  placeholder="e.g. 500 or -500"
                  style={{ width: '100%' }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setAdjustingBetRacerId(null)}>CANCEL</button>
                <button type="submit" className="btn-primary">CONFIRM</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isSecurityVerified && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', maxWidth: '400px', width: '90%', border: '1px solid var(--accent-primary)', textAlign: 'center' }}>
            <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>SECURITY CHECK</h2>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '2rem', lineHeight: 1.5 }}>
              AUTHENTICATOR VERIFICATION REQUIRED. PLEASE ENTER YOUR SECURITY CODE TO PROCEED.
            </p>
            <form onSubmit={handleSecuritySubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2.5rem', textAlign: 'left' }}>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>&gt; AUTHENTICATOR CODE</label>
                <input 
                  type="password" 
                  className="input-base"
                  value={securityCodeInput}
                  onChange={(e) => setSecurityCodeInput(e.target.value)}
                  placeholder="••••"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', padding: '1rem' }}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center' }}>
                <span>VERIFY ACCESS</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
