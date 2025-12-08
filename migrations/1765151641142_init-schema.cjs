/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.sql(`
    -- Enable UUIDs
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- CUSTOMERS
    CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        address TEXT,
        phone_number VARCHAR(50),
        email VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- VENDORS
    CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        vendor_type TEXT,
        default_product_type TEXT,
        address TEXT,
        phone VARCHAR(50),
        ordering_email VARCHAR(255),
        claims_email VARCHAR(255),
        rep_name VARCHAR(255),
        rep_phone VARCHAR(50),
        rep_email VARCHAR(255),
        default_markup NUMERIC(5, 2),
        pricing_method VARCHAR(20),
        shipping_method TEXT,
        dedicated_shipping_day INT,
        notes TEXT
    );

    -- PRODUCTS
    CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        manufacturer_id INT REFERENCES vendors(id),
        supplier_id INT REFERENCES vendors(id),
        name TEXT NOT NULL,
        product_type TEXT NOT NULL,
        description TEXT,
        product_line_url TEXT,
        default_image_url TEXT,
        default_thumbnail_url TEXT,
        is_discontinued BOOLEAN DEFAULT FALSE
    );

    -- VARIANTS
    CREATE TABLE IF NOT EXISTS product_variants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        name TEXT,
        size TEXT,
        finish TEXT,
        style TEXT,
        sku TEXT,
        unit_cost NUMERIC(10, 2),
        retail_price NUMERIC(10, 2),
        pricing_unit VARCHAR(50),
        uom VARCHAR(20),
        carton_size NUMERIC(10, 4),
        image_url TEXT,
        thumbnail_url TEXT,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        is_master BOOLEAN DEFAULT FALSE,
        has_sample BOOLEAN DEFAULT TRUE
    );

    -- INSTALLERS
    CREATE TABLE IF NOT EXISTS installers (
        id SERIAL PRIMARY KEY,
        installer_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        color VARCHAR(7)
    );

    -- PROJECTS
    CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES customers(id),
        project_name VARCHAR(255) NOT NULL,
        project_type VARCHAR(100),
        status VARCHAR(100),
        final_choice VARCHAR(255),
        manager_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- SAMPLE CHECKOUTS
    CREATE TABLE IF NOT EXISTS sample_checkouts (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
        sample_type TEXT,
        quantity INT DEFAULT 1,
        checkout_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expected_return_date TIMESTAMPTZ,
        actual_return_date TIMESTAMPTZ,
        is_selected BOOLEAN DEFAULT FALSE
    );

    -- QUOTES
    CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        installer_id INT REFERENCES installers(id),
        installation_type VARCHAR(50) NOT NULL DEFAULT 'Managed Installation',
        quote_details TEXT,
        materials_amount NUMERIC(10, 2),
        labor_amount NUMERIC(10, 2),
        installer_markup NUMERIC(10, 2) DEFAULT 0.00,
        labor_deposit_percentage NUMERIC(5, 2) DEFAULT 50.00,
        date_sent TIMESTAMPTZ,
        status VARCHAR(100)
    );

    -- JOBS
    CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        project_id INT UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        po_number VARCHAR(255),
        deposit_amount NUMERIC(10, 2),
        deposit_received BOOLEAN DEFAULT FALSE NOT NULL,
        contracts_received BOOLEAN DEFAULT FALSE NOT NULL,
        final_payment_received BOOLEAN DEFAULT FALSE NOT NULL,
        paperwork_signed_url VARCHAR(255),
        is_on_hold BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT
    );

    -- CHANGE ORDERS
    CREATE TABLE IF NOT EXISTS change_orders (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        quote_id INT REFERENCES quotes(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        type VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- MATERIAL ORDERS
    CREATE TABLE IF NOT EXISTS material_orders (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        supplier_id INT REFERENCES vendors(id),
        order_date DATE NOT NULL DEFAULT CURRENT_DATE,
        eta_date DATE,
        purchaser_type VARCHAR(20) DEFAULT 'Customer',
        status VARCHAR(50) NOT NULL DEFAULT 'Ordered',
        date_received DATE,
        notes TEXT,
        parent_order_id INTEGER REFERENCES material_orders(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- LINE ITEMS
    CREATE TABLE IF NOT EXISTS order_line_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
        variant_id UUID NOT NULL REFERENCES product_variants(id),
        quantity NUMERIC(10, 2) NOT NULL,
        unit TEXT,
        total_cost NUMERIC(10, 2),
        unit_cost_snapshot NUMERIC(10, 2),
        markup_snapshot NUMERIC(5, 2),
        unit_price_sold NUMERIC(10, 2)
    );

    -- PHOTOS
    CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        url VARCHAR(255) NOT NULL,
        thumbnail_url VARCHAR(255),
        file_name VARCHAR(255),
        mime_type VARCHAR(100),
        category VARCHAR(50) DEFAULT 'SITE',
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- ACTIVITY LOG
    CREATE TABLE IF NOT EXISTS activity_log (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        target_entity VARCHAR(50) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activity_log_target ON activity_log(target_entity, target_id);

    -- ROLES & USERS
    CREATE TABLE IF NOT EXISTS app_roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT
    );
    CREATE TABLE IF NOT EXISTS app_user_roles (
        user_id VARCHAR(255) NOT NULL,
        role_id INT NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
        user_id VARCHAR(255) PRIMARY KEY,
        first_name VARCHAR(100) DEFAULT '',
        last_name VARCHAR(100) DEFAULT '',
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    
    -- JOB APPOINTMENTS
    CREATE TABLE IF NOT EXISTS job_appointments (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        installer_id INTEGER REFERENCES installers(id) ON DELETE SET NULL,
        appointment_name TEXT NOT NULL,
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_job_appointments_job_id ON job_appointments(job_id);

    -- USER PREFS
    CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

    -- SIZES
    CREATE TABLE IF NOT EXISTS standard_sizes (
        size_value VARCHAR(255) PRIMARY KEY
    );

    -- CALENDAR EVENTS
    CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        is_all_day BOOLEAN DEFAULT FALSE,
        job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS event_attendees (
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        attendee_id VARCHAR(255) NOT NULL,
        attendee_type VARCHAR(50) NOT NULL,
        PRIMARY KEY (event_id, attendee_id, attendee_type)
    );

    -- SYSTEM PREFS
    CREATE TABLE IF NOT EXISTS system_preferences (
        key VARCHAR(100) PRIMARY KEY NOT NULL,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- JOB NOTES
    CREATE TABLE IF NOT EXISTS job_notes (
        id SERIAL PRIMARY KEY,
        job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- IMPORT PROFILES
    CREATE TABLE IF NOT EXISTS import_profiles (
        id SERIAL PRIMARY KEY,
        profile_name VARCHAR(100) NOT NULL UNIQUE,
        mapping_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- NOTIFICATIONS
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        recipient_id VARCHAR(255) NOT NULL,
        sender_id VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        reference_id VARCHAR(255),
        message TEXT,
        link_url TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);

    -- MESSAGES
    CREATE TABLE IF NOT EXISTS direct_messages (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(255) NOT NULL,
        recipient_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dm_combo ON direct_messages(sender_id, recipient_id);

    -- KNOWLEDGE BASE
    CREATE TABLE IF NOT EXISTS kb_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parent_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kb_articles (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        author_id VARCHAR(255) NOT NULL,
        tags TEXT[],
        is_published BOOLEAN DEFAULT FALSE,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kb_history (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES kb_articles(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        change_summary VARCHAR(255),
        previous_content TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kb_search ON kb_articles USING GIN(to_tsvector('english', title || ' ' || COALESCE(content, '')));
    CREATE TABLE IF NOT EXISTS kb_article_sections (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES kb_articles(id) ON DELETE CASCADE,
        header_text VARCHAR(255) NOT NULL,
        anchor_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kb_sections_search ON kb_article_sections(header_text);

    -- SEED ROLES & PREFS (SAFE INSERTS)
    INSERT INTO app_roles (name, description) VALUES
    ('Admin', 'Full access'), ('User', 'Standard user')
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO system_preferences (key, settings) VALUES 
    ('email', '{}'), 
    ('pricing', '{"retailMarkup": 40, "contractorMarkup": 20, "calculationMethod": "Markup"}'), 
    ('branding', '{"logoUrl": null, "faviconUrl": null}')
    ON CONFLICT (key) DO NOTHING;
  `);
};

exports.down = pgm => {
  // Not necessary to implement down for an init migration in a live system usually
};