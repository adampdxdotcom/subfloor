/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Add 'is_muted' column to the participants table
  // Default is FALSE (notifications are ON by default)
  pgm.addColumn('conversation_participants', {
    is_muted: { type: 'boolean', notNull: true, default: false }
  });
};

exports.down = pgm => {
  pgm.dropColumn('conversation_participants', 'is_muted');
};