exports.up = (pgm) => {
    pgm.createTable('size_aliases', {
        id: 'id',
        alias_text: { type: 'varchar(255)', notNull: true, unique: true }, // The messy input
        mapped_size: { type: 'varchar(50)', notNull: true }, // The clean output
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // Index for fast lookups during file processing
    pgm.createIndex('size_aliases', 'alias_text');
};

exports.down = (pgm) => {
    pgm.dropTable('size_aliases');
};