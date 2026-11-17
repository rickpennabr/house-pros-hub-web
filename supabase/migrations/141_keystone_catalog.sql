-- Keystone Hardscapes catalog (Las Vegas / Southwest), from the 2020 Las Vegas catalog Vol. III.
-- Same shape as 133_las_vegas_paver_catalog.sql: brands → base_products → product_variants (+ product_images).
-- Safe to run more than once. Does not touch the older Keystone demo products from 085.
-- Pallet weight, applications and per-size notes have no column, so they live in product_note.
-- Colors and availability vary by plant and production run; confirm with Bedrock Landscape Supply or SiteOne.

insert into public.brands (brand_name) values ('Keystone')
on conflict (brand_name) do nothing;

insert into public.colors (color_name) values
  ('Antique Pewter'),
  ('Charcoal'),
  ('Sierra Blend'),
  ('Old Town Blend'),
  ('Sand Brown'),
  ('Sand Brown Charcoal'),
  ('Santa Barbara Blend'),
  ('Tan Brown'),
  ('Three Tone Brown'),
  ('Dark Brown'),
  ('Buff')
on conflict (color_name) do nothing;

-- Reuse the thickness rows the Las Vegas Paver catalog uses so filters show one 45 / 60 / 80 mm each.
insert into public.thicknesses (thickness_mm, thickness_in) values
  ('45', '2'),
  ('60', '2.5'),
  ('80', '3.15')
on conflict (thickness_mm, thickness_in) do nothing;

create or replace function public._ks_product(p_name text, p_type text, p_note text)
returns integer
language plpgsql
as $$
declare
  v_brand_id integer;
  v_product_id integer;
begin
  select brand_id into v_brand_id from public.brands where brand_name = 'Keystone';
  select p.base_product_id into v_product_id
  from public.base_products p
  where p.brand_id = v_brand_id and lower(p.product_name) = lower(p_name)
  limit 1;
  if v_product_id is null then
    insert into public.base_products (brand_id, product_name, product_type, product_note)
    values (v_brand_id, p_name, p_type, p_note)
    returning base_product_id into v_product_id;
  end if;
  return v_product_id;
end;
$$;

-- p_rows: [{ size, thickness_mm (null for walls), sqft_pallet, pcs_pallet, colors? }]
-- A row's own "colors" replaces p_colors (e.g. Charcoal only on Plaza rectangles).
create or replace function public._ks_variants(p_name text, p_colors text[], p_rows jsonb)
returns void
language plpgsql
as $$
declare
  v_product_id integer;
  v_row jsonb;
  v_colors text[];
  v_color text;
  v_color_id integer;
  v_thickness_id integer;
  v_mm text;
begin
  select p.base_product_id into v_product_id
  from public.base_products p
  join public.brands b on b.brand_id = p.brand_id
  where b.brand_name = 'Keystone' and lower(p.product_name) = lower(p_name)
  limit 1;
  if v_product_id is null then
    raise exception 'Missing Keystone product %', p_name;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_mm := v_row->>'thickness_mm';
    v_thickness_id := null;
    if v_mm is not null then
      select thickness_id into v_thickness_id
      from public.thicknesses
      where thickness_mm = v_mm
      order by thickness_id
      limit 1;
    end if;

    if v_row ? 'colors' then
      select array_agg(value) into v_colors from jsonb_array_elements_text(v_row->'colors');
    else
      v_colors := p_colors;
    end if;

    foreach v_color in array v_colors
    loop
      select color_id into v_color_id from public.colors where lower(color_name) = lower(v_color) limit 1;
      if v_color_id is null then
        insert into public.colors (color_name) values (v_color) returning color_id into v_color_id;
      end if;

      insert into public.product_variants (
        base_product_id, color_id, thickness_id, product_name, size,
        sqft_pallet, sqft_layer, lnft_pallet, layer_pallet, pcs_pallet
      )
      select
        v_product_id, v_color_id, v_thickness_id, p_name, v_row->>'size',
        coalesce((v_row->>'sqft_pallet')::integer, 0), 0, 0, 0,
        coalesce((v_row->>'pcs_pallet')::integer, 0)
      where not exists (
        select 1 from public.product_variants pv
        where pv.base_product_id = v_product_id
          and pv.color_id = v_color_id
          and pv.thickness_id is not distinct from v_thickness_id
          and pv.size = v_row->>'size'
      );
    end loop;
  end loop;
end;
$$;

-- Attach an image to every variant of a product in one color.
create or replace function public._ks_image(p_name text, p_color text, p_path text)
returns void
language sql
as $$
  insert into public.product_images (variant_id, image_path)
  select pv.variant_id, p_path
  from public.product_variants pv
  join public.base_products p on p.base_product_id = pv.base_product_id
  join public.brands b on b.brand_id = p.brand_id
  join public.colors c on c.color_id = pv.color_id
  where b.brand_name = 'Keystone'
    and lower(p.product_name) = lower(p_name)
    and lower(c.color_name) = lower(p_color)
  on conflict (variant_id, image_path) do nothing;
$$;

do $$
begin
  -- Pavers
  perform public._ks_product('CityScape Symetry', 'Paver',
    'L-Unit (#656, 6 1/8 x 11 15/16 in) and Square (#666, 5 15/16 x 5 15/16 in), 60 mm. Pedestrian, light and medium vehicular: patios, driveways. Pallet: L-Unit 2,268 lb, Square 2,688 lb.');
  perform public._ks_variants('CityScape Symetry', array['Sierra Blend', 'Tan Brown', 'Buff', 'Dark Brown'], '[
    {"size":"6x12 L-Unit","thickness_mm":"60","sqft_pallet":81,"pcs_pallet":280},
    {"size":"6x6 Square","thickness_mm":"60","sqft_pallet":96,"pcs_pallet":400}
  ]'::jsonb);

  perform public._ks_product('CityStone 6x9', 'Paver',
    'Modern rectangle (#297, 5 15/16 x 8 7/8 in), 60 mm. Use alone or with other CityStone units. Pedestrian, light and medium vehicular. Pallet 2,520 lb.');
  perform public._ks_variants('CityStone 6x9', array['Antique Pewter', 'Charcoal'], '[
    {"size":"6x9","thickness_mm":"60","sqft_pallet":90,"pcs_pallet":250}
  ]'::jsonb);

  perform public._ks_product('CityStone Demi', 'Paver',
    'Bundle #363: 4x8, 8x8 and 8x12, 60 mm. Lay alone as 3-piece or with Supra as a 6-piece system. Pedestrian, light and medium vehicular, patios, plazas. Pallet 2,884 lb. Pieces per pallet vary by bundle.');
  perform public._ks_variants('CityStone Demi',
    array['Antique Pewter', 'Santa Barbara Blend', 'Sierra Blend', 'Old Town Blend', 'Sand Brown Charcoal'], '[
    {"size":"Demi bundle (4x8, 8x8, 8x12)","thickness_mm":"60","sqft_pallet":103,"pcs_pallet":0}
  ]'::jsonb);

  perform public._ks_product('CityStone Supra', 'Paver',
    'Bundle #364: 8x16, 16x16 and 16x24, 60 mm. Lay alone as 3-piece or with Demi as a 6-piece system. Pedestrian, light and medium vehicular, patios, plazas. Pallet 2,884 lb. Pieces per pallet vary by bundle.');
  perform public._ks_variants('CityStone Supra',
    array['Antique Pewter', 'Santa Barbara Blend', 'Sierra Blend', 'Sand Brown Charcoal', 'Three Tone Brown'], '[
    {"size":"Supra bundle (8x16, 16x16, 16x24)","thickness_mm":"60","sqft_pallet":103,"pcs_pallet":0}
  ]'::jsonb);

  perform public._ks_product('Coping Stone', 'Coping',
    'Coping #301 (3 1/2 x 9 in), 60 mm. Pool edges, entryways, steps and finished edges. Pallet 1,490 lb. Sold by piece, no sqft rating.');
  perform public._ks_variants('Coping Stone', array['Charcoal', 'Dark Brown', 'Sierra Blend'], '[
    {"size":"3.5x9","thickness_mm":"60","sqft_pallet":0,"pcs_pallet":300}
  ]'::jsonb);

  perform public._ks_product('Holland Stone', 'Paver',
    'Classic rectangle (3 15/16 x 7 7/8 in): #217 60 mm, #220 45 mm. Runner bond, herringbone, parquet. Pedestrian through heavy vehicular: driveways, patios, walkways. Pallet: 60 mm 2,884 lb, 45 mm 3,024 lb.');
  perform public._ks_variants('Holland Stone',
    array['Antique Pewter', 'Charcoal', 'Old Town Blend', 'Sand Brown', 'Sand Brown Charcoal', 'Sierra Blend', 'Tan Brown', 'Three Tone Brown'], '[
    {"size":"4x8","thickness_mm":"60","sqft_pallet":103,"pcs_pallet":480},
    {"size":"4x8","thickness_mm":"45","sqft_pallet":145,"pcs_pallet":672}
  ]'::jsonb);

  perform public._ks_product('Plaza Stone', 'Paver',
    'Pillow-top squares (5 1/2 x 5 1/2 in) and rectangles (5 1/2 x 8 1/4 in). 45 mm (#642, #611) is non-vehicular: patios, walkways, pool decks. 60 mm (#646, #605) pedestrian, light and medium vehicular. 80 mm (#648, #607) medium and heavy vehicular, streetscapes. Charcoal in rectangles only. Pallet lb: 45 mm 2,982 / 3,377; 60 mm 2,800 / 3,204; 80 mm 2,880 / 2,736.');
  perform public._ks_variants('Plaza Stone', array[]::text[], '[
    {"size":"5.5x5.5 Square","thickness_mm":"45","sqft_pallet":140,"pcs_pallet":672,
     "colors":["Antique Pewter","Old Town Blend","Sand Brown Charcoal","Sierra Blend","Tan Brown"]},
    {"size":"5.5x8.25 Rectangle","thickness_mm":"45","sqft_pallet":160,"pcs_pallet":504,
     "colors":["Antique Pewter","Charcoal","Old Town Blend","Sand Brown Charcoal","Sierra Blend","Tan Brown"]},
    {"size":"5.5x5.5 Square","thickness_mm":"60","sqft_pallet":100,"pcs_pallet":480,
     "colors":["Antique Pewter","Old Town Blend","Sand Brown","Sand Brown Charcoal","Santa Barbara Blend","Sierra Blend","Three Tone Brown"]},
    {"size":"5.5x8.25 Rectangle","thickness_mm":"60","sqft_pallet":112,"pcs_pallet":360,
     "colors":["Antique Pewter","Charcoal","Old Town Blend","Sand Brown","Sand Brown Charcoal","Santa Barbara Blend","Sierra Blend","Three Tone Brown"]},
    {"size":"5.5x5.5 Square","thickness_mm":"80","sqft_pallet":80,"pcs_pallet":384,"colors":["Sierra Blend"]},
    {"size":"5.5x8.25 Rectangle","thickness_mm":"80","sqft_pallet":76,"pcs_pallet":240,"colors":["Sierra Blend"]}
  ]'::jsonb);

  perform public._ks_product('Plaza Stone Combos & Giant', 'Paver',
    'Pillow-top multi-size for random or patterned layouts, 60 mm. 3-pc combo #641 (2,971 lb pallet), 2-pc combo #626 (2,800 lb), Giant #649 8 1/4 x 11 in (2,828 lb). Pieces per pallet for combos vary.');
  perform public._ks_variants('Plaza Stone Combos & Giant', array['Sierra Blend'], '[
    {"size":"3-pc combo (2.75x5.5, 5.5x5.5, 5.5x8.25)","thickness_mm":"60","sqft_pallet":106,"pcs_pallet":0},
    {"size":"2-pc combo (2.75x5.5, 4.125x5.5)","thickness_mm":"60","sqft_pallet":100,"pcs_pallet":0},
    {"size":"Giant 8.25x11","thickness_mm":"60","sqft_pallet":101,"pcs_pallet":160}
  ]'::jsonb);

  perform public._ks_product('Plaza Stone Circle', 'Paver',
    'Circle pack #637, 60 mm: 10 center, 20 wedge, 280 trapezoid, 10 twinkie and 220 three-quarter square pieces. Makes about a 116 in circle; extend with other Plaza Stone. Pallet 2,352 lb.');
  perform public._ks_variants('Plaza Stone Circle', array['Sierra Blend'], '[
    {"size":"Circle kit (about 116 in)","thickness_mm":"60","sqft_pallet":84,"pcs_pallet":540}
  ]'::jsonb);

  perform public._ks_product('Venetian', 'Paver',
    'Flagstone-look texture, 60 mm: combo #267 (100 6x6 + 200 6x9), 6x12 #269, 12x12 #270. Pedestrian and light vehicular, patios, driveways, feature areas. Old Town Blend and Three Tone Brown are matrix colors. Pallet lb: 2,660 / 2,680 / 3,228.');
  perform public._ks_variants('Venetian',
    array['Sand Brown Charcoal', 'Santa Barbara Blend', 'Sierra Blend', 'Old Town Blend', 'Three Tone Brown'], '[
    {"size":"Combo (6x6 + 6x9)","thickness_mm":"60","sqft_pallet":95,"pcs_pallet":300},
    {"size":"6x12","thickness_mm":"60","sqft_pallet":96,"pcs_pallet":200},
    {"size":"12x12","thickness_mm":"60","sqft_pallet":120,"pcs_pallet":120}
  ]'::jsonb);

  perform public._ks_product('Venetian Tumbled', 'Paver',
    'Tumbled Venetian, 60 mm: combo #267T (100 6x6 + 200 6x9), 6x12 #269T, 12x12 #270T. Same uses and pallets as Venetian.');
  perform public._ks_variants('Venetian Tumbled',
    array['Sand Brown Charcoal', 'Santa Barbara Blend', 'Sierra Blend', 'Old Town Blend', 'Three Tone Brown'], '[
    {"size":"Combo (6x6 + 6x9)","thickness_mm":"60","sqft_pallet":95,"pcs_pallet":300},
    {"size":"6x12","thickness_mm":"60","sqft_pallet":96,"pcs_pallet":200},
    {"size":"12x12","thickness_mm":"60","sqft_pallet":120,"pcs_pallet":120}
  ]'::jsonb);

  -- Walls: the catalog gives colors only. Sizes and pallets to fill in admin.
  perform public._ks_product('Harington 3-pc', 'Wall', 'Landscape wall system. Size and pallet details not in the catalog summary; update in admin.');
  perform public._ks_variants('Harington 3-pc', array['Old Town Blend', 'Sand Brown', 'Sand Brown Charcoal', 'Sierra Blend'],
    '[{"size":"3-pc wall","thickness_mm":null,"sqft_pallet":0,"pcs_pallet":0}]'::jsonb);

  perform public._ks_product('Harington Freestanding 3-pc', 'Wall', 'Freestanding wall system. Size and pallet details not in the catalog summary; update in admin.');
  perform public._ks_variants('Harington Freestanding 3-pc', array['Old Town Blend', 'Sand Brown', 'Sand Brown Charcoal', 'Sierra Blend'],
    '[{"size":"3-pc freestanding","thickness_mm":null,"sqft_pallet":0,"pcs_pallet":0}]'::jsonb);

  perform public._ks_product('Stonegate', 'Wall', 'Smooth-face wall system: gravity walls up to about 3 ft, freestanding walls, outdoor living. Size and pallet details: update in admin.');
  perform public._ks_variants('Stonegate', array['Antique Pewter', 'Old Town Blend', 'Sand Brown', 'Sand Brown Charcoal', 'Tan Brown'],
    '[{"size":"Wall unit","thickness_mm":null,"sqft_pallet":0,"pcs_pallet":0}]'::jsonb);

  perform public._ks_product('Rumblestone / Rumbled Wall', 'Wall', 'Rumbled wall collection. Size and pallet details: update in admin.');
  perform public._ks_variants('Rumblestone / Rumbled Wall', array['Sand Brown Charcoal', 'Sierra Blend', 'Old Town Blend'],
    '[{"size":"Wall unit","thickness_mm":null,"sqft_pallet":0,"pcs_pallet":0}]'::jsonb);

  -- Outdoor living kits (no colors or sizes in the catalog summary).
  perform public._ks_product('Round Fire Pit Kit (Harington)', 'Outdoor Living', 'Round fire pit kit built from Harington. Colors and kit contents: update in admin.');
  perform public._ks_product('Square Fire Pit Kit (Rumbled Wall)', 'Outdoor Living', 'Square fire pit kit built from Rumbled Wall. Colors and kit contents: update in admin.');
  perform public._ks_product('Fireplace Kit (Rumbled Wall)', 'Outdoor Living', 'Fireplace kit built from Rumbled Wall. Colors and kit contents: update in admin.');

  -- Images already in public/images/brands/keystone (paths are case-sensitive on the server).
  perform public._ks_image('Holland Stone', 'Old Town Blend', '/images/brands/keystone/holland/holland-colors/holland-old-town-blend.png');
  perform public._ks_image('Holland Stone', 'Sand Brown Charcoal', '/images/brands/keystone/holland/holland-colors/holland-sand-brown-charcoal.png');
  perform public._ks_image('Holland Stone', 'Sand Brown', '/images/brands/keystone/holland/holland-colors/holland-sand-brown.png');
  perform public._ks_image('Holland Stone', 'Sierra Blend', '/images/brands/keystone/holland/holland-colors/holland-sierra-blend.png');
  perform public._ks_image('Holland Stone', 'Old Town Blend', '/images/brands/keystone/holland/holland-projects/old-town-blend/holland-old-town-blend-1.jpg');
  perform public._ks_image('Holland Stone', 'Old Town Blend', '/images/brands/keystone/holland/holland-projects/old-town-blend/holland-old-town-blend-2.jpg');

  perform public._ks_image('Plaza Stone', 'Antique Pewter', '/images/brands/keystone/plaza/plaza-colors/plaza-antique-pewter.png');
  perform public._ks_image('Plaza Stone', 'Old Town Blend', '/images/brands/keystone/plaza/plaza-colors/plaza-old-town-blend.png');
  perform public._ks_image('Plaza Stone', 'Sand Brown Charcoal', '/images/brands/keystone/plaza/plaza-colors/plaza-sand-brown-charcoal.png');
  perform public._ks_image('Plaza Stone', 'Sand Brown', '/images/brands/keystone/plaza/plaza-colors/plaza-sand-brown.png');
  perform public._ks_image('Plaza Stone', 'Sierra Blend', '/images/brands/keystone/plaza/plaza-colors/plaza-sierra-blend.png');
  perform public._ks_image('Plaza Stone', 'Tan Brown', '/images/brands/keystone/plaza/plaza-colors/plaza-tan-brown.png');
  perform public._ks_image('Plaza Stone', 'Sierra Blend', '/images/brands/keystone/plaza/plaza-projects/sierra-blend/plaza-sierra-blend-project-1.jpg');
  perform public._ks_image('Plaza Stone', 'Sierra Blend', '/images/brands/keystone/plaza/plaza-projects/sierra-blend/plaza-sierra-blend-project-2.jpg');
  perform public._ks_image('Plaza Stone', 'Sierra Blend', '/images/brands/keystone/plaza/plaza-projects/sierra-blend/plaza-sierra-blend-project-3.jpg');
  perform public._ks_image('Plaza Stone', 'Sierra Blend', '/images/brands/keystone/plaza/plaza-projects/sierra-blend/plaza-sierra-blend-project-4.JPEG');

  perform public._ks_image('CityStone Demi', 'Antique Pewter', '/images/brands/keystone/demi/demi-colors/demi-antique-pewter.JPEG');
  perform public._ks_image('CityStone Demi', 'Old Town Blend', '/images/brands/keystone/demi/demi-colors/demi-old-town-blend.JPEG');
  perform public._ks_image('CityStone Demi', 'Sand Brown Charcoal', '/images/brands/keystone/demi/demi-colors/demi-sand-brown-charcoal.JPEG');
  perform public._ks_image('CityStone Demi', 'Sand Brown Charcoal', '/images/brands/keystone/demi/demi-projects/demi-sand-brown-charcoal-1.jpg');
  perform public._ks_image('CityStone Demi', 'Sand Brown Charcoal', '/images/brands/keystone/demi/demi-projects/demi-sand-brown-charcoal-2.jpg');

  perform public._ks_image('CityStone Supra', 'Antique Pewter', '/images/brands/keystone/supra/supra-colors/supra-antique-pewter.JPEG');
  perform public._ks_image('CityStone Supra', 'Sand Brown Charcoal', '/images/brands/keystone/supra/supra-colors/supra-sand-brown-charcoal.JPEG');
  perform public._ks_image('CityStone Supra', 'Three Tone Brown', '/images/brands/keystone/supra/supra-colors/supra-three-tone-brown.JPEG');
end;
$$;

drop function if exists public._ks_variants(text, text[], jsonb);
drop function if exists public._ks_image(text, text, text);
drop function if exists public._ks_product(text, text, text);
