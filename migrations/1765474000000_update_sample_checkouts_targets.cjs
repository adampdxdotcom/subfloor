/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = pgm => {
  // 1. Make Project ID optional (nullable)
  pgm.alterColumn('sample_checkouts', 'project_id', { notNull: false });

  // 2. Add Customer and Installer IDs
  pgm.addColumns('sample_checkouts', {
    customer_id: {
      type: 'integer',
      references: 'customers(id)',
      onDelete: 'SET NULL',
      default: null,
    },
    installer_id: {
      type: 'integer',
      references: 'installers(id)',
      onDelete: 'SET NULL',
      default: null,
    },
  });

  // 3. Backfill Data: Populate customer_id for existing project checkouts
  // This ensures the new "Customer Detail > Sample History" works for old records.
  pgm.sql(`
    UPDATE sample_checkouts sc 
    SET customer_id = p.customer_id 
    FROM projects p 
    WHERE sc.project_id = p.id 
    AND sc.customer_id IS NULL;
  `);
};

exports.down = pgm => {
  // We can't easily revert the data backfill, but we can drop columns.
  pgm.dropColumns('sample_checkouts', ['customer_id', 'installer_id']);
  // We cannot set project_id back to NOT NULL safely without checking for orphans first.
};