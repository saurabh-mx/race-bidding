-- Insert clones of all non-team racers as MONTHLY_RACER
INSERT INTO racers (name, type, current_bid, status, captain_name, roster, team_name, racer_role)
SELECT name, 'MONTHLY_RACER', 0, 'ACTIVE', captain_name, roster, team_name, racer_role
FROM racers
WHERE type NOT IN ('TEAM', 'MONTHLY_RACER')
ON CONFLICT DO NOTHING;
