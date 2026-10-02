CREATE TABLE app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  betting_window_end TIMESTAMP WITH TIME ZONE
);

INSERT INTO app_settings (id, betting_window_end) VALUES (1, NULL);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read app_settings" ON app_settings FOR SELECT USING (true);

-- Only admin/management can update
CREATE POLICY "Admins can update app_settings" ON app_settings FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'management')
  )
);

-- Turn on realtime for app_settings
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
