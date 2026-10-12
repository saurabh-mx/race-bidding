'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useModal } from '@/components/ModalProvider';

interface RaceResultPanelProps {
  isOpen: boolean;
  onClose: () => void;
  teamTimeLeft: number;
  indTimeLeft: number;
  monthlyTimeLeft: number;
  onSettlementComplete?: () => void;
}

interface RacerItem {
  id: string;
  name: string;
  type: string;
  team_name?: string;
  is_posted: boolean;
  tournament_points?: number;
  races?: number;
  wins?: number;
  avg_pos?: number;
  current_bid?: number;
}

interface ActiveRaceInfo {
  id: number;
  name: string;
  track?: string;
  status: string;
}

interface TeamStandingPreview {
  id: string;
  name: string;
  basePoints: number;
  driverPoints: number;
  totalPoints: number;
  predictedRank: number;
}

const RACER_ODDS_MULTIPLIERS: Record<string, number> = {
  '1': 1.5,
  '2-3': 1.4,
  '4-6': 1.3,
  '6-10': 1.2,
  '7-10': 1.2,
  '11-15': 1.1,
};

function calculatePointsForPosition(exactPos: number, isDnf: boolean, isDsq: boolean, isTeam: boolean): number {
  if (isTeam) return 0;
  if (isDnf) return -2;
  if (isDsq) return -10;
  if (exactPos === 1) return 30;
  if (exactPos === 2) return 27;
  if (exactPos === 3) return 25;
  if (exactPos === 4) return 23;
  if (exactPos === 5) return 21;
  if (exactPos === 6) return 20;
  if (exactPos === 7) return 19;
  if (exactPos === 8) return 18;
  if (exactPos === 9) return 17;
  if (exactPos === 10) return 16;
  if (exactPos === 11) return 15;
  if (exactPos === 12) return 14;
  if (exactPos === 13) return 13;
  if (exactPos === 14) return 12;
  if (exactPos === 15) return 11;
  if (exactPos === 16) return 10;
  if (exactPos === 17) return 9;
  if (exactPos === 18) return 8;
  if (exactPos === 19) return 7;
  if (exactPos === 20) return 6;
  if (exactPos === 21) return 5;
  if (exactPos === 22) return 4;
  if (exactPos === 23) return 3;
  if (exactPos === 24) return 2;
  if (exactPos >= 25 && exactPos <= 42) return 1;
  return 0;
}

function getMultiplierForBid(positionPrediction?: string | null): number {
  if (!positionPrediction) return 1.2;
  const oddsMatch = positionPrediction.match(/([\d.]+)x/i);
  if (oddsMatch && !isNaN(parseFloat(oddsMatch[1]))) {
    return parseFloat(oddsMatch[1]);
  }
  const cleanBucket = positionPrediction.split(' ')[0].trim();
  return RACER_ODDS_MULTIPLIERS[cleanBucket] || 1.2;
}

function isPositionInBucket(exactPosStr: string, bucketStr?: string | null): boolean {
  if (!exactPosStr || !bucketStr) return false;
  if (exactPosStr === 'DNF' || exactPosStr === 'DSQ') return false;
  const pos = parseInt(exactPosStr, 10);
  if (isNaN(pos)) return false;

  // Clean out any custom multiplier notation (e.g. "(2.5x)" or "@ 2.5x") and position prefixes
  const cleanPosStr = bucketStr
    .replace(/\s*\([\d.]+x\).*/i, '')
    .replace(/\s*@\s*[\d.]+x.*/i, '')
    .replace(/^pos(ition)?\s*/i, '')
    .trim();

  if (cleanPosStr === '1') return pos === 1;
  const parts = cleanPosStr.split('-').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
  if (parts.length === 1) return pos === parts[0];
  if (parts.length === 2) {
    const min = Math.min(parts[0], parts[1]);
    const max = Math.max(parts[0], parts[1]);
    return pos >= min && pos <= max;
  }
  return false;
}

export default function RaceResultPanel({
  isOpen,
  onClose,
  teamTimeLeft,
  indTimeLeft,
  monthlyTimeLeft,
  onSettlementComplete,
}: RaceResultPanelProps) {
  const { showError, showConfirm, showSuccess } = useModal();

  // Mode and Category
  const [activeCategory, setActiveCategory] = useState<'RACER' | 'TEAM' | 'MONTHLY'>('RACER');
  
  // Data State
  const [racers, setRacers] = useState<RacerItem[]>([]);
  const [activeRace, setActiveRace] = useState<ActiveRaceInfo | null>(null);
  const [currentRoundId, setCurrentRoundId] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  
  // Placement State (Categorized & Auto-Persisted)
  const [positionsByCategory, setPositionsByCategory] = useState<{
    RACER: Record<string, string>;
    TEAM: Record<string, string>;
    MONTHLY: Record<string, string>;
  }>({
    RACER: {},
    TEAM: {},
    MONTHLY: {},
  });

  const positions = useMemo(() => {
    return positionsByCategory[activeCategory] || {};
  }, [positionsByCategory, activeCategory]);

  const [quickFinishMode, setQuickFinishMode] = useState(true); // Default true for fastest entry
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNASSIGNED' | 'PODIUM' | 'TOP10' | 'DNF_DSQ'>('ALL');
  const [sortBy, setSortBy] = useState<'POSITION' | 'NAME'>('POSITION');

  // Fast Settlement state
  const [isSettling, setIsSettling] = useState(false);
  const [settleProgress, setSettleProgress] = useState<{ step: number; total: number; label: string }>({
    step: 0,
    total: 3,
    label: '',
  });

  // Team auto-calculation preview
  const [teamStandings, setTeamStandings] = useState<TeamStandingPreview[]>([]);

  // Bids telemetry preview
  const [pendingBids, setPendingBids] = useState<any[]>([]);

  // Load all data when modal opens or category changes
  const loadPanelData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch app settings for current round
      const { data: settings } = await supabase
        .from('app_settings')
        .select('current_round_id')
        .maybeSingle();
      const roundId = settings?.current_round_id || 1;
      setCurrentRoundId(roundId);

      // 2. Fetch active race metadata if any
      const { data: raceData } = await supabase
        .from('races')
        .select('id, name, track, status')
        .eq('status', 'ACTIVE')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveRace(raceData || null);

      // 3. Fetch posted participants
      let racerQuery = supabase.from('racers').select('*').eq('is_posted', true);
      const { data: postedData } = await racerQuery;
      const allPosted = postedData || [];
      setRacers(allPosted);

      // 4. Fetch pending approved bids for posted racers to show live telemetry
      const postedIds = allPosted.map((r: any) => r.id);
      if (postedIds.length > 0) {
        const { data: bidsData } = await supabase
          .from('bids')
          .select('id, racer_id, amount, position_prediction, status, result')
          .eq('status', 'APPROVED')
          .eq('result', 'PENDING')
          .in('racer_id', postedIds);
        setPendingBids(bidsData || []);
      } else {
        setPendingBids([]);
      }

      // 5. If category is TEAM, pre-calculate team standings
      const { data: allTeams } = await supabase.from('racers').select('*').eq('type', 'TEAM');
      const { data: allIndRacers } = await supabase
        .from('racers')
        .select('*')
        .neq('type', 'TEAM')
        .not('type', 'ilike', 'MONTHLY%');

      if (allTeams && allIndRacers) {
        const calculatedTeams: TeamStandingPreview[] = allTeams.map((team) => {
          const teamDrivers = allIndRacers.filter((r) => r.team_name === team.name);
          const driverPts = teamDrivers.reduce((sum, r) => sum + (r.tournament_points || 0), 0);
          const basePts = team.tournament_points || 0;
          return {
            id: team.id,
            name: team.name,
            basePoints: basePts,
            driverPoints: driverPts,
            totalPoints: basePts + driverPts,
            predictedRank: 0,
          };
        }).sort((a, b) => b.totalPoints - a.totalPoints);

        calculatedTeams.forEach((t, idx) => {
          t.predictedRank = idx + 1;
        });

        setTeamStandings(calculatedTeams);
      }

      // 6. Restore drafts from localStorage or Supabase results table
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`race_settlement_draft_${roundId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              setPositionsByCategory((prev) => ({
                ...prev,
                ...parsed,
              }));
            }
          } else {
            // Check Supabase results table if previous results exist
            const { data: dbResults } = await supabase
              .from('results')
              .select('racer_id, position, is_dnf, is_dsq, category')
              .eq('round_id', roundId);

            if (dbResults && dbResults.length > 0) {
              const loaded: {
                RACER: Record<string, string>;
                TEAM: Record<string, string>;
                MONTHLY: Record<string, string>;
              } = {
                RACER: {},
                TEAM: {},
                MONTHLY: {},
              };
              dbResults.forEach((r: any) => {
                const cat = (
                  r.category === 'TEAM' || r.category === 'MONTHLY' ? r.category : 'RACER'
                ) as 'RACER' | 'TEAM' | 'MONTHLY';
                if (r.is_dnf) loaded[cat][r.racer_id] = 'DNF';
                else if (r.is_dsq) loaded[cat][r.racer_id] = 'DSQ';
                else if (r.position) loaded[cat][r.racer_id] = String(r.position);
              });
              setPositionsByCategory((prev) => ({
                ...prev,
                ...loaded,
              }));
            }
          }
        } catch (e) {
          console.error('Error loading draft positions:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load RaceResultPanel data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPanelData();
      setSearchQuery('');
    }
  }, [isOpen, loadPanelData]);

  // Filter participants for active category
  const categoryRacers = useMemo(() => {
    return racers.filter((r) => {
      if (activeCategory === 'TEAM') return r.type === 'TEAM';
      if (activeCategory === 'MONTHLY') return r.type === 'MONTHLY_RACER';
      return r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY');
    });
  }, [racers, activeCategory]);

  // Find lowest available integer rank for Tap-to-Place mode (e.g. 1, 2, 3...)
  const nextAvailableRank = useMemo(() => {
    const assignedNumbers = new Set(
      Object.values(positions)
        .map((p) => parseInt(p, 10))
        .filter((n) => !isNaN(n))
    );
    let candidate = 1;
    while (assignedNumbers.has(candidate)) {
      candidate++;
    }
    return candidate;
  }, [positions]);

  // Position assignments count
  const stats = useMemo(() => {
    const total = categoryRacers.length;
    let assigned = 0;
    let dnfDsq = 0;
    categoryRacers.forEach((r) => {
      const pos = positions[r.id];
      if (pos) {
        assigned++;
        if (pos === 'DNF' || pos === 'DSQ') dnfDsq++;
      }
    });
    const unassigned = total - assigned;
    return { total, assigned, unassigned, dnfDsq };
  }, [categoryRacers, positions]);

  // Quick Place: Click card to assign next available rank
  const handleCardClick = (racerId: string) => {
    if (!quickFinishMode) return;
    setPositionsByCategory((prevAll) => {
      const currentCatMap = { ...(prevAll[activeCategory] || {}) };
      const current = currentCatMap[racerId];
      if (current) {
        delete currentCatMap[racerId];
      } else {
        const nextRankStr = String(nextAvailableRank);
        Object.keys(currentCatMap).forEach((id) => {
          if (currentCatMap[id] === nextRankStr) {
            delete currentCatMap[id];
          }
        });
        currentCatMap[racerId] = nextRankStr;
      }
      const nextAll = { ...prevAll, [activeCategory]: currentCatMap };
      if (typeof window !== 'undefined' && currentRoundId) {
        try {
          localStorage.setItem(`race_settlement_draft_${currentRoundId}`, JSON.stringify(nextAll));
        } catch {}
      }
      return nextAll;
    });
  };

  // Direct position selection with duplicate position prevention
  const setRacerPosition = (racerId: string, posValue: string) => {
    setPositionsByCategory((prevAll) => {
      const currentCatMap = { ...(prevAll[activeCategory] || {}) };
      if (!posValue) {
        delete currentCatMap[racerId];
      } else {
        // If assigning a specific numeric rank (not DNF/DSQ), remove it from any other racer who currently holds it
        if (posValue !== 'DNF' && posValue !== 'DSQ') {
          Object.keys(currentCatMap).forEach((id) => {
            if (id !== racerId && currentCatMap[id] === posValue) {
              delete currentCatMap[id];
            }
          });
        }
        currentCatMap[racerId] = posValue;
      }
      const nextAll = { ...prevAll, [activeCategory]: currentCatMap };
      if (typeof window !== 'undefined' && currentRoundId) {
        try {
          localStorage.setItem(`race_settlement_draft_${currentRoundId}`, JSON.stringify(nextAll));
        } catch {}
      }
      return nextAll;
    });
  };

  // 1-Click: Auto-fill all remaining unassigned racers as DNF
  const handleAutoFillDNF = () => {
    const unassignedCount = stats.unassigned;
    if (unassignedCount === 0) {
      showError('No Unassigned Drivers', 'All drivers on the grid already have a position assigned!');
      return;
    }
    setPositionsByCategory((prevAll) => {
      const currentCatMap = { ...(prevAll[activeCategory] || {}) };
      categoryRacers.forEach((r) => {
        if (!currentCatMap[r.id]) {
          currentCatMap[r.id] = 'DNF';
        }
      });
      const nextAll = { ...prevAll, [activeCategory]: currentCatMap };
      if (typeof window !== 'undefined' && currentRoundId) {
        try {
          localStorage.setItem(`race_settlement_draft_${currentRoundId}`, JSON.stringify(nextAll));
        } catch {}
      }
      return nextAll;
    });
    showSuccess('Grid Auto-Filled', `Marked ${unassignedCount} remaining unranked drivers as DNF!`);
  };

  // Reset all assigned positions for active category
  const handleClearAll = () => {
    if (Object.keys(positions).length === 0) return;
    showConfirm(
      'CLEAR POSITIONS',
      `Are you sure you want to clear all assigned positions for ${activeCategory} in this race?`,
      () => {
        setPositionsByCategory((prevAll) => {
          const nextAll = { ...prevAll, [activeCategory]: {} };
          if (typeof window !== 'undefined' && currentRoundId) {
            try {
              localStorage.setItem(`race_settlement_draft_${currentRoundId}`, JSON.stringify(nextAll));
            } catch {}
          }
          return nextAll;
        });
      },
      true
    );
  };

  // Filter and sort display list
  const displayedRacers = useMemo(() => {
    let list = categoryRacers.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.team_name && r.team_name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;

      const pos = positions[r.id];
      if (filterMode === 'UNASSIGNED') return !pos;
      if (filterMode === 'PODIUM') {
        const n = parseInt(pos, 10);
        return n >= 1 && n <= 3;
      }
      if (filterMode === 'TOP10') {
        const n = parseInt(pos, 10);
        return n >= 1 && n <= 10;
      }
      if (filterMode === 'DNF_DSQ') return pos === 'DNF' || pos === 'DSQ';
      return true;
    });

    if (sortBy === 'POSITION') {
      list.sort((a, b) => {
        const posA = positions[a.id];
        const posB = positions[b.id];
        if (!posA && !posB) return a.name.localeCompare(b.name);
        if (!posA) return 1;
        if (!posB) return -1;
        if (posA === 'DNF' && posB === 'DSQ') return -1;
        if (posA === 'DSQ' && posB === 'DNF') return 1;
        if (posA === 'DNF' || posA === 'DSQ') return 1;
        if (posB === 'DNF' || posB === 'DSQ') return -1;
        return parseInt(posA, 10) - parseInt(posB, 10);
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [categoryRacers, searchQuery, filterMode, sortBy, positions]);

  // Live telemetry summary
  const preFlightTelemetry = useMemo(() => {
    const postedRacerIds = new Set(categoryRacers.map((r) => r.id));
    const relevantBids = pendingBids.filter((b) => postedRacerIds.has(b.racer_id));

    let winningBidsCount = 0;
    let losingBidsCount = 0;
    let totalWinningPool = 0;
    let totalLosingPool = 0;
    let projectedPayout = 0;

    relevantBids.forEach((bid) => {
      const pos = positions[bid.racer_id];
      const isWinner = pos && isPositionInBucket(pos, bid.position_prediction);
      if (isWinner) {
        winningBidsCount++;
        totalWinningPool += bid.amount;
        if (activeCategory === 'RACER') {
          const mult = getMultiplierForBid(bid.position_prediction);
          projectedPayout += Math.round(bid.amount * mult);
        }
      } else {
        losingBidsCount++;
        totalLosingPool += bid.amount;
      }
    });

    if (activeCategory !== 'RACER') {
      // Parimutuel share or explicit fixed odds
      relevantBids.forEach((bid) => {
        const pos = positions[bid.racer_id];
        if (pos && isPositionInBucket(pos, bid.position_prediction)) {
          if (bid.position_prediction && /[\d.]+x/i.test(bid.position_prediction)) {
            const mult = getMultiplierForBid(bid.position_prediction);
            projectedPayout += Math.round(bid.amount * mult);
          } else {
            const share = totalWinningPool > 0 ? (bid.amount / totalWinningPool) * (totalLosingPool / 2) : 0;
            projectedPayout += bid.amount + Math.floor(share);
          }
        }
      });
    }

    // Identify current P1 Winner
    let winnerName = '—';
    for (const [id, pos] of Object.entries(positions)) {
      if (pos === '1') {
        const winnerRacer = categoryRacers.find((r) => r.id === id);
        if (winnerRacer) winnerName = winnerRacer.name;
        break;
      }
    }

    return {
      totalBids: relevantBids.length,
      winningBidsCount,
      losingBidsCount,
      totalWinningPool,
      totalLosingPool,
      projectedPayout,
      winnerName,
    };
  }, [categoryRacers, pendingBids, positions, activeCategory]);

  // Active Timer check
  const activeTimeLeft = useMemo(() => {
    if (activeCategory === 'TEAM') return teamTimeLeft;
    if (activeCategory === 'MONTHLY') return monthlyTimeLeft;
    return indTimeLeft;
  }, [activeCategory, teamTimeLeft, monthlyTimeLeft, indTimeLeft]);

  // Format countdown
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- ULTRA-FAST PARALLEL SETTLEMENT ENGINE ---
  const handleAnnounceFast = async () => {
    if (isSettling) return;

    // 1. Timer check
    if (activeTimeLeft > 0) {
      showError(
        'Timer Still Active',
        `The ${activeCategory} bidding window is still running (${formatTimer(activeTimeLeft)} remaining). Cannot announce results until bidding closes!`
      );
      return;
    }

    // 2. Validation
    let finalPositions = { ...positions };

    if (activeCategory === 'TEAM') {
      // Team positions are automatically calculated
      if (teamStandings.length === 0) {
        showError('No Teams Found', 'Could not compute team standings. No teams available.');
        return;
      }
      teamStandings.forEach((t, idx) => {
        finalPositions[t.id] = String(idx + 1);
      });
    } else {
      if (categoryRacers.length === 0) {
        showError('No Participants', 'There are no active posted racers in this category.');
        return;
      }
      const missing = categoryRacers.filter((r) => !finalPositions[r.id]);
      if (missing.length > 0) {
        showConfirm(
          'Incomplete Grid',
          `${missing.length} drivers have no position assigned. Would you like to automatically assign them as DNF and post immediately?`,
          () => {
            const patched = { ...finalPositions };
            missing.forEach((m) => {
              patched[m.id] = 'DNF';
            });
            executeSettlement(patched);
          }
        );
        return;
      }
    }

    executeSettlement(finalPositions);
  };

  const executeSettlement = async (finalPositions: Record<string, string>) => {
    setIsSettling(true);
    setSettleProgress({ step: 1, total: 3, label: 'Computing Payouts & Telemetry...' });

    try {
      const postedRacerIds = categoryRacers.map((r) => r.id);

      // Fetch fresh bids
      const { data: freshBids } = await supabase
        .from('bids')
        .select('id, racer_id, user_id, amount, position_prediction')
        .eq('status', 'APPROVED')
        .eq('result', 'PENDING')
        .in('racer_id', postedRacerIds);

      const allBids = freshBids || [];
      const winningBids = allBids.filter((b: any) => isPositionInBucket(finalPositions[b.racer_id], b.position_prediction));
      const losingBids = allBids.filter((b: any) => !isPositionInBucket(finalPositions[b.racer_id], b.position_prediction));

      const totalWinningPool = winningBids.reduce((sum: number, b: any) => sum + b.amount, 0);
      const totalLosingPool = losingBids.reduce((sum: number, b: any) => sum + b.amount, 0);

      // Prepare winning bid payout updates
      const winningUpdates = winningBids.map((bid: any) => {
        let payout = 0;
        const hasExplicitOdds = bid.position_prediction && /[\d.]+x/i.test(bid.position_prediction);
        if (activeCategory === 'RACER' || hasExplicitOdds) {
          const multiplier = getMultiplierForBid(bid.position_prediction);
          payout = Math.round(bid.amount * multiplier);
        } else {
          const share = totalWinningPool > 0 ? (bid.amount / totalWinningPool) * (totalLosingPool / 2) : 0;
          payout = bid.amount + Math.floor(share);
        }
        return { id: bid.id, payout };
      });

      // Prepare racer telemetry updates
      const { data: racersData } = await supabase
        .from('racers')
        .select('id, name, races, wins, avg_pos, tournament_points, type')
        .in('id', postedRacerIds);

      const resultsToInsert: any[] = [];
      const racerUpdates: { id: string; data: any }[] = [];

      (racersData || []).forEach((racer) => {
        const exactPosStr = finalPositions[racer.id];
        if (!exactPosStr) return;

        let exactPos = 15;
        let isDnf = false;
        let isDsq = false;
        if (exactPosStr === 'DNF') isDnf = true;
        else if (exactPosStr === 'DSQ') isDsq = true;
        else exactPos = parseInt(exactPosStr, 10) || 15;

        if (isDnf || isDsq) {
          exactPos = racer.type === 'TEAM' ? 15 : 45;
        }

        const earnedPoints = calculatePointsForPosition(exactPos, isDnf, isDsq, racer.type === 'TEAM');
        const oldRaces = racer.races || 0;
        const oldWins = racer.wins || 0;
        const oldAvgPos = racer.avg_pos || 0;
        const oldPoints = racer.tournament_points || 0;

        const newRaces = oldRaces + 1;
        const isWin = !isDnf && !isDsq && exactPos >= 1 && exactPos <= 3;
        const newWins = oldWins + (isWin ? 1 : 0);
        const newWinRate = Math.round((newWins / newRaces) * 100);
        const newAvgPos = Math.round(((oldAvgPos * oldRaces) + exactPos) / newRaces);
        const newPoints = oldPoints + earnedPoints;

        racerUpdates.push({
          id: racer.id,
          data: {
            races: newRaces,
            wins: newWins,
            win_rate: newWinRate,
            avg_pos: newAvgPos,
            tournament_points: newPoints,
          },
        });

        resultsToInsert.push({
          round_id: currentRoundId,
          racer_id: racer.id,
          position: exactPos,
          points_earned: earnedPoints,
          is_dnf: isDnf,
          is_dsq: isDsq,
          category: activeCategory,
        });
      });

      // Identify Winner Name
      let firstPlaceId: string | null = null;
      for (const [id, pos] of Object.entries(finalPositions)) {
        if (parseInt(pos, 10) === 1) {
          firstPlaceId = id;
          break;
        }
      }
      let winnerName = 'POSITIONS LOGGED';
      if (firstPlaceId) {
        const winR = categoryRacers.find((r) => r.id === firstPlaceId);
        if (winR) winnerName = winR.name;
      }

      setSettleProgress({ step: 2, total: 3, label: 'Executing Parallel Batch Settlement...' });      // PHASE 1: EXECUTE CONCURRENT PARALLEL WRITES FOR BIDS & RACERS
      const phase1Tasks: Promise<any>[] = [];

      // A. Parallel Winning Bids Updates
      if (winningUpdates.length > 0) {
        phase1Tasks.push(
          Promise.all(
            winningUpdates.map(async (u) => {
              return await supabase.from('bids').update({ result: 'WON', payout: u.payout }).eq('id', u.id);
            })
          )
        );
      }

      // B. Bulk Losing Bids Update in 1 query
      const losingBidIds = losingBids.map((b: any) => b.id);
      if (losingBidIds.length > 0) {
        phase1Tasks.push(
          (async () => {
            return await supabase.from('bids').update({ result: 'LOST', payout: 0 }).in('id', losingBidIds);
          })()
        );
      }

      // C. Parallel Racer Telemetry Updates
      if (racerUpdates.length > 0) {
        phase1Tasks.push(
          Promise.all(
            racerUpdates.map(async (u) => {
              return await supabase.from('racers').update(u.data).eq('id', u.id);
            })
          )
        );
      }

      // Wait for bets and racer stats to settle in parallel
      await Promise.all(phase1Tasks);

      setSettleProgress({ step: 3, total: 3, label: 'Finalizing Round & Unposting Grid...' });

      // PHASE 2: INSERT RESULTS, UPSERT APP SETTINGS, COMPLETE RACE, UNPOST RACERS IN PARALLEL
      const phase2Tasks: Promise<any>[] = [];

      // A. Insert results telemetry in 1 bulk insert
      if (resultsToInsert.length > 0) {
        phase2Tasks.push(
          (async () => {
            return await supabase.from('results').insert(resultsToInsert);
          })()
        );
      }

      // B. App settings update
      const updateData: any = {
        id: 1,
        latest_winner: winnerName,
        current_round_id: currentRoundId + 1,
      };
      if (activeCategory === 'TEAM') updateData.latest_team_winner = winnerName;
      else if (activeCategory === 'MONTHLY') updateData.latest_monthly_winner = winnerName;
      else updateData.latest_racer_winner = winnerName;

      phase2Tasks.push(
        (async () => {
          return await supabase.from('app_settings').upsert(updateData, { onConflict: 'id' });
        })()
      );

      // C. Mark active race in races table as COMPLETED
      phase2Tasks.push(
        (async () => {
          return await supabase.from('races').update({ status: 'COMPLETED' }).eq('status', 'ACTIVE');
        })()
      );

      // D. Unpost racers in 1 query
      if (activeCategory === 'TEAM') {
        phase2Tasks.push(
          (async () => {
            return await supabase.from('racers').update({ is_posted: false, current_bid: 0 }).eq('type', 'TEAM');
          })()
        );
      } else if (activeCategory === 'MONTHLY') {
        phase2Tasks.push(
          (async () => {
            return await supabase.from('racers').update({ is_posted: false, current_bid: 0 }).in('type', ['MONTHLY_RACER']);
          })()
        );
      } else {
        phase2Tasks.push(
          (async () => {
            return await supabase
              .from('racers')
              .update({ is_posted: false, current_bid: 0 })
              .neq('type', 'TEAM')
              .neq('type', 'MONTHLY_RACER');
          })()
        );
      }

      // E. Audit log
      phase2Tasks.push(
        (async () => {
          return await supabase.from('audit_logs').insert([
            {
              action: 'ANNOUNCE_WINNER',
              details:
                activeCategory === 'RACER'
                  ? `Announced RACER positions with fixed odds multipliers. ${winningBids.length} winning bets, ${losingBids.length} losing bets.`
                  : `Announced ${activeCategory} positions. Winning pool: $${totalWinningPool}, Losing pool: $${totalLosingPool}. ${winningBids.length} winning bets, ${losingBids.length} losing bets.`,
            },
          ]);
        })()
      );

      // Await final parallel tasks
      await Promise.all(phase2Tasks);

      // Clear saved draft for this category
      setPositionsByCategory((prevAll) => {
        const nextAll = { ...prevAll, [activeCategory]: {} };
        if (typeof window !== 'undefined' && currentRoundId) {
          try {
            localStorage.setItem(`race_settlement_draft_${currentRoundId}`, JSON.stringify(nextAll));
          } catch {}
        }
        return nextAll;
      });

      // Finished!
      setIsSettling(false);
      onClose();
      showSuccess(
        'Results Announced!',
        `Round #${currentRoundId} settled in sub-second time! P1: ${winnerName}. ${winningBids.length} winning bets paid out, ${losingBids.length} losing bets resolved.`
      );
      if (onSettlementComplete) onSettlementComplete();
    } catch (err: any) {
      console.error('Fatal error in fast settlement:', err);
      setIsSettling(false);
      showError('Settlement Error', err.message || 'An error occurred during settlement.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 2, 2, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSettling) onClose();
      }}
    >
      <div
        className="glass-panel animate-in"
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--accent-primary)',
          boxShadow: '0 25px 60px rgba(242, 24, 24, 0.25), 0 0 40px rgba(0, 0, 0, 0.9)',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(20, 5, 5, 0.95) 0%, rgba(10, 2, 2, 0.98) 100%)',
        }}
      >
        {/* --- HEADER --- */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid rgba(242, 24, 24, 0.25)',
            background: 'rgba(242, 24, 24, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f21818 0%, #8a0c0c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: '0 0 15px rgba(242, 24, 24, 0.5)',
              }}
            >
              🏁
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2
                  className="title-gradient"
                  style={{
                    fontSize: '1.6rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    margin: 0,
                  }}
                >
                  RACE RESULT SETTLEMENT
                </h2>
                <span
                  className="text-mono"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    background: 'rgba(255, 215, 0, 0.15)',
                    color: '#ffd700',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    fontWeight: 'bold',
                  }}
                >
                  ROUND #{currentRoundId}
                </span>
                {activeRace && (
                  <span
                    className="text-mono"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      background: 'rgba(0, 240, 255, 0.12)',
                      color: '#00f0ff',
                      border: '1px solid rgba(0, 240, 255, 0.25)',
                    }}
                  >
                    {activeRace.name} {activeRace.track ? `• ${activeRace.track}` : ''}
                  </span>
                )}
              </div>
              <p
                className="text-mono"
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  marginTop: '0.2rem',
                }}
              >
                Fast-track settlement console • Tap to rank or 1-click Auto-DNF for instant payouts
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Live timer badge */}
            <div
              className="text-mono"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 'bold',
                background:
                  activeTimeLeft > 0
                    ? 'rgba(255, 68, 68, 0.15)'
                    : 'rgba(0, 255, 136, 0.12)',
                color: activeTimeLeft > 0 ? '#ff4444' : '#00ff88',
                border: `1px solid ${
                  activeTimeLeft > 0 ? '#ff4444' : '#00ff88'
                }`,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: activeTimeLeft > 0 ? '#ff4444' : '#00ff88',
                  boxShadow: `0 0 8px ${
                    activeTimeLeft > 0 ? '#ff4444' : '#00ff88'
                  }`,
                }}
              />
              {activeTimeLeft > 0 ? (
                <>WINDOW ACTIVE ({formatTimer(activeTimeLeft)})</>
              ) : (
                <>WINDOW CLOSED • READY TO SETTLE</>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              disabled={isSettling}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                transition: 'all 0.2s',
              }}
              title="Close Panel"
            >
              ✕
            </button>
          </div>
        </div>

        {/* --- CATEGORY SELECTOR TABS --- */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.5rem 1.75rem',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={() => setActiveCategory('RACER')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border:
                activeCategory === 'RACER'
                  ? '1px solid var(--accent-primary)'
                  : '1px solid transparent',
              background:
                activeCategory === 'RACER'
                  ? 'rgba(242, 24, 24, 0.18)'
                  : 'transparent',
              color: activeCategory === 'RACER' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            <span>🏎️</span> RACER RACE (STARTED)
            <span
              style={{
                fontSize: '0.7rem',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
              }}
            >
              {racers.filter((r) => r.type !== 'TEAM' && !r.type?.startsWith('MONTHLY')).length}
            </span>
          </button>

          <button
            onClick={() => setActiveCategory('TEAM')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border:
                activeCategory === 'TEAM'
                  ? '1px solid var(--accent-primary)'
                  : '1px solid transparent',
              background:
                activeCategory === 'TEAM'
                  ? 'rgba(242, 24, 24, 0.18)'
                  : 'transparent',
              color: activeCategory === 'TEAM' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            <span>👥</span> TEAM RACE (AUTO-POINTS)
            <span
              style={{
                fontSize: '0.7rem',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
              }}
            >
              {racers.filter((r) => r.type === 'TEAM').length}
            </span>
          </button>

          <button
            onClick={() => setActiveCategory('MONTHLY')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border:
                activeCategory === 'MONTHLY'
                  ? '1px solid var(--accent-primary)'
                  : '1px solid transparent',
              background:
                activeCategory === 'MONTHLY'
                  ? 'rgba(242, 24, 24, 0.18)'
                  : 'transparent',
              color: activeCategory === 'MONTHLY' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            <span>🏆</span> MONTHLY RACE
            <span
              style={{
                fontSize: '0.7rem',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
              }}
            >
              {racers.filter((r) => r.type === 'MONTHLY_RACER').length}
            </span>
          </button>
        </div>

        {/* --- MAIN WORKSPACE --- */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* LEFT: GRID CONTROLS & CARDS */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            {/* FAST ACTIONS TOOLBAR (Only relevant if not TEAM) */}
            {activeCategory !== 'TEAM' && (
              <div
                style={{
                  padding: '0.85rem 1.75rem',
                  background: 'rgba(15, 5, 5, 0.7)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Mode Selector & Target */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => setQuickFinishMode(!quickFinishMode)}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      border: quickFinishMode
                        ? '1px solid #ffd700'
                        : '1px solid rgba(255, 255, 255, 0.2)',
                      background: quickFinishMode
                        ? 'rgba(255, 215, 0, 0.15)'
                        : 'rgba(0, 0, 0, 0.4)',
                      color: quickFinishMode ? '#ffd700' : 'var(--text-muted)',
                      transition: 'all 0.15s ease',
                    }}
                    title="Click driver cards in order of finishing to instantly assign P1, P2, P3..."
                  >
                    <span>⚡</span> TAP-TO-RANK MODE: {quickFinishMode ? 'ON' : 'OFF'}
                  </button>

                  {quickFinishMode && (
                    <div
                      className="text-mono"
                      style={{
                        padding: '0.45rem 0.8rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 215, 0, 0.1)',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        color: '#ffd700',
                        fontSize: '0.78rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span>NEXT:</span>
                      <span
                        style={{
                          background: '#ffd700',
                          color: '#000',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: '900',
                        }}
                      >
                        P{nextAvailableRank}
                      </span>
                    </div>
                  )}
                </div>

                {/* Instant Grid Helpers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={handleAutoFillDNF}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: '1px solid rgba(255, 68, 68, 0.4)',
                      background: 'rgba(255, 68, 68, 0.12)',
                      color: '#ff4444',
                      transition: 'all 0.15s',
                    }}
                    title="1-click mark all remaining unranked drivers as DNF"
                  >
                    🚫 AUTO-FILL REMAINING DNF ({stats.unassigned})
                  </button>

                  <button
                    onClick={() => loadPanelData()}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      border: '1px solid rgba(0, 255, 136, 0.4)',
                      background: 'rgba(0, 255, 136, 0.1)',
                      color: '#00ff88',
                      transition: 'all 0.15s',
                    }}
                    title="Refresh telemetry without losing your assigned positions"
                  >
                    🔄 REFRESH DATA
                  </button>

                  <button
                    onClick={handleClearAll}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                    title="Clear all assigned positions"
                  >
                    🗑️ RESET
                  </button>

                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="POSITION">Sort: Position Order</option>
                    <option value="NAME">Sort: Alphabetical</option>
                  </select>
                </div>
              </div>
            )}

            {/* SEARCH AND FILTER CHIPS (Only if not TEAM) */}
            {activeCategory !== 'TEAM' && (
              <div
                style={{
                  padding: '0.65rem 1.75rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(['ALL', 'UNASSIGNED', 'PODIUM', 'TOP10', 'DNF_DSQ'] as const).map((mode) => {
                    const isActive = filterMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setFilterMode(mode)}
                        style={{
                          padding: '0.35rem 0.7rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                          border: isActive
                            ? '1px solid var(--accent-primary)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isActive
                            ? 'rgba(242, 24, 24, 0.2)'
                            : 'rgba(255, 255, 255, 0.03)',
                          color: isActive ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {mode === 'ALL' && `ALL (${categoryRacers.length})`}
                        {mode === 'UNASSIGNED' && (
                          <span style={{ color: stats.unassigned > 0 ? '#ffb300' : 'inherit' }}>
                            UNASSIGNED ({stats.unassigned})
                          </span>
                        )}
                        {mode === 'PODIUM' && 'PODIUM (P1-P3)'}
                        {mode === 'TOP10' && 'TOP 10'}
                        {mode === 'DNF_DSQ' && `DNF/DSQ (${stats.dnfDsq})`}
                      </button>
                    );
                  })}
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                  <input
                    type="text"
                    placeholder="Search participant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '0.4rem 0.75rem',
                      color: '#fff',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* LIST OR TEAM LEADERBOARD VIEW */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem 1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                  <p className="text-mono">Loading grid & telemetry...</p>
                </div>
              ) : activeCategory === 'TEAM' ? (
                /* TEAM RACE LEADERBOARD DISPLAY */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div
                    style={{
                      background: 'rgba(255, 215, 0, 0.08)',
                      border: '1px solid rgba(255, 215, 0, 0.25)',
                      padding: '1rem 1.25rem',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <h4
                        className="text-mono"
                        style={{ color: '#ffd700', fontSize: '0.95rem', fontWeight: 'bold' }}
                      >
                        ⚡ DYNAMIC CONSTRUCTOR STANDINGS
                      </h4>
                      <p
                        className="text-mono"
                        style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}
                      >
                        Team scores are automatically aggregated from individual driver telemetry points.
                      </p>
                    </div>
                    <span
                      className="text-mono"
                      style={{
                        padding: '0.3rem 0.6rem',
                        borderRadius: '4px',
                        background: 'rgba(0, 255, 136, 0.15)',
                        color: '#00ff88',
                        border: '1px solid rgba(0, 255, 136, 0.3)',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      AUTO-CALCULATED
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {teamStandings.map((team, idx) => {
                      const isP1 = idx === 0;
                      const isP2 = idx === 1;
                      const isP3 = idx === 2;

                      return (
                        <div
                          key={team.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.9rem 1.25rem',
                            borderRadius: '8px',
                            background: isP1
                              ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.12) 0%, rgba(20, 5, 5, 0.7) 100%)'
                              : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${
                              isP1
                                ? 'rgba(255, 215, 0, 0.4)'
                                : isP2
                                ? 'rgba(226, 232, 240, 0.3)'
                                : isP3
                                ? 'rgba(217, 119, 6, 0.3)'
                                : 'rgba(255, 255, 255, 0.08)'
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '900',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '1rem',
                                background: isP1
                                  ? '#ffd700'
                                  : isP2
                                  ? '#cbd5e1'
                                  : isP3
                                  ? '#b45309'
                                  : 'rgba(255, 255, 255, 0.1)',
                                color: isP1 || isP2 ? '#000' : '#fff',
                                boxShadow: isP1 ? '0 0 12px rgba(255, 215, 0, 0.4)' : 'none',
                              }}
                            >
                              P{team.predictedRank}
                            </div>
                            <div>
                              <p
                                style={{
                                  fontSize: '1.05rem',
                                  fontWeight: 'bold',
                                  color: '#fff',
                                  margin: 0,
                                }}
                              >
                                {team.name}
                              </p>
                              <p
                                className="text-mono"
                                style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}
                              >
                                Base: {team.basePoints} pts • Drivers: +{team.driverPoints} pts
                              </p>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <p
                              className="text-mono"
                              style={{
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                color: isP1 ? '#ffd700' : '#fff',
                                margin: 0,
                              }}
                            >
                              {team.totalPoints} PTS
                            </p>
                            <span
                              className="text-mono"
                              style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                            >
                              {isP1 ? '🏆 RACE WINNER' : `Position ${team.predictedRank}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : displayedRacers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <p className="text-mono">No active participants matching current filters.</p>
                </div>
              ) : (
                /* RACER & MONTHLY CARDS */
                displayedRacers.map((racer) => {
                  const assignedPos = positions[racer.id];
                  const isP1 = assignedPos === '1';
                  const isP2 = assignedPos === '2';
                  const isP3 = assignedPos === '3';
                  const isPodium = isP1 || isP2 || isP3;
                  const isDnf = assignedPos === 'DNF';
                  const isDsq = assignedPos === 'DSQ';
                  const isAssigned = !!assignedPos;

                  const borderColor = isP1
                    ? '#ffd700'
                    : isP2
                    ? '#cbd5e1'
                    : isP3
                    ? '#d97706'
                    : isDnf || isDsq
                    ? '#ff4444'
                    : isAssigned
                    ? '#00f0ff'
                    : 'rgba(255, 255, 255, 0.08)';

                  const bgGradient = isP1
                    ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.12) 0%, rgba(20, 5, 5, 0.8) 100%)'
                    : isPodium
                    ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.06) 0%, rgba(20, 5, 5, 0.8) 100%)'
                    : isDnf || isDsq
                    ? 'linear-gradient(90deg, rgba(255, 68, 68, 0.08) 0%, rgba(20, 5, 5, 0.8) 100%)'
                    : 'rgba(255, 255, 255, 0.03)';

                  return (
                    <div
                      key={racer.id}
                      onClick={() => handleCardClick(racer.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '8px',
                        background: bgGradient,
                        border: `1px solid ${borderColor}`,
                        boxShadow: isP1
                          ? '0 0 15px rgba(255, 215, 0, 0.15)'
                          : isAssigned
                          ? '0 2px 10px rgba(0, 0, 0, 0.4)'
                          : 'none',
                        cursor: quickFinishMode ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Left: Position Indicator & Racer Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                        {/* Position Badge */}
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '900',
                            fontFamily: 'var(--font-mono)',
                            fontSize: isAssigned ? (isDnf || isDsq ? '0.75rem' : '1.1rem') : '0.7rem',
                            background: isP1
                              ? '#ffd700'
                              : isP2
                              ? '#cbd5e1'
                              : isP3
                              ? '#d97706'
                              : isDnf
                              ? 'rgba(255, 68, 68, 0.25)'
                              : isDsq
                              ? '#8a0c0c'
                              : isAssigned
                              ? 'rgba(0, 240, 255, 0.2)'
                              : 'rgba(255, 179, 0, 0.12)',
                            color: isP1 || isP2 ? '#000' : isDnf || isDsq ? '#ff4444' : isAssigned ? '#00f0ff' : '#ffb300',
                            border: `1px solid ${
                              isP1
                                ? '#ffd700'
                                : isPodium
                                ? '#fff'
                                : isDnf || isDsq
                                ? '#ff4444'
                                : isAssigned
                                ? '#00f0ff'
                                : 'dashed rgba(255, 179, 0, 0.4)'
                            }`,
                            boxShadow: isP1 ? '0 0 12px rgba(255, 215, 0, 0.4)' : 'none',
                            flexShrink: 0,
                          }}
                        >
                          {isAssigned ? (
                            isDnf || isDsq ? (
                              assignedPos
                            ) : (
                              <>
                                <span style={{ fontSize: '0.6rem', lineHeight: 1 }}>POS</span>
                                <span>{assignedPos}</span>
                              </>
                            )
                          ) : (
                            <span>NEED POS</span>
                          )}
                        </div>

                        {/* Name & Team Info */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <p
                              style={{
                                fontSize: '1.05rem',
                                fontWeight: 'bold',
                                color: '#fff',
                                margin: 0,
                              }}
                            >
                              {racer.name}
                            </p>
                            {isP1 && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  background: '#ffd700',
                                  color: '#000',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '3px',
                                  fontWeight: '900',
                                }}
                              >
                                🏆 P1 WINNER
                              </span>
                            )}
                          </div>
                          <p
                            className="text-mono"
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              margin: '0.15rem 0 0 0',
                            }}
                          >
                            {racer.team_name ? racer.team_name : racer.type} • {racer.tournament_points || 0} pts
                          </p>
                        </div>
                      </div>

                      {/* Right: Quick Action Buttons & Direct Select */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={(e) => e.stopPropagation()} // don't trigger card tap
                      >
                        {/* 1-click Podium Pills */}
                        <button
                          onClick={() => setRacerPosition(racer.id, isP1 ? '' : '1')}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            border: isP1 ? '1px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.2)',
                            background: isP1 ? '#ffd700' : 'rgba(255, 215, 0, 0.08)',
                            color: isP1 ? '#000' : '#ffd700',
                          }}
                          title="Assign 1st Place (click again to toggle off)"
                        >
                          P1 🥇
                        </button>

                        <button
                          onClick={() => setRacerPosition(racer.id, isP2 ? '' : '2')}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            border: isP2 ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.2)',
                            background: isP2 ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)',
                            color: isP2 ? '#000' : '#cbd5e1',
                          }}
                          title="Assign 2nd Place (click again to toggle off)"
                        >
                          P2 🥈
                        </button>

                        <button
                          onClick={() => setRacerPosition(racer.id, isP3 ? '' : '3')}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            border: isP3 ? '1px solid #d97706' : '1px solid rgba(217, 119, 6, 0.2)',
                            background: isP3 ? '#d97706' : 'rgba(217, 119, 6, 0.08)',
                            color: isP3 ? '#fff' : '#d97706',
                          }}
                          title="Assign 3rd Place (click again to toggle off)"
                        >
                          P3 🥉
                        </button>

                        {/* Quick DNF */}
                        <button
                          onClick={() => setRacerPosition(racer.id, isDnf ? '' : 'DNF')}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            border: isDnf ? '1px solid #ff4444' : '1px solid rgba(255, 68, 68, 0.2)',
                            background: isDnf ? 'rgba(255, 68, 68, 0.3)' : 'rgba(255, 68, 68, 0.08)',
                            color: '#ff4444',
                          }}
                          title="Toggle Did Not Finish (DNF)"
                        >
                          DNF
                        </button>

                        {/* Direct Select Dropdown */}
                        <select
                          className="input-base"
                          value={assignedPos || ''}
                          onChange={(e) => setRacerPosition(racer.id, e.target.value)}
                          style={{
                            width: '95px',
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.78rem',
                            minHeight: 'auto',
                            background: 'rgba(0, 0, 0, 0.7)',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#fff',
                          }}
                        >
                          <option value="">Pos...</option>
                          {Array.from({ length: 45 }, (_, i) => String(i + 1))
                            .concat(['DNF', 'DSQ'])
                            .filter(
                              (opt) =>
                                opt === 'DNF' ||
                                opt === 'DSQ' ||
                                opt === assignedPos ||
                                !Object.values(positions).includes(opt)
                            )
                            .map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                        </select>

                        {/* Clear button if assigned */}
                        {isAssigned && (
                          <button
                            onClick={() => setRacerPosition(racer.id, '')}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '0.35rem',
                              fontSize: '0.9rem',
                            }}
                            title="Clear position"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: LIVE TELEMETRY DOCK & CONFIRMATION CONSOLE */}
          <div
            style={{
              width: '380px',
              background: 'rgba(12, 3, 3, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              gap: '1.25rem',
              overflowY: 'auto',
            }}
          >
            {/* Box 1: Settlement Overview Header */}
            <div
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '1rem',
              }}
            >
              <h3
                className="text-mono"
                style={{
                  color: 'var(--accent-primary)',
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>📊</span> SETTLEMENT TELEMETRY
              </h3>
              <p
                className="text-mono"
                style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}
              >
                Live calculation of active bets, winners, and pool distribution.
              </p>
            </div>

            {/* Box 2: Winner Showcase */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(20, 5, 5, 0.8) 100%)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                padding: '1.1rem',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🏆</span>
              <p
                className="text-mono"
                style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}
              >
                PROJECTED P1 WINNER
              </p>
              <h4
                className="title-gradient"
                style={{
                  color: '#ffd700',
                  fontSize: '1.35rem',
                  marginTop: '0.25rem',
                  letterSpacing: '0.5px',
                }}
              >
                {activeCategory === 'TEAM'
                  ? teamStandings[0]?.name || 'COMPUTING...'
                  : preFlightTelemetry.winnerName}
              </h4>
              <p
                className="text-mono"
                style={{
                  fontSize: '0.72rem',
                  color: '#00ff88',
                  marginTop: '0.2rem',
                }}
              >
                +30 Tournament Points
              </p>
            </div>

            {/* Box 3: Bet Pool Metrics */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total Grid Bets
                </span>
                <span className="text-mono" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>
                  {preFlightTelemetry.totalBids} Approved
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Winning Predictions
                </span>
                <span className="text-mono" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#00ff88' }}>
                  {preFlightTelemetry.winningBidsCount} Bets (${preFlightTelemetry.totalWinningPool.toLocaleString()})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Losing Bets Volume
                </span>
                <span className="text-mono" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#ff4444' }}>
                  {preFlightTelemetry.losingBidsCount} Bets (${preFlightTelemetry.totalLosingPool.toLocaleString()})
                </span>
              </div>

              <div
                style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span className="text-mono" style={{ fontSize: '0.8rem', color: '#ffd700', fontWeight: 'bold' }}>
                  Projected Payout
                </span>
                <span className="text-mono" style={{ fontSize: '1.1rem', fontWeight: '900', color: '#ffd700' }}>
                  ${preFlightTelemetry.projectedPayout.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Box 4: Grid Completion Status */}
            {activeCategory !== 'TEAM' && (
              <div
                style={{
                  background:
                    stats.unassigned === 0
                      ? 'rgba(0, 255, 136, 0.1)'
                      : 'rgba(255, 179, 0, 0.1)',
                  border: `1px solid ${
                    stats.unassigned === 0
                      ? 'rgba(0, 255, 136, 0.3)'
                      : 'rgba(255, 179, 0, 0.3)'
                  }`,
                  borderRadius: '8px',
                  padding: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '1.2rem' }}>
                  {stats.unassigned === 0 ? '✅' : '⚠️'}
                </div>
                <div>
                  <p
                    className="text-mono"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 'bold',
                      color: stats.unassigned === 0 ? '#00ff88' : '#ffb300',
                      margin: 0,
                    }}
                  >
                    {stats.unassigned === 0
                      ? 'Grid 100% Complete'
                      : `${stats.unassigned} Drivers Unassigned`}
                  </p>
                  <p
                    className="text-mono"
                    style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.1rem 0 0 0' }}
                  >
                    {stats.unassigned === 0
                      ? 'Ready for sub-second database write'
                      : 'Assign or click Auto-DNF to post'}
                  </p>
                </div>
              </div>
            )}

            {/* Box 5: Progress indicator if settling */}
            {isSettling && (
              <div
                style={{
                  background: 'rgba(242, 24, 24, 0.15)',
                  border: '1px solid var(--accent-primary)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-mono" style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>
                    ⚡ SUB-SECOND ENGINE
                  </span>
                  <span className="text-mono" style={{ fontSize: '0.75rem', color: '#00ff88' }}>
                    {settleProgress.step}/{settleProgress.total}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(settleProgress.step / settleProgress.total) * 100}%`,
                      background: 'linear-gradient(90deg, #f21818, #00ff88)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
                <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {settleProgress.label}
                </p>
              </div>
            )}

            {/* BOTTOM ACTIONS */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleAnnounceFast}
                disabled={isSettling || activeTimeLeft > 0}
                style={{
                  width: '100%',
                  padding: '1.1rem',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  cursor: isSettling || activeTimeLeft > 0 ? 'not-allowed' : 'pointer',
                  border: 'none',
                  background:
                    isSettling || activeTimeLeft > 0
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #f21818 0%, #ff3333 100%)',
                  color: isSettling || activeTimeLeft > 0 ? 'var(--text-muted)' : '#fff',
                  boxShadow:
                    isSettling || activeTimeLeft > 0
                      ? 'none'
                      : '0 8px 25px rgba(242, 24, 24, 0.4)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isSettling ? (
                  <>⏳ SETTLING ROUND #{currentRoundId}...</>
                ) : activeTimeLeft > 0 ? (
                  <>⏱️ LOCKED (WINDOW STILL ACTIVE)</>
                ) : (
                  <>🚀 CONFIRM & POST RESULTS</>
                )}
              </button>

              <button
                onClick={onClose}
                disabled={isSettling}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                }}
              >
                CANCEL & CLOSE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
