CREATE TABLE public.races (
  id serial PRIMARY KEY,
  name text NOT NULL,
  track text,
  status text DEFAULT 'PENDING',
  team_timer integer,
  racer_timer integer,
  team_min_bet numeric DEFAULT 0,
  racer_min_bet numeric DEFAULT 0,
  teams jsonb DEFAULT '[]'::jsonb,
  racers jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on races" 
  ON public.races FOR SELECT 
  USING (true);

CREATE POLICY "Allow admin and management to insert races" 
  ON public.races FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'management')
    )
  );

CREATE POLICY "Allow admin and management to update races" 
  ON public.races FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'management')
    )
  );
