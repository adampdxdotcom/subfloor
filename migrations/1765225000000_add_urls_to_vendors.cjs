/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns('vendors', {
    website_url: { type: 'text' },
    portal_url: { type: 'text' },
  });
};

exports.down = pgm => {
  pgm.dropColumns('vendors', ['website_url', 'portal_url']);
};