/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns('user_preferences', {
    calendar_token: {
      type: 'varchar(255)',
      unique: true,
      default: null,
    },
  });
};

exports.down = pgm => {
  pgm.dropColumns('user_preferences', ['calendar_token']);
};