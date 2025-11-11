-- SQL Schema for Flooring Job Tracker

-- Table for Customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    address TEXT,
    phone_number VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ### MODIFIED TABLE ###
-- Table for Vendors (Manufacturers and Suppliers)
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_manufacturer BOOLEAN DEFAULT FALSE,
    is_supplier BOOLEAN DEFAULT FALSE,
    address TEXT,
    phone VARCHAR(50),
    ordering_email VARCHAR(255),
    claims_email VARCHAR(255),
    rep_name VARCHAR(255),
    rep_phone VARCHAR(50),
    rep_email VARCHAR(255),
    shipping_method TEXT,
    dedicated_shipping_day INT, -- 0=Sunday, 6=Saturday
    notes TEXT -- New field for notes
);

-- ### MODIFIED TABLE ###
-- Table for the master list of Samples
CREATE TABLE samples (
    id SERIAL PRIMARY KEY,
    manufacturer_id INT REFERENCES vendors(id), -- Replaced 'manufacturer' text field
    supplier_id INT REFERENCES vendors(id),     -- New field for separate supplier
    style_color VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    type VARCHAR(100) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    product_url TEXT
);

-- Table for Installers
CREATE TABLE installers (
    id SERIAL PRIMARY KEY,
    installer_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    color VARCHAR(7)
);

-- Table for Projects, linking to a Customer
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(100),
    status VARCHAR(100),
    final_choice VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Join table for tracking Sample Checkouts per Project
CREATE TABLE sample_checkouts (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    sample_id INT REFERENCES samples(id) ON DELETE RESTRICT,
    checkout_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expected_return_date TIMESTAMPTZ,
    actual_return_date TIMESTAMPTZ
);

-- Table for Quotes, linking to a Project and an Installer
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

-- Table for finalized Jobs, with a one-to-one relationship to a Project
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    project_id INT UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    po_number VARCHAR(255),
    deposit_amount NUMERIC(10, 2),
    deposit_received BOOLEAN DEFAULT FALSE NOT NULL,
    contracts_received BOOLEAN DEFAULT FALSE NOT NULL,
    final_payment_received BOOLEAN DEFAULT FALSE NOT NULL,
    paperwork_signed_url VARCHAR(255),
    scheduled_start_date DATE,
    scheduled_end_date DATE,
    notes TEXT
);

-- Table for Change Orders, linked to a Project
CREATE TABLE change_orders (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ### MODIFIED TABLE ###
-- The main record for each material order, linked to a project.
CREATE TABLE material_orders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    supplier_id INT REFERENCES vendors(id), -- Replaced 'supplier' text field
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    eta_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Ordered',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- The individual products (line items) on a specific material order.
CREATE TABLE order_line_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
    sample_id INTEGER NOT NULL REFERENCES samples(id),
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT,
    total_cost NUMERIC(10, 2)
);

-- Table for storing photos, linked polymorphically to other tables
CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'sample', 'project'
    entity_id INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);