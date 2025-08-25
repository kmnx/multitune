import React, { useEffect, useState } from 'react';

const getToken = () => localStorage.getItem('token');

const AuthModal = ({ onAuth }: { onAuth: () => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  // Handle Google OAuth token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, document.title, window.location.pathname); // Clean up URL
      onAuth();
    }
  }, [onAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
    const body: any = { username, password };
    if (mode === 'signup') body.email = email;
    try {
      const res = await fetch(`http://localhost:4000${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        onAuth();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320 }}>
        <h2>{mode === 'login' ? 'Login' : 'Sign Up'}</h2>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', marginBottom: 8 }} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', marginBottom: 8 }} />
        {mode === 'signup' && (
          <input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        )}
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        <button type="submit" style={{ width: '100%', marginBottom: 8 }}>{mode === 'login' ? 'Login' : 'Sign Up'}</button>
        <button type="button" onClick={handleGoogleSignIn} style={{ width: '100%', marginBottom: 8, background: '#4285F4', color: '#fff', border: 'none', borderRadius: 4, padding: 8, fontWeight: 500 }}>
          Sign in with Google
        </button>
        <div style={{ textAlign: 'center' }}>
          {mode === 'login' ? (
            <span>Don't have an account? <a href="#" onClick={e => { e.preventDefault(); setMode('signup'); }}>Sign up</a></span>
          ) : (
            <span>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setMode('login'); }}>Login</a></span>
          )}
        </div>
      </form>
    </div>
  );
};

const defaultServices = [
  { name: 'YouTube', icon: '📺', linked: false },
  { name: 'Spotify', icon: '🎵', linked: false },
];

const HomePage = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [services, setServices] = useState(defaultServices);

  useEffect(() => {
    // Simple check: token exists
    if (getToken()) setAuthenticated(true);
  }, []);

  if (!authenticated) {
    return <AuthModal onAuth={() => setAuthenticated(true)} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f7f7fa' }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: '#232946', color: '#fff', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 22, padding: '24px 24px 16px 24px', letterSpacing: 1, borderBottom: '1px solid #2e3350' }}>
          Multitune
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {services.map(service => (
            <div
              key={service.name}
              onClick={() => setSelectedService(service.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 24px',
                background: selectedService === service.name ? '#393e6e' : 'none',
                cursor: 'pointer',
                borderLeft: selectedService === service.name ? '4px solid #eebf63' : '4px solid transparent',
                fontWeight: selectedService === service.name ? 600 : 400,
                fontSize: 17,
                marginBottom: 2,
                borderRadius: 4,
                transition: 'background 0.2s',
              }}
            >
              <span style={{ fontSize: 22, marginRight: 12 }}>{service.icon}</span>
              {service.name}
              {!service.linked && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#eebf63', fontWeight: 500 }}>Link</span>
              )}
            </div>
          ))}
          <div style={{ padding: '10px 24px', marginTop: 16 }}>
            <button style={{ width: '100%', background: '#eebf63', color: '#232946', border: 'none', borderRadius: 4, padding: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              + Add more services
            </button>
          </div>
        </div>
      </div>
      {/* Main content */}
      <div style={{ flex: 1, padding: 40 }}>
        {!selectedService && (
          <div style={{ color: '#232946', fontSize: 28, fontWeight: 600, marginTop: 40 }}>
            Welcome to Multitune
            <div style={{ fontSize: 18, fontWeight: 400, marginTop: 12 }}>
              Select a service on the left to view your playlists and tracks.
            </div>
          </div>
        )}
        {selectedService && (
          <div>
            <h2 style={{ color: '#232946', fontWeight: 700 }}>{selectedService} Playlists</h2>
            <div style={{ marginTop: 16, color: '#393e6e' }}>
              {/* Placeholder for playlists/tracks */}
              <em>Playlists and tracks from {selectedService} will appear here.</em>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
