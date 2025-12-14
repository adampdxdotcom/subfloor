/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns('sample_checkouts', {
    interest_variant_id: {
      type: 'uuid',
      references: '"product_variants"(id)',
      onDelete: 'SET NULL',
      default: null,
    },
  });
};

exports.down = pgm => {
  pgm.dropColumns('sample_checkouts', ['interest_variant_id']);
};