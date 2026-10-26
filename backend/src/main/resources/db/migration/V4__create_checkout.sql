CREATE TABLE sales (
    id VARCHAR(36) PRIMARY KEY,
    idempotency_key VARCHAR(36) NOT NULL UNIQUE,
    request_hash VARCHAR(64) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    payment VARCHAR(16) NOT NULL CHECK (payment IN ('CASH', 'CARD')),
    subtotal NUMERIC(18,2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(18,2) NOT NULL CHECK (discount >= 0 AND discount <= subtotal),
    tax_rate NUMERIC(5,2) NOT NULL CHECK (tax_rate BETWEEN 0 AND 100),
    tax NUMERIC(18,2) NOT NULL CHECK (tax >= 0),
    total NUMERIC(18,2) NOT NULL CHECK (total = subtotal - discount + tax)
);
-- Snapshot lines survive later catalog and user changes.
CREATE TABLE sale_items (
    id VARCHAR(36) PRIMARY KEY,
    sale_id VARCHAR(36) NOT NULL REFERENCES sales(id),
    product_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(80) NOT NULL,
    sku VARCHAR(30) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    quantity BIGINT NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
    line_total NUMERIC(18,2) NOT NULL CHECK (line_total = unit_price * quantity),
    UNIQUE (sale_id, product_id)
);
ALTER TABLE stock_movements ADD COLUMN sale_id VARCHAR(36) REFERENCES sales(id);
CREATE INDEX idx_movements_sale ON stock_movements(sale_id);
