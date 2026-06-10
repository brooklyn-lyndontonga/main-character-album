require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const { uploadFile, deleteFile } = require('./cloudinary');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminton';

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve local uploads folder statically from the persistent database volume
const dbDir = process.env.DATABASE_DIR || __dirname;
const uploadsDir = path.join(dbDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer in-memory storage for handling upload buffers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Admin Auth Middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }
};

// Generate custom unique NFC tag codes (7 chars, e.g. E9B2FD8) avoiding confusable characters (O, I, 0, 1)
const generateTagCode = () => {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
};

// -------------------------------------------------------------
// PUBLIC ROUTES
// -------------------------------------------------------------

/**
 * GET /api/events/:slug
 * Retrieves details for a specific event. Validates NFC tag codes or passcode cookies if private.
 */
app.get('/api/events/:slug', (req, res) => {
  const { slug } = req.params;
  const { t: tagCode } = req.query;

  try {
    const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    let scannedTag = null;
    const cookieAge = (event.sessionDays || 7) * 24 * 60 * 60 * 1000;

    // Check if album requires verification
    if (event.isPrivate === 1) {
      let authorized = false;

      // 1. Check if a valid tagCode is supplied
      if (tagCode) {
        const tag = db.prepare('SELECT * FROM nfc_tags WHERE eventId = ? AND tagCode = ? AND active = 1').get(event.id, tagCode);
        if (tag) {
          scannedTag = tag;
          // Set tag code cookie
          res.cookie(`nfc_tag_code_${slug}`, tagCode, {
            maxAge: cookieAge,
            httpOnly: false,
            sameSite: 'lax'
          });

          // Respect the bypassEnabled database flag: if 1, automatically authorize
          if (event.bypassEnabled === 1) {
            authorized = true;
            // Set authorization cookie for this album
            res.cookie(`album_auth_${slug}`, 'true', {
              maxAge: cookieAge,
              httpOnly: false, // Accessible by frontend React
              sameSite: 'lax'
            });
          }
        }
      }

      // 2. Check if user already holds authorization cookie
      if (!authorized && req.cookies[`album_auth_${slug}`] === 'true') {
        authorized = true;
        // Try to read tag from cookie if it's there
        const cookieTagCode = req.cookies[`nfc_tag_code_${slug}`];
        if (cookieTagCode) {
          const tag = db.prepare('SELECT * FROM nfc_tags WHERE eventId = ? AND tagCode = ? AND active = 1').get(event.id, cookieTagCode);
          if (tag) {
            scannedTag = tag;
          }
        }
      }

      if (!authorized) {
        return res.json({
          id: event.id,
          title: event.title,
          slug: event.slug,
          coverImage: event.coverImage,
          preset: event.preset,
          requiresPasscode: true,
          date: event.date,
          eventType: event.eventType,
          closesAt: event.closesAt,
          bypassEnabled: event.bypassEnabled === 1,
          showVerifiedBadge: event.showVerifiedBadge === 1,
          guestNameRegistration: event.guestNameRegistration === 1
        });
      }
    } else {
      // For public events, try to associate tag if scanned or saved
      if (tagCode) {
        const tag = db.prepare('SELECT * FROM nfc_tags WHERE eventId = ? AND tagCode = ? AND active = 1').get(event.id, tagCode);
        if (tag) {
          scannedTag = tag;
          res.cookie(`nfc_tag_code_${slug}`, tagCode, {
            maxAge: cookieAge,
            httpOnly: false,
            sameSite: 'lax'
          });
        }
      } else {
        const cookieTagCode = req.cookies[`nfc_tag_code_${slug}`];
        if (cookieTagCode) {
          const tag = db.prepare('SELECT * FROM nfc_tags WHERE eventId = ? AND tagCode = ? AND active = 1').get(event.id, cookieTagCode);
          if (tag) {
            scannedTag = tag;
          }
        }
      }
    }

    // Return full event details if public or authorized
    res.json({
      id: event.id,
      title: event.title,
      slug: event.slug,
      coverImage: event.coverImage,
      preset: event.preset,
      isPrivate: event.isPrivate === 1,
      createdAt: event.createdAt,
      requiresPasscode: false,
      date: event.date,
      eventType: event.eventType,
      sessionDays: event.sessionDays,
      closesAt: event.closesAt,
      bypassEnabled: event.bypassEnabled === 1,
      showVerifiedBadge: event.showVerifiedBadge === 1,
      guestNameRegistration: event.guestNameRegistration === 1,
      tag: scannedTag ? {
        tagCode: scannedTag.tagCode,
        guestName: scannedTag.guestName || null
      } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed.' });
  }
});

/**
 * POST /api/events/:slug/verify-passcode
 * Authorizes a guest using a direct passcode entry.
 */
app.post('/api/events/:slug/verify-passcode', (req, res) => {
  const { slug } = req.params;
  const { passcode } = req.body;

  try {
    const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    if (event.passcode === passcode) {
      const cookieAge = (event.sessionDays || 7) * 24 * 60 * 60 * 1000;
      // Set authorization cookie
      res.cookie(`album_auth_${slug}`, 'true', {
        maxAge: cookieAge,
        httpOnly: false,
        sameSite: 'lax'
      });
      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: 'Incorrect passcode.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed.' });
  }
});

/**
 * PUT /api/events/:slug/tags/:tagCode/register
 * Registers a guest name for a specific NFC tag code.
 */
app.put('/api/events/:slug/tags/:tagCode/register', (req, res) => {
  const { slug, tagCode } = req.params;
  const { guestName } = req.body;

  if (!guestName || guestName.trim() === '') {
    return res.status(400).json({ error: 'Guest name is required.' });
  }

  try {
    const event = db.prepare('SELECT id FROM events WHERE slug = ?').get(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const tag = db.prepare('SELECT * FROM nfc_tags WHERE eventId = ? AND tagCode = ? AND active = 1').get(event.id, tagCode);
    if (!tag) {
      return res.status(404).json({ error: 'NFC tag code not found or inactive.' });
    }

    db.prepare('UPDATE nfc_tags SET guestName = ? WHERE id = ?').run(guestName.trim(), tag.id);
    res.json({ success: true, tagCode, guestName: guestName.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update failed.' });
  }
});

/**
 * GET /api/events/:slug/uploads
 * Fetches all uploads for an event.
 */
app.get('/api/events/:slug/uploads', (req, res) => {
  const { slug } = req.params;

  try {
    const event = db.prepare('SELECT id, isPrivate FROM events WHERE slug = ?').get(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Double check auth for private event gallery
    if (event.isPrivate === 1 && req.cookies[`album_auth_${slug}`] !== 'true') {
      return res.status(403).json({ error: 'Unauthorized gallery access.' });
    }

    const uploads = db.prepare(`
      SELECT u.*, t.guestName as tagGuestName
      FROM uploads u
      LEFT JOIN nfc_tags t ON u.tagCode = t.tagCode AND u.eventId = t.eventId
      WHERE u.eventId = ?
      ORDER BY u.createdAt DESC
    `).all(event.id);
    res.json(uploads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve uploads.' });
  }
});

/**
 * POST /api/events/:slug/upload
 * Handles uploader files, applying aesthetic preset on-the-fly.
 */
app.post('/api/events/:slug/upload', upload.single('file'), async (req, res) => {
  const { slug } = req.params;
  const { uploaderName, caption, tagCode } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const event = db.prepare('SELECT id, preset, isPrivate, closesAt FROM events WHERE slug = ?').get(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Check if upload window has closed
    if (event.closesAt) {
      const closesAtDate = new Date(event.closesAt);
      if (closesAtDate < new Date()) {
        return res.status(403).json({ error: 'The upload window has closed.' });
      }
    }

    // Verify auth
    if (event.isPrivate === 1 && req.cookies[`album_auth_${slug}`] !== 'true') {
      return res.status(403).json({ error: 'Unauthorized upload attempt.' });
    }

    // Process file (uploads to Cloudinary with preset filters or writes to disk as fallback)
    const uploadResult = await uploadFile(req.file, event.preset);

    const uploadId = uuidv4();
    const insertUpload = db.prepare(`
      INSERT INTO uploads (id, eventId, uploaderName, caption, imageUrl, thumbnailUrl, tagCode, type, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const fileType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    insertUpload.run(
      uploadId,
      event.id,
      uploaderName || 'Anonymous Guest',
      caption || '',
      uploadResult.imageUrl,
      uploadResult.thumbnailUrl,
      tagCode || null,
      fileType,
      new Date().toISOString()
    );

    const fullUpload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(uploadId);
    res.status(201).json(fullUpload);
  } catch (err) {
    console.error('Upload handling error:', err);
    res.status(500).json({ error: 'Upload processing failed.' });
  }
});

// -------------------------------------------------------------
// ADMIN AUTHENTICATION
// -------------------------------------------------------------

/**
 * POST /api/admin/login
 * Standard simple admin credentials verification.
 */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('admin_token', token, {
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      httpOnly: true,
      secure: false, // true in production with HTTPS
      sameSite: 'lax'
    });
    return res.json({ success: true });
  } else {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
});

/**
 * POST /api/admin/logout
 * Clears cookies.
 */
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

/**
 * GET /api/admin/verify
 * Validates admin cookie.
 */
app.get('/api/admin/verify', (req, res) => {
  const token = req.cookies.admin_token;
  if (!token) return res.json({ admin: false });

  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ admin: true });
  } catch (err) {
    res.json({ admin: false });
  }
});

// -------------------------------------------------------------
// PROTECTED ADMIN ROUTES
// -------------------------------------------------------------

/**
 * GET /api/admin/events
 * Lists all events.
 */
app.get('/api/admin/events', authenticateAdmin, (req, res) => {
  try {
    const events = db.prepare(`
      SELECT e.*, 
        (SELECT COUNT(*) FROM uploads WHERE eventId = e.id) as totalUploads,
        (SELECT COUNT(*) FROM nfc_tags WHERE eventId = e.id) as totalTags
      FROM events e 
      ORDER BY e.createdAt DESC
    `).all();
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed.' });
  }
});

/**
 * POST /api/admin/events
 * Creates a new event.
 */
app.post('/api/admin/events', authenticateAdmin, (req, res) => {
  const { 
    title, slug, preset, passcode, isPrivate,
    date, eventType, sessionDays, closesAt,
    bypassEnabled, showVerifiedBadge, guestNameRegistration 
  } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const cleanSlug = (slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).trim();
  const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop';

  try {
    // Check if slug is unique
    const existing = db.prepare('SELECT id FROM events WHERE slug = ?').get(cleanSlug);
    if (existing) {
      return res.status(400).json({ error: `Event with slug '${cleanSlug}' already exists.` });
    }

    const eventId = uuidv4();
    const insertEvent = db.prepare(`
      INSERT INTO events (
        id, title, slug, coverImage, preset, passcode, isPrivate, createdAt,
        date, eventType, sessionDays, closesAt, bypassEnabled, showVerifiedBadge, guestNameRegistration
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const isPrivateVal = (isPrivate === false || isPrivate === 0 || isPrivate === 'false') ? 0 : 1;
    const bypassEnabledVal = (bypassEnabled === false || bypassEnabled === 0 || bypassEnabled === 'false') ? 0 : 1;
    const showVerifiedBadgeVal = (showVerifiedBadge === false || showVerifiedBadge === 0 || showVerifiedBadge === 'false') ? 0 : 1;
    const guestNameRegistrationVal = (guestNameRegistration === false || guestNameRegistration === 0 || guestNameRegistration === 'false') ? 0 : 1;

    insertEvent.run(
      eventId,
      title,
      cleanSlug,
      defaultCover,
      preset || '35mm-natural',
      passcode || null,
      isPrivateVal,
      new Date().toISOString(),
      date || null,
      eventType || 'custom',
      sessionDays !== undefined ? parseInt(sessionDays) : 7,
      closesAt || null,
      bypassEnabledVal,
      showVerifiedBadgeVal,
      guestNameRegistrationVal
    );

    const createdEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    res.status(201).json(createdEvent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

/**
 * PUT /api/admin/events/:id
 * Updates an event.
 */
app.put('/api/admin/events/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { 
    title, slug, coverImage, preset, passcode, isPrivate,
    date, eventType, sessionDays, closesAt,
    bypassEnabled, showVerifiedBadge, guestNameRegistration 
  } = req.body;

  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const cleanSlug = slug ? slug.trim() : event.slug;
    
    // Check slug uniqueness if it is changing
    if (cleanSlug !== event.slug) {
      const existing = db.prepare('SELECT id FROM events WHERE slug = ?').get(cleanSlug);
      if (existing) {
        return res.status(400).json({ error: `Event with slug '${cleanSlug}' already exists.` });
      }
    }

    const updateEvent = db.prepare(`
      UPDATE events 
      SET title = ?, slug = ?, coverImage = ?, preset = ?, passcode = ?, isPrivate = ?,
          date = ?, eventType = ?, sessionDays = ?, closesAt = ?, 
          bypassEnabled = ?, showVerifiedBadge = ?, guestNameRegistration = ?
      WHERE id = ?
    `);

    const isPrivateVal = isPrivate !== undefined 
      ? ((isPrivate === false || isPrivate === 0 || isPrivate === 'false') ? 0 : 1)
      : event.isPrivate;
    const bypassEnabledVal = bypassEnabled !== undefined 
      ? ((bypassEnabled === false || bypassEnabled === 0 || bypassEnabled === 'false') ? 0 : 1)
      : event.bypassEnabled;
    const showVerifiedBadgeVal = showVerifiedBadge !== undefined 
      ? ((showVerifiedBadge === false || showVerifiedBadge === 0 || showVerifiedBadge === 'false') ? 0 : 1)
      : event.showVerifiedBadge;
    const guestNameRegistrationVal = guestNameRegistration !== undefined 
      ? ((guestNameRegistration === false || guestNameRegistration === 0 || guestNameRegistration === 'false') ? 0 : 1)
      : event.guestNameRegistration;

    updateEvent.run(
      title || event.title,
      cleanSlug,
      coverImage !== undefined ? coverImage : event.coverImage,
      preset || event.preset,
      passcode !== undefined ? passcode : event.passcode,
      isPrivateVal,
      date !== undefined ? date : event.date,
      eventType !== undefined ? eventType : event.eventType,
      sessionDays !== undefined ? parseInt(sessionDays) : event.sessionDays,
      closesAt !== undefined ? closesAt : event.closesAt,
      bypassEnabledVal,
      showVerifiedBadgeVal,
      guestNameRegistrationVal,
      id
    );

    // If the preset has changed, update thumbnails and cover image URLs if applicable
    const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    res.json(updatedEvent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event.' });
  }
});

/**
 * DELETE /api/admin/events/:id
 * Deletes an event, its associated tags, and uploads.
 */
app.delete('/api/admin/events/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Delete assets from disk or Cloudinary
    const uploads = db.prepare('SELECT imageUrl FROM uploads WHERE eventId = ?').all(id);
    for (const u of uploads) {
      // Extract publicId/filename
      if (u.imageUrl.includes('/uploads/')) {
        const filename = u.imageUrl.split('/uploads/')[1];
        await deleteFile(filename);
      } else if (u.imageUrl.includes('res.cloudinary.com')) {
        // Parse cloudinary publicId
        const parts = u.imageUrl.split('/upload/');
        if (parts.length === 2) {
          const pathParts = parts[1].split('/');
          // Remove version identifier (if exists) and file extension
          const publicIdWithExtension = pathParts.slice(1).join('/'); // skip version e.g. v1700000000/nfc_event_albums/uuid
          const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
          await deleteFile(publicId);
        }
      }
    }

    // SQLite CASCADE automatically deletes tags and uploads in DB
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

/**
 * POST /api/admin/events/:id/tags
 * Generates brand new NFC tag keys for this event.
 */
app.post('/api/admin/events/:id/tags', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { count } = req.body;

  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const tagsCreated = [];
    const insertTag = db.prepare(`
      INSERT INTO nfc_tags (id, eventId, tagCode, active, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    const generateCount = parseInt(count) || 1;
    for (let i = 0; i < generateCount; i++) {
      const tagId = uuidv4();
      const tagCode = generateTagCode();
      
      insertTag.run(
        tagId,
        id,
        tagCode,
        1, // active
        new Date().toISOString()
      );

      tagsCreated.push({ id: tagId, tagCode });
    }

    res.status(201).json(tagsCreated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate tag codes.' });
  }
});

/**
 * GET /api/admin/events/:id/tags
 * Lists all tags for an event.
 */
app.get('/api/admin/events/:id/tags', authenticateAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const tags = db.prepare('SELECT * FROM nfc_tags WHERE eventId = ? ORDER BY createdAt DESC').all(id);
    res.json(tags);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tags.' });
  }
});

/**
 * PUT /api/admin/tags/:tagId
 * Enables/disables a specific tag.
 */
app.put('/api/admin/tags/:tagId', authenticateAdmin, (req, res) => {
  const { tagId } = req.params;
  const { active } = req.body;

  try {
    const tag = db.prepare('SELECT * FROM nfc_tags WHERE id = ?').get(tagId);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found.' });
    }

    const updateTag = db.prepare('UPDATE nfc_tags SET active = ? WHERE id = ?');
    updateTag.run(active === false ? 0 : 1, tagId);

    const updated = db.prepare('SELECT * FROM nfc_tags WHERE id = ?').get(tagId);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update tag.' });
  }
});

/**
 * DELETE /api/admin/uploads/:uploadId
 * Moderation endpoint: deletes inappropriate uploads.
 */
app.delete('/api/admin/uploads/:uploadId', authenticateAdmin, async (req, res) => {
  const { uploadId } = req.params;

  try {
    const uploadEntry = db.prepare('SELECT imageUrl FROM uploads WHERE id = ?').get(uploadId);
    if (!uploadEntry) {
      return res.status(404).json({ error: 'Upload entry not found.' });
    }

    // Delete from disk or Cloudinary
    if (uploadEntry.imageUrl.includes('/uploads/')) {
      const filename = uploadEntry.imageUrl.split('/uploads/')[1];
      await deleteFile(filename);
    } else if (uploadEntry.imageUrl.includes('res.cloudinary.com')) {
      const parts = uploadEntry.imageUrl.split('/upload/');
      if (parts.length === 2) {
        const pathParts = parts[1].split('/');
        const publicIdWithExtension = pathParts.slice(1).join('/');
        const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
        await deleteFile(publicId);
      }
    }

    db.prepare('DELETE FROM uploads WHERE id = ?').run(uploadId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete upload.' });
  }
});

// Serve static assets from frontend/dist in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log(`Serving static production frontend assets from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 NFC Event Album Backend running on port ${PORT}`);
});
