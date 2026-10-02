ALTER TABLE bids ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Allow management/admin to update bids (to approve/reject them)
DROP POLICY IF EXISTS "Management can update bids" ON bids;
CREATE POLICY "Management can update bids" ON bids 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('management', 'admin')));
