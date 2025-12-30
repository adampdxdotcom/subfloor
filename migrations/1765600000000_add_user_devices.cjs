exports.up = (pgm) => {
  pgm.createTable('user_devices', {
    id: { type: 'serial', primaryKey: true },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    token: { type: 'text', notNull: true, unique: true },
    platform: { type: 'varchar(20)', notNull: true }, // 'android', 'ios'
    device_model: { type: 'text' }, // e.g., 'Pixel 6'
    last_active: {
      type: 'timestamp with time zone',
      default: pgm.func('current_timestamp'),
    },
  });

  // Index for fast lookups when sending messages
  pgm.createIndex('user_devices', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('user_devices');
};