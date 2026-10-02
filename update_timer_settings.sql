ALTER TABLE app_settings RENAME COLUMN betting_window_end TO team_timer_end;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS individual_timer_end TIMESTAMP WITH TIME ZONE;
