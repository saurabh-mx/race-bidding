'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Leaderboard from '@/components/Leaderboard';
import BetLeaderboard from '@/components/BetLeaderboard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function StreamerMode() {
  const [showRaceLeaderboard, setShowRaceLeaderboard] = useState(true);
  const [showBetLeaderboard, setShowBetLeaderboard] = useState(true);
  const [showCenterTicker, setShowCenterTicker] = useState(true);
  const [tickerText, setTickerText] = useState('STAND BY FOR SECURE TRANSMISSION');
  
  // Profile Showcase variables
  const [showProfile, setShowProfile] = useState(false);
  const [profileType, setProfileType] = useState<'TEAM'|'RACER'>('RACER');
  const [profileId, setProfileId] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [profileBids, setProfileBids] = useState<any[]>([]);
  
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
  
  const [videoSeekData, setVideoSeekData] = useState<{ time: number, nonce: number } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  
  // Fetch profile data when ID or Type changes
  useEffect(() => {
    if (!profileId) {
      setProfileData(null);
      setProfileBids([]);
      return;
    }
    const fetchProfile = async () => {
      const { data } = await supabase.from('racers').select('*').eq('id', profileId).single();
      if (data) setProfileData(data);
      
      const { data: bidsData } = await supabase
        .from('bids')
        .select('*')
        .eq('racer_id', profileId)
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false });
        
      if (bidsData) setProfileBids(bidsData);
    };
    fetchProfile();
  }, [profileId, profileType]);

  useEffect(() => {
    const controlsChannel = supabase.channel('streamer-controls')
      .on('broadcast', { event: 'update-controls' }, (payload) => {
        if (payload.payload) {
          if (payload.payload.showRaceLeaderboard !== undefined) setShowRaceLeaderboard(payload.payload.showRaceLeaderboard);
          if (payload.payload.showBetLeaderboard !== undefined) setShowBetLeaderboard(payload.payload.showBetLeaderboard);
          if (payload.payload.showCenterTicker !== undefined) setShowCenterTicker(payload.payload.showCenterTicker);
          if (payload.payload.tickerText !== undefined) setTickerText(payload.payload.tickerText);
          if (payload.payload.showProfile !== undefined) setShowProfile(payload.payload.showProfile);
          if (payload.payload.profileType !== undefined) setProfileType(payload.payload.profileType);
          if (payload.payload.profileId !== undefined) setProfileId(payload.payload.profileId);
          if (payload.payload.streamUrl !== undefined) setStreamUrl(payload.payload.streamUrl);
          if (payload.payload.showStreamPreview !== undefined) setShowStreamPreview(payload.payload.showStreamPreview);
          if (payload.payload.videoPlaying !== undefined) setVideoPlaying(payload.payload.videoPlaying);
          if (payload.payload.videoMuted !== undefined) setVideoMuted(payload.payload.videoMuted);
          if (payload.payload.videoVolume !== undefined) setVideoVolume(payload.payload.videoVolume);
          if (payload.payload.videoQuality !== undefined) setVideoQuality(payload.payload.videoQuality);
          
          if (payload.payload.ytControls !== undefined) setYtControls(payload.payload.ytControls);
          if (payload.payload.ytModestBranding !== undefined) setYtModestBranding(payload.payload.ytModestBranding);
          if (payload.payload.ytRel !== undefined) setYtRel(payload.payload.ytRel);
          if (payload.payload.ytAnnotations !== undefined) setYtAnnotations(payload.payload.ytAnnotations);
          
          if (payload.payload.videoSeekData !== undefined) setVideoSeekData(payload.payload.videoSeekData);

          // Dispatch locally so the GlobalTimer (rendered in layout) can pick up the state change safely
          if (payload.payload.showTimers !== undefined) {
            window.dispatchEvent(new CustomEvent('local-timer-toggle', { detail: { showTimers: payload.payload.showTimers } }));
          }
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(controlsChannel); };
  }, []);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
        const func = videoPlaying ? 'playVideo' : 'pauseVideo';
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
      }
    }
  }, [videoPlaying, streamUrl]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
        const func = videoMuted ? 'mute' : 'unMute';
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
      }
    }
  }, [videoMuted, streamUrl]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [videoVolume] }), '*');
      }
    }
  }, [videoVolume, streamUrl]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: [videoQuality] }), '*');
      }
    }
  }, [videoQuality, streamUrl]);

  useEffect(() => {
    if (videoSeekData && iframeRef.current && iframeRef.current.contentWindow) {
      if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [videoSeekData.time, true] }), '*');
      }
    }
  }, [videoSeekData, streamUrl]);

  const hasLeft = showRaceLeaderboard;
  const hasRight = showBetLeaderboard;

  let gridColumns = '1fr';
  if (hasLeft && hasRight) {
    gridColumns = 'minmax(350px, 400px) 1fr minmax(350px, 400px)';
  } else if (hasLeft && !hasRight) {
    gridColumns = 'minmax(350px, 400px) 1fr 0px';
  } else if (!hasLeft && hasRight) {
    gridColumns = '0px 1fr minmax(350px, 400px)';
  } else {
    gridColumns = '0px 1fr 0px';
  }

  return (
    <div style={{ 
      width: '1920px',
      height: '1080px',
      boxSizing: 'border-box',
      position: 'relative',
      background: 'transparent', // OBS transparent capable
      backgroundImage: 'radial-gradient(circle at center, rgba(30, 5, 5, 0.4) 0%, rgba(5, 2, 2, 0.95) 100%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
      padding: '2rem',
      paddingTop: '5rem', /* offset for top timer bar */
      display: 'grid',
      gridTemplateColumns: gridColumns,
      gap: (hasLeft || hasRight) ? '2rem' : '0rem',
      fontFamily: 'var(--font-mono)',
      pointerEvents: 'none', // Disables all interactions (hover, click, scroll)
      userSelect: 'none',    // Prevents text highlighting
      overflow: 'hidden',    // Prevents scrollbars from appearing on OBS
      transition: 'grid-template-columns 0.6s cubic-bezier(0.16, 1, 0.3, 1), gap 0.6s'
    }}>
      {/* LEFT COLUMN: RACE LEADERBOARD */}
      <div style={{ 
        opacity: showRaceLeaderboard ? 0.95 : 0, 
        transition: 'opacity 0.4s, transform 0.6s', 
        filter: 'drop-shadow(0 0 20px rgba(242, 24, 24, 0.2))',
        transform: showRaceLeaderboard ? 'translateX(0)' : 'translateX(-50px)',
        overflow: 'hidden'
      }}>
        <Leaderboard />
      </div>

      {/* CENTER: MAIN LIVE STATS & PROFILE */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '2rem', transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>

        {/* Live Ticker Box */}
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
          opacity: showCenterTicker ? 1 : 0,
          transform: showCenterTicker ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '1.5rem', margin: 0, letterSpacing: '6px', textAlign: 'center' }}>
            [ {tickerText} ]
          </p>
        </div>

        {/* Profile Showcase Render */}
        <div style={{ 
          width: '100%', 
          marginTop: '2rem', 
          opacity: showProfile && profileData ? 1 : 0, 
          transform: showProfile && profileData ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          display: showProfile && profileData ? 'block' : 'none'
        }}>
          {profileData && (
            <iframe 
              src={`/racer/${profileData.id}?stream=true`}
              style={{ width: "100%", height: "1400px", border: "none", background: "transparent" }}
              title="Profile Showcase"
            />
          )}
        </div>

        {/* Stream Preview Render */}
        <div style={{ 
          width: '100%', 
          marginTop: '2rem', 
          opacity: showStreamPreview && streamUrl ? 1 : 0, 
          transform: showStreamPreview && streamUrl ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
          display: showStreamPreview && streamUrl ? 'block' : 'none'
        }}>
          {streamUrl && showStreamPreview && (
            <iframe 
              ref={iframeRef}
              src={(() => {
                try {
                  const urlObj = new URL(streamUrl);
                  if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                    let videoId = '';
                    if (urlObj.hostname.includes('youtu.be')) {
                      videoId = urlObj.pathname.slice(1);
                    } else if (urlObj.pathname.startsWith('/live/')) {
                      videoId = urlObj.pathname.split('/')[2];
                    } else {
                      videoId = urlObj.searchParams.get('v') || '';
                    }
                    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=${ytControls ? 1 : 0}&enablejsapi=1&modestbranding=${ytModestBranding ? 1 : 0}&rel=${ytRel ? 1 : 0}&iv_load_policy=${ytAnnotations ? 1 : 3}&fs=0&disablekb=1` : streamUrl;
                  } else if (urlObj.hostname.includes('kick.com') && !urlObj.hostname.includes('player.kick.com')) {
                    const parts = urlObj.pathname.split('/').filter(Boolean);
                    if (parts.length > 0) {
                      return `https://player.kick.com/${parts[0]}?autoplay=true&muted=true`;
                    }
                  }
                } catch(e) {
                  return streamUrl;
                }
                return streamUrl;
              })()}
              style={{ width: "100%", aspectRatio: "16/9", border: "none", background: "transparent", borderRadius: '12px' }}
              title="Stream Preview"
              allow="autoplay; encrypted-media; fullscreen"
            />
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: BET LEADERBOARD */}
      <div style={{ 
        opacity: showBetLeaderboard ? 0.95 : 0, 
        transition: 'opacity 0.4s, transform 0.6s', 
        filter: 'drop-shadow(0 0 20px rgba(242, 24, 24, 0.2))',
        transform: showBetLeaderboard ? 'translateX(0)' : 'translateX(50px)',
        overflow: 'hidden'
      }}>
        <BetLeaderboard />
      </div>
    </div>
  );
}
