'use client';
import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  tournament_races?: number;
  tournament_wins?: number;
  tournament_win_rate?: number;
  tournament_avg_pos?: number;
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
  const searchParams = useSearchParams();
  const isStream = searchParams?.get('stream') === 'true';
  const isDirector = searchParams?.get('director') === 'true';
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
  
  const [editTournamentRaces, setEditTournamentRaces] = useState<number>(0);
  const [editTournamentWins, setEditTournamentWins] = useState<number>(0);
  const [editTournamentWinRate, setEditTournamentWinRate] = useState<number>(0);
  const [editTournamentAvgPos, setEditTournamentAvgPos] = useState<number>(0);
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
  const [positionPrediction, setPositionPrediction] = useState<string>('');
  const [isTeamBettingOpen, setIsTeamBettingOpen] = useState(false);
  const [isIndBettingOpen, setIsIndBettingOpen] = useState(false);
  const [isMonthlyBettingOpen, setIsMonthlyBettingOpen] = useState(false);
  const [selectedRosterSlot, setSelectedRosterSlot] = useState<number>(0);
  const [betReceipt, setBetReceipt] = useState<{ id: string, status: string, amount: number } | null>(null);

  useEffect(() => {
    const handleTeamBetStatus = (e: any) => setIsTeamBettingOpen(e.detail);
    const handleIndBetStatus = (e: any) => setIsIndBettingOpen(e.detail);
    const handleMonthlyBetStatus = (e: any) => setIsMonthlyBettingOpen(e.detail);
    
    window.addEventListener('team-betting-status', handleTeamBetStatus);
    window.addEventListener('ind-betting-status', handleIndBetStatus);
    window.addEventListener('monthly-betting-status', handleMonthlyBetStatus);
    
    // SCROLL SYNC LOGIC
    let scrollSyncChannel: any = null;
    let throttleTimer: any = null;
    let scrollListener: any = null;

    if (isStream) {
      if (isDirector) {
        // Director Panel sends scroll position
        scrollListener = () => {
          if (throttleTimer) return;
          throttleTimer = setTimeout(() => {
            const y = window.scrollY;
            supabase.channel('profile-scroll-sync').send({
              type: 'broadcast',
              event: 'scroll',
              payload: { y, id: id }
            });
            throttleTimer = null;
          }, 30);
        };
        window.addEventListener('scroll', scrollListener);
      } else {
        // OBS Streamer View receives scroll position
        scrollSyncChannel = supabase.channel('profile-scroll-sync')
          .on('broadcast', { event: 'scroll' }, (payload) => {
            if (payload.payload.id === id) {
              window.scrollTo({ top: payload.payload.y, behavior: 'instant' });
            }
          })
          .subscribe();
      }
    }

    return () => {
      window.removeEventListener('team-betting-status', handleTeamBetStatus);
      window.removeEventListener('ind-betting-status', handleIndBetStatus);
      window.removeEventListener('monthly-betting-status', handleMonthlyBetStatus);
      if (scrollListener) window.removeEventListener('scroll', scrollListener);
      if (scrollSyncChannel) supabase.removeChannel(scrollSyncChannel);
    };
  }, [id, isStream, isDirector]);

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

        // Fetch Results to compute Tournament Telemetry dynamically
        const { data: resultsData } = await supabase
          .from('results')
          .select('position, is_dnf, is_dsq')
          .eq('racer_id', id);

        if (resultsData) {
          const tRaces = resultsData.length;
          const tWins = resultsData.filter(r => r.position === 1 && !r.is_dnf && !r.is_dsq).length;
          const tWinRate = tRaces > 0 ? Math.round((tWins / tRaces) * 100) : 0;
          
          let sumPos = 0;
          let validPosCount = 0;
          resultsData.forEach(r => {
            if (!r.is_dnf && !r.is_dsq && r.position > 0) {
              sumPos += r.position;
              validPosCount++;
            }
          });
          const tAvgPos = validPosCount > 0 ? Math.round(sumPos / validPosCount) : 0;

          racerData.tournament_races = tRaces;
          racerData.tournament_wins = tWins;
          racerData.tournament_win_rate = tWinRate;
          racerData.tournament_avg_pos = tAvgPos;
          
          // Auto-sync back to db
          await supabase.from('racers').update({
            tournament_races: tRaces,
            tournament_wins: tWins,
            tournament_win_rate: tWinRate,
            tournament_avg_pos: tAvgPos
          }).eq('id', id);
        }

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
        
        setEditTournamentRaces(racerData.tournament_races || 0);
        setEditTournamentWins(racerData.tournament_wins || 0);
        setEditTournamentWinRate(racerData.tournament_win_rate || 0);
        setEditTournamentAvgPos(racerData.tournament_avg_pos || 0);
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
    const minBet = racer.type === 'TEAM' ? (raceInfo?.team_min_bet || 0) : (raceInfo?.racer_min_bet || 0);

    if (amount < minBet) {
      showError('Invalid Bet', `Bet amount must be at least $${minBet} for this participant.`);
      return;
    }

    const finalBettorName = (role === 'admin' || role === 'agent' || role === 'management') ? (bettorName || loginId) : loginId;
    const finalCid = (role === 'admin' || role === 'agent' || role === 'management') ? cid : null;

    const receiptId = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: bidError } = await supabase.from('bids').insert([
      { 
        racer_id: id, 
        user_id: userId, 
        amount, 
        bidder_name: loginId, 
        cid: finalCid,
        status: isViewer ? 'PENDING' : 'APPROVED',
        round_id: roundId,
        position_prediction: positionPrediction
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
          details: `${loginId} placed an approved bet of $${amount} on ${racer.name} (ID: ${id}) [Receipt: ${receiptId}]`
        }]);
        
        setBetReceipt({ id: receiptId, status: 'APPROVED', amount });
      } else {
        await supabase.from('audit_logs').insert([{
          user_id: userId,
          action: 'PENDING_BID',
          details: `${loginId} submitted a pending bet of $${amount} on ${racer.name} (ID: ${id}) [Receipt: ${receiptId}]`
        }]);
        
        setBetReceipt({ id: receiptId, status: 'PENDING', amount });
      }
    } else {
      console.error('Bet error:', bidError);
      showError('Transaction Failed', bidError.message);
    }
    
    setIsBidding(false);
    setBidAmount('');
    setPositionPrediction('');
  };

  const handleDeleteBet = (bidId: string, amount: number) => {
    showConfirm(
      'Delete Bet',
      'Are you sure you want to delete this bet? This will reduce the total valuation.',
      async () => {
        const { error } = await supabase.from('bids').update({ result: 'REFUNDED' }).eq('id', bidId);
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
        const { error } = await supabase.from('bids').update({ result: 'REFUNDED' }).eq('racer_id', id).eq('result', 'PENDING');
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

  const isTeam = racer.type === 'TEAM';

  let racesDriven = racer.races || 0;
  let winRate = racer.win_rate || 0;
  let wins = racer.wins || 0;
  let avgPos = racer.avg_pos || 0;
  
  let tournamentRaces = racer.tournament_races || 0;
  let tournamentWinRate = racer.tournament_win_rate || 0;
  let tournamentWins = racer.tournament_wins || 0;
  let tournamentAvgPos = racer.tournament_avg_pos || 0;

  if (isTeam) {
    const teamMembers = individuals.filter(d => 
      d.team_name === racer.name || 
      d.name === racer.captain_name || 
      (racer.roster && racer.roster.includes(d.name))
    );
    
    // De-duplicate team members just in case
    const uniqueTeamMembers = Array.from(new Map(teamMembers.map(m => [m.id, m])).values());
    
    if (uniqueTeamMembers.length > 0) {
      wins = uniqueTeamMembers.reduce((sum, member) => sum + (member.wins || 0), 0) + (racer.wins || 0);
      racesDriven = uniqueTeamMembers.reduce((sum, member) => sum + (member.races || 0), 0) + (racer.races || 0);
      winRate = racesDriven > 0 ? Math.round((wins / racesDriven) * 100) : 0;
      
      const membersWithPos = uniqueTeamMembers.filter(m => m.avg_pos > 0);
      if (membersWithPos.length > 0) {
        const totalAvgPos = membersWithPos.reduce((sum, member) => sum + member.avg_pos, 0);
        avgPos = Math.round(totalAvgPos / membersWithPos.length);
      }
      
      tournamentWins = uniqueTeamMembers.reduce((sum, member) => sum + (member.tournament_wins || 0), 0) + (racer.tournament_wins || 0);
      tournamentRaces = uniqueTeamMembers.reduce((sum, member) => sum + (member.tournament_races || 0), 0) + (racer.tournament_races || 0);
      tournamentWinRate = tournamentRaces > 0 ? Math.round((tournamentWins / tournamentRaces) * 100) : 0;
      
      const tMembersWithPos = uniqueTeamMembers.filter(m => (m.tournament_avg_pos || 0) > 0);
      if (tMembersWithPos.length > 0) {
        const tTotalAvgPos = tMembersWithPos.reduce((sum, member) => sum + (member.tournament_avg_pos || 0), 0);
        tournamentAvgPos = Math.round(tTotalAvgPos / tMembersWithPos.length);
      }
    }
  }
  const totalBids = bids.length;
  
  const completedBids = bids.filter(b => b.result === 'WON' || b.result === 'LOST');
  const totalInvested = completedBids.reduce((sum, b) => sum + b.amount, 0);
  const totalPayout = completedBids.reduce((sum, b) => sum + (b.payout || 0), 0);
  const bettorNetProfit = totalPayout - totalInvested;

  // Calculate dynamic roster (fill empty slots with individuals assigned to this team)
  const dynamicRoster = ['', '', '', '', ''];
  if (isTeam) {
    const autoAssignedDrivers = individuals.filter(d => d.team_name === racer.name && d.name !== racer.captain_name);
    let autoIndex = 0;
    for (let i = 0; i < 5; i++) {
      if (racer.roster && racer.roster[i]) {
        dynamicRoster[i] = racer.roster[i];
      } else {
        while (autoIndex < autoAssignedDrivers.length) {
          const candidate = autoAssignedDrivers[autoIndex].name;
          autoIndex++;
          if (!racer.roster?.includes(candidate)) {
            dynamicRoster[i] = candidate;
            break;
          }
        }
      }
    }
  }

  let teamAmountLeft: number | null = null;
  if (isTeam) {
    let totalAcq = 0;
    if (racer.captain_name) {
      const cap = individuals.find(d => d.name === racer.captain_name);
      if (cap && cap.acquisition) totalAcq += cap.acquisition;
    }
    dynamicRoster.forEach(name => {
      if (name) {
        const ind = individuals.find(d => d.name === name);
        if (ind && ind.acquisition) totalAcq += ind.acquisition;
      }
    });
    teamAmountLeft = 1500000 - totalAcq;
  }

  let activeMemberName = isTeam ? racer.captain_name || 'NO CAPTAIN' : racer.displayTeam || 'FREE AGENT';
  let activeMemberImage = racer.captain_image_url;
  let activeMemberCategory = isTeam ? 'FRANCHISE CAPTAIN' : 'CONTRACTED RACER';
  
  let activeMemberAcq = racer.acquisition || 0;
  let activeMemberRaces = racer.races || 0;
  let activeMemberWinRate = racer.win_rate || 0;
  let activeMemberWins = racer.wins || 0;
  let activeMemberAvgPos = racer.avg_pos || 0;

  if (isTeam && selectedRosterSlot === 0 && racer.captain_name) {
    const captainObj = individuals.find(d => d.name === racer.captain_name);
    if (captainObj) {
      activeMemberAcq = captainObj.acquisition || 0;
      activeMemberRaces = captainObj.races || 0;
      activeMemberWinRate = captainObj.win_rate || 0;
      activeMemberWins = captainObj.wins || 0;
      activeMemberAvgPos = captainObj.avg_pos || 0;
    }
  } else if (isTeam && selectedRosterSlot > 0) {
    const driverName = dynamicRoster[selectedRosterSlot - 1];
    if (driverName) {
      const driverObj = individuals.find(d => d.name === driverName);
      activeMemberName = driverName;
      activeMemberImage = driverObj?.logo_url || '';
      activeMemberCategory = 'CONTRACTED RACER';
      activeMemberAcq = driverObj?.acquisition || 0;
      activeMemberRaces = driverObj?.races || 0;
      activeMemberWinRate = driverObj?.win_rate || 0;
      activeMemberWins = driverObj?.wins || 0;
      activeMemberAvgPos = driverObj?.avg_pos || 0;
    } else {
      activeMemberName = 'EMPTY SLOT';
      activeMemberImage = '';
      activeMemberCategory = 'UNASSIGNED';
      activeMemberAcq = 0;
      activeMemberRaces = 0;
      activeMemberWinRate = 0;
      activeMemberWins = 0;
      activeMemberAvgPos = 0;
    }
  }

  return (
    <main style={{ paddingBottom: isStream ? '0' : '4rem', overflow: isStream && !isDirector ? 'hidden' : 'auto' }}>
      <style>{isStream && !isDirector ? `::-webkit-scrollbar { display: none; }` : ''}</style>
      {!isStream && (
        <header className="glass-header">
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
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
              <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : (role === 'agent' || role === 'management') ? 'var(--accent-secondary)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                OP: {role || 'UNKNOWN'}
              </span>
            </div>
            <button className="btn-secondary" onClick={() => router.push('/profile')} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderColor: 'var(--accent-primary)', color: '#fff' }}>
              PROFILE
            </button>
            <button className="btn-secondary" onClick={() => router.back()} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
              &lt; RETURN TO GRID
            </button>
          </div>
        </header>
      )}

      <div className={isStream ? "" : "container"} style={{ marginTop: isStream ? '1rem' : '3rem', padding: isStream ? '0' : undefined }}>
        
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

                {role === 'admin' && !isStream && (
                  <button className="btn-secondary" onClick={() => setIsEditing(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderColor: '#ff2a2a', color: '#ff2a2a', marginLeft: '0.5rem' }}>
                    EDIT ENTITY
                  </button>
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
            {teamAmountLeft !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px' }}>AMOUNT LEFT</span>
                <span className="text-mono" style={{ color: teamAmountLeft >= 0 ? '#00ff88' : '#ff2a2a', fontSize: '1.25rem', fontWeight: 700, padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {teamAmountLeft < 0 ? '-' : ''}${Math.abs(teamAmountLeft).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Captain Profile (If exists) & Team Roster */}
        {(racer.captain_name || racer.captain_image_url) && (
          <div style={{ display: 'flex', gap: '2rem', flexDirection: 'column', marginBottom: '3rem' }}>
            
            {/* Captain Card (Now Landscape) */}
            <div className="glass-panel animate-in" style={{ width: '100%', minHeight: '400px', padding: '0', display: 'flex', overflow: 'hidden', border: '1px solid var(--accent-primary)', position: 'relative', background: '#0a0a0a' }}>
              
              {/* Left Side Image with Mask Fade */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '60%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
                {activeMemberImage ? (
                  <img 
                    src={activeMemberImage} 
                    alt={activeMemberName} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover', 
                      objectPosition: 'center 20%',
                      maskImage: 'linear-gradient(to right, black 20%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to right, black 20%, transparent 100%)'
                    }} 
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>NO IMAGE</div>
                )}
              </div>

              {/* Info Container on the right */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', zIndex: 1 }}>
                <div style={{ width: '65%', minWidth: '400px', padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', opacity: 0.05, pointerEvents: 'none' }}></div>
                
                {/* Background Text Watermark */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
                  <span style={{ fontSize: 'clamp(8rem, 15vw, 15rem)', fontWeight: 900, fontStyle: 'italic', color: 'rgba(255,255,255,0.03)', whiteSpace: 'nowrap', userSelect: 'none', lineHeight: 1 }}>
                    {activeMemberName}
                  </span>
                </div>
                
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="text-mono" style={{ padding: '0.4rem 0.8rem', background: 'rgba(242, 24, 24, 0.1)', border: '1px solid var(--accent-primary)', color: '#fff', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', width: 'fit-content', borderRadius: '4px' }}>
                    <span style={{ width: '6px', height: '6px', background: 'var(--accent-primary)', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 5px var(--accent-primary)' }}></span>
                    {racer.type === 'TEAM' ? 'TEAM FRANCHISE' : (racer.racer_role || 'RACER')} / {selectedRosterSlot < 9 ? '0' : ''}{selectedRosterSlot + 1}
                  </span>
                  
                  <h2 className="title-gradient" style={{ fontSize: '4rem', fontStyle: 'italic', textTransform: 'uppercase', marginBottom: '1rem', lineHeight: 1 }}>
                    {activeMemberName}
                  </h2>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                    <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>CATEGORY</span>
                    <span className="text-mono" style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.85rem' }}>{activeMemberCategory}</span>
                  </div>
                  <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                    <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>ACQUISITION</span>
                    <span className="text-mono" style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '0.85rem' }}>${activeMemberAcq.toLocaleString()}</span>
                  </div>
                </div>

                <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, var(--accent-primary), transparent)' }}></span>
                  OVERALL TELEMETRY
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {[
                    { label: 'RACES', value: activeMemberRaces, accent: '#ffb300', icon: '🏁' },
                    { label: 'WINS', value: activeMemberWins, accent: '#00e5ff', icon: '🏆' },
                    { label: 'WIN RATE', value: `${activeMemberWinRate}%`, accent: '#f21818', icon: '📈' },
                    { label: 'AVG POS', value: activeMemberAvgPos, accent: '#b000ff', icon: '🎯' },
                  ].map((stat, i) => (
                    <div 
                      key={stat.label}
                      style={{ 
                        background: 'rgba(20,20,20,0.5)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                      }}
                      className="hover-card"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = stat.accent;
                        e.currentTarget.style.background = 'rgba(30,30,30,0.8)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.background = 'rgba(20,20,20,0.5)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{stat.label}</span>
                        <span style={{ fontSize: '1.2rem', opacity: 0.7 }}>{stat.icon}</span>
                      </div>
                      <span style={{ 
                        fontSize: '2rem', 
                        fontWeight: 900, 
                        color: '#fff',
                        lineHeight: 1,
                        textShadow: `0 0 10px ${stat.accent}40`
                      }}>
                        {stat.value}
                      </span>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: '30%', background: stat.accent }}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

            {/* Team Roster */}
            <div className="glass-panel animate-in stagger-1" style={{ flex: '1', minWidth: '350px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                <div>
                  <div className="text-mono" style={{ color: '#0066ff', fontSize: '0.65rem', marginBottom: '0.5rem', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    01 <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span> LINE-UP
                  </div>
                  <h3 className="title-gradient" style={{ fontSize: '2rem', fontStyle: 'italic', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>TEAM ROSTER</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div className="text-mono" style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1 }}>
                    <span style={{ color: '#fff' }}>0{(racer.captain_name ? 1 : 0) + dynamicRoster.filter(r => r).length}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>/06</span>
                  </div>
                  <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '2px', marginTop: '0.5rem' }}>DRIVERS</span>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {/* Slot 1: Captain */}
                <div 
                  style={{ position: 'relative', background: selectedRosterSlot === 0 ? 'rgba(242, 24, 24, 0.1)' : 'rgba(25,25,25,0.6)', border: selectedRosterSlot === 0 ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)', height: '280px', display: 'flex', flexDirection: 'column', cursor: racer.captain_name ? 'pointer' : 'default', transition: 'all 0.2s', overflow: 'hidden', borderRadius: '4px' }}
                  onClick={() => {
                    if (racer.captain_name) {
                      setSelectedRosterSlot(0);
                    }
                  }}
                  onMouseEnter={(e) => { if (racer.captain_name && selectedRosterSlot !== 0) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.3)' }}
                  onMouseLeave={(e) => { if (selectedRosterSlot !== 0) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="text-mono" style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, color: selectedRosterSlot === 0 ? 'var(--accent-primary)' : '#fff', fontSize: '0.85rem', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>CAPTAIN</span>
                  
                  {/* Image Section */}
                  <div style={{ height: '70%', width: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {racer.captain_image_url ? (
                      <img src={racer.captain_image_url} alt={racer.captain_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.1)' }}>NO IMAGE</span>
                    )}
                  </div>
                  
                  {/* Info Section */}
                  <div style={{ height: '30%', padding: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(10,10,10,1) 100%)' }}>
                    <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{racer.captain_name || 'CAPTAIN'}</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                        {racer.captain_name ? `${individuals.find(d => d.name === racer.captain_name)?.type || 'FRANCHISE'} TIER` : 'CAPTAIN'}
                      </span>
                      <span className="text-mono" style={{ color: '#0066ff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        ${racer.captain_name ? (individuals.find(d => d.name === racer.captain_name)?.acquisition || 0).toLocaleString() : '0'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Slots 2-6: Dynamic Roster */}
                {[2, 3, 4, 5, 6].map((num, idx) => {
                  const driverName = dynamicRoster[idx] || null;
                  const isSelected = selectedRosterSlot === idx + 1;
                  const driverObj = driverName ? individuals.find(d => d.name === driverName) : null;
                  const driverImg = driverObj?.logo_url;
                  return (
                    <div 
                      key={num} 
                      style={{ position: 'relative', background: isSelected ? 'rgba(242, 24, 24, 0.1)' : 'rgba(25,25,25,0.6)', border: isSelected ? '2px solid var(--accent-primary)' : (driverName ? '1px solid rgba(255,255,255,0.05)' : '1px dashed rgba(255,255,255,0.1)'), height: '280px', display: 'flex', flexDirection: 'column', cursor: driverName ? 'pointer' : 'default', transition: 'all 0.2s', overflow: 'hidden', borderRadius: '4px' }}
                      onClick={() => {
                        if (driverName) {
                          setSelectedRosterSlot(idx + 1);
                        }
                      }}
                      onMouseEnter={(e) => { if (driverName && !isSelected) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.3)' }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.border = driverName ? '1px solid rgba(255,255,255,0.05)' : '1px dashed rgba(255,255,255,0.1)' }}
                    >
                      <span className="text-mono" style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, color: isSelected ? 'var(--accent-primary)' : (driverName ? '#fff' : 'rgba(255,255,255,0.3)'), fontSize: '0.85rem', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{driverObj ? `${driverObj.type} TIER` : `0${num}`}</span>
                      
                      {/* Image Section */}
                      <div style={{ height: '70%', width: '100%', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {driverImg ? (
                          <img src={driverImg} alt={driverName || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.75rem' }}>{driverName ? 'NO IMAGE' : ''}</span>
                        )}
                      </div>
                      
                      {/* Info Section */}
                      <div style={{ height: '30%', padding: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(10,10,10,1) 100%)' }}>
                        <span style={{ color: driverName ? '#fff' : 'rgba(255,255,255,0.2)', fontSize: '1.2rem', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{driverName || 'EMPTY'}</span>
                        {driverName && driverObj ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{driverObj.type} TIER</span>
                            <span className="text-mono" style={{ color: '#0066ff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              ${(driverObj.acquisition || 0).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-mono" style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.65rem' }}>-</span>
                            <span className="text-mono" style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.75rem', fontWeight: 'bold' }}>-</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Telemetry & Financials Bento Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', marginBottom: '4rem' }} className="animate-in stagger-1">
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '3rem' }}>
            {/* Performance Metrics Left */}
            <div>
              <h3 className="text-mono" style={{ color: 'var(--accent-primary)', marginBottom: '1rem', letterSpacing: '2px', fontSize: '0.85rem' }}>[ OVERALL TELEMETRY ]</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {[
                { label: 'RACES', value: racesDriven, accent: '#ffb300', icon: '🏁' },
                { label: 'WINS', value: wins, accent: '#00e5ff', icon: '🏆' },
                { label: 'WIN RATE', value: `${winRate}%`, accent: '#f21818', icon: '📈' },
                { label: 'AVG POS', value: avgPos, accent: '#b000ff', icon: '🎯' },
              ].map((stat, i) => (
              <div 
                key={stat.label}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(20,20,20,0.9) 0%, rgba(5,5,5,1) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '2rem 1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  animationDelay: `${i * 0.1}s`
                }}
                className="hover-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                  e.currentTarget.style.borderColor = stat.accent;
                  e.currentTarget.style.boxShadow = `0 20px 40px ${stat.accent}30, inset 0 0 30px ${stat.accent}10`;
                  const icon = e.currentTarget.querySelector('.stat-icon') as HTMLElement;
                  if (icon) icon.style.transform = 'scale(1.2) rotate(5deg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                  const icon = e.currentTarget.querySelector('.stat-icon') as HTMLElement;
                  if (icon) icon.style.transform = 'scale(1) rotate(0deg)';
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '2px', background: `linear-gradient(90deg, transparent, ${stat.accent}, transparent)`, opacity: 0.8 }}></div>
                
                <span className="stat-icon" style={{ fontSize: '2rem', marginBottom: '1rem', transition: 'transform 0.3s ease', opacity: 0.8 }}>{stat.icon}</span>
                <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '3px', marginBottom: '0.5rem', zIndex: 1, textTransform: 'uppercase' }}>{stat.label}</span>
                
                <span style={{ 
                  fontSize: '3.5rem', 
                  fontWeight: 900, 
                  lineHeight: 1,
                  background: `linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.6) 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: `drop-shadow(0 0 15px ${stat.accent}50)`,
                  zIndex: 1
                }}>
                  {stat.value}
                </span>
                
                {/* Abstract Data Rings */}
                <div style={{ position: 'absolute', right: '-20%', bottom: '-20%', width: '150px', height: '150px', borderRadius: '50%', border: `1px solid ${stat.accent}20`, opacity: 0.5, pointerEvents: 'none' }}></div>
                <div style={{ position: 'absolute', right: '-10%', bottom: '-10%', width: '100px', height: '100px', borderRadius: '50%', border: `1px solid ${stat.accent}40`, opacity: 0.3, pointerEvents: 'none' }}></div>
              </div>
            ))}
            </div>
          </div>

          {/* Performance Metrics Right */}
          <div>
            <h3 className="text-mono" style={{ color: '#00ff88', marginBottom: '1rem', letterSpacing: '2px', fontSize: '0.85rem' }}>[ TOURNAMENT TELEMETRY ]</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {[
                { label: 'T. RACES', value: tournamentRaces, accent: '#ffb300', icon: '🏁' },
                { label: 'T. WINS', value: tournamentWins, accent: '#00e5ff', icon: '🏆' },
                { label: 'T. WIN RATE', value: `${tournamentWinRate}%`, accent: '#f21818', icon: '📈' },
                { label: 'T. AVG POS', value: tournamentAvgPos, accent: '#b000ff', icon: '🎯' },
              ].map((stat, i) => (
                <div 
                  key={stat.label}
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(20,20,20,0.9) 0%, rgba(5,5,5,1) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '2rem 1.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    animationDelay: `${i * 0.1}s`
                  }}
                  className="hover-card"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                    e.currentTarget.style.borderColor = stat.accent;
                    e.currentTarget.style.boxShadow = `0 20px 40px ${stat.accent}30, inset 0 0 30px ${stat.accent}10`;
                    const icon = e.currentTarget.querySelector('.stat-icon') as HTMLElement;
                    if (icon) icon.style.transform = 'scale(1.2) rotate(5deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                    const icon = e.currentTarget.querySelector('.stat-icon') as HTMLElement;
                    if (icon) icon.style.transform = 'scale(1) rotate(0deg)';
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '2px', background: `linear-gradient(90deg, transparent, ${stat.accent}, transparent)`, opacity: 0.8 }}></div>
                  
                  <span className="stat-icon" style={{ fontSize: '2rem', marginBottom: '1rem', transition: 'transform 0.3s ease', opacity: 0.8 }}>{stat.icon}</span>
                  <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '3px', marginBottom: '0.5rem', zIndex: 1, textTransform: 'uppercase' }}>{stat.label}</span>
                  
                  <span style={{ 
                    fontSize: '3.5rem', 
                    fontWeight: 900, 
                    lineHeight: 1,
                    background: `linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.6) 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: `drop-shadow(0 0 15px ${stat.accent}50)`,
                    zIndex: 1
                  }}>
                    {stat.value}
                  </span>
                  
                  {/* Abstract Data Rings */}
                  <div style={{ position: 'absolute', right: '-20%', bottom: '-20%', width: '150px', height: '150px', borderRadius: '50%', border: `1px solid ${stat.accent}20`, opacity: 0.5, pointerEvents: 'none' }}></div>
                  <div style={{ position: 'absolute', right: '-10%', bottom: '-10%', width: '100px', height: '100px', borderRadius: '50%', border: `1px solid ${stat.accent}40`, opacity: 0.3, pointerEvents: 'none' }}></div>
                </div>
              ))}
            </div>
          </div>
          </div>

          {/* Bottom Row: Financial Metrics (Wider blocks) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {[
              { label: 'TOTAL BETS', value: totalBids, accent: '#00ff88', icon: '🎫' },
              { label: 'BETTOR P&L', value: `${bettorNetProfit >= 0 ? '+' : ''}$${bettorNetProfit.toLocaleString()}`, accent: bettorNetProfit >= 0 ? '#00ff88' : '#ff4444', icon: '💰' },
              ...(racer.type !== 'TEAM' ? [{ label: 'ACQUISITION', value: `$${(racer.acquisition || 0).toLocaleString()}`, accent: '#ffffff', icon: '🤝' }] : [])
            ].map((stat, i) => (
              <div 
                key={stat.label}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(25,25,25,0.9) 0%, rgba(10,10,10,1) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '2.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  display: 'flex',
                  flex: '1 1 320px',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  animationDelay: `${(i + 4) * 0.1}s`,
                  containerType: 'inline-size'
                }}
                className="hover-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                  e.currentTarget.style.borderColor = stat.accent;
                  e.currentTarget.style.boxShadow = `0 15px 40px ${stat.accent}20, inset 0 0 40px ${stat.accent}05`;
                  const icon = e.currentTarget.querySelector('.stat-icon-fin') as HTMLElement;
                  if (icon) icon.style.transform = 'rotate(15deg) scale(1.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                  const icon = e.currentTarget.querySelector('.stat-icon-fin') as HTMLElement;
                  if (icon) icon.style.transform = 'rotate(0deg) scale(1)';
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', background: `linear-gradient(180deg, transparent, ${stat.accent}, transparent)`, opacity: 0.8 }}></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1, flex: '1 1 auto', marginRight: '1rem' }}>
                  <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{stat.label}</span>
                  <span style={{ 
                    fontSize: 'clamp(2rem, 5vw, 3rem)',
                    fontWeight: 900, 
                    lineHeight: 1.1,
                    background: `linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.7) 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: `drop-shadow(0 2px 10px ${stat.accent}40)`,
                    whiteSpace: 'nowrap'
                  }}>
                    {stat.value}
                  </span>
                </div>
                
                <div className="stat-icon-fin" style={{ fontSize: '3rem', opacity: 0.8, filter: `drop-shadow(0 0 15px ${stat.accent}50)`, transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', flexShrink: 0 }}>
                  {stat.icon}
                </div>
                
                {/* Cyber grid background layer */}
                <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Betting Trend Graph */}
        {bids.length > 0 && (
          <div className="glass-panel animate-in stagger-2" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 className="title-gradient" style={{ fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '1.5rem' }}>BETTING TREND</h2>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...bids].reverse().reduce((acc, bid) => {
                  const lastVal = acc.length > 0 ? acc[acc.length - 1].valuation : 0;
                  const dateStr = new Date(bid.created_at).toLocaleDateString();
                  acc.push({
                    name: `${bid.round_id ? `${bid.round_id} - ` : ''}${dateStr}`,
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
            {role === 'admin' && bids.length > 0 && !isStream && (
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
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>RACE</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>AMOUNT</th>
                  <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>PROFIT / LOSS</th>
                  {(role === 'admin' || role === 'agent' || role === 'management') && (
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
                          {bid.result === 'PENDING' || !bid.result ? '—' : bid.result === 'REFUNDED' ? 'REFUNDED' : `${profit > 0 ? '+' : ''}$${profit.toLocaleString()}`}
                        </td>
                      );
                    })()}
                    {(role === 'admin' || role === 'agent' || role === 'management') && (
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

                  {/* TOURNAMENT CONFIG HAS BEEN REMOVED (DYNAMICALLY SYNCED WITH RESULTS) */}
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

              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>POSITION PREDICTION</label>
                <select 
                  className="input-base" 
                  value={positionPrediction}
                  onChange={(e) => setPositionPrediction(e.target.value)}
                  style={{ width: '100%', appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                  required
                >
                  <option value="" disabled>-- SELECT POSITION --</option>
                  {(racer?.type === 'TEAM' ? 
                    ['1-3', '4-6', '7-9', '10-13', '13-15'] : 
                    ['1-3', '4-6', '7-10', '11-15', '16-20', '21-25', '26-30', '31-35', '36-40', '41-45']
                  ).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div>
                <label className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>POSITION PREDICTION</label>
                <select 
                  className="input-base" 
                  value={positionPrediction}
                  onChange={(e) => setPositionPrediction(e.target.value)}
                  style={{ width: '100%', appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                  required
                >
                  <option value="" disabled>-- SELECT POSITION --</option>
                  {(racer?.type === 'TEAM' ? 
                    ['1-3', '4-6', '7-9', '10-13', '13-15'] : 
                    ['1-3', '4-6', '7-10', '11-15', '16-20', '21-25', '26-30', '31-35', '36-40', '41-45']
                  ).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {(role === 'admin' || role === 'agent' || role === 'management') && !isStream && (
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

      {/* BET RECEIPT MODAL */}
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
                You placed a bet of <strong style={{ color: '#00ff88' }}>${betReceipt.amount.toLocaleString()}</strong>
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
              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '2px' }}>TICKET ID</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'monospace', color: '#fff', letterSpacing: '8px' }}>
                  {betReceipt.id}
                </span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(betReceipt.id);
                  }}
                  title="Copy Ticket ID"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>

            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1.25rem', fontSize: '1.2rem', marginTop: '1rem' }}
              onClick={() => window.location.reload()}
            >
              DONE
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
