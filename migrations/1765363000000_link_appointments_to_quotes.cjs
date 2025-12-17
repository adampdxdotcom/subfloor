/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = pgm => {
  // 1. Add PO Number to Quotes
  pgm.addColumns('quotes', {
    po_number: { type: 'text', default: null },
  });

  // 2. Link Appointments to Quotes
  // This allows us to say "This appointment is for THIS specific quote/installer"
  pgm.addColumns('job_appointments', {
    quote_id: {
      type: 'integer',
      references: 'quotes(id)',
      onDelete: 'SET NULL', // If quote is deleted, keep appointment but unlink
      default: null
    }
  });
};

exports.down = pgm => {
  pgm.dropColumns('job_appointments', ['quote_id']);
  pgm.dropColumns('quotes', ['po_number']);
};