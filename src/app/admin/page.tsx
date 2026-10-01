'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Role = 'viewer' | 'management' | 'admin';

type Profile = {
  id: string;
  login_id: string;
  role: Role;
};

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
        .select('role')
        .eq('id', session.user.id)
        .single();
        
      if (!profile || profile.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }
      
      setRole(profile.role);

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('login_id', { ascending: true });
        
      if (allProfiles) setProfiles(allProfiles);
      setIsLoading(false);
    };

    init();
  }, [router]);

  const handleRoleChange = async (profileId: string, newRole: Role) => {
    // Update local state optimistically
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
    
    // Update Supabase
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId);

    if (error) {
      console.error(error);
      alert('Failed to update role: ' + error.message);
      // Revert if error
      const { data: oldProfiles } = await supabase.from('profiles').select('*').order('login_id');
      if (oldProfiles) setProfiles(oldProfiles);
    }
  };

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-mono animate-in" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>
        VERIFYING CLEARANCE LEVEL...
      </p>
    </div>
  );

  return (
    <main style={{ paddingBottom: '4rem', minHeight: '100vh' }}>
      <header className="glass-header">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
           <h1 className="title-gradient" style={{ fontSize: '1.5rem', color: '#f21818' }}>RACEBID. &lt; DASHBOARD</h1>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="text-mono" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>OPERATOR STATUS</span>
            <span style={{ fontSize: '0.85rem', color: '#ff2a2a', fontWeight: 900 }}>
              CLASS A (ADMIN)
            </span>
          </div>
        </div>
      </header>

      <div className="container" style={{ marginTop: '2rem' }}>
        <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 className="title-gradient" style={{ fontSize: '3rem', textTransform: 'uppercase' }}>Admin Oversight</h2>
            <p className="text-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.5rem', letterSpacing: '2px', display: 'flex', alignItems: 'center' }}>
              <span className="pulse-indicator"></span> 
              GLOBAL ACCESS CONTROL
            </p>
          </div>
        </div>

        <div className="glass-panel animate-in" style={{ padding: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>PILOT_ID</th>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>USER_ID</th>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>CURRENT_ROLE</th>
                <th className="text-mono" style={{ padding: '1rem', color: 'var(--text-muted)' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{profile.login_id}</td>
                  <td className="text-mono" style={{ padding: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{profile.id}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className="text-mono" style={{ 
                      background: profile.role === 'admin' ? 'rgba(255, 42, 42, 0.2)' : profile.role === 'management' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      color: profile.role === 'admin' ? '#ff2a2a' : profile.role === 'management' ? 'var(--accent-secondary)' : '#fff',
                      border: `1px solid ${profile.role === 'admin' ? '#ff2a2a' : profile.role === 'management' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
                      padding: '0.25rem 0.5rem', 
                      fontSize: '0.75rem', 
                      fontWeight: 700 
                    }}>
                      {profile.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <select 
                      className="input-base text-mono" 
                      value={profile.role}
                      onChange={(e) => handleRoleChange(profile.id, e.target.value as Role)}
                      style={{ padding: '0.5rem', width: 'auto' }}
                    >
                      <option value="viewer">VIEWER</option>
                      <option value="management">MANAGEMENT</option>
                      <option value="admin">ADMIN</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
