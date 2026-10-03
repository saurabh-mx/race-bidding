'use client';
import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useModal } from '@/components/ModalProvider';

type Racer = {
  id: string;
  name: string;
  type: string;
  current_bid: number;
  status: string;
  logo_url: string;
  captain_name: string;
  captain_image_url: string;
  roster: string[];
  races: number;
  win_rate: number;
  wins: number;
  avg_pos: number;
  team_name?: string;
  displayTeam?: string;
  racer_role?: string;
  acquisition?: number;
  betting_window_end?: string | null;
};

type Bid = {
  id: string;
  amount: number;
  created_at: string;
  bidder_name: string;
  result?: string;
  payout?: number;
  round_id?: number;
  profiles: {
    login_id: string;
  };
};

export default function RacerProfile() {
  const { id } = useParams();
  const router = useRouter();
  const [racer, setRacer] = useState<Racer | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const { showError, showConfirm } = useModal();
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('B');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editCaptainName, setEditCaptainName] = useState('');
  const [editCaptainImageUrl, setEditCaptainImageUrl] = useState('');
  const [editRoster, setEditRoster] = useState<string[]>(['', '', '', '', '']);
  const [editRaces, setEditRaces] = useState<number>(0);
  const [editWinRate, setEditWinRate] = useState<number>(0);
  const [editWins, setEditWins] = useState<number>(0);
  const [editAvgPos, setEditAvgPos] = useState<number>(0);
  const [editAcquisition, setEditAcquisition] = useState<number>(0);
  const [editTeamName, setEditTeamName] = useState('');
  const [editRacerRole, setEditRacerRole] = useState('RACER');
  const [individuals, setIndividuals] = useState<Racer[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBidding, setIsBidding] = useState(false);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [loginId, setLoginId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [bettorName, setBettorName] = useState<string>('');
  const [cid, setCid] = useState<string>('');
  const [imageLink, setImageLink] = useState<string>('');
  const [isTeamBettingOpen, setIsTeamBettingOpen] = useState(false);
  const [isIndBettingOpen, setIsIndBettingOpen] = useState(false);
  const [isMonthlyBettingOpen, setIsMonthlyBettingOpen] = useState(false);

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

  useEffect(() => {
    const fetchStats = async () => {
      if (!id) return;

      // 0. Fetch Auth & Role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
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
      }

      // 0.5 Fetch all Individual drivers and Teams for dropdowns
      const { data: indData } = await supabase
        .from('racers')
        .select('*')
        .neq('type', 'TEAM')
        .order('name');
      if (indData) setIndividuals(indData);
      
      const { data: teamsData } = await supabase
        .from('racers')
        .select('id, name, captain_name, roster')
        .eq('type', 'TEAM')
        .order('name');
      if (teamsData) setTeams(teamsData);

      // 1. Fetch Racer Info
      const { data: racerData } = await supabase
        .from('racers')
        .select('*')
        .eq('id', id)
        .single();

      if (racerData) {
        let displayTeam = racerData.team_name;
        if (!displayTeam && racerData.type !== 'TEAM' && teamsData) {
          const myTeam = teamsData.find(t => 
            t.captain_name === racerData.name || 
            (t.roster && t.roster.includes(racerData.name))
          );
          if (myTeam) displayTeam = myTeam.name;
        }
        racerData.displayTeam = displayTeam;

        setRacer(racerData);
        setEditName(racerData.name);
        setEditType(racerData.type);
        setEditLogoUrl(racerData.logo_url || '');
        setEditCaptainName(racerData.captain_name || '');
        setEditCaptainImageUrl(racerData.captain_image_url || '');
        setEditRoster(racerData.roster?.length === 5 ? racerData.roster : ['', '', '', '', '']);
        setEditRaces(racerData.races || 0);
        setEditWinRate(racerData.win_rate || 0);
        setEditWins(racerData.wins || 0);
        setEditAvgPos(racerData.avg_pos || 0);
        setEditAcquisition(racerData.acquisition || 0);
        setEditTeamName(racerData.team_name || '');
        setEditRacerRole(racerData.racer_role || 'RACER');
      }

      // 2. Fetch Bid History strictly for this entity
      const targetIds = [id];

      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          id,
          amount,
          created_at,
          racer_id,
          bidder_name,
          result,
          payout,
          round_id,
          profiles ( login_id )
        `)
        .in('racer_id', targetIds)
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false });

      if (bidsData) {
        // @ts-expect-error
        setBids(bidsData);
      }

      setIsLoading(false);
    };

    fetchStats();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !id) return;

    const { error } = await supabase
      .from('racers')
      .update({ 
        name: editName, 
        type: editType,
        logo_url: editLogoUrl,
        captain_name: editCaptainName,
        captain_image_url: editCaptainImageUrl,
        roster: editRoster,
        races: editRaces,
        win_rate: editWinRate,
        wins: editWins,
        avg_pos: editAvgPos,
        acquisition: editAcquisition,
        team_name: editType !== 'TEAM' ? editTeamName : null,
        racer_role: editType !== 'TEAM' ? editRacerRole : null
      })
      .eq('id', id);

    if (!error) {
      await supabase.from('audit_logs').insert([{
        user_id: userId,
        action: 'UPDATE_ENTITY',
        details: `Updated entity ${id} to ${editName} (${editType})`
      }]);
      setRacer(prev => prev ? { 
        ...prev, 
        name: editName, 
        type: editType,
        logo_url: editLogoUrl,
        captain_name: editCaptainName,
        captain_image_url: editCaptainImageUrl,
        roster: editRoster,
        races: editRaces,
        win_rate: editWinRate,
        wins: editWins,
        avg_pos: editAvgPos,
        acquisition: editAcquisition,
        team_name: editType !== 'TEAM' ? editTeamName : undefined,
        racer_role: editType !== 'TEAM' ? editRacerRole : undefined
      } : null);
      setIsEditing(false);
      window.location.reload();
    } else {
      console.error(error);
      showError('Update Failed', 'Failed to update entity: ' + error.message);
    }
  };

  const handleBid = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !bidAmount || isNaN(Number(bidAmount)) || !userId) return;
    if (!loginId) {
      showError('Missing Information', 'Profile not fully set up.');
      return;
    }
    
    const amount = Number(bidAmount);
    if (!racer || amount <= 0) {
      showError('Invalid Bet', 'Bet amount must be greater than zero.');
      return;
    }

    const isViewer = role === 'viewer';
    
    // Fetch current round_id
    const { data: settings } = await supabase.from('app_settings').select('current_round_id').single();
    const roundId = settings?.current_round_id || 1;

    // Validate min_bet
    const { data: raceInfo } = await supabase.from('races').select('*').eq('id', roundId).single();
    const minBet = racer.type === 'TEAM' || racer.type === 'MONTHLY_TEAM' ? (raceInfo?.team_min_bet || 0) : (raceInfo?.racer_min_bet || 0);

    if (amount < minBet) {
      showError('Invalid Bet', `Bet amount must be at least $${minBet} for this participant.`);
      return;
    }

    const finalBettorName = (role === 'admin' || role === 'management') ? (bettorName || loginId) : loginId;
    const finalCid = (role === 'admin' || role === 'management') ? cid : null;

    const { error: bidError } = await supabase.from('bids').insert([
      { 
        racer_id: id, 
        user_id: userId, 
        amount, 
        bidder_name: loginId, 
        bettor_name: finalBettorName,
        cid: finalCid,
        status: isViewer ? 'PENDING' : 'APPROVED',
        round_id: roundId
      }
    ]);

    if (!bidError) {
      if (!isViewer) {
        await supabase.from('racers')
          .update({ current_bid: racer.current_bid + amount })
          .eq('id', id);
          
        await supabase.from('audit_logs').insert([{
          user_id: userId,
          action: 'PLACE_BID',
          details: `${loginId} placed an approved bet of $${amount} on ${racer.name} (ID: ${id})`
        }]);
        showConfirm('Success', `Bid placed successfully!`, () => { window.location.reload(); });
      } else {
        await supabase.from('audit_logs').insert([{
          user_id: userId,
          action: 'PENDING_BID',
          details: `${loginId} submitted a pending bet of $${amount} on ${racer.name} (ID: ${id})`
        }]);
        showConfirm('Pending Approval', `Your bet of $${amount} has been submitted and is pending management approval.`, () => { window.location.reload(); });
      }
    } else {
      console.error('Bet error:', bidError);
      showError('Transaction Failed', bidError.message);
    }
    
    setIsBidding(false);
    setBidAmount('');
  };

  const handleDeleteBet = (bidId: string, amount: number) => {
    showConfirm(
      'Delete Bet',
      'Are you sure you want to delete this bet? This will reduce the total valuation.',
      async () => {
        const { error } = await supabase.from('bids').delete().eq('id', bidId);
        if (!error) {
          if (racer) {
            await supabase.from('racers')
              .update({ current_bid: Math.max(0, racer.current_bid - amount) })
              .eq('id', id);
          }
          
          await supabase.from('audit_logs').insert([{
            user_id: userId,
            action: 'DELETE_BET',
            details: `Deleted bet of $${amount} on racer ${racer?.name} (ID: ${id})`
          }]);
          window.location.reload();
        } else {
          console.error('Delete error:', error);
          showError('Delete Failed', error.message);
        }
      }
    );
  };

  const handleClearAllBets = () => {
    showConfirm(
      'Clear All Bets',
      'Are you sure you want to clear ALL bets for this entity? This will permanently delete the betting history and reset the valuation to $0.',
      async () => {
        const { error } = await supabase.from('bids').delete().eq('racer_id', id);
        if (!error) {
          await supabase.from('racers')
            .update({ current_bid: 0 })
            .eq('id', id);
            
          await supabase.from('audit_logs').insert([{
            user_id: userId,
            action: 'CLEAR_BETS',
            details: `Cleared all bets and reset valuation for racer ${racer?.name} (ID: ${id})`
          }]);
          window.location.reload();
        } else {
          console.error('Clear bets error:', error);
          showError('Clear Failed', error.message);
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
          DECRYPTING ENTITY STATS...
        </p>
      </div>
    );
  }

  if (!racer) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-mono" style={{ color: 'var(--text-muted)' }}>ENTITY NOT FOUND</p>
      </div>
    );
  }

  const racesDriven = racer.races || 0;
  const winRate = racer.win_rate || 0;
  const wins = racer.wins || 0;
  const avgPos = racer.avg_pos || 0;
  const totalBids = bids.length;

  return (
    <main style={{ paddingBottom: '4rem' }}>
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
             <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBET.</h1>
           </div>
        </Link>
        <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
          <Link href="/teams" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>TEAMS</Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>DRIVERS</Link>
          <Link href="#" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RULES</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {(role === 'management' || role === 'admin') && (
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
            <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : role === 'management' ? 'var(--accent-secondary)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              OP: {role || 'UNKNOWN'}
            </span>
          </div>
          <button className="btn-secondary" onClick={() => router.push('/profile')} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderColor: 'var(--accent-primary)', color: '#fff' }}>
            PROFILE
          </button>
          {role === 'admin' && (
            <button className="btn-secondary" onClick={() => setIsEditing(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderColor: '#ff2a2a', color: '#ff2a2a' }}>
              EDIT ENTITY
            </button>
          )}
          <button className="btn-secondary" onClick={() => router.back()} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
            &lt; RETURN TO GRID
          </button>
        </div>
      </header>

      <div className="container" style={{ marginTop: '3rem' }}>
        
        {/* Profile Header */}
        <div className="glass-panel animate-in" style={{ padding: '3rem', marginBottom: '3rem', display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {racer.logo_url && (
              <img src={racer.logo_url} alt={racer.name} style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            )}
            <div>
              <span className="text-mono" style={{ color: 'var(--accent-primary)', letterSpacing: '2px', fontSize: '0.85rem' }}>
                ENTITY_ID: {racer.id.split('-')[0].toUpperCase()}
              </span>
              <h1 className="title-gradient" style={{ fontSize: '4rem', textTransform: 'uppercase', margin: '0.5rem 0' }}>
                {racer.name}
              </h1>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span className="text-mono" style={{ 
                  background: racer.type === 'TEAM' ? 'rgba(255,255,255,0.1)' : 'rgba(242, 24, 24, 0.2)',
                  color: racer.type === 'TEAM' ? '#fff' : 'var(--accent-secondary)',
                  border: `1px solid ${racer.type === 'TEAM' ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)'}`,
                  padding: '0.5rem 1rem', 
                  fontSize: '0.85rem', 
                  fontWeight: 700 
                }}>
                  {racer.type === 'TEAM' ? 'TEAM' : (racer.type === 'INDIVIDUAL' ? '' : `${racer.type} `)}{racer.type !== 'TEAM' ? (racer.racer_role || 'RACER') : ''}
                </span>
                
                {racer.displayTeam && racer.type !== 'TEAM' && (
                  <span className="text-mono" style={{ 
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.5rem 1rem', 
                    fontSize: '0.85rem', 
                    fontWeight: 700 
                  }}>
                    TEAM: {racer.displayTeam}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)' }}>CURRENT VALUATION</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '2rem' }}>$</span>
              <p className="bid-amount" style={{ fontSize: '4rem' }}>{racer.current_bid.toLocaleString()}</p>
            </div>
            {(() => {
              const isWindowOpen = racer.type === 'TEAM' ? isTeamBettingOpen : racer.type?.startsWith('MONTHLY') ? isMonthlyBettingOpen : isIndBettingOpen;
              const canBet = isWindowOpen || role === 'admin';
              
              return (
                <button 
                  className={canBet ? "btn-primary" : "btn-secondary"}
                  style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'space-between', padding: '1rem', opacity: canBet ? 1 : 0.5 }}
                  disabled={!canBet}
                  onClick={() => {
                    setBidAmount('');
                    setIsBidding(true);
                  }}
                >
                  <span>{canBet ? 'PLACE BET' : 'BETS CLOSED'}</span>
                  <span className="text-mono">&gt;</span>
                </button>
              );
            })()}
          </div>
        </div>

        {/* Captain Profile (If exists) & Team Roster */}
        {(racer.captain_name || racer.captain_image_url) && (
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
            
            {/* Captain Card */}
            <div className="glass-panel animate-in" style={{ flex: '1.5', minWidth: '450px', padding: '0', display: 'flex', overflow: 'hidden', border: '1px solid var(--accent-primary)', flexDirection: 'row', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '250px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {racer.captain_image_url ? (
                  <img src={racer.captain_image_url} alt={racer.captain_name} style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '400px' }} />
                ) : (
                  <div style={{ width: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>NO IMAGE</div>
                )}
              </div>
              <div style={{ flex: '1', minWidth: '250px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span className="text-mono" style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--accent-primary)', color: '#fff', fontSize: '0.75rem', display: 'inline-block', marginBottom: '1rem', width: 'fit-content' }}>
                  {racer.type === 'TEAM' ? 'TEAM FRANCHISE' : (racer.racer_role || 'RACER')} / 01
                </span>
                <h2 className="title-gradient" style={{ fontSize: '3rem', fontStyle: 'italic', textTransform: 'uppercase', marginBottom: '2rem' }}>
                  {racer.type === 'TEAM' ? (racer.captain_name || 'NO CAPTAIN') : (racer.displayTeam || 'FREE AGENT')}
                </h2>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>CATEGORY</span>
                  <span className="text-mono" style={{ color: '#fff', fontWeight: 'bold' }}>{racer.type === 'TEAM' ? 'FRANCHISE CAPTAIN' : 'CONTRACTED DRIVER'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                  <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ACQUISITION</span>
                  <span className="text-mono" style={{ color: '#fff', fontWeight: 'bold' }}>
                    ${racer.type === 'TEAM' && racer.captain_name ? ((individuals.find(d => d.name === racer.captain_name)?.acquisition || 0).toLocaleString()) : (racer.acquisition || 0).toLocaleString()}
                  </span>
                </div>

                <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginBottom: '1rem', display: 'block' }}>OVERALL TELEMETRY</span>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>RACES</span>
                      <span className="text-mono" style={{ color: '#fff' }}>{racer.type === 'TEAM' && racer.captain_name ? (individuals.find(d => d.name === racer.captain_name)?.races || 0) : racesDriven}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--accent-primary)', paddingBottom: '0.5rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>WIN RATE</span>
                      <span className="text-mono" style={{ color: '#fff' }}>{racer.type === 'TEAM' && racer.captain_name ? (individuals.find(d => d.name === racer.captain_name)?.win_rate || 0) : winRate}%</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>WINS</span>
                      <span className="text-mono" style={{ color: '#fff' }}>{racer.type === 'TEAM' && racer.captain_name ? (individuals.find(d => d.name === racer.captain_name)?.wins || 0) : wins}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--accent-primary)', paddingBottom: '0.5rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>AVG POS</span>
                      <span className="text-mono" style={{ color: '#fff' }}>{racer.type === 'TEAM' && racer.captain_name ? (individuals.find(d => d.name === racer.captain_name)?.avg_pos || 0) : avgPos}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Team Roster */}
            <div className="glass-panel animate-in stagger-1" style={{ flex: '1', minWidth: '350px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
                <h3 className="title-gradient" style={{ fontSize: '1.5rem', fontStyle: 'italic', textTransform: 'uppercase' }}>TEAM ROSTER</h3>
                <span className="text-mono" style={{ color: 'var(--text-muted)' }}>01/06 <span style={{ fontSize: '0.65rem' }}>DRIVERS</span></span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem' }}>
                {/* Slot 1: Captain */}
                <div 
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--accent-primary)', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', cursor: racer.captain_name ? 'pointer' : 'default', transition: 'all 0.2s' }}
                  onClick={() => {
                    if (racer.captain_name) {
                      const cId = individuals.find(d => d.name === racer.captain_name)?.id;
                      if (cId) router.push(`/racer/${cId}`);
                    }
                  }}
                  onMouseEnter={(e) => { if (racer.captain_name) e.currentTarget.style.background = 'rgba(242, 24, 24, 0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                >
                  <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>01</span>
                  <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center', padding: '0 0.25rem' }}>{racer.captain_name || 'CAPTAIN'}</span>
                </div>
                
                {/* Slots 2-6: Dynamic Roster */}
                {[2, 3, 4, 5, 6].map((num, idx) => {
                  const driverName = (racer.roster && racer.roster[idx]) ? racer.roster[idx] : null;
                  const driverId = driverName ? individuals.find(d => d.name === driverName)?.id : null;
                  return (
                    <div 
                      key={num} 
                      style={{ background: 'rgba(255,255,255,0.02)', border: driverName ? '1px solid rgba(255,255,255,0.3)' : '1px dashed rgba(255,255,255,0.1)', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', cursor: driverId ? 'pointer' : 'default', transition: 'all 0.2s' }}
                      onClick={() => {
                        if (driverId) router.push(`/racer/${driverId}`);
                      }}
                      onMouseEnter={(e) => { if (driverId) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    >
                      <span className="text-mono" style={{ color: driverName ? '#fff' : 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>0{num}</span>
                      <span className="text-mono" style={{ color: driverName ? '#fff' : 'rgba(255,255,255,0.1)', fontSize: '0.85rem', fontWeight: driverName ? 'bold' : 'normal', textAlign: 'center', padding: '0 0.25rem' }}>
                        {driverName || 'EMPTY'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }} className="animate-in stagger-1">
          {[
            { label: 'RACES', value: racesDriven, accent: '#ffb300' },
            { label: 'WINS', value: wins, accent: '#00e5ff' },
            { label: 'WIN RATE', value: `${winRate}%`, accent: '#f21818' },
            { label: 'AVG POS', value: avgPos, accent: '#b000ff' },
            { label: 'TOTAL BETS', value: totalBids, accent: '#00ff88' },
            ...(racer.type !== 'TEAM' ? [{ label: 'ACQUISITION', value: `$${(racer.acquisition || 0).toLocaleString()}`, accent: '#ffffff' }] : [])
          ].map((stat) => (
            <div 
              key={stat.label}
              style={{ 
                background: 'linear-gradient(145deg, rgba(20,20,20,0.8) 0%, rgba(5,5,5,0.9) 100%)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '2.5rem 1.5rem',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px)';
                e.currentTarget.style.borderColor = stat.accent;
                e.currentTarget.style.boxShadow = `0 15px 30px ${stat.accent}20, inset 0 0 20px ${stat.accent}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
              }}
            >
              {/* Background watermark number */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '8rem',
                fontWeight: 900,
                color: 'rgba(255,255,255,0.02)',
                zIndex: 0,
                pointerEvents: 'none',
                fontStyle: 'italic',
                whiteSpace: 'nowrap'
              }}>
                {stat.value}
              </div>
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${stat.accent}, transparent)`, opacity: 0.5 }}></div>

              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '3px', marginBottom: '1rem', zIndex: 1 }}>{stat.label}</span>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', zIndex: 1 }}>
                <span style={{ 
                  fontSize: '3.5rem', 
                  fontWeight: 900, 
                  lineHeight: 1,
                  background: `linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: `drop-shadow(0 0 10px ${stat.accent}40)`
                }}>
                  {stat.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Betting Trend Graph */}
        {bids.length > 0 && (
          <div className="glass-panel animate-in stagger-2" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 className="title-gradient" style={{ fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '1.5rem' }}>BETTING TREND</h2>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...bids].reverse().reduce((acc, bid) => {
                  const lastVal = acc.length > 0 ? acc[acc.length - 1].valuation : 0;
                  acc.push({
                    name: new Date(bid.created_at).toLocaleDateString(),
                    valuation: lastVal + bid.amount
                  });
                  return acc;
                }, [] as any[])} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValuation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f21818" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f21818" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" style={{ fontSize: '0.75rem' }} />
                  <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize: '0.75rem' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="valuation" stroke="#f21818" fillOpacity={1} fill="url(#colorValuation)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bid History */}
        <div className="glass-panel animate-in stagger-2" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="title-gradient" style={{ fontSize: '1.5rem', textTransform: 'uppercase', margin: 0 }}>BETTING HISTORY</h2>
            {role === 'admin' && bids.length > 0 && (
              <button 
                onClick={handleClearAllBets}
                className="text-mono"
                style={{ background: 'rgba(242,24,24,0.1)', border: '1px solid #f21818', color: '#f21818', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
              >
                CLEAR ALL BETS
              </button>
            )}
          </div>
          
          {bids.length === 0 ? (
            <p className="text-mono" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              NO BETS RECORDED FOR THIS ENTITY.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>TIMESTAMP</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>BETTOR NAME | CID</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>RACE</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>AMOUNT</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>PROFIT / LOSS</th>
                  {(role === 'admin' || role === 'management') && (
                    <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>ACTION</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {bids.map((bid) => (
                  <tr key={bid.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="text-mono" style={{ padding: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(bid.created_at).toLocaleString()}
                    </td>
                    <td className="text-mono" style={{ padding: '1rem', color: '#fff', fontWeight: 'bold' }}>
                      {bid.bidder_name || bid.profiles?.login_id || 'Unknown'}
                    </td>
                    <td className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      {bid.round_id ? `RACE ${bid.round_id}` : '—'}
                    </td>
                    <td className="text-mono" style={{ padding: '1rem', fontSize: '1.25rem', color: 'var(--accent-secondary)', textAlign: 'right', fontWeight: 900 }}>
                      ${bid.amount.toLocaleString()}
                    </td>
                    {(() => {
                      const profit = bid.result === 'WON' ? (bid.payout || 0) - bid.amount : bid.result === 'LOST' ? -bid.amount : 0;
                      return (
                        <td className="text-mono" style={{ 
                          padding: '1rem', 
                          fontSize: '1.25rem', 
                          color: profit > 0 ? '#00ff88' : profit < 0 ? '#ff4444' : 'var(--text-muted)', 
                          textAlign: 'right', 
                          fontWeight: 900 
                        }}>
                          {bid.result === 'PENDING' || !bid.result ? '—' : `${profit > 0 ? '+' : ''}$${profit.toLocaleString()}`}
                        </td>
                      );
                    })()}
                    {(role === 'admin' || role === 'management') && (
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteBet(bid.id, bid.amount)}
                          style={{ background: 'transparent', border: '1px solid #f21818', color: '#f21818', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                        >
                          DELETE
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>SYSTEM CONFIG // {racer.name}</h2>
            
            <form onSubmit={handleUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '3rem', marginBottom: '3rem' }}>
                
                {/* Column 1: Primary Entity Data */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 className="text-mono" style={{ color: 'var(--accent-primary)' }}>[ PRIMARY DATA ]</h3>
                  
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>ENTITY_NAME</label>
                    <input type="text" className="input-base" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>RACER CLASS</label>
                    <select className="input-base" value={editType} onChange={e => setEditType(e.target.value)} style={{ appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}>
                      <option value="S">CLASS S</option>
                      <option value="X">CLASS X</option>
                      <option value="A">CLASS A</option>
                      <option value="B">CLASS B</option>
                      <option value="C">CLASS C</option>
                      <option value="TEAM">TEAM FRANCHISE</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>LOGO_URL (OPTIONAL)</label>
                    <input type="text" className="input-base" value={editLogoUrl} onChange={e => setEditLogoUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  
                  {editType !== 'TEAM' && (
                    <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                      <div>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>RACER ROLE</label>
                        <select className="input-base" value={editRacerRole} onChange={e => setEditRacerRole(e.target.value)} style={{ appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', width: '100%' }}>
                          <option value="RACER">RACER</option>
                          <option value="CAPTAIN">CAPTAIN</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>TEAM ASSIGNMENT</label>
                        <select className="input-base" value={editTeamName} onChange={e => setEditTeamName(e.target.value)} style={{ appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', width: '100%' }}>
                          <option value="">-- FREE AGENT --</option>
                          {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  
                  {editType === 'TEAM' && (
                    <div style={{ padding: '1.5rem', border: '1px dashed var(--accent-primary)', background: 'rgba(242, 24, 24, 0.05)', marginTop: '1rem' }}>
                       <h4 className="text-mono" style={{ color: '#fff', marginBottom: '1rem' }}>CAPTAIN OVERRIDE</h4>
                       
                       <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>SELECT CAPTAIN</label>
                       <select className="input-base" value={editCaptainName} onChange={e => setEditCaptainName(e.target.value)} style={{ marginBottom: '1rem', appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', width: '100%' }}>
                         <option value="">-- NO CAPTAIN ASSIGNED --</option>
                         {individuals.map(ind => <option key={ind.id} value={ind.name}>{ind.name}</option>)}
                       </select>

                       <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>CAPTAIN_IMAGE_URL</label>
                       <input type="text" className="input-base" value={editCaptainImageUrl} onChange={e => setEditCaptainImageUrl(e.target.value)} placeholder="https://..." style={{ width: '100%' }} />
                    </div>
                  )}

                  {/* Telemetry Configuration (Visible for Individual/Team) */}
                  <div style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', marginTop: '1rem' }}>
                    <h4 className="text-mono" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>[ TELEMETRY CONFIG ]</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>RACES COMPLETED</label>
                        <input type="number" className="input-base" value={editRaces} onChange={e => setEditRaces(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>TOTAL WINS</label>
                        <input type="number" className="input-base" value={editWins} onChange={e => setEditWins(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>WIN RATE (%)</label>
                        <input type="number" step="0.1" className="input-base" value={editWinRate} onChange={e => setEditWinRate(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>AVERAGE POSITION</label>
                        <input type="number" step="0.1" className="input-base" value={editAvgPos} onChange={e => setEditAvgPos(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>ACQUISITION COST ($)</label>
                        <input type="number" className="input-base" value={editAcquisition} onChange={e => setEditAcquisition(Number(e.target.value))} style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Roster (Only if Team) */}
                {editType === 'TEAM' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 className="text-mono" style={{ color: 'var(--accent-primary)' }}>[ SQUAD ROSTER ]</h3>
                    
                    {[2, 3, 4, 5, 6].map((num, idx) => (
                      <div key={num} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem' }}>
                        <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', display: 'block' }}>SLOT 0{num}</label>
                        <select 
                          className="input-base" 
                          value={editRoster[idx]}
                          onChange={e => {
                            const newRoster = [...editRoster];
                            newRoster[idx] = e.target.value;
                            setEditRoster(newRoster);
                          }}
                          style={{ appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                        >
                          <option value="">-- EMPTY SLOT --</option>
                          {individuals.map(ind => (
                            <option key={ind.id} value={ind.name}>{ind.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1rem' }}>COMMIT SYSTEM CHANGES</button>
                <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>ABORT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place Bid Modal */}
      {isBidding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-in" style={{ padding: '3rem', width: '90%', maxWidth: '500px', border: '1px solid var(--accent-primary)' }}>
            <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '2rem', textTransform: 'uppercase' }}>LOG WINNING BET</h2>
            
            <form onSubmit={handleBid} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>BET AMOUNT ($)</label>
                <input 
                  type="number" 
                  className="input-base" 
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter winning bet..."
                  style={{ width: '100%' }}
                  required
                  autoFocus
                />
              </div>

              {(role === 'admin' || role === 'management') && (
                <>
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>BETTOR NAME</label>
                    <input 
                      type="text" 
                      className="input-base" 
                      value={bettorName}
                      onChange={(e) => setBettorName(e.target.value)}
                      placeholder="Enter bettor's name..."
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>CID</label>
                    <input 
                      type="text" 
                      className="input-base" 
                      value={cid}
                      onChange={(e) => setCid(e.target.value)}
                      placeholder="Enter CID..."
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>IMAGE LINK (RECEIPT)</label>
                    <input 
                      type="url" 
                      className="input-base" 
                      value={imageLink}
                      onChange={(e) => setImageLink(e.target.value)}
                      placeholder="https://..."
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsBidding(false)}>CANCEL</button>
                <button type="submit" className="btn-primary">CONFIRM BET</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
