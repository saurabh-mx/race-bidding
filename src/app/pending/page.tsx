'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Bid = {
  id: string;
  racer_id: string;
  bidder_name: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  racer_name?: string;
};

export default function PendingBets() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string>('');
  const [pendingBids, setPendingBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, login_id')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setRole(profile.role);
        setLoginId(profile.login_id);
      }

      if (profile?.role !== 'admin' && profile?.role !== 'management') {
        router.replace('/dashboard');
        return;
      }

      await fetchPendingBids();
    };

    init();
  }, [router]);

  const fetchPendingBids = async () => {
    setIsLoading(true);
    const { data: bids } = await supabase
      .from('bids')
      .select('*, racers(name)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (bids) {
      setPendingBids(bids.map((b: any) => ({
        ...b,
        racer_name: b.racers?.name || 'UNKNOWN'
      })));
    }
    setIsLoading(false);
  };

  const handleApprove = async (bid: Bid) => {
    const { error: updateError } = await supabase
      .from('bids')
      .update({ status: 'APPROVED' })
      .eq('id', bid.id);

    if (!updateError) {
      // Fetch current racer bid
      const { data: racerData } = await supabase.from('racers').select('current_bid').eq('id', bid.racer_id).single();
      
      if (racerData) {
        await supabase.from('racers')
          .update({ current_bid: racerData.current_bid + bid.amount })
          .eq('id', bid.racer_id);
          
        await supabase.from('audit_logs').insert([{
          action: 'APPROVE_BID',
          details: `Approved pending bet of $${bid.amount} from ${bid.bidder_name} on ${bid.racer_name}`
        }]);
      }
      
      setPendingBids(prev => prev.filter(b => b.id !== bid.id));
    } else {
      alert('Failed to approve bid: ' + updateError.message);
    }
  };

  const handleReject = async (bid: Bid) => {
    const { error } = await supabase
      .from('bids')
      .update({ status: 'REJECTED' })
      .eq('id', bid.id);

    if (!error) {
      await supabase.from('audit_logs').insert([{
        action: 'REJECT_BID',
        details: `Rejected pending bet of $${bid.amount} from ${bid.bidder_name} on ${bid.racer_name}`
      }]);
      setPendingBids(prev => prev.filter(b => b.id !== bid.id));
    } else {
      alert('Failed to reject bid: ' + error.message);
    }
  };

  if (isLoading || (role !== 'admin' && role !== 'management')) return null;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
            <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBET. <span style={{ color: '#fff', fontSize: '1rem' }}>// PENDING</span></h1>
          </div>
        </Link>
        <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
          <Link href="/teams" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>TEAMS</Link>
          <Link href="/drivers" className="text-mono" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>DRIVERS</Link>
          <Link href="#" className="text-mono" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '1px' }}>RULES</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="text-mono" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{loginId.toUpperCase()}</span>
            <span style={{ fontSize: '0.65rem', color: role === 'admin' ? '#ff2a2a' : role === 'management' ? 'var(--accent-secondary)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              OP: {role || 'UNKNOWN'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => router.push('/profile')} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderColor: 'var(--accent-primary)', color: '#fff' }}>
              PROFILE
            </button>
            <button className="btn-secondary" onClick={async () => { await supabase.auth.signOut(); router.replace('/login'); }} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
              DISCONNECT
            </button>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '2rem' }}>AWAITING APPROVAL</h2>
        
        {pendingBids.length === 0 ? (
          <p className="text-mono" style={{ color: 'var(--text-muted)' }}>NO PENDING BETS AT THIS TIME.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {pendingBids.map(bid => (
              <div key={bid.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}>
                <div>
                  <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{new Date(bid.created_at).toLocaleString()}</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{bid.bidder_name}</span> bet <span style={{ color: '#fff' }}>${bid.amount.toLocaleString()}</span> on <span style={{ color: 'var(--accent-primary)' }}>{bid.racer_name}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => handleReject(bid)} className="text-mono" style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
                    REJECT
                  </button>
                  <button onClick={() => handleApprove(bid)} className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                    APPROVE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
