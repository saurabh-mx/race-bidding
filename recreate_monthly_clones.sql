-- Insert clones of all TEAMs as MONTHLY_TEAM
INSERT INTO racers (name, type, current_bid, status, captain_name, roster, team_name, racer_role)
SELECT name, 'MONTHLY_TEAM', 0, 'ACTIVE', captain_name, roster, team_name, racer_role
FROM racers
WHERE type = 'TEAM'
ON CONFLICT DO NOTHING;

-- Insert clones of all non-team racers as MONTHLY_RACER
INSERT INTO racers (name, type, current_bid, status, captain_name, roster, team_name, racer_role)
SELECT name, 'MONTHLY_RACER', 0, 'ACTIVE', captain_name, roster, team_name, racer_role
FROM racers
WHERE type NOT IN ('TEAM', 'MONTHLY_TEAM', 'MONTHLY_RACER')
ON CONFLICT DO NOTHING;
