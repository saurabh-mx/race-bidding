'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Leaderboard() {
  const [topTeams, setTopTeams] = useState<any[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to realtime updates for racers table
    const channel = supabase.channel('leaderboard-updates')
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
      .select('id, name, tournament_points, wins')
      .eq('type', 'TEAM');

    const { data: racers } = await supabase
      .from('racers')
      .select('id, name, team_name, tournament_points, wins')
      .neq('type', 'TEAM')
      .not('type', 'ilike', 'MONTHLY%');
      
    if (teams && racers) {
      const updatedTeams = teams.map(team => {
        const teamRacers = racers.filter(r => r.team_name === team.name);
        const collectivePoints = teamRacers.reduce((sum, r) => sum + (r.tournament_points || 0), 0);
        const totalPoints = (team.tournament_points || 0) + collectivePoints;
        return {
          ...team,
          collective_points: totalPoints,
          base_points: team.tournament_points || 0,
          racers: teamRacers.sort((a,b) => (b.tournament_points || 0) - (a.tournament_points || 0))
        };
      }).sort((a, b) => b.collective_points - a.collective_points);
      
      setTopTeams(updatedTeams.slice(0, 15));
    }
  };

  return (
    <div className="glass-panel" style={{ height: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      <h2 className="title-gradient" style={{ fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '1.5rem', textAlign: 'center' }}>
        LEADERBOARD
      </h2>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {topTeams.map((item, index) => {
          const isExpanded = expandedTeamId === item.id;
          return (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div 
                onClick={() => setExpandedTeamId(isExpanded ? null : item.id)}
                style={{ 
                  display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', 
                  padding: '0.75rem 1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', 
                  background: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'rgba(255,255,255,0.1)', 
                  color: index < 3 ? '#000' : '#fff', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', marginRight: '1rem'
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                    {item.name}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1rem' }}>{item.collective_points}</p>
                  <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>PTS</p>
                </div>
              </div>
              
              {isExpanded && (
                <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginLeft: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.5rem', borderBottom: '1px dashed rgba(255,255,255,0.1)', marginBottom: '0.25rem' }}>
                    <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>TEAM RACE POINTS</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.base_points}</span>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>PTS</span>
                    </div>
                  </div>
                  {item.racers && item.racers.length > 0 ? item.racers.map((racer: any) => (
                    <div key={racer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.5rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                        {racer.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.85rem' }}>{racer.tournament_points || 0}</span>
                        <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>PTS</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textAlign: 'center', padding: '0.5rem' }}>No racers on roster</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {topTeams.length === 0 && (
          <p className="text-mono" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
            NO DATA
          </p>
        )}
      </div>
    </div>
  );
}
