exports.up = (pgm) => {
  pgm.addColumns('projects', {
    client_installer_id: {
      type: 'integer',
      references: 'installers(id)',
      onDelete: 'SET NULL',
      default: null
    }
  });

  // Make customer_id nullable so we can have projects owned by Installers
  pgm.alterColumn('projects', 'customer_id', {
    notNull: false
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('projects', ['client_installer_id']);
  
  // Note: We cannot safely restore the NOT NULL constraint on customer_id 
  // without potentially invalidating data created while this migration was active.
};