import { useEffect, useState } from 'react';
import { api } from './api.js';
import AuthScreen from './components/AuthScreen.jsx';
import ChatApp from './components/ChatApp.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api('/api/me')
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="loading-screen">Loading DisKids...</div>;
  if (!user) return <AuthScreen onAuth={setUser} />;
  return <ChatApp user={user} onLogout={() => setUser(null)} />;
}