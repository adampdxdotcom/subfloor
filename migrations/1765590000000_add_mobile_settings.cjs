/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Insert a default setting for mobile configuration
  pgm.sql(`
    INSERT INTO system_preferences (key, settings)
    VALUES (
      'mobile_settings', 
      '{"apkDownloadUrl": "https://github.com/your-username/subfloor/releases"}'::jsonb
    )
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = pgm => {
  pgm.sql("DELETE FROM system_preferences WHERE key = 'mobile_settings';");
};