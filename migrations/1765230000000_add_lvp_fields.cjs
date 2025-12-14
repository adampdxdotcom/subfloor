/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns('product_variants', {
    wear_layer: { type: 'varchar(50)' },
    thickness: { type: 'varchar(50)' },
  });
};

exports.down = pgm => {
  pgm.dropColumns('product_variants', ['wear_layer', 'thickness']);
};