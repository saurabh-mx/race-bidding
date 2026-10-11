-- Update all racers with type 'INDIVIDUAL' to 'CAPTAIN'
-- Also sets racer_role to 'CAPTAIN' so they are categorized and badged as Captains across the application

UPDATE public.racers
SET 
  type = 'CAPTAIN',
  racer_role = 'CAPTAIN'
WHERE 
  type = 'INDIVIDUAL';
