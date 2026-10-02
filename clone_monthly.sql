-- 1. Drop the old type constraint so we can use our new MONTHLY types
ALTER TABLE racers DROP CONSTRAINT IF EXISTS racers_type_check;

-- 2. Clone all current teams/racers into MONTHLY equivalents!
INSERT INTO racers (id, name, type, logo_url, captain_name, captain_image_url, roster, races, win_rate, wins, avg_pos, acquisition, team_name, racer_role)
SELECT 
    gen_random_uuid(), 
    name, 
    CASE WHEN type = 'TEAM' THEN 'MONTHLY_TEAM' ELSE 'MONTHLY_RACER' END, 
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
WHERE type NOT LIKE 'MONTHLY%';
