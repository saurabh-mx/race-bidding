'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useModal } from '@/components/ModalProvider';

export function GlobalTimer() {
  const { showConfirm, showError } = useModal();
  const [teamEnd, setTeamEnd] = useState<Date | null>(null);
  const [indEnd, setIndEnd] = useState<Date | null>(null);
  const [monthlyEnd, setMonthlyEnd] = useState<Date | null>(null);
  
  const [teamTimeLeft, setTeamTimeLeft] = useState<number>(0);
  const [indTimeLeft, setIndTimeLeft] = useState<number>(0);
  const [monthlyTimeLeft, setMonthlyTimeLeft] = useState<number>(0);
  
  const [role, setRole] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState<string>('');
  const [showWinnerPanel, setShowWinnerPanel] = useState(false);
  const [winnerInput, setWinnerInput] = useState('');
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

  const handleSetTimer = async (minutes: number, type: 'TEAM' | 'INDIVIDUAL' | 'MONTHLY') => {
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

  const handleStopTimer = async (type: 'TEAM' | 'INDIVIDUAL' | 'MONTHLY') => {
    if (type === 'TEAM') {
      await supabase.from('app_settings').update({ team_timer_end: null }).eq('id', 1);
      await supabase.from('racers').update({ is_posted: false }).eq('type', 'TEAM');
      setTeamEnd(null);
      setTeamTimeLeft(0);
    } else if (type === 'MONTHLY') {
      await supabase.from('app_settings').update({ monthly_timer_end: null }).eq('id', 1);
      await supabase.from('racers').update({ is_posted: false }).in('type', ['MONTHLY_TEAM', 'MONTHLY_RACER']);
      setMonthlyEnd(null);
      setMonthlyTimeLeft(0);
    } else {
      await supabase.from('app_settings').update({ individual_timer_end: null }).eq('id', 1);
      await supabase.from('racers').update({ is_posted: false }).not('type', 'in', '("TEAM", "MONTHLY_TEAM", "MONTHLY_RACER")');
      setIndEnd(null);
      setIndTimeLeft(0);
    }
  };
  
  const handleAnnounceWinner = async () => {
    if (!winnerInput.trim()) return;
    
    // Prevent announcement if timer is active
    if (winnerType === 'TEAM' && teamTimeLeft > 0) {
      alert("Cannot announce team winner while TEAM WINDOW is still open!");
      return;
    }
    if (winnerType === 'MONTHLY' && monthlyTimeLeft > 0) {
      alert("Cannot announce monthly winner while MONTHLY WINDOW is still open!");
      return;
    }
    if (winnerType === 'RACER' && indTimeLeft > 0) {
      alert("Cannot announce racer winner while DRIVER WINDOW is still open!");
      return;
    }

    const formattedWinner = winnerInput.trim();
    
    // --- PARIMUTUEL PAYOUT CALCULATION ---
    
    // 1. Get all currently posted racers in this category
    let postedFilter: any;
    if (winnerType === 'TEAM') {
      postedFilter = { type: 'TEAM' };
    } else if (winnerType === 'MONTHLY') {
      // Monthly includes both MONTHLY_TEAM and MONTHLY_RACER
      postedFilter = null; // handled separately
    } else {
      postedFilter = null; // handled separately
    }

    let postedRacers: any[] = [];
    if (winnerType === 'TEAM') {
      const { data } = await supabase.from('racers').select('id, name').eq('type', 'TEAM').eq('is_posted', true);
      postedRacers = data || [];
    } else if (winnerType === 'MONTHLY') {
      const { data } = await supabase.from('racers').select('id, name').in('type', ['MONTHLY_TEAM', 'MONTHLY_RACER']).eq('is_posted', true);
      postedRacers = data || [];
    } else {
      const { data } = await supabase.from('racers').select('id, name, type').eq('is_posted', true);
      postedRacers = (data || []).filter((r: any) => r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY'));
    }

    const postedRacerIds = postedRacers.map((r: any) => r.id);
    const winnerRacer = postedRacers.find((r: any) => r.name === formattedWinner);

    if (winnerRacer && postedRacerIds.length > 0) {
      // 2. Fetch all APPROVED bids on these posted racers that have not been settled yet
      const { data: allBids } = await supabase
        .from('bids')
        .select('id, racer_id, user_id, amount')
        .eq('status', 'APPROVED')
        .eq('result', 'PENDING')
        .in('racer_id', postedRacerIds);

      if (allBids && allBids.length > 0) {
        // 3. Calculate winning pool and losing pool
        const winningBids = allBids.filter((b: any) => b.racer_id === winnerRacer.id);
        const losingBids = allBids.filter((b: any) => b.racer_id !== winnerRacer.id);

        const totalWinningPool = winningBids.reduce((sum: number, b: any) => sum + b.amount, 0);
        const totalLosingPool = losingBids.reduce((sum: number, b: any) => sum + b.amount, 0);

        // 4. Calculate payouts for winners (proportional share of HALF the losing pool)
        // Payout = original bet + (user_bet / total_winning_pool) * (total_losing_pool / 2)
        for (const bid of winningBids) {
          const share = totalWinningPool > 0 ? (bid.amount / totalWinningPool) * (totalLosingPool / 2) : 0;
          const payout = bid.amount + Math.floor(share); // original bet back + half of loser's money
          
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
          details: `Announced ${winnerType} winner: ${formattedWinner}. Winning pool: $${totalWinningPool}, Losing pool: $${totalLosingPool}. ${winningBids.length} winning bets, ${losingBids.length} losing bets.`
        }]);
      }
    }
    
    // --- UPDATE LATEST WINNER DISPLAY ---
    const updateData: any = {};
    updateData.latest_winner = `${winnerType}: ${formattedWinner}`;
    
    if (winnerType === 'TEAM') {
      updateData.latest_team_winner = formattedWinner;
    } else if (winnerType === 'MONTHLY') {
      updateData.latest_monthly_winner = formattedWinner;
    } else {
      updateData.latest_racer_winner = formattedWinner;
    }

    const { data: settings } = await supabase.from('app_settings').select('current_round_id').single();
    const newRoundId = (settings?.current_round_id || 1) + 1;
    updateData.current_round_id = newRoundId;

    await supabase.from('app_settings').update(updateData).eq('id', 1);
    
    // Auto unpost and reset bids to zero for fresh start
    if (winnerType === 'TEAM') {
      await supabase.from('racers').update({ is_posted: false, current_bid: 0 }).eq('type', 'TEAM');
    } else if (winnerType === 'MONTHLY') {
      await supabase.from('racers').update({ is_posted: false, current_bid: 0 }).in('type', ['MONTHLY_TEAM', 'MONTHLY_RACER']);
    } else {
      await supabase.from('racers').update({ is_posted: false, current_bid: 0 }).not('type', 'in', '("TEAM", "MONTHLY_TEAM", "MONTHLY_RACER")');
    }

    setShowWinnerPanel(false);
    setWinnerInput('');
  };

  const handleOpenWinnerPanel = async () => {
    setShowWinnerPanel(true);
    // Fetch all currently posted racers to show in the dropdown
    const { data } = await supabase.from('racers').select('name, type').eq('is_posted', true).order('name');
    if (data) setWinnerOptions(data);
    setWinnerInput(''); // reset
  };

  const handleOpenPostList = async () => {
    setShowPostList(true);
    const { data } = await supabase.from('racers').select('*').order('name');
    if (data) setAllRacers(data);
  };

  const handleOpenCreateRacePanel = async (mode: 'CREATE' | 'START_BIDDING') => {
    setRaceMode(mode);
    setShowCreateRacePanel(true);
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

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        left: '2rem',
        top: '120px',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        pointerEvents: 'none',
        maxHeight: 'calc(100vh - 140px)',
        overflowY: 'auto',
        paddingBottom: '1rem'
      }}>
        {/* TEAM TIMER */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            borderLeft: teamTimeLeft > 0 ? '4px solid var(--accent-primary)' : '4px solid #555',
            textAlign: 'center',
            minWidth: '180px'
          }}>
            <p className="text-mono" style={{ color: teamTimeLeft > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', letterSpacing: '2px' }}>
              TEAM WINDOW
            </p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: teamTimeLeft > 0 ? '#fff' : '#666', fontFamily: 'monospace' }}>
              {teamTimeLeft > 0 ? formatTime(teamTimeLeft) : 'CLOSED'}
            </p>
          </div>

          {(role === 'admin' || role === 'management') && (
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'TEAM')} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+5M</button>
                <button onClick={() => handleSetTimer(60, 'TEAM')} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+1H</button>
                <button onClick={() => handleStopTimer('TEAM')} className="btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>STOP</button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input type="number" placeholder="Mins" className="input-base" style={{ width: '50px', padding: '0.25rem', fontSize: '0.65rem' }} value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button onClick={() => { if(customTime) { handleSetTimer(-Number(customTime), 'TEAM'); setCustomTime(''); } }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #ff4444', color: '#ff4444' }}>-CUST</button>
                <button onClick={() => { if(customTime) { handleSetTimer(Number(customTime), 'TEAM'); setCustomTime(''); } }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+CUST</button>
              </div>
            </div>
          )}
        </div>

        {/* INDIVIDUAL TIMER */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            borderLeft: indTimeLeft > 0 ? '4px solid #00ff88' : '4px solid #555',
            textAlign: 'center',
            minWidth: '180px'
          }}>
            <p className="text-mono" style={{ color: indTimeLeft > 0 ? '#00ff88' : 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', letterSpacing: '2px' }}>
              DRIVER WINDOW
            </p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: indTimeLeft > 0 ? '#fff' : '#666', fontFamily: 'monospace' }}>
              {indTimeLeft > 0 ? formatTime(indTimeLeft) : 'CLOSED'}
            </p>
          </div>

          {(role === 'admin' || role === 'management') && (
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'INDIVIDUAL')} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+5M</button>
                <button onClick={() => handleSetTimer(60, 'INDIVIDUAL')} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+1H</button>
                <button onClick={() => handleStopTimer('INDIVIDUAL')} className="btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>STOP</button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input type="number" placeholder="Mins" className="input-base" style={{ width: '50px', padding: '0.25rem', fontSize: '0.65rem' }} value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button onClick={() => { if(customTime) { handleSetTimer(-Number(customTime), 'INDIVIDUAL'); setCustomTime(''); } }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #ff4444', color: '#ff4444' }}>-CUST</button>
                <button onClick={() => { if(customTime) { handleSetTimer(Number(customTime), 'INDIVIDUAL'); setCustomTime(''); } }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+CUST</button>
              </div>
            </div>
          )}
        </div>

        {/* MONTHLY TIMER */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            borderLeft: monthlyTimeLeft > 0 ? '4px solid #ff00ff' : '4px solid #555',
            textAlign: 'center',
            minWidth: '180px'
          }}>
            <p className="text-mono" style={{ color: monthlyTimeLeft > 0 ? '#ff00ff' : 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', letterSpacing: '2px' }}>
              MONTHLY WINDOW
            </p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: monthlyTimeLeft > 0 ? '#fff' : '#666', fontFamily: 'monospace' }}>
              {monthlyTimeLeft > 0 ? formatTime(monthlyTimeLeft) : 'CLOSED'}
            </p>
          </div>

          {(role === 'admin' || role === 'management') && (
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'MONTHLY')} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+5M</button>
                <button onClick={() => handleSetTimer(60, 'MONTHLY')} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+1H</button>
                <button onClick={() => handleStopTimer('MONTHLY')} className="btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>STOP</button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input type="number" placeholder="Mins" className="input-base" style={{ width: '50px', padding: '0.25rem', fontSize: '0.65rem' }} value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button onClick={() => { if(customTime) { handleSetTimer(-Number(customTime), 'MONTHLY'); setCustomTime(''); } }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem', border: '1px solid #ff4444', color: '#ff4444' }}>-CUST</button>
                <button onClick={() => { if(customTime) { handleSetTimer(Number(customTime), 'MONTHLY'); setCustomTime(''); } }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.65rem' }}>+CUST</button>
              </div>
            </div>
          )}
        </div>

        {/* HOST RACE BET BUTTON */}
        {(role === 'admin' || role === 'management') && (
          <div style={{ pointerEvents: 'auto', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '0.85rem' }}
              onClick={() => setShowHostPanel(true)}
            >
              HOST RACE BET
            </button>
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
              ANNOUNCE LATEST WINNER
            </h3>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Enter the winner's name to broadcast to all terminals.
            </p>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={() => { setWinnerType('TEAM'); setWinnerInput(''); }} 
                className={winnerType === 'TEAM' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                TEAM WINNER
              </button>
              <button 
                onClick={() => { setWinnerType('RACER'); setWinnerInput(''); }} 
                className={winnerType === 'RACER' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                RACER WINNER
              </button>
              <button 
                onClick={() => { setWinnerType('MONTHLY'); setWinnerInput(''); }} 
                className={winnerType === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'} 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              >
                MONTHLY WINNER
              </button>
            </div>

            <select 
              className="input-base" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', textAlign: 'center', marginTop: '0.5rem' }} 
              value={winnerInput} 
              onChange={e => setWinnerInput(e.target.value)} 
            >
              <option value="" disabled>Select {winnerType}...</option>
              {winnerOptions
                .filter(r => winnerType === 'TEAM' ? r.type === 'TEAM' : winnerType === 'MONTHLY' ? (r.type === 'MONTHLY_TEAM' || r.type === 'MONTHLY_RACER') : (r.type !== 'TEAM' && r.type !== 'MONTHLY_TEAM' && r.type !== 'MONTHLY_RACER'))
                .map((r, i) => (
                  <option key={i} value={r.name}>{r.name}</option>
              ))}
            </select>
            
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
                style={{ flex: 1, padding: '1rem', fontSize: '1rem', opacity: ((winnerType === 'TEAM' && teamTimeLeft > 0) || (winnerType === 'RACER' && indTimeLeft > 0) || (winnerType === 'MONTHLY' && monthlyTimeLeft > 0)) ? 0.5 : 1 }}
                disabled={(winnerType === 'TEAM' && teamTimeLeft > 0) || (winnerType === 'RACER' && indTimeLeft > 0) || (winnerType === 'MONTHLY' && monthlyTimeLeft > 0)}
              >
                CONFIRM
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
                DRIVERS
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
                  MONTHLY DRIVERS
                </button>
              </div>
            )}

            <div className="input-base" style={{ height: '350px', overflowY: 'auto', padding: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allRacers.filter(r => postListTab === 'TEAM' ? r.type === 'TEAM' : postListTab === 'MONTHLY' ? r.type === (monthlySubTab === 'TEAM' ? 'MONTHLY_TEAM' : 'MONTHLY_RACER') : (r.type !== 'TEAM' && r.type !== 'MONTHLY_TEAM' && r.type !== 'MONTHLY_RACER')).map(racer => (
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
                ANNOUNCE WINNER
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
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setShowHostPanel(false)} className="btn-secondary" style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
      {/* CREATE RACE PANEL MODAL */}
      {showCreateRacePanel && (
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
            minWidth: '500px',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 10px 40px rgba(242, 24, 24, 0.2)'
          }}>
            <h3 className="title-gradient" style={{ fontSize: '2rem', textTransform: 'uppercase', textAlign: 'center' }}>
              {raceMode === 'CREATE' ? 'CREATE RACE' : 'START BIDDING'}
            </h3>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
              {raceMode === 'CREATE' ? 'Configure the parameters for the new race event.' : 'Select a pending race to post the participants and start the timers.'}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {raceMode === 'START_BIDDING' && pendingRaces.length > 0 && (
                <div>
                  <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>CONFIRM RACE</label>
                  <select className="input-base" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }} value={selectedPendingRace} onChange={e => setSelectedPendingRace(e.target.value)}>
                    {pendingRaces.map((pr: any, idx: number) => (
                      <option key={idx} value={pr.id} style={{ color: '#000' }}>
                        ROUND {pr.id}: {pr.name.toUpperCase()} {pr.track ? `// ${pr.track.toUpperCase()}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {raceMode === 'CREATE' && (
                <>
                  <div>
                    <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>RACE NAME</label>
                    <input type="text" className="input-base" style={{ width: '100%', padding: '0.75rem' }} value={raceForm.name} onChange={e => setRaceForm({...raceForm, name: e.target.value})} placeholder="e.g. Grand Prix Finals" />
                  </div>
                  <div>
                    <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>TRACK</label>
                    <input type="text" className="input-base" style={{ width: '100%', padding: '0.75rem' }} value={raceForm.track} onChange={e => setRaceForm({...raceForm, track: e.target.value})} placeholder="e.g. Neon Circuit" />
                  </div>
                </>
              )}
              {raceMode === 'CREATE' && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, padding: '1rem', background: 'rgba(242, 24, 24, 0.05)', border: '1px solid var(--accent-primary)', borderRadius: '4px' }}>
                    <h4 className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>TEAM SETTINGS</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>TIMER (MINUTES)</label>
                        <input type="number" className="input-base" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={raceForm.teamTimer} onChange={e => setRaceForm({...raceForm, teamTimer: e.target.value})} placeholder="e.g. 60" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>MINIMUM BET ($)</label>
                        <input type="number" className="input-base" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={raceForm.teamMinBet} onChange={e => setRaceForm({...raceForm, teamMinBet: e.target.value})} placeholder="e.g. 50" />
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, padding: '1rem', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid #00ff88', borderRadius: '4px' }}>
                    <h4 className="text-mono" style={{ color: '#00ff88', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>DRIVER SETTINGS</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>TIMER (MINUTES)</label>
                        <input type="number" className="input-base" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={raceForm.racerTimer} onChange={e => setRaceForm({...raceForm, racerTimer: e.target.value})} placeholder="e.g. 60" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>MINIMUM BET ($)</label>
                        <input type="number" className="input-base" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={raceForm.racerMinBet} onChange={e => setRaceForm({...raceForm, racerMinBet: e.target.value})} placeholder="e.g. 50" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {raceMode === 'CREATE' && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>SELECT TEAMS</label>
                      <button 
                        onClick={() => {
                          const allTeams = allRacers.filter(r => r.type === 'TEAM');
                          setRaceForm({...raceForm, teams: allTeams});
                        }}
                        className="text-mono" 
                        style={{ fontSize: '0.65rem', background: 'none', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.15rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        SELECT ALL
                      </button>
                    </div>
                    <div className="input-base" style={{ minHeight: '3rem', padding: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {raceForm.teams.map(t => (
                        <span key={t.id} style={{ background: 'rgba(242, 24, 24, 0.2)', border: '1px solid var(--accent-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {t.name}
                          <button onClick={() => setRaceForm({...raceForm, teams: raceForm.teams.filter(team => team.id !== t.id)})} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>×</button>
                        </span>
                      ))}
                      <select 
                        style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', flex: 1, minWidth: '120px' }} 
                        value="" 
                        onChange={e => {
                          const teamId = e.target.value;
                          if (!teamId) return;
                          const teamObj = allRacers.find(r => r.id === teamId);
                          if (teamObj && !raceForm.teams.some(t => t.id === teamId)) {
                            setRaceForm({...raceForm, teams: [...raceForm.teams, teamObj]});
                          }
                        }}
                      >
                        <option value="" style={{ color: '#000' }}>+ Add Team</option>
                        {allRacers.filter(r => r.type === 'TEAM' && !raceForm.teams.some(t => t.id === r.id)).map(t => (
                          <option key={t.id} value={t.id} style={{ color: '#000' }}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>SELECT RACERS</label>
                      <button 
                        onClick={() => {
                          const filteredRacers = allRacers
                            .filter(r => r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY'))
                            .filter(r => {
                              if (raceForm.teams.length === 0) return true;
                              return raceForm.teams.some(t => r.team_name === t.name || r.captain_name === t.name || (t.roster && t.roster.includes(r.name)));
                            });
                          setRaceForm({...raceForm, racers: filteredRacers});
                        }}
                        className="text-mono" 
                        style={{ fontSize: '0.65rem', background: 'none', border: '1px solid #00ff88', color: '#00ff88', padding: '0.15rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        SELECT ALL
                      </button>
                    </div>
                    <div className="input-base" style={{ minHeight: '3rem', padding: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {raceForm.racers.map(r => (
                        <span key={r.id} style={{ background: 'rgba(0, 255, 136, 0.2)', border: '1px solid #00ff88', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {r.name}
                          <button onClick={() => setRaceForm({...raceForm, racers: raceForm.racers.filter(racer => racer.id !== r.id)})} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>×</button>
                        </span>
                      ))}
                      <select 
                        style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', flex: 1, minWidth: '120px' }} 
                        value="" 
                        onChange={e => {
                          const racerId = e.target.value;
                          if (!racerId) return;
                          const racerObj = allRacers.find(r => r.id === racerId);
                          if (racerObj && !raceForm.racers.some(r => r.id === racerId)) {
                            setRaceForm({...raceForm, racers: [...raceForm.racers, racerObj]});
                          }
                        }}
                      >
                        <option value="" style={{ color: '#000' }}>+ Add Racer</option>
                        {allRacers
                          .filter(r => r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY') && !raceForm.racers.some(existing => existing.id === r.id))
                          .filter(r => {
                            if (raceForm.teams.length === 0) return true;
                            return raceForm.teams.some(t => r.team_name === t.name || r.captain_name === t.name || (t.roster && t.roster.includes(r.name)));
                          })
                          .map(r => (
                            <option key={r.id} value={r.id} style={{ color: '#000' }}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowCreateRacePanel(false)} className="btn-secondary" style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>CANCEL</button>
              <button onClick={handleCreateRace} className="btn-primary" style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
