CREATE TABLE results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id INTEGER NOT NULL,
  racer_id UUID REFERENCES racers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  points_earned INTEGER DEFAULT 0,
  is_dnf BOOLEAN DEFAULT false,
  is_dsq BOOLEAN DEFAULT false,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Results are viewable by everyone" ON results FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert results" ON results FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Also enable realtime for results
begin;
  alter publication supabase_realtime add table results;
commit;
