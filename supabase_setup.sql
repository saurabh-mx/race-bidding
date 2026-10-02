-- 1. Create a custom profiles table to store roles for ABAC (Attribute-Based Access Control)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  login_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'management', 'admin'))
);

-- 2. Create the racers table
CREATE TABLE racers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TEAM', 'INDIVIDUAL', 'WEEKLY')),
  current_bid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  logo_url TEXT DEFAULT '',
  captain_name TEXT DEFAULT '',
  captain_image_url TEXT DEFAULT '',
  roster JSONB DEFAULT '[]'::jsonb,
  races INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  wins INTEGER DEFAULT 0,
  avg_pos NUMERIC DEFAULT 0,
  acquisition INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the bids table to track history
CREATE TABLE bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  racer_id UUID REFERENCES racers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bidder_name TEXT,
  amount INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.5 Create the audit_logs table
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.6 Create the login_logs table
CREATE TABLE login_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Set up Row Level Security (RLS) for ABAC

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE racers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, but only update their own (or let Management update them)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Racers: Anyone can view racers. Only Management and Admins can insert/update/delete racers.
CREATE POLICY "Racers are viewable by everyone" ON racers FOR SELECT USING (true);

CREATE POLICY "Management can insert racers" ON racers FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('management', 'admin')));

CREATE POLICY "Management can update racers" ON racers FOR UPDATE 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('management', 'admin')));

CREATE POLICY "Management can delete racers" ON racers FOR DELETE 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('management', 'admin')));

-- Bids: Anyone can view bids. Authenticated users can insert bids.
CREATE POLICY "Bids are viewable by everyone" ON bids FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert bids" ON bids FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Audit Logs: Admins can view, authenticated users can insert
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Login Logs: Admins can view
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view login logs" ON login_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Enable Real-time for racers and bids
-- This allows our frontend dashboard to subscribe to live updates
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table racers;
alter publication supabase_realtime add table bids;

-- 6. Insert Final Captain List (Individuals) and Teams
INSERT INTO racers (name, type, current_bid, status) VALUES 
-- INDIVIDUALS (Captains)
('Ryuke', 'INDIVIDUAL', 0, 'ACTIVE'),
('Faint', 'INDIVIDUAL', 0, 'ACTIVE'),
('Injector', 'INDIVIDUAL', 0, 'ACTIVE'),
('NoMad', 'INDIVIDUAL', 0, 'ACTIVE'),
('Kidboo', 'INDIVIDUAL', 0, 'ACTIVE'),
('OTAKU', 'INDIVIDUAL', 0, 'ACTIVE'),
('ZephyR', 'INDIVIDUAL', 0, 'ACTIVE'),
('Snow', 'INDIVIDUAL', 0, 'ACTIVE'),
('Punisher', 'INDIVIDUAL', 0, 'ACTIVE'),
('Rain', 'INDIVIDUAL', 0, 'ACTIVE'),
('Wicked', 'INDIVIDUAL', 0, 'ACTIVE'),
('Crash', 'INDIVIDUAL', 0, 'ACTIVE'),
('Chotu18', 'INDIVIDUAL', 0, 'ACTIVE'),
('Riju', 'INDIVIDUAL', 0, 'ACTIVE'),
('Strawberry', 'INDIVIDUAL', 0, 'ACTIVE'),

-- TEAMS
INSERT INTO racers (name, type, current_bid, status, captain_name) VALUES
('Shocker', 'TEAM', 0, 'ACTIVE', 'Ryuke'),
('Ark Nemesis', 'TEAM', 0, 'ACTIVE', 'Faint'),
('Broken Biker', 'TEAM', 0, 'ACTIVE', 'Injector'),
('Vision', 'TEAM', 0, 'ACTIVE', 'NoMad'),
('Momentz Motorsports', 'TEAM', 0, 'ACTIVE', 'Kidboo'),
('Bee Rush', 'TEAM', 0, 'ACTIVE', 'OTAKU'),
('Amore McQueens', 'TEAM', 0, 'ACTIVE', 'ZephyR'),
('Locked & Racing', 'TEAM', 0, 'ACTIVE', 'Snow'),
('KuroKaze', 'TEAM', 0, 'ACTIVE', 'Punisher'),
('Exo Shifters', 'TEAM', 0, 'ACTIVE', 'Rain'),
('SpellBound', 'TEAM', 0, 'ACTIVE', 'Wicked'),
('Speed Unicorn', 'TEAM', 0, 'ACTIVE', 'Crash'),
('Empire Zoomies', 'TEAM', 0, 'ACTIVE', 'Chotu18'),
('Bennys Burnout', 'TEAM', 0, 'ACTIVE', 'Riju'),
('Blackwings of Pegasus', 'TEAM', 0, 'ACTIVE', 'Strawberry');

-- 7. Trigger to automatically create profiles for new users (Email & OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, login_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'login_id', NEW.email),
    'viewer'
  );
  -- Log the initial signup/login
  INSERT INTO public.login_logs (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Trigger to track subsequent logins
CREATE OR REPLACE FUNCTION public.handle_user_login() 
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
    INSERT INTO public.login_logs (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_login();
