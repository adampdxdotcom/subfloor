-- SQL Schema for Joblogger

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
    default_product_type TEXT,
    address TEXT,
    phone VARCHAR(50),
    ordering_email VARCHAR(255),
    claims_email VARCHAR(255),
    rep_name VARCHAR(255),
    rep_phone VARCHAR(50),
    rep_email VARCHAR(255),
    shipping_method TEXT,
    dedicated_shipping_day INT, -- 0=Sunday, 6=Saturday
    notes TEXT
);

CREATE TABLE samples (
    id SERIAL PRIMARY KEY,
    manufacturer_id INT REFERENCES vendors(id),
    supplier_id INT REFERENCES vendors(id),
    product_type TEXT NOT NULL,
    style TEXT NOT NULL,
    line TEXT,
    size TEXT,
    finish TEXT,
    color TEXT,
    sample_format TEXT, -- For 'Board' or 'Loose'
    board_colors TEXT,  -- For extra colors on a board
    sku VARCHAR(100),
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    product_url TEXT,
    CONSTRAINT chk_sample_format CHECK (sample_format IN ('Board', 'Loose') OR sample_format IS NULL)
);

CREATE TABLE installers (
    id SERIAL PRIMARY KEY,
    installer_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    color VARCHAR(7)
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(100),
    status VARCHAR(100),
    final_choice VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sample_checkouts (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    sample_id INT REFERENCES samples(id) ON DELETE RESTRICT,
    checkout_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expected_return_date TIMESTAMPTZ,
    actual_return_date TIMESTAMPTZ
);

CREATE TABLE quotes (
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
    notes TEXT
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
    status VARCHAR(50) NOT NULL DEFAULT 'Ordered',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_line_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
    sample_id INTEGER NOT NULL REFERENCES samples(id),
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT,
    total_cost NUMERIC(10, 2)
);

CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================
-- AUDITING
-- =================================================================

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

-- =================================================================
-- ROLE-BASED ACCESS CONTROL (RBAC)
-- Tables are prefixed with 'app_' to avoid conflicts with SuperTokens' internal tables.
-- =================================================================

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
    appointment_name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_appointments_job_id ON job_appointments(job_id);

INSERT INTO app_roles (name, description) VALUES
('Admin', 'Full access to all system features, including user management and settings.'),
('User', 'Standard user with access to daily operations like creating and managing projects.');