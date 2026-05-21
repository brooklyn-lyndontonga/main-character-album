import React from 'react';
import { Heart, MessageCircle, Play } from 'lucide-react';

function Gallery({ uploads, preset, onImageClick }) {
  
  // Format dates to relative human-readable times
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {uploads.map((upload, index) => {
        const isVideo = upload.type === 'video';
        
        return (
          <div
            key={upload.id}
            onClick={() => onImageClick(index)}
            className="group relative rounded-2xl overflow-hidden glass border border-white/5 aspect-square hover-lift cursor-pointer select-none"
          >
            {/* Film grain effect applied individually for retro presets */}
            {preset !== 'pristine-digital' && preset !== 'cinematic-portrait' && (
              <div className="absolute inset-0 z-10 pointer-events-none film-grain" />
            )}

            {/* Aesthetic Filter overlay + Image rendering */}
            <div className="w-full h-full relative overflow-hidden bg-zinc-950">
              {isVideo ? (
                <div className="w-full h-full relative flex items-center justify-center">
                  {/* For videos, show thumbnail if possible or default icon */}
                  <img
                    src={upload.thumbnailUrl || 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=400&h=400&auto=format&fit=crop'}
                    alt="Video thumbnail"
                    loading="lazy"
                    className={`w-full h-full object-cover filter-${preset} opacity-80`}
                  />
                  <div className="absolute w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10 z-20 shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 text-amber-500 fill-amber-500 translate-x-0.5" />
                  </div>
                </div>
              ) : (
                <img
                  src={upload.thumbnailUrl}
                  alt={upload.caption || 'Memory upload'}
                  loading="lazy" // HIGH PERFORMANCE lazy loading for images below the fold
                  className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter-${preset}`}
                />
              )}
            </div>

            {/* Hover overlay content with glassmorphism bar */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 flex flex-col justify-end p-4">
              <div className="translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                {upload.caption && (
                  <p className="text-zinc-200 text-xs font-light line-clamp-2 mb-2 leading-relaxed italic">
                    "{upload.caption}"
                  </p>
                )}
                
                <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
                  <span className="font-semibold text-amber-400 truncate max-w-[100px]">
                    {upload.uploaderName || 'Anonymous'}
                  </span>
                  <span className="text-zinc-500 font-light shrink-0">
                    {getRelativeTime(upload.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Minimal static badge on mobile viewports so uploader name is always readable */}
            <div className="absolute bottom-2 left-2 z-10 sm:hidden bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5 text-[9px] font-bold text-zinc-300">
              {upload.uploaderName || 'Guest'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Gallery;
