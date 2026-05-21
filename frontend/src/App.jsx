import React, { useState, useEffect } from 'react';
import EventLanding from './components/EventLanding';
import AdminDashboard from './components/AdminDashboard';
import { Camera, ShieldAlert, Sparkles, Key, HelpCircle } from 'lucide-react';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [searchParams, setSearchParams] = useState(new URLSearchParams(window.location.search));

  // Sync state with browser location
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handleLocationChange);
    
    // Custom trigger for navigating inside React
    window.addEventListener('navigate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('navigate', handleLocationChange);
    };
  }, []);

  // Helper to handle client-side routing
  const navigate = (to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new Event('navigate'));
  };

  const tagCode = searchParams.get('t');

  // Route: /e/:slug
  if (currentPath.startsWith('/e/')) {
    const slug = currentPath.split('/e/')[1];
    return <EventLanding slug={slug} tagCode={tagCode} navigate={navigate} />;
  }

  // Route: /admin
  if (currentPath === '/admin') {
    return <AdminDashboard navigate={navigate} />;
  }

  // Root Landing Route: /
  return (
    <div className="flex-1 flex flex-col justify-between p-6 md:p-12 max-w-4xl mx-auto w-full text-center relative overflow-hidden">
      {/* Decorative ambient glowing circles */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2 font-bold text-xl tracking-wider select-none">
          <span className="text-amber-500 text-2xl font-black">🎞️</span>
          <span className="bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">MAIN CHARACTER</span>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="glass hover:bg-white/5 text-zinc-300 px-4 py-2 rounded-full text-xs font-semibold tracking-wider transition-all flex items-center gap-2 border border-white/5 active:scale-95"
        >
          <Key className="w-3.5 h-3.5 text-amber-500" />
          ADMIN COCKPIT
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center py-12 md:py-20 max-w-xl mx-auto">
        <div className="animate-float mb-8 relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 to-violet-600 flex items-center justify-center shadow-2xl relative z-10">
            <Camera className="w-10 h-10 text-white stroke-[1.5]" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-violet-600 rounded-3xl blur-xl opacity-40 scale-110" />
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          The Key to Collective Memories.
        </h1>

        <p className="text-zinc-400 text-base md:text-lg mb-10 leading-relaxed font-light">
          A physical NFC <span className="text-amber-400/90 font-medium">taonga</span> (keepsake) is your gatepass. Tap the keyring to instantly join private albums, upload cinematic snapshots, and experience real-time memories together.
        </p>

        {/* Instructive Widget */}
        <div className="glass-premium p-6 rounded-2xl w-full text-left relative overflow-hidden border border-white/10 group hover:border-amber-500/20 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
          <h3 className="text-sm font-semibold tracking-wider text-amber-500 uppercase mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            HOW IT WORKS
          </h3>
          <ol className="space-y-3.5 text-sm text-zinc-300 font-light">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 text-amber-400 text-xs font-bold flex items-center justify-center">1</span>
              <span>Tap a physical **NFC memory keyring** or scan the fallback QR code with your phone.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 text-amber-400 text-xs font-bold flex items-center justify-center">2</span>
              <span>Instantly open the premium event album – no account or app store download required.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 text-amber-400 text-xs font-bold flex items-center justify-center">3</span>
              <span>Take photos, add names, and save. Watch your images blend instantly into a styled, cohesive aesthetic.</span>
            </li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 gap-4 mt-8">
        <div>
          © {new Date().getFullYear()} Main Character. Handcrafted memory preservation.
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:text-zinc-400 cursor-help flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            NFC Taonga
          </span>
          <span className="text-zinc-700">|</span>
          <span className="hover:text-zinc-400 cursor-pointer" onClick={() => navigate('/admin')}>
            Admin Entry
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
