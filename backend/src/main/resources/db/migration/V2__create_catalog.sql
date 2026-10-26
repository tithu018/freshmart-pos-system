CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    name_key VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    icon VARCHAR(16) NOT NULL,
    color VARCHAR(16) NOT NULL
);

CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    sku VARCHAR(30) NOT NULL UNIQUE,
    barcode VARCHAR(64) UNIQUE,
    category_id VARCHAR(36) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    description VARCHAR(1000) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    unit VARCHAR(30) NOT NULL,
    icon VARCHAR(16) NOT NULL,
    color VARCHAR(16) NOT NULL
);
CREATE INDEX idx_products_category ON products(category_id);
