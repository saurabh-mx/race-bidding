-- Enable users to update their own profile, but only if they are not changing their role
CREATE POLICY "Users can update their own profile" ON profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- (Optional) If you want to ensure they can't make themselves admins, run this trigger:
CREATE OR REPLACE FUNCTION public.protect_role_update() 
RETURNS TRIGGER AS $$
BEGIN
  -- If a normal user tries to change their role, ignore the change
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    NEW.role = OLD.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_role_update_trigger ON profiles;
CREATE TRIGGER protect_role_update_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE public.protect_role_update();
