/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createTable('product_aliases', {
    id: 'id',
    alias_text: { type: 'text', notNull: true, unique: true }, // The messy name from CSV e.g. "CORTC-V012"
    mapped_product_name: { type: 'text', notNull: true },      // The clean name e.g. "Coretec Originals"
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Index for fast lookups during import
  pgm.createIndex('product_aliases', 'alias_text');
};

exports.down = pgm => {
  pgm.dropTable('product_aliases');
};