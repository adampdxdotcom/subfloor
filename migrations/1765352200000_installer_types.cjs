/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Add 'type' column to installers table
  // Default to 'Managed' so existing data remains valid
  pgm.sql(`
    ALTER TABLE installers ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'Managed';
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE installers DROP COLUMN IF EXISTS type;
  `);
};