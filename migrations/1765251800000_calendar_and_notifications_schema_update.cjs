/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // 1. Fix missing timestamp columns on jobs table
  pgm.sql(`
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  `);

  // 2. Fix missing columns on notifications table
  // Added reference_type here
  pgm.sql(`
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255);
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
  `);

  // 3. Add 'Public' visibility flag to events
  pgm.sql(`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
  `);

  // 4. Add status column to event_attendees
  pgm.sql(`
    ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE event_attendees DROP COLUMN IF EXISTS status;
    ALTER TABLE events DROP COLUMN IF EXISTS is_public;
    ALTER TABLE notifications DROP COLUMN IF EXISTS reference_type;
    ALTER TABLE notifications DROP COLUMN IF EXISTS title;
    ALTER TABLE notifications DROP COLUMN IF EXISTS user_id;
    ALTER TABLE jobs DROP COLUMN IF EXISTS updated_at;
    ALTER TABLE jobs DROP COLUMN IF EXISTS created_at;
  `);
};