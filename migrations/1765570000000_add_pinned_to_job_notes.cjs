/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns('job_notes', {
    is_pinned: {
      type: 'boolean',
      default: false,
      notNull: true
    },
  });
};

exports.down = pgm => {
  pgm.dropColumns('job_notes', ['is_pinned']);
};