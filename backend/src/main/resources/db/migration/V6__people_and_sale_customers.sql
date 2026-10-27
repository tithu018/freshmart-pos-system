CREATE TABLE employee_management_guard (id INTEGER PRIMARY KEY CHECK (id = 1));
INSERT INTO employee_management_guard (id) VALUES (1);

CREATE TABLE customers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    email VARCHAR(254),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_customers_name ON customers(name, id);
ALTER TABLE sales ADD COLUMN customer_id VARCHAR(36) REFERENCES customers(id);
ALTER TABLE sales ADD COLUMN customer_name VARCHAR(100);
CREATE INDEX idx_sales_customer_date ON sales(customer_id, occurred_at, id);
