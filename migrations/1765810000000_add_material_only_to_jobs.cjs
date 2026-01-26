exports.up = (pgm) => {
  pgm.addColumns('jobs', {
    is_material_only: { type: 'boolean', default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('jobs', ['is_material_only']);
};