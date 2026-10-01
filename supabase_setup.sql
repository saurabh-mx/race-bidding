-- 1. Create a custom profiles table to store roles for ABAC (Attribute-Based Access Control)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  login_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('VIEWER', 'MANAGEMENT'))
);

-- 2. Create the racers table
CREATE TABLE racers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TEAM', 'INDIVIDUAL', 'WEEKLY')),
  current_bid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the bids table to track history
CREATE TABLE bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  racer_id UUID REFERENCES racers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
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

-- Racers: Anyone can view racers. Only Management can insert/update/delete racers.
CREATE POLICY "Racers are viewable by everyone" ON racers FOR SELECT USING (true);

CREATE POLICY "Management can insert racers" ON racers FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGEMENT'));

CREATE POLICY "Management can update racers" ON racers FOR UPDATE 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGEMENT'));

CREATE POLICY "Management can delete racers" ON racers FOR DELETE 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGEMENT'));

-- Bids: Anyone can view bids. Authenticated users can insert bids.
CREATE POLICY "Bids are viewable by everyone" ON bids FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert bids" ON bids FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 5. Enable Real-time for racers and bids
-- This allows our frontend dashboard to subscribe to live updates
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table racers;
alter publication supabase_realtime add table bids;

-- 6. Insert Mock Data (Optional, for testing)
INSERT INTO racers (name, type, current_bid, status) VALUES 
('Scuderia Alpha', 'TEAM', 15000, 'ACTIVE'),
('Redline Racing', 'TEAM', 12500, 'ACTIVE'),
('Max V.', 'INDIVIDUAL', 8900, 'ACTIVE'),
('Lewis H.', 'INDIVIDUAL', 9200, 'ACTIVE'),
('Amateur Cup (Week 42)', 'WEEKLY', 1200, 'ACTIVE');
