'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUnique5DigitId } from '@/lib/betUtils';

type UserProfile = {
  id: string;
  login_id: string;
  display_name?: string;
  role: string;
  totalInvested: number;
  totalWon: number;
  totalLost: number;
  netPL: number;
  betCount: number;
  bets: BetDetail[];
};

type RaceStat = {
  round_id: number;
  totalBets: number;
  totalInvested: number;
  totalWon: number;
  housePL: number;
  name?: string;
  track?: string;
  bets: BetDetail[];
  results?: { pos: number; name: string; is_dnf?: boolean; is_dsq?: boolean }[];
};

type BetDetail = {
  id: string;
  unique_id: string;
  result_position?: string;
  racer_name: string;
  racer_type: string;
  amount: number;
  status: string;
  result: string;
  payout: number;
  payout_status: string;
  created_at: string;
  bidder_name?: string;
  bettor_name?: string;
  cid?: string;
  round_id?: number;
  position_prediction?: string;
};

export default function AGENTPanel() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [races, setRaces] = useState<RaceStat[]>([]);
  const [recentBets, setRecentBets] = useState<BetDetail[]>([]);

  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<'RACES' | 'USERS' | 'FEED'>('RACES');
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'WON' | 'LOST' | 'RETURNED'>('ALL');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

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

      if (profile?.role !== 'admin' && profile?.role !== 'agent' && profile?.role !== 'management') {
        router.replace('/dashboard');
        return;
      }

      await loadData(true);
    };

    init();

    // Realtime channel for instant multi-user synchronization
    const channel = supabase.channel('AGENT_bids')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        loadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const loadData = async (showLoading: boolean = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, login_id, display_name, role')
        .order('login_id');

      if (!profiles) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // 2. Fetch all bids
      const { data: allBids } = await supabase
        .from('bids')
        .select('*, racers(name, type), profiles(login_id, display_name)')
        .order('created_at', { ascending: false });

      // 3. Fetch race results
      const { data: dbResults } = await supabase
        .from('results')
        .select('round_id, racer_id, position, is_dnf, is_dsq');

      const resultsKeyMap = new Map<string, string>();
      if (dbResults) {
        dbResults.forEach((r: any) => {
          let posStr = '—';
          if (r.is_dnf) posStr = 'DNF';
          else if (r.is_dsq) posStr = 'DSQ';
          else if (r.position !== undefined && r.position !== null) posStr = `P${r.position}`;
          resultsKeyMap.set(`${r.round_id}_${r.racer_id}`, posStr);
        });
      }

      // Map recent bets (Live Global Feed)
      if (allBids) {
        setRecentBets(
          allBids.map((b: any) => ({
            id: b.id,
            unique_id: getUnique5DigitId(b.id, b.ticket_id),
            result_position: resultsKeyMap.get(`${b.round_id || 0}_${b.racer_id}`) || '—',
            racer_name: b.racers?.name || 'UNKNOWN',
            racer_type: b.racers?.type || 'UNKNOWN',
            amount: b.amount,
            status: b.status,
            result: b.result || 'PENDING',
            payout: b.payout || 0,
            payout_status: b.payout_status || 'PENDING',
            created_at: b.created_at,
            bidder_name: b.profiles?.display_name || b.bidder_name || b.profiles?.login_id || 'UNKNOWN',
            bettor_name: b.bettor_name,
            cid: b.cid,
            round_id: b.round_id,
            position_prediction: b.position_prediction
          }))
        );
      }

      // 4. Build Bettor Profiles with real P&L data
      const bettorGroups: { [key: string]: any[] } = {};
      (allBids || []).forEach((b: any) => {
        if (b.status === 'APPROVED') {
          const cidKey = b.cid ? String(b.cid).trim().toUpperCase() : '';
          const nameKey = (b.bettor_name || 'UNKNOWN').trim().toUpperCase();
          const groupKey = cidKey !== '' ? `CID:${cidKey}` : `NAME:${nameKey}`;

          if (!bettorGroups[groupKey]) bettorGroups[groupKey] = [];
          bettorGroups[groupKey].push(b);
        }
      });

      const userProfiles: UserProfile[] = Object.keys(bettorGroups).map((groupKey) => {
        const userBids = bettorGroups[groupKey];

        let displayCid = '';
        let displayBettorName = groupKey.replace('NAME:', '');

        if (groupKey.startsWith('CID:')) {
          displayCid = groupKey.replace('CID:', '');
          const bWithName = userBids.find(b => b.bettor_name && b.bettor_name.trim() !== '');
          displayBettorName = bWithName ? bWithName.bettor_name.trim().toUpperCase() : `CID ${displayCid}`;
        }

        const totalInvested = userBids.reduce((sum: number, b: any) => sum + b.amount, 0);
        const wonBids = userBids.filter((b: any) => b.result === 'WON');
        const lostBids = userBids.filter((b: any) => b.result === 'LOST');

        const totalWon = wonBids.reduce((sum: number, b: any) => sum + (b.payout || 0), 0);
        const totalLost = lostBids.reduce((sum: number, b: any) => sum + b.amount, 0);
        const netPL = wonBids.reduce((sum: number, b: any) => sum + ((b.payout || 0) - b.amount), 0) - totalLost;

        const bets: BetDetail[] = userBids.map((b: any) => ({
          id: b.id,
          unique_id: getUnique5DigitId(b.id, b.ticket_id),
          result_position: resultsKeyMap.get(`${b.round_id || 0}_${b.racer_id}`) || '—',
          racer_name: b.racers?.name || 'UNKNOWN',
          racer_type: b.racers?.type || 'UNKNOWN',
          amount: b.amount,
          status: b.status,
          result: b.result || 'PENDING',
          payout: b.payout || 0,
          payout_status: b.payout_status || 'PENDING',
          created_at: b.created_at,
          bidder_name: b.profiles?.display_name || b.profiles?.login_id || b.bidder_name || 'UNKNOWN',
          bettor_name: b.bettor_name,
          cid: b.cid,
          round_id: b.round_id,
          position_prediction: b.position_prediction
        }));

        const uniqueRounds = new Set(userBids.map((b: any) => b.round_id));

        return {
          id: groupKey,
          login_id: displayBettorName,
          display_name: displayCid,
          role: 'BETTOR',
          totalInvested,
          totalWon,
          totalLost,
          netPL,
          betCount: uniqueRounds.size,
          bets
        };
      });

      userProfiles.sort((a, b) => b.totalInvested - a.totalInvested);

      // 5. Compute Race Stats
      const { data: dbRaces } = await supabase.from('races').select('*');
      const raceDetailsMap = new Map<number, { name: string; track: string }>();
      if (dbRaces) {
        dbRaces.forEach(r => {
          raceDetailsMap.set(r.id, { name: r.name, track: r.track });
        });
      }

      const roundsMap = new Map<number, any[]>();
      (allBids || []).forEach((b: any) => {
        const rid = b.round_id || 0;
        if (!roundsMap.has(rid)) roundsMap.set(rid, []);
        roundsMap.get(rid)!.push(b);
      });

      const { data: allRacers } = await supabase.from('racers').select('id, name');
      const racerMap = new Map();
      if (allRacers) {
        allRacers.forEach(r => racerMap.set(r.id, r.name));
      }

      const raceResultsMap = new Map<number, { pos: number; name: string; is_dnf?: boolean; is_dsq?: boolean }[]>();
      if (dbResults) {
        dbResults.forEach(r => {
          if (!raceResultsMap.has(r.round_id)) raceResultsMap.set(r.round_id, []);
          raceResultsMap.get(r.round_id)!.push({
            pos: r.position,
            name: racerMap.get(r.racer_id) || 'UNKNOWN',
            is_dnf: r.is_dnf,
            is_dsq: r.is_dsq
          });
        });
        for (const resArray of raceResultsMap.values()) {
          resArray.sort((a, b) => a.pos - b.pos);
        }
      }

      const raceStats: RaceStat[] = Array.from(roundsMap.entries()).map(([roundId, roundBids]) => {
        const approvedBids = roundBids.filter((b: any) => b.status === 'APPROVED');
        const totalInvested = approvedBids.reduce((sum: number, b: any) => sum + b.amount, 0);
        const totalWon = approvedBids.filter((b: any) => b.result === 'WON').reduce((sum: number, b: any) => sum + (b.payout || 0), 0);
        const housePL = totalInvested - totalWon;

        const mappedBets: BetDetail[] = roundBids.map((b: any) => ({
          id: b.id,
          unique_id: getUnique5DigitId(b.id, b.ticket_id),
          result_position: resultsKeyMap.get(`${b.round_id || 0}_${b.racer_id}`) || '—',
          racer_name: b.racers?.name || 'UNKNOWN',
          racer_type: b.racers?.type || 'UNKNOWN',
          amount: b.amount,
          status: b.status,
          result: b.result || 'PENDING',
          payout: b.payout || 0,
          payout_status: b.payout_status || 'PENDING',
          created_at: b.created_at,
          bidder_name: b.profiles?.display_name || b.bidder_name || b.profiles?.login_id || 'UNKNOWN',
          bettor_name: b.bettor_name,
          cid: b.cid,
          round_id: b.round_id,
          position_prediction: b.position_prediction
        }));

        const raceMeta = raceDetailsMap.get(roundId);

        return {
          round_id: roundId,
          totalBets: approvedBids.length,
          totalInvested,
          totalWon,
          housePL,
          name: raceMeta?.name,
          track: raceMeta?.track,
          bets: mappedBets,
          results: raceResultsMap.get(roundId)
        };
      }).sort((a, b) => b.round_id - a.round_id);

      setUsers(userProfiles);
      setRaces(raceStats);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Instant Payout Status Change with Optimistic Refresh
  const handlePayoutStatusChange = async (betId: string, newStatus: string) => {
    // 1. Optimistic update across all active local state for instant response
    setRaces(prevRaces => prevRaces.map(race => {
      const hasBet = race.bets.some(b => b.id === betId);
      if (!hasBet) return race;
      return {
        ...race,
        bets: race.bets.map(b => b.id === betId ? { ...b, payout_status: newStatus } : b)
      };
    }));

    setUsers(prevUsers => prevUsers.map(user => {
      const hasBet = user.bets.some(b => b.id === betId);
      if (!hasBet) return user;
      return {
        ...user,
        bets: user.bets.map(b => b.id === betId ? { ...b, payout_status: newStatus } : b)
      };
    }));

    setRecentBets(prev => prev.map(b => b.id === betId ? { ...b, payout_status: newStatus } : b));

    // 2. Persist to Supabase in background
    const { error } = await supabase.from('bids').update({ payout_status: newStatus }).eq('id', betId);

    if (error) {
      console.error('Error updating status:', error);
      alert(`Error updating status: ${error.message}`);
    }

    // 3. Silent auto-refresh in background to sync totals
    await loadData(false);
  };

  // Selected entities derived from ID (never stale!)
  const selectedRace = useMemo(() => races.find(r => r.round_id === selectedRaceId) || null, [races, selectedRaceId]);
  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId) || null, [users, selectedUserId]);

  // Overall Global KPI Metrics
  const globalMetrics = useMemo(() => {
    const totalVolume = users.reduce((sum, u) => sum + u.totalInvested, 0);
    const totalPayout = users.reduce((sum, u) => sum + u.totalWon, 0);
    const housePL = totalVolume - totalPayout;
    const totalBetsCount = races.reduce((sum, r) => sum + r.totalBets, 0);
    const activeBettorsCount = users.filter(u => u.betCount > 0).length;
    const pendingBetsCount = recentBets.filter(b => b.result === 'PENDING').length;
    const wonBetsCount = recentBets.filter(b => b.result === 'WON').length;
    return {
      totalVolume,
      totalPayout,
      housePL,
      totalBetsCount,
      activeBettorsCount,
      pendingBetsCount,
      wonBetsCount
    };
  }, [users, races, recentBets]);

  // Filtered Races
  const filteredRaces = useMemo(() => {
    return races.filter(r => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const hasStatus = r.bets.some(b => {
          if (statusFilter === 'RETURNED') return b.payout_status === 'RETURNED';
          return b.result === statusFilter;
        });
        if (!hasStatus) return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().replace('#', '');
      const matchName = r.name?.toLowerCase().includes(q) || false;
      const matchTrack = r.track?.toLowerCase().includes(q) || false;
      const matchRound = String(r.round_id).includes(q);
      const matchBetUid = r.bets.some(b =>
        b.unique_id.toLowerCase().includes(q) ||
        b.bettor_name?.toLowerCase().includes(q) ||
        b.cid?.toLowerCase().includes(q) ||
        b.racer_name?.toLowerCase().includes(q)
      );
      return matchName || matchTrack || matchRound || matchBetUid;
    });
  }, [races, searchQuery, statusFilter]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const hasStatus = u.bets.some(b => {
          if (statusFilter === 'RETURNED') return b.payout_status === 'RETURNED';
          return b.result === statusFilter;
        });
        if (!hasStatus) return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().replace('#', '');
      const matchLogin = u.login_id.toLowerCase().includes(q);
      const matchCid = u.display_name?.toLowerCase().includes(q) || false;
      const matchBetUid = u.bets.some(b =>
        b.unique_id.toLowerCase().includes(q) ||
        b.racer_name?.toLowerCase().includes(q)
      );
      return matchLogin || matchCid || matchBetUid;
    });
  }, [users, searchQuery, statusFilter]);

  // Filtered Live Feed Bets
  const filteredFeedBets = useMemo(() => {
    return recentBets.filter(b => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'RETURNED') {
          if (b.payout_status !== 'RETURNED') return false;
        } else if (b.result !== statusFilter) {
          return false;
        }
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().replace('#', '');
      return (
        b.unique_id.toLowerCase().includes(q) ||
        b.bettor_name?.toLowerCase().includes(q) ||
        b.cid?.toLowerCase().includes(q) ||
        b.racer_name?.toLowerCase().includes(q) ||
        b.bidder_name?.toLowerCase().includes(q) ||
        String(b.round_id || '').includes(q)
      );
    });
  }, [recentBets, searchQuery, statusFilter]);

  if (isLoading || (role !== 'admin' && role !== 'agent' && role !== 'management')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(242,24,24,0.2)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', letterSpacing: '3px' }}>
          INITIALIZING MANAGEMENT TERMINAL...
        </p>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at 50% 0%, rgba(242, 24, 24, 0.08) 0%, #0d0404 70%)' }}>
      {/* Top Header */}
      <header className="glass-header" style={{ padding: '1rem 2.5rem' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '42px', width: 'auto', borderRadius: '50%' }} />
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#fff', margin: 0 }}>
                RACEBET<span style={{ color: 'var(--accent-primary)' }}>.</span>
              </h1>
              <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', letterSpacing: '2px', margin: 0 }}>
                TERMINAL // MANAGEMENT
              </p>
            </div>
          </div>
        </Link>

        {/* Global Navigation Links */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <Link href="/teams" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.8rem', letterSpacing: '1px' }}>TEAMS</Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.8rem', letterSpacing: '1px' }}>RACERS</Link>
          <Link href="/rules" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.8rem', letterSpacing: '1px' }}>RULES</Link>
        </div>

        {/* User Badge & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link href="/pending" className="text-mono" style={{
            padding: '0.35rem 0.85rem',
            fontSize: '0.75rem',
            textDecoration: 'none',
            border: '1px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            borderRadius: '4px',
            background: 'rgba(242, 24, 24, 0.08)',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
            PENDING BETS
          </Link>

          <div
            className="text-mono hover-glow"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '4px' }}
            onClick={() => router.push('/profile')}
            title="Go to Profile"
          >
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{(displayName || loginId).toUpperCase()}</span>
            <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : '#ffaa00', fontWeight: 700, letterSpacing: '1px' }}>
              OP: {role?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>

          <button className="btn-secondary" onClick={() => router.push('/dashboard')} style={{ padding: '0.45rem 1rem', fontSize: '0.75rem' }}>
            BACK
          </button>
        </div>
      </header>

      {/* Main Terminal Body */}
      <div style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>

        {/* Executive Overview KPI Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}>
          {/* Card 1: Total Bet Volume */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #fff', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 700 }}>
                TOTAL BET VOLUME
              </p>
              <span className="text-mono" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', color: '#fff' }}>
                {globalMetrics.totalBetsCount} BETS
              </span>
            </div>
            <p style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              ${globalMetrics.totalVolume.toLocaleString()}
            </p>
            <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Gross amount wagered
            </p>
          </div>

          {/* Card 2: Total Payouts */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #00ff88', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 700 }}>
                TOTAL PAYOUTS
              </p>
              <span className="text-mono" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: 'rgba(0,255,136,0.1)', borderRadius: '3px', color: '#00ff88' }}>
                {globalMetrics.wonBetsCount} WON
              </span>
            </div>
            <p style={{ fontSize: '2.2rem', fontWeight: 900, color: '#00ff88', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              ${globalMetrics.totalPayout.toLocaleString()}
            </p>
            <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Total awarded to winning clients
            </p>
          </div>

          {/* Card 3: House Net Profit */}
          <div className="glass-panel" style={{
            padding: '1.5rem',
            borderLeft: `4px solid ${globalMetrics.housePL >= 0 ? '#00ff88' : '#ff4444'}`,
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 700 }}>
                HOUSE P&L (NET)
              </p>
              <span className="text-mono" style={{
                fontSize: '0.65rem',
                padding: '0.15rem 0.5rem',
                background: globalMetrics.housePL >= 0 ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                borderRadius: '3px',
                color: globalMetrics.housePL >= 0 ? '#00ff88' : '#ff4444'
              }}>
                {globalMetrics.housePL >= 0 ? 'HOUSE PROFIT' : 'CLIENT PROFIT'}
              </span>
            </div>
            <p style={{
              fontSize: '2.2rem',
              fontWeight: 900,
              color: globalMetrics.housePL >= 0 ? '#00ff88' : '#ff4444',
              marginTop: '0.5rem',
              marginBottom: '0.25rem'
            }}>
              {globalMetrics.housePL >= 0 ? '+' : ''}${globalMetrics.housePL.toLocaleString()}
            </p>
            <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Net house margin (Volume minus Payouts)
            </p>
          </div>

          {/* Card 4: Active Bettors & Status */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #ffaa00', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 700 }}>
                ACTIVE CLIENTS
              </p>
              <span className="text-mono" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: 'rgba(255,170,0,0.1)', borderRadius: '3px', color: '#ffaa00' }}>
                {races.length} RACES
              </span>
            </div>
            <p style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffaa00', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              {globalMetrics.activeBettorsCount}
            </p>
            <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {globalMetrics.pendingBetsCount} pending bets awaiting settlement
            </p>
          </div>
        </div>

        {/* Command Toolbar & Navigation Tabs */}
        <div className="glass-panel" style={{
          padding: '1.25rem 1.75rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '4px solid var(--accent-primary)'
        }}>
          {/* Segmented View Mode Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 700 }}>
              VIEW BY:
            </span>
            <div style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.6)',
              padding: '0.3rem',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <button
                onClick={() => setViewMode('RACES')}
                className="text-mono"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'RACES' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'RACES' ? '#fff' : 'var(--text-muted)',
                  boxShadow: viewMode === 'RACES' ? '0 0 15px rgba(242,24,24,0.4)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                🏁 RACES ({races.length})
              </button>

              <button
                onClick={() => setViewMode('USERS')}
                className="text-mono"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'USERS' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'USERS' ? '#fff' : 'var(--text-muted)',
                  boxShadow: viewMode === 'USERS' ? '0 0 15px rgba(242,24,24,0.4)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                👥 BETTORS ({users.length})
              </button>

              <button
                onClick={() => setViewMode('FEED')}
                className="text-mono"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'FEED' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'FEED' ? '#fff' : 'var(--text-muted)',
                  boxShadow: viewMode === 'FEED' ? '0 0 15px rgba(242,24,24,0.4)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                ⚡ LIVE FEED ({recentBets.length})
              </button>
            </div>
          </div>

          {/* Quick Status Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>
              STATUS:
            </span>
            {(['ALL', 'PENDING', 'WON', 'LOST', 'RETURNED'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className="text-mono"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.65rem',
                  fontWeight: statusFilter === status ? 900 : 600,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: statusFilter === status ? '1px solid #fff' : '1px solid rgba(255,255,255,0.08)',
                  background: statusFilter === status
                    ? (status === 'WON' ? 'rgba(0,255,136,0.2)' : status === 'LOST' ? 'rgba(255,68,68,0.2)' : status === 'RETURNED' ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.15)')
                    : 'transparent',
                  color: statusFilter === status
                    ? (status === 'WON' ? '#00ff88' : status === 'LOST' ? '#ff4444' : status === 'RETURNED' ? '#00ff88' : '#fff')
                    : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search Ticket #, Bettor, CID, Racer..."
                className="input-base text-mono"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.65rem 1rem 0.65rem 2.2rem',
                  fontSize: '0.8rem',
                  width: '320px',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px'
                }}
              />
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-host-panel'))}
              className="btn-primary"
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}
            >
              + HOST RACE BET
            </button>

            <button
              onClick={() => loadData(false)}
              className="btn-secondary"
              disabled={isRefreshing}
              style={{ padding: '0.65rem 1rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              title="Refresh Data"
            >
              <span style={{ display: 'inline-block', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}>
                🔄
              </span>
              REFRESH
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: RACES OVERVIEW                                                   */}
        {/* ========================================================================= */}
        {viewMode === 'RACES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredRaces.length === 0 ? (
              <div className="glass-panel text-mono" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>NO MATCHING RACES FOUND</p>
                <p style={{ fontSize: '0.75rem' }}>Try clearing the search query or changing status filters.</p>
              </div>
            ) : (
              filteredRaces.map(race => {
                const isExpanded = selectedRaceId === race.round_id;

                return (
                  <div key={race.round_id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Race Card Header Strip */}
                    <div
                      className="glass-panel"
                      onClick={() => setSelectedRaceId(isExpanded ? null : race.round_id)}
                      style={{
                        padding: '1.25rem 1.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderLeft: isExpanded ? '5px solid var(--accent-primary)' : '5px solid rgba(255,255,255,0.2)',
                        background: isExpanded ? 'rgba(242, 24, 24, 0.06)' : 'rgba(20, 5, 5, 0.65)',
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.5fr 1.2fr 1fr 1fr 1fr 0.5fr',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      {/* Col 1: Race Identity */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                            RACE {race.round_id}
                          </span>
                          <span className="text-mono" style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.5rem',
                            background: 'rgba(242, 24, 24, 0.15)',
                            border: '1px solid rgba(242, 24, 24, 0.4)',
                            color: 'var(--accent-primary)',
                            borderRadius: '3px',
                            fontWeight: 700
                          }}>
                            ROUND #{race.round_id}
                          </span>
                        </div>
                        <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {race.name ? race.name.toUpperCase() : 'STANDARD RACE'} {race.track ? `// ${race.track.toUpperCase()}` : ''}
                        </p>
                      </div>

                      {/* Col 2: Unique Ticket IDs in this Race */}
                      <div>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          BET TICKETS ({race.bets.length})
                        </p>
                        {race.bets.length === 0 ? (
                          <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NO BETS</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {race.bets.slice(0, 3).map(b => (
                              <span key={b.id} className="text-mono" style={{
                                color: '#00ff88',
                                fontSize: '0.75rem',
                                fontWeight: 900,
                                letterSpacing: '1px',
                                background: 'rgba(0, 255, 136, 0.08)',
                                border: '1px solid rgba(0, 255, 136, 0.25)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '3px'
                              }}>
                                #{b.unique_id}
                              </span>
                            ))}
                            {race.bets.length > 3 && (
                              <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', alignSelf: 'center' }}>
                                +{race.bets.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Col 3: Official Podium Results */}
                      <div>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          OFFICIAL FINISH
                        </p>
                        {race.results && race.results.length > 0 ? (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {race.results.slice(0, 2).map(r => (
                              <span key={r.name} className="text-mono" style={{
                                fontSize: '0.65rem',
                                padding: '0.15rem 0.4rem',
                                background: r.pos === 1 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${r.pos === 1 ? '#FFD700' : 'rgba(255,255,255,0.2)'}`,
                                color: r.pos === 1 ? '#FFD700' : '#fff',
                                borderRadius: '3px'
                              }}>
                                <strong>P{r.pos}</strong> {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-mono" style={{ fontSize: '0.75rem', color: '#ffaa00' }}>
                            ⏳ PENDING RESULT
                          </span>
                        )}
                      </div>

                      {/* Col 4: Total Volume */}
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          INVESTED
                        </p>
                        <p className="text-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>
                          ${race.totalInvested.toLocaleString()}
                        </p>
                      </div>

                      {/* Col 5: Total Payouts */}
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          PAYOUT
                        </p>
                        <p className="text-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#00ff88' }}>
                          ${race.totalWon.toLocaleString()}
                        </p>
                      </div>

                      {/* Col 6: House P&L */}
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          HOUSE P&L
                        </p>
                        <p className="text-mono" style={{
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          color: race.housePL > 0 ? '#00ff88' : race.housePL < 0 ? '#ff4444' : 'var(--text-muted)'
                        }}>
                          {race.housePL >= 0 ? '+' : ''}${race.housePL.toLocaleString()}
                        </p>
                      </div>

                      {/* Col 7: Expand Icon */}
                      <div style={{ textAlign: 'center', color: isExpanded ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {isExpanded ? '▲' : '▼'}
                      </div>
                    </div>

                    {/* Expanded Bet Details Table */}
                    {isExpanded && (
                      <div className="glass-panel" style={{
                        marginTop: '0.25rem',
                        marginBottom: '0.75rem',
                        padding: '1.5rem',
                        borderLeft: '5px solid var(--accent-primary)',
                        background: 'rgba(10, 2, 2, 0.95)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>
                              BET TICKETS FOR RACE {race.round_id}
                            </h3>
                            <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              Showing {race.bets.length} tickets placed on this round
                            </p>
                          </div>

                          {/* Podium Tag list */}
                          {race.results && race.results.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>PODIUM:</span>
                              {race.results.slice(0, 3).map(r => (
                                <span key={r.name} className="text-mono" style={{
                                  fontSize: '0.7rem',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '3px',
                                  border: `1px solid ${r.pos === 1 ? '#FFD700' : r.pos === 2 ? '#C0C0C0' : '#CD7F32'}`,
                                  color: r.pos === 1 ? '#FFD700' : r.pos === 2 ? '#C0C0C0' : '#CD7F32',
                                  background: 'rgba(255,255,255,0.04)'
                                }}>
                                  <strong>{r.pos === 1 ? '🥇 1ST' : r.pos === 2 ? '🥈 2ND' : '🥉 3RD'}</strong> {r.name.toUpperCase()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Bet Table */}
                        <RenderBetTable bets={race.bets} onStatusChange={handlePayoutStatusChange} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: BETTORS DIRECTORY                                                */}
        {/* ========================================================================= */}
        {viewMode === 'USERS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredUsers.length === 0 ? (
              <div className="glass-panel text-mono" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>NO MATCHING BETTORS FOUND</p>
                <p style={{ fontSize: '0.75rem' }}>Try clearing the search query or status filters.</p>
              </div>
            ) : (
              filteredUsers.map(user => {
                const isExpanded = selectedUserId === user.id;

                return (
                  <div key={user.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* User Card Header Strip */}
                    <div
                      className="glass-panel"
                      onClick={() => setSelectedUserId(isExpanded ? null : user.id)}
                      style={{
                        padding: '1.25rem 1.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderLeft: isExpanded ? '5px solid var(--accent-primary)' : '5px solid rgba(255,255,255,0.2)',
                        background: isExpanded ? 'rgba(242, 24, 24, 0.06)' : 'rgba(20, 5, 5, 0.65)',
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 0.5fr',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      {/* Col 1: Bettor Profile Info */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                            {user.login_id.toUpperCase()}
                          </span>
                          {user.display_name && (
                            <span className="text-mono" style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.5rem',
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: '#fff',
                              borderRadius: '3px',
                              fontWeight: 700
                            }}>
                              CID: {user.display_name}
                            </span>
                          )}
                        </div>
                        <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          CLIENT PORTFOLIO // {user.betCount} ROUNDS PARTICIPATED
                        </p>
                      </div>

                      {/* Col 2: Active Unique Ticket IDs */}
                      <div>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          TICKETS ({user.bets.length})
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {user.bets.slice(0, 3).map(b => (
                            <span key={b.id} className="text-mono" style={{
                              color: '#00ff88',
                              fontSize: '0.75rem',
                              fontWeight: 900,
                              letterSpacing: '1px',
                              background: 'rgba(0, 255, 136, 0.08)',
                              border: '1px solid rgba(0, 255, 136, 0.25)',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '3px'
                            }}>
                              #{b.unique_id}
                            </span>
                          ))}
                          {user.bets.length > 3 && (
                            <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', alignSelf: 'center' }}>
                              +{user.bets.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Col 3: Invested */}
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          TOTAL WAGERED
                        </p>
                        <p className="text-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>
                          ${user.totalInvested.toLocaleString()}
                        </p>
                      </div>

                      {/* Col 4: Won */}
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          WON
                        </p>
                        <p className="text-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#00ff88' }}>
                          ${user.totalWon.toLocaleString()}
                        </p>
                      </div>

                      {/* Col 5: Lost */}
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          LOST
                        </p>
                        <p className="text-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ff4444' }}>
                          ${user.totalLost.toLocaleString()}
                        </p>
                      </div>

                      {/* Col 6: Net P&L */}
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '1px' }}>
                          CLIENT NET P&L
                        </p>
                        <p className="text-mono" style={{
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          color: user.netPL > 0 ? '#00ff88' : user.netPL < 0 ? '#ff4444' : 'var(--text-muted)'
                        }}>
                          {user.netPL >= 0 ? '+' : ''}${user.netPL.toLocaleString()}
                        </p>
                      </div>

                      {/* Col 7: Expand Icon */}
                      <div style={{ textAlign: 'center', color: isExpanded ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {isExpanded ? '▲' : '▼'}
                      </div>
                    </div>

                    {/* Expanded Bettor Ticket History */}
                    {isExpanded && (
                      <div className="glass-panel" style={{
                        marginTop: '0.25rem',
                        marginBottom: '0.75rem',
                        padding: '1.5rem',
                        borderLeft: '5px solid var(--accent-primary)',
                        background: 'rgba(10, 2, 2, 0.95)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>
                              TICKET HISTORY FOR {user.login_id}
                            </h3>
                            <p className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              Showing all {user.bets.length} placed tickets for this client
                            </p>
                          </div>
                        </div>

                        <RenderBetTable bets={user.bets} onStatusChange={handlePayoutStatusChange} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: LIVE BET FEED (ALL RECENT BETS)                                   */}
        {/* ========================================================================= */}
        {viewMode === 'FEED' && (
          <div className="glass-panel" style={{ padding: '2rem', borderLeft: '5px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>
                    REALTIME GLOBAL BET LOG
                  </h3>
                  <span className="pulse-indicator" title="Live sync connected" />
                </div>
                <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Live stream of all incoming bets across all races ({filteredFeedBets.length} tickets matching)
                </p>
              </div>
            </div>

            {filteredFeedBets.length === 0 ? (
              <div className="text-mono" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                NO BET TICKETS FOUND MATCHING CRITERIA.
              </div>
            ) : (
              <RenderBetTable bets={filteredFeedBets} onStatusChange={handlePayoutStatusChange} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// =============================================================================
// REUSABLE, HIGH-CLARITY BET TICKETS TABLE COMPONENT
// =============================================================================
function RenderBetTable({
  bets,
  onStatusChange
}: {
  bets: BetDetail[];
  onStatusChange: (betId: string, status: string) => void;
}) {
  if (bets.length === 0) {
    return (
      <div className="text-mono" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        NO BET TICKETS AVAILABLE IN THIS CATEGORY.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {/* Table Header */}
      <div className="text-mono" style={{
        display: 'grid',
        gridTemplateColumns: '1.3fr 1.5fr 1.6fr 1.3fr 1.4fr 1.1fr',
        padding: '0.65rem 1rem',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        letterSpacing: '1.5px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        fontWeight: 700
      }}>
        <span>TICKET & TIME</span>
        <span>CLIENT / CID</span>
        <span>SELECTION & PREDICTION</span>
        <span>RESULT / FINISH</span>
        <span style={{ textAlign: 'right' }}>WAGER ➔ PAYOUT</span>
        <span style={{ textAlign: 'right' }}>PAYOUT STATUS</span>
      </div>

      {/* Rows */}
      {bets.map(bet => {
        const netProfit = bet.result === 'WON'
          ? bet.payout - bet.amount
          : bet.result === 'LOST'
            ? -bet.amount
            : 0;

        return (
          <div
            key={bet.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1.5fr 1.6fr 1.3fr 1.4fr 1.1fr',
              padding: '0.85rem 1rem',
              alignItems: 'center',
              background: bet.result === 'WON'
                ? 'rgba(0, 255, 136, 0.04)'
                : bet.result === 'LOST'
                  ? 'rgba(255, 68, 68, 0.04)'
                  : 'rgba(255, 255, 255, 0.02)',
              borderLeft: bet.result === 'WON'
                ? '3px solid #00ff88'
                : bet.result === 'LOST'
                  ? '3px solid #ff4444'
                  : '3px solid #666',
              borderRadius: '2px',
              transition: 'background 0.15s ease'
            }}
          >
            {/* 1. Ticket & Timestamp */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="text-mono" style={{
                  color: '#00ff88',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  letterSpacing: '1px',
                  background: 'rgba(0,255,136,0.1)',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '3px',
                  border: '1px solid rgba(0,255,136,0.3)'
                }}>
                  #{bet.unique_id}
                </span>
                {bet.round_id && (
                  <span className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    R#{bet.round_id}
                  </span>
                )}
              </div>
              <p className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {new Date(bet.created_at).toLocaleDateString()} {new Date(bet.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* 2. Client & CID */}
            <div>
              <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>
                {bet.bettor_name?.toUpperCase() || 'UNKNOWN'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.15rem', alignItems: 'center' }}>
                {bet.cid && (
                  <span className="text-mono" style={{ fontSize: '0.65rem', color: '#ffaa00', fontWeight: 600 }}>
                    CID: {bet.cid.toUpperCase()}
                  </span>
                )}
                <span className="text-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  OP: {bet.bidder_name?.toUpperCase() || 'ADMIN'}
                </span>
              </div>
            </div>

            {/* 3. Selection & Predicted Position */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                  {bet.racer_name}
                </span>
                <span className="text-mono" style={{
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.35rem',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-muted)',
                  borderRadius: '2px',
                  textTransform: 'uppercase'
                }}>
                  {bet.racer_type}
                </span>
              </div>
              <p className="text-mono" style={{ fontSize: '0.75rem', color: '#ffaa00', marginTop: '0.15rem', fontWeight: 700 }}>
                🎯 PREDICTED: {bet.position_prediction || 'WIN'}
              </p>
            </div>

            {/* 4. Result Finish & Outcome */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span className="text-mono" style={{
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  color: bet.result_position === 'P1'
                    ? '#FFD700'
                    : bet.result_position?.startsWith('P')
                      ? '#00ff88'
                      : bet.result_position === 'DNF' || bet.result_position === 'DSQ'
                        ? '#ff4444'
                        : 'var(--text-muted)'
                }}>
                  FINISH: {bet.result_position || '—'}
                </span>

                <span className="text-mono" style={{
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '3px',
                  letterSpacing: '1px',
                  background: bet.result === 'WON'
                    ? 'rgba(0, 255, 136, 0.15)'
                    : bet.result === 'LOST'
                      ? 'rgba(255, 68, 68, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)',
                  color: bet.result === 'WON' ? '#00ff88' : bet.result === 'LOST' ? '#ff4444' : '#aaa',
                  border: `1px solid ${bet.result === 'WON' ? '#00ff88' : bet.result === 'LOST' ? '#ff4444' : '#444'}`
                }}>
                  {bet.result}
                </span>
              </div>
            </div>

            {/* 5. Financials (Bet, Payout, Profit) */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'baseline' }}>
                <span className="text-mono" style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>
                  ${bet.amount.toLocaleString()}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>➔</span>
                <span className="text-mono" style={{
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  color: bet.result === 'WON' ? '#00ff88' : 'var(--text-muted)'
                }}>
                  {bet.result === 'WON' ? `$${bet.payout.toLocaleString()}` : bet.result === 'LOST' ? '$0' : '—'}
                </span>
              </div>
              {bet.result !== 'PENDING' && (
                <p className="text-mono" style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  marginTop: '0.15rem',
                  color: netProfit > 0 ? '#00ff88' : netProfit < 0 ? '#ff4444' : '#888'
                }}>
                  NET: {netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}
                </p>
              )}
            </div>

            {/* 6. Payout Status Action Dropdown */}
            <div style={{ textAlign: 'right' }}>
              <select
                value={bet.payout_status}
                onChange={e => onStatusChange(bet.id, e.target.value)}
                className="text-mono"
                style={{
                  background: 'rgba(0,0,0,0.7)',
                  color: bet.payout_status === 'RETURNED' ? '#00ff88' : bet.payout_status === 'DECLINED' ? '#ff4444' : '#fff',
                  border: `1px solid ${bet.payout_status === 'RETURNED' ? '#00ff88' : bet.payout_status === 'DECLINED' ? '#ff4444' : 'rgba(255,255,255,0.2)'}`,
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  borderRadius: '3px'
                }}
              >
                <option value="PENDING" style={{ background: '#111', color: '#fff' }}>PENDING</option>
                <option value="RETURNED" style={{ background: '#111', color: '#00ff88' }}>RETURNED</option>
                <option value="DECLINED" style={{ background: '#111', color: '#ff4444' }}>DECLINED</option>
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
