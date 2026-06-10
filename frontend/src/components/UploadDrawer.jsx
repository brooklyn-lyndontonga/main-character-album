import { useState, useRef } from 'react';
import { X, Upload, Film, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

const PRESET_LABELS = {
  '35mm-natural': '35mm Negative',
  '35mm-flash': 'Night-Flash',
  'pristine-digital': 'Pristine Digital',
  'cinematic-portrait': 'Cinematic Portrait'
};

// Pure helper function for offline spool ID generation
const generateTempId = () => {
  return `spool_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

function UploadDrawer({ isOpen, onClose, slug, tagCode, guestName, preset, isClosed, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [uploaderName, setUploaderName] = useState(guestName || '');
  const [caption, setCaption] = useState('');
  
  // Upload status states
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const fileInputRef = useRef(null);


  // Handle file selection
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    // Validate size (10MB limit)
    if (selected.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 10MB limit.');
      setStatus('error');
      return;
    }

    setFile(selected);
    
    // Generate object URL for image preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(selected);
    
    setStatus('idle');
    setErrorMessage('');
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isClosed) {
      setErrorMessage('The upload window has closed.');
      setStatus('error');
      return;
    }
    if (!file) return;

    setStatus('uploading');
    setProgress(15);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploaderName', uploaderName.trim());
    formData.append('caption', caption.trim());
    if (tagCode) {
      formData.append('tagCode', tagCode);
    }

    // Simulate smooth progress loading ticker
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + Math.floor(Math.random() * 12) + 4;
      });
    }, 250);

    try {
      if (!navigator.onLine) {
        throw new Error('Network offline');
      }

      const res = await fetch(`/api/events/${slug}/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      clearInterval(progressInterval);

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setProgress(100);
      setStatus('success');
      
      // Deliberate brief timeout to let the user see the gorgeous success state!
      setTimeout(() => {
        onUploadSuccess(data);
        resetState();
      }, 1000);

    } catch (err) {
      clearInterval(progressInterval);
      
      // If it's a video, do not spool (too large for localStorage)
      if (file && file.type && file.type.startsWith('video')) {
        setErrorMessage(err.message || 'Upload processing failed.');
        setStatus('error');
        return;
      }

      console.warn('UploadDrawer offline or failed. Spooling to localStorage...', err);
      
      // Construct a spooled item
      const tempId = generateTempId();
      const spooledItem = {
        id: tempId,
        imageUrl: preview, // base64 JPEG from FileReader
        uploaderName: uploaderName.trim() || 'Anonymous',
        caption: caption.trim() || '',
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
          fileData: preview,
          uploaderName: uploaderName.trim() || 'Anonymous',
          caption: caption.trim() || '',
          tagCode: tagCode || null,
          createdAt: spooledItem.createdAt
        };
        
        localStorage.setItem(queueKey, JSON.stringify([...existingQueue, spoolEntry]));

        setProgress(100);
        setStatus('success');
        
        setTimeout(() => {
          onUploadSuccess(spooledItem);
          resetState();
        }, 1000);
      } catch (quotaErr) {
        console.error('LocalStorage write failed (quota limit):', quotaErr);
        setErrorMessage('Failed to save offline snapshot (album is full or device storage is low).');
        setStatus('error');
      }
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview('');
    setUploaderName('');
    setCaption('');
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center select-none">
      {/* Dark backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={status !== 'uploading' ? onClose : undefined}
      />

      {/* Floating Bottom Drawer Card */}
      <div className="glass-premium w-full max-w-lg rounded-t-[32px] border border-white/10 relative z-10 max-h-[92vh] overflow-y-auto flex flex-col transition-transform duration-500 transform translate-y-0 shadow-2xl">
        
        {/* Drag handle line */}
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto my-3 shrink-0" />

        {/* Drawer Header */}
        <div className="px-6 pb-4 flex items-center justify-between border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📷</span>
            <h3 className="text-base font-bold text-zinc-100 tracking-wide">
              Contribute Snapshot
            </h3>
          </div>
          <button 
            onClick={onClose}
            disabled={status === 'uploading'}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 border border-white/5 active:scale-90 transition-all shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Form Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {status === 'uploading' ? (
            /* Immersive dynamic loading state */
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 relative">
                <Film className="w-10 h-10 text-amber-500 animate-spin stroke-[1.5]" />
                <div className="absolute inset-0 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              </div>
              <h4 className="text-lg font-bold tracking-tight text-white mb-2">Development & Processing...</h4>
              <p className="text-zinc-500 text-xs font-light max-w-[280px] leading-relaxed mb-6">
                Applying the <span className="text-amber-400 font-semibold">{PRESET_LABELS[preset] || preset}</span> dynamic film overlay, resizing, and caching.
              </p>
              
              {/* Progress Slider */}
              <div className="w-full max-w-[240px] h-2 bg-zinc-800 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mt-2">
                {progress}% DEVELOPMENT COMPLETE
              </span>
            </div>
          ) : status === 'success' ? (
            /* Success confirmation */
            <div className="py-12 text-center flex flex-col items-center justify-center animate-pulse">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 stroke-[1.5]" />
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Snapshot Preserved!</h4>
              <p className="text-zinc-500 text-xs font-light">Memory successfully blended into the event feed.</p>
            </div>
          ) : isClosed ? (
            /* Closed screen */
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Upload Window Closed</h4>
              <p className="text-zinc-550 text-xs font-light max-w-[280px] leading-relaxed">
                This memory space is now in **Archive Mode**. The upload window has closed and new uploads are disabled.
              </p>
            </div>
          ) : (
            /* Form screen */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Upload Drop Zone / Clicker */}
              {!preview ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/10 hover:border-amber-500/30 rounded-2xl p-8 text-center bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer select-none group flex flex-col items-center"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    className="hidden"
                    required
                  />
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 mb-4 group-hover:scale-105 group-hover:text-amber-500 transition-all">
                    <Upload className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-200 mb-1">
                    Select a photo or video
                  </h4>
                  <p className="text-zinc-500 text-[11px] font-light max-w-[200px] leading-relaxed">
                    Tap to trigger your native camera roll (Max Size: 10MB)
                  </p>
                </div>
              ) : (
                /* Selected Preview screen */
                <div className="relative rounded-2xl overflow-hidden bg-zinc-950 aspect-video flex items-center justify-center border border-white/5">
                  {preset !== 'pristine-digital' && preset !== 'cinematic-portrait' && (
                    <div className="absolute inset-0 z-10 pointer-events-none film-grain" />
                  )}
                  <img
                    src={preview}
                    alt="Select preview"
                    className={`w-full h-full object-cover filter-${preset}`}
                  />
                  <div className="absolute inset-0 bg-black/35 z-10 pointer-events-none" />
                  
                  {/* Selected label */}
                  <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[9px] font-bold text-zinc-300 z-20 flex items-center gap-1.5 shadow-xl">
                    <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500 animate-pulse" />
                    {(PRESET_LABELS[preset] || preset).toUpperCase()} OVERLAY ACTIVE
                  </span>

                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(''); }}
                    className="absolute top-3 right-3 bg-black/60 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center border border-white/10 hover:bg-black/80 transition-all text-zinc-300 z-20 active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Form Input fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                    YOUR NAME (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    id="name"
                    maxLength={30}
                    placeholder="Enter your name"
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                    className="w-full py-2.5 px-3.5 rounded-xl text-sm text-white glass-input font-light placeholder:text-zinc-600 disabled:opacity-50 disabled:text-zinc-400"
                    disabled={!!guestName}
                  />
                  {guestName && (
                    <span className="text-[10px] text-amber-500 font-bold tracking-wider mt-1.5 block">
                      ✓ Linked to NFC Keyring ({guestName})
                    </span>
                  )}
                </div>

                <div>
                  <label htmlFor="caption" className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                    CAPTION / MEMORY (OPTIONAL)
                  </label>
                  <textarea
                    id="caption"
                    maxLength={150}
                    rows={2}
                    placeholder="Capture the feeling..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full py-2.5 px-3.5 rounded-xl text-sm text-white glass-input font-light placeholder:text-zinc-600 resize-none"
                  />
                  <div className="text-right text-[9px] text-zinc-600 font-bold mt-1">
                    {caption.length}/150 CHARS
                  </div>
                </div>
              </div>

              {/* Error messages */}
              {status === 'error' && (
                <div className="p-3 bg-rose-950/20 border border-rose-900/50 text-rose-400 rounded-xl text-xs flex items-start gap-2.5 font-light">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Submit button */}
              <button
                type="submit"
                disabled={!file}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-zinc-800 disabled:to-zinc-800 text-black disabled:text-zinc-500 font-bold py-3 rounded-xl shadow-lg transition-all active:scale-98 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm tracking-wider"
              >
                <Upload className="w-4 h-4" />
                DEVELOP SNAPSHOT
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadDrawer;
