-- 1. Drop the old type constraint so we can use our new MONTHLY types
ALTER TABLE racers DROP CONSTRAINT IF EXISTS racers_type_check;

-- 2. Clone all current non-team racers into MONTHLY_RACER!
INSERT INTO racers (id, name, type, logo_url, captain_name, captain_image_url, roster, races, win_rate, wins, avg_pos, acquisition, team_name, racer_role)
SELECT 
    gen_random_uuid(), 
    name, 
    'MONTHLY_RACER', 
    logo_url, 
    captain_name, 
    captain_image_url, 
    roster, 
    races, 
    win_rate, 
    wins, 
    avg_pos, 
    acquisition, 
    team_name, 
    racer_role 
FROM racers 
WHERE type != 'TEAM' AND type NOT LIKE 'MONTHLY%';
