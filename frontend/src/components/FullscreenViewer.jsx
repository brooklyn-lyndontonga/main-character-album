import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronUp, ChevronDown, User, Calendar, Tag, 
  Settings, Camera, Image as ImageIcon, RotateCw, 
  Sparkles, Check, AlertTriangle, Upload, Eye 
} from 'lucide-react';

function FullscreenViewer({ uploads, preset, initialIndex, onClose, onNewUpload, slug, tagCode }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Gesture states
  const [pointerStart, setPointerStart] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [gestureDirection, setGestureDirection] = useState(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Horizontal panels state
  const [horizontalState, setHorizontalState] = useState('view'); // 'view' | 'menu' | 'camera'
  
  // Local display preset switcher (allows dynamic styling overrides in client)
  const [localPreset, setLocalPreset] = useState(preset);

  // Library photo picker states
  const [libraryFile, setLibraryFile] = useState(null);
  const [libraryPreview, setLibraryPreview] = useState(null);
  const [uploaderName, setUploaderName] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // WebRTC Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) | 'user' (front)
  const [snappedPhoto, setSnappedPhoto] = useState(null); // base64 JPEG data URL
  const [shutterFlashing, setShutterFlashing] = useState(false);
  const [cameraUploading, setCameraUploading] = useState(false);
  const [cameraUploaderName, setCameraUploaderName] = useState('');
  const [cameraCaption, setCameraCaption] = useState('');

  // Refs
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scrollLockedRef = useRef(false);

  const currentUpload = uploads[currentIndex];
  const N = uploads.length;
  const prevIndex = (currentIndex - 1 + N) % N;
  const nextIndex = (currentIndex + 1) % N;

  // Sync initial preset
  useEffect(() => {
    setLocalPreset(preset);
  }, [preset]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // WebRTC camera orchestrator
  const startCamera = async (mode = facingMode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(null);
      setCameraActive(true);
    } catch (err) {
      console.error('Camera streaming failed:', err);
      setCameraError('Could not access device camera. Please check permissions or use the system camera fallback.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Automatically start/stop camera on horizontalState changes
  useEffect(() => {
    if (horizontalState === 'camera' && !snappedPhoto) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
  }, [horizontalState, snappedPhoto]);

  // Unified transition snapping mechanism
  const transitionTo = (direction) => {
    if (isAnimating) return;
    const h = containerRef.current?.clientHeight || window.innerHeight;
    setIsAnimating(true);

    if (direction === 'next') {
      setOffsetY(-h);
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setOffsetY(0);
        setIsAnimating(false);
      }, 500);
    } else if (direction === 'prev') {
      setOffsetY(h);
      setTimeout(() => {
        setCurrentIndex(prevIndex);
        setOffsetY(0);
        setIsAnimating(false);
      }, 500);
    } else {
      // Stay: Snap back
      setOffsetY(0);
      setTimeout(() => {
        setIsAnimating(false);
      }, 500);
    }
  };

  // Keyboard navigation shortcuts (Blocked in settings/camera panels)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (horizontalState !== 'view') return;
      
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        transitionTo('prev');
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        transitionTo('next');
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, uploads.length, horizontalState]);

  // Desktop Mouse Wheel support (with kinetic pacing)
  useEffect(() => {
    const handleWheel = (e) => {
      // Block wheel inside camera or menu panel
      if (horizontalState !== 'view') return;
      e.preventDefault();
      if (scrollLockedRef.current || uploads.length <= 1) return;

      if (Math.abs(e.deltaY) > 8) {
        scrollLockedRef.current = true;
        if (e.deltaY > 0) {
          transitionTo('next');
        } else {
          transitionTo('prev');
        }
        // Throttler lock to protect elegant pace
        setTimeout(() => {
          scrollLockedRef.current = false;
        }, 600);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [currentIndex, uploads.length, horizontalState]);

  // Gesture Engine Handlers
  const handlePointerDown = (e) => {
    if (isAnimating) return;
    // Only capture primary touch/left click
    if (e.button !== undefined && e.button !== 0) return;

    setPointerStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    setGestureDirection(null);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || pointerStart === null) return;

    const diffX = e.clientX - pointerStart.x;
    const diffY = e.clientY - pointerStart.y;

    if (gestureDirection === null) {
      const deadzone = 10;
      if (Math.abs(diffX) > deadzone || Math.abs(diffY) > deadzone) {
        if (Math.abs(diffY) > Math.abs(diffX)) {
          // Locked to vertical photo scrolling
          setGestureDirection('vertical');
        } else {
          // Locked to horizontal panel pulling
          setGestureDirection('horizontal');
        }
      }
      return;
    }

    if (gestureDirection === 'vertical') {
      if (uploads.length <= 1) return;
      setOffsetY(diffY);
    } else if (gestureDirection === 'horizontal') {
      setOffsetX(diffX);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const w = containerRef.current?.clientWidth || window.innerWidth;
    const h = containerRef.current?.clientHeight || window.innerHeight;
    const thresholdX = Math.min(80, w * 0.15);
    const thresholdY = Math.min(80, h * 0.12);

    if (gestureDirection === 'vertical') {
      const diff = offsetY;
      if (diff < -thresholdY) {
        transitionTo('next');
      } else if (diff > thresholdY) {
        transitionTo('prev');
      } else {
        transitionTo('stay');
      }
    } else if (gestureDirection === 'horizontal') {
      const diff = offsetX;
      if (horizontalState === 'view') {
        if (diff > thresholdX) {
          // Swiped right -> Open Settings Menu
          setHorizontalState('menu');
        } else if (diff < -thresholdX) {
          // Swiped left -> Open Live Camera
          setHorizontalState('camera');
        }
      } else if (horizontalState === 'menu') {
        if (diff < -thresholdX) {
          // Swipe left in menu -> Close menu
          setHorizontalState('view');
        }
      } else if (horizontalState === 'camera') {
        if (diff > thresholdX) {
          // Swipe right in camera -> Close camera
          setHorizontalState('view');
          stopCamera();
        }
      }
    }

    // Reset coordinates
    setOffsetX(0);
    setOffsetY(0);
    setPointerStart(null);
  };

  const handlePointerCancel = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    
    // Snap back safely
    transitionTo('stay');
    setOffsetX(0);
    setOffsetY(0);
    setPointerStart(null);
  };

  // Image snapping & frame-grabber via Canvas
  const snapPhoto = () => {
    if (!videoRef.current) return;

    setShutterFlashing(true);
    setTimeout(() => setShutterFlashing(false), 180);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      const ctx = canvas.getContext('2d');
      
      // Mirror camera stream horizontally if front-facing selfie mode is selected
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      setSnappedPhoto(dataUrl);
      stopCamera();
    } catch (err) {
      console.error('Shutter trigger failed:', err);
    }
  };

  const flipCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  // Photo library picker handlers
  const handleLibraryFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLibraryFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLibraryPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFallbackFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSnappedPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload Submits
  const handleLibraryUploadSubmit = async (e) => {
    e.preventDefault();
    if (!libraryFile || uploading) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', libraryFile);
    formData.append('uploaderName', uploaderName);
    formData.append('caption', caption);
    if (tagCode) {
      formData.append('tagCode', tagCode);
    }

    try {
      const res = await fetch(`/api/events/${slug}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      const newUpload = await res.json();
      
      if (onNewUpload) {
        onNewUpload(newUpload);
      }
      
      // Clean states
      setLibraryFile(null);
      setLibraryPreview(null);
      setCaption('');
      setUploaderName('');
      
      // Navigate cleanly to newly developed image
      setHorizontalState('view');
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
      alert('Failed to upload library image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCameraUploadSubmit = async (e) => {
    e.preventDefault();
    if (!snappedPhoto || cameraUploading) return;

    setCameraUploading(true);

    try {
      // Decode dataurl blob
      const response = await fetch(snappedPhoto);
      const blob = await response.blob();
      const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaderName', cameraUploaderName);
      formData.append('caption', cameraCaption);
      if (tagCode) {
        formData.append('tagCode', tagCode);
      }

      const res = await fetch(`/api/events/${slug}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Camera upload failed');
      const newUpload = await res.json();

      if (onNewUpload) {
        onNewUpload(newUpload);
      }

      // Reset camera states
      setSnappedPhoto(null);
      setCameraCaption('');
      setCameraUploaderName('');
      
      // Snaps directly to top slide
      setHorizontalState('view');
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
      alert('Failed to develop snapshot. Please try again.');
    } finally {
      setCameraUploading(false);
    }
  };

  // Relative vertical coordinates for looping slides
  const renderSlide = (upload, index, offset) => {
    const isVideo = upload.type === 'video';
    const isCenter = offset === 0;

    return (
      <div
        key={`${upload.id}-${offset}`}
        className="absolute inset-0 w-full h-full select-none overflow-hidden"
        style={{
          transform: `translateY(${offset * 100}%)`,
          zIndex: isCenter ? 20 : 10,
          pointerEvents: isCenter ? 'auto' : 'none'
        }}
      >
        {/* Full-bleed media container - stretches edge to edge on left and right */}
        <div className="absolute inset-0 w-full h-full z-0 select-none">
          {isVideo ? (
            <video
              src={upload.imageUrl}
              controls
              autoPlay={isCenter && !isAnimating && horizontalState === 'view'}
              loop
              muted
              className={`w-full h-full object-cover filter-${localPreset}`}
            />
          ) : (
            <img
              src={upload.imageUrl}
              alt={upload.caption || 'Memory details'}
              className={`w-full h-full object-cover filter-${localPreset} select-none pointer-events-none`}
            />
          )}
        </div>

        {/* Dynamic Glassmorphic Captions Card (Floating absolute layer over full-bleed slide) */}
        <div className="absolute bottom-20 left-4 right-4 max-w-lg mx-auto glass p-4 rounded-2xl border border-white/10 shadow-2xl z-20 text-center space-y-1.5 backdrop-blur-md bg-black/45">
          {upload.caption && (
            <p className="text-white text-xs md:text-sm font-light italic leading-relaxed">
              "{upload.caption}"
            </p>
          )}

          <div className="flex items-center justify-center gap-6 text-[10px] text-zinc-400 font-light pt-1">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-500 stroke-[1.5]" />
              Uploaded by <span className="font-bold text-zinc-300">{upload.uploaderName || 'Anonymous'}</span>
            </span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 stroke-[1.5]" />
              {getRelativeTime(upload.createdAt)}
            </span>
          </div>
        </div>
      </div>
    );
  };

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

  // Drag offsets calculations for horizontal panels
  const getLeftPanelTransform = () => {
    if (isDragging && gestureDirection === 'horizontal') {
      if (horizontalState === 'view' && offsetX > 0) {
        return { transform: `translateX(calc(-100% + ${offsetX}px))`, transition: 'none' };
      }
      if (horizontalState === 'menu' && offsetX < 0) {
        return { transform: `translateX(${offsetX}px)`, transition: 'none' };
      }
    }
    return {};
  };

  const getRightPanelTransform = () => {
    if (isDragging && gestureDirection === 'horizontal') {
      if (horizontalState === 'view' && offsetX < 0) {
        return { transform: `translateX(calc(100% + ${offsetX}px))`, transition: 'none' };
      }
      if (horizontalState === 'camera' && offsetX > 0) {
        return { transform: `translateX(${offsetX}px)`, transition: 'none' };
      }
    }
    return {};
  };

  const getBackdropOpacity = () => {
    if (isDragging && gestureDirection === 'horizontal') {
      if (horizontalState === 'view' && offsetX > 0) {
        const val = Math.min(0.6, (offsetX / window.innerWidth) * 0.6);
        return { opacity: val, display: 'block', transition: 'none' };
      }
      if (horizontalState === 'menu' && offsetX < 0) {
        const val = Math.max(0, 0.6 + (offsetX / window.innerWidth) * 0.6);
        return { opacity: val, display: 'block', transition: 'none' };
      }
    }
    return {};
  };

  const PRESET_LABELS = {
    '35mm-natural': '35mm Negative',
    '35mm-flash': 'Night-Flash',
    'pristine-digital': 'Pristine Digital',
    'cinematic-portrait': 'Cinematic Portrait'
  };

  const PRESET_DESCRIPTIONS = {
    '35mm-natural': 'Warm daylight, open ambient shadows, subtle editorial grain.',
    '35mm-flash': 'Bold frontal flash, high contrast, peach skin tones, dark backdrop.',
    'pristine-digital': 'Crystal digital definition, high sharpness, zero film grain.',
    'cinematic-portrait': 'Beautiful backlighting, soft portrait focus, pristine blacks.'
  };

  return (
    <div 
      ref={containerRef}
      id="vertical-carousel-container"
      className="fixed inset-0 z-50 bg-black select-none overflow-hidden touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {/* Background wash & film grain layers */}
      <div 
        className="absolute inset-0 opacity-15 blur-[120px] scale-125 bg-cover bg-center transition-all duration-700 z-0 pointer-events-none"
        style={{ backgroundImage: `url(${currentUpload?.imageUrl})` }}
      />
      {localPreset !== 'pristine-digital' && localPreset !== 'cinematic-portrait' && (
        <div className="absolute inset-0 z-25 pointer-events-none film-grain" />
      )}

      {/* Lightbox Stable Header (Floating absolute overlay over the full-bleed slides) */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 py-5 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent shrink-0">
        <div className="flex items-center gap-2">
          {/* Swiping Indicator Helpers */}
          <button
            onClick={() => setHorizontalState('menu')}
            className="p-1.5 rounded-lg hover:bg-white/5 border border-white/0 hover:border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer mr-1"
            title="Open Upload & Filter Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <span className="text-[10px] px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
            {PRESET_LABELS[localPreset] || localPreset}
          </span>
          {currentUpload?.tagCode && (
            <span className="hidden sm:flex text-[9px] px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-zinc-400 font-bold tracking-wider items-center gap-1.5">
              <Tag className="w-2.5 h-2.5" />
              NFC TAG: {currentUpload.tagCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-zinc-400 font-mono text-xs drop-shadow-md">
            {currentIndex + 1} / {uploads.length}
          </span>
          
          <button
            onClick={() => setHorizontalState('camera')}
            className="w-9 h-9 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 hover:text-amber-350 border border-amber-500/25 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-amber-500/5 drop-shadow-md"
            title="Open Instant Shutter Camera"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-350 border border-white/5 hover:text-white transition-all active:scale-90 cursor-pointer drop-shadow-md"
            aria-label="Close Lightbox"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main slides area container - covers the full screen under the absolute header */}
      <div className="absolute inset-0 z-10 w-full h-full overflow-hidden">
        {/* Navigation Indicator Overlay Guides (Swipe hints) */}
        {uploads.length > 1 && horizontalState === 'view' && (
          <>
            <button
              onClick={() => transitionTo('prev')}
              className="absolute top-20 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/5 text-zinc-400 hover:text-white flex items-center justify-center z-30 transition-all hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
              aria-label="Previous Snapshot"
            >
              <ChevronUp className="w-5 h-5" />
            </button>

            <button
              onClick={() => transitionTo('next')}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/5 text-zinc-400 hover:text-white flex items-center justify-center z-30 transition-all hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
              aria-label="Next Snapshot"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Swipe Left/Right quick hint indicators on desktop edges */}
        {horizontalState === 'view' && (
          <>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none opacity-20 hover:opacity-80 transition-opacity hidden md:flex flex-col items-center gap-1">
              <span className="text-[9px] uppercase tracking-widest text-zinc-400 rotate-270 translate-y-6">Settings</span>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none opacity-20 hover:opacity-80 transition-opacity hidden md:flex flex-col items-center gap-1">
              <span className="text-[9px] uppercase tracking-widest text-zinc-400 rotate-90 -translate-y-6">Camera</span>
            </div>
          </>
        )}

        {/* Dynamic Vertical Scroll Container */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            transform: `translateY(${offsetY}px)`,
            transition: isDragging && gestureDirection === 'vertical' ? 'none' : 'transform 500ms cubic-bezier(0.25, 1, 0.5, 1)'
          }}
        >
          {uploads.length > 0 ? (
            uploads.length === 1 ? (
              renderSlide(uploads[0], 0, 0)
            ) : (
              <>
                {renderSlide(uploads[prevIndex], prevIndex, -1)}
                {renderSlide(uploads[currentIndex], currentIndex, 0)}
                {renderSlide(uploads[nextIndex], nextIndex, 1)}
              </>
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 font-light">
              No photos in this album.
            </div>
          )}
        </div>
      </div>

      {/* BACKGROUND BACKDROP DIMMER OVERLAY (for Left Menu) */}
      <div 
        onClick={() => setHorizontalState('view')}
        className={`absolute inset-0 bg-black/60 z-30 transition-opacity duration-300 ${
          horizontalState === 'menu' ? 'opacity-100 block' : 'opacity-0 hidden pointer-events-none'
        }`}
        style={getBackdropOpacity()}
      />

      {/* LEFT SIDE PANEL: Upload Settings & Preset Switcher */}
      <aside 
        className={`absolute inset-y-0 left-0 w-[85vw] max-w-sm z-40 bg-[#0a0a0c]/98 backdrop-blur-2xl border-r border-white/10 p-6 flex flex-col justify-between transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          horizontalState === 'menu' ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={getLeftPanelTransform()}
      >
        <div className="space-y-6 overflow-y-auto pr-1 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-500" />
              <h2 className="text-white text-base font-bold tracking-wide">Album Settings</h2>
            </div>
            <button 
              onClick={() => setHorizontalState('view')}
              className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Switch Filter Preset locally */}
          <div className="space-y-3">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Aesthetic Filter Mode
            </h3>
            <p className="text-[10px] text-zinc-500 leading-normal">
              Simulate high-end film stock profiles. Updates display visual rendering instantly!
            </p>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {Object.keys(PRESET_LABELS).map((key) => {
                const isActive = localPreset === key;
                return (
                  <button
                    key={key}
                    onClick={() => setLocalPreset(key)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isActive 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/5' 
                        : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold tracking-wide">{PRESET_LABELS[key]}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5 leading-normal">{PRESET_DESCRIPTIONS[key]}</div>
                    </div>
                    {isActive && <Check className="w-4 h-4 shrink-0 text-amber-400 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-b border-white/5 my-4" />

          {/* Section 2: Choose existing photo from device */}
          <div className="space-y-4">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              Photo Roll Library
            </h3>

            {!libraryPreview ? (
              <label 
                className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border border-dashed border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-300 transition-all cursor-pointer group p-4 text-center"
              >
                <Upload className="w-6 h-6 stroke-[1.5] text-amber-500 mb-2 group-hover:scale-105 transition-transform" />
                <span className="text-xs font-medium text-zinc-300">Select from photo roll</span>
                <span className="text-[9px] text-zinc-500 mt-1 leading-normal">Choose existing files from your device</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleLibraryFileChange}
                />
              </label>
            ) : (
              <form onSubmit={handleLibraryUploadSubmit} className="space-y-3.5">
                {/* File Preview */}
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video max-h-36 flex items-center justify-center">
                  <img 
                    src={libraryPreview} 
                    alt="Library preview" 
                    className="max-w-full max-h-full object-contain filter-warm" 
                  />
                  <button
                    type="button"
                    onClick={() => { setLibraryFile(null); setLibraryPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white border border-white/10 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Form Fields */}
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5 font-bold">UPLOADER NAME</label>
                    <input
                      type="text"
                      placeholder="Your Name (Optional)"
                      value={uploaderName}
                      onChange={(e) => setUploaderName(e.target.value)}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5 font-bold">CAPTION</label>
                    <textarea
                      placeholder="Add an editorial caption..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs tracking-wider uppercase transition-all active:scale-98 shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      DEVELOPING...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      DEVELOP & UPLOAD
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info inside menu */}
        <div className="border-t border-white/5 pt-4 mt-4 shrink-0 text-center text-[9px] text-zinc-600 flex flex-col items-center gap-1 font-light">
          <span>Swipe left or tap backdrop to return</span>
          <span>NFC EVENT ALBUM MVP</span>
        </div>
      </aside>

      {/* RIGHT SIDE PANEL: Live HTML5 Disposable Flash Camera */}
      <aside 
        className={`absolute inset-y-0 right-0 w-full z-40 bg-[#060608] flex flex-col justify-between transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          horizontalState === 'camera' ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={getRightPanelTransform()}
      >
        {/* Shutter White Flash overlay */}
        <div 
          className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-75 ${
            shutterFlashing ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Camera Header */}
        <header className="relative z-30 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-500" />
            <h2 className="text-white text-sm font-bold tracking-wide uppercase">35mm Disposable Shutter</h2>
          </div>
          <button 
            onClick={() => { setHorizontalState('view'); stopCamera(); }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all border border-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Immersive Viewfinder viewport */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black select-none">
          {!snappedPhoto ? (
            cameraActive ? (
              <>
                {/* Viewfinder Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Aesthetic Camera Grid Overlay */}
                <div className="absolute inset-0 border-[0.5px] border-white/10 pointer-events-none z-10 flex flex-col justify-between">
                  <div className="flex-1 flex border-b border-white/10">
                    <div className="flex-1 border-r border-white/10" />
                    <div className="flex-1 border-r border-white/10" />
                    <div className="flex-1" />
                  </div>
                  <div className="flex-1 flex border-b border-white/10">
                    <div className="flex-1 border-r border-white/10" />
                    <div className="flex-1 border-r border-white/10" />
                    <div className="flex-1" />
                  </div>
                  <div className="flex-1 flex">
                    <div className="flex-1 border-r border-white/10" />
                    <div className="flex-1 border-r border-white/10" />
                    <div className="flex-1" />
                  </div>
                </div>

                {/* Green Vintage glowing overlay specs */}
                <div className="absolute top-4 left-4 z-20 pointer-events-none font-mono text-[9px] text-emerald-400 bg-black/40 px-2 py-1 rounded border border-emerald-500/20 tracking-wider uppercase space-y-0.5">
                  <div>• LIVE FEED</div>
                  <div>ISO 400</div>
                  <div>35mm F/2.8</div>
                </div>
                <div className="absolute top-4 right-4 z-20 pointer-events-none font-mono text-[9px] text-emerald-400 bg-black/40 px-2 py-1 rounded border border-emerald-500/20 tracking-wider uppercase">
                  EXP +0.3
                </div>

                {/* Floating snapshot guidance badge */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                  <span className="text-[8px] bg-zinc-950/80 border border-white/10 text-zinc-400 px-3 py-1.5 rounded-full font-bold tracking-widest uppercase">
                    Press Shutter button to snap
                  </span>
                </div>
              </>
            ) : cameraError ? (
              // Permission errors fallback layout
              <div className="px-6 text-center space-y-4 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-white text-sm font-bold">Web Camera Access Required</h4>
                  <p className="text-xs text-zinc-500 leading-normal">
                    This screen uses live WebRTC camera views. If access was blocked or you're on a non-HTTPS connection, use the system camera below!
                  </p>
                </div>
                
                <label 
                  className="inline-flex py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs tracking-wider uppercase transition-all active:scale-98 shadow-lg shadow-amber-500/10 items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Launch Native Camera App
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFallbackFileChange}
                  />
                </label>
              </div>
            ) : (
              // Loading state
              <div className="text-center space-y-3.5">
                <RotateCw className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
                <span className="text-zinc-500 text-xs font-light">Powering up film sensor...</span>
              </div>
            )
          ) : (
            // Snapped Photo Preview Stage
            <div className="absolute inset-0 flex flex-col justify-between items-center p-4">
              <div className="flex-1 w-full flex items-center justify-center min-h-0 relative select-none">
                <img
                  src={snappedPhoto}
                  alt="Snapped Frame"
                  className={`max-w-full max-h-full rounded-2xl border border-white/10 shadow-2xl object-contain filter-${localPreset}`}
                />
              </div>

              {/* Development inputs box */}
              <form onSubmit={handleCameraUploadSubmit} className="w-full max-w-lg glass p-4 rounded-2xl border border-white/10 shadow-xl mt-4 shrink-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">SNAPSHOT CREATOR</label>
                    <input
                      type="text"
                      placeholder="Your Name (Optional)"
                      value={cameraUploaderName}
                      onChange={(e) => setCameraUploaderName(e.target.value)}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">STORY CAPTION</label>
                    <input
                      type="text"
                      placeholder="What is this memory?"
                      value={cameraCaption}
                      onChange={(e) => setCameraCaption(e.target.value)}
                      className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSnappedPhoto(null);
                      if (horizontalState === 'camera') {
                        startCamera(facingMode);
                      }
                    }}
                    className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer"
                  >
                    Take Another Photo
                  </button>

                  <button
                    type="submit"
                    disabled={cameraUploading}
                    className="py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {cameraUploading ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        DEVELOPING...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        DEVELOP & UPLOAD
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Live camera shutter buttons panel */}
        {!snappedPhoto && cameraActive && (
          <footer className="px-6 py-6 border-t border-white/5 bg-black/60 backdrop-blur-md shrink-0 flex items-center justify-between z-20">
            {/* System File/App Fallback Button */}
            <label className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer">
              <Upload className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFallbackFileChange}
              />
            </label>

            {/* Giant Circular shutter button */}
            <button
              onClick={snapPhoto}
              className="w-16 h-16 rounded-full border-4 border-amber-500/30 flex items-center justify-center bg-transparent cursor-pointer group"
              title="Snap Snapshot"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500 group-hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20" />
            </button>

            {/* Flip camera facing-mode button */}
            <button
              onClick={flipCamera}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Flip Selfie Camera"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </footer>
        )}

        {/* Camera Footer directions */}
        <div className="bg-black/90 py-3 text-center text-[9px] text-zinc-400 border-t border-white/5 font-mono tracking-wide shrink-0">
          Swipe right or tap the top Close button (X) to exit camera
        </div>
      </aside>
    </div>
  );
}

export default FullscreenViewer;
