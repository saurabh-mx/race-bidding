
-- Create Leaderboard View
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT 
  t.id AS team_id,
  t.name AS team_name,
  t.tournament_points AS base_points,
  COALESCE(SUM(r.tournament_points), 0) AS racer_points,
  (t.tournament_points + COALESCE(SUM(r.tournament_points), 0)) AS total_points
FROM racers t
LEFT JOIN racers r ON r.team_name = t.name AND r.type != 'TEAM'
WHERE t.type = 'TEAM'
GROUP BY t.id, t.name, t.tournament_points
ORDER BY total_points DESC;
