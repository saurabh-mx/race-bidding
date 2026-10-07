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
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
