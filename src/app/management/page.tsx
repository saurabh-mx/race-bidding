'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  results?: { pos: number, name: string, is_dnf?: boolean, is_dsq?: boolean }[];
};

type BetDetail = {
  id: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  const [viewMode, setViewMode] = useState<'USERS' | 'RACES'>('USERS');
  const [races, setRaces] = useState<RaceStat[]>([]);
  const [selectedRace, setSelectedRace] = useState<RaceStat | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [recentBets, setRecentBets] = useState<BetDetail[]>([]);
  const [raceBetSearchQuery, setRaceBetSearchQuery] = useState('');

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

      await loadData();
    };

    init();

    const channel = supabase.channel('AGENT_bids')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);

    // Fetch all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, login_id, display_name, role')
      .order('login_id');

    if (!profiles) {
      setIsLoading(false);
      return;
    }

    // Fetch all bids with racer info (approved only for P&L)
    const { data: allBids } = await supabase
      .from('bids')
      .select('*, racers(name, type), profiles(login_id, display_name)')
      .order('created_at', { ascending: false });

    if (allBids) {
      setRecentBets(
        allBids.slice(0, 30).map((b: any) => ({
          id: b.id,
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
          position_prediction: b.position_prediction
        }))
      );
    }

    // Build bettor profiles with real P&L data
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
    
    // Sort by invested descending
    userProfiles.sort((a, b) => b.totalInvested - a.totalInvested);

    // Compute Race Stats
    const { data: dbRaces } = await supabase.from('races').select('*');

    const raceDetailsMap = new Map<number, { name: string, track: string }>();
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

    const { data: dbResults } = await supabase.from('results').select('round_id, racer_id, position, is_dnf, is_dsq');
    const { data: allRacers } = await supabase.from('racers').select('id, name');
    const racerMap = new Map();
    if (allRacers) {
      allRacers.forEach(r => racerMap.set(r.id, r.name));
    }

    const raceResultsMap = new Map<number, { pos: number, name: string, is_dnf?: boolean, is_dsq?: boolean }[]>();
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
      for (const [rid, resArray] of raceResultsMap.entries()) {
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
    setFilteredUsers(userProfiles);
    setRaces(raceStats);
    setIsLoading(false);
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u => u.login_id.toLowerCase().includes(q)));
    }
  }, [searchQuery, users]);

  const handlePayoutStatusChange = async (betId: string, newStatus: string) => {
    if (newStatus === 'RETURNED') {
      const confirm = window.confirm('Are you sure you want to mark this payout as RETURNED? This confirms the bettor has been paid.');
      if (!confirm) return;
    }
    
    setIsLoading(true);
    const { error } = await supabase.from('bids').update({ payout_status: newStatus }).eq('id', betId);
    
    if (error) {
      alert(`Error updating status: ${error.message}`);
    } else if (newStatus === 'RETURNED') {
      alert('Confirmation: Payout status updated and saved as RETURNED.');
    }
    
    await loadData();
  };

  if (isLoading || (role !== 'admin' && role !== 'agent' && role !== 'management')) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
        LOADING MANAGEMENT PANEL...
      </p>
    </div>
  );

  // Global stats
  const totalVolume = users.reduce((sum, u) => sum + u.totalInvested, 0);
  const totalPayout = users.reduce((sum, u) => sum + u.totalWon, 0);
  const housePL = totalVolume - totalPayout;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
            <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBET. <span style={{ color: '#fff', fontSize: '1rem' }}>// MANAGEMENT</span></h1>
          </div>
        </Link>
        <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
          <Link href="/teams" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>TEAMS</Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RACERS</Link>
          <Link href="#" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RULES</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/pending" className="text-mono" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
            PENDING BETS
          </Link>
          <div 
            className="text-mono hover-glow" 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '4px' }}
            onClick={() => router.push('/profile')}
            title="Go to Profile"
          >
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{(displayName || loginId).toUpperCase()}</span>
            <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              OP: {role || 'UNKNOWN'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => router.push('/dashboard')} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
              BACK
            </button>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 className="title-gradient" style={{ fontSize: '2rem' }}>MANAGEMENT</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '0.25rem' }}>
              <button 
                onClick={() => setViewMode('USERS')}
                style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: viewMode === 'USERS' ? 'var(--accent-primary)' : 'transparent', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer' }}
                className="text-mono"
              >USERS</button>
              <button 
                onClick={() => setViewMode('RACES')}
                style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: viewMode === 'RACES' ? 'var(--accent-primary)' : 'transparent', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer' }}
                className="text-mono"
              >RACES</button>
            </div>
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-host-panel'))} className="btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem' }}>
              HOST RACE BET
            </button>
            <input
              type="text"
              placeholder="SEARCH USER..."
              className="input-base text-mono"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem', minWidth: '300px', letterSpacing: '1px' }}
            />
            <button onClick={loadData} className="btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem' }}>
              REFRESH
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL USERS</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{users.length}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL BET VOLUME</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-primary)' }}>${totalVolume.toLocaleString()}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL PAYOUTS</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#00ff88' }}>${totalPayout.toLocaleString()}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>ACTIVE BETTORS</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: '#ffaa00' }}>{users.filter(u => u.betCount > 0).length}</p>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>HOUSE P&L</p>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: housePL >= 0 ? '#00ff88' : '#ff4444' }}>{housePL >= 0 ? '+' : ''}${housePL.toLocaleString()}</p>
          </div>
        </div>

        {/* Data List */}
        {viewMode === 'USERS' ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {/* Table Header */}
          <div className="text-mono" style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 0.75fr 1fr 1fr 1fr 1fr 0.75fr', 
            padding: '1rem 1.5rem',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            letterSpacing: '2px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span>BETTOR NAME</span>
            <span style={{ textAlign: 'right' }}>TYPE</span>
            <span style={{ textAlign: 'right' }}>INVESTED</span>
            <span style={{ textAlign: 'right' }}>WON</span>
            <span style={{ textAlign: 'right' }}>LOST</span>
            <span style={{ textAlign: 'right' }}>NET P&L</span>
            <span style={{ textAlign: 'right' }}>ROUNDS</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="glass-panel text-mono" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              NO BETTORS FOUND.
            </div>
          ) : (
            filteredUsers.map(user => (
              <div key={user.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div 
                  className="glass-panel"
                  onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 0.75fr 1fr 1fr 1fr 1fr 0.75fr',
                    padding: '1.25rem 1.5rem',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: selectedUser?.id === user.id ? '4px solid var(--accent-primary)' : '4px solid transparent',
                    background: selectedUser?.id === user.id ? 'rgba(242, 24, 24, 0.05)' : undefined
                  }}
                >
                <div>
                  <p style={{ fontWeight: 900, color: '#fff', fontSize: '1rem' }}>{user.login_id.toUpperCase()}</p>
                  {user.display_name && <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>CID: {user.display_name}</p>}
                </div>
                <p className="text-mono" style={{ 
                  textAlign: 'right', 
                  fontSize: '0.75rem', 
                  color: user.role === 'admin' ? '#ff2a2a' : (user.role === 'agent' || user.role === 'management') ? '#ffaa00' : 'var(--text-muted)',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>{user.role}</p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
                  ${user.totalInvested.toLocaleString()}
                </p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#00ff88', fontWeight: 'bold' }}>
                  ${user.totalWon.toLocaleString()}
                </p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#ff4444', fontWeight: 'bold' }}>
                  ${user.totalLost.toLocaleString()}
                </p>
                <p className="text-mono" style={{ 
                  textAlign: 'right', 
                  fontSize: '1rem', 
                  color: user.netPL > 0 ? '#00ff88' : user.netPL < 0 ? '#ff4444' : 'var(--text-muted)', 
                  fontWeight: 900 
                }}>
                  {user.netPL >= 0 ? '+' : ''}${user.netPL.toLocaleString()}
                </p>
                <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#fff' }}>
                  {user.betCount}
                </p>
              </div>

              {/* Expanded User Detail */}
              {selectedUser?.id === user.id && selectedUser.bets.length > 0 && (
                <div className="glass-panel animate-in" style={{ padding: '2rem', borderLeft: '4px solid var(--accent-primary)', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                      BET HISTORY — <span style={{ color: 'var(--accent-primary)' }}>{selectedUser.login_id.toUpperCase()}</span>
                    </h3>
                  </div>

                  <div className="text-mono" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.25fr 1fr 0.5fr 0.75fr 1.25fr 0.5fr 0.75fr 0.75fr 0.75fr 0.75fr 0.75fr', 
                    padding: '0.75rem 1rem',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '2px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '0.5rem'
                  }}>
                    <span>DATE</span>
                    <span>MANAGEMENT</span>
                    <span>ROUND</span>
                    <span>CID</span>
                    <span>BET ON</span>
                    <span>POS</span>
                    <span>TYPE</span>
                    <span style={{ textAlign: 'right' }}>AMOUNT</span>
                    <span style={{ textAlign: 'right' }}>PAYOUT</span>
                    <span style={{ textAlign: 'right' }}>PROFIT</span>
                    <span style={{ textAlign: 'right' }}>RESULT</span>
                  </div>

                  <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {selectedUser.bets.map(bet => {
                      const profit = bet.result === 'WON' ? bet.payout - bet.amount : bet.result === 'LOST' ? -bet.amount : 0;
                      
                      return (
                        <div 
                          key={bet.id}
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1.25fr 1fr 0.5fr 0.75fr 1.25fr 0.5fr 0.75fr 0.75fr 0.75fr 0.75fr 0.75fr', 
                            padding: '0.75rem 1rem',
                            background: bet.result === 'WON' ? 'rgba(0, 255, 136, 0.05)' : bet.result === 'LOST' ? 'rgba(255, 68, 68, 0.05)' : 'rgba(255,255,255,0.02)',
                            borderLeft: bet.result === 'WON' ? '3px solid #00ff88' : bet.result === 'LOST' ? '3px solid #ff4444' : '3px solid #555',
                            alignItems: 'center'
                          }}
                        >
                          <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(bet.created_at).toLocaleDateString()} {new Date(bet.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <p style={{ color: '#fff', fontSize: '0.85rem' }}>{bet.bidder_name?.toUpperCase() || '—'}</p>
                          <p className="text-mono" style={{ color: '#fff', fontSize: '0.85rem' }}>{bet.round_id ? `${bet.round_id}` : '—'}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{bet.cid?.toUpperCase() || '—'}</p>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>{bet.racer_name}</span>
                          <span className="text-mono" style={{ fontSize: '0.85rem', color: '#ffaa00' }}>{bet.position_prediction || '—'}</span>
                          <span className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{bet.racer_type}</span>
                          <span className="text-mono" style={{ textAlign: 'right', fontSize: '0.95rem', color: '#fff', fontWeight: 'bold' }}>
                            ${bet.amount.toLocaleString()}
                          </span>
                          <span className="text-mono" style={{ textAlign: 'right', fontSize: '0.95rem', color: bet.result === 'WON' ? '#00ff88' : 'var(--text-muted)', fontWeight: 'bold' }}>
                            {bet.result === 'WON' ? `$${bet.payout.toLocaleString()}` : bet.result === 'LOST' ? '$0' : '—'}
                          </span>
                          <span className="text-mono" style={{ 
                            textAlign: 'right', 
                            fontSize: '0.95rem', 
                            fontWeight: 900,
                            color: profit > 0 ? '#00ff88' : profit < 0 ? '#ff4444' : '#888'
                          }}>
                            {bet.result === 'PENDING' ? '—' : `${profit >= 0 ? '+' : ''}$${profit.toLocaleString()}`}
                          </span>
                          <span className="text-mono" style={{ 
                            textAlign: 'right', 
                            fontSize: '0.75rem', 
                            fontWeight: 900,
                            color: bet.result === 'WON' ? '#00ff88' : bet.result === 'LOST' ? '#ff4444' : '#888',
                            letterSpacing: '1px'
                          }}>
                            {bet.result}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            ))
          )}
        </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div className="text-mono" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', 
              padding: '1rem 1.5rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              letterSpacing: '2px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span>RACE</span>
              <span style={{ textAlign: 'right' }}>TOTAL BETS</span>
              <span style={{ textAlign: 'right' }}>INVESTED</span>
              <span style={{ textAlign: 'right' }}>PAYOUT</span>
              <span style={{ textAlign: 'right' }}>HOUSE P&L</span>
            </div>
            {races.length === 0 ? (
              <div className="glass-panel text-mono" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                NO RACES FOUND.
              </div>
            ) : (
              races.map(race => (
              <div key={race.round_id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div 
                  className="glass-panel"
                  onClick={() => setSelectedRace(selectedRace?.round_id === race.round_id ? null : race)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                    padding: '1.25rem 1.5rem',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: selectedRace?.round_id === race.round_id ? '4px solid var(--accent-primary)' : '4px solid transparent',
                    background: selectedRace?.round_id === race.round_id ? 'rgba(242, 24, 24, 0.05)' : undefined
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 900, color: '#fff', fontSize: '1rem' }}>RACE {race.round_id || 'UNKNOWN'}</p>
                    {race.name && <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{race.name.toUpperCase()} {race.track ? `// ${race.track.toUpperCase()}` : ''}</p>}
                  </div>
                  <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#fff' }}>{race.totalBets}</p>
                  <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>${race.totalInvested.toLocaleString()}</p>
                  <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: '#00ff88', fontWeight: 'bold' }}>${race.totalWon.toLocaleString()}</p>
                  <p className="text-mono" style={{ textAlign: 'right', fontSize: '1rem', color: race.housePL > 0 ? '#00ff88' : race.housePL < 0 ? '#ff4444' : 'var(--text-muted)', fontWeight: 900 }}>
                    {race.housePL >= 0 ? '+' : ''}${race.housePL.toLocaleString()}
                  </p>
                </div>

                {/* Expanded Race Detail */}
                {selectedRace?.round_id === race.round_id && selectedRace.bets.length > 0 && (
                  <div className="glass-panel animate-in" style={{ padding: '2rem', borderLeft: '4px solid var(--accent-primary)', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                          BET HISTORY — <span style={{ color: 'var(--accent-primary)' }}>RACE {selectedRace.round_id || 'UNKNOWN'}</span>
                        </h3>
                        {selectedRace.name && (
                          <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            RACE: <span style={{ color: '#fff' }}>{selectedRace.name.toUpperCase()}</span>
                            {selectedRace.track && <> // TRACK: <span style={{ color: '#fff' }}>{selectedRace.track.toUpperCase()}</span></>}
                          </p>
                        )}
                        {selectedRace.results && selectedRace.results.length > 0 && (
                          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {selectedRace.results.slice(0, 3).map((res) => {
                              let badgeColor = '#666';
                              if (res.pos === 1) badgeColor = '#FFD700';
                              else if (res.pos === 2) badgeColor = '#C0C0C0';
                              else if (res.pos === 3) badgeColor = '#CD7F32';
                              
                              const status = res.is_dnf ? 'DNF' : res.is_dsq ? 'DSQ' : `${res.pos}${res.pos === 1 ? 'ST' : res.pos === 2 ? 'ND' : res.pos === 3 ? 'RD' : 'TH'}`;
                              
                              return (
                                <span key={res.name} className="text-mono" style={{
                                  fontSize: '0.7rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${badgeColor}`,
                                  color: badgeColor,
                                  borderRadius: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <strong>{status}</strong>
                                  <span style={{ color: '#fff' }}>{res.name.toUpperCase()}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="SEARCH NAME OR CID..."
                        className="input-base text-mono"
                        style={{ maxWidth: '300px' }}
                        value={raceBetSearchQuery}
                        onChange={(e) => setRaceBetSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="text-mono" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 0.75fr 1.25fr 0.5fr 1fr 0.75fr 0.75fr 0.75fr 0.75fr 1fr', 
                      padding: '0.75rem 1rem',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      letterSpacing: '2px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      marginBottom: '0.5rem'
                    }}>
                      <span>MANAGEMENT</span>
                      <span>BETTOR NAME</span>
                      <span>CID</span>
                      <span>BET ON</span>
                      <span>POS</span>
                      <span>TYPE</span>
                      <span style={{ textAlign: 'right' }}>AMOUNT</span>
                      <span style={{ textAlign: 'right' }}>PAYOUT</span>
                      <span style={{ textAlign: 'right' }}>HOUSE P&L</span>
                      <span style={{ textAlign: 'right' }}>RESULT</span>
                      <span style={{ textAlign: 'right' }}>PAYOUT STATUS</span>
                    </div>

                    <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {selectedRace.bets.filter(bet => {
                        if (!raceBetSearchQuery) return true;
                        const query = raceBetSearchQuery.toLowerCase();
                        const matchName = bet.bettor_name?.toLowerCase().includes(query) || false;
                        const matchCid = bet.cid?.toLowerCase().includes(query) || false;
                        return matchName || matchCid;
                      }).map(bet => {
                        const housePL = bet.result === 'WON' ? bet.amount - bet.payout : bet.result === 'LOST' ? bet.amount : 0;
                        
                        return (
                          <div 
                            key={bet.id}
                            style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1fr 1fr 0.75fr 1.25fr 0.5fr 1fr 0.75fr 0.75fr 0.75fr 0.75fr 1fr', 
                              padding: '0.75rem 1rem',
                              background: 'rgba(255,255,255,0.02)',
                              alignItems: 'center'
                            }}
                          >
                            <p style={{ color: '#fff', fontSize: '0.85rem' }}>{bet.bidder_name?.toUpperCase()}</p>
                            <p style={{ color: '#fff', fontSize: '0.85rem' }}>{bet.bettor_name?.toUpperCase() || '—'}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{bet.cid?.toUpperCase() || '—'}</p>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>{bet.racer_name}</span>
                            <span className="text-mono" style={{ fontSize: '0.85rem', color: '#ffaa00' }}>{bet.position_prediction || '—'}</span>
                            <span className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{bet.racer_type}</span>
                            <span className="text-mono" style={{ textAlign: 'right', fontSize: '0.95rem', color: '#fff', fontWeight: 'bold' }}>
                              ${bet.amount.toLocaleString()}
                            </span>
                            <span className="text-mono" style={{ textAlign: 'right', fontSize: '0.95rem', color: bet.result === 'WON' ? '#00ff88' : 'var(--text-muted)', fontWeight: 'bold' }}>
                              {bet.result === 'WON' ? `$${bet.payout.toLocaleString()}` : bet.result === 'LOST' ? '$0' : '—'}
                            </span>
                            <span className="text-mono" style={{ 
                              textAlign: 'right', 
                              fontSize: '0.95rem', 
                              fontWeight: 900,
                              color: housePL > 0 ? '#00ff88' : housePL < 0 ? '#ff4444' : '#888'
                            }}>
                              {bet.result === 'PENDING' ? '—' : `${housePL >= 0 ? '+' : ''}$${housePL.toLocaleString()}`}
                            </span>
                            <span className="text-mono" style={{ 
                              textAlign: 'right', 
                              fontSize: '0.75rem', 
                              fontWeight: 900,
                              color: bet.result === 'WON' ? '#ff4444' : bet.result === 'LOST' ? '#00ff88' : '#888',
                              letterSpacing: '1px'
                            }}>
                              {bet.result}
                            </span>
                            <div style={{ textAlign: 'right' }}>
                              <select 
                                value={bet.payout_status}
                                onChange={(e) => handlePayoutStatusChange(bet.id, e.target.value)}
                                className="text-mono"
                                style={{
                                  background: 'rgba(0,0,0,0.5)',
                                  color: bet.payout_status === 'RETURNED' ? '#00ff88' : bet.payout_status === 'DECLINED' ? '#ff4444' : '#fff',
                                  border: '1px solid #333',
                                  padding: '0.25rem',
                                  fontSize: '0.65rem',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  borderRadius: '2px'
                                }}
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="RETURNED">RETURNED</option>
                                <option value="DECLINED">DECLINED</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        )}


        
        {/* Live Global Feed */}
        <div className="glass-panel" style={{ marginTop: '2rem', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>
              LIVE GLOBAL FEED
            </h3>
            <span className="pulse-indicator"></span>
          </div>

          <div className="text-mono" style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 0.75fr 1.25fr 0.5fr 1fr 0.75fr 0.75fr 0.75fr 0.75fr', 
            padding: '0.75rem 1rem',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '2px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '0.5rem'
          }}>
            <span>MANAGEMENT</span>
            <span>BETTOR NAME</span>
            <span>CID</span>
            <span>BET ON</span>
            <span>POS</span>
            <span>TYPE</span>
            <span style={{ textAlign: 'right' }}>AMOUNT</span>
            <span style={{ textAlign: 'right' }}>PAYOUT</span>
            <span style={{ textAlign: 'right' }}>HOUSE P&L</span>
            <span style={{ textAlign: 'right' }}>RESULT</span>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {recentBets.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }} className="text-mono">
                NO RECENT BETS FOUND.
              </div>
            ) : (
              recentBets.map(bet => {
                const housePL = bet.result === 'WON' ? bet.amount - bet.payout : bet.result === 'LOST' ? bet.amount : 0;
                
                return (
                  <div 
                    key={bet.id}
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 0.75fr 1.25fr 0.5fr 1fr 0.75fr 0.75fr 0.75fr 0.75fr', 
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.02)',
                      alignItems: 'center',
                      animation: 'fadeIn 0.5s ease-out'
                    }}
                  >
                    <p style={{ color: '#fff', fontSize: '0.85rem' }}>{bet.bidder_name?.toUpperCase()}</p>
                    <p style={{ color: '#fff', fontSize: '0.85rem' }}>{bet.bettor_name?.toUpperCase() || '—'}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{bet.cid?.toUpperCase() || '—'}</p>
                    <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{bet.racer_name}</p>
                    <span className="text-mono" style={{ fontSize: '0.85rem', color: '#ffaa00' }}>{bet.position_prediction || '—'}</span>
                    <p className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{bet.racer_type}</p>
                    <p className="text-mono" style={{ textAlign: 'right', color: '#fff', fontSize: '0.85rem' }}>${bet.amount.toLocaleString()}</p>
                    <p className="text-mono" style={{ textAlign: 'right', color: bet.result === 'WON' ? '#00ff88' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {bet.result === 'WON' ? `$${bet.payout.toLocaleString()}` : bet.result === 'LOST' ? '$0' : '—'}
                    </p>
                    <p className="text-mono" style={{ 
                      textAlign: 'right', 
                      color: housePL > 0 ? '#00ff88' : housePL < 0 ? '#ff4444' : 'var(--text-muted)', 
                      fontSize: '0.85rem',
                      fontWeight: 'bold' 
                    }}>
                      {bet.result === 'PENDING' ? '—' : `${housePL >= 0 ? '+' : ''}$${housePL.toLocaleString()}`}
                    </p>
                    <p className="text-mono" style={{ 
                      textAlign: 'right', 
                      fontSize: '0.75rem',
                      color: bet.result === 'WON' ? '#ff4444' : bet.result === 'LOST' ? '#00ff88' : 'var(--accent-secondary)'
                    }}>{bet.result}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
