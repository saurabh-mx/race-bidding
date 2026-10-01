'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Role = 'VIEWER' | 'MANAGEMENT';

type Racer = {
  id: string;
  name: string;
  type: 'TEAM' | 'INDIVIDUAL' | 'WEEKLY';
  current_bid: number;
  status: 'ACTIVE' | 'CLOSED';
};

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [data, setData] = useState<Racer[]>([]);
  const [biddingId, setBiddingId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/login');
        return;
      }
      
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
        
      if (profile) setRole(profile.role);

      const { data: racers } = await supabase
        .from('racers')
        .select('*')
        .order('current_bid', { ascending: false });
        
      if (racers) setData(racers);
      setIsLoading(false);
    };

    init();

    const channel = supabase.channel('realtime_racers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'racers' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setData(prev => prev.map(item => item.id === payload.new.id ? payload.new as Racer : item).sort((a,b) => b.current_bid - a.current_bid));
        } else if (payload.eventType === 'INSERT') {
          setData(prev => [payload.new as Racer, ...prev].sort((a,b) => b.current_bid - a.current_bid));
        } else if (payload.eventType === 'DELETE') {
          setData(prev => prev.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const handleBid = async (racerId: string) => {
    if (!bidAmount || isNaN(Number(bidAmount)) || !userId) return;
    const amount = Number(bidAmount);
    
    const racer = data.find(r => r.id === racerId);
    if (!racer || amount <= racer.current_bid) {
      alert("Bid must be strictly higher than the current bid!");
      return;
    }

    const { error: bidError } = await supabase.from('bids').insert([
      { racer_id: racerId, user_id: userId, amount }
    ]);

    if (!bidError) {
      await supabase.from('racers')
        .update({ current_bid: amount })
        .eq('id', racerId);
    } else {
      console.error(bidError);
      alert("Transaction failed.");
    }
    
    setBiddingId(null);
    setBidAmount('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const renderCard = (racer: Racer, index: number) => (
    <div key={racer.id} className={`glass-panel bid-card animate-in stagger-${(index % 3) + 1}`} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
            ID: {racer.id.split('-')[0].toUpperCase()}
          </span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', marginTop: '0.25rem' }}>
            {racer.name}
          </h3>
        </div>
        
        <span className="text-mono" style={{ 
          background: racer.type === 'TEAM' ? 'rgba(255,255,255,0.1)' : racer.type === 'INDIVIDUAL' ? 'rgba(242, 24, 24, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          color: racer.type === 'INDIVIDUAL' ? 'var(--accent-secondary)' : '#fff',
          border: `1px solid ${racer.type === 'INDIVIDUAL' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'}`,
          padding: '0.25rem 0.5rem', 
          fontSize: '0.65rem', 
          fontWeight: 700 
        }}>
          {racer.type}
        </span>
      </div>
      
      <div style={{ margin: '1.5rem 0' }}>
        <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', letterSpacing: '2px' }}>
          CURRENT_BID
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '1.5rem' }}>$</span>
          <p className="bid-amount">{racer.current_bid.toLocaleString()}</p>
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {biddingId === racer.id ? (
          <div style={{ display: 'flex', width: '100%', gap: '0.5rem' }} className="animate-in">
            <input 
              type="number" 
              className="input-base" 
              placeholder="Amount..." 
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
            <button className="btn-primary" onClick={() => handleBid(racer.id)} style={{ padding: '0.85rem 1rem' }}>CONFIRM</button>
            <button className="btn-secondary" onClick={() => setBiddingId(null)} style={{ padding: '0.85rem 1rem' }}>X</button>
          </div>
        ) : (
          <button className="btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }} onClick={() => setBiddingId(racer.id)}>
            <span>PLACE BID</span>
            <span className="text-mono">&gt;</span>
          </button>
        )}
        
        {role === 'MANAGEMENT' && (
          <button className="btn-secondary" style={{ flex: '0 0 auto', padding: '0.85rem 1rem' }} onClick={() => alert("OVERSIGHT Edit Mode Triggered")}>
            EDIT
          </button>
        )}
      </div>
    </div>
  );

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
        ESTABLISHING SECURE CONNECTION...
      </p>
    </div>
  );

  return (
    <main style={{ paddingBottom: '4rem' }}>
      <header className="glass-header">
        <Link href="/" style={{ textDecoration: 'none' }}>
           <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBID.</h1>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="text-mono" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>OPERATOR STATUS</span>
            <span style={{ fontSize: '0.85rem', color: role === 'MANAGEMENT' ? 'var(--accent-secondary)' : '#fff', fontWeight: 700 }}>
              {role === 'MANAGEMENT' ? 'CLASS O (OVERSIGHT)' : 'CLASS I (SPECTATOR)'}
            </span>
          </div>
          <button className="btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
            DISCONNECT
          </button>
        </div>
      </header>

      <div className="container" style={{ marginTop: '2rem' }}>
        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '3rem', textTransform: 'uppercase' }}>Live Terminal</h2>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.5rem', letterSpacing: '2px', display: 'flex', alignItems: 'center' }}>
              <span className="pulse-indicator"></span> 
              GLOBAL BID NETWORK SYNCED
            </p>
          </div>
          
          {role === 'MANAGEMENT' && (
            <button className="btn-primary" style={{ background: '#fff', color: '#000', boxShadow: '0 0 15px rgba(255,255,255,0.3)' }}>
              + INITIALIZE NEW ENTITY
            </button>
          )}
        </div>

        <div className="grid-3">
          {data.length === 0 ? (
             <div className="glass-panel text-mono animate-in" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                NO ACTIVE BIDS DETECTED IN THE DATABASE.<br/><br/>
                AWAITING OVERSIGHT TO INITIALIZE RACE ENTITIES.
             </div>
          ) : (
            data.map((racer, idx) => renderCard(racer, idx))
          )}
        </div>
      </div>
    </main>
  );
}
