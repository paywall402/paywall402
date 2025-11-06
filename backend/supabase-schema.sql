-- Supabase SQL Schema for PayWall402
-- Run this in Supabase SQL Editor to set up your database
-- URL: https://app.supabase.com/project/tqxfpvynpyszzdtpgtps/editor/sql

-- Create content table
CREATE TABLE IF NOT EXISTS content (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('file', 'text', 'link')),
    filename VARCHAR(255),
    mimetype VARCHAR(100),
    file_data BYTEA,
    text_content TEXT,
    link_url TEXT,
    price DECIMAL(10, 2) NOT NULL,
    creator_wallet VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    content_id VARCHAR(255) NOT NULL,
    transaction_signature VARCHAR(255) UNIQUE NOT NULL,
    payer_wallet VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Create content_access table
CREATE TABLE IF NOT EXISTS content_access (
    id SERIAL PRIMARY KEY,
    content_id VARCHAR(255) NOT NULL,
    access_token VARCHAR(255) UNIQUE NOT NULL,
    payer_wallet VARCHAR(255) NOT NULL,
    payment_id INTEGER,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

-- Create analytics table
CREATE TABLE IF NOT EXISTS content_analytics (
    id SERIAL PRIMARY KEY,
    content_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('view', 'payment', 'download')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_creator ON content(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_content_expires ON content(expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_content ON payments(content_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_wallet);
CREATE INDEX IF NOT EXISTS idx_access_content ON content_access(content_id);
CREATE INDEX IF NOT EXISTS idx_access_token ON content_access(access_token);
CREATE INDEX IF NOT EXISTS idx_analytics_content ON content_analytics(content_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON content_analytics(event_type);

-- Create views for statistics
CREATE OR REPLACE VIEW content_stats AS
SELECT
    c.id,
    c.type,
    c.filename,
    c.price,
    c.creator_wallet,
    c.created_at,
    COUNT(DISTINCT ca.id) FILTER (WHERE ca.event_type = 'view') as views,
    COUNT(DISTINCT p.id) as payments,
    SUM(p.amount) as total_earned
FROM content c
LEFT JOIN content_analytics ca ON c.id = ca.content_id
LEFT JOIN payments p ON c.id = p.content_id AND p.verified = true
GROUP BY c.id;

-- Enable Row Level Security (RLS)
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed)
CREATE POLICY "Public read content info" ON content
    FOR SELECT USING (true);

CREATE POLICY "Public insert content" ON content
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read payments" ON payments
    FOR SELECT USING (true);

CREATE POLICY "Public insert payments" ON payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access" ON content_access
    FOR SELECT USING (true);

CREATE POLICY "Public insert access" ON content_access
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert analytics" ON content_analytics
    FOR INSERT WITH CHECK (true);

-- Function to clean expired content
CREATE OR REPLACE FUNCTION clean_expired_content()
RETURNS void AS $$
BEGIN
    DELETE FROM content
    WHERE expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Optional: Set up a cron job to clean expired content daily
-- This requires pg_cron extension (available in Supabase)
-- SELECT cron.schedule('clean-expired-content', '0 0 * * *', 'SELECT clean_expired_content();');