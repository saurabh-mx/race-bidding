'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { AccessibleButton, AccessibleInput, AccessibleSelect } from '@/components/SeniorComponents';
import Leaderboard from '@/components/Leaderboard';
import BetLeaderboard from '@/components/BetLeaderboard';

export default function StreamerPanel() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Widget visibility state
  const [showRaceLeaderboard, setShowRaceLeaderboard] = useState(true);
  const [showBetLeaderboard, setShowBetLeaderboard] = useState(true);
  const [showCenterTicker, setShowCenterTicker] = useState(true);
  const [showTimers, setShowTimers] = useState(true);
  const [tickerText, setTickerText] = useState('STAND BY FOR SECURE TRANSMISSION');

  // Timer state
  const [teamEnd, setTeamEnd] = useState<Date | null>(null);
  const [indEnd, setIndEnd] = useState<Date | null>(null);
  const [monthlyEnd, setMonthlyEnd] = useState<Date | null>(null);
  const [teamTimeLeft, setTeamTimeLeft] = useState(0);
  const [indTimeLeft, setIndTimeLeft] = useState(0);
  const [monthlyTimeLeft, setMonthlyTimeLeft] = useState(0);

  // Profile Showcase variables
  const [teams, setTeams] = useState<any[]>([]);
  const [racers, setRacers] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileType, setProfileType] = useState<'TEAM'|'RACER'>('RACER');
  const [profileId, setProfileId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
        
      if (!profile || (profile.role !== 'management' && profile.role !== 'admin')) {
        router.replace('/dashboard');
        return;
      }
      
      setRole(profile.role);
      
      const { data: teamData } = await supabase.from('racers').select('*').eq('type', 'TEAM').order('name');
      if (teamData) setTeams(teamData);
      
      const { data: racerData } = await supabase.from('racers').select('*').neq('type', 'TEAM').order('name');
      if (racerData) setRacers(racerData);
      if (racerData && racerData.length > 0) setProfileId(racerData[0].id);

      setIsLoading(false);
    };
    init();
  }, [router]);

  // Broadcast state changes whenever they update
  useEffect(() => {
    if (isLoading) return;
    const channel = supabase.channel('streamer-controls');
    
    // We only need to subscribe once to send
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'update-controls',
          payload: { showRaceLeaderboard, showBetLeaderboard, showCenterTicker, showTimers, tickerText, showProfile, profileType, profileId }
        });
      }
    });

    // Also dispatch locally so the panel's own GlobalTimer can update instantly without Supabase collision
    window.dispatchEvent(new CustomEvent('local-timer-toggle', { detail: { showTimers } }));

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [showRaceLeaderboard, showBetLeaderboard, showCenterTicker, showTimers, tickerText, showProfile, profileType, profileId, isLoading]);

  // Fetch and subscribe to timer end values
  useEffect(() => {
    const fetchTimers = async () => {
      const { data } = await supabase.from('app_settings').select('team_timer_end, individual_timer_end, monthly_timer_end').eq('id', 1).single();
      if (data) {
        setTeamEnd(data.team_timer_end ? new Date(data.team_timer_end) : null);
        setIndEnd(data.individual_timer_end ? new Date(data.individual_timer_end) : null);
        setMonthlyEnd(data.monthly_timer_end ? new Date(data.monthly_timer_end) : null);
      }
    };
    fetchTimers();

    const timerChannel = supabase.channel('panel_timer_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
        setTeamEnd(payload.new.team_timer_end ? new Date(payload.new.team_timer_end) : null);
        setIndEnd(payload.new.individual_timer_end ? new Date(payload.new.individual_timer_end) : null);
        setMonthlyEnd(payload.new.monthly_timer_end ? new Date(payload.new.monthly_timer_end) : null);
      })
      .subscribe();

    const interval = setInterval(() => {
      const now = Date.now();
      setTeamTimeLeft(teamEnd ? Math.max(0, Math.floor((teamEnd.getTime() - now) / 1000)) : 0);
      setIndTimeLeft(indEnd ? Math.max(0, Math.floor((indEnd.getTime() - now) / 1000)) : 0);
      setMonthlyTimeLeft(monthlyEnd ? Math.max(0, Math.floor((monthlyEnd.getTime() - now) / 1000)) : 0);
    }, 1000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(timerChannel);
    };
  }, [teamEnd, indEnd, monthlyEnd]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetTimer = async (minutes: number, type: 'TEAM' | 'INDIVIDUAL' | 'MONTHLY') => {
    const currentEnd = type === 'TEAM' ? (teamEnd ? teamEnd.getTime() : Date.now()) : type === 'MONTHLY' ? (monthlyEnd ? monthlyEnd.getTime() : Date.now()) : (indEnd ? indEnd.getTime() : Date.now());
    const newEnd = new Date(Math.max(Date.now(), currentEnd) + minutes * 60000);
    const col = type === 'TEAM' ? 'team_timer_end' : type === 'MONTHLY' ? 'monthly_timer_end' : 'individual_timer_end';
    await supabase.from('app_settings').update({ [col]: newEnd.toISOString() }).eq('id', 1);
    if (type === 'TEAM') setTeamEnd(newEnd);
    else if (type === 'MONTHLY') setMonthlyEnd(newEnd);
    else setIndEnd(newEnd);
  };

  const handleStopTimer = async (type: 'TEAM' | 'INDIVIDUAL' | 'MONTHLY') => {
    const col = type === 'TEAM' ? 'team_timer_end' : type === 'MONTHLY' ? 'monthly_timer_end' : 'individual_timer_end';
    await supabase.from('app_settings').update({ [col]: null }).eq('id', 1);
    if (type === 'TEAM') { setTeamEnd(null); setTeamTimeLeft(0); }
    else if (type === 'MONTHLY') { setMonthlyEnd(null); setMonthlyTimeLeft(0); }
    else { setIndEnd(null); setIndTimeLeft(0); }
  };

  if (isLoading) return <div style={{ color: '#fff', padding: '2rem' }}>Loading access clearance...</div>;

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundImage: 'radial-gradient(circle at center, rgba(30, 5, 5, 0.4) 0%, rgba(5, 2, 2, 0.95) 100%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
      padding: '2rem',
      fontFamily: 'var(--font-mono)',
      position: 'relative'
    }}>
      
      {/* HEADER CONTROLS (Only visible in panel) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.8)', borderBottom: '2px solid var(--accent-primary)', zIndex: 100 }}>
        <div>
          <h1 className="title-gradient" style={{ fontSize: '1.5rem', margin: 0, textTransform: 'uppercase' }}>Streamer Panel (Director Mode)</h1>
          <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>CHANGES SYNC IN REAL-TIME TO STREAMER VIEW</p>
        </div>
        <Link href="/dashboard" className="btn-secondary" style={{ padding: '0.5rem 1rem', textDecoration: 'none', fontSize: '0.85rem' }}>
          RETURN TO DASHBOARD
        </Link>
      </div>

      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'minmax(350px, 400px) 1fr minmax(350px, 400px)',
        gap: '2rem',
        marginTop: '60px' // offset for header
      }}>
        
        {/* LEFT COLUMN: RACE LEADERBOARD CONTROL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px dashed #00ff88', padding: '1rem', borderRadius: '8px' }}>
            <AccessibleButton 
              variant={showRaceLeaderboard ? 'primary' : 'secondary'}
              onClick={() => setShowRaceLeaderboard(!showRaceLeaderboard)}
              style={{ width: '100%' }}
            >
              {showRaceLeaderboard ? 'HIDE ON STREAM' : 'SHOW ON STREAM'}
            </AccessibleButton>
          </div>
          <div style={{ opacity: showRaceLeaderboard ? 0.95 : 0.3, filter: 'drop-shadow(0 0 20px rgba(242, 24, 24, 0.2))' }}>
            <Leaderboard />
          </div>
        </div>

        {/* CENTER: MAIN LIVE STATS & CLOCK CONTROL */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '2rem' }}>
          
          {/* TIMER CONTROLS */}
          <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px dashed #00ff88', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="text-mono" style={{ color: '#00ff88', margin: 0 }}>TIMER CONTROLS</h3>
              <AccessibleButton
                variant={showTimers ? 'primary' : 'secondary'}
                onClick={() => setShowTimers(!showTimers)}
                style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
              >
                {showTimers ? 'HIDE ON STREAM' : 'SHOW ON STREAM'}
              </AccessibleButton>
            </div>

            {/* Timer Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              {/* TEAM TIMER */}
              <div style={{ background: teamTimeLeft > 0 ? 'rgba(242,24,24,0.15)' : 'rgba(255,255,255,0.03)', border: teamTimeLeft > 0 ? '1px solid rgba(242,24,24,0.5)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <p className="text-mono" style={{ color: teamTimeLeft > 0 ? 'var(--accent-primary)' : '#666', fontSize: '0.7rem', letterSpacing: '2px', margin: 0 }}>TEAM</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: teamTimeLeft > 0 ? '#fff' : '#444', fontFamily: 'monospace', margin: 0 }}>
                  {teamTimeLeft > 0 ? formatTime(teamTimeLeft) : 'CLOSED'}
                </p>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={() => handleSetTimer(5, 'TEAM')} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>+5M</button>
                  <button onClick={() => handleSetTimer(60, 'TEAM')} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>+1H</button>
                  <button onClick={() => handleStopTimer('TEAM')} className="btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>STOP</button>
                </div>
              </div>

              {/* RACER TIMER */}
              <div style={{ background: indTimeLeft > 0 ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)', border: indTimeLeft > 0 ? '1px solid rgba(0,255,136,0.4)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <p className="text-mono" style={{ color: indTimeLeft > 0 ? '#00ff88' : '#666', fontSize: '0.7rem', letterSpacing: '2px', margin: 0 }}>RACER</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: indTimeLeft > 0 ? '#fff' : '#444', fontFamily: 'monospace', margin: 0 }}>
                  {indTimeLeft > 0 ? formatTime(indTimeLeft) : 'CLOSED'}
                </p>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={() => handleSetTimer(5, 'INDIVIDUAL')} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>+5M</button>
                  <button onClick={() => handleSetTimer(60, 'INDIVIDUAL')} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>+1H</button>
                  <button onClick={() => handleStopTimer('INDIVIDUAL')} className="btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>STOP</button>
                </div>
              </div>

              {/* MONTHLY TIMER */}
              <div style={{ background: monthlyTimeLeft > 0 ? 'rgba(255,0,255,0.1)' : 'rgba(255,255,255,0.03)', border: monthlyTimeLeft > 0 ? '1px solid rgba(255,0,255,0.4)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <p className="text-mono" style={{ color: monthlyTimeLeft > 0 ? '#ff00ff' : '#666', fontSize: '0.7rem', letterSpacing: '2px', margin: 0 }}>MONTHLY</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: monthlyTimeLeft > 0 ? '#fff' : '#444', fontFamily: 'monospace', margin: 0 }}>
                  {monthlyTimeLeft > 0 ? formatTime(monthlyTimeLeft) : 'CLOSED'}
                </p>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={() => handleSetTimer(5, 'MONTHLY')} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>+5M</button>
                  <button onClick={() => handleSetTimer(60, 'MONTHLY')} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>+1H</button>
                  <button onClick={() => handleStopTimer('MONTHLY')} className="btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>STOP</button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px dashed #00ff88', padding: '1.5rem', borderRadius: '8px', width: '100%', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <AccessibleInput 
                  label="TICKER TEXT OVERRIDE"
                  id="tickerText"
                  value={tickerText}
                  onChange={(e: any) => setTickerText(e.target.value)}
                  placeholder="Enter custom ticker message..."
                />
              </div>
              <AccessibleButton 
                variant={showCenterTicker ? 'primary' : 'secondary'}
                onClick={() => setShowCenterTicker(!showCenterTicker)}
                style={{ marginBottom: '24px', height: '48px' }} // Align with input
              >
                {showCenterTicker ? 'HIDE' : 'SHOW'}
              </AccessibleButton>
            </div>
          </div>

          <div className="glass-panel" style={{ 
            padding: '2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            borderLeft: '4px solid var(--accent-primary)',
            borderRight: '4px solid var(--accent-primary)',
            background: 'linear-gradient(90deg, rgba(242,24,24,0.1) 0%, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.8) 80%, rgba(242,24,24,0.1) 100%)',
            opacity: showCenterTicker ? 1 : 0.3,
            marginBottom: '2rem'
          }}>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '1.5rem', margin: 0, letterSpacing: '6px', textAlign: 'center' }}>
              [ {tickerText} ]
            </p>
          </div>

          {/* Profile Showcase Control */}
          <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px dashed #00ff88', padding: '1.5rem', borderRadius: '8px', width: '100%', marginBottom: '1rem' }}>
            <h3 className="text-mono" style={{ color: '#00ff88', marginBottom: '1rem', marginTop: 0 }}>PROFILE SHOWCASE OVERLAY</h3>
            
            <div style={{ marginBottom: '0.75rem' }}>
              <AccessibleSelect 
                label="PROFILE TYPE"
                id="profileType"
                value={profileType} 
                onChange={(e: any) => {
                  setProfileType(e.target.value);
                  setProfileId(e.target.value === 'TEAM' ? (teams[0]?.id || '') : (racers[0]?.id || ''));
                }}
              >
                <option value="TEAM">TEAM</option>
                <option value="RACER">RACER</option>
              </AccessibleSelect>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <AccessibleSelect 
                label="SELECT ENTITY"
                id="profileId"
                value={profileId} 
                onChange={(e: any) => setProfileId(e.target.value)}
              >
                {profileType === 'TEAM' 
                  ? teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                  : racers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                }
              </AccessibleSelect>
            </div>

            <AccessibleButton 
              variant={showProfile ? 'primary' : 'secondary'}
              onClick={() => setShowProfile(!showProfile)}
              style={{ width: '100%' }}
            >
              {showProfile ? 'HIDE PROFILE ON STREAM' : 'SHOW PROFILE ON STREAM'}
            </AccessibleButton>
          </div>

          <div className="glass-panel" style={{ 
            padding: '2rem',
            width: '100%',
            opacity: showProfile ? 1 : 0.3,
            borderLeft: '4px solid #00ff88'
          }}>
            <h2 className="title-gradient" style={{ textAlign: 'center', margin: 0 }}>PROFILE PREVIEW</h2>
            {profileId ? (
              <div style={{ width: '100%', height: '800px', marginTop: '1rem', overflow: 'hidden' }}>
                <iframe 
                  src={`/racer/${profileId}?stream=true&director=true`}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                  title="Profile Preview"
                />
              </div>
            ) : (
              <p className="text-mono" style={{ textAlign: 'center', color: '#888', marginTop: '1rem' }}>
                Select a profile above. It will render fully in the OBS Streamer view.
              </p>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: BET LEADERBOARD CONTROL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px dashed #00ff88', padding: '1rem', borderRadius: '8px' }}>
            <AccessibleButton 
              variant={showBetLeaderboard ? 'primary' : 'secondary'}
              onClick={() => setShowBetLeaderboard(!showBetLeaderboard)}
              style={{ width: '100%' }}
            >
              {showBetLeaderboard ? 'HIDE ON STREAM' : 'SHOW ON STREAM'}
            </AccessibleButton>
          </div>
          <div style={{ opacity: showBetLeaderboard ? 0.95 : 0.3, filter: 'drop-shadow(0 0 20px rgba(242, 24, 24, 0.2))' }}>
            <BetLeaderboard />
          </div>
        </div>
      </div>
    </div>
  );
}
