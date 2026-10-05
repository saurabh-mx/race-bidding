'use client';
import { useState, useEffect } from 'react';
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
          
          // Dispatch locally so the GlobalTimer (rendered in layout) can pick up the state change safely
          if (payload.payload.showTimers !== undefined) {
            window.dispatchEvent(new CustomEvent('local-timer-toggle', { detail: { showTimers: payload.payload.showTimers } }));
          }
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(controlsChannel); };
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'transparent', // OBS transparent capable
      backgroundImage: 'radial-gradient(circle at center, rgba(30, 5, 5, 0.4) 0%, rgba(5, 2, 2, 0.95) 100%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
      padding: '2rem',
      paddingTop: '5rem', /* offset for top timer bar */
      display: 'grid',
      gridTemplateColumns: 'minmax(350px, 400px) 1fr minmax(350px, 400px)',
      gap: '2rem',
      fontFamily: 'var(--font-mono)',
      pointerEvents: 'none', // Disables all interactions (hover, click, scroll)
      userSelect: 'none',    // Prevents text highlighting
      overflow: 'hidden'     // Prevents scrollbars from appearing on OBS
    }}>
      {/* LEFT COLUMN: RACE LEADERBOARD */}
      <div style={{ opacity: showRaceLeaderboard ? 0.95 : 0, transition: 'opacity 0.3s', filter: 'drop-shadow(0 0 20px rgba(242, 24, 24, 0.2))' }}>
        <Leaderboard />
      </div>

      {/* CENTER: MAIN LIVE STATS & PROFILE */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '2rem' }}>

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
          transition: 'opacity 0.3s'
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
          transition: 'opacity 0.4s',
          pointerEvents: 'none'
        }}>
          {profileData && (
            <iframe 
              src={`/racer/${profileData.id}?stream=true`}
              style={{ width: "100%", height: "1400px", border: "none", background: "transparent" }}
              title="Profile Showcase"
            />
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: BET LEADERBOARD */}
      <div style={{ opacity: showBetLeaderboard ? 0.95 : 0, transition: 'opacity 0.3s', filter: 'drop-shadow(0 0 20px rgba(242, 24, 24, 0.2))' }}>
        <BetLeaderboard />
      </div>
    </div>
  );
}
