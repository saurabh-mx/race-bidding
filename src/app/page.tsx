'use client';
import Link from 'next/link';
import './landing.css'; // Let's create a specific CSS for this

export default function LandingPage() {
  return (
    <main className="soulgrid-main">
      <nav className="soulgrid-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="Race Betting" style={{ height: '50px', width: 'auto', borderRadius: '50%' }} />
          <div className="logo-container">
            <span className="logo-text">RACE<span className="logo-highlight">BET</span></span>
            <span className="logo-subtext">BET FOR THE GRID</span>
          </div>
        </div>
        <div className="nav-links">
          <Link href="/teams">TEAMS</Link>
          <Link href="/drivers">RACERS</Link>
          <Link href="/rules">RULES</Link>
          <Link href="/login">LIVE BET</Link>
        </div>
      </nav>

      <div className="soulgrid-content">
        <div className="live-badge">
          <span className="pulse-dot"></span> {`/// BETS LIVE`}
        </div>
        
        <div className="hero-text-container">
          <h1 className="hero-title">WELCOME TO</h1>
          <h1 className="hero-title-red">RACEBET</h1>
          
          <p className="hero-subtitle">
            THE ULTIMATE COMPETITIVE RACING TOURNAMENT IS OFFICIALLY UNDERWAY.<br/>
            15 FRANCHISES. 90 SEATS. ONE EPIC GRID.
          </p>
        </div>

        <div className="action-buttons">
          <Link href="/login" className="btn-soulgrid-primary">
            ENTER LIVE BET &gt;&gt;
          </Link>
          <Link href="/rules" className="btn-soulgrid-secondary">
            RULES
          </Link>
        </div>
      </div>
      
      {/* Abstract Car Silhouette - using CSS/SVG for the effect shown in the image */}
      <div className="car-silhouette"></div>
    </main>
  );
}
