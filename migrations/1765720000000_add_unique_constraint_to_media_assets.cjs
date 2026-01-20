/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * @param {import("node-pg-migrate/dist/types").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Add a UNIQUE constraint to the file_path column.
  // This is required for the "ON CONFLICT" clause in the migration script to work.
  pgm.addConstraint('media_assets', 'media_assets_file_path_unique', {
    unique: 'file_path',
  });
};

/**
 * @param {import("node-pg-migrate/dist/types").MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropConstraint('media_assets', 'media_assets_file_path_unique');
};