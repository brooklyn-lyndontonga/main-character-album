import React, { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Sparkles, RefreshCw, Key, ChevronRight, Lock, Eye, AlertCircle } from 'lucide-react';
import Gallery from './Gallery';
import UploadDrawer from './UploadDrawer';
import FullscreenViewer from './FullscreenViewer';

function EventLanding({ slug, tagCode, navigate }) {
  const [event, setEvent] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Passcode challenge state
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [passcodeSubmitting, setPasscodeSubmitting] = useState(false);

  // Modal drawers & viewer states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch event meta
  const fetchEventData = async (code = tagCode) => {
    try {
      const url = code 
        ? `/api/events/${slug}?t=${code}` 
        : `/api/events/${slug}`;
        
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not fetch event detail');
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      
      setEvent(data);
      
      // If we are authorized, load gallery
      if (!data.requiresPasscode) {
        await fetchUploads();
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch uploads
  const fetchUploads = async () => {
    try {
      const res = await fetch(`/api/events/${slug}/uploads`);
      if (res.ok) {
        const data = await res.json();
        setUploads(data);
      }
    } catch (err) {
      console.error('Error fetching uploads:', err);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [slug]);

  // Realtime polling: refresh uploads every 12 seconds
  useEffect(() => {
    if (event && !event.requiresPasscode) {
      const interval = setInterval(() => {
        fetchUploads();
      }, 12000);
      return () => clearInterval(interval);
    }
  }, [event]);

  // Handle Passcode Submit
  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    setPasscodeError('');
    setPasscodeSubmitting(true);
    
    try {
      const res = await fetch(`/api/events/${slug}/verify-passcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setPasscodeError(data.error || 'Verification failed');
      } else {
        // Success: reload event data to clear passcode shield
        await fetchEventData();
      }
    } catch (err) {
      setPasscodeError('Connection failed.');
    } finally {
      setPasscodeSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUploads();
    setTimeout(() => setRefreshing(false), 8000);
  };

  // Maps preset codes to aesthetic name descriptions
  const PRESET_LABELS = {
    '35mm-natural': '35mm Negative',
    '35mm-flash': 'Night-Flash',
    'pristine-digital': 'Pristine Digital',
    'cinematic-portrait': 'Cinematic Portrait'
  };

  // Maps preset codes to typography combinations
  const getPresetStyles = (p) => {
    switch (p) {
      case '35mm-natural':
        return {
          titleFont: 'font-display italic font-light tracking-wide text-amber-50',
          accentColor: 'text-amber-400',
          badgeClass: 'bg-amber-950/40 border-amber-900/50 text-amber-400'
        };
      case '35mm-flash':
        return {
          titleFont: 'font-sans font-black tracking-tighter text-zinc-100 uppercase',
          accentColor: 'text-rose-500',
          badgeClass: 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
        };
      case 'pristine-digital':
        return {
          titleFont: 'font-sans font-black tracking-tight text-white uppercase',
          accentColor: 'text-sky-400',
          badgeClass: 'bg-sky-950/40 border-sky-900/50 text-sky-400'
        };
      case 'cinematic-portrait':
        return {
          titleFont: 'font-display italic font-light tracking-wider text-purple-100',
          accentColor: 'text-purple-400',
          badgeClass: 'bg-purple-950/40 border-purple-900/50 text-purple-400'
        };
      default:
        return {
          titleFont: 'font-sans font-bold text-zinc-100',
          accentColor: 'text-amber-500',
          badgeClass: 'bg-zinc-850 border-white/5 text-zinc-400'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-light">Decrypting physical memory space...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 stroke-[1.5] mb-4" />
        <h2 className="text-xl font-bold mb-2">Memory Space Blocked</h2>
        <p className="text-zinc-400 text-sm leading-relaxed mb-6">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="glass hover:bg-white/5 px-6 py-2.5 rounded-full text-xs font-semibold tracking-wider active:scale-95 transition-all w-full"
        >
          RETURN HOME
        </button>
      </div>
    );
  }

  // PASSCODE CHALLENGE SHIELD
  if (event?.requiresPasscode) {
    const styles = getPresetStyles(event.preset);
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-950/70 to-black/30 pointer-events-none z-0" />
        
        {/* Event Cover blurred backdrop */}
        {event.coverImage && (
          <div 
            className="absolute inset-0 z-[-1] opacity-20 blur-3xl scale-125 bg-cover bg-center transition-all duration-700"
            style={{ backgroundImage: `url(${event.coverImage})` }}
          />
        )}

        <div className="glass-premium p-8 rounded-3xl max-w-md w-full relative z-10 text-center border border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6 text-amber-500">
            <Lock className="w-6 h-6 stroke-[1.5]" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Private Memory Space</h2>
          <p className="text-zinc-400 text-xs font-light mb-6">
            "<span className="text-zinc-200 font-semibold">{event.title}</span>" requires physical keyring authorization or a direct access passcode.
          </p>

          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="Enter 4-Digit Passcode"
                maxLength={8}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center tracking-[0.4em] font-mono text-xl py-3 px-4 rounded-xl glass-input placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-zinc-600 text-white"
                required
              />
            </div>

            {passcodeError && (
              <p className="text-rose-400 text-xs flex items-center justify-center gap-1.5 font-light">
                <AlertCircle className="w-3.5 h-3.5" />
                {passcodeError}
              </p>
            )}

            <button
              type="submit"
              disabled={passcodeSubmitting}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold py-3 rounded-xl shadow-lg transition-all active:scale-98 disabled:opacity-50 text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              {passcodeSubmitting ? 'Verifying...' : 'UNLOCK SPACE'}
              {!passcodeSubmitting && <ChevronRight className="w-4 h-4 stroke-[2.5]" />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-2 items-center">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">HOW DO I ACCESS?</span>
            <p className="text-zinc-500 text-[11px] font-light max-w-[280px]">
              Tap the physical **NFC keyring** that was given to you for this event to instantly bypass this passcode screen!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // FULLY AUTHORIZED GUEST HOME SCREEN
  const styles = getPresetStyles(event.preset);
  const hasGrain = event.preset !== 'pristine-digital' && event.preset !== 'cinematic-portrait';

  return (
    <div className={`flex-1 flex flex-col pb-24 relative ${hasGrain ? 'film-grain' : 'no-grain'}`}>
      {/* Dynamic Background Glow matching Preset */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-full max-w-4xl h-[350px] bg-gradient-to-b from-amber-500/10 via-violet-600/5 to-transparent blur-[100px] pointer-events-none z-0" />

      {/* Main Cover Header */}
      <section className="relative w-full h-[320px] md:h-[400px] overflow-hidden select-none z-10 border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-t from-[#070709] via-transparent to-black/60 z-10" />
        
        <img
          src={event.coverImage}
          alt={event.title}
          fetchpriority="high" // MANDATORY per LCP optimization instructions
          className={`w-full h-full object-cover filter-${event.preset}`}
        />

        {/* Floating Top Header bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="glass hover:bg-white/5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest text-zinc-400 border border-white/5"
          >
            ← HOME
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-3 py-1 rounded-full border glass font-semibold tracking-wider ${styles.badgeClass}`}>
              {PRESET_LABELS[event.preset] || event.preset} Presets
            </span>
          </div>
        </div>

        {/* Banner Details (Bottom aligned) */}
        <div className="absolute bottom-6 left-6 right-6 z-20 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-amber-500 font-bold block mb-1">
              📷 MEMORY CACHE ACTIVE
            </span>
            <h1 className={`text-3xl md:text-5xl font-bold tracking-tight mb-2 ${styles.titleFont}`}>
              {event.title}
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm font-light flex items-center gap-2">
              <span>{uploads.length} collective snaps</span>
              <span className="text-zinc-700">•</span>
              <span>No accounts required</span>
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="self-start md:self-auto glass hover:bg-white/5 text-zinc-300 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wider transition-all flex items-center gap-2 border border-white/5 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            {refreshing ? 'REFRESHING...' : 'SYNC GALLERY'}
          </button>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="p-6 md:p-10 max-w-6xl mx-auto w-full relative z-20">
        {uploads.length === 0 ? (
          <div className="glass p-12 rounded-3xl text-center max-w-md mx-auto my-12 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Camera className="w-8 h-8 text-zinc-500 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">No memories captured yet</h3>
            <p className="text-zinc-500 text-xs leading-relaxed mb-6 font-light max-w-[280px] mx-auto">
              Be the very first main character! Tap the floating camera button to contribute to this archive.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-6 py-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 mx-auto cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              UPLOAD FIRST MEMORY
            </button>
          </div>
        ) : (
          <Gallery 
            uploads={uploads} 
            preset={event.preset} 
            onImageClick={(index) => setViewerIndex(index)} 
          />
        )}
      </main>

      {/* Floating Action Button (Camera Upload) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsUploadOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black flex items-center justify-center shadow-[0_8px_32px_rgba(245,158,11,0.4)] active:scale-90 hover:scale-105 transition-all duration-300 cursor-pointer relative group border-2 border-black"
          aria-label="Upload Photo or Video"
        >
          <Camera className="w-6 h-6 stroke-[2]" />
          <span className="absolute -top-10 right-0 bg-zinc-950 text-white text-[10px] font-bold tracking-widest px-2.5 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none uppercase whitespace-nowrap shadow-xl">
            ADD SNAPSHOT
          </span>
        </button>
      </div>

      {/* Bottom status badge */}
      {tagCode && (
        <div className="fixed bottom-6 left-6 z-40 hidden sm:block">
          <div className="glass px-3.5 py-2 rounded-full border border-white/5 shadow-2xl flex items-center gap-2 text-[10px] font-bold text-zinc-400 tracking-wider">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            NFC KEYRING DETECTED (TAG: {tagCode})
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Viewer */}
      {viewerIndex !== null && (
        <FullscreenViewer
          uploads={uploads}
          preset={event.preset}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* Slide-up Upload Drawer */}
      <UploadDrawer
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        slug={slug}
        tagCode={tagCode}
        preset={event.preset}
        onUploadSuccess={(newUpload) => {
          setUploads(prev => [newUpload, ...prev]);
          setIsUploadOpen(false);
        }}
      />
    </div>
  );
}

export default EventLanding;
