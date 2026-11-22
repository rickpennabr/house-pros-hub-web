-- ProTrades: trade add-ons for the general CRM (Landscape, Hardscape).
-- pro_trade_activations: which trades each pro turned on (/crm/protrades).
-- trade_catalog_items: hub-managed reference database per trade (plants, pavers, base materials),
-- edited by the admin at /admin/protrades. Pros copy items into their own products.

CREATE TABLE IF NOT EXISTS public.pro_trade_activations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade TEXT NOT NULL CHECK (trade ~ '^[a-z0-9-]{2,30}$'),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trade)
);
ALTER TABLE public.pro_trade_activations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pro_trade_activations_select_own" ON public.pro_trade_activations;
CREATE POLICY "pro_trade_activations_select_own" ON public.pro_trade_activations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.trade_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL CHECK (trade ~ '^[a-z0-9-]{2,30}$'),
  kind TEXT NOT NULL CHECK (kind ~ '^[a-z0-9_]{2,30}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  brand TEXT NOT NULL DEFAULT '' CHECK (char_length(brand) <= 120),
  scientific_name TEXT CHECK (scientific_name IS NULL OR char_length(scientific_name) <= 160),
  category TEXT CHECK (category IS NULL OR char_length(category) <= 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  image_url TEXT CHECK (image_url IS NULL OR char_length(image_url) <= 1000),
  unit TEXT NOT NULL DEFAULT 'each' CHECK (char_length(unit) BETWEEN 1 AND 40),
  typical_price_cents INTEGER CHECK (typical_price_cents IS NULL OR typical_price_cents >= 0),
  -- [{"name": "Sun", "value": "Full sun"}, ...]
  specs JSONB NOT NULL DEFAULT '[]'::jsonb,
  region TEXT NOT NULL DEFAULT 'las-vegas',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trade_catalog_items_unique
  ON public.trade_catalog_items (trade, kind, lower(brand), lower(name));
CREATE INDEX IF NOT EXISTS trade_catalog_items_browse
  ON public.trade_catalog_items (trade, kind, is_active, sort_order);

DROP TRIGGER IF EXISTS trade_catalog_items_updated_at ON public.trade_catalog_items;
CREATE TRIGGER trade_catalog_items_updated_at
  BEFORE UPDATE ON public.trade_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.pro_drive_set_updated_at();

ALTER TABLE public.trade_catalog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trade_catalog_items_read" ON public.trade_catalog_items;
CREATE POLICY "trade_catalog_items_read" ON public.trade_catalog_items
  FOR SELECT TO anon, authenticated USING (is_active);

-- A pro's product remembers which trade and hub item it came from.
ALTER TABLE public.pro_crm_products
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.trade_catalog_items(id) ON DELETE SET NULL;

-- Pros already using maintenance keep it: turn Landscape on for them.
INSERT INTO public.pro_trade_activations (user_id, trade)
SELECT DISTINCT owner_id, 'landscape' FROM public.pro_crm_maintenance_plans
ON CONFLICT DO NOTHING;

-- Starter catalog. Las Vegas area. The admin can edit or hide any row.
INSERT INTO public.trade_catalog_items
  (trade, kind, name, brand, scientific_name, category, description, unit, specs, sort_order)
VALUES
  ('landscape', 'plant', 'Desert Museum Palo Verde', '', 'Parkinsonia x ''Desert Museum''', 'Tree', 'Thornless hybrid; fast growing; prune to raise the canopy.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"20–25 ft tall and wide"},{"name":"Bloom","value":"Yellow, spring"}]'::jsonb, 0),
  ('landscape', 'plant', 'Chilean Mesquite', '', 'Prosopis chilensis', 'Tree', 'Fast shade tree; thin the canopy before monsoon winds.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"25–30 ft tall and wide"},{"name":"Bloom","value":"Yellow-green catkins, spring"}]'::jsonb, 1),
  ('landscape', 'plant', 'Honey Mesquite', '', 'Prosopis glandulosa', 'Tree', 'Native; deep roots; can have thorns.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"20–30 ft tall and wide"},{"name":"Bloom","value":"Yellow catkins, spring"}]'::jsonb, 2),
  ('landscape', 'plant', 'Desert Willow', '', 'Chilopsis linearis', 'Tree', 'Native; drops leaves in winter; attracts hummingbirds.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"15–25 ft tall"},{"name":"Bloom","value":"Pink to purple, late spring to fall"}]'::jsonb, 3),
  ('landscape', 'plant', 'Texas Ebony', '', 'Ebenopsis ebano', 'Tree', 'Slow growing, dense evergreen; thorny.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"15–25 ft tall"},{"name":"Bloom","value":"Cream, summer"}]'::jsonb, 4),
  ('landscape', 'plant', 'Sweet Acacia', '', 'Vachellia farnesiana', 'Tree', 'Thorny; good as a small patio tree.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"15–20 ft tall and wide"},{"name":"Bloom","value":"Fragrant yellow puffs, late winter"}]'::jsonb, 5),
  ('landscape', 'plant', 'Shoestring Acacia', '', 'Acacia stenophylla', 'Tree', 'Narrow weeping look; good for tight spaces.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"20–30 ft tall, 15 ft wide"},{"name":"Bloom","value":"Cream, fall to winter"}]'::jsonb, 6),
  ('landscape', 'plant', 'Mulga', '', 'Acacia aneura', 'Tree', 'Silvery evergreen; very drought tolerant.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"15–20 ft tall"},{"name":"Bloom","value":"Yellow, spring and after rain"}]'::jsonb, 7),
  ('landscape', 'plant', 'Chinese Pistache', '', 'Pistacia chinensis', 'Tree', 'Strong fall color; handles heat well.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Moderate"},{"name":"Mature size","value":"25–35 ft tall and wide"},{"name":"Bloom","value":"Not showy"}]'::jsonb, 8),
  ('landscape', 'plant', 'Mondell Pine', '', 'Pinus eldarica', 'Tree', 'Common desert pine; needs deep watering.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Moderate"},{"name":"Mature size","value":"30–50 ft tall"},{"name":"Bloom","value":"None"}]'::jsonb, 9),
  ('landscape', 'plant', 'Fruitless Olive', '', 'Olea europaea ''Swan Hill''', 'Tree', 'Fruitless, low-pollen olive; Las Vegas restricts pollen-producing olives.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"20–25 ft tall and wide"},{"name":"Bloom","value":"Very little pollen"}]'::jsonb, 10),
  ('landscape', 'plant', 'Mexican Fan Palm', '', 'Washingtonia robusta', 'Palm', 'Tall slim trunk; trim fronds and seed stalks yearly.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"60–80 ft tall"},{"name":"Bloom","value":"Small cream flowers, summer"}]'::jsonb, 11),
  ('landscape', 'plant', 'California Fan Palm', '', 'Washingtonia filifera', 'Palm', 'Native; thick trunk; hardier to cold than Mexican fan palm.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"30–60 ft tall"},{"name":"Bloom","value":"Cream, summer"}]'::jsonb, 12),
  ('landscape', 'plant', 'Canary Island Date Palm', '', 'Phoenix canariensis', 'Palm', 'Heavy crown; spines at the frond base, wear gloves when trimming.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"40–60 ft tall, 30 ft wide"},{"name":"Bloom","value":"Cream, spring"}]'::jsonb, 13),
  ('landscape', 'plant', 'Date Palm', '', 'Phoenix dactylifera', 'Palm', 'Often multi-trunk; female trees drop messy fruit.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Moderate"},{"name":"Mature size","value":"50–80 ft tall"},{"name":"Bloom","value":"Cream, spring"}]'::jsonb, 14),
  ('landscape', 'plant', 'Mediterranean Fan Palm', '', 'Chamaerops humilis', 'Palm', 'Slow, clumping, cold hardy.', 'each', '[{"name":"Sun","value":"Full sun to part shade"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"6–15 ft tall, clumping"},{"name":"Bloom","value":"Yellow, spring"}]'::jsonb, 15),
  ('landscape', 'plant', 'Sago Palm', '', 'Cycas revoluta', 'Accent', 'Not a true palm; toxic to pets; protect from afternoon sun.', 'each', '[{"name":"Sun","value":"Part shade"},{"name":"Water","value":"Moderate"},{"name":"Mature size","value":"3–6 ft tall"},{"name":"Bloom","value":"None"}]'::jsonb, 16),
  ('landscape', 'plant', 'Texas Ranger', '', 'Leucophyllum frutescens', 'Shrub', 'Avoid shearing into balls; prune lightly to keep blooms.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"5–8 ft tall and wide"},{"name":"Bloom","value":"Purple, after summer rain"}]'::jsonb, 17),
  ('landscape', 'plant', 'Red Bird of Paradise', '', 'Caesalpinia pulcherrima', 'Shrub', 'Freezes back in winter; cut to 1 ft in late winter.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"6–10 ft tall and wide"},{"name":"Bloom","value":"Red-orange, summer"}]'::jsonb, 18),
  ('landscape', 'plant', 'Yellow Bird of Paradise', '', 'Erythrostemon gilliesii', 'Shrub', 'Formerly Caesalpinia gilliesii; seed pods are toxic.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"5–10 ft tall"},{"name":"Bloom","value":"Yellow with red stamens, summer"}]'::jsonb, 19),
  ('landscape', 'plant', 'Oleander', '', 'Nerium oleander', 'Shrub', 'All parts are toxic; dwarf varieties stay smaller.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"8–12 ft tall"},{"name":"Bloom","value":"Pink, red or white, spring to fall"}]'::jsonb, 20),
  ('landscape', 'plant', 'Feathery Cassia', '', 'Senna artemisioides', 'Shrub', 'Silvery evergreen; prune after bloom.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"4–6 ft tall and wide"},{"name":"Bloom","value":"Yellow, late winter to spring"}]'::jsonb, 21),
  ('landscape', 'plant', 'Creosote Bush', '', 'Larrea tridentata', 'Shrub', 'Native; smells of rain; do not overwater.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"4–8 ft tall"},{"name":"Bloom","value":"Small yellow, spring"}]'::jsonb, 22),
  ('landscape', 'plant', 'Jojoba', '', 'Simmondsia chinensis', 'Shrub', 'Native evergreen; takes shearing for hedges.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"4–6 ft tall and wide"},{"name":"Bloom","value":"Not showy"}]'::jsonb, 23),
  ('landscape', 'plant', 'Yellow Bells', '', 'Tecoma stans', 'Shrub', 'Frost tender; cut back after a freeze.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"6–10 ft tall"},{"name":"Bloom","value":"Yellow trumpets, spring to fall"}]'::jsonb, 24),
  ('landscape', 'plant', 'Baja Fairy Duster', '', 'Calliandra californica', 'Shrub', 'Hummingbird favorite; protect from hard frost.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"4–5 ft tall and wide"},{"name":"Bloom","value":"Red puffs, most of the year"}]'::jsonb, 25),
  ('landscape', 'plant', 'Autumn Sage', '', 'Salvia greggii', 'Shrub', 'Shear lightly after bloom.', 'each', '[{"name":"Sun","value":"Full sun to part shade"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"2–3 ft tall and wide"},{"name":"Bloom","value":"Red, pink or white, spring and fall"}]'::jsonb, 26),
  ('landscape', 'plant', 'Rosemary', '', 'Salvia rosmarinus', 'Shrub', 'Upright and trailing forms; avoid wet soil.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"2–4 ft tall"},{"name":"Bloom","value":"Blue, winter to spring"}]'::jsonb, 27),
  ('landscape', 'plant', 'Lantana', '', 'Lantana camara', 'Shrub', 'Frost tender; cut back in late winter; berries are toxic.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"3–5 ft tall"},{"name":"Bloom","value":"Mixed colors, spring to fall"}]'::jsonb, 28),
  ('landscape', 'plant', 'Trailing Lantana', '', 'Lantana montevidensis', 'Groundcover', 'Good spill-over plant for borders.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"1–2 ft tall, 4–6 ft wide"},{"name":"Bloom","value":"Purple or white, spring to fall"}]'::jsonb, 29),
  ('landscape', 'plant', 'Damianita', '', 'Chrysactinia mexicana', 'Groundcover', 'Aromatic; shear after bloom.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"1–2 ft tall and wide"},{"name":"Bloom","value":"Yellow daisies, spring and fall"}]'::jsonb, 30),
  ('landscape', 'plant', 'Blackfoot Daisy', '', 'Melampodium leucanthum', 'Groundcover', 'Native; needs excellent drainage.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"1 ft tall, 1–2 ft wide"},{"name":"Bloom","value":"White daisies, spring to fall"}]'::jsonb, 31),
  ('landscape', 'plant', 'Desert Marigold', '', 'Baileya multiradiata', 'Groundcover', 'Native; reseeds; short lived.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"1–1.5 ft tall"},{"name":"Bloom","value":"Yellow, spring to fall"}]'::jsonb, 32),
  ('landscape', 'plant', 'Myoporum', '', 'Myoporum parvifolium', 'Groundcover', 'Fast groundcover; can die out with too little water.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"3–6 in tall, 6–9 ft wide"},{"name":"Bloom","value":"Small white, spring"}]'::jsonb, 33),
  ('landscape', 'plant', 'Parry''s Penstemon', '', 'Penstemon parryi', 'Perennial', 'Native wildflower; reseeds.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"2–4 ft tall in bloom"},{"name":"Bloom","value":"Pink spikes, spring"}]'::jsonb, 34),
  ('landscape', 'plant', 'Red Yucca', '', 'Hesperaloe parviflora', 'Accent', 'Not a true yucca; remove old bloom stalks.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"3 ft tall, 4 ft wide; 5 ft bloom spikes"},{"name":"Bloom","value":"Coral-red, spring to fall"}]'::jsonb, 35),
  ('landscape', 'plant', 'Century Plant', '', 'Agave americana', 'Succulent', 'Sharp spines; plant away from walkways.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"6 ft tall, 10 ft wide"},{"name":"Bloom","value":"Tall stalk once, then dies"}]'::jsonb, 36),
  ('landscape', 'plant', 'Parry''s Agave', '', 'Agave parryi', 'Succulent', 'Compact, cold hardy agave; produces pups.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"2 ft tall, 2–3 ft wide"},{"name":"Bloom","value":"Yellow stalk once, then dies"}]'::jsonb, 37),
  ('landscape', 'plant', 'Beaked Yucca', '', 'Yucca rostrata', 'Accent', 'Blue-gray rosette on a trunk; slow growing.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"6–12 ft tall with age"},{"name":"Bloom","value":"White, spring"}]'::jsonb, 38),
  ('landscape', 'plant', 'Joshua Tree', '', 'Yucca brevifolia', 'Accent', 'Protected native; use tagged nursery stock and check permits before moving one.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"15–30 ft tall"},{"name":"Bloom","value":"Cream, spring"}]'::jsonb, 39),
  ('landscape', 'plant', 'Desert Spoon', '', 'Dasylirion wheeleri', 'Accent', 'Saw-tooth leaves; low maintenance.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"3–5 ft tall and wide"},{"name":"Bloom","value":"Tall stalk, summer"}]'::jsonb, 40),
  ('landscape', 'plant', 'Ocotillo', '', 'Fouquieria splendens', 'Cactus', 'Leafs out after rain; do not overwater.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"10–20 ft tall"},{"name":"Bloom","value":"Red tips, spring"}]'::jsonb, 41),
  ('landscape', 'plant', 'Golden Barrel Cactus', '', 'Kroenleinia grusonii', 'Cactus', 'Formerly Echinocactus grusonii; can sunburn when newly planted.', 'each', '[{"name":"Sun","value":"Full sun to light shade"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"2–3 ft tall and wide"},{"name":"Bloom","value":"Yellow, summer"}]'::jsonb, 42),
  ('landscape', 'plant', 'Prickly Pear', '', 'Opuntia spp.', 'Cactus', 'Many species; glochids stick to skin, wear gloves.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Very low"},{"name":"Mature size","value":"3–6 ft tall"},{"name":"Bloom","value":"Yellow, spring"}]'::jsonb, 43),
  ('landscape', 'plant', 'Aloe Vera', '', 'Aloe vera', 'Succulent', 'Protect from frost and harsh afternoon sun.', 'each', '[{"name":"Sun","value":"Part shade"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"1–2 ft tall"},{"name":"Bloom","value":"Yellow spikes, spring"}]'::jsonb, 44),
  ('landscape', 'plant', 'Deer Grass', '', 'Muhlenbergia rigens', 'Grass', 'Cut back hard in late winter.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"3–4 ft tall and wide"},{"name":"Bloom","value":"Tan spikes, summer"}]'::jsonb, 45),
  ('landscape', 'plant', 'Pink Muhly', '', 'Muhlenbergia capillaris', 'Grass', 'Cut back in late winter.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"2–3 ft tall and wide"},{"name":"Bloom","value":"Pink plumes, fall"}]'::jsonb, 46),
  ('landscape', 'plant', 'Bermuda Grass', '', 'Cynodon dactylon', 'Turf', 'Las Vegas rules limit non-functional turf; check before installing new lawn.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Moderate to high"},{"name":"Mature size","value":"Lawn"},{"name":"Bloom","value":"None"}]'::jsonb, 47),
  ('landscape', 'plant', 'Cat''s Claw Vine', '', 'Dolichandra unguis-cati', 'Vine', 'Clings to walls; aggressive, keep trimmed.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"Climbs 20–30 ft"},{"name":"Bloom","value":"Yellow, spring"}]'::jsonb, 48),
  ('landscape', 'plant', 'Lady Banks Rose', '', 'Rosa banksiae', 'Vine', 'Thornless climbing rose; prune after spring bloom.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low to moderate"},{"name":"Mature size","value":"Climbs 15–20 ft"},{"name":"Bloom","value":"Yellow or white, spring"}]'::jsonb, 49),
  ('landscape', 'plant', 'Star Jasmine', '', 'Trachelospermum jasminoides', 'Vine', 'Protect from afternoon sun in summer.', 'each', '[{"name":"Sun","value":"Part shade"},{"name":"Water","value":"Moderate"},{"name":"Mature size","value":"Climbs 10–20 ft"},{"name":"Bloom","value":"Fragrant white, spring"}]'::jsonb, 50),
  ('landscape', 'plant', 'Bougainvillea', '', 'Bougainvillea spp.', 'Vine', 'Frost tender in Las Vegas; plant against a south or west wall.', 'each', '[{"name":"Sun","value":"Full sun"},{"name":"Water","value":"Low"},{"name":"Mature size","value":"10–20 ft"},{"name":"Bloom","value":"Magenta, red, orange, spring to fall"}]'::jsonb, 51),
  ('hardscape', 'paver', 'Holland Stone', 'Belgard', NULL, 'Pavers', 'Classic rectangular paver for patios, walkways and driveways. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 0),
  ('hardscape', 'paver', 'Catalina Grana', 'Belgard', NULL, 'Pavers', 'Multi-size paver with a textured, natural-stone look. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 1),
  ('hardscape', 'paver', 'Dublin Cobble', 'Belgard', NULL, 'Pavers', 'Tumbled cobble look in several sizes. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 2),
  ('hardscape', 'paver', 'Mega-Arbel', 'Belgard', NULL, 'Pavers', 'Large-format paver with a stone texture. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 3),
  ('hardscape', 'paver', 'Lafitt Rustic Slab', 'Belgard', NULL, 'Slabs', 'Slab with a weathered, rustic face. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 4),
  ('hardscape', 'paver', 'Origins', 'Belgard', NULL, 'Pavers', 'Linear modern paver in mixed sizes. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 5),
  ('hardscape', 'paver', 'Holland Stone', 'Pavestone', NULL, 'Pavers', 'Rectangular paver for patios, walkways and driveways. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 6),
  ('hardscape', 'paver', 'Venetian Stone', 'Pavestone', NULL, 'Pavers', 'Old-world tumbled look in mixed sizes. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 7),
  ('hardscape', 'paver', 'Plaza Stone', 'Pavestone', NULL, 'Pavers', 'Multi-piece paver with a natural stone look. Starter list: confirm sizes, colors and pricing with your local supplier.', 'sq ft', '[]'::jsonb, 8),
  ('hardscape', 'wall_block', 'Diamond Pro Retaining Wall', 'Belgard', NULL, 'Retaining wall', 'Segmental retaining wall block. Starter list: confirm sizes, colors and pricing with your local supplier.', 'each', '[]'::jsonb, 9),
  ('hardscape', 'wall_block', 'Wall cap', 'Belgard', NULL, 'Wall caps', 'Cap units to finish walls and seat walls. Starter list: confirm sizes, colors and pricing with your local supplier.', 'each', '[]'::jsonb, 10),
  ('hardscape', 'base', 'Type II aggregate base', '', NULL, 'Base', 'Compactable road base under pavers and slabs. Usually 4 in for walkways, 6–8 in for driveways. Starter list: confirm sizes, colors and pricing with your local supplier.', 'ton', '[]'::jsonb, 11),
  ('hardscape', 'base', '3/4 in crushed rock', '', NULL, 'Base', 'Clean drainage rock for permeable bases and drains. Starter list: confirm sizes, colors and pricing with your local supplier.', 'ton', '[]'::jsonb, 12),
  ('hardscape', 'sand', 'Bedding sand (concrete sand)', '', NULL, 'Bedding', 'Coarse washed sand screeded about 1 in thick under pavers. Starter list: confirm sizes, colors and pricing with your local supplier.', 'ton', '[]'::jsonb, 13),
  ('hardscape', 'sand', 'Polymeric joint sand', 'Alliance Gator', NULL, 'Joint sand', 'Swept into joints and wetted to lock pavers and limit weeds. Starter list: confirm sizes, colors and pricing with your local supplier.', 'bag', '[]'::jsonb, 14),
  ('hardscape', 'sand', 'Polymeric joint sand', 'Techniseal', NULL, 'Joint sand', 'Swept into joints and wetted to lock pavers and limit weeds. Starter list: confirm sizes, colors and pricing with your local supplier.', 'bag', '[]'::jsonb, 15),
  ('hardscape', 'fabric', 'Non-woven geotextile fabric', '', NULL, 'Fabric', 'Separates base from native soil. Starter list: confirm sizes, colors and pricing with your local supplier.', 'roll', '[]'::jsonb, 16),
  ('hardscape', 'edging', 'Paver edge restraint (plastic)', '', NULL, 'Edging', 'Holds the paver field in place; spike every 12 in. Starter list: confirm sizes, colors and pricing with your local supplier.', 'linear ft', '[]'::jsonb, 17),
  ('hardscape', 'edging', 'Concrete curb / mow strip', '', NULL, 'Edging', 'Poured concrete edge between pavers and planting areas. Starter list: confirm sizes, colors and pricing with your local supplier.', 'linear ft', '[]'::jsonb, 18),
  ('hardscape', 'sealer', 'Paver sealer', 'Seal-N-Lock', NULL, 'Sealer', 'Protects color and helps stabilize joint sand. Starter list: confirm sizes, colors and pricing with your local supplier.', 'gallon', '[]'::jsonb, 19),
  ('hardscape', 'sealer', 'Paver sealer', 'Techniseal', NULL, 'Sealer', 'Protects color and repels stains. Starter list: confirm sizes, colors and pricing with your local supplier.', 'gallon', '[]'::jsonb, 20),
  ('hardscape', 'rock', 'Decomposed granite (DG)', '', NULL, 'Landscape rock', 'Fine crushed granite for paths and between plants; can be stabilized. Starter list: confirm sizes, colors and pricing with your local supplier.', 'ton', '[]'::jsonb, 21),
  ('hardscape', 'rock', 'Landscape rock 3/4 in', '', NULL, 'Landscape rock', 'Desert ground cover rock; colors vary by rock yard. Starter list: confirm sizes, colors and pricing with your local supplier.', 'ton', '[]'::jsonb, 22),
  ('hardscape', 'rock', 'Rip rap 4–8 in', '', NULL, 'Landscape rock', 'Larger rock for washes, drainage and erosion control. Starter list: confirm sizes, colors and pricing with your local supplier.', 'ton', '[]'::jsonb, 23)
ON CONFLICT DO NOTHING;
