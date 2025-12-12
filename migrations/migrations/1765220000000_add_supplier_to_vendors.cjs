/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns('vendors', {
    default_supplier_id: {
      type: 'integer',
      references: '"vendors"(id)',
      onDelete: 'SET NULL',
      default: null,
    },
  });
};

exports.down = pgm => {
  pgm.dropColumns('vendors', ['default_supplier_id']);
};