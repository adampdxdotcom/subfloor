/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // 1. Create Conversations Table
  pgm.createTable('conversations', {
    id: { type: 'uuid', default: pgm.func('uuid_generate_v4()'), primaryKey: true },
    type: { type: 'varchar(20)', notNull: true, default: 'DIRECT' }, // 'DIRECT' or 'GROUP'
    title: { type: 'varchar(255)' }, // Nullable (Groups might be unnamed)
    created_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', default: pgm.func('current_timestamp') }
  });

  // 2. Create Participants Table (Links Users <-> Conversations)
  pgm.createTable('conversation_participants', {
    conversation_id: { type: 'uuid', notNull: true, references: 'conversations', onDelete: 'CASCADE' },
    user_id: { type: 'varchar(255)', notNull: true }, // References users table (assuming string IDs)
    joined_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
    last_read_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
    is_archived: { type: 'boolean', default: false, notNull: true },
  });
  
  // Composite Primary Key: A user can only be in a conversation once
  pgm.addConstraint('conversation_participants', 'pk_conversation_participants', {
    primaryKey: ['conversation_id', 'user_id']
  });

  // 3. Add conversation_id to the existing messages table
  pgm.addColumn('direct_messages', {
    conversation_id: { type: 'uuid', references: 'conversations', onDelete: 'CASCADE' }
  });

  // 4. DATA MIGRATION: Convert existing 1-on-1 chats into Conversations
  // We use a PL/pgSQL block to handle the logic database-side
  pgm.sql(`
    DO $$
    DECLARE
        r RECORD;
        new_conv_id uuid;
    BEGIN
        -- Loop through every unique pair of users who have exchanged messages
        FOR r IN 
            SELECT DISTINCT 
                LEAST(sender_id, recipient_id) as user_a, 
                GREATEST(sender_id, recipient_id) as user_b 
            FROM direct_messages
        LOOP
            -- Create a new Conversation for this pair
            INSERT INTO conversations (type) VALUES ('DIRECT') RETURNING id INTO new_conv_id;

            -- Add both users as participants
            INSERT INTO conversation_participants (conversation_id, user_id) VALUES (new_conv_id, r.user_a);
            INSERT INTO conversation_participants (conversation_id, user_id) VALUES (new_conv_id, r.user_b);

            -- Update all old messages between these two to point to the new conversation
            UPDATE direct_messages 
            SET conversation_id = new_conv_id
            WHERE (sender_id = r.user_a AND recipient_id = r.user_b)
               OR (sender_id = r.user_b AND recipient_id = r.user_a);
        END LOOP;
    END $$;
  `);

  // 5. Cleanup Constraints
  // Now that every message has a conversation_id, make it required
  pgm.alterColumn('direct_messages', 'conversation_id', { notNull: true });
  
  // The 'recipient_id' is no longer strictly necessary for routing (the conversation handles it),
  // but we'll make it nullable for now to avoid breaking legacy queries immediately.
  pgm.alterColumn('direct_messages', 'recipient_id', { notNull: false });

  // 6. Rename the table to represent its new broader scope
  pgm.renameTable('direct_messages', 'messages');
  
  // 7. Add index for performance
  pgm.createIndex('messages', 'conversation_id');
  pgm.createIndex('conversation_participants', 'user_id');
};

exports.down = pgm => {
  // Undo Logic (Drop tables, rename back)
  pgm.renameTable('messages', 'direct_messages');
  pgm.dropColumn('direct_messages', 'conversation_id');
  pgm.dropTable('conversation_participants');
  pgm.dropTable('conversations');
};