-- PayWall402 Database Schema
-- Content table stores all paywalled content

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('file', 'text', 'link')),
    content_path TEXT NOT NULL,
    original_filename VARCHAR(255),
    file_mimetype VARCHAR(100),
    price_usdc DECIMAL(10, 2) NOT NULL CHECK (price_usdc >= 0.01 AND price_usdc <= 100),
    creator_wallet VARCHAR(100) NOT NULL,
    views INTEGER DEFAULT 0,
    payments INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking payments
CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    payer_wallet VARCHAR(100),
    amount_usdc DECIMAL(10, 2) NOT NULL,
    transaction_signature VARCHAR(255),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX idx_content_id ON content(id);
CREATE INDEX idx_content_created_at ON content(created_at DESC);
CREATE INDEX idx_payment_content_id ON payment_logs(content_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
