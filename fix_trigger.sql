CREATE OR REPLACE FUNCTION public.protect_role_update() 
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Check if it's being changed from the website by an authenticated user
    IF auth.uid() IS NOT NULL THEN
      -- If the user making the change is NOT an admin, revert it
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        NEW.role = OLD.role;
      END IF;
    END IF;
    -- If auth.uid() is NULL, it means the change is coming from the Supabase Dashboard directly, so we allow it!
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
