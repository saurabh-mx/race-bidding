'use client';
import Link from 'next/link';
import './landing.css'; // Let's create a specific CSS for this

export default function LandingPage() {
  return (
    <main className="soulgrid-main">
      <nav className="soulgrid-nav">
        <div className="logo-container">
          <span className="logo-text">RACE<span className="logo-highlight">BID</span></span>
          <span className="logo-subtext">BID FOR THE GRID</span>
        </div>
        <div className="nav-links">
          <Link href="#">TEAMS</Link>
          <Link href="#">DRIVERS</Link>
          <Link href="#">RULES</Link>
          <Link href="#">LIVE BID</Link>
        </div>
      </nav>

      <div className="soulgrid-content">
        <div className="live-badge">
          <span className="pulse-dot"></span> /// BIDS LIVE
        </div>
        
        <div className="hero-text-container">
          <h1 className="hero-title">WELCOME TO</h1>
          <h1 className="hero-title-red">RACEBID</h1>
          
          <p className="hero-subtitle">
            THE ULTIMATE COMPETITIVE RACING TOURNAMENT IS OFFICIALLY UNDERWAY.<br/>
            15 FRANCHISES. 90 SEATS. ONE EPIC GRID.
          </p>
        </div>

        <div className="action-buttons">
          <Link href="/login" className="btn-soulgrid-primary">
            ENTER LIVE BID &gt;&gt;
          </Link>
          <Link href="#" className="btn-soulgrid-secondary">
            RULES
          </Link>
        </div>
      </div>
      
      {/* Abstract Car Silhouette - using CSS/SVG for the effect shown in the image */}
      <div className="car-silhouette"></div>
    </main>
  );
}
