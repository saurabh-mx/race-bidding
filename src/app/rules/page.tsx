'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RulesPage() {
  const router = useRouter();
  
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d0404',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(242, 24, 24, 0.05) 0%, transparent 60%), linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
      color: '#fff',
      fontFamily: 'var(--font-mono)'
    }}>
      {/* Navigation */}
      <nav style={{ padding: '2rem 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(242,24,24,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => router.push('/')}>
          <img src="/logo.png" alt="Race Betting" style={{ height: '40px', width: 'auto', borderRadius: '50%' }} />
          <div>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-1px' }}>RACE<span style={{ color: '#f21818' }}>BET</span></span>
          </div>
        </div>
        <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 'bold' }}>
          &lt; BACK TO HOME
        </Link>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
        
        {/* POINTS SYSTEM SECTION */}
        <div style={{ marginBottom: '4rem' }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            borderLeft: '4px solid #00aaff', 
            paddingLeft: '1rem',
            marginBottom: '2rem',
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            8. POINTS SYSTEM
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
            
            {/* FINISHING POSITION POINTS TABLE */}
            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', letterSpacing: '1px' }}>
                FINISHING POSITION POINTS
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <tbody>
                  {[
                    [{ pos: '1st', pts: '30 pts', color: '#ffcc00' }, { pos: '2nd', pts: '27 pts' }, { pos: '3rd', pts: '25 pts', color: '#ff6600' }, { pos: '4th', pts: '23 pts' }],
                    [{ pos: '5th', pts: '21 pts' }, { pos: '6th', pts: '20 pts' }, { pos: '7th', pts: '19 pts' }, { pos: '8th', pts: '18 pts' }],
                    [{ pos: '9th', pts: '17 pts' }, { pos: '10th', pts: '16 pts' }, { pos: '11th', pts: '15 pts' }, { pos: '12th', pts: '14 pts' }],
                    [{ pos: '13th', pts: '13 pts' }, { pos: '14th', pts: '12 pts' }, { pos: '15th', pts: '11 pts' }, { pos: '16th', pts: '10 pts' }],
                    [{ pos: '17th', pts: '9 pts' }, { pos: '18th', pts: '8 pts' }, { pos: '19th', pts: '7 pts' }, { pos: '20th', pts: '6 pts' }],
                    [{ pos: '21st', pts: '5 pts' }, { pos: '22nd', pts: '4 pts' }, { pos: '23rd', pts: '3 pts' }, { pos: '24th', pts: '2 pts' }],
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {row.map((col, j) => (
                        <td key={j} style={{ padding: '1.25rem 1rem', borderRight: j < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '40px' }}>{col.pos}</span>
                          <span style={{ color: col.color || '#fff', fontWeight: 'bold' }}>{col.pts}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>25th to 42nd</span> <span style={{ color: '#fff', fontWeight: 'bold', marginLeft: '10px' }}>1 pt</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* PENALTIES BOX */}
            <div style={{ border: '1px solid rgba(242,24,24,0.2)', borderRadius: '4px', background: 'rgba(20,5,5,0.7)', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(242,24,24,0.2)', color: '#ff3333', fontWeight: 'bold', letterSpacing: '1px' }}>
                PENALTIES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(242,24,24,0.1)' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>No Show</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>Automatically classified as DNF.</div>
                </div>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(242,24,24,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>DNF</div>
                  <div style={{ color: '#ff3333', fontWeight: 'bold' }}>-2 pts</div>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>DSQ</div>
                    <div style={{ color: '#ff3333', fontWeight: 'bold' }}>-10 pts</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    Applied for fuel leaks or use of banned mechanics/exploits.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* BETTING RULES SECTION */}
        <div style={{ marginBottom: '4rem' }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            borderLeft: '4px solid #f21818', 
            paddingLeft: '1rem',
            marginBottom: '2rem',
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            9. BETTING & PAYMENTS
          </h2>
          
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(0,0,0,0.5)', overflow: 'hidden' }}>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: '#f21818', fontWeight: 'bold' }}>01</div>
                  <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                    If you place a bet and the bet is placed / registered, there is <span style={{ color: '#f21818', fontWeight: 'bold' }}>NO REFUND</span> and you cannot cancel your bet.
                  </div>
                </div>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: '#f21818', fontWeight: 'bold' }}>02</div>
                  <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                    Once payment is done, you absolutely cannot cancel the bet.
                  </div>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ color: '#f21818', fontWeight: 'bold' }}>03</div>
                  <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                    You have to check the minimum bet required on every race; it is necessary before placing your wager.
                  </div>
                </div>
                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '1.1rem' }}>04</div>
                  <div style={{ fontSize: '1rem', lineHeight: '1.5', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold', color: '#00e5ff', letterSpacing: '0.5px' }}>RACER (INDIVIDUAL) ODDS & MULTIPLIERS</div>
                      <span className="text-mono" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)', borderRadius: '4px', color: '#00e5ff' }}>FIXED ODDS</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                      Individual racer bets use fixed multiplier payouts based on the predicted finishing position. <span style={{ color: '#fff', fontWeight: 600 }}>Payout = Bet Amount × Multiplier</span>.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>POS 1</span>
                        <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '1.15rem' }}>1.5x</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>POS 2–3</span>
                        <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '1.15rem' }}>1.4x</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>POS 4–6</span>
                        <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '1.15rem' }}>1.3x</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>POS 7–10</span>
                        <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '1.15rem' }}>1.2x</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>POS 11–15</span>
                        <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '1.15rem' }}>1.1x</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '1.1rem' }}>05</div>
                  <div style={{ fontSize: '1rem', lineHeight: '1.5', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold', color: '#00ff88', letterSpacing: '0.5px' }}>TEAM BETTING RULES & PRIZE POOL SHARE</div>
                      <span className="text-mono" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '4px', color: '#00ff88' }}>PARI-MUTUEL POOL</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      Team betting operates on a shared pari-mutuel prize pool rather than fixed multipliers. Payouts scale dynamically based on the total betting volume and winning ratio.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ background: 'rgba(0, 255, 136, 0.04)', padding: '0.85rem 1rem', borderRadius: '4px', border: '1px solid rgba(0, 255, 136, 0.15)' }}>
                        <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.25rem' }}>100% STAKE RETURN</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Winning bettors automatically receive their full wager amount returned.</div>
                      </div>
                      <div style={{ background: 'rgba(255, 179, 0, 0.04)', padding: '0.85rem 1rem', borderRadius: '4px', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
                        <div style={{ color: '#ffb300', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.25rem' }}>50% LOSING POOL SPLIT</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Winners split half of the total losing bets pool proportionally to their stake.</div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>PAYOUT CALCULATION FORMULA:</span>
                      <code className="text-mono" style={{ color: '#fff', fontSize: '0.85rem', display: 'block', wordBreak: 'break-word' }}>
                        Payout = Your Bet + ((Your Bet ÷ Total Winning Pool) × (Total Losing Pool ÷ 2))
                      </code>
                    </div>

                    <div>
                      <span className="text-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '0.4rem' }}>PREDICTION POSITION BRACKETS:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {['1–3', '4–6', '7–9', '10–13', '13–15'].map(bracket => (
                          <span key={bracket} className="text-mono" style={{ 
                            background: 'rgba(255,255,255,0.03)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            padding: '0.35rem 0.75rem', 
                            borderRadius: '4px', 
                            fontSize: '0.8rem', 
                            color: '#fff',
                            fontWeight: 'bold'
                          }}>
                            {bracket}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
