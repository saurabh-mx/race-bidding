'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function BetLeaderboard() {
  const [topTeams, setTopTeams] = useState<any[]>([]);
  const [topRacers, setTopRacers] = useState<any[]>([]);

  useEffect(() => {
    fetchLeaderboard();

    const channel = supabase.channel('bet-leaderboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'racers' }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaderboard = async () => {
    const { data: teams } = await supabase
      .from('racers')
      .select('id, name, current_bid')
      .eq('type', 'TEAM')
      .eq('is_posted', true)
      .order('current_bid', { ascending: false });

    const { data: racers } = await supabase
      .from('racers')
      .select('id, name, current_bid')
      .neq('type', 'TEAM')
      .not('type', 'ilike', 'MONTHLY%')
      .eq('is_posted', true)
      .order('current_bid', { ascending: false });
      
    if (teams) setTopTeams(teams.slice(0, 5));
    if (racers) setTopRacers(racers.slice(0, 10));
  };

  return (
    <div className="glass-panel" style={{ height: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      <h2 className="title-gradient" style={{ fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '1.5rem', textAlign: 'center' }}>
        BET POOLS
      </h2>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div>
          <h3 className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginBottom: '0.75rem', letterSpacing: '1px' }}>TOP TEAMS</h3>
          {topTeams.length === 0 ? (
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No active team bets</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topTeams.map((item, index) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '20px', fontSize: '0.75rem', fontWeight: 'bold', color: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'var(--text-muted)' }}>{index + 1}</div>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span className="text-mono" style={{ fontSize: '0.75rem', color: '#fff' }}>{item.name}</span>
                  </div>
                  <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    ${item.current_bid.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-mono" style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem', letterSpacing: '1px' }}>TOP RACERS</h3>
          {topRacers.length === 0 ? (
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No active racer bets</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topRacers.map((item, index) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '20px', fontSize: '0.75rem', fontWeight: 'bold', color: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'var(--text-muted)' }}>{index + 1}</div>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span className="text-mono" style={{ fontSize: '0.75rem', color: '#fff' }}>{item.name}</span>
                  </div>
                  <div style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    ${item.current_bid.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
