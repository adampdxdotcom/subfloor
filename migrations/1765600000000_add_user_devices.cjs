exports.up = (pgm) => {
  pgm.createTable('user_devices', {
    id: { type: 'serial', primaryKey: true },
    user_id: {
      type: 'varchar(255)', // CORRECT: Matches SuperTokens ID format
      notNull: true,
      // Removed foreign key reference because the 'users' table is internal to SuperTokens
    },
    token: { type: 'text', notNull: true, unique: true },
    platform: { type: 'varchar(20)', notNull: true },
    device_model: { type: 'text' },
    last_active: {
      type: 'timestamp with time zone',
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('user_devices', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('user_devices');
};