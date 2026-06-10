const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = process.env.VERCEL 
  ? '/tmp' 
  : (process.env.DATABASE_DIR || __dirname);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'database.json');

class LocalJsonDb {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      events: [],
      uploads: [],
      nfc_tags: []
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(fileContent);
        if (!this.data.events) this.data.events = [];
        if (!this.data.uploads) this.data.uploads = [];
        if (!this.data.nfc_tags) this.data.nfc_tags = [];
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading JSON DB:', err);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving JSON DB:', err);
    }
  }

  exec(sql) {
    // Schema creation or migrations are implicitly supported.
    console.log('JSON DB Schema Exec:', sql.trim().substring(0, 60) + '...');
  }

  pragma(sql) {
    // No-op for pragmas
  }

  prepare(sql) {
    return new PreparedStatement(this, sql);
  }
}

class PreparedStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.trim().replace(/\s+/g, ' ');
  }

  _getParams(args) {
    if (args.length === 1 && Array.isArray(args[0])) {
      return args[0];
    }
    return Array.from(args);
  }

  run(...args) {
    const params = this._getParams(args);
    const sql = this.sql;

    if (sql.startsWith('INSERT INTO events')) {
      const colsMatch = sql.match(/\((.*?)\)/);
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map(s => s.trim());
        const obj = {};
        cols.forEach((col, i) => {
          obj[col] = params[i];
        });
        this.db.data.events.push(obj);
        this.db.save();
        return { changes: 1, lastInsertRowid: obj.id };
      }
    }

    if (sql.startsWith('INSERT INTO nfc_tags')) {
      const colsMatch = sql.match(/\((.*?)\)/);
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map(s => s.trim());
        const obj = {};
        cols.forEach((col, i) => {
          obj[col] = params[i];
        });
        this.db.data.nfc_tags.push(obj);
        this.db.save();
        return { changes: 1, lastInsertRowid: obj.id };
      }
    }

    if (sql.startsWith('INSERT INTO uploads')) {
      const colsMatch = sql.match(/\((.*?)\)/);
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map(s => s.trim());
        const obj = {};
        cols.forEach((col, i) => {
          obj[col] = params[i];
        });
        this.db.data.uploads.push(obj);
        this.db.save();
        return { changes: 1, lastInsertRowid: obj.id };
      }
    }

    if (sql.startsWith('UPDATE nfc_tags SET guestName =')) {
      const [guestName, id] = params;
      const tag = this.db.data.nfc_tags.find(t => t.id === id);
      if (tag) {
        tag.guestName = guestName;
        this.db.save();
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (sql.startsWith('UPDATE nfc_tags SET active =')) {
      const [active, id] = params;
      const tag = this.db.data.nfc_tags.find(t => t.id === id);
      if (tag) {
        tag.active = active;
        this.db.save();
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (sql.startsWith('UPDATE events SET')) {
      const id = params[params.length - 1];
      const event = this.db.data.events.find(e => e.id === id);
      if (event) {
        const setClause = sql.substring(sql.indexOf('SET') + 3, sql.indexOf('WHERE')).trim();
        const assignments = setClause.split(',').map(s => s.trim().split('=')[0].trim());
        assignments.forEach((col, i) => {
          event[col] = params[i];
        });
        this.db.save();
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (sql.startsWith('DELETE FROM events WHERE id =')) {
      const id = params[0];
      this.db.data.events = this.db.data.events.filter(e => e.id !== id);
      this.db.data.uploads = this.db.data.uploads.filter(u => u.eventId !== id);
      this.db.data.nfc_tags = this.db.data.nfc_tags.filter(t => t.eventId !== id);
      this.db.save();
      return { changes: 1 };
    }

    if (sql.startsWith('DELETE FROM uploads WHERE id =')) {
      const id = params[0];
      this.db.data.uploads = this.db.data.uploads.filter(u => u.id !== id);
      this.db.save();
      return { changes: 1 };
    }

    console.warn('JSON DB: Unhandled SQL run:', sql, params);
    return { changes: 0 };
  }

  get(...args) {
    const params = this._getParams(args);
    const sql = this.sql;

    if (sql.includes('SELECT COUNT(*) as count FROM events')) {
      return { count: this.db.data.events.length };
    }

    if (sql.startsWith('SELECT * FROM events WHERE slug =')) {
      const slug = params[0];
      return this.db.data.events.find(e => e.slug === slug);
    }

    if (sql.startsWith('SELECT * FROM events WHERE id =')) {
      const id = params[0];
      return this.db.data.events.find(e => e.id === id);
    }

    if (sql.startsWith('SELECT id, isPrivate FROM events WHERE slug =')) {
      const slug = params[0];
      const event = this.db.data.events.find(e => e.slug === slug);
      return event ? { id: event.id, isPrivate: event.isPrivate } : undefined;
    }

    if (sql.startsWith('SELECT id FROM events WHERE slug =')) {
      const slug = params[0];
      const event = this.db.data.events.find(e => e.slug === slug);
      return event ? { id: event.id } : undefined;
    }

    if (sql.startsWith('SELECT * FROM nfc_tags WHERE eventId =') && sql.includes('tagCode =') && sql.includes('active = 1')) {
      const [eventId, tagCode] = params;
      return this.db.data.nfc_tags.find(t => t.eventId === eventId && t.tagCode === tagCode && t.active === 1);
    }

    if (sql.startsWith('SELECT * FROM nfc_tags WHERE id =')) {
      const id = params[0];
      return this.db.data.nfc_tags.find(t => t.id === id);
    }

    if (sql.startsWith('SELECT * FROM uploads WHERE id =')) {
      const id = params[0];
      return this.db.data.uploads.find(u => u.id === id);
    }

    console.warn('JSON DB: Unhandled SQL get:', sql, params);
    return undefined;
  }

  all(...args) {
    const params = this._getParams(args);
    const sql = this.sql;

    if (sql.startsWith('SELECT e.*, (SELECT COUNT(*) FROM uploads WHERE eventId = e.id) as totalUploads')) {
      return this.db.data.events
        .map(e => ({
          ...e,
          totalUploads: this.db.data.uploads.filter(u => u.eventId === e.id).length,
          totalTags: this.db.data.nfc_tags.filter(t => t.eventId === e.id).length
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (sql.startsWith('SELECT * FROM nfc_tags WHERE eventId =') && sql.includes('ORDER BY createdAt DESC')) {
      const eventId = params[0];
      return this.db.data.nfc_tags
        .filter(t => t.eventId === eventId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (sql.startsWith('SELECT u.*, t.guestName as tagGuestName FROM uploads u LEFT JOIN nfc_tags t')) {
      const eventId = params[0];
      return this.db.data.uploads
        .filter(u => u.eventId === eventId)
        .map(u => {
          const tag = this.db.data.nfc_tags.find(t => t.tagCode === u.tagCode && t.eventId === u.eventId);
          return {
            ...u,
            tagGuestName: tag ? tag.guestName : null
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (sql.startsWith('SELECT imageUrl FROM uploads WHERE eventId =')) {
      const eventId = params[0];
      return this.db.data.uploads
        .filter(u => u.eventId === eventId)
        .map(u => ({ imageUrl: u.imageUrl }));
    }

    console.warn('JSON DB: Unhandled SQL all:', sql, params);
    return [];
  }
}

const db = new LocalJsonDb(dbPath);

// Seed database if empty
const seedDatabase = () => {
  const eventsCount = db.prepare('SELECT COUNT(*) as count FROM events').get();
  if (eventsCount.count === 0) {
    console.log('Seeding initial event in JSON database...');
    const eventId = 'hineamaru-uuid-123';
    
    // Create seed event
    db.data.events.push({
      id: eventId,
      title: 'Hineamaru 21st',
      slug: 'hineamaru-5',
      coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
      preset: '35mm-natural',
      passcode: '2121',
      isPrivate: 1,
      createdAt: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      eventType: 'birthday',
      sessionDays: 7,
      closesAt: null,
      bypassEnabled: 1,
      showVerifiedBadge: 1,
      guestNameRegistration: 1
    });

    // Create seed tags
    db.data.nfc_tags.push({
      id: 'tag-1',
      eventId: eventId,
      tagCode: 'ABCD123',
      active: 1,
      guestName: 'Te Awanui',
      createdAt: new Date().toISOString()
    });

    db.data.nfc_tags.push({
      id: 'tag-2',
      eventId: eventId,
      tagCode: 'XYZ7890',
      active: 1,
      guestName: 'Mereana',
      createdAt: new Date().toISOString()
    });

    // Create seed uploads
    db.data.uploads.push({
      id: 'upload-1',
      eventId: eventId,
      uploaderName: 'Te Awanui',
      caption: 'Golden hour vibe at the beach front 🌅',
      imageUrl: 'https://images.unsplash.com/photo-1473116763269-255ea7b2fdb2?q=80&w=1200&auto=format&fit=crop',
      thumbnailUrl: 'https://images.unsplash.com/photo-1473116763269-255ea7b2fdb2?q=80&w=400&h=400&auto=format&fit=crop',
      tagCode: 'ABCD123',
      type: 'image',
      createdAt: new Date().toISOString()
    });

    db.data.uploads.push({
      id: 'upload-2',
      eventId: eventId,
      uploaderName: 'Mereana',
      caption: 'Setting up the tables before everyone arrives! ✨',
      imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1200&auto=format&fit=crop',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=400&h=400&auto=format&fit=crop',
      tagCode: 'XYZ7890',
      type: 'image',
      createdAt: new Date().toISOString()
    });

    db.save();
    console.log('JSON database seeding completed.');
  }
};

seedDatabase();

module.exports = db;
