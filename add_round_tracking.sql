-- Add current_round_id to app_settings to track the current betting cycle
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS current_round_id INTEGER DEFAULT 1;

-- Add round_id to bids to track which round a bid belongs to
ALTER TABLE bids ADD COLUMN IF NOT EXISTS round_id INTEGER DEFAULT 1;
