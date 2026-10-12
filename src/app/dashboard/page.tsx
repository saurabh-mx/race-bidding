'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useModal } from '@/components/ModalProvider';
import { verifySecurityCode } from '@/app/actions';
import Leaderboard from '@/components/Leaderboard';
import BetLeaderboard from '@/components/BetLeaderboard';
import { AccessibleButton, AccessibleInput, InfoCard } from '@/components/SeniorComponents';
import { generateUnique5DigitId, getUnique5DigitId } from '@/lib/betUtils';

type Role = 'viewer' | 'agent' | 'management' | 'admin';

type Racer = {
  id: string;
  name: string;
  type: 'TEAM' | 'INDIVIDUAL' | 'CAPTAIN' | 'WEEKLY' | 'MONTHLY_RACER' | string;
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
  const [customPos, setCustomPos] = useState<string>('');
  const [customOdds, setCustomOdds] = useState<string>('');
  const [loginId, setLoginId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'TEAM' | 'CAPTAIN' | 'INDIVIDUAL' | 'MONTHLY'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [activeRace, setActiveRace] = useState<any>(null);
  const [editModalRacerId, setEditModalRacerId] = useState<string | null>(null);
  const [adjustingBetRacerId, setAdjustingBetRacerId] = useState<string | null>(null);
  const [adjustBetAmount, setAdjustBetAmount] = useState<string>('');
  
  const [isSecurityVerified, setIsSecurityVerified] = useState(false);
  const [securityCodeInput, setSecurityCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [betReceipt, setBetReceipt] = useState<{ id: string; status: string; amount: number; racerName?: string; positionPrediction?: string } | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const [searchModalFilter, setSearchModalFilter] = useState<'ALL' | 'TEAM' | 'CAPTAIN' | 'RACER' | 'MONTHLY'>('ALL');
  const [highlightedRacerId, setHighlightedRacerId] = useState<string | null>(null);
  const [terminalSearchQuery, setTerminalSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem('securityVerified') === 'true') {
      setIsSecurityVerified(true);
    }
  }, []);

  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isSearchModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(prev => !prev);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      } else if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  const handleJumpToRacer = (racer: Racer) => {
    setIsSearchModalOpen(false);

    if (racer.type === 'TEAM') {
      if (activeTab !== 'ALL' && activeTab !== 'TEAM') {
        setActiveTab('TEAM');
      }
    } else if (racer.type === 'MONTHLY_RACER') {
      if (activeTab !== 'MONTHLY') {
        setActiveTab('MONTHLY');
      }
    } else if (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN') {
      if (activeTab !== 'ALL' && activeTab !== 'CAPTAIN') {
        setActiveTab('CAPTAIN');
      }
    } else {
      if (activeTab !== 'ALL' && activeTab !== 'CAPTAIN' && activeTab !== 'INDIVIDUAL') {
        setActiveTab('ALL');
      }
    }

    if (terminalSearchQuery) {
      setTerminalSearchQuery('');
    }

    setHighlightedRacerId(racer.id);
    setTimeout(() => {
      const el = document.getElementById(`racer-card-${racer.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);

    setTimeout(() => {
      setHighlightedRacerId(null);
    }, 3000);
  };

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
    if (isSubmittingRef.current || isSubmitting) return;
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

    if (!/^\d{4}$/.test(cid)) {
      showError('Invalid CID', 'CID must contain exactly a 4-digit number (e.g. 1234).');
      return;
    }

    const isViewer = role === 'viewer';
    
    let finalPrediction = positionPrediction;
    if (positionPrediction === 'CUSTOM') {
      const cleanPos = customPos.trim().replace(/^pos(ition)?\s*/i, '');
      const mult = parseFloat(customOdds);
      if (!cleanPos) {
        showError('Invalid Position', 'Please enter a valid finishing position or range (e.g. 5 or 2-5).');
        return;
      }
      if (!/^(\d+|\d+\s*-\s*\d+)$/.test(cleanPos)) {
        showError('Invalid Position Format', 'Position must be a number (e.g. 5) or range (e.g. 2-5).');
        return;
      }
      if (isNaN(mult) || mult <= 1) {
        showError('Invalid Odds', 'Custom odds multiplier must be greater than 1.0 (e.g. 1.5, 2.0).');
        return;
      }
      finalPrediction = `${cleanPos.replace(/\s+/g, '')} (${mult}x)`;
    }

    // Prevent double submission / ensure only registered once at a time
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
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

      const { data: insertedBids, error: bidError } = await supabase.from('bids').insert([
        { 
          racer_id: biddingId, 
          user_id: userId, 
          amount, 
          bidder_name: loginId, 
          status: isViewer ? 'PENDING' : 'APPROVED', 
          round_id: roundId,
          position_prediction: finalPrediction,
          bettor_name: bettorName,
          cid: cid,
          image_link: imageLink
        }
      ]).select();

      const insertedBid = insertedBids?.[0];
      const receiptId = insertedBid ? getUnique5DigitId(insertedBid.id) : await generateUnique5DigitId();

      if (!bidError) {
        if (!isViewer) {
          await supabase.from('racers')
            .update({ current_bid: racer.current_bid + amount })
            .eq('id', biddingId);
            
          await supabase.from('audit_logs').insert([{
            user_id: userId,
            action: 'PLACE_BID',
            details: `${loginId} placed an approved bet of $${amount} on ${racer?.name} (ID: ${biddingId}) [Prediction: ${finalPrediction}] [Ticket: ${receiptId}] [Receipt: ${receiptId}]`
          }]);
        } else {
          await supabase.from('audit_logs').insert([{
            user_id: userId,
            action: 'PENDING_BID',
            details: `${loginId} submitted a pending bet of $${amount} on ${racer?.name} (ID: ${biddingId}) [Prediction: ${finalPrediction}] [Ticket: ${receiptId}] [Receipt: ${receiptId}]`
          }]);
        }

        // Return and show 5-digit unique ID receipt modal
        setBetReceipt({
          id: receiptId,
          status: isViewer ? 'PENDING' : 'APPROVED',
          amount,
          racerName: racer.name,
          positionPrediction: finalPrediction
        });

        setBiddingId(null);
        setBidAmount('');
        setBettorName('');
        setCid('');
        setImageLink('');
        setPositionPrediction('');
        setCustomPos('');
        setCustomOdds('');
      } else {
        console.error('Bid error:', bidError);
        showError('Transaction Failed', bidError.message);
      }
    } catch (err: any) {
      console.error('Error placing bet:', err);
      showError('Transaction Failed', err?.message || 'An unexpected error occurred.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
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
        id={`racer-card-${racer.id}`}
        className={`glass-panel bid-card animate-in stagger-${(index % 3) + 1} ${highlightedRacerId === racer.id ? 'search-highlight-card' : ''}`} 
        style={{ 
          padding: '2rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem', 
          cursor: 'pointer', 
          minHeight: '350px',
          position: 'relative',
          border: highlightedRacerId === racer.id ? '1px solid var(--accent-primary)' : '1px solid rgba(242, 24, 24, 0.3)',
          boxShadow: highlightedRacerId === racer.id ? '0 0 30px rgba(242, 24, 24, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(242, 24, 24, 0.05)',
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
            background: racer.type === 'TEAM' ? 'rgba(255,255,255,0.1)' : (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN' || racer.type === 'INDIVIDUAL' ? 'rgba(255, 179, 0, 0.15)' : 'rgba(242, 24, 24, 0.2)'),
            color: racer.type === 'TEAM' ? '#fff' : (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN' || racer.type === 'INDIVIDUAL' ? '#ffb300' : 'var(--accent-secondary)'),
            border: `1px solid ${racer.type === 'TEAM' ? 'rgba(255,255,255,0.2)' : (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN' || racer.type === 'INDIVIDUAL' ? '#ffb300' : 'var(--accent-primary)')}`,
            padding: '0.25rem 0.5rem', 
            fontSize: '0.65rem', 
            fontWeight: 700 
          }}>
            {racer.type === 'TEAM' ? 'TEAM' : (racer.type === 'CAPTAIN' || racer.type === 'INDIVIDUAL' || racer.racer_role === 'CAPTAIN' ? 'CAPTAIN' : `${racer.type} ${racer.racer_role || 'RACER'}`)}
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
          
          {role === 'admin' && (
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
                <Link href="/streamer" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid #00ff88', color: '#00ff88', background: 'rgba(0,255,136,0.1)' }}>
                  STREAMER MODE
                </Link>
              )}
              {role === 'admin' && (
                <Link href="/streamer/panel" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid #00ff88', color: '#00ff88' }}>
                  STREAMER PANEL
                </Link>
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

        {(() => {
          const matchesTerminalSearch = (r: Racer) => {
            if (!terminalSearchQuery.trim()) return true;
            const q = terminalSearchQuery.toLowerCase().trim();
            return (
              r.name.toLowerCase().includes(q) ||
              (r.team_name && r.team_name.toLowerCase().includes(q)) ||
              (r.captain_name && r.captain_name.toLowerCase().includes(q)) ||
              (r.racer_role && r.racer_role.toLowerCase().includes(q)) ||
              (r.roster && r.roster.some(m => m.toLowerCase().includes(q)))
            );
          };

          const filteredData = data.filter(r => 
            r.is_posted === true && 
            matchesTerminalSearch(r) && 
            (
              (activeTab === 'ALL' && !r.type.startsWith('MONTHLY_')) || 
              ((activeTab === 'CAPTAIN' || activeTab === 'INDIVIDUAL') && r.type !== 'TEAM' && !r.type.startsWith('MONTHLY_')) || 
              (activeTab === 'MONTHLY' && r.type === 'MONTHLY_RACER') || 
              r.type === activeTab
            )
          );

          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {['ALL', 'TEAM', 'CAPTAIN', 'MONTHLY'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={activeTab === tab ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}
                    >
                      {tab === 'ALL' ? 'ALL BETS' : `${tab} BETS`}
                    </button>
                  ))}

                  {terminalSearchQuery && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(242,24,24,0.15)', border: '1px solid var(--accent-primary)', padding: '0.5rem 0.85rem', borderRadius: '4px' }}>
                      <span className="text-mono" style={{ fontSize: '0.75rem', color: '#fff' }}>
                        FILTER: <strong style={{ color: 'var(--accent-secondary)' }}>"{terminalSearchQuery}"</strong>
                      </span>
                      <button
                        onClick={() => setTerminalSearchQuery('')}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1 }}
                        title="Clear filter"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      setSearchModalQuery('');
                      setIsSearchModalOpen(true);
                    }}
                    className="btn-secondary"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.6rem', 
                      padding: '0.75rem 1.3rem', 
                      fontSize: '0.85rem',
                      borderColor: 'rgba(255, 255, 255, 0.25)',
                      background: 'rgba(25, 6, 6, 0.8)',
                      cursor: 'pointer'
                    }}
                    title="Search participants (Ctrl+K or /)"
                  >
                    <span style={{ fontSize: '0.95rem' }}>🔍</span>
                    <span className="text-mono" style={{ letterSpacing: '1px', fontWeight: 'bold' }}>SEARCH</span>
                    <kbd style={{ 
                      fontSize: '0.65rem', 
                      background: 'rgba(255,255,255,0.1)', 
                      border: '1px solid rgba(255,255,255,0.2)', 
                      borderRadius: '4px', 
                      padding: '2px 6px', 
                      color: 'var(--text-muted)', 
                      fontFamily: 'monospace' 
                    }}>
                      Ctrl+K
                    </kbd>
                  </button>
                </div>
              </div>

              <div className="grid-3">
                {filteredData.length === 0 ? (
                  <div className="glass-panel text-mono animate-in" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {terminalSearchQuery ? (
                      <>
                        NO PARTICIPANTS FOUND MATCHING "{terminalSearchQuery}".<br/><br/>
                        <button 
                          className="btn-secondary" 
                          onClick={() => setTerminalSearchQuery('')}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', marginTop: '0.5rem' }}
                        >
                          CLEAR SEARCH FILTER
                        </button>
                      </>
                    ) : (
                      <>
                        NO ACTIVE BETS DETECTED.<br/><br/>
                        AWAITING AGENT TO POST BETS.
                      </>
                    )}
                  </div>
                ) : (
                  filteredData.map((racer, idx) => renderCard(racer, idx))
                )}
              </div>
            </>
          );
        })()}
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
              const isPrivileged = role === 'admin' || role === 'agent' || role === 'management';
              const isCidValid = /^\d{4}$/.test(cid);
              const isPositionValid = positionPrediction === 'CUSTOM'
                ? customPos.trim() !== '' && Number(customOdds) > 1.0
                : positionPrediction !== '';
              const isBetValid = Number(bidAmount) >= minBet && isCidValid && isPositionValid;
              
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
                  placeholder={`Minimum bet: $${minBet}`}
                  min={minBet}
                  required
                  autoFocus
                />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>POSITION PREDICTION</label>
                  {isPrivileged && (
                    <span className="text-mono" style={{ fontSize: '0.65rem', color: '#00e5ff' }}>OPERATOR OVERRIDE ACTIVE</span>
                  )}
                </div>
                <select 
                  className="input-base" 
                  value={positionPrediction}
                  onChange={(e) => setPositionPrediction(e.target.value)}
                  style={{ width: '100%', appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                  required
                >
                  <option value="" disabled>-- SELECT POSITION --</option>
                  {r?.type === 'TEAM' ? (
                    ['1-3', '4-6', '7-9', '10-13', '13-15'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))
                  ) : (
                    [
                      { label: '1 (1.5x)', value: '1' },
                      { label: '2-3 (1.4x)', value: '2-3' },
                      { label: '4-6 (1.3x)', value: '4-6' },
                      { label: '6-10 (1.2x)', value: '6-10' },
                      { label: '11-15 (1.1x)', value: '11-15' },
                    ].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))
                  )}
                  {isPrivileged && (
                    <option value="CUSTOM" style={{ color: '#00e5ff', fontWeight: 'bold' }}>
                      ⚡ CUSTOM POSITION & ODDS
                    </option>
                  )}
                </select>

                {positionPrediction === 'CUSTOM' && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.85rem',
                    background: 'rgba(0, 229, 255, 0.05)',
                    border: '1px solid rgba(0, 229, 255, 0.25)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label className="text-mono" style={{ color: '#00e5ff', fontSize: '0.7rem', display: 'block', marginBottom: '0.35rem', fontWeight: 'bold' }}>
                          CUSTOM POS / RANGE
                        </label>
                        <input
                          type="text"
                          className="input-base"
                          placeholder="e.g. 5 or 2-5"
                          value={customPos}
                          onChange={(e) => setCustomPos(e.target.value)}
                          style={{ width: '100%', borderColor: 'rgba(0, 229, 255, 0.4)' }}
                          required
                        />
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                          Single (e.g. 5) or range (e.g. 2-5)
                        </span>
                      </div>
                      <div>
                        <label className="text-mono" style={{ color: '#00e5ff', fontSize: '0.7rem', display: 'block', marginBottom: '0.35rem', fontWeight: 'bold' }}>
                          CUSTOM ODDS MULTIPLIER
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="number"
                            step="0.05"
                            min="1.01"
                            className="input-base"
                            placeholder="e.g. 2.5"
                            value={customOdds}
                            onChange={(e) => setCustomOdds(e.target.value)}
                            style={{ width: '100%', paddingRight: '2rem', borderColor: 'rgba(0, 229, 255, 0.4)' }}
                            required
                          />
                          <span className="text-mono" style={{ position: 'absolute', right: '0.75rem', color: '#00e5ff', fontWeight: 'bold', pointerEvents: 'none' }}>
                            x
                          </span>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                          Multiplier (e.g. 2.5 = 2.5x payout)
                        </span>
                      </div>
                    </div>
                    {customPos.trim() && customOdds && !isNaN(parseFloat(customOdds)) && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.6rem',
                        background: 'rgba(0, 229, 255, 0.1)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: '#00e5ff'
                      }}>
                        <span>Target: <strong>Pos {customPos.trim()}</strong> @ <strong>{parseFloat(customOdds)}x</strong></span>
                        {Number(bidAmount) > 0 && (
                          <span style={{ color: '#00ff88', fontWeight: 'bold' }}>
                            Est. Payout: ${Math.round(Number(bidAmount) * parseFloat(customOdds)).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={cid}
                onChange={(e: any) => setCid(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit CID (e.g. 1234)"
                error={cid.length > 0 && cid.length < 4 ? `CID must be exactly 4 digits (${cid.length}/4)` : undefined}
                helperText={cid.length === 4 ? "✓ 4-digit CID verified" : undefined}
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
                <AccessibleButton variant="secondary" onClick={() => setBiddingId(null)} disabled={isSubmitting}>CANCEL</AccessibleButton>
                <AccessibleButton 
                  type="submit"
                  variant={isBetValid && !isSubmitting ? "primary" : "secondary"} 
                  disabled={!isBetValid || isSubmitting}
                  style={{ opacity: isBetValid && !isSubmitting ? 1 : 0.5 }}
                >
                  {isSubmitting ? 'CONFIRMING...' : 'CONFIRM BET'}
                </AccessibleButton>
              </div>
            </form>
            </>
          );
        })()}
          </div>
        </div>
      )}

      {/* BET RECEIPT MODAL RETURNING 5-DIGIT UNIQUE ID */}
      {betReceipt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          pointerEvents: 'auto'
        }}>
          <div className="glass-panel animate-in" style={{ 
            padding: '3rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '1.5rem',
            minWidth: '450px',
            maxWidth: '520px',
            width: '90%',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 20px 50px rgba(242, 24, 24, 0.3)',
            background: 'linear-gradient(145deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.95) 100%)'
          }}>
            <div style={{ 
              width: '64px', height: '64px', 
              borderRadius: '50%', 
              background: betReceipt.status === 'APPROVED' ? 'rgba(0,255,136,0.1)' : 'rgba(255,170,0,0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${betReceipt.status === 'APPROVED' ? '#00ff88' : '#ffaa00'}`
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={betReceipt.status === 'APPROVED' ? '#00ff88' : '#ffaa00'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {betReceipt.status === 'APPROVED' ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="10" />}
                {betReceipt.status !== 'APPROVED' && <polyline points="12 6 12 12 16 14" />}
              </svg>
            </div>

            <h3 className="title-gradient" style={{ fontSize: '2.5rem', textTransform: 'uppercase', textAlign: 'center', margin: 0 }}>
              {betReceipt.status === 'APPROVED' ? 'BET CONFIRMED' : 'BET PENDING'}
            </h3>
            
            <div style={{ textAlign: 'center' }}>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: '0 0 0.5rem 0' }}>
                You placed a bet of <strong style={{ color: '#00ff88' }}>${betReceipt.amount.toLocaleString()}</strong>{betReceipt.racerName ? ` on ${betReceipt.racerName}` : ''}
                {betReceipt.positionPrediction && (
                  <> (<span style={{ color: '#00e5ff' }}>Pos {betReceipt.positionPrediction}</span>)</>
                )}
              </p>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                {betReceipt.status === 'APPROVED' ? 'Your bet has been logged successfully.' : 'Waiting for management approval.'}
              </p>
            </div>

            <div style={{ 
              background: 'rgba(0,0,0,0.5)', 
              border: '1px dashed rgba(255,255,255,0.2)', 
              padding: '1.5rem', 
              borderRadius: '8px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '2px' }}>TICKET ID / UNIQUE ID</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'monospace', color: '#fff', letterSpacing: '8px' }}>
                  {betReceipt.id}
                </span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(betReceipt.id);
                    setCopiedReceipt(true);
                    setTimeout(() => setCopiedReceipt(false), 2000);
                  }}
                  title="Copy Ticket ID"
                  style={{
                    background: copiedReceipt ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.1)',
                    border: copiedReceipt ? '1px solid #00ff88' : 'none',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => !copiedReceipt && (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                  onMouseOut={e => !copiedReceipt && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                >
                  {copiedReceipt ? (
                    <span style={{ color: '#00ff88', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'monospace' }}>COPIED</span>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <AccessibleButton 
              variant="primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1rem' }}
              onClick={() => {
                setBetReceipt(null);
                setCopiedReceipt(false);
              }}
            >
              DONE
            </AccessibleButton>
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

      {/* SEARCH PARTICIPANT MODAL */}
      {isSearchModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSearchModalOpen(false);
          }}
          style={{ 
            position: 'fixed', 
            top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(12px)', 
            zIndex: 9999, 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'center', 
            paddingTop: '6vh',
            paddingBottom: '3vh'
          }}
        >
          <div 
            className="glass-panel animate-in" 
            style={{ 
              width: '94%', 
              maxWidth: '750px', 
              maxHeight: '88vh',
              display: 'flex', 
              flexDirection: 'column', 
              border: '1px solid var(--accent-primary)', 
              boxShadow: '0 0 40px rgba(242, 24, 24, 0.35)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            {/* Header with Search Input */}
            <div style={{ padding: '1.5rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 3, 3, 0.9)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🔍</span>
                  <h3 className="title-gradient" style={{ fontSize: '1.25rem', letterSpacing: '1px' }}>
                    SEARCH PARTICIPANTS
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    [ESC to close]
                  </span>
                  <button 
                    onClick={() => setIsSearchModalOpen(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1 }}
                    title="Close (Esc)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Search input field */}
              <div style={{ position: 'relative' }}>
                <input 
                  ref={searchInputRef}
                  type="text"
                  className="input-base text-mono"
                  placeholder="Type racer, team, or captain name..."
                  value={searchModalQuery}
                  onChange={(e) => setSearchModalQuery(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '1rem',
                    paddingRight: '2.5rem',
                    fontSize: '1rem',
                    background: 'rgba(0,0,0,0.7)',
                    borderColor: 'rgba(242,24,24,0.4)',
                    boxShadow: 'inset 0 0 10px rgba(242,24,24,0.1)'
                  }}
                  autoFocus
                />
                {searchModalQuery && (
                  <button
                    onClick={() => setSearchModalQuery('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                    title="Clear query"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                {(['ALL', 'TEAM', 'CAPTAIN', 'RACER', 'MONTHLY'] as const).map(tab => {
                  const isActive = searchModalFilter === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setSearchModalFilter(tab)}
                      className="text-mono"
                      style={{
                        padding: '0.35rem 0.8rem',
                        fontSize: '0.75rem',
                        background: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#fff' : 'var(--text-muted)',
                        border: isActive ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: isActive ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab === 'ALL' ? 'ALL' : tab === 'TEAM' ? 'TEAMS' : tab === 'CAPTAIN' ? 'CAPTAINS' : tab === 'RACER' ? 'DRIVERS' : 'MONTHLY'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Results List */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '1.25rem 1.75rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem',
              maxHeight: '52vh'
            }}>
              {(() => {
                const q = searchModalQuery.toLowerCase().trim();
                const matchedRacers = data.filter(r => {
                  const matchesText = !q || 
                    r.name.toLowerCase().includes(q) || 
                    (r.team_name && r.team_name.toLowerCase().includes(q)) ||
                    (r.captain_name && r.captain_name.toLowerCase().includes(q)) ||
                    (r.racer_role && r.racer_role.toLowerCase().includes(q)) ||
                    (r.roster && r.roster.some(m => m.toLowerCase().includes(q)));
                  
                  if (!matchesText) return false;

                  if (searchModalFilter === 'TEAM') return r.type === 'TEAM';
                  if (searchModalFilter === 'CAPTAIN') return r.type === 'CAPTAIN' || r.racer_role === 'CAPTAIN' || (r.type !== 'TEAM' && !r.type.startsWith('MONTHLY_') && r.captain_name === r.name);
                  if (searchModalFilter === 'RACER') return r.type !== 'TEAM' && !r.type.startsWith('MONTHLY_') && r.racer_role !== 'CAPTAIN';
                  if (searchModalFilter === 'MONTHLY') return r.type.startsWith('MONTHLY_') || r.type === 'MONTHLY_RACER';
                  return true;
                });

                if (matchedRacers.length === 0) {
                  return (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <p className="text-mono" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                        NO PARTICIPANTS FOUND MATCHING "{searchModalQuery}"
                      </p>
                      <p className="text-mono" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        Try searching by first name, team name, or clearing filters.
                      </p>
                    </div>
                  );
                }

                return matchedRacers.map(racer => {
                  const isTeam = racer.type === 'TEAM';
                  const isWindowOpen = racer.type === 'TEAM' 
                    ? isTeamBettingOpen 
                    : (racer.type === 'MONTHLY_RACER' ? isMonthlyBettingOpen : isIndBettingOpen);
                  const canBet = isWindowOpen || role === 'admin';

                  return (
                    <div 
                      key={racer.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        transition: 'all 0.2s',
                        flexWrap: 'wrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                        e.currentTarget.style.borderColor = 'rgba(242,24,24,0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }}
                    >
                      {/* Left: Info */}
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <span 
                            className="text-mono" 
                            style={{ 
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              background: isTeam ? 'rgba(255,255,255,0.1)' : (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN' ? 'rgba(255, 179, 0, 0.15)' : 'rgba(242, 24, 24, 0.2)'),
                              color: isTeam ? '#fff' : (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN' ? '#ffb300' : 'var(--accent-secondary)'),
                              border: `1px solid ${isTeam ? 'rgba(255,255,255,0.2)' : (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN' ? '#ffb300' : 'var(--accent-primary)')}`
                            }}
                          >
                            {racer.type === 'TEAM' ? 'TEAM' : (racer.type === 'CAPTAIN' || racer.racer_role === 'CAPTAIN' ? 'CAPTAIN' : (racer.type === 'MONTHLY_RACER' ? 'MONTHLY' : 'RACER'))}
                          </span>

                          {racer.is_posted ? (
                            <span className="text-mono" style={{ fontSize: '0.65rem', color: '#00ff88', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', display: 'inline-block' }}></span>
                              POSTED ON TERMINAL
                            </span>
                          ) : (
                            <span className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              NOT POSTED
                            </span>
                          )}

                          <span className="text-mono" style={{ fontSize: '0.65rem', color: isWindowOpen ? '#00ff88' : '#ff4444' }}>
                            • {isWindowOpen ? 'BETS OPEN' : 'BETS CLOSED'}
                          </span>
                        </div>

                        <h4 style={{ fontSize: '1.1rem', fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '0.5px' }}>
                          {racer.name}
                        </h4>

                        {racer.team_name && !isTeam && (
                          <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            TEAM: <span style={{ color: '#fff' }}>{racer.team_name}</span>
                          </p>
                        )}
                        {isTeam && racer.captain_name && (
                          <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            CAPTAIN: <span style={{ color: '#ffb300' }}>{racer.captain_name}</span>
                          </p>
                        )}
                      </div>

                      {/* Middle: Current Bet */}
                      <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                        <span className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>
                          CURRENT BET
                        </span>
                        <span className="text-mono" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                          ${racer.current_bid.toLocaleString()}
                        </span>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          onClick={() => handleJumpToRacer(racer)}
                          className="btn-secondary"
                          style={{ 
                            padding: '0.5rem 0.85rem', 
                            fontSize: '0.75rem', 
                            borderColor: 'var(--accent-primary)',
                            color: '#fff',
                            whiteSpace: 'nowrap'
                          }}
                          title="Scroll and highlight card on terminal"
                        >
                          📍 JUMP TO CARD
                        </button>

                        <button
                          onClick={() => {
                            setIsSearchModalOpen(false);
                            setBiddingId(racer.id);
                            setBidAmount('');
                          }}
                          className={canBet ? "btn-primary" : "btn-secondary"}
                          disabled={!canBet}
                          style={{ 
                            padding: '0.5rem 0.85rem', 
                            fontSize: '0.75rem',
                            opacity: canBet ? 1 : 0.5,
                            whiteSpace: 'nowrap'
                          }}
                          title={canBet ? "Place bet on this participant" : "Betting window is closed"}
                        >
                          {canBet ? 'PLACE BET' : 'CLOSED'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{ 
              padding: '1rem 1.75rem', 
              borderTop: '1px solid rgba(255,255,255,0.1)', 
              background: 'rgba(15, 3, 3, 0.95)',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {searchModalQuery ? (
                  <>Found matching participants. Click <strong>JUMP</strong> to locate on the terminal.</>
                ) : (
                  <>Showing all participants. Use search to filter quickly.</>
                )}
              </p>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {searchModalQuery && (
                  <button
                    onClick={() => {
                      setTerminalSearchQuery(searchModalQuery);
                      setIsSearchModalOpen(false);
                    }}
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderColor: 'var(--accent-secondary)' }}
                  >
                    FILTER TERMINAL BY "{searchModalQuery}"
                  </button>
                )}
                <button
                  onClick={() => setIsSearchModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
