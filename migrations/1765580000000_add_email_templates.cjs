/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS email_templates (
      key VARCHAR(255) PRIMARY KEY,
      subject VARCHAR(255) NOT NULL,
      body_content TEXT,
      description VARCHAR(255),
      available_variables JSONB DEFAULT '[]'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255)
    );

    INSERT INTO email_templates (key, subject, description, available_variables)
    VALUES 
    (
      'customer_reminder', 
      'Upcoming Appointment Reminder', 
      'Appointment Reminder (Due Tomorrow)', 
      '["customer_name", "job_name", "date", "start_time", "address", "notes", "company_name"]'::jsonb
    ),
    (
      'past_due_reminder', 
      'Friendly Reminder: Past Due', 
      'Past Due Sample Reminder', 
      '["customer_name", "items_list", "company_name"]'::jsonb
    ),
    (
      'order_received', 
      'Order Received', 
      'Material Order Received Confirmation', 
      '["user_name", "order_number", "supplier_name", "items_list", "company_name"]'::jsonb
    ),
    (
      'user_invite', 
      'Invitation to join Subfloor', 
      'New User Invitation', 
      '["invite_link", "role", "company_name"]'::jsonb
    )
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = pgm => {
  pgm.sql('DROP TABLE IF EXISTS email_templates;');
};