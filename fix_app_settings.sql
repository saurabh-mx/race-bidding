-- Insert the default row if it's completely missing
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Allow admins to insert into app_settings in the future just in case it ever gets deleted again
DROP POLICY IF EXISTS "Admins can insert app_settings" ON app_settings;
CREATE POLICY "Admins can insert app_settings" ON app_settings FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'management')
  )
);
