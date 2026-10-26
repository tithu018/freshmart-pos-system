CREATE TABLE inventory (
    product_id VARCHAR(36) PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    stock BIGINT NOT NULL DEFAULT 0 CHECK (stock BETWEEN 0 AND 1000000000),
    min_stock BIGINT NOT NULL DEFAULT 10 CHECK (min_stock BETWEEN 0 AND 1000000000)
);
INSERT INTO inventory (product_id) SELECT id FROM products;

-- Audit snapshots deliberately survive deletion of a product or user.
CREATE TABLE stock_movements (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(80) NOT NULL,
    sku VARCHAR(30) NOT NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('STOCK_IN', 'STOCK_OUT', 'RESTOCK', 'THRESHOLD')),
    quantity BIGINT NOT NULL CHECK (quantity BETWEEN 0 AND 1000000000),
    stock_before BIGINT NOT NULL CHECK (stock_before BETWEEN 0 AND 1000000000),
    stock_after BIGINT NOT NULL CHECK (stock_after BETWEEN 0 AND 1000000000),
    threshold_before BIGINT NOT NULL,
    threshold_after BIGINT NOT NULL,
    reason VARCHAR(250) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    CONSTRAINT valid_stock_delta CHECK (
        (type IN ('STOCK_IN', 'RESTOCK') AND quantity > 0 AND stock_after = stock_before + quantity)
        OR (type = 'STOCK_OUT' AND quantity > 0 AND stock_after = stock_before - quantity)
        OR (type = 'THRESHOLD' AND quantity = 0 AND stock_after = stock_before)
    )
);
CREATE INDEX idx_movements_product_date ON stock_movements(product_id, occurred_at);
CREATE INDEX idx_movements_date ON stock_movements(occurred_at);
