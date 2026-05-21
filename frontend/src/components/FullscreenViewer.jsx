import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, User, Calendar, Sparkles, Tag } from 'lucide-react';

function FullscreenViewer({ uploads, preset, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const currentUpload = uploads[currentIndex];

  // Navigate left/right
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? uploads.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === uploads.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getRelativeTime = (isoString) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now - past;
      
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return '';
    }
  };

  const isVideo = currentUpload?.type === 'video';

  return (
    <div className="fixed inset-0 z-50 bg-[#060608]/95 backdrop-blur-md flex flex-col justify-between select-none">
      {/* Background aesthetic blur */}
      <div 
        className="absolute inset-0 opacity-20 blur-[100px] scale-125 bg-cover bg-center transition-all duration-500 z-0 pointer-events-none"
        style={{ backgroundImage: `url(${currentUpload?.imageUrl})` }}
      />
      
      {/* Individual film grain simulated layer */}
      {preset !== 'pristine-digital' && preset !== 'cinematic-portrait' && (
        <div className="absolute inset-0 z-10 pointer-events-none film-grain" />
      )}

      {/* Lightbox Header Bar */}
      <header className="relative z-20 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold tracking-widest uppercase">
            🎞️ {preset} preset
          </span>
          {currentUpload?.tagCode && (
            <span className="text-[9px] px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-zinc-400 font-bold tracking-wider flex items-center gap-1.5">
              <Tag className="w-2.5 h-2.5" />
              NFC TAG: {currentUpload.tagCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-zinc-500 font-mono text-xs">
            {currentIndex + 1} / {uploads.length}
          </span>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 border border-white/5 hover:text-white transition-all active:scale-90"
            aria-label="Close Lightbox"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Lightbox Body (Image carousel and Navigation controls) */}
      <div className="flex-1 relative flex items-center justify-center p-4 min-h-0 z-20">
        {/* Left Arrow */}
        <button
          onClick={handlePrev}
          className="absolute left-4 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/5 text-zinc-300 flex items-center justify-center z-30 transition-all hover:scale-105 active:scale-95 hidden sm:flex cursor-pointer"
          aria-label="Previous Snapshot"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Selected Media Item */}
        <div className="w-full h-full max-w-4xl max-h-[70vh] flex items-center justify-center relative group">
          {isVideo ? (
            <video
              src={currentUpload?.imageUrl}
              controls
              autoPlay
              className={`max-w-full max-h-full rounded-2xl border border-white/10 shadow-2xl object-contain filter-${preset}`}
            />
          ) : (
            <img
              src={currentUpload?.imageUrl}
              alt={currentUpload?.caption || 'Memory details'}
              className={`max-w-full max-h-full rounded-2xl border border-white/10 shadow-2xl object-contain filter-${preset} animate-fade-in transition-all duration-300 select-none pointer-events-none`}
            />
          )}
        </div>

        {/* Right Arrow */}
        <button
          onClick={handleNext}
          className="absolute right-4 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/5 text-zinc-300 flex items-center justify-center z-30 transition-all hover:scale-105 active:scale-95 hidden sm:flex cursor-pointer"
          aria-label="Next Snapshot"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Lightbox Caption Overlay footer bar */}
      <footer className="relative z-20 p-6 border-t border-white/5 bg-black/40 backdrop-blur-md shrink-0">
        <div className="max-w-xl mx-auto space-y-3">
          
          {currentUpload?.caption && (
            <p className="text-white text-sm md:text-base font-light italic leading-relaxed text-center">
              "{currentUpload.caption}"
            </p>
          )}

          <div className="flex items-center justify-center gap-6 text-xs text-zinc-500 font-light pt-2">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-500 stroke-[1.5]" />
              Uploaded by <span className="font-bold text-amber-400/90">{currentUpload?.uploaderName || 'Anonymous Guest'}</span>
            </span>
            <span className="text-zinc-800">•</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 stroke-[1.5]" />
              {getRelativeTime(currentUpload?.createdAt)}
            </span>
          </div>
        </div>

        {/* Mobile Swipe / Tap guidelines */}
        <div className="text-center text-[9px] text-zinc-700 font-bold uppercase tracking-widest mt-4 sm:hidden">
          ← TAP LEFT OR RIGHT TO BROWSE →
        </div>
      </footer>
    </div>
  );
}

export default FullscreenViewer;
