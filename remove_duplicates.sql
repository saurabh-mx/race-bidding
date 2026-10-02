-- Remove duplicate entries from racers table, keeping only the first one of each name+type combo
DELETE FROM racers
WHERE id NOT IN (
  SELECT DISTINCT ON (name, type) id
  FROM racers
  ORDER BY name, type, created_at ASC
);
