import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ChevronUp, ChevronDown, User, Calendar, Tag, 
  Settings, Camera, Image as ImageIcon, RotateCw, 
  Sparkles, Check, AlertTriangle, Upload, Eye, Share2, Download 
} from 'lucide-react';

function FullscreenViewer({ uploads, preset, initialIndex, onClose, onNewUpload, slug, tagCode, showVerifiedBadge = true }) {
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

  // Keepsake Generator states
  const [showKeepsakeModal, setShowKeepsakeModal] = useState(false);
  const [keepsakeProcessing, setKeepsakeProcessing] = useState(false);
  const [keepsakeTheme, setKeepsakeTheme] = useState('noir'); // 'noir' | 'sepia' | 'chrome'
  const [includePolaroidFrame, setIncludePolaroidFrame] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scrollLockedRef = useRef(false);

  const currentUpload = uploads[currentIndex];
  const N = uploads.length;
  const prevIndex = (currentIndex - 1 + N) % N;
  const nextIndex = (currentIndex + 1) % N;

  // Sync initial preset without useEffect to avoid cascading renders
  const [prevPreset, setPrevPreset] = useState(preset);
  if (preset !== prevPreset) {
    setLocalPreset(preset);
    setPrevPreset(preset);
  }

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // WebRTC camera orchestrator
  const startCamera = useCallback(async (mode = facingMode) => {
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
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Automatically start/stop camera on horizontalState changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (horizontalState === 'camera' && !snappedPhoto) {
        startCamera(facingMode);
      } else {
        stopCamera();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [horizontalState, snappedPhoto, facingMode, startCamera, stopCamera]);

  // Unified transition snapping mechanism
  const transitionTo = useCallback((direction) => {
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
  }, [isAnimating, nextIndex, prevIndex]);

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
  }, [currentIndex, uploads.length, horizontalState, onClose, transitionTo]);

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
  }, [currentIndex, uploads.length, horizontalState, transitionTo]);

  // Gesture Engine Handlers
  const handlePointerDown = (e) => {
    if (isAnimating) return;
    // Only capture primary touch/left click
    if (e.button !== undefined && e.button !== 0) return;

    // Prevent gesture engine from hijacking interaction with native HTML form fields
    const tagName = e.target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || e.target.closest('button') || e.target.closest('select') || e.target.closest('a')) {
      return; // Preserve native browser focus, typing, and clicks
    }

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
    } catch {
      // Ignore errors when pointer capture release fails
    }

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
    } catch {
      // Ignore errors when pointer capture release fails
    }
    
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

  const spoolOfflinePhoto = (base64Data, name, desc) => {
    const tempId = `spool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const spooledItem = {
      id: tempId,
      imageUrl: base64Data,
      uploaderName: name.trim() || 'Anonymous',
      caption: desc.trim() || '',
      createdAt: new Date().toISOString(),
      tagCode: tagCode || null,
      isSpooled: true,
      type: 'image'
    };

    try {
      // Save to localStorage spool queue
      const queueKey = `nfc_spool_queue_${slug}`;
      const existingQueueJson = localStorage.getItem(queueKey);
      const existingQueue = existingQueueJson ? JSON.parse(existingQueueJson) : [];
      
      const spoolEntry = {
        id: tempId,
        fileData: base64Data,
        uploaderName: name.trim() || 'Anonymous',
        caption: desc.trim() || '',
        tagCode: tagCode || null,
        createdAt: spooledItem.createdAt
      };
      
      localStorage.setItem(queueKey, JSON.stringify([...existingQueue, spoolEntry]));

      // Prepend to parent uploads state
      if (onNewUpload) {
        onNewUpload(spooledItem);
      }

      // Reset current form views
      setLibraryFile(null);
      setLibraryPreview(null);
      setCaption('');
      setUploaderName('');
      setSnappedPhoto(null);
      setCameraCaption('');
      setCameraUploaderName('');

      // Navigate to visual carousel and focus slide 0 (newest item)
      setHorizontalState('view');
      setCurrentIndex(0);
    } catch (quotaErr) {
      console.error('LocalStorage write failed (quota limit):', quotaErr);
      alert('Failed to save offline snapshot. The device storage is low or full.');
    }
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
      if (!navigator.onLine) {
        throw new Error('Network offline');
      }

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
      
      // If it's a video, we do not spool (too large for localStorage)
      if (libraryFile && libraryFile.type && libraryFile.type.startsWith('video')) {
        alert('Failed to upload video. Please check your internet connection and try again.');
      } else {
        console.warn('Library upload failed or offline. Spooling snapshot...', err);
        spoolOfflinePhoto(libraryPreview, uploaderName, caption);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCameraUploadSubmit = async (e) => {
    e.preventDefault();
    if (!snappedPhoto || cameraUploading) return;

    setCameraUploading(true);

    try {
      if (!navigator.onLine) {
        throw new Error('Network offline');
      }

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
      console.warn('Camera upload failed or offline. Spooling snapshot...', err);
      spoolOfflinePhoto(snappedPhoto, cameraUploaderName, cameraCaption);
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

        {/* Pulsating orange pending offline sync overlay badge */}
        {upload.isSpooled && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-500/40 bg-black/70 text-orange-400 font-mono text-[9px] font-bold uppercase tracking-wider shadow-lg animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
            <span>⚡ Offline Snapshot (Pending Sync...)</span>
          </div>
        )}

        {/* Dynamic Glassmorphic Captions Card (Floating absolute layer over full-bleed slide) */}
        <div className="absolute bottom-20 left-4 right-4 max-w-lg mx-auto glass p-4 rounded-2xl border border-white/10 shadow-2xl z-20 text-center space-y-1.5 backdrop-blur-md bg-black/45">
          {upload.caption && (
            <p className="text-white text-xs md:text-sm font-light italic leading-relaxed">
              "{upload.caption}"
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5 mt-2">
            <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-zinc-400 font-light">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-500 stroke-[1.5]" />
                Uploaded by <span className="font-bold text-zinc-300">{upload.tagGuestName || upload.uploaderName || 'Anonymous'}</span>
              </span>
              <span className="text-zinc-550">•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 stroke-[1.5]" />
                {getRelativeTime(upload.createdAt)}
              </span>
            </div>

            {!isVideo && (
              <button
                onClick={() => setShowKeepsakeModal(true)}
                className="px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Keepsake Card
              </button>
            )}
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
    } catch {
      return '';
    }
  };

  const generateKeepsakeCard = (downloadMode = true) => {
    if (!currentUpload || keepsakeProcessing) return;
    setKeepsakeProcessing(true);

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        // 1. Draw Backdrop
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
        if (keepsakeTheme === 'noir') {
          bgGrad.addColorStop(0, '#0f0f13');
          bgGrad.addColorStop(1, '#040405');
        } else if (keepsakeTheme === 'sepia') {
          bgGrad.addColorStop(0, '#362a24');
          bgGrad.addColorStop(1, '#1b1411');
        } else { // 'chrome'
          bgGrad.addColorStop(0, '#1c1d24');
          bgGrad.addColorStop(1, '#0a0a0c');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1920);

        // 2. Draw punched film strip sprocket holes on left and right columns
        const drawSprocket = (x, y, w, h, r) => {
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
          } else {
            ctx.rect(x, y, w, h);
          }
          ctx.fill();
          
          // Outer gold/silver subtle glow
          ctx.strokeStyle = keepsakeTheme === 'sepia' ? 'rgba(217, 119, 6, 0.12)' : 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        };

        const sprocketW = 25;
        const sprocketH = 36;
        const sprocketR = 6;
        const sprocketSpacing = 72;
        const startY = 70;
        const endY = 1920 - 70;

        for (let y = startY; y < endY; y += sprocketSpacing) {
          // Left Column
          drawSprocket(40, y, sprocketW, sprocketH, sprocketR);
          // Right Column
          drawSprocket(1080 - 40 - sprocketW, y, sprocketW, sprocketH, sprocketR);
        }

        // 3. Draw thin accent frame border box
        ctx.strokeStyle = keepsakeTheme === 'sepia' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(85, 80, 1080 - 170, 1920 - 160, 20);
        } else {
          ctx.rect(85, 80, 1080 - 170, 1920 - 160);
        }
        ctx.stroke();

        // 4. Header title text
        ctx.textAlign = 'center';
        if (keepsakeTheme === 'sepia') {
          ctx.fillStyle = '#d97706';
          ctx.font = 'bold 22px Courier New, monospace';
          ctx.fillText('MAIN CHARACTER VINTAGE MEMORY // CACHE FILE', 1080 / 2, 140);
        } else {
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'italic 24px Playfair Display, Georgia, serif';
          ctx.fillText('MAIN CHARACTER EXCLUSIVE // 35MM MEMORY PRINT', 1080 / 2, 140);
        }

        // 5. Draw centered photo block
        const containerX = 120;
        const containerY = 190;
        const containerW = 840;
        const containerH = 1120;

        if (includePolaroidFrame) {
          // Polaroid white background block
          ctx.fillStyle = '#f7f5f0'; // warm chalk white
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(containerX, containerY, containerW, containerH, 12);
          } else {
            ctx.rect(containerX, containerY, containerW, containerH);
          }
          ctx.fill();
          
          // Polaroid soft shadow edge
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Image block inside Polaroid
          const imgX = containerX + 35;
          const imgY = containerY + 35;
          const imgW = containerW - 70;
          const imgH = containerH - 160; // leave larger bottom gap for writing!

          // Object-cover calculations
          const imgRatio = img.width / img.height;
          const targetRatio = imgW / imgH;
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

          if (imgRatio > targetRatio) {
            sWidth = img.height * targetRatio;
            sx = (img.width - sWidth) / 2;
          } else {
            sHeight = img.width / imgRatio;
            sy = (img.height - sHeight) / 2;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, imgX, imgY, imgW, imgH);

          // Draw handwritten style caption on polaroid bottom
          ctx.fillStyle = '#1e1e24';
          ctx.textAlign = 'center';
          ctx.font = 'italic bold 28px Georgia, serif';
          const pCaption = currentUpload.caption 
            ? `"${currentUpload.caption.slice(0, 42)}${currentUpload.caption.length > 42 ? '...' : ''}"` 
            : `Memory captured by ${currentUpload.uploaderName || 'Anonymous'}`;
          ctx.fillText(pCaption, 1080 / 2, containerY + containerH - 60);
        } else {
          // Classic edge border container
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(containerX, containerY, containerW, containerH, 16);
          } else {
            ctx.rect(containerX, containerY, containerW, containerH);
          }
          ctx.stroke();

          // Clip image to rounded rect
          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(containerX, containerY, containerW, containerH, 16);
          } else {
            ctx.rect(containerX, containerY, containerW, containerH);
          }
          ctx.clip();

          // Object-cover
          const imgRatio = img.width / img.height;
          const targetRatio = containerW / containerH;
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

          if (imgRatio > targetRatio) {
            sWidth = img.height * targetRatio;
            sx = (img.width - sWidth) / 2;
          } else {
            sHeight = img.width / imgRatio;
            sy = (img.height - sHeight) / 2;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, containerX, containerY, containerW, containerH);
          ctx.restore();
        }

        // 6. Draw Divider Line
        const dividerY = 1360;
        ctx.strokeStyle = keepsakeTheme === 'sepia' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(140, dividerY);
        ctx.lineTo(1080 - 140, dividerY);
        ctx.stroke();

        // 7. Render Metadata Text Blocks
        ctx.textAlign = 'left';
        ctx.fillStyle = keepsakeTheme === 'sepia' ? '#b45309' : '#e4e4e7';
        ctx.font = 'bold 24px Outfit, sans-serif';
        const nameText = `CAPTURED BY: ${(currentUpload.tagGuestName || currentUpload.uploaderName || 'ANONYMOUS GUEST').toUpperCase()}`;
        ctx.fillText(nameText, 140, dividerY + 50);

        ctx.textAlign = 'right';
        ctx.fillStyle = keepsakeTheme === 'sepia' ? '#d97706' : '#a1a1aa';
        ctx.font = '18px monospace';
        const dateText = `${new Date(currentUpload.createdAt).toLocaleDateString()} // ${currentUpload.tagCode && showVerifiedBadge ? `NFC VERIFIED (${currentUpload.tagGuestName || currentUpload.tagCode})` : 'WEB contributions'}`;
        ctx.fillText(dateText, 1080 - 140, dividerY + 48);

        // 8. Render wrapped Caption Paragraph below photo
        if (currentUpload.caption && !includePolaroidFrame) {
          ctx.textAlign = 'left';
          ctx.fillStyle = keepsakeTheme === 'sepia' ? '#f59e0b' : '#ffffff';
          ctx.font = 'italic 25px Georgia, serif';
          
          const textX = 140;
          const textY = dividerY + 110;
          const maxTextW = 800;
          const textLineHeight = 36;
          
          // inline wrap text implementation
          const words = `"${currentUpload.caption}"`.split(' ');
          let line = '';
          let currentY = textY;
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxTextW && n > 0) {
              ctx.fillText(line, textX, currentY);
              line = words[n] + ' ';
              currentY += textLineHeight;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, textX, currentY);
        }

        // 9. Branding/Watermark Signature at the very bottom
        ctx.textAlign = 'center';
        ctx.fillStyle = keepsakeTheme === 'sepia' ? 'rgba(217, 119, 6, 0.4)' : 'rgba(255, 255, 255, 0.25)';
        ctx.font = 'bold 15px monospace';
        
        const serialNo = currentUpload.id.slice(-10).toUpperCase();
        ctx.fillText(`MAIN CHARACTER CO. • KEEP THIS PORTAL SOUVENIR • SERIAL #${serialNo}`, 1080 / 2, 1810);

        // 10. Generate elegant bottom serial-bar code lines
        const barcodeY = 1835;
        const barColors = keepsakeTheme === 'sepia' ? ['#d97706', 'rgba(217,119,6,0.3)', '#b45309'] : ['#f59e0b', 'rgba(255,255,255,0.15)', '#a1a1aa'];
        ctx.fillStyle = barColors[0];
        let bx = 1080 / 2 - 150;
        ctx.fillRect(bx, barcodeY, 8, 30);
        bx += 14;
        ctx.fillStyle = barColors[1];
        ctx.fillRect(bx, barcodeY, 4, 30);
        bx += 8;
        ctx.fillStyle = barColors[2];
        ctx.fillRect(bx, barcodeY, 12, 30);
        bx += 18;
        ctx.fillStyle = barColors[0];
        ctx.fillRect(bx, barcodeY, 6, 30);
        bx += 12;
        ctx.fillStyle = barColors[1];
        ctx.fillRect(bx, barcodeY, 18, 30);
        bx += 24;
        ctx.fillStyle = barColors[2];
        ctx.fillRect(bx, barcodeY, 4, 30);
        bx += 10;
        ctx.fillStyle = barColors[0];
        ctx.fillRect(bx, barcodeY, 10, 30);
        bx += 16;
        ctx.fillStyle = barColors[1];
        ctx.fillRect(bx, barcodeY, 6, 30);
        bx += 12;
        ctx.fillStyle = barColors[2];
        ctx.fillRect(bx, barcodeY, 14, 30);

        // 11. Complete & download or share
        const exportUrl = canvas.toDataURL('image/jpeg', 0.92);
        
        if (downloadMode) {
          const downloadLink = document.createElement('a');
          downloadLink.download = `keepsake-${slug}-${serialNo.toLowerCase()}.jpg`;
          downloadLink.href = exportUrl;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          setKeepsakeProcessing(false);
        } else {
          // Native Web Share API if possible
          if (navigator.share) {
            fetch(exportUrl)
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], `keepsake-${serialNo}.jpg`, { type: 'image/jpeg' });
                navigator.share({
                  files: [file],
                  title: `NFC Album Keepsake`,
                  text: `Check out this keepsake from the ${slug} event!`
                }).catch(err => {
                  console.warn('Sharing failed:', err);
                });
              });
          } else {
            // Fallback: Copy to clipboard or alert
            alert('Keepsake card ready! Click the Download button to save it to your device.');
          }
          setKeepsakeProcessing(false);
        }
      } catch (err) {
        console.error('Keepsake canvas drawing crashed:', err);
        alert('Keepsake card generation failed. Please try a different photo.');
        setKeepsakeProcessing(false);
      }
    };

    img.onerror = (e) => {
      console.error('Failed to load image on canvas:', currentUpload.imageUrl, e);
      try {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          ctx.fillStyle = '#0f0f13';
          ctx.fillRect(0, 0, 1080, 1920);
          ctx.drawImage(fallbackImg, 120, 190, 840, 1120);
          const exportUrl = canvas.toDataURL('image/jpeg', 0.85);
          const downloadLink = document.createElement('a');
          downloadLink.download = `keepsake-${slug}-fallback.jpg`;
          downloadLink.href = exportUrl;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          setKeepsakeProcessing(false);
        };
        fallbackImg.onerror = () => {
          alert('Could not load original image from host server.');
          setKeepsakeProcessing(false);
        };
        fallbackImg.src = currentUpload.imageUrl;
      } catch {
        setKeepsakeProcessing(false);
      }
    };

    img.src = currentUpload.imageUrl;
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
          {currentUpload?.tagCode && showVerifiedBadge && (
            <span className="hidden sm:flex text-[9px] px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-zinc-400 font-bold tracking-wider items-center gap-1.5">
              <Tag className="w-2.5 h-2.5 text-amber-500" />
              NFC VERIFIED: {currentUpload.tagGuestName || currentUpload.tagCode}
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

      {/* RETRO KEEPSAKE FILM CARD GENERATOR MODAL */}
      {showKeepsakeModal && (
        <div 
          onClick={() => setShowKeepsakeModal(false)}
          className="absolute inset-0 z-55 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 md:p-8 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-[#09090b]/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 relative max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              onClick={() => setShowKeepsakeModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left: 9:16 Retro Film Card Live CSS Preview */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold tracking-widest text-zinc-500 mb-3 uppercase flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Live Keepsake Print Preview
              </span>
              
              <div 
                className={`w-full max-w-[280px] aspect-[9/16] rounded-2xl border relative overflow-hidden shadow-2xl flex flex-col justify-between p-7 select-none transition-all duration-300 ${
                  keepsakeTheme === 'noir'
                    ? 'bg-[#0f0f13] border-amber-500/20 text-white'
                    : keepsakeTheme === 'sepia'
                    ? 'bg-[#362a24] border-amber-800/30 text-amber-100'
                    : 'bg-[#1c1d24] border-zinc-700 text-white'
                }`}
              >
                {/* CSS Sprocket Holes - Left Margin */}
                <div className="absolute left-2.5 top-0 bottom-0 flex flex-col justify-around py-4 pointer-events-none">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div 
                      key={`sp-l-${i}`} 
                      className={`w-1.5 h-3 bg-black rounded-[2px] border transition-colors ${
                        keepsakeTheme === 'sepia' ? 'border-amber-800/10' : 'border-white/5'
                      }`} 
                    />
                  ))}
                </div>

                {/* CSS Sprocket Holes - Right Margin */}
                <div className="absolute right-2.5 top-0 bottom-0 flex flex-col justify-around py-4 pointer-events-none">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div 
                      key={`sp-r-${i}`} 
                      className={`w-1.5 h-3 bg-black rounded-[2px] border transition-colors ${
                        keepsakeTheme === 'sepia' ? 'border-amber-800/10' : 'border-white/5'
                      }`} 
                    />
                  ))}
                </div>

                {/* Header visual */}
                <div className="text-center font-mono text-[6px] tracking-wider pointer-events-none uppercase mb-2">
                  {keepsakeTheme === 'sepia' ? (
                    <span className="text-amber-600 font-bold">MAIN CHARACTER VINTAGE MEMORY // CACHE</span>
                  ) : (
                    <span className="text-amber-500 italic">MAIN CHARACTER EXCLUSIVE // 35MM MEMORY PRINT</span>
                  )}
                </div>

                {/* Main Photo container */}
                <div className="flex-1 w-full flex items-center justify-center overflow-hidden relative">
                  {includePolaroidFrame ? (
                    /* Cream Polaroid Style Frame */
                    <div className="w-full h-full bg-[#f7f5f0] rounded-lg p-2.5 pb-9 shadow-md flex flex-col justify-between items-center transition-all duration-300 select-none">
                      <div className="w-full flex-1 overflow-hidden rounded relative">
                        <img 
                          src={currentUpload.imageUrl} 
                          alt="Polaroid Preview" 
                          className="w-full h-full object-cover select-none pointer-events-none"
                        />
                      </div>
                      <span className="text-[7.5px] font-bold text-zinc-800 font-serif italic mt-2 pointer-events-none block whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                        {currentUpload.caption 
                          ? `"${currentUpload.caption.slice(0, 32)}${currentUpload.caption.length > 32 ? '...' : ''}"` 
                          : `Captured by ${currentUpload.uploaderName || 'Anonymous'}`}
                      </span>
                    </div>
                  ) : (
                    /* Classic Photo Border */
                    <div className="w-full h-full rounded-lg overflow-hidden border border-white/5 shadow-lg select-none relative">
                      <img 
                        src={currentUpload.imageUrl} 
                        alt="Keepsake Preview" 
                        className="w-full h-full object-cover select-none pointer-events-none"
                      />
                    </div>
                  )}
                </div>

                {/* Divider bar */}
                <div 
                  className={`w-full h-[0.5px] my-3 ${
                    keepsakeTheme === 'sepia' ? 'bg-amber-800/20' : 'bg-white/10'
                  }`} 
                />

                {/* Footer details info block */}
                <div className="space-y-2 pointer-events-none">
                  <div className="flex items-center justify-between text-[6.5px]">
                    <span className="font-bold uppercase tracking-wider block max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap">
                      BY: {currentUpload.uploaderName || 'ANONYMOUS'}
                    </span>
                    <span className="font-mono text-zinc-500">
                      {new Date(currentUpload.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {!includePolaroidFrame && currentUpload.caption && (
                    <p className={`text-[6.5px] italic leading-tight max-h-10 overflow-hidden line-clamp-2 ${
                      keepsakeTheme === 'sepia' ? 'text-amber-700' : 'text-zinc-300'
                    }`}>
                      "{currentUpload.caption}"
                    </p>
                  )}

                  {/* Brand Barcode details */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span className="text-[5px] text-zinc-500 font-mono tracking-widest">
                      PORTAL CARD // SERIAL#{currentUpload.id.slice(-8).toUpperCase()}
                    </span>
                    {/* CSS Mockup Barcode */}
                    <div className="flex gap-[1.5px] items-center h-4 opacity-50 justify-center">
                      <div className="w-[1.5px] h-full bg-zinc-400" />
                      <div className="w-[0.5px] h-full bg-zinc-400" />
                      <div className="w-1 h-full bg-zinc-400" />
                      <div className="w-[0.5px] h-full bg-zinc-400" />
                      <div className="w-[1.5px] h-full bg-zinc-400" />
                      <div className="w-[2px] h-full bg-zinc-400" />
                      <div className="w-[0.5px] h-full bg-zinc-400" />
                      <div className="w-[1.5px] h-full bg-zinc-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Customisation Options and Actions */}
            <div className="flex-1 flex flex-col justify-between py-2 space-y-6">
              <div className="space-y-5">
                <div>
                  <h3 className="text-white text-base font-bold tracking-wide">Customize Event Keepsake</h3>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                    Generate an ultra-premium high-resolution 1080x1920 portrait memory card perfect for Instagram Stories, printing, or physical party favors.
                  </p>
                </div>

                {/* Border / Accent theme selector */}
                <div className="space-y-2.5">
                  <label className="block text-[9px] font-bold text-zinc-400 tracking-wider uppercase">Select Print Aesthetic Stock</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'noir', name: 'Darkroom Noir', desc: 'Midnight Gold' },
                      { id: 'sepia', name: 'Vintage Sepia', desc: 'Amber Warmth' },
                      { id: 'chrome', name: 'Liquid Chrome', desc: 'Monochrome' }
                    ].map((t) => {
                      const isActive = keepsakeTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setKeepsakeTheme(t.id)}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${
                            isActive
                              ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-lg'
                              : 'border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="text-[10px] font-bold tracking-wide block">{t.name}</span>
                          <span className="text-[8px] opacity-60 mt-1 block">{t.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Polaroid Frame Toggle switch */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Polaroid-Style Frame</div>
                    <div className="text-[9px] text-zinc-500 leading-normal max-w-[220px]">
                      Embed photo inside a retro thick matte border with centered handwritten signature details.
                    </div>
                  </div>
                  <button
                    onClick={() => setIncludePolaroidFrame(!includePolaroidFrame)}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 cursor-pointer shrink-0 ${
                      includePolaroidFrame ? 'bg-amber-500 justify-end' : 'bg-zinc-800 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-lg transition-transform" />
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => generateKeepsakeCard(true)}
                  disabled={keepsakeProcessing}
                  className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs tracking-widest uppercase transition-all active:scale-98 shadow-xl shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {keepsakeProcessing ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      COMPILING PRINTS...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      COMPILE & DOWNLOAD FILM CARD
                    </>
                  )}
                </button>

                <button
                  onClick={() => generateKeepsakeCard(false)}
                  disabled={keepsakeProcessing}
                  className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs tracking-widest uppercase transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-55"
                >
                  <Share2 className="w-4 h-4" />
                  SHARE TO INSTAGRAM / STORY
                </button>

                <button
                  onClick={() => setShowKeepsakeModal(false)}
                  className="w-full py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 font-bold text-[10px] tracking-widest uppercase transition-colors cursor-pointer text-center"
                >
                  CANCEL & RETURN TO ALBUM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FullscreenViewer;
