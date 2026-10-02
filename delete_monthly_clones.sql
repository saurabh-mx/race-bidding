-- Delete all MONTHLY clones from the table to remove duplicates entirely
DELETE FROM racers 
WHERE type IN ('MONTHLY_TEAM', 'MONTHLY_RACER');
