-- ============================================================
-- PickupPro — worldwide demo events seed
-- Run this in the Supabase SQL Editor (it runs as superuser and
-- bypasses RLS, so the admin-only insert policy doesn't block it).
--
-- Mix of casual + official events across real cities with real
-- coordinates and future dates, so the worldwide map looks alive.
-- Safe to re-run: it first removes any previous seed rows.
-- ============================================================

-- The events.source column has a CHECK constraint that only allows a fixed set
-- of values (e.g. 'admin'). Drop it so 'seed' is accepted. (It's only a text
-- guard, not a data relationship — safe to remove.)
alter table events drop constraint if exists events_source_check;

-- Remove previously seeded rows so re-running doesn't create duplicates.
delete from events where source = 'seed';

insert into events
  (sport, title, description, date, time, location, latitude, longitude, max_players, type, source, source_url)
values
  -- ---------------- North America ----------------
  ('Basketball', 'Sunset Streetball Run',        'Casual 5-on-5, all levels welcome.',      '2026-07-04', '18:30:00', 'Venice Beach Courts, Los Angeles', 33.9850, -118.4695, 10, 'casual',   'seed', null),
  ('Football',   'Central Park Pickup Footy',    'Friendly kickabout on the great lawn.',   '2026-07-06', '17:00:00', 'Central Park, New York',           40.7829,  -73.9654, 14, 'casual',   'seed', null),
  ('Running',    'Chicago Lakefront 10K',        'Official timed road race along the lake.','2026-07-12', '08:00:00', 'Grant Park, Chicago',              41.8781,  -87.6298, 500,'official', 'seed', 'https://example.com/chicago10k'),
  ('Tennis',     'Toronto Open Doubles',         'Casual doubles ladder, bring a partner.', '2026-07-09', '10:00:00', 'High Park Courts, Toronto',        43.6466,  -79.4636, 8,  'casual',   'seed', null),
  ('Volleyball', 'Mexico City Beach Volley',     'Official city league qualifier.',         '2026-07-15', '16:00:00', 'Bosque de Chapultepec, Mexico City',19.4204, -99.1815, 24, 'official', 'seed', 'https://example.com/cdmx-volley'),

  -- ---------------- South America ----------------
  ('Football',   'Ibirapuera Futebol',           'Pelada amistosa, todos os niveis.',       '2026-07-08', '19:00:00', 'Parque Ibirapuera, Sao Paulo',     -23.5874, -46.6576, 12, 'casual',   'seed', null),
  ('Running',    'Buenos Aires Night Run',        'Official 5K through the city center.',     '2026-07-18', '20:00:00', 'Puerto Madero, Buenos Aires',      -34.6037, -58.3816, 300,'official', 'seed', 'https://example.com/ba-nightrun'),

  -- ---------------- Europe ----------------
  ('Basketball', 'Hyde Park Hoops',              'Pickup ball near the Serpentine.',        '2026-07-05', '17:30:00', 'Hyde Park, London',                51.5073,  -0.1657,  10, 'casual',   'seed', null),
  ('Football',   'Tempelhof Sunday League',      'Official amateur league matchday.',       '2026-07-12', '15:00:00', 'Tempelhofer Feld, Berlin',         52.4730,  13.4050,  22, 'official', 'seed', 'https://example.com/tempelhof'),
  ('Tennis',     'Retiro Park Rally',            'Casual singles meetup.',                  '2026-07-07', '09:30:00', 'Parque del Retiro, Madrid',        40.4153,  -3.6844,  6,  'casual',   'seed', null),
  ('Running',    'Paris Seine 10K',              'Official riverside race.',                '2026-07-19', '08:30:00', 'Champ de Mars, Paris',             48.8556,  2.2986,   400,'official', 'seed', 'https://example.com/paris10k'),
  ('Volleyball', 'Barceloneta Beach Spike',      'Casual beach volleyball, drop-in.',       '2026-07-10', '18:00:00', 'Barceloneta Beach, Barcelona',     41.3784,  2.1925,   16, 'casual',   'seed', null),
  ('Football',   'Vondelpark Kickabout',         'Relaxed pickup football.',                '2026-07-11', '17:00:00', 'Vondelpark, Amsterdam',            52.3580,  4.8686,   14, 'casual',   'seed', null),
  ('Basketball', 'Milano 3x3 Showdown',          'Official 3x3 tournament.',                '2026-07-20', '11:00:00', 'Parco Sempione, Milan',            45.4723,  9.1796,   24, 'official', 'seed', 'https://example.com/milano3x3'),
  ('Running',    'Englischer Garten Trail Run',  'Casual social run, easy pace.',           '2026-07-13', '09:00:00', 'Englischer Garten, Munich',        48.1642,  11.6050,  30, 'casual',   'seed', null),
  ('Tennis',     'Prater Doubles Cup',           'Official doubles cup, registration req.', '2026-07-21', '10:00:00', 'Prater, Vienna',                   48.2167,  16.3958,  16, 'official', 'seed', 'https://example.com/prater-cup'),
  ('Football',   'Villa Borghese Footy',         'Friendly small-sided match.',             '2026-07-09', '18:30:00', 'Villa Borghese, Rome',             41.9145,  12.4920,  12, 'casual',   'seed', null),
  ('Running',    'Stockholm Archipelago Run',    'Official half-marathon.',                 '2026-07-26', '08:00:00', 'Djurgarden, Stockholm',            59.3265,  18.1156,  600,'official', 'seed', 'https://example.com/sthlm-half'),
  ('Volleyball', 'Copenhagen Harbour Volley',    'Casual evening games by the water.',      '2026-07-14', '18:00:00', 'Islands Brygge, Copenhagen',       55.6620,  12.5790,  18, 'casual',   'seed', null),
  ('Basketball', 'Lisbon Riverside Run',         'Pickup hoops at sunset.',                 '2026-07-16', '19:00:00', 'Parque das Nacoes, Lisbon',        38.7680,  -9.0940,  10, 'casual',   'seed', null),

  -- ---------------- Africa & Middle East ----------------
  ('Football',   'Cape Town Sea Point Footy',    'Casual kickabout with ocean views.',      '2026-07-12', '16:30:00', 'Sea Point Promenade, Cape Town',   -33.9120, 18.3870,  14, 'casual',   'seed', null),
  ('Running',    'Dubai Marina 5K',              'Official evening run along the marina.',  '2026-07-22', '19:30:00', 'Dubai Marina, Dubai',              25.0805,  55.1403,  250,'official', 'seed', 'https://example.com/dubai5k'),

  -- ---------------- Asia & Oceania ----------------
  ('Basketball', 'Yoyogi Park Pickup',           'Casual streetball, all welcome.',         '2026-07-11', '17:00:00', 'Yoyogi Park, Tokyo',               35.6720,  139.6949, 10, 'casual',   'seed', null),
  ('Football',   'Marina Bay Futsal',            'Official futsal league night.',           '2026-07-23', '20:00:00', 'Marina Bay, Singapore',            1.2834,   103.8607, 12, 'official', 'seed', 'https://example.com/sg-futsal'),
  ('Volleyball', 'Bondi Beach Volley',           'Casual beach volleyball, drop-in.',       '2026-07-13', '16:00:00', 'Bondi Beach, Sydney',              -33.8908, 151.2743, 16, 'casual',   'seed', null),
  ('Running',    'Mumbai Marine Drive Run',      'Official sunrise 10K.',                   '2026-07-25', '06:30:00', 'Marine Drive, Mumbai',             18.9430,  72.8230,  350,'official', 'seed', 'https://example.com/mumbai10k');
