CREATE INDEX idx_sales_date_id ON sales(occurred_at, id);
CREATE INDEX idx_sales_user_date_id ON sales(user_id, occurred_at, id);
CREATE INDEX idx_sales_payment_date ON sales(payment, occurred_at);
