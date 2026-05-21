const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath, { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    coverImage TEXT,
    preset TEXT DEFAULT '35mm-natural',
    passcode TEXT,
    isPrivate INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    uploaderName TEXT,
    caption TEXT,
    imageUrl TEXT NOT NULL,
    thumbnailUrl TEXT NOT NULL,
    tagCode TEXT,
    type TEXT DEFAULT 'image',
    createdAt TEXT NOT NULL,
    FOREIGN KEY (eventId) REFERENCES events (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS nfc_tags (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    tagCode TEXT NOT NULL UNIQUE,
    active INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (eventId) REFERENCES events (id) ON DELETE CASCADE
  );
`);

console.log('Database initialized successfully.');

// Helper to seed template data if empty
const seedDatabase = () => {
  const eventsCount = db.prepare('SELECT COUNT(*) as count FROM events').get();
  if (eventsCount.count === 0) {
    console.log('Seeding initial event...');
    const eventId = 'hineamaru-uuid-123';
    const insertEvent = db.prepare(`
      INSERT INTO events (id, title, slug, coverImage, preset, passcode, isPrivate, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Seed a beautiful Māori summer themed event
    insertEvent.run(
      eventId,
      'Hineamaru 21st',
      'hineamaru-5',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
      '35mm-natural',
      '2121', // Passcode
      1,      // Private
      new Date().toISOString()
    );

    // Seed some initial tags for this event
    const insertTag = db.prepare(`
      INSERT INTO nfc_tags (id, eventId, tagCode, active, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertTag.run('tag-1', eventId, 'ABCD123', 1, new Date().toISOString());
    insertTag.run('tag-2', eventId, 'XYZ7890', 1, new Date().toISOString());

    // Seed a couple of beautiful mock images to display initially
    const insertUpload = db.prepare(`
      INSERT INTO uploads (id, eventId, uploaderName, caption, imageUrl, thumbnailUrl, tagCode, type, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertUpload.run(
      'upload-1',
      eventId,
      'Te Awanui',
      'Golden hour vibe at the beach front 🌅',
      'https://images.unsplash.com/photo-1473116763269-255ea7b2fdb2?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1473116763269-255ea7b2fdb2?q=80&w=400&h=400&auto=format&fit=crop',
      'ABCD123',
      'image',
      new Date().toISOString()
    );

    insertUpload.run(
      'upload-2',
      eventId,
      'Mereana',
      'Setting up the tables before everyone arrives! ✨',
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=400&h=400&auto=format&fit=crop',
      'XYZ7890',
      'image',
      new Date().toISOString()
    );
    
    console.log('Seeding completed.');
  }
};

seedDatabase();

module.exports = db;
