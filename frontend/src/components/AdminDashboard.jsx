import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Plus, Eye, Trash2, Key, ToggleLeft, ToggleRight, 
  Settings, Database, Image as ImageIcon,
  Tag, Download, Check, AlertCircle, LogOut, ExternalLink, RefreshCw
} from 'lucide-react';

// 4-digit Passcode Input sub-component
function PasscodeInput({ passcode, setPasscode }) {
  const digits = passcode.split('');
  while (digits.length < 4) digits.push('');
  
  const handleDigitChange = (index, value) => {
    const cleanVal = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    
    const newPasscode = newDigits.join('');
    setPasscode(newPasscode);
    
    if (cleanVal && index < 3) {
      const nextInput = document.getElementById(`passcode-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const prevInput = document.getElementById(`passcode-digit-${index - 1}`);
        if (prevInput) {
          prevInput.focus();
          const newDigits = [...digits];
          newDigits[index - 1] = '';
          setPasscode(newDigits.join(''));
        }
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setPasscode(newDigits.join(''));
      }
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3].map((idx) => (
        <input
          key={idx}
          id={`passcode-digit-${idx}`}
          type="text"
          pattern="[0-9]*"
          inputMode="numeric"
          maxLength={1}
          value={digits[idx]}
          onChange={(e) => handleDigitChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          className="w-12 h-12 text-center text-lg font-bold text-white rounded-xl bg-zinc-950 border border-white/10 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
        />
      ))}
    </div>
  );
}

function AdminDashboard({ navigate }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Dashboard Core State
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Form State (Event Creation / Editing)
  const [editingId, setEditingId] = useState(null); // null if creating
  const [template, setTemplate] = useState('custom');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [preset, setPreset] = useState('35mm-natural');
  const [passcode, setPasscode] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submittingForm, setSubmittingForm] = useState(false);

  // New Event Form Configuration States
  const [date, setDate] = useState('');
  const [eventType, setEventType] = useState('custom');
  const [sessionDays, setSessionDays] = useState(7);
  const [closesAt, setClosesAt] = useState('');
  const [bypassEnabled, setBypassEnabled] = useState(true);
  const [showVerifiedBadge, setShowVerifiedBadge] = useState(true);
  const [guestNameRegistration, setGuestNameRegistration] = useState(true);
  const [initialTagCount, setInitialTagCount] = useState(30);
  const [usePasscode, setUsePasscode] = useState(false);

  // Card Cover Editor State
  const [editingCoverId, setEditingCoverId] = useState(null);
  const [tempCoverUrl, setTempCoverUrl] = useState('');

  const handleUpdateCover = async (eventId, coverUrl) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImage: coverUrl })
      });
      if (res.ok) {
        setEditingCoverId(null);
        fetchEvents();
      } else {
        alert('Failed to update cover image.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating cover.');
    }
  };

  // NFC Tags Management State
  const [selectedEventForTags, setSelectedEventForTags] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);

  // Moderation Gallery State
  const [selectedEventForMod, setSelectedEventForMod] = useState(null);
  const [modUploads, setModUploads] = useState([]);
  const [modLoading, setModLoading] = useState(false);

  // Fetch all events
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch('/api/admin/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // Check initial authentication
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await fetch('/api/admin/verify');
        const data = await res.json();
        if (data.admin) {
          setIsAuthenticated(true);
          fetchEvents();
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    const timer = setTimeout(() => {
      verifyAuth();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  // Handle Login Submit
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Login failed');
      } else {
        setIsAuthenticated(true);
        fetchEvents();
      }
    } catch {
      setLoginError('Connection failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setPassword('');
    } catch (err) {
      console.error(err);
    }
  };



  // Create / Update Event Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmittingForm(true);

    const body = {
      title,
      slug: slug.trim() || undefined,
      preset,
      passcode: usePasscode && passcode.trim() ? passcode.trim() : null,
      isPrivate,
      date: date || null,
      eventType,
      sessionDays: parseInt(sessionDays) || 7,
      closesAt: closesAt || null,
      bypassEnabled,
      showVerifiedBadge,
      guestNameRegistration
    };

    try {
      const url = editingId ? `/api/admin/events/${editingId}` : '/api/admin/events';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Server error occurred');
      }

      setFormSuccess(editingId ? 'Event updated successfully!' : 'Event created successfully!');

      // If template/creation had initial tag count configured, generate them
      if (!editingId && initialTagCount > 0) {
        try {
          await fetch(`/api/admin/events/${data.id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: initialTagCount })
          });
        } catch (err) {
          console.error("Initial tag generation failed:", err);
        }
      }
      
      // Clear form
      resetForm();
      fetchEvents();

      setTimeout(() => setFormSuccess(''), 4000);

    } catch (err) {
      setFormError(err.message || 'Processing failed.');
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleTemplateChange = (val) => {
    setTemplate(val);
    setEventType(val);
    if (val === 'birthday') {
      setPreset('35mm-natural');
      setIsPrivate(true);
      setPasscode('2121');
      setSessionDays(7);
      setBypassEnabled(true);
      setShowVerifiedBadge(true);
      setGuestNameRegistration(true);
      setInitialTagCount(30);
    } else if (val === 'wedding') {
      setPreset('cinematic-portrait');
      setIsPrivate(true);
      setPasscode('7777');
      setSessionDays(14);
      setBypassEnabled(true);
      setShowVerifiedBadge(true);
      setGuestNameRegistration(true);
      setInitialTagCount(100);
    } else if (val === 'corporate') {
      setPreset('pristine-digital');
      setIsPrivate(true);
      setPasscode('9999');
      setSessionDays(3);
      setBypassEnabled(false);
      setShowVerifiedBadge(false);
      setGuestNameRegistration(true);
      setInitialTagCount(150);
    } else if (val === 'custom') {
      setPreset('35mm-natural');
      setIsPrivate(true);
      setPasscode('');
      setSessionDays(7);
      setBypassEnabled(true);
      setShowVerifiedBadge(true);
      setGuestNameRegistration(true);
      setInitialTagCount(30);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTemplate('custom');
    setEventType('custom');
    setTitle('');
    setSlug('');
    setPreset('35mm-natural');
    setPasscode('');
    setIsPrivate(true);
    setDate('');
    setSessionDays(7);
    setClosesAt('');
    setBypassEnabled(true);
    setShowVerifiedBadge(true);
    setGuestNameRegistration(true);
    setInitialTagCount(30);
    setUsePasscode(false);
    setFormError('');
  };

  const startEdit = (ev) => {
    setEditingId(ev.id);
    setTitle(ev.title);
    setSlug(ev.slug);
    setPreset(ev.preset);
    setPasscode(ev.passcode || '');
    setIsPrivate(ev.isPrivate === 1);
    
    // New fields
    setEventType(ev.eventType || 'custom');
    setTemplate(ev.eventType || 'custom');
    setDate(ev.date || '');
    setSessionDays(ev.sessionDays !== undefined ? ev.sessionDays : 7);
    setClosesAt(ev.closesAt || '');
    setBypassEnabled(ev.bypassEnabled === 1);
    setShowVerifiedBadge(ev.showVerifiedBadge === 1);
    setGuestNameRegistration(ev.guestNameRegistration === 1);
    setUsePasscode(!!ev.passcode);
    
    // Smooth scroll up to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEvent = async (id, titleStr) => {
    if (!window.confirm(`Are you absolutely sure you want to delete "${titleStr}"?\nAll associated uploads and NFC tag codes will be permanently destroyed.`)) return;

    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEvents();
        if (selectedEventForTags?.id === id) setSelectedEventForTags(null);
        if (selectedEventForMod?.id === id) setSelectedEventForMod(null);
      }
    } catch {
      alert('Delete failed.');
    }
  };

  // Manage NFC tag functions
  const openTagsManager = async (ev) => {
    setSelectedEventForTags(ev);
    setTagsLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${ev.id}/tags`);
      if (res.ok) {
        const data = await res.json();
        setTags(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTagsLoading(false);
    }
  };

  const generateTags = async () => {
    if (!selectedEventForTags) return;
    try {
      const res = await fetch(`/api/admin/events/${selectedEventForTags.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: generateCount })
      });
      if (res.ok) {
        // reload tags
        openTagsManager(selectedEventForTags);
        setGenerateCount(1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTagStatus = async (tag) => {
    try {
      const res = await fetch(`/api/admin/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: tag.active === 0 })
      });
      if (res.ok) {
        openTagsManager(selectedEventForTags);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Moderation Gallery functions
  const openModerationGallery = async (ev) => {
    setSelectedEventForMod(ev);
    setModLoading(true);
    try {
      const res = await fetch(`/api/events/${ev.slug}/uploads`);
      if (res.ok) {
        const data = await res.json();
        setModUploads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setModLoading(false);
    }
  };

  const handleDeleteUpload = async (uploadId) => {
    if (!window.confirm('Delete this upload permanently? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/uploads/${uploadId}`, { method: 'DELETE' });
      if (res.ok) {
        setModUploads(prev => prev.filter(up => up.id !== uploadId));
        // refresh main event list count
        fetchEvents();
      }
    } catch {
      alert('Delete upload failed.');
    }
  };

  // Helper to trigger direct SVG QR code downloads
  const downloadQRCode = (tagCode, eventSlug) => {
    const svg = document.getElementById(`qr-${tagCode}`);
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      const a = document.createElement("a");
      a.download = `nfc-album-${eventSlug}-${tagCode}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Export bulk CSV of all tags
  const downloadTagsCSV = (tagsList, ev) => {
    if (!tagsList || tagsList.length === 0) {
      alert("No tag keys exist to export!");
      return;
    }
    const headers = ['Tag Code', 'Write URL', 'Guest Name', 'Created At'];
    const rows = tagsList.map(tag => [
      tag.tagCode,
      `${window.location.origin}/e/${ev.slug}?t=${tag.tagCode}`,
      tag.guestName || '',
      tag.createdAt
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nfc-tags-${ev.slug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print multi-up sheet of QR code labels (Avery 5160)
  const printAverySheet = (tagsList, ev) => {
    if (!tagsList || tagsList.length === 0) {
      alert("No tag keys exist to print!");
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup blocked. Please enable popups to print labels.');
      return;
    }

    const labelHtml = tagsList.map(tag => {
      const svg = document.getElementById(`qr-${tag.tagCode}`);
      let qrDataUrl = '';
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        qrDataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
      }
      return `
        <div class="avery-label">
          <div class="label-content">
            <img src="${qrDataUrl}" class="qr-img" />
            <div class="label-details">
              <div class="label-header">TAP KEYRING</div>
              <div class="label-subheader">OR SCAN BACK</div>
              <div class="tag-code">KEY: ${tag.tagCode}</div>
              <div class="instructions">No tap? Scan back or use passcode</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Labels - ${ev.title}</title>
          <style>
            @page {
              size: letter;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background-color: white;
              color: black;
            }
            /* Avery 5160 Layout (3 columns, 10 rows) */
            .sheet {
              width: 8.5in;
              height: 11in;
              box-sizing: border-box;
              padding-top: 0.5in;
              padding-left: 0.219in;
              padding-right: 0.219in;
              display: grid;
              grid-template-columns: 2.625in 2.625in 2.625in;
              grid-column-gap: 0.14in;
              grid-row-gap: 0;
              justify-content: start;
              align-content: start;
            }
            .avery-label {
              width: 2.625in;
              height: 1in;
              box-sizing: border-box;
              padding: 0.08in 0.1in;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px dashed #eee;
            }
            @media print {
              .avery-label {
                border: 1px solid transparent;
              }
            }
            .label-content {
              display: flex;
              align-items: center;
              width: 100%;
              height: 100%;
              gap: 0.1in;
            }
            .qr-img {
              width: 0.82in;
              height: 0.82in;
              flex-shrink: 0;
            }
            .label-details {
              display: flex;
              flex-direction: column;
              justify-content: center;
              min-width: 0;
              flex-grow: 1;
            }
            .label-header {
              font-size: 10px;
              font-weight: 800;
              letter-spacing: 0.5px;
              color: #b48a04;
              text-transform: uppercase;
            }
            .label-subheader {
              font-size: 8px;
              font-weight: 600;
              color: #111;
              margin-top: 1px;
            }
            .tag-code {
              font-family: monospace;
              font-size: 9px;
              font-weight: 700;
              background: #f0f0f0;
              padding: 1px 3px;
              border-radius: 3px;
              display: inline-block;
              margin-top: 3px;
              align-self: start;
            }
            .instructions {
              font-size: 6px;
              color: #555;
              margin-top: 4px;
              line-height: 1.1;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${labelHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };



  // -------------------------------------------------------------
  // SECURE SHIELD: PASSWORD SIGN IN SCREEN
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-screen">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
        
        <div className="glass-premium p-8 rounded-3xl max-w-sm w-full relative z-10 border border-white/10 text-center select-none shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6 text-amber-500">
            <Key className="w-6 h-6 stroke-[1.5]" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Admin Cockpit</h2>
          <p className="text-zinc-500 text-xs font-light mb-6">
            Secure gateway portal to configure events, generate NFC keys, and moderate image uploads.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter Access Key"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-center py-3 px-4 rounded-xl glass-input placeholder:text-zinc-700 text-sm tracking-[0.1em] text-white"
                required
              />
            </div>

            {loginError && (
              <p className="text-rose-400 text-xs flex items-center justify-center gap-1.5 font-light">
                <AlertCircle className="w-3.5 h-3.5" />
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl shadow-lg transition-all active:scale-98 disabled:opacity-50 text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              {loginLoading ? 'Verifying...' : 'DECRYPT GATEWAY'}
            </button>
          </form>

          <button 
            onClick={() => navigate('/')} 
            className="text-zinc-500 hover:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mt-6 block mx-auto active:scale-95 transition-all"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULLY AUTHENTICATED BOARD PANEL
  // -------------------------------------------------------------
  
  // Calculate aggregate stats
  const totalEvents = events.length;
  const totalUploads = events.reduce((acc, ev) => acc + (ev.totalUploads || 0), 0);
  const totalTags = events.reduce((acc, ev) => acc + (ev.totalTags || 0), 0);

  return (
    <div className="flex-1 flex flex-col p-6 md:p-10 max-w-7xl mx-auto w-full select-none">
      {/* Dashboard Top Header Bar */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🛠️</span>
            <span className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">
              AGGREGATED MEMORY MANAGEMENT
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
            Dashboard Panel
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="glass hover:bg-white/5 text-zinc-400 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wider transition-all flex items-center gap-2 border border-white/5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            VIEW GUEST PORTAL
          </button>
          <button
            onClick={handleLogout}
            className="bg-rose-950/40 hover:bg-rose-950/60 text-rose-300 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wider transition-all flex items-center gap-2 border border-rose-900/30 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            SIGN OUT
          </button>
        </div>
      </header>

      {/* Aggregate Stat Grid */}
      <section className="grid grid-cols-3 gap-4 my-8 shrink-0">
        <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Active Albums</span>
            <span className="text-2xl font-black text-white">{totalEvents}</span>
          </div>
        </div>
        
        <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Uploaded Cache</span>
            <span className="text-2xl font-black text-white">{totalUploads}</span>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">NFC Keyrings</span>
            <span className="text-2xl font-black text-white">{totalTags}</span>
          </div>
        </div>
      </section>

      {/* Dashboard Dual Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Create / Edit Event Form */}
        <section className="lg:col-span-5 glass-premium p-6 rounded-3xl border border-white/15">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold tracking-wider text-zinc-100 uppercase">
              {editingId ? 'Modify Event Space' : 'New Event Space'}
            </h3>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* SECTION 1: IDENTITY */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold font-mono">1</span>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Identity</h4>
              </div>

              {!editingId && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    EVENT TEMPLATE PRESET
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'custom', label: '✨ Custom' },
                      { value: 'birthday', label: '🎂 Birthday' },
                      { value: 'wedding', label: '💍 Wedding' },
                      { value: 'corporate', label: '💼 Corporate' }
                    ].map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => handleTemplateChange(t.value)}
                        className={`py-2 px-3 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                          template === t.value 
                            ? 'border-amber-500 bg-amber-500/10 text-white font-bold' 
                            : 'border-white/5 bg-zinc-950/20 text-zinc-400 hover:bg-zinc-950/40'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  EVENT TITLE *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mere & Wiremu Wedding"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!editingId) {
                      setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                    }
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl text-sm text-white glass-input font-light placeholder:text-zinc-600"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  ALBUM SLUG / CODE (URL SAFE)
                </label>
                <input
                  type="text"
                  placeholder="e.g. wedding-2026"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                  className="w-full py-2.5 px-3.5 rounded-xl text-sm text-white glass-input font-light placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  EVENT DATE
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl text-sm text-white glass-input font-light placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* SECTION 2: ACCESS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold font-mono">2</span>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Access Control</h4>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <div>
                  <span className="block text-xs font-semibold text-zinc-300">Private Album Only</span>
                  <span className="text-[10px] text-zinc-500 font-light">Requires NFC scan or Passcode</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className="text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  {isPrivate ? (
                    <ToggleRight className="w-9 h-9 text-amber-500 fill-amber-500/20" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-zinc-600" />
                  )}
                </button>
              </div>

              {isPrivate && (
                <>
                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="block text-xs font-semibold text-zinc-300">Passcode Fallback</span>
                      <span className="text-[10px] text-zinc-500 font-light">Allow entry via manual passcode</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !usePasscode;
                        setUsePasscode(nextState);
                        if (!nextState) setPasscode('');
                        else if (!passcode) setPasscode('1234');
                      }}
                      className="text-zinc-400 hover:text-white transition-all cursor-pointer"
                    >
                      {usePasscode ? (
                        <ToggleRight className="w-9 h-9 text-amber-500 fill-amber-500/20" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-zinc-600" />
                      )}
                    </button>
                  </div>

                  {usePasscode && (
                    <div className="space-y-3 p-3 bg-zinc-950/40 border border-white/5 rounded-2xl">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">
                        Configure 4-Digit Passcode
                      </label>
                      <PasscodeInput passcode={passcode} setPasscode={setPasscode} />
                    </div>
                  )}
                </>
              )}

              <div>
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  <span>SESSION COOKIE LIFESPAN</span>
                  <span className="text-amber-500 font-mono">{sessionDays} days</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={sessionDays}
                  onChange={(e) => setSessionDays(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  UPLOAD WINDOW CLOSES (DATE & TIME)
                </label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl text-sm text-white glass-input font-light"
                />
              </div>
            </div>

            {/* SECTION 3: AESTHETIC PRESET */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold font-mono">3</span>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Aesthetic Preset</h4>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: '35mm-natural', label: '35mm Negative', description: 'Warm vintage film tones, soft skin rendering, classic grain.', color: 'from-amber-600 to-orange-700' },
                  { value: '35mm-flash', label: 'Night-Flash', description: 'Raw party flash, high contrast, slight vignette, retro vibes.', color: 'from-blue-600 to-indigo-700' },
                  { value: 'pristine-digital', label: 'Pristine Digital', description: 'Modern digital sharpness, crisp details, natural colors.', color: 'from-emerald-600 to-teal-700' },
                  { value: 'cinematic-portrait', label: 'Cinematic Portrait', description: 'Moody cinematic shadow depth, muted highlights, dramatic look.', color: 'from-purple-600 to-pink-700' }
                ].map((p) => {
                  const isSelected = preset === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPreset(p.value)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between h-28 transition-all cursor-pointer relative overflow-hidden select-none ${
                        isSelected 
                          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500' 
                          : 'border-white/5 bg-zinc-950/40 hover:bg-zinc-950/60'
                      }`}
                    >
                      <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${p.color} opacity-20 blur-md rounded-full`} />
                      <div>
                        <span className="block text-xs font-bold text-white mb-1">{p.label}</span>
                        <span className="block text-[9px] text-zinc-500 leading-snug font-light">{p.description}</span>
                      </div>
                      {isSelected && (
                        <span className="self-end bg-amber-500 text-black p-0.5 rounded-full z-10">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 4: NFC TAGS & BEHAVIOR */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold font-mono">4</span>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">NFC & Guest Settings</h4>
              </div>

              {!editingId && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    SUGGESTED KEYRINGS TO GENERATE
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={initialTagCount}
                    onChange={(e) => setInitialTagCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full py-2.5 px-3.5 rounded-xl text-sm text-white glass-input font-light placeholder:text-zinc-600"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-300">NFC Bypass Passcode</span>
                    <span className="text-[10px] text-zinc-500 font-light">Tag scans automatically authorize</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBypassEnabled(!bypassEnabled)}
                    className="text-zinc-400 hover:text-white transition-all cursor-pointer"
                  >
                    {bypassEnabled ? (
                      <ToggleRight className="w-9 h-9 text-amber-500 fill-amber-500/20" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-zinc-600" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-300">Show Verified Badge</span>
                    <span className="text-[10px] text-zinc-500 font-light">Show "NFC Verified" on gallery snaps</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVerifiedBadge(!showVerifiedBadge)}
                    className="text-zinc-400 hover:text-white transition-all cursor-pointer"
                  >
                    {showVerifiedBadge ? (
                      <ToggleRight className="w-9 h-9 text-amber-500 fill-amber-500/20" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-zinc-600" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-300">Guest Name Registration</span>
                    <span className="text-[10px] text-zinc-500 font-light">Prompt for guest name on tag scan</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuestNameRegistration(!guestNameRegistration)}
                    className="text-zinc-400 hover:text-white transition-all cursor-pointer"
                  >
                    {guestNameRegistration ? (
                      <ToggleRight className="w-9 h-9 text-amber-500 fill-amber-500/20" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-zinc-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/50 text-rose-400 rounded-xl text-xs flex items-center gap-2 font-light">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 text-emerald-400 rounded-xl text-xs flex items-center gap-2 font-light">
                <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 glass hover:bg-white/5 text-zinc-400 font-semibold py-2.5 rounded-xl text-xs tracking-wider active:scale-95 transition-all cursor-pointer"
                >
                  CANCEL
                </button>
              )}
              <button
                type="submit"
                disabled={submittingForm}
                className="flex-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl text-xs tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {editingId ? 'SAVE CHANGES' : 'CREATE SPACE'}
              </button>
            </div>
          </form>
        </section>

        {/* Right Side: Active Events List Grid */}
        <section className="lg:col-span-7 space-y-6">
          
          {/* Main events table list */}
          <div className="glass p-6 rounded-3xl border border-white/5">
            <h3 className="text-sm font-bold tracking-wider text-zinc-300 uppercase mb-5">
              Active Memory Spaces ({events.length})
            </h3>

            {loadingEvents ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                Retrieving registry...
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs leading-relaxed font-light">
                No active memory spaces configured. Set up your first event!
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((ev) => (
                  <div 
                    key={ev.id}
                    className="p-4 rounded-2xl glass hover:bg-white/[0.02] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                  >
                    {/* Event summary info */}
                    <div className="flex items-center gap-4">
                      <img
                        src={ev.coverImage}
                        alt="cover thumbnail"
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10"
                      />
                      <div>
                        <h4 className="font-bold text-white text-base leading-snug">
                          {ev.title}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium mt-1">
                          <span className="text-amber-500">/e/{ev.slug}</span>
                          <span>•</span>
                          <span className="text-zinc-400 capitalize">{ev.preset}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {ev.totalUploads} snaps
                          </span>
                        </div>

                        {/* Cover Image Editor */}
                        {editingCoverId === ev.id ? (
                          <div className="flex items-center gap-2 mt-2 w-full max-w-sm">
                            <input
                              type="url"
                              value={tempCoverUrl}
                              onChange={(e) => setTempCoverUrl(e.target.value)}
                              placeholder="Cover Image URL"
                              className="flex-1 py-1 px-2.5 rounded-lg text-xs text-white glass-input font-light outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCover(ev.id, tempCoverUrl)}
                              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-bold transition-all cursor-pointer"
                            >
                              SAVE
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCoverId(null)}
                              className="px-2 py-1 rounded glass text-zinc-400 text-[9px] font-bold transition-all cursor-pointer"
                            >
                              CANCEL
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCoverId(ev.id);
                              setTempCoverUrl(ev.coverImage || '');
                            }}
                            className="text-[9px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 mt-1.5 font-medium underline transition-all cursor-pointer"
                          >
                            Change Cover Image URL
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Operational control buttons */}
                    <div className="flex flex-wrap items-center gap-2 md:self-center">
                      <button
                        onClick={() => openTagsManager(ev)}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
                          selectedEventForTags?.id === ev.id
                            ? 'bg-amber-500 border-amber-500 text-black'
                            : 'glass border-white/5 text-zinc-300 hover:bg-white/5'
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        TAGS ({ev.totalTags})
                      </button>

                      <button
                        onClick={() => openModerationGallery(ev)}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
                          selectedEventForMod?.id === ev.id
                            ? 'bg-violet-600 border-violet-600 text-white'
                            : 'glass border-white/5 text-zinc-300 hover:bg-white/5'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        MODERATE
                      </button>

                      <button
                        onClick={() => startEdit(ev)}
                        className="px-3 py-1.5 rounded-lg glass border-white/5 text-zinc-300 hover:bg-white/5 text-[10px] font-bold tracking-wider"
                      >
                        EDIT
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(ev.id, ev.title)}
                        className="p-1.5 rounded-lg glass border-white/5 text-rose-400 hover:bg-rose-950/20 hover:border-rose-900/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Sub-panel: NFC Tags Keys Manager */}
          {selectedEventForTags && (
            <div className="glass-premium p-6 rounded-3xl border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
                <div>
                  <span className="text-[10px] uppercase text-amber-500 font-bold tracking-widest block">
                    NFC LINKING PROTOCOL
                  </span>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Manage Tags: {selectedEventForTags.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEventForTags(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-400 font-semibold"
                >
                  CLOSE
                </button>
              </div>

              {/* Batch Prep Operations */}
              <div className="grid grid-cols-2 gap-3 mb-6 pb-4 border-b border-white/5">
                <button
                  onClick={() => downloadTagsCSV(tags, selectedEventForTags)}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  EXPORT BULK CSV
                </button>
                <button
                  onClick={() => printAverySheet(tags, selectedEventForTags)}
                  className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Tag className="w-4 h-4" />
                  PRINT AVERY SHEET
                </button>
              </div>

              {/* Generate new tags controller */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl glass border-white/5 bg-white/[0.01] mb-6">
                <div className="flex-1">
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                    KEY GENERATOR COUNT
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={generateCount}
                    onChange={(e) => setGenerateCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full py-1.5 px-3 rounded-lg glass-input text-sm text-white"
                  />
                </div>
                <button
                  onClick={generateTags}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold h-11 px-5 rounded-xl text-xs tracking-wider active:scale-95 transition-all mt-4 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  GENERATE NFC KEYS
                </button>
              </div>

              {/* NFC Tags table list */}
              {tagsLoading ? (
                <div className="text-center text-xs text-zinc-500 py-6">Loading NFC database...</div>
              ) : tags.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 py-6 font-light">
                  No NFC tag keys generated for this event yet. Create them above!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1">
                  {tags.map((tag) => {
                    const hostUrl = window.location.origin;
                    const tagUrl = `${hostUrl}/e/${selectedEventForTags.slug}?t=${tag.tagCode}`;
                    
                    return (
                      <div 
                        key={tag.id}
                        className="p-3.5 rounded-xl glass border border-white/5 flex items-start justify-between gap-3 bg-zinc-950/40 hover:bg-zinc-950/70 transition-all"
                      >
                        <div className="space-y-2.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="font-mono text-xs font-bold text-white tracking-wide shrink-0">
                              KEY: {tag.tagCode}
                            </span>
                          </div>
                          
                          {/* Scalable crisp QR Code (Hidden from display view, loaded as a canvas template) */}
                          <div className="hidden">
                            <QRCodeSVG
                              id={`qr-${tag.tagCode}`}
                              value={tagUrl}
                              size={256}
                              level="H"
                              includeMargin={true}
                            />
                          </div>

                          <div className="text-[10px] text-zinc-500 flex flex-col gap-1 min-w-0">
                            <span className="truncate block select-all font-light" title={tagUrl}>
                              {tagUrl}
                            </span>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => downloadQRCode(tag.tagCode, selectedEventForTags.slug)}
                              className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[9px] font-bold tracking-widest uppercase flex items-center gap-1"
                            >
                              <Download className="w-2.5 h-2.5" />
                              PRINT QR
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tagUrl);
                                alert('Tap Link copied to clipboard!');
                              }}
                              className="px-2.5 py-1 rounded glass border-white/5 text-zinc-400 hover:text-white text-[9px] font-bold tracking-widest uppercase"
                            >
                              COPY URL
                            </button>
                          </div>
                        </div>

                        {/* Status switcher */}
                        <button
                          onClick={() => toggleTagStatus(tag)}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wider transition-all uppercase ${
                            tag.active === 1
                              ? 'bg-emerald-950/40 border border-emerald-900/30 text-emerald-400'
                              : 'bg-zinc-800 border border-white/5 text-zinc-500'
                          }`}
                        >
                          {tag.active === 1 ? 'Active' : 'Disabled'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Sub-panel: Content Moderation Grid */}
          {selectedEventForMod && (
            <div className="glass-premium p-6 rounded-3xl border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
                <div>
                  <span className="text-[10px] uppercase text-violet-400 font-bold tracking-widest block">
                    CONTENT MODERATION SHIELD
                  </span>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Moderate Snapshots: {selectedEventForMod.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEventForMod(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-400 font-semibold"
                >
                  CLOSE
                </button>
              </div>

              {modLoading ? (
                <div className="text-center text-xs text-zinc-500 py-6">Scanning media assets...</div>
              ) : modUploads.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 py-6 font-light">
                  No snapshots uploaded to this event yet.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-1">
                  {modUploads.map((up) => (
                    <div 
                      key={up.id}
                      className="group relative rounded-xl overflow-hidden glass border border-white/5 aspect-square bg-zinc-950"
                    >
                      {selectedEventForMod.preset !== 'pristine-digital' && selectedEventForMod.preset !== 'cinematic-portrait' && (
                        <div className="absolute inset-0 z-10 pointer-events-none film-grain" />
                      )}
                      <img
                        src={up.thumbnailUrl}
                        alt="Mod preview"
                        className={`w-full h-full object-cover filter-${selectedEventForMod.preset}`}
                      />
                      
                      {/* Name overlay */}
                      <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] text-zinc-400 max-w-[80px] truncate border border-white/5 font-medium z-10">
                        {up.uploaderName || 'Guest'}
                      </span>

                      {/* Delete moderation trigger */}
                      <button
                        onClick={() => handleDeleteUpload(up.id)}
                        className="absolute top-2 right-2 bg-rose-950/80 hover:bg-rose-950/100 backdrop-blur-md p-1.5 rounded-lg border border-rose-900/50 text-rose-400 hover:text-rose-300 z-20"
                        title="Delete snapshot from database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </section>
      </div>
    </div>
  );
}

export default AdminDashboard;
