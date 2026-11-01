-- Published blog posts for ProsBlog. Public read is limited to published rows.
-- Admin writes go through the service role.

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL DEFAULT 'en',
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text NOT NULL,
  region text NOT NULL DEFAULT 'Las Vegas Valley',
  cover_image_url text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_locale_check CHECK (locale IN ('en', 'es', 'pt')),
  CONSTRAINT blog_posts_category_check CHECK (category IN ('hardscape', 'landscape')),
  CONSTRAINT blog_posts_locale_slug_key UNIQUE (locale, slug)
);

CREATE INDEX IF NOT EXISTS blog_posts_public_list_idx
  ON public.blog_posts (locale, published_at DESC)
  WHERE published = true;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published blog posts" ON public.blog_posts;
CREATE POLICY "Public can view published blog posts"
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;

DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.blog_posts (
  locale, slug, title, excerpt, body, category, region, published, published_at
)
VALUES
(
  'en',
  'las-vegas-hardscape-that-holds-up',
  'Hardscape that holds up in a Las Vegas yard',
  'Pavers, travertine, porcelain, and walls for Summerlin, Henderson, and the rest of the valley — and why the base matters more than the stone.',
  $hph_hardscape$Las Vegas hardscape has to survive more than a pretty photo. Summer afternoons sit well over 110°F, monsoon rain shows up in short hard bursts, and a lot of valley lots sit on caliche or a thin layer of soil over rock. A patio that looks finished in March can rock, stain, or wash out by September if the base was thin.

This is a practical look at pavers, travertine, porcelain, and walls for the Las Vegas Valley: Summerlin, Henderson, Southern Highlands, North Las Vegas, and the neighborhoods in between.

## Start with the base, not the stone

The surface is what you see. The base is what keeps it flat.

On most valley installs the working stack is excavated soil, compacted Type 2 aggregate, a bedding layer, then the paver, travertine, or porcelain. Skimping on compaction is the usual reason a walkway dips near a gate or a pool deck lips at the coping. Edges need a restraint so the field does not creep, especially on sloped Summerlin and Henderson lots where the yard steps down toward a wash or a neighbor.

Drainage matters as much as compaction. Desert yards still flood. A patio that slopes back toward the house, a low spot at a sliding door, or a downspout dumping onto sand will move that sand the first time it rains. Plan the slope away from the structure, and give water a place to go before you pick a color.

Polymeric sand locks joints on pavers and travertine, but it needs a dry surface and a real cure. Installing it in July at noon, or washing it in before a storm, is how you get haze on the stone and sand that never sets.

## Materials that fit this climate

**Concrete pavers** are the workhorse for driveways, pool decks, and front walks. They handle traffic, and a single cracked unit can be pulled and replaced. Lighter colors stay cooler underfoot than a dark charcoal blend, which matters if the patio faces west in Centennial Hills or Mountains Edge.

**Travertine** is the pool-deck favorite because it stays cooler than concrete in direct sun. It is a natural stone, so thickness and finish vary. A honed or tumbled surface on a solid base does better here than a thin tile set on a skim coat. Seal it if you want fewer water marks, and plan on resealing.

**Porcelain pavers** show up on newer Henderson and Summerlin rears: large format, tight joints, and a surface that does not fade the way some concrete colors do. They need a flatter base and a setting method that matches the product. They are not a shortcut around drainage.

**Retaining walls and seat walls** do two jobs on sloped lots in Summerlin, Southern Highlands, and parts of Anthem. They hold the grade, and they make a flat pad you can actually use. A wall that holds soil needs drainage rock and a drain behind it. A short seat wall can be lighter, but it still should not become a dam for monsoon water.

## What changes by neighborhood

Flat lots in North Las Vegas and much of the central valley are mostly about compaction, irrigation sleeves, and keeping the patio from pitching toward the slab. The mistakes are familiar: a thin base, no edge restraint, and joints that were never locked.

West and south valley hills — Summerlin west of the 215, Southern Highlands, parts of Mountains Edge — add slope, view walls, and HOA rules about color and wall height. Match the community stone if the HOA has a standard. A wall that looks right from the yard and wrong from the street is the one that gets a letter.

Henderson, from Green Valley to Inspirada and Anthem, mixes older stucco houses with newer desert-modern yards. Older pool decks often need a reset more than new stone. The coping is fine, and the sand underneath is gone. A reset costs less than a full tear-out when the pavers themselves are still sound.

## When to bring in a pro

A homeowner can refresh polymeric sand and reset a few sunken pavers. A new driveway, a pool deck, or any wall holding soil is a licensed hardscape job. Grading, compaction, drainage, and HOA or permit questions are part of the work. If the yard also needs plants and drip, build the hardscape and the landscape together so sleeves, drains, and root space are in the plan before the stone goes down.$hph_hardscape$,
  'hardscape',
  'Las Vegas Valley',
  true,
  now()
),
(
  'en',
  'las-vegas-desert-landscape',
  'A desert landscape that belongs in Las Vegas',
  'Xeriscape, drip irrigation, and plants that stay alive from Henderson to Centennial Hills without a lawn-sized water bill.',
  $hph_landscape$A green lawn in Las Vegas is an expensive habit. The Southern Nevada Water Authority has spent years paying people to take turf out, and a July water bill explains why. A landscape that fits this valley uses less water, still looks finished from the street, and does not die the first week of June.

Here is how that plays out from Henderson and Green Valley to Centennial Hills, The Lakes, and North Las Vegas.

## Design for the sun you actually have

West and south walls are the hot ones. A young tree planted six inches off the stucco will scorch, and so will the wall. Give shade trees room. A desert museum palo verde, a shoestring acacia, or a mesquite can cool a patio, but only if the canopy is allowed to spread and the roots are not trapped in a two-foot hole punched into caliche.

Morning sun on the east side is kinder. That is where autumn sage, lantana, and red yucca actually bloom instead of stalling. North sides stay shadier and can hold plants that burn in a Summerlin west yard.

Rock mulch is the valley default, and it works when it is not a thin sprinkle over bare dirt. Two to three inches of decomposed granite or a larger decorative rock keeps the soil cooler and slows evaporation. Against the house, keep a gap so gravel is not piled on the weep screed.

## Plants that earn their water

Stick to plants that already live in this kind of heat:

- Palo verde and desert museum palo verde for light shade without a dense, messy canopy
- Mesquite where you have room and an HOA that allows it
- Red yucca, agave, and desert spoon for structure that stays put
- Lantana, autumn sage, and chuparosa for color that pollinators use
- A small lawn only where someone actually walks or plays, on its own irrigation valve

A ribbon of grass along a wall that nobody uses is just a water feature with extra steps.

## Drip is the system, spray is the exception

Spray heads on rock make sense for a lawn and almost nowhere else. Shrubs and trees want drip, on a separate schedule from grass, with emitters sized to the plant. A new tree does not want the same gallons per hour as a mature one, and a valve that runs both will overwater one of them.

Check the clock in April, before the heat, and again when nights finally cool off. A schedule left on July minutes through December is how a desert yard still wastes water. In North Las Vegas and older parts of Henderson, many systems were built for turf that is already gone. Those zones should be capped or rebuilt, not left spraying gravel.

## Neighborhood notes

**Green Valley and older Henderson** yards often still have spray heads, fescue, and a pine that is too big for the parkway strip. Converting the parkway and the side yards to drip and rock is the change that saves the most water. Leave a small lawn in the back if the family uses it.

**The Lakes and communities with water features** already spent the landscape budget on the lake edge. Keep new plants inside the community rules, and do not let irrigation run into the lake.

**Centennial Hills, Mountains Edge, and Southern Highlands** were built closer to desert codes. The yards look sparse on day one and fill in if the trees were planted in real holes, not in the nursery can. If a tree has not grown in two summers, the hole is probably sitting on caliche.

**North Las Vegas** lots are often flatter and windier. A row of shrubs on the west side does more for comfort than another boulder. Tie young trees until the roots lock in. Spring wind will lay a new palo verde over.

## Hardscape and plants are one project

Pavers, seat walls, and planting beds fail when they are drawn by two people who never talked. Leave pockets for trees before the patio is locked in. Run irrigation sleeves under walks. Do not set a raised planter so the drain dumps onto the house. If you are starting from a dirt yard or a turf removal, draw the stone and the plants on the same plan, then build the drainage first.

A Las Vegas landscape that lasts is usually quieter than the brochure: fewer species, more rock, trees in the right exposure, and a drip system somebody actually adjusts. That yard still looks like the valley, and it is still alive in August.$hph_landscape$,
  'landscape',
  'Las Vegas Valley',
  true,
  now()
)
ON CONFLICT (locale, slug) DO NOTHING;
