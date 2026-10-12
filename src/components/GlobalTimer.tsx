'use client';
import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useModal } from '@/components/ModalProvider';

export function GlobalTimer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showConfirm, showError, showSuccess } = useModal();
  const [teamEnd, setTeamEnd] = useState<Date | null>(null);
  const [indEnd, setIndEnd] = useState<Date | null>(null);
  const [monthlyEnd, setMonthlyEnd] = useState<Date | null>(null);
  
  const [teamTimeLeft, setTeamTimeLeft] = useState<number>(0);
  const [indTimeLeft, setIndTimeLeft] = useState<number>(0);
  const [monthlyTimeLeft, setMonthlyTimeLeft] = useState<number>(0);
  
  const [role, setRole] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState<string>('');
  const [showWinnerPanel, setShowWinnerPanel] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [winnerInput, setWinnerInput] = useState('');
  const [racerPositions, setRacerPositions] = useState<Record<string, string>>({});
  const [winnerType, setWinnerType] = useState<'TEAM' | 'RACER' | 'MONTHLY'>('TEAM');
  const [winnerOptions, setWinnerOptions] = useState<any[]>([]);
  const [showPostList, setShowPostList] = useState(false);
  const [allRacers, setAllRacers] = useState<any[]>([]);
  const [postListTab, setPostListTab] = useState<'TEAM' | 'RACER' | 'MONTHLY'>('TEAM');
  const [monthlySubTab, setMonthlySubTab] = useState<'TEAM' | 'RACER'>('TEAM');
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [showCreateRacePanel, setShowCreateRacePanel] = useState(false);
  const [raceMode, setRaceMode] = useState<'CREATE'|'START_BIDDING'>('CREATE');
  const [pendingRaces, setPendingRaces] = useState<any[]>([]);
  const [selectedPendingRace, setSelectedPendingRace] = useState<string>('');
  const [raceForm, setRaceForm] = useState<{name: string, track: string, teamTimer: string, racerTimer: string, teamMinBet: string, racerMinBet: string, teams: any[], racers: any[]}>({ name: '', track: '', teamTimer: '', racerTimer: '', teamMinBet: '', racerMinBet: '', teams: [], racers: [] });
  const [showTimersOnStream, setShowTimersOnStream] = useState(true);
  const [teamSelectorSearch, setTeamSelectorSearch] = useState('');
  const [racerSelectorSearch, setRacerSelectorSearch] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile) setRole(profile.role);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkUser();
    });

    const fetchTimer = async () => {
      const { data } = await supabase.from('app_settings').select('team_timer_end, individual_timer_end, monthly_timer_end').eq('id', 1).single();
      if (data) {
        setTeamEnd(data.team_timer_end ? new Date(data.team_timer_end) : null);
        setIndEnd(data.individual_timer_end ? new Date(data.individual_timer_end) : null);
        setMonthlyEnd(data.monthly_timer_end ? new Date(data.monthly_timer_end) : null);
      }
    };
    fetchTimer();

    const channel = supabase.channel('app_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
        setTeamEnd(payload.new.team_timer_end ? new Date(payload.new.team_timer_end) : null);
        setIndEnd(payload.new.individual_timer_end ? new Date(payload.new.individual_timer_end) : null);
        setMonthlyEnd(payload.new.monthly_timer_end ? new Date(payload.new.monthly_timer_end) : null);
      })
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleOpenHost = () => setShowHostPanel(true);
    window.addEventListener('open-host-panel', handleOpenHost);
    return () => window.removeEventListener('open-host-panel', handleOpenHost);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateRacePanel) {
        setShowCreateRacePanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateRacePanel]);

  useEffect(() => {
    // Only subscribe to the Streamer Mode controls if we are in Streamer or Panel view
    if (pathname !== '/streamer' && pathname !== '/streamer/panel') return;
    
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.showTimers !== undefined) {
        setShowTimersOnStream(customEvent.detail.showTimers);
      }
    };
    
    window.addEventListener('local-timer-toggle', handleToggle);
    return () => window.removeEventListener('local-timer-toggle', handleToggle);
  }, [pathname]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      const tEnd = teamEnd ? teamEnd.getTime() : 0;
      const tLeft = Math.max(0, Math.floor((tEnd - now) / 1000));
      setTeamTimeLeft(tLeft);
      
      const iEnd = indEnd ? indEnd.getTime() : 0;
      const iLeft = Math.max(0, Math.floor((iEnd - now) / 1000));
      setIndTimeLeft(iLeft);
      
      const mEnd = monthlyEnd ? monthlyEnd.getTime() : 0;
      const mLeft = Math.max(0, Math.floor((mEnd - now) / 1000));
      setMonthlyTimeLeft(mLeft);
      
      // Dispatch events for buttons to listen to
      window.dispatchEvent(new CustomEvent('team-betting-status', { detail: tLeft > 0 }));
      window.dispatchEvent(new CustomEvent('ind-betting-status', { detail: iLeft > 0 }));
      window.dispatchEvent(new CustomEvent('monthly-betting-status', { detail: mLeft > 0 }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [teamEnd, indEnd, monthlyEnd]);

  const handleSetTimer = async (minutes: number, type: 'TEAM' | 'INDIVIDUAL' | 'MONTHLY' | 'ALL') => {
    if (type === 'ALL') {
      const now = new Date().getTime();
      const currentTeamEnd = teamEnd ? Math.max(now, teamEnd.getTime()) : now;
      const currentIndEnd = indEnd ? Math.max(now, indEnd.getTime()) : now;
      const currentMonthlyEnd = monthlyEnd ? Math.max(now, monthlyEnd.getTime()) : now;
      
      const newTeamEnd = new Date(currentTeamEnd + minutes * 60000);
      const newIndEnd = new Date(currentIndEnd + minutes * 60000);
      const newMonthlyEnd = new Date(currentMonthlyEnd + minutes * 60000);
      
      await supabase.from('app_settings').update({ 
        team_timer_end: newTeamEnd.toISOString(),
        individual_timer_end: newIndEnd.toISOString(),
        monthly_timer_end: newMonthlyEnd.toISOString()
      }).eq('id', 1);
      
      setTeamEnd(newTeamEnd);
      setIndEnd(newIndEnd);
      setMonthlyEnd(newMonthlyEnd);
      return;
    }

    const currentEnd = type === 'TEAM' 
      ? (teamEnd ? teamEnd.getTime() : new Date().getTime())
      : type === 'MONTHLY'
      ? (monthlyEnd ? monthlyEnd.getTime() : new Date().getTime())
      : (indEnd ? indEnd.getTime() : new Date().getTime());
      
    const newEnd = new Date(Math.max(new Date().getTime(), currentEnd) + minutes * 60000);
    const isoString = newEnd.toISOString();
    
    if (type === 'TEAM') {
      await supabase.from('app_settings').update({ team_timer_end: isoString }).eq('id', 1);
      setTeamEnd(newEnd);
    } else if (type === 'MONTHLY') {
      await supabase.from('app_settings').update({ monthly_timer_end: isoString }).eq('id', 1);
      setMonthlyEnd(newEnd);
    } else {
      await supabase.from('app_settings').update({ individual_timer_end: isoString }).eq('id', 1);
      setIndEnd(newEnd);
    }
  };

  const handleStopTimer = async (type: 'TEAM' | 'INDIVIDUAL' | 'MONTHLY' | 'ALL') => {
    if (type === 'ALL') {
      await supabase.from('app_settings').update({ 
        team_timer_end: null,
        individual_timer_end: null,
        monthly_timer_end: null
      }).eq('id', 1);
      setTeamEnd(null);
      setTeamTimeLeft(0);
      setIndEnd(null);
      setIndTimeLeft(0);
      setMonthlyEnd(null);
      setMonthlyTimeLeft(0);
      return;
    }

    if (type === 'TEAM') {
      await supabase.from('app_settings').update({ team_timer_end: null }).eq('id', 1);
      setTeamEnd(null);
      setTeamTimeLeft(0);
    } else if (type === 'MONTHLY') {
      await supabase.from('app_settings').update({ monthly_timer_end: null }).eq('id', 1);
      setMonthlyEnd(null);
      setMonthlyTimeLeft(0);
    } else {
      await supabase.from('app_settings').update({ individual_timer_end: null }).eq('id', 1);
      setIndEnd(null);
      setIndTimeLeft(0);
    }
  };
  
  const handleAnnounceWinner = async () => {
    if (isAnnouncing) return;
    setIsAnnouncing(true);
    let finalPositions = { ...racerPositions };

    if (winnerType === 'TEAM') {
      const { data: teams } = await supabase.from('racers').select('id, name, tournament_points').eq('type', 'TEAM');
      const { data: racers } = await supabase.from('racers').select('id, team_name, tournament_points').neq('type', 'TEAM').not('type', 'ilike', 'MONTHLY%');

      if (teams && racers) {
        const teamScores = teams.map(team => {
          const teamRacers = racers.filter(r => r.team_name === team.name);
          const collectivePoints = teamRacers.reduce((sum, r) => sum + (r.tournament_points || 0), 0);
          return {
            id: team.id,
            points: (team.tournament_points || 0) + collectivePoints
          };
        }).sort((a, b) => b.points - a.points);
        
        teamScores.forEach((t, index) => {
          finalPositions[t.id] = String(index + 1);
        });
      }
    } else {
      if (Object.keys(finalPositions).length === 0) {
        showError('Validation Error', 'No positions selected. Please assign at least one position.');
        setIsAnnouncing(false);
        return;
      }

      // Ensure all posted racers have a position assigned
      let postedFilter: any;
      let postedRacers: any[] = [];
      if (winnerType === 'MONTHLY') {
        const { data } = await supabase.from('racers').select('id').in('type', ['MONTHLY_RACER']).eq('is_posted', true);
        postedRacers = data || [];
      } else {
        const { data } = await supabase.from('racers').select('id, type').eq('is_posted', true);
        postedRacers = (data || []).filter((r: any) => r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY'));
      }
      
      const missingPositions = postedRacers.some(r => !finalPositions[r.id]);
      if (missingPositions) {
        showError('Validation Error', 'Please assign a position (or DNF/DSQ) for EVERY participant before confirming.');
        setIsAnnouncing(false);
        return;
      }
    }
    
    // Prevent announcement if timer is active
    if (winnerType === 'TEAM' && teamTimeLeft > 0) {
      showError('Timer Active', 'Cannot announce team winner while TEAM WINDOW is still open!');
      setIsAnnouncing(false);
      return;
    }
    if (winnerType === 'MONTHLY' && monthlyTimeLeft > 0) {
      showError('Timer Active', 'Cannot announce monthly winner while MONTHLY WINDOW is still open!');
      setIsAnnouncing(false);
      return;
    }
    if (winnerType === 'RACER' && indTimeLeft > 0) {
      showError('Timer Active', 'Cannot announce racer winner while RACER WINDOW is still open!');
      setIsAnnouncing(false);
      return;
    }

    try {
    // --- PARIMUTUEL PAYOUT CALCULATION ---
    
    // 1. Get all currently posted racers in this category
    let postedFilter: any;
    if (winnerType === 'TEAM') {
      postedFilter = { type: 'TEAM' };
    } else if (winnerType === 'MONTHLY') {
      // Monthly includes only MONTHLY_RACER
      postedFilter = null; // handled separately
    } else {
      postedFilter = null; // handled separately
    }

    let postedRacers: any[] = [];
    if (winnerType === 'TEAM') {
      const { data } = await supabase.from('racers').select('id, name').eq('type', 'TEAM').eq('is_posted', true);
      postedRacers = data || [];
    } else if (winnerType === 'MONTHLY') {
      const { data } = await supabase.from('racers').select('id, name').in('type', ['MONTHLY_RACER']).eq('is_posted', true);
      postedRacers = data || [];
    } else {
      const { data } = await supabase.from('racers').select('id, name, type').eq('is_posted', true);
      postedRacers = (data || []).filter((r: any) => r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY'));
    }

    const postedRacerIds = postedRacers.map((r: any) => r.id);
    if (postedRacerIds.length > 0) {
      // 2. Fetch all APPROVED bids on these posted racers that have not been settled yet
      const { data: allBids } = await supabase
        .from('bids')
        .select('id, racer_id, user_id, amount, position_prediction')
        .eq('status', 'APPROVED')
        .eq('result', 'PENDING')
        .in('racer_id', postedRacerIds);

      if (allBids && allBids.length > 0) {
        // RACER Fixed Odds Multipliers
        const RACER_ODDS_MULTIPLIERS: Record<string, number> = {
          '1': 1.5,
          '2-3': 1.4,
          '4-6': 1.3,
          '6-10': 1.2,
          '7-10': 1.2,
          '11-15': 1.1,
        };

        // Helper to check if exact pos matches prediction bucket
        const isPositionInBucket = (exactPosStr: string, bucketStr: string) => {
          if (!exactPosStr || !bucketStr) return false;
          const pos = parseInt(exactPosStr, 10);
          if (isNaN(pos)) return false;

          // Strip any multiplier text (e.g. "1 (1.5x)" -> "1")
          const cleanBucket = bucketStr.split(' ')[0].trim();

          if (cleanBucket === '1') return pos === 1;
          const parts = cleanBucket.split('-');
          if (parts.length === 1) return pos === parseInt(parts[0], 10);
          if (parts.length !== 2) return false;
          const min = parseInt(parts[0], 10);
          const max = parseInt(parts[1], 10);
          return pos >= min && pos <= max;
        };

        // 3. Calculate winning pool and losing pool
        const winningBids = allBids.filter((b: any) => isPositionInBucket(finalPositions[b.racer_id], b.position_prediction));
        const losingBids = allBids.filter((b: any) => !isPositionInBucket(finalPositions[b.racer_id], b.position_prediction));

        const totalWinningPool = winningBids.reduce((sum: number, b: any) => sum + b.amount, 0);
        const totalLosingPool = losingBids.reduce((sum: number, b: any) => sum + b.amount, 0);

        // 4. Calculate payouts for winners
        // Racers (individuals): Fixed odds multipliers (1: 1.5x, 2-3: 1.4x, 4-6: 1.3x, 6-10: 1.2x, 11-15: 1.1x)
        // Teams: Pari-mutuel proportional share of half losing pool
        for (const bid of winningBids) {
          let payout = 0;
          if (winnerType === 'RACER') {
            const cleanBucket = (bid.position_prediction || '').split(' ')[0].trim();
            const multiplier = RACER_ODDS_MULTIPLIERS[cleanBucket] || 1.2;
            payout = Math.round(bid.amount * multiplier);
          } else {
            const share = totalWinningPool > 0 ? (bid.amount / totalWinningPool) * (totalLosingPool / 2) : 0;
            payout = bid.amount + Math.floor(share);
          }
          
          await supabase
            .from('bids')
            .update({ result: 'WON', payout })
            .eq('id', bid.id);
        }

        // 5. Mark all losing bids
        const losingBidIds = losingBids.map((b: any) => b.id);
        if (losingBidIds.length > 0) {
          await supabase
            .from('bids')
            .update({ result: 'LOST', payout: 0 })
            .in('id', losingBidIds);
        }

        // Log the payout details
        await supabase.from('audit_logs').insert([{
          action: 'ANNOUNCE_WINNER',
          details: winnerType === 'RACER'
            ? `Announced RACER positions with fixed odds multipliers. ${winningBids.length} winning bets, ${losingBids.length} losing bets.`
            : `Announced ${winnerType} positions. Winning pool: $${totalWinningPool}, Losing pool: $${totalLosingPool}. ${winningBids.length} winning bets, ${losingBids.length} losing bets.`
        }]);
      }
    }

    // --- UPDATE TOURNAMENT TELEMETRY FOR PARTICIPANTS ---
    const { data: settings } = await supabase.from('app_settings').select('current_round_id').maybeSingle();
    const currentRoundId = settings?.current_round_id || 1;
    const resultsToInsert: any[] = [];

    for (const racerId of postedRacerIds) {
      if (finalPositions[racerId]) {
        const exactPosStr = finalPositions[racerId];
        let exactPos = 15;
        let isDnf = false;
        let isDsq = false;
        if (exactPosStr === 'DNF') isDnf = true;
        else if (exactPosStr === 'DSQ') isDsq = true;
        else exactPos = parseInt(exactPosStr, 10) || 15;

        const { data: racerData } = await supabase.from('racers').select('races, wins, avg_pos, tournament_points, type').eq('id', racerId).single();
        if (racerData) {
          const oldRaces = racerData.races || 0;
          const oldWins = racerData.wins || 0;
          const oldAvgPos = racerData.avg_pos || 0;
          const oldPoints = racerData.tournament_points || 0;
          
          if (isDnf || isDsq) {
             exactPos = racerData.type === 'TEAM' ? 15 : 45;
          }

          let earnedPoints = 0;
          if (racerData.type === 'TEAM') earnedPoints = 0;
          else if (isDnf) earnedPoints = -2;
          else if (isDsq) earnedPoints = -10;
          else if (exactPos === 1) earnedPoints = 30;
          else if (exactPos === 2) earnedPoints = 27;
          else if (exactPos === 3) earnedPoints = 25;
          else if (exactPos === 4) earnedPoints = 23;
          else if (exactPos === 5) earnedPoints = 21;
          else if (exactPos === 6) earnedPoints = 20;
          else if (exactPos === 7) earnedPoints = 19;
          else if (exactPos === 8) earnedPoints = 18;
          else if (exactPos === 9) earnedPoints = 17;
          else if (exactPos === 10) earnedPoints = 16;
          else if (exactPos === 11) earnedPoints = 15;
          else if (exactPos === 12) earnedPoints = 14;
          else if (exactPos === 13) earnedPoints = 13;
          else if (exactPos === 14) earnedPoints = 12;
          else if (exactPos === 15) earnedPoints = 11;
          else if (exactPos === 16) earnedPoints = 10;
          else if (exactPos === 17) earnedPoints = 9;
          else if (exactPos === 18) earnedPoints = 8;
          else if (exactPos === 19) earnedPoints = 7;
          else if (exactPos === 20) earnedPoints = 6;
          else if (exactPos === 21) earnedPoints = 5;
          else if (exactPos === 22) earnedPoints = 4;
          else if (exactPos === 23) earnedPoints = 3;
          else if (exactPos === 24) earnedPoints = 2;
          else if (exactPos >= 25 && exactPos <= 42) earnedPoints = 1;
          else earnedPoints = 0;
          
          const newRaces = oldRaces + 1;
          const isWin = !isDnf && !isDsq && exactPos >= 1 && exactPos <= 3;
          const newWins = oldWins + (isWin ? 1 : 0);
          const newWinRate = Math.round((newWins / newRaces) * 100);
          
          const newAvgPos = Math.round(((oldAvgPos * oldRaces) + exactPos) / newRaces);
          const newPoints = oldPoints + earnedPoints;

          await supabase.from('racers').update({
            races: newRaces,
            wins: newWins,
            win_rate: newWinRate,
            avg_pos: newAvgPos,
            tournament_points: newPoints
          }).eq('id', racerId);

          resultsToInsert.push({
            round_id: currentRoundId,
            racer_id: racerId,
            position: exactPos,
            points_earned: earnedPoints,
            is_dnf: isDnf,
            is_dsq: isDsq,
            category: winnerType
          });
        }
      }
    }

    if (resultsToInsert.length > 0) {
      await supabase.from('results').insert(resultsToInsert);
    }
    
    // --- UPDATE LATEST WINNER DISPLAY ---
    let firstPlaceId: string | null = null;
    for (const [id, pos] of Object.entries(finalPositions)) {
      if (parseInt(pos as string, 10) === 1) {
        firstPlaceId = id;
        break;
      }
    }
    
    let winnerName = 'POSITIONS LOGGED';
    if (firstPlaceId) {
      const firstPlaceRacer = postedRacers.find(r => r.id === firstPlaceId);
      if (firstPlaceRacer) winnerName = firstPlaceRacer.name;
    }

    const updateData: any = {};
    updateData.latest_winner = winnerName;
    
    if (winnerType === 'TEAM') {
      updateData.latest_team_winner = winnerName;
    } else if (winnerType === 'MONTHLY') {
      updateData.latest_monthly_winner = winnerName;
    } else {
      updateData.latest_racer_winner = winnerName;
    }

    const newRoundId = currentRoundId + 1;
    
    updateData.id = 1;
    updateData.current_round_id = newRoundId;

    await supabase.from('app_settings').upsert(updateData, { onConflict: 'id' });
    
    // Auto unpost and reset bids to zero for fresh start
    if (winnerType === 'TEAM') {
      await supabase.from('racers').update({ is_posted: false, current_bid: 0 }).eq('type', 'TEAM');
    } else if (winnerType === 'MONTHLY') {
      await supabase.from('racers').update({ is_posted: false, current_bid: 0 }).in('type', ['MONTHLY_RACER']);
    } else {
      await supabase.from('racers').update({ is_posted: false, current_bid: 0 })
        .neq('type', 'TEAM')
        .neq('type', 'MONTHLY_RACER');
    }

    setShowWinnerPanel(false);
    setWinnerInput('');
    setRacerPositions({});
    setIsAnnouncing(false);
    showSuccess('Success', 'Positions logged successfully!');
    } catch (err: any) {
      console.error(err);
      setIsAnnouncing(false);
      showError('Fatal Error', err.message);
    }
  };

  const handleOpenWinnerPanel = async () => {
    setShowWinnerPanel(true);
    // Fetch all currently posted racers to show in the dropdown
    const { data } = await supabase.from('racers').select('id, name, type').eq('is_posted', true).order('name');
    if (data) setWinnerOptions(data);
    setWinnerInput(''); // reset
    setRacerPositions({});
  };

  const handleOpenPostList = async () => {
    setShowPostList(true);
    const { data } = await supabase.from('racers').select('*').order('name');
    if (data) setAllRacers(data);
  };

  const handleOpenCreateRacePanel = async (mode: 'CREATE' | 'START_BIDDING') => {
    setRaceMode(mode);
    setShowCreateRacePanel(true);
    setTeamSelectorSearch('');
    setRacerSelectorSearch('');
    const { data } = await supabase.from('racers').select('*').order('name');
    if (data) setAllRacers(data);
    
    if (mode === 'START_BIDDING') {
      const { data: pending } = await supabase.from('races').select('*').eq('status', 'PENDING').order('created_at', { ascending: false });
      if (pending) {
        setPendingRaces(pending);
        if (pending.length > 0) setSelectedPendingRace(pending[0].id.toString());
      }
    }
    
    setRaceForm({ name: '', track: '', teamTimer: '', racerTimer: '', teamMinBet: '', racerMinBet: '', teams: [], racers: [] });
  };

  const handleCreateRace = async () => {
    if (raceMode === 'CREATE' && !raceForm.name) {
      showError('Missing Name', 'Please provide a race name.');
      return;
    }
    
    const selectedTeamIds = raceForm.teams.map(t => t.id);
    const selectedRacerIds = raceForm.racers.map(r => r.id);
    
    if (raceMode === 'CREATE') {
      const { data: newRace, error } = await supabase.from('races').insert([{
        name: raceForm.name,
        track: raceForm.track,
        status: 'PENDING',
        team_timer: Number(raceForm.teamTimer) || 0,
        racer_timer: Number(raceForm.racerTimer) || 0,
        team_min_bet: Number(raceForm.teamMinBet) || 0,
        racer_min_bet: Number(raceForm.racerMinBet) || 0,
        teams: selectedTeamIds,
        racers: selectedRacerIds
      }]).select().single();
      
      if (error) {
        showError('Error', 'Failed to create race. Did you run the SQL script?');
        return;
      }
      
      setShowCreateRacePanel(false);
      showConfirm('Race Created!', `The race "${raceForm.name}" is pending. Use START BIDDING to open it.`, () => {});
      return;
    }
    
    if (!selectedPendingRace) {
      showError('No Race', 'Please select a pending race.');
      return;
    }
    
    const race = pendingRaces.find(r => r.id.toString() === selectedPendingRace);
    if (!race) return;

    if (race.teams?.length > 0) {
      await supabase.from('racers').update({ is_posted: true, current_bid: 0 }).in('id', race.teams);
    }
    if (race.racers?.length > 0) {
      await supabase.from('racers').update({ is_posted: true, current_bid: 0 }).in('id', race.racers);
    }

    let updateSettings: any = {};
    updateSettings.current_round_id = race.id;
    
    const finalTeamTimer = Number(raceForm.teamTimer) || race.team_timer || 0;
    if (finalTeamTimer > 0) {
      updateSettings.team_timer_end = new Date(new Date().getTime() + finalTeamTimer * 60000).toISOString();
    }
    
    const finalRacerTimer = Number(raceForm.racerTimer) || race.racer_timer || 0;
    if (finalRacerTimer > 0) {
      updateSettings.individual_timer_end = new Date(new Date().getTime() + finalRacerTimer * 60000).toISOString();
    }
    
    if (Object.keys(updateSettings).length > 0) {
      const { error: settingsError } = await supabase.from('app_settings').update(updateSettings).eq('id', 1);
      if (settingsError) {
        showError('Settings Error', 'Failed to update timers: ' + settingsError.message);
        return;
      }
      if (updateSettings.team_timer_end) setTeamEnd(new Date(updateSettings.team_timer_end));
      if (updateSettings.individual_timer_end) setIndEnd(new Date(updateSettings.individual_timer_end));
      if (updateSettings.monthly_timer_end) setMonthlyEnd(new Date(updateSettings.monthly_timer_end));
    }
    
    const { error: raceError } = await supabase.from('races').update({ status: 'ACTIVE' }).eq('id', race.id);
    if (raceError) {
      showError('Race Error', 'Failed to update race status: ' + raceError.message);
      return;
    }

    setShowCreateRacePanel(false);
    showConfirm('Race Started!', `The bidding windows are now live!`, () => {});
  };

  const togglePostStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('racers').update({ is_posted: !currentStatus }).eq('id', id);
    setAllRacers(allRacers.map(r => r.id === id ? { ...r, is_posted: !currentStatus } : r));
  };

  const handleCancelBets = (type: 'TEAM' | 'RACER') => {
    showConfirm(
      'CANCEL BETS',
      `Are you sure you want to completely CANCEL and wipe all current bets for ${type}s? This action cannot be undone.`,
      async () => {
        try {
          let racerQuery = supabase.from('racers').select('id');
          if (type === 'TEAM') {
            racerQuery = racerQuery.eq('type', 'TEAM');
          } else {
            racerQuery = racerQuery.neq('type', 'TEAM').neq('type', 'MONTHLY_RACER');
          }
          
          const { data: racersToCancel, error: rErr } = await racerQuery;
          if (rErr) throw rErr;
          if (!racersToCancel || racersToCancel.length === 0) return;
          
          const racerIds = racersToCancel.map(r => r.id);
          
          // Update all pending bids for these racers to REFUNDED
          const { error: delErr } = await supabase.from('bids').update({ result: 'REFUNDED' }).in('racer_id', racerIds).eq('result', 'PENDING');
          if (delErr) throw delErr;
          
          // Reset current_bid to 0
          const { error: updErr } = await supabase.from('racers').update({ current_bid: 0 }).in('id', racerIds);
          if (updErr) throw updErr;
          
          // Audit log
          await supabase.from('audit_logs').insert([{
            action: 'CANCEL_BETS',
            details: `All pending bets for ${type}s have been cancelled and reset to $0.`
          }]);
          
          setShowHostPanel(false);
          showSuccess('Success', `Successfully cancelled all ${type} bets!`);
        } catch (err: any) {
          console.error(err);
          showError('Failed', 'Failed to cancel bets: ' + err.message);
        }
      }
    );
  };

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isStreamerMode = pathname === '/streamer';
  const isPanelMode = pathname === '/streamer/panel';
  const isStreamIframe = searchParams?.get('stream') === 'true';
  
  if (isStreamIframe || isPanelMode) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        ...(isStreamerMode ? { top: 0 } : { bottom: 0 }),
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'row',
        gap: '2rem',
        justifyContent: 'center',
        alignItems: isStreamerMode ? 'flex-start' : 'flex-end',
        background: isStreamerMode ? 'transparent' : 'rgba(0,0,0,0.8)',
        backdropFilter: isStreamerMode ? 'none' : 'blur(10px)',
        borderTop: isStreamerMode ? 'none' : '1px solid rgba(255,255,255,0.1)',
        borderBottom: isStreamerMode ? 'none' : 'none',
        padding: isStreamerMode ? '1.5rem 2rem' : '1rem 2rem',
        pointerEvents: 'none',
        opacity: isStreamerMode ? (showTimersOnStream ? 1 : 0) : (showTimersOnStream ? 1 : 0.3),
        transition: 'opacity 0.4s',
      }}>
        {/* TEAM TIMER */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <div className={`glass-panel timer-panel ${teamTimeLeft > 0 ? 'timer-active-red' : 'timer-closed'}`} style={{ 
            padding: '0.5rem 1rem', 
            textAlign: 'left',
            minWidth: '180px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <p className="text-mono" style={{ color: teamTimeLeft > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '1px', margin: 0, lineHeight: 1.2 }}>
              TEAM<br/>WINDOW
            </p>
            <p style={{ fontSize: '1.25rem', fontWeight: 900, color: teamTimeLeft > 0 ? '#fff' : '#666', fontFamily: 'monospace', margin: 0 }}>
              {teamTimeLeft > 0 ? formatTime(teamTimeLeft) : 'CLOSED'}
            </p>
          </div>

          {(role === 'admin') && !isStreamerMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'TEAM')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+5M</button>
                <button onClick={() => handleSetTimer(60, 'TEAM')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+1H</button>
                <button onClick={() => handleStopTimer('TEAM')} className="btn-primary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>STOP</button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input type="number" placeholder="M" className="input-base" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', textAlign: 'center' }} value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button onClick={() => { if(customTime) { handleSetTimer(-Number(customTime), 'TEAM'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', border: '1px solid #ff4444', color: '#ff4444' }}>-C</button>
                <button onClick={() => { if(customTime) { handleSetTimer(Number(customTime), 'TEAM'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+C</button>
              </div>
            </div>
          )}
        </div>

        {/* INDIVIDUAL TIMER */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <div className={`glass-panel timer-panel ${indTimeLeft > 0 ? 'timer-active-green' : 'timer-closed'}`} style={{ 
            padding: '0.5rem 1rem', 
            textAlign: 'left',
            minWidth: '180px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <p className="text-mono" style={{ color: indTimeLeft > 0 ? '#00ff88' : 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '1px', margin: 0, lineHeight: 1.2 }}>
              RACER<br/>WINDOW
            </p>
            <p style={{ fontSize: '1.25rem', fontWeight: 900, color: indTimeLeft > 0 ? '#fff' : '#666', fontFamily: 'monospace', margin: 0 }}>
              {indTimeLeft > 0 ? formatTime(indTimeLeft) : 'CLOSED'}
            </p>
          </div>

          {(role === 'admin') && !isStreamerMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'INDIVIDUAL')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+5M</button>
                <button onClick={() => handleSetTimer(60, 'INDIVIDUAL')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+1H</button>
                <button onClick={() => handleStopTimer('INDIVIDUAL')} className="btn-primary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>STOP</button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input type="number" placeholder="M" className="input-base" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', textAlign: 'center' }} value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button onClick={() => { if(customTime) { handleSetTimer(-Number(customTime), 'INDIVIDUAL'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', border: '1px solid #ff4444', color: '#ff4444' }}>-C</button>
                <button onClick={() => { if(customTime) { handleSetTimer(Number(customTime), 'INDIVIDUAL'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+C</button>
              </div>
            </div>
          )}
        </div>

        {/* MONTHLY TIMER */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <div className={`glass-panel timer-panel ${monthlyTimeLeft > 0 ? 'timer-active-blue' : 'timer-closed'}`} style={{ 
            padding: '0.5rem 1rem', 
            textAlign: 'left',
            minWidth: '180px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <p className="text-mono" style={{ color: monthlyTimeLeft > 0 ? '#ff00ff' : 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '1px', margin: 0, lineHeight: 1.2 }}>
              MONTHLY<br/>WINDOW
            </p>
            <p style={{ fontSize: '1.25rem', fontWeight: 900, color: monthlyTimeLeft > 0 ? '#fff' : '#666', fontFamily: 'monospace', margin: 0 }}>
              {monthlyTimeLeft > 0 ? formatTime(monthlyTimeLeft) : 'CLOSED'}
            </p>
          </div>

          {(role === 'admin') && !isStreamerMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'MONTHLY')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+5M</button>
                <button onClick={() => handleSetTimer(60, 'MONTHLY')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+1H</button>
                <button onClick={() => handleStopTimer('MONTHLY')} className="btn-primary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>STOP</button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input type="number" placeholder="M" className="input-base" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', textAlign: 'center' }} value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button onClick={() => { if(customTime) { handleSetTimer(-Number(customTime), 'MONTHLY'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', border: '1px solid #ff4444', color: '#ff4444' }}>-C</button>
                <button onClick={() => { if(customTime) { handleSetTimer(Number(customTime), 'MONTHLY'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+C</button>
              </div>
            </div>
          )}
        </div>

        {/* ALL WINDOWS TIMER */}
        {(role === 'admin') && !isStreamerMode && (
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <div className="glass-panel" style={{ 
              padding: '0.5rem 1rem', 
              textAlign: 'left',
              minWidth: '150px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid var(--accent-primary)',
              background: 'rgba(20,20,20,0.8)'
            }}>
              <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.65rem', letterSpacing: '1px', margin: 0, lineHeight: 1.2 }}>
                ALL<br/>WINDOWS
              </p>
              <p style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'monospace', margin: 0 }}>
                CTRL
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'ALL')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+5M</button>
                <button onClick={() => handleSetTimer(60, 'ALL')} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+1H</button>
                <button onClick={() => handleStopTimer('ALL')} className="btn-primary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>STOP</button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input type="number" placeholder="M" className="input-base" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', textAlign: 'center' }} value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button onClick={() => { if(customTime) { handleSetTimer(-Number(customTime), 'ALL'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem', border: '1px solid #ff4444', color: '#ff4444' }}>-C</button>
                <button onClick={() => { if(customTime) { handleSetTimer(Number(customTime), 'ALL'); setCustomTime(''); } }} className="btn-secondary" style={{ width: '38px', padding: '0.25rem 0', fontSize: '0.65rem' }}>+C</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ANNOUNCE WINNER MODAL OUTSIDE SIDEBAR TO AVOID TRANSFORM CONTEXT */}
      {showWinnerPanel && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}>
          <div className="glass-panel animate-in" style={{ 
            padding: '2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            minWidth: '400px',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 10px 40px rgba(242, 24, 24, 0.2)'
          }}>
            <h3 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase', textAlign: 'center' }}>
              RACE RESULTS
            </h3>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Select the STARTED BIDDING RACE to enter final positions.
            </p>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={() => { setWinnerType('TEAM'); setWinnerInput(''); }} 
                className={winnerType === 'TEAM' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                TEAM RACE (STARTED)
              </button>
              <button 
                onClick={() => { setWinnerType('RACER'); setWinnerInput(''); }} 
                className={winnerType === 'RACER' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                RACER RACE (STARTED)
              </button>
              <button 
                onClick={() => { setWinnerType('MONTHLY'); setWinnerInput(''); }} 
                className={winnerType === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                MONTHLY RACE (STARTED)
              </button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <input 
                type="text" 
                placeholder="Search participant..." 
                className="input-base" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem' }}
                value={winnerInput}
                onChange={(e) => setWinnerInput(e.target.value)}
              />
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
              {winnerType === 'TEAM' ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Team positions are automatically calculated based on the live leaderboard.
                  </p>
                  <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Click CONFIRM to announce the results and payout.
                  </p>
                </div>
              ) : (
                <>
                  {winnerOptions
                    .filter(r => winnerType === 'MONTHLY' ? (r.type === 'MONTHLY_RACER') : (r.type !== 'TEAM' && r.type !== 'MONTHLY_RACER'))
                    .filter(r => r.name.toLowerCase().includes(winnerInput.toLowerCase()))
                    .map((r) => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span className="text-mono" style={{ color: '#fff', fontSize: '0.85rem' }}>{r.name}</span>
                        <select 
                          className="input-base" 
                          value={racerPositions[r.id] || ''}
                          onChange={e => setRacerPositions(prev => ({ ...prev, [r.id]: e.target.value }))}
                          style={{ width: '150px', padding: '0.5rem', fontSize: '0.85rem', appearance: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                        >
                          <option value="" disabled>Position...</option>
                          {Array.from({ length: 45 }, (_, i) => String(i + 1))
                            .concat(['DNF', 'DSQ']).filter(opt => opt === 'DNF' || opt === 'DSQ' || opt === racerPositions[r.id] || !Object.values(racerPositions).includes(opt))
                          .map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                  ))}
                  {winnerOptions.filter(r => winnerType === 'MONTHLY' ? (r.type === 'MONTHLY_RACER') : (r.type !== 'TEAM' && r.type !== 'MONTHLY_RACER')).length === 0 && (
                    <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No active participants in this category.</p>
                  )}
                </>
              )}
            </div>
            
            {((winnerType === 'TEAM' && teamTimeLeft > 0) || (winnerType === 'RACER' && indTimeLeft > 0) || (winnerType === 'MONTHLY' && monthlyTimeLeft > 0)) && (
              <p className="text-mono" style={{ color: '#f21818', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem' }}>
                WARNING: YOU CANNOT ANNOUNCE WHILE THE {winnerType} TIMER IS STILL RUNNING.
              </p>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setShowWinnerPanel(false)} className="btn-secondary" style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>CANCEL</button>
              <button 
                onClick={handleAnnounceWinner} 
                className="btn-primary" 
                style={{ flex: 1, padding: '1rem', fontSize: '1rem', opacity: (isAnnouncing || (winnerType === 'TEAM' && teamTimeLeft > 0) || (winnerType === 'RACER' && indTimeLeft > 0) || (winnerType === 'MONTHLY' && monthlyTimeLeft > 0)) ? 0.5 : 1 }}
                disabled={isAnnouncing || (winnerType === 'TEAM' && teamTimeLeft > 0) || (winnerType === 'RACER' && indTimeLeft > 0) || (winnerType === 'MONTHLY' && monthlyTimeLeft > 0)}
              >
                {isAnnouncing ? 'LOGGING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST LIST BET MODAL */}
      {showPostList && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}>
          <div className="glass-panel animate-in" style={{ 
            padding: '2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            minWidth: '600px',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 10px 40px rgba(242, 24, 24, 0.2)'
          }}>
            <h3 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase', textAlign: 'center' }}>
              MANAGE POSTED BETS
            </h3>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Select which teams and drivers are currently active on the Live Terminal.
            </p>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={() => setPostListTab('TEAM')} 
                className={postListTab === 'TEAM' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                TEAMS
              </button>
              <button 
                onClick={() => setPostListTab('RACER')} 
                className={postListTab === 'RACER' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                RACERS
              </button>
              <button 
                onClick={() => setPostListTab('MONTHLY')} 
                className={postListTab === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                MONTHLY
              </button>
            </div>

            {postListTab === 'MONTHLY' && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setMonthlySubTab('TEAM')} 
                  className={monthlySubTab === 'TEAM' ? 'btn-primary' : 'btn-secondary'} 
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  MONTHLY TEAMS
                </button>
                <button 
                  onClick={() => setMonthlySubTab('RACER')} 
                  className={monthlySubTab === 'RACER' ? 'btn-primary' : 'btn-secondary'} 
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  MONTHLY RACERS
                </button>
              </div>
            )}

            <div className="input-base" style={{ height: '350px', overflowY: 'auto', padding: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allRacers.filter(r => postListTab === 'TEAM' ? r.type === 'TEAM' : postListTab === 'MONTHLY' ? r.type === 'MONTHLY_RACER' : (r.type !== 'TEAM' && r.type !== 'MONTHLY_RACER')).map(racer => (
                <div key={racer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>{racer.name}</p>
                    <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{racer.type}</p>
                  </div>
                  <button 
                    onClick={() => togglePostStatus(racer.id, racer.is_posted)}
                    className={racer.is_posted ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', minWidth: '100px' }}
                  >
                    {racer.is_posted ? 'POSTED' : 'UNPOSTED'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setShowPostList(false)} className="btn-secondary" style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* HOST PANEL MODAL */}
      {showHostPanel && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}>
          <div className="glass-panel animate-in" style={{ 
            padding: '2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            minWidth: '400px',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 10px 40px rgba(242, 24, 24, 0.2)'
          }}>
            <h3 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase', textAlign: 'center' }}>
              HOST PANEL
            </h3>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Select an action to manage the race betting.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '1.25rem', fontSize: '1rem' }}
                onClick={() => {
                  setShowHostPanel(false);
                  handleOpenWinnerPanel();
                }}
              >
                RACE RESULTS
              </button>

              <button 
                className="btn-secondary" 
                style={{ width: '100%', padding: '1.25rem', fontSize: '1rem' }}
                onClick={() => {
                  setShowHostPanel(false);
                  handleOpenCreateRacePanel('CREATE');
                }}
              >
                CREATE RACE
              </button>

              <button 
                className="btn-secondary" 
                style={{ width: '100%', padding: '1.25rem', fontSize: '1rem' }}
                onClick={() => {
                  setShowHostPanel(false);
                  handleOpenCreateRacePanel('START_BIDDING');
                }}
              >
                START BIDDING
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '1rem', fontSize: '0.75rem', border: '1px solid #f21818', color: '#f21818' }}
                  onClick={() => handleCancelBets('RACER')}
                >
                  CANCEL RACER BET
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '1rem', fontSize: '0.75rem', border: '1px solid #f21818', color: '#f21818' }}
                  onClick={() => handleCancelBets('TEAM')}
                >
                  CANCEL TEAM BET
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setShowHostPanel(false)} className="btn-secondary" style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
      {/* CREATE RACE PANEL MODAL */}
      {showCreateRacePanel && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateRacePanel(false);
          }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5, 2, 2, 0.88)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            pointerEvents: 'auto'
          }}
        >
          <div 
            className="glass-panel animate-in" 
            style={{ 
              width: '100%',
              maxWidth: '920px',
              maxHeight: '92vh',
              display: 'flex', 
              flexDirection: 'column', 
              border: '1px solid var(--accent-primary)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(242, 24, 24, 0.25)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 2rem',
              background: 'linear-gradient(180deg, rgba(30, 8, 8, 0.95) 0%, rgba(18, 5, 5, 0.9) 100%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>🏁</span>
                  <span className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', letterSpacing: '2px', fontWeight: 'bold' }}>
                    RACE CONTROL // ORCHESTRATOR
                  </span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
                </div>
                <h3 className="title-gradient" style={{ fontSize: '1.75rem', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>
                  {raceMode === 'CREATE' ? 'CREATE RACE EVENT' : 'START BIDDING WINDOWS'}
                </h3>
                <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {raceMode === 'CREATE' 
                    ? 'Configure race parameters, timers, min bets, and roster lineup.' 
                    : 'Select a pending race round to deploy to the live terminal and start timers.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="text-mono" style={{
                  fontSize: '0.65rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '4px',
                  background: raceMode === 'CREATE' ? 'rgba(242, 24, 24, 0.15)' : 'rgba(0, 255, 136, 0.15)',
                  border: raceMode === 'CREATE' ? '1px solid var(--accent-primary)' : '1px solid #00ff88',
                  color: raceMode === 'CREATE' ? 'var(--accent-secondary)' : '#00ff88',
                  fontWeight: 'bold'
                }}>
                  {raceMode === 'CREATE' ? 'MODE: STAGING' : 'MODE: LIVE DEPLOY'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateRacePanel(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-muted)',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.background = 'rgba(242, 24, 24, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }}
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.75rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {/* START BIDDING MODE: Select Pending Race */}
              {raceMode === 'START_BIDDING' && (
                <div>
                  <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <span>⚡ SELECT PENDING RACE TO LAUNCH:</span>
                    <span style={{ color: 'var(--accent-primary)' }}>({pendingRaces.length} available)</span>
                  </label>

                  {pendingRaces.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '6px' }}>
                      <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        NO PENDING RACES AVAILABLE TO DEPLOY.
                      </p>
                      <button
                        onClick={() => setRaceMode('CREATE')}
                        className="btn-primary"
                        style={{ marginTop: '1rem', padding: '0.6rem 1.25rem', fontSize: '0.8rem' }}
                      >
                        + CREATE NEW RACE FIRST
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                      {pendingRaces.map((pr: any) => {
                        const isSelected = selectedPendingRace === pr.id.toString();
                        return (
                          <div
                            key={pr.id}
                            onClick={() => setSelectedPendingRace(pr.id.toString())}
                            style={{
                              padding: '1.25rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: isSelected ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.1)',
                              background: isSelected ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255,255,255,0.03)',
                              boxShadow: isSelected ? '0 0 20px rgba(0, 255, 136, 0.2)' : 'none',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span className="text-mono" style={{
                                fontSize: '0.65rem',
                                background: isSelected ? '#00ff88' : 'rgba(255,255,255,0.1)',
                                color: isSelected ? '#000' : '#fff',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontWeight: 'bold'
                              }}>
                                ROUND #{pr.id}
                              </span>
                              <span className="text-mono" style={{ fontSize: '0.65rem', color: isSelected ? '#00ff88' : 'var(--text-muted)' }}>
                                {isSelected ? '● SELECTED' : '○ CLICK TO SELECT'}
                              </span>
                            </div>

                            <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                              {pr.name}
                            </h4>
                            <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                              TRACK: <span style={{ color: '#fff' }}>{pr.track || 'Default Circuit'}</span>
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', fontSize: '0.7rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-mono" style={{ color: 'var(--accent-secondary)' }}>Team Window:</span>
                                <span className="text-mono" style={{ color: '#fff' }}>{pr.team_timer || 0}m (Min ${pr.team_min_bet || 0})</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-mono" style={{ color: '#00ff88' }}>Racer Window:</span>
                                <span className="text-mono" style={{ color: '#fff' }}>{pr.racer_timer || 0}m (Min ${pr.racer_min_bet || 0})</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-mono" style={{ color: 'var(--text-muted)' }}>Lineup:</span>
                                <span className="text-mono" style={{ color: '#fff' }}>{pr.teams?.length || 0} Teams • {pr.racers?.length || 0} Racers</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* CREATE MODE: Race Name & Track */}
              {raceMode === 'CREATE' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <span>🏁 RACE EVENT NAME</span>
                        <span style={{ color: 'var(--accent-primary)' }}>*</span>
                      </label>
                      <input 
                        type="text" 
                        className="input-base text-mono" 
                        style={{ width: '100%', fontSize: '0.9rem', padding: '0.85rem 1rem' }} 
                        value={raceForm.name} 
                        onChange={e => setRaceForm({ ...raceForm, name: e.target.value })} 
                        placeholder="e.g. Grand Prix Finals #1" 
                        required
                      />
                    </div>
                    <div>
                      <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <span>📍 CIRCUIT / TRACK LOCATION</span>
                      </label>
                      <input 
                        type="text" 
                        className="input-base text-mono" 
                        style={{ width: '100%', fontSize: '0.9rem', padding: '0.85rem 1rem' }} 
                        value={raceForm.track} 
                        onChange={e => setRaceForm({ ...raceForm, track: e.target.value })} 
                        placeholder="e.g. Neon Circuit // Sector 4" 
                      />
                    </div>
                  </div>

                  {/* Windows & Rules (Side by Side) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    {/* Team Settings Card */}
                    <div style={{
                      padding: '1.25rem',
                      background: 'linear-gradient(145deg, rgba(242, 24, 24, 0.08) 0%, rgba(20, 5, 5, 0.5) 100%)',
                      border: '1px solid rgba(242, 24, 24, 0.35)',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1rem' }}>🏎️</span>
                          <h4 className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                            TEAM WINDOW RULES
                          </h4>
                        </div>
                        <span className="text-mono" style={{ fontSize: '0.6rem', color: 'var(--accent-secondary)', background: 'rgba(242, 24, 24, 0.15)', padding: '2px 6px', borderRadius: '3px' }}>
                          FRANCHISE POOL
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block', fontWeight: 'bold' }}>
                            TIMER (MINUTES)
                          </label>
                          <input 
                            type="number" 
                            className="input-base text-mono" 
                            style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }} 
                            value={raceForm.teamTimer} 
                            onChange={e => setRaceForm({ ...raceForm, teamTimer: e.target.value })} 
                            placeholder="e.g. 60" 
                          />
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {['15', '30', '45', '60'].map(mins => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setRaceForm({ ...raceForm, teamTimer: mins })}
                                className="text-mono"
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  background: raceForm.teamTimer === mins ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                                  color: raceForm.teamTimer === mins ? '#fff' : 'var(--text-muted)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  cursor: 'pointer'
                                }}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block', fontWeight: 'bold' }}>
                            MINIMUM BET ($)
                          </label>
                          <input 
                            type="number" 
                            className="input-base text-mono" 
                            style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }} 
                            value={raceForm.teamMinBet} 
                            onChange={e => setRaceForm({ ...raceForm, teamMinBet: e.target.value })} 
                            placeholder="e.g. 50" 
                          />
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {['25', '50', '100', '250'].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setRaceForm({ ...raceForm, teamMinBet: val })}
                                className="text-mono"
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  background: raceForm.teamMinBet === val ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                                  color: raceForm.teamMinBet === val ? '#fff' : 'var(--text-muted)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  cursor: 'pointer'
                                }}
                              >
                                ${val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Racer Settings Card */}
                    <div style={{
                      padding: '1.25rem',
                      background: 'linear-gradient(145deg, rgba(0, 255, 136, 0.08) 0%, rgba(5, 20, 10, 0.5) 100%)',
                      border: '1px solid rgba(0, 255, 136, 0.35)',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1rem' }}>👤</span>
                          <h4 className="text-mono" style={{ color: '#00ff88', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                            RACER WINDOW RULES
                          </h4>
                        </div>
                        <span className="text-mono" style={{ fontSize: '0.6rem', color: '#00ff88', background: 'rgba(0, 255, 136, 0.15)', padding: '2px 6px', borderRadius: '3px' }}>
                          DRIVER POOL
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block', fontWeight: 'bold' }}>
                            TIMER (MINUTES)
                          </label>
                          <input 
                            type="number" 
                            className="input-base text-mono" 
                            style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }} 
                            value={raceForm.racerTimer} 
                            onChange={e => setRaceForm({ ...raceForm, racerTimer: e.target.value })} 
                            placeholder="e.g. 60" 
                          />
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {['15', '30', '45', '60'].map(mins => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setRaceForm({ ...raceForm, racerTimer: mins })}
                                className="text-mono"
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  background: raceForm.racerTimer === mins ? '#00ff88' : 'rgba(255,255,255,0.06)',
                                  color: raceForm.racerTimer === mins ? '#000' : 'var(--text-muted)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  cursor: 'pointer',
                                  fontWeight: raceForm.racerTimer === mins ? 'bold' : 'normal'
                                }}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block', fontWeight: 'bold' }}>
                            MINIMUM BET ($)
                          </label>
                          <input 
                            type="number" 
                            className="input-base text-mono" 
                            style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }} 
                            value={raceForm.racerMinBet} 
                            onChange={e => setRaceForm({ ...raceForm, racerMinBet: e.target.value })} 
                            placeholder="e.g. 50" 
                          />
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {['25', '50', '100', '250'].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setRaceForm({ ...raceForm, racerMinBet: val })}
                                className="text-mono"
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  background: raceForm.racerMinBet === val ? '#00ff88' : 'rgba(255,255,255,0.06)',
                                  color: raceForm.racerMinBet === val ? '#000' : 'var(--text-muted)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  cursor: 'pointer',
                                  fontWeight: raceForm.racerMinBet === val ? 'bold' : 'normal'
                                }}
                              >
                                ${val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Roster & Participant Enrollment Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    {(() => {
                      const allTeams = allRacers.filter(r => r.type === 'TEAM');
                      const filteredTeams = allTeams.filter(t => 
                        !teamSelectorSearch.trim() || t.name.toLowerCase().includes(teamSelectorSearch.toLowerCase())
                      );

                      const eligibleRacers = allRacers
                        .filter(r => r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY'))
                        .filter(r => {
                          if (raceForm.teams.length === 0) return true;
                          return raceForm.teams.some(t => r.team_name === t.name || r.captain_name === t.name || (t.roster && t.roster.includes(r.name)));
                        });

                      const filteredRacersList = eligibleRacers.filter(r => 
                        !racerSelectorSearch.trim() || 
                        r.name.toLowerCase().includes(racerSelectorSearch.toLowerCase()) ||
                        (r.team_name && r.team_name.toLowerCase().includes(racerSelectorSearch.toLowerCase()))
                      );

                      return (
                        <>
                          {/* TEAMS SELECTOR */}
                          <div style={{
                            padding: '1.25rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label className="text-mono" style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }}>
                                  SELECT TEAMS
                                </label>
                                <span className="text-mono" style={{
                                  fontSize: '0.65rem',
                                  background: raceForm.teams.length > 0 ? 'rgba(242, 24, 24, 0.2)' : 'rgba(255,255,255,0.06)',
                                  color: raceForm.teams.length > 0 ? 'var(--accent-secondary)' : 'var(--text-muted)',
                                  border: raceForm.teams.length > 0 ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                                  padding: '1px 6px',
                                  borderRadius: '3px'
                                }}>
                                  {raceForm.teams.length}/{allTeams.length}
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setRaceForm({ ...raceForm, teams: allTeams })}
                                  className="text-mono"
                                  style={{
                                    fontSize: '0.65rem',
                                    background: 'rgba(242, 24, 24, 0.15)',
                                    border: '1px solid var(--accent-primary)',
                                    color: '#fff',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  SELECT ALL
                                </button>
                                {raceForm.teams.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setRaceForm({ ...raceForm, teams: [] })}
                                    className="text-mono"
                                    style={{
                                      fontSize: '0.65rem',
                                      background: 'none',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      color: 'var(--text-muted)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '3px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    CLEAR
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Search bar */}
                            <div style={{ position: 'relative' }}>
                              <input
                                type="text"
                                className="input-base text-mono"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.75rem', minHeight: '36px' }}
                                placeholder="Search teams..."
                                value={teamSelectorSearch}
                                onChange={e => setTeamSelectorSearch(e.target.value)}
                              />
                              {teamSelectorSearch && (
                                <button
                                  type="button"
                                  onClick={() => setTeamSelectorSearch('')}
                                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            {/* Interactive Chips list */}
                            <div style={{
                              maxHeight: '170px',
                              overflowY: 'auto',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.4rem',
                              padding: '0.5rem',
                              background: 'rgba(0,0,0,0.4)',
                              borderRadius: '4px',
                              border: '1px solid rgba(255,255,255,0.06)'
                            }}>
                              {filteredTeams.length === 0 ? (
                                <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                                  No teams found matching search.
                                </p>
                              ) : (
                                filteredTeams.map(t => {
                                  const isSelected = raceForm.teams.some(team => team.id === t.id);
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setRaceForm({ ...raceForm, teams: raceForm.teams.filter(team => team.id !== t.id) });
                                        } else {
                                          setRaceForm({ ...raceForm, teams: [...raceForm.teams, t] });
                                        }
                                      }}
                                      className="text-mono"
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: '4px',
                                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.12)',
                                        background: isSelected ? 'rgba(242, 24, 24, 0.25)' : 'rgba(255,255,255,0.04)',
                                        color: isSelected ? '#fff' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <span>{isSelected ? '✓' : '+'}</span>
                                      <span>{t.name}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* RACERS SELECTOR */}
                          <div style={{
                            padding: '1.25rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label className="text-mono" style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }}>
                                  SELECT RACERS
                                </label>
                                <span className="text-mono" style={{
                                  fontSize: '0.65rem',
                                  background: raceForm.racers.length > 0 ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255,255,255,0.06)',
                                  color: raceForm.racers.length > 0 ? '#00ff88' : 'var(--text-muted)',
                                  border: raceForm.racers.length > 0 ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.1)',
                                  padding: '1px 6px',
                                  borderRadius: '3px'
                                }}>
                                  {raceForm.racers.length}/{eligibleRacers.length}
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setRaceForm({ ...raceForm, racers: eligibleRacers })}
                                  className="text-mono"
                                  style={{
                                    fontSize: '0.65rem',
                                    background: 'rgba(0, 255, 136, 0.15)',
                                    border: '1px solid #00ff88',
                                    color: '#00ff88',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  SELECT ALL
                                </button>
                                {raceForm.racers.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setRaceForm({ ...raceForm, racers: [] })}
                                    className="text-mono"
                                    style={{
                                      fontSize: '0.65rem',
                                      background: 'none',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      color: 'var(--text-muted)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '3px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    CLEAR
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Search bar */}
                            <div style={{ position: 'relative' }}>
                              <input
                                type="text"
                                className="input-base text-mono"
                                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.75rem', minHeight: '36px' }}
                                placeholder="Search racers or team..."
                                value={racerSelectorSearch}
                                onChange={e => setRacerSelectorSearch(e.target.value)}
                              />
                              {racerSelectorSearch && (
                                <button
                                  type="button"
                                  onClick={() => setRacerSelectorSearch('')}
                                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            {/* Interactive Chips list */}
                            <div style={{
                              maxHeight: '170px',
                              overflowY: 'auto',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.4rem',
                              padding: '0.5rem',
                              background: 'rgba(0,0,0,0.4)',
                              borderRadius: '4px',
                              border: '1px solid rgba(255,255,255,0.06)'
                            }}>
                              {filteredRacersList.length === 0 ? (
                                <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                                  {raceForm.teams.length > 0 
                                    ? 'No racers belong to the selected team(s).' 
                                    : 'No racers found matching search.'}
                                </p>
                              ) : (
                                filteredRacersList.map(r => {
                                  const isSelected = raceForm.racers.some(racer => racer.id === r.id);
                                  return (
                                    <button
                                      key={r.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setRaceForm({ ...raceForm, racers: raceForm.racers.filter(racer => racer.id !== r.id) });
                                        } else {
                                          setRaceForm({ ...raceForm, racers: [...raceForm.racers, r] });
                                        }
                                      }}
                                      className="text-mono"
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: '4px',
                                        border: isSelected ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.12)',
                                        background: isSelected ? 'rgba(0, 255, 136, 0.22)' : 'rgba(255,255,255,0.04)',
                                        color: isSelected ? '#fff' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <span>{isSelected ? '✓' : '+'}</span>
                                      <span>{r.name}</span>
                                      {r.team_name && (
                                        <span style={{ fontSize: '0.6rem', opacity: 0.7, background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '2px' }}>
                                          {r.team_name}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.25rem 2rem',
              background: 'linear-gradient(0deg, rgba(20, 5, 5, 0.98) 0%, rgba(12, 3, 3, 0.9) 100%)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {raceMode === 'CREATE' ? (
                  <>
                    <span>Teams Enrolled: <strong style={{ color: '#fff' }}>{raceForm.teams.length}</strong></span>
                    <span>•</span>
                    <span>Racers Enrolled: <strong style={{ color: '#fff' }}>{raceForm.racers.length}</strong></span>
                  </>
                ) : (
                  <span>Selected Round: <strong style={{ color: '#00ff88' }}>{selectedPendingRace ? `ROUND #${selectedPendingRace}` : 'NONE'}</strong></span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button 
                  type="button"
                  onClick={() => setShowCreateRacePanel(false)} 
                  className="btn-secondary" 
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}
                >
                  CANCEL
                </button>
                <button 
                  type="button"
                  onClick={handleCreateRace} 
                  className="btn-primary" 
                  disabled={raceMode === 'CREATE' ? !raceForm.name.trim() : !selectedPendingRace}
                  style={{ 
                    padding: '0.75rem 2rem', 
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: (raceMode === 'CREATE' ? !raceForm.name.trim() : !selectedPendingRace) ? 0.5 : 1
                  }}
                >
                  <span>{raceMode === 'CREATE' ? '⚡ CREATE RACE EVENT' : '🚀 LAUNCH BIDDING WINDOWS'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
