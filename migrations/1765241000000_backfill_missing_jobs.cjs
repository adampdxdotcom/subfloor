/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Find all projects that don't have a matching job record and create one.
  pgm.sql(`
    INSERT INTO jobs (project_id, is_on_hold, deposit_received, contracts_received, final_payment_received)
    SELECT id, false, false, false, false 
    FROM projects p 
    WHERE NOT EXISTS (SELECT 1 FROM jobs j WHERE j.project_id = p.id);
  `);
};

exports.down = pgm => {
  // We generally don't revert "data backfills" because we can't distinguish 
  // between the jobs we created automatically and valid jobs created later.
  // Leaving this empty is the safest approach.
};