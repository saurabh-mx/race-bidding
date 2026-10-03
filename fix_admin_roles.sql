-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Management can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Make sure the protect_role_update trigger only triggers for non-admins
-- Actually the trigger logic already handles this correctly:
-- IF OLD.role IS DISTINCT FROM NEW.role AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
-- But let's recreate it just to be safe.
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
