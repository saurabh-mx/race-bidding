-- Add ticket_id to bids table to persist 5-digit unique ID numbers
ALTER TABLE bids ADD COLUMN IF NOT EXISTS ticket_id TEXT;
