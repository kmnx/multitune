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

type Service = {
  name: string;
  icon: string;
  linked: boolean;
};

const defaultServices: Service[] = [
  { name: 'YouTube', icon: '📺', linked: false },
  { name: 'Spotify', icon: '🎵', linked: false },
];

const HomePage = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>(defaultServices);
  const [ytPlaylists, setYtPlaylists] = useState<any[] | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytSidebarOpen, setYtSidebarOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [playlistItems, setPlaylistItems] = useState<any[] | null>(null);
  const [playlistItemsLoading, setPlaylistItemsLoading] = useState(false);
  const [playlistItemsError, setPlaylistItemsError] = useState<string | null>(null);
  // Fetch items for a playlist by DB id
  const fetchPlaylistItems = async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setPlaylistItems(null);
    setPlaylistItemsLoading(true);
    setPlaylistItemsError(null);
    try {
  const res = await fetch(`http://localhost:4000/auth/api/db/playlist/${playlist.id}/items`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.error) {
        setPlaylistItemsError(data.error);
        setPlaylistItems(null);
      } else {
        setPlaylistItems(data.items);
      }
    } catch {
      setPlaylistItemsError('Failed to fetch playlist items');
      setPlaylistItems(null);
    } finally {
      setPlaylistItemsLoading(false);
    }
  };

  // Handler for clicking a service in the sidebar

  // Check if YouTube is linked for the current user
  const checkYouTubeLinked = async (): Promise<boolean> => {
    try {
      const res = await fetch('http://localhost:4000/auth/api/youtube/linked', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      return !!data.linked;
    } catch {
      return false;
    }
  };

  // Fetch YouTube playlists and update state
  const fetchYouTubePlaylists = async () => {
    setYtLoading(true);
    setYtError(null);
    try {
      const res = await fetch('http://localhost:4000/auth/api/youtube/playlists', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.error) {
        setYtError(data.error);
        setYtPlaylists(null);
      } else {
        setYtPlaylists(data.playlists);
      }
    } catch {
      setYtError('Failed to fetch playlists');
      setYtPlaylists(null);
    } finally {
      setYtLoading(false);
    }
  };

  // Handler for clicking a service in the sidebar
  const handleServiceClick = async (service: Service) => {
    if (service.name === 'YouTube') {
      // Check if already linked
      const linked = await checkYouTubeLinked();
      setServices(svcs => svcs.map(s => s.name === 'YouTube' ? { ...s, linked } : s));
      if (!linked) {
        // Start YouTube OAuth flow
        window.location.href = 'http://localhost:4000/auth/youtube';
        return;
      }
      // If already linked, open sidebar and fetch playlists
      setYtSidebarOpen(open => !open);
      setSelectedService(service.name);
      if (!ytSidebarOpen) {
        await fetchYouTubePlaylists();
      }
      return;
    }
    setSelectedService(service.name);
  };

  // After YouTube OAuth, check if we are now linked and fetch playlists
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('youtube_linked') === '1') {
      // Remove param from URL
      url.searchParams.delete('youtube_linked');
      window.history.replaceState({}, document.title, url.pathname);
      setServices(svcs => svcs.map(s => s.name === 'YouTube' ? { ...s, linked: true } : s));
      setYtSidebarOpen(true);
      setSelectedService('YouTube');
      fetchYouTubePlaylists();
    }
  }, []);

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
            <div key={service.name}>
              <div
                onClick={() => handleServiceClick(service)}
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
              {/* Fold out YouTube playlists under the sidebar item */}
              {service.name === 'YouTube' && service.linked && ytSidebarOpen && (
                <div style={{ background: '#2e3350', padding: '8px 0 8px 32px', borderRadius: 4, margin: '2px 8px 8px 8px' }}>
                  {ytLoading && <div style={{ color: '#fff' }}>Loading playlists...</div>}
                  {ytError && <div style={{ color: 'red' }}>{ytError}</div>}
                  {ytPlaylists && ytPlaylists.length > 0 ? (
                    <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                      {ytPlaylists.map((pl: any) => (
                        <li key={pl.id} style={{ marginBottom: 8 }}>
                          <button
                            onClick={() => fetchPlaylistItems(pl)}
                            style={{
                              background: selectedPlaylist && selectedPlaylist.id === pl.id ? '#eebf63' : 'transparent',
                              color: selectedPlaylist && selectedPlaylist.id === pl.id ? '#232946' : '#eebf63',
                              border: 'none',
                              fontWeight: 500,
                              fontSize: 16,
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: 4,
                              width: '100%',
                              textAlign: 'left',
                              transition: 'background 0.2s',
                            }}
                          >
                            {pl.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : ytPlaylists && ytPlaylists.length === 0 && !ytLoading ? (
                    <em style={{ color: '#fff' }}>No playlists found.</em>
                  ) : null}
                </div>
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
        {selectedService && selectedService !== 'YouTube' && (
          <div>
            <h2 style={{ color: '#232946', fontWeight: 700 }}>{selectedService} Playlists</h2>
            <div style={{ marginTop: 16, color: '#393e6e' }}>
              <em>Playlists and tracks from {selectedService} will appear here.</em>
            </div>
          </div>
        )}
        {selectedService === 'YouTube' && selectedPlaylist && (
          <div>
            <h2 style={{ color: '#232946', fontWeight: 700, marginBottom: 16 }}>{selectedPlaylist.title}</h2>
            {playlistItemsLoading && <div>Loading items...</div>}
            {playlistItemsError && <div style={{ color: 'red' }}>{playlistItemsError}</div>}
            {playlistItems && (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <thead>
                  <tr style={{ background: '#f7f7fa', color: '#232946', fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Upload Date</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Channel</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Placeholder</th>
                  </tr>
                </thead>
                <tbody>
                  {playlistItems.map((item: any) => (
                    <tr key={item.yt_video_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 12px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={`https://www.youtube.com/watch?v=${item.yt_video_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#232946', textDecoration: 'underline' }}>{item.title}</a>
                      </td>
                      <td style={{ padding: '6px 12px' }}>{item.published_at ? new Date(item.published_at).toLocaleDateString() : ''}</td>
                      <td style={{ padding: '6px 12px' }}>{item.channel_title || ''}</td>
                      <td style={{ padding: '6px 12px', color: '#aaa' }}>-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {playlistItems && playlistItems.length === 0 && !playlistItemsLoading && (
              <div style={{ color: '#393e6e', marginTop: 16 }}><em>No items found in this playlist.</em></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
