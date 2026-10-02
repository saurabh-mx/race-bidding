ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS latest_team_winner TEXT DEFAULT 'NONE';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS latest_racer_winner TEXT DEFAULT 'NONE';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS latest_monthly_winner TEXT DEFAULT 'NONE';
