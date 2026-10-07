'use client';
import { useState, useEffect, useRef } from 'react';
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
  const [streamUrl, setStreamUrl] = useState('');
  const [showStreamPreview, setShowStreamPreview] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(100);
  const [videoQuality, setVideoQuality] = useState('auto');
  const [ytControls, setYtControls] = useState(false);
  const [ytModestBranding, setYtModestBranding] = useState(true);
  const [ytRel, setYtRel] = useState(false);
  const [ytAnnotations, setYtAnnotations] = useState(false);
  
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [videoSeekData, setVideoSeekData] = useState<{ time: number, nonce: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scrollData, setScrollData] = useState<{ y: number, nonce: number } | null>(null);

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
          payload: { showRaceLeaderboard, showBetLeaderboard, showCenterTicker, showTimers, tickerText, showProfile, profileType, profileId, streamUrl, showStreamPreview, videoPlaying, videoMuted, videoVolume, videoQuality, ytControls, ytModestBranding, ytRel, ytAnnotations, videoSeekData, scrollData }
        });
      }
    });

    // Also dispatch locally so the panel's own GlobalTimer can update instantly without Supabase collision
    window.dispatchEvent(new CustomEvent('local-timer-toggle', { detail: { showTimers } }));

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [showRaceLeaderboard, showBetLeaderboard, showCenterTicker, showTimers, tickerText, showProfile, profileType, profileId, streamUrl, showStreamPreview, videoPlaying, videoMuted, videoVolume, videoQuality, ytControls, ytModestBranding, ytRel, ytAnnotations, videoSeekData, scrollData, isLoading]);

  // Scroll Sync Broadcaster
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight;
        const winHeight = window.innerHeight;
        const scrollPercent = (docHeight - winHeight) > 0 ? scrollTop / (docHeight - winHeight) : 0;
        setScrollData({ y: scrollPercent, nonce: Date.now() });
      }, 100); // 10fps throttle for smooth but safe syncing
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

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
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        let videoId = '';
        if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        } else if (urlObj.pathname.startsWith('/live/')) {
          videoId = urlObj.pathname.split('/')[2];
        } else {
          videoId = urlObj.searchParams.get('v') || '';
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=${ytControls ? 1 : 0}&enablejsapi=1&modestbranding=${ytModestBranding ? 1 : 0}&rel=${ytRel ? 1 : 0}&iv_load_policy=${ytAnnotations ? 1 : 3}&fs=0&disablekb=1` : url;
      } else if (urlObj.hostname.includes('kick.com') && !urlObj.hostname.includes('player.kick.com')) {
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
           return `https://player.kick.com/${parts[0]}?autoplay=true&muted=true`;
        }
      }
    } catch(e) {
      return url;
    }
    return url;
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'infoDelivery' && data.info) {
          if (data.info.duration) setVideoDuration(data.info.duration);
          if (data.info.currentTime && !isScrubbing) setVideoCurrentTime(data.info.currentTime);
        }
      } catch (err) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isScrubbing]);

  useEffect(() => {
    if (!streamUrl) return;
    const interval = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [streamUrl]);

  useEffect(() => {
    if (videoSeekData && iframeRef.current && iframeRef.current.contentWindow) {
      if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [videoSeekData.time, true] }), '*');
      }
    }
  }, [videoSeekData, streamUrl]);

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
      backgroundImage: 'radial-gradient(circle at center, rgba(15, 15, 20, 0.95) 0%, rgba(5, 5, 8, 1) 100%)',
      padding: '1.5rem',
      fontFamily: 'var(--font-mono)',
      position: 'relative'
    }}>
      
      {/* HEADER */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(0,255,136,0.2)', zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88' }} />
          <div>
            <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#fff', letterSpacing: '2px', fontWeight: 900 }}>DIRECTOR CONSOLE</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: 0, letterSpacing: '1px' }}>REAL-TIME OBS SYNC</p>
          </div>
        </div>
        <Link href="/dashboard" className="btn-secondary" style={{ padding: '0.4rem 1rem', textDecoration: 'none', fontSize: '0.75rem' }}>
          EXIT TO DASHBOARD
        </Link>
      </div>

      <div style={{ marginTop: '70px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* TOP ROW: TIMERS & GLOBALS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          
          <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #ff0055' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#ff0055', letterSpacing: '2px' }}>TEAM WINDOW</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: teamTimeLeft > 0 ? '#fff' : '#444', fontFamily: 'monospace' }}>
                {teamTimeLeft > 0 ? formatTime(teamTimeLeft) : 'CLOSED'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'TEAM')} className="btn-secondary" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}>+5M</button>
                <button onClick={() => handleStopTimer('TEAM')} className="btn-primary" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}>STOP</button>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #00ff88' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#00ff88', letterSpacing: '2px' }}>RACER WINDOW</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: indTimeLeft > 0 ? '#fff' : '#444', fontFamily: 'monospace' }}>
                {indTimeLeft > 0 ? formatTime(indTimeLeft) : 'CLOSED'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'INDIVIDUAL')} className="btn-secondary" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}>+5M</button>
                <button onClick={() => handleStopTimer('INDIVIDUAL')} className="btn-primary" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}>STOP</button>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #ff00ff' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#ff00ff', letterSpacing: '2px' }}>MONTHLY WINDOW</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: monthlyTimeLeft > 0 ? '#fff' : '#444', fontFamily: 'monospace' }}>
                {monthlyTimeLeft > 0 ? formatTime(monthlyTimeLeft) : 'CLOSED'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <button onClick={() => handleSetTimer(5, 'MONTHLY')} className="btn-secondary" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}>+5M</button>
                <button onClick={() => handleStopTimer('MONTHLY')} className="btn-primary" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}>STOP</button>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #00aaff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#00aaff', letterSpacing: '2px' }}>GLOBAL CONTROLS</h3>
            <AccessibleButton
              variant={showTimers ? 'primary' : 'secondary'}
              onClick={() => setShowTimers(!showTimers)}
              style={{ padding: '0.4rem', fontSize: '0.7rem', width: '100%', marginBottom: '0.5rem' }}
            >
              {showTimers ? 'HIDE TIMERS' : 'SHOW TIMERS'}
            </AccessibleButton>
            <AccessibleButton 
              variant={showCenterTicker ? 'primary' : 'secondary'}
              onClick={() => setShowCenterTicker(!showCenterTicker)}
              style={{ padding: '0.4rem', fontSize: '0.7rem', width: '100%' }}
            >
              {showCenterTicker ? 'HIDE TICKER' : 'SHOW TICKER'}
            </AccessibleButton>
          </div>

        </div>

        {/* MIDDLE ROW: 3 COLUMNS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr minmax(300px, 350px)', gap: '1rem' }}>
          
          {/* LEFT: LEADERBOARDS & TICKER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #00ff88' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#00ff88', letterSpacing: '2px' }}>TICKER OVERRIDE</h3>
              <AccessibleInput 
                id="tickerText"
                value={tickerText}
                onChange={(e: any) => setTickerText(e.target.value)}
                placeholder="Custom ticker message..."
              />
            </div>
            
            <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #ff0055', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.75rem', color: '#ff0055', letterSpacing: '2px' }}>RACE LEADERBOARD</h3>
                <AccessibleButton variant={showRaceLeaderboard ? 'primary' : 'secondary'} onClick={() => setShowRaceLeaderboard(!showRaceLeaderboard)} style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }}>
                  {showRaceLeaderboard ? 'HIDE' : 'SHOW'}
                </AccessibleButton>
              </div>
              <div style={{ opacity: showRaceLeaderboard ? 1 : 0.3, transform: 'scale(0.9)', transformOrigin: 'top left', width: '110%' }}>
                <Leaderboard />
              </div>
            </div>
          </div>

          {/* CENTER: VIDEO INJECTOR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #00aaff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#00aaff', letterSpacing: '2px' }}>STREAM INJECTOR</h3>
                <AccessibleButton variant={showStreamPreview ? 'primary' : 'secondary'} onClick={() => setShowStreamPreview(!showStreamPreview)} style={{ fontSize: '0.65rem', padding: '0.3rem 0.75rem' }}>
                  {showStreamPreview ? 'LIVE ON STREAM' : 'HIDDEN'}
                </AccessibleButton>
              </div>

              {/* Video Preview Box */}
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                {streamUrl ? (
                  <iframe 
                    ref={iframeRef}
                    src={getEmbedUrl(streamUrl)}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Video Preview"
                    allow="autoplay; encrypted-media; fullscreen"
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '0.8rem' }}>
                    NO VIDEO SOURCE
                  </div>
                )}
                {!showStreamPreview && streamUrl && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(242,24,24,0.8)', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>OFFLINE</div>
                )}
              </div>

              {/* URL Input */}
              <div>
                <AccessibleInput 
                  id="streamUrl"
                  value={streamUrl} 
                  onChange={(e: any) => setStreamUrl(e.target.value)}
                  placeholder="Paste YouTube or Kick URL..."
                />
              </div>

              {/* Media Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <AccessibleButton variant={videoPlaying ? 'primary' : 'secondary'} onClick={() => setVideoPlaying(true)}>PLAY</AccessibleButton>
                <AccessibleButton variant={!videoPlaying ? 'primary' : 'secondary'} onClick={() => setVideoPlaying(false)}>PAUSE</AccessibleButton>
              </div>

              {/* Scrub Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#888', fontFamily: 'monospace' }}>
                  <span>{formatTime(Math.floor(videoCurrentTime))}</span>
                  <span>{formatTime(Math.floor(videoDuration))}</span>
                </div>
                <input 
                  type="range" min="0" max={videoDuration || 100} value={videoCurrentTime} 
                  onMouseDown={() => setIsScrubbing(true)}
                  onChange={(e) => setVideoCurrentTime(Number(e.target.value))}
                  onMouseUp={(e) => {
                    setIsScrubbing(false);
                    setVideoSeekData({ time: Number((e.target as HTMLInputElement).value), nonce: Date.now() });
                  }}
                  style={{ width: '100%', accentColor: '#00aaff', cursor: 'pointer' }}
                />
              </div>

              {/* Audio & Quality */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => setVideoMuted(false)} className={!videoMuted ? 'btn-primary' : 'btn-secondary'} style={{ padding: '0.4rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>🔊</button>
                  <button onClick={() => setVideoMuted(true)} className={videoMuted ? 'btn-primary' : 'btn-secondary'} style={{ padding: '0.4rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>🔇</button>
                </div>
                <input 
                  type="range" min="0" max="100" value={videoVolume} 
                  onChange={(e) => setVideoVolume(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#00aaff', cursor: 'pointer' }}
                />
                <select 
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.4rem', borderRadius: '4px', fontSize: '0.7rem', outline: 'none' }}
                >
                  <option value="auto">Auto</option>
                  <option value="hd1080">1080p</option>
                  <option value="hd720">720p</option>
                </select>
              </div>

              {/* Advanced Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <button onClick={() => setYtControls(!ytControls)} className={ytControls ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.65rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>{ytControls ? 'CONTROLS: ON' : 'CONTROLS: OFF'}</button>
                <button onClick={() => setYtModestBranding(!ytModestBranding)} className={ytModestBranding ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.65rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>{ytModestBranding ? 'MIN LOGO: ON' : 'MIN LOGO: OFF'}</button>
                <button onClick={() => setYtRel(!ytRel)} className={ytRel ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.65rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>{ytRel ? 'RELATED: ON' : 'RELATED: OFF'}</button>
                <button onClick={() => setYtAnnotations(!ytAnnotations)} className={ytAnnotations ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.65rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>{ytAnnotations ? 'ANNOTATIONS: ON' : 'ANNOTATIONS: OFF'}</button>
              </div>

            </div>
          </div>

          {/* RIGHT: BET LEADERBOARD & PROFILE SHOWCASE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #ff00ff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.75rem', color: '#ff00ff', letterSpacing: '2px' }}>PROFILE SHOWCASE</h3>
                <AccessibleButton variant={showProfile ? 'primary' : 'secondary'} onClick={() => setShowProfile(!showProfile)} style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }}>
                  {showProfile ? 'HIDE' : 'SHOW'}
                </AccessibleButton>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <AccessibleSelect label="TYPE" id="profileType" value={profileType} onChange={(e: any) => { setProfileType(e.target.value); setProfileId(e.target.value === 'TEAM' ? (teams[0]?.id || '') : (racers[0]?.id || '')); }}>
                    <option value="TEAM">TEAM</option>
                    <option value="RACER">RACER</option>
                  </AccessibleSelect>
                </div>
                <div style={{ flex: 2 }}>
                  <AccessibleSelect label="SELECT" id="profileId" value={profileId} onChange={(e: any) => setProfileId(e.target.value)}>
                    {profileType === 'TEAM' ? teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : racers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </AccessibleSelect>
                </div>
              </div>

              {profileId && (
                <div style={{ width: '100%', height: '300px', background: '#000', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                  <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '166%', height: '166%' }}>
                    <iframe src={`/racer/${profileId}?stream=true&director=true`} style={{ width: '100%', height: '100%', border: 'none' }} title="Profile Preview" />
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1rem', borderTop: '3px solid #ffb700', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.75rem', color: '#ffb700', letterSpacing: '2px' }}>BET POOLS</h3>
                <AccessibleButton variant={showBetLeaderboard ? 'primary' : 'secondary'} onClick={() => setShowBetLeaderboard(!showBetLeaderboard)} style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }}>
                  {showBetLeaderboard ? 'HIDE' : 'SHOW'}
                </AccessibleButton>
              </div>
              <div style={{ opacity: showBetLeaderboard ? 1 : 0.3, transform: 'scale(0.9)', transformOrigin: 'top left', width: '110%' }}>
                <BetLeaderboard />
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
