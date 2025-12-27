-- SQL Schema for Subfloor

-- Enable UUIDs for Inventory 2.0
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    address TEXT,
    phone_number VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    vendor_type TEXT, -- Replaces is_manufacturer/is_supplier. Can be 'Manufacturer', 'Supplier', 'Both'.
    default_supplier_id INT REFERENCES vendors(id) ON DELETE SET NULL,
    default_product_type TEXT,
    website_url TEXT,
    portal_url TEXT,
    address TEXT,
    phone VARCHAR(50),
    ordering_email VARCHAR(255),
    claims_email VARCHAR(255),
    rep_name VARCHAR(255),
    rep_phone VARCHAR(50),
    rep_email VARCHAR(255),
    -- Pricing Overrides
    default_markup NUMERIC(5, 2),
    pricing_method VARCHAR(20),
    shipping_method TEXT,
    dedicated_shipping_day INT, -- 0=Sunday, 6=Saturday
    notes TEXT
);

-- NEW INVENTORY V2 TABLES
CREATE TABLE products (
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

CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    name TEXT, -- e.g. Color Name
    size TEXT,
    finish TEXT,
    style TEXT,
    wear_layer VARCHAR(50),
    thickness VARCHAR(50),
    sku TEXT,
    unit_cost NUMERIC(10, 2),
    retail_price NUMERIC(10, 2),
    pricing_unit VARCHAR(50), -- NEW FIELD
    uom VARCHAR(20),
    carton_size NUMERIC(10, 4),
    image_url TEXT,
    thumbnail_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_master BOOLEAN DEFAULT FALSE,
    has_sample BOOLEAN DEFAULT TRUE -- Tracks if we physically carry this specific variant sample
);

CREATE TABLE installers (
    id SERIAL PRIMARY KEY,
    installer_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    color VARCHAR(7),
    type VARCHAR(20) DEFAULT 'Managed' -- 'Managed' or 'Unmanaged'
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(100),
    status VARCHAR(100),
    final_choice VARCHAR(255),
    manager_id VARCHAR(255), -- User ID of the project owner
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sample_checkouts (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    installer_id INT REFERENCES installers(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    interest_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    sample_type TEXT, -- 'Board', 'Hand Sample', etc.
    quantity INT DEFAULT 1,
    checkout_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expected_return_date TIMESTAMPTZ,
    actual_return_date TIMESTAMPTZ,
    is_selected BOOLEAN DEFAULT FALSE
);

CREATE TABLE quotes (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    installer_id INT REFERENCES installers(id),
    po_number TEXT, -- ADDED BY DIFF
    installation_type VARCHAR(50) NOT NULL DEFAULT 'Managed Installation',
    quote_details TEXT,
    materials_amount NUMERIC(10, 2),
    labor_amount NUMERIC(10, 2),
    installer_markup NUMERIC(10, 2) DEFAULT 0.00,
    labor_deposit_percentage NUMERIC(5, 2) DEFAULT 50.00,
    date_sent TIMESTAMPTZ,
    status VARCHAR(100)
);

CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    project_id INT UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    po_number VARCHAR(255),
    deposit_amount NUMERIC(10, 2),
    deposit_received BOOLEAN DEFAULT FALSE NOT NULL,
    contracts_received BOOLEAN DEFAULT FALSE NOT NULL,
    final_payment_received BOOLEAN DEFAULT FALSE NOT NULL,
    paperwork_signed_url VARCHAR(255),
    is_on_hold BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE change_orders (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    quote_id INT REFERENCES quotes(id) ON DELETE SET NULL, -- Allow quote deletion
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE material_orders (
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

CREATE TABLE order_line_items (
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

CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    thumbnail_url VARCHAR(255),
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    category VARCHAR(50) DEFAULT 'SITE', -- 'SITE', 'DOCUMENT', 'INVOICE'
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL, -- Changed to VARCHAR to support UUIDs
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_log (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_target ON activity_log(target_entity, target_id);

CREATE TABLE app_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE app_user_roles (
    user_id VARCHAR(255) NOT NULL,
    role_id INT NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE job_appointments (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    installer_id INTEGER REFERENCES installers(id) ON DELETE SET NULL,
    quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL, -- ADDED BY DIFF
    appointment_name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    calendar_token VARCHAR(255) UNIQUE, -- Added for iCal Feed Auth
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_job_appointments_job_id ON job_appointments(job_id);

CREATE TABLE standard_sizes (
    size_value VARCHAR(255) PRIMARY KEY
);

INSERT INTO app_roles (name, description) VALUES
('Admin', 'Full access to all system features, including user management and settings.'),
('User', 'Standard user with access to daily operations like creating and managing projects.');

-- =================================================================
-- NEW TABLES FOR ADVANCED CALENDAR EVENTS (PHASE 1)
-- =================================================================

-- The new central table for all scheduled items
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    start_time TIMESTAMPTZ NOT NULL, -- Full timestamp for time of day
    end_time TIMESTAMPTZ NOT NULL,   -- Full timestamp for time of day
    is_all_day BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE, -- New Feature: Visibility toggle
    
    -- Link to a job (optional, for billable time)
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL, 
    
    -- For creator/owner information
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Join table for many-to-many relationship with attendees
CREATE TABLE event_attendees (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    -- We'll use a text field for the ID to accommodate different sources
    attendee_id VARCHAR(255) NOT NULL, 
    -- Type helps us know which table to look up ('user' or 'installer')
    attendee_type VARCHAR(50) NOT NULL,
    -- Status tracking for invites
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined' 
    PRIMARY KEY (event_id, attendee_id, attendee_type)
);

-- =================================================================
-- NEW TABLE FOR SYSTEM-WIDE PREFERENCES (Admin Controlled)
-- =================================================================
CREATE TABLE system_preferences (
    key VARCHAR(100) PRIMARY KEY NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert a default row so it's always available to query
INSERT INTO system_preferences (key, settings) VALUES ('email', '{}');
INSERT INTO system_preferences (key, settings) VALUES ('pricing', '{"retailMarkup": 40, "contractorMarkup": 20, "calculationMethod": "Markup"}');
INSERT INTO system_preferences (key, settings) VALUES ('branding', '{"logoUrl": null, "faviconUrl": null}');

-- =================================================================
-- NEW TABLE FOR USER PROFILES (Names & Avatars)
-- =================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================
-- JOB NOTES V2 (Threaded Timeline)
-- =================================================================
CREATE TABLE IF NOT EXISTS job_notes (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL, -- Added for Calendar Sync
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================
-- IMPORT PROFILES (Data Import Tool)
-- =================================================================
CREATE TABLE IF NOT EXISTS import_profiles (
    id SERIAL PRIMARY KEY,
    profile_name VARCHAR(100) NOT NULL UNIQUE,
    mapping_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================
-- NOTIFICATIONS
-- =================================================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    recipient_id VARCHAR(255) NOT NULL, -- Legacy name used in your DB
    sender_id VARCHAR(255),
    type VARCHAR(50) NOT NULL, -- 'JOB_NOTE', 'ASSIGNMENT', 'SYSTEM', 'APPOINTMENT'
    title VARCHAR(255), -- Added for Appointment titles
    reference_id VARCHAR(255), -- ProjectID or JobID or EventID
    reference_type VARCHAR(50), -- 'PROJECT', 'JOB', 'EVENT'
    message TEXT,
    link_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);

-- =================================================================
-- DIRECT MESSAGING
-- =================================================================
CREATE TABLE direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR(255) NOT NULL,
    recipient_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_dm_combo ON direct_messages(sender_id, recipient_id);


-- =================================================================
-- KNOWLEDGE BASE
-- =================================================================

CREATE TABLE kb_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL, -- Allows nesting
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kb_articles (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT, -- Will store HTML or Markdown from the rich text editor
    author_id VARCHAR(255) NOT NULL, -- User ID
    tags TEXT[], -- Array of strings for easy searching
    is_published BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kb_history (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES kb_articles(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    change_summary VARCHAR(255), -- "Updated title", "Changed category"
    previous_content TEXT, -- Snapshot for rollback
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_kb_search ON kb_articles USING GIN(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- Indexing Article Headers for Deep Linking
CREATE TABLE IF NOT EXISTS kb_article_sections (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES kb_articles(id) ON DELETE CASCADE,
    header_text VARCHAR(255) NOT NULL,
    anchor_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_sections_search ON kb_article_sections(header_text);

CREATE TABLE IF NOT EXISTS email_templates (
  key VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(255) NOT NULL,
  body_content TEXT, -- Nullable: If NULL, use the system file fallback
  description VARCHAR(255),
  available_variables JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) -- SuperTokens User ID
);