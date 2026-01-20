/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * @param {import("node-pg-migrate/dist/types").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('media_assets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    file_path: {
      type: 'text',
      notNull: true,
    },
    thumbnail_path: {
      type: 'text',
    },
    file_type: { type: 'varchar(100)', notNull: true },
    category: { type: 'varchar(50)', notNull: true },
    uploaded_by: { type: 'varchar(36)' }, // SuperTokens User ID is a string
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('media_assets');
};