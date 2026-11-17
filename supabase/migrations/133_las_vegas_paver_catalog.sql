-- Las Vegas Paver catalog for House Pros Hub (Answer 2 + Answer 1 stubs).
-- Safe to run more than once. Does not remove existing demo products.
-- Target: House Pros Hub project pnwsavbxhbwhwyefccih.

insert into public.brands (brand_name) values
  ('Las Vegas Paver')
on conflict (brand_name) do nothing;

insert into public.colors (color_name) values
  ('Sahara'),
  ('Stardust'),
  ('Mirage'),
  ('Tuscany'),
  ('Tropicana'),
  ('Traditional Black'),
  ('Silverton'),
  ('Durango'),
  ('Gold Coast'),
  ('Aspen'),
  ('Riviera'),
  ('Black')
on conflict (color_name) do nothing;

insert into public.thicknesses (thickness_mm, thickness_in) values
  ('60', '2.5'),
  ('45', '2'),
  ('80', '3.15')
on conflict (thickness_mm, thickness_in) do nothing;

insert into public.base_products (brand_id, product_name, product_type, product_note)
select b.brand_id, v.product_name, v.product_type, v.product_note
from public.brands b
cross join (values
  (
    'Traditional Combo',
    'Paver',
    'Pillow-topped. 60mm sold as singles; 45mm sold as 3-piece combo. Traditional Black limited to 6x9 and 6x6 at 60mm singles. Source: https://www.lasvegaspaver.com/traditional-pavers. Partial pallets: 30% service charge. Fill missing sqft/layer and lnft in admin.'
  ),
  (
    'Urban Combo',
    'Paver',
    'Mitered to flat top. Sold as 3-piece combo (60mm or 45mm). Source: https://www.lasvegaspaver.com/urban-combo'
  ),
  (
    'Rugged Combo',
    'Paver',
    'Textured surface. Sold as 3-piece combo (60mm or 45mm). Source: https://www.lasvegaspaver.com/rugged-combo'
  ),
  (
    'Monumental Traditional Combo',
    'Paver',
    'Pillow-topped large format. 60mm 3-piece combo only. Source: https://www.lasvegaspaver.com/monumental-traditional-combo'
  ),
  (
    'Monumental Urban Combo',
    'Paver',
    'Mitered flat top large format. 60mm 3-piece combo only. Source: https://www.lasvegaspaver.com/monumental-urban-combo'
  ),
  (
    'Monumental Rugged Combo',
    'Paver',
    'Textured large format. 60mm 3-piece combo only. Source: https://www.lasvegaspaver.com/monumental-rugged-combo'
  ),
  (
    'Holland',
    'Paver',
    'Classic 4x8 rectangular. 60mm or 45mm; 80mm special order. Source: https://www.lasvegaspaver.com/holland'
  ),
  (
    'Circle Kits',
    'Paver',
    'Round or square pre-cut kits (about 4'' diameter at 60mm). Pair with standard pavers to extend diameter. Pallet/size details incomplete — update in admin.'
  ),
  (
    'Large Square',
    'Paver',
    '11x11 Square and 18x18 Large Square. Pallet details incomplete — update in admin.'
  ),
  (
    'Antique Split',
    'Paver',
    'Split texture. Size and pallet details incomplete — update in admin.'
  ),
  (
    'Bullnose & Pool Edge Coping',
    'Coping',
    '6x14 bullnose / pool edge coping. Pallet details incomplete — update in admin.'
  )
) as v(product_name, product_type, product_note)
where b.brand_name = 'Las Vegas Paver'
  and not exists (
    select 1
    from public.base_products p
    where p.brand_id = b.brand_id
      and lower(p.product_name) = lower(v.product_name)
  );

create or replace function public._lvp_seed_variants(
  p_product_name text,
  p_color_names text[],
  p_rows jsonb
) returns void
language plpgsql
as $$
declare
  v_product_id integer;
  v_row jsonb;
  v_color text;
  v_color_id integer;
  v_thickness_id integer;
  v_size text;
  v_mm text;
  v_inch text;
  v_sqft integer;
  v_pcs integer;
begin
  select p.base_product_id into v_product_id
  from public.base_products p
  join public.brands b on b.brand_id = p.brand_id
  where b.brand_name = 'Las Vegas Paver'
    and lower(p.product_name) = lower(p_product_name)
  limit 1;

  if v_product_id is null then
    raise exception 'Missing base product %', p_product_name;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_size := v_row->>'size';
    v_mm := v_row->>'thickness_mm';
    v_inch := v_row->>'thickness_in';
    v_sqft := coalesce((v_row->>'sqft_pallet')::integer, 0);
    v_pcs := coalesce((v_row->>'pcs_pallet')::integer, 0);

    select thickness_id into v_thickness_id
    from public.thicknesses
    where thickness_mm = v_mm and thickness_in = v_inch
    limit 1;

    if v_thickness_id is null then
      insert into public.thicknesses (thickness_mm, thickness_in)
      values (v_mm, v_inch)
      returning thickness_id into v_thickness_id;
    end if;

    foreach v_color in array p_color_names
    loop
      select color_id into v_color_id
      from public.colors
      where lower(color_name) = lower(v_color)
      limit 1;

      if v_color_id is null then
        insert into public.colors (color_name) values (v_color)
        returning color_id into v_color_id;
      end if;

      insert into public.product_variants (
        base_product_id, color_id, thickness_id, product_name, size,
        sqft_pallet, sqft_layer, lnft_pallet, layer_pallet, pcs_pallet
      )
      select
        v_product_id,
        v_color_id,
        v_thickness_id,
        p_product_name,
        v_size,
        v_sqft,
        0,
        0,
        0,
        v_pcs
      where not exists (
        select 1
        from public.product_variants pv
        where pv.base_product_id = v_product_id
          and pv.color_id = v_color_id
          and pv.thickness_id = v_thickness_id
          and pv.size = v_size
      );
    end loop;
  end loop;
end;
$$;

do $$
declare
  std text[] := array[
    'Tuscany', 'Tropicana', 'Stardust', 'Sahara', 'Aspen',
    'Mirage', 'Gold Coast', 'Durango', 'Silverton', 'Riviera'
  ];
  trad text[] := array[
    'Tuscany', 'Tropicana', 'Stardust', 'Sahara', 'Aspen',
    'Mirage', 'Gold Coast', 'Durango', 'Silverton', 'Riviera', 'Traditional Black'
  ];
  holland text[] := array[
    'Tuscany', 'Tropicana', 'Stardust', 'Sahara', 'Aspen',
    'Mirage', 'Gold Coast', 'Durango', 'Silverton', 'Riviera', 'Black'
  ];
begin
  perform public._lvp_seed_variants('Traditional Combo', trad, '[
    {"size":"6x9","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":100,"pcs_pallet":320},
    {"size":"6x6","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":100,"pcs_pallet":480},
    {"size":"3x6","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":50,"pcs_pallet":480},
    {"size":"6x9","thickness_mm":"45","thickness_in":"2","sqft_pallet":75,"pcs_pallet":240},
    {"size":"6x6","thickness_mm":"45","thickness_in":"2","sqft_pallet":17,"pcs_pallet":80},
    {"size":"3x6","thickness_mm":"45","thickness_in":"2","sqft_pallet":8,"pcs_pallet":80}
  ]'::jsonb);

  delete from public.product_variants pv
  using public.base_products p, public.brands b, public.colors c, public.thicknesses th
  where pv.base_product_id = p.base_product_id
    and p.brand_id = b.brand_id
    and b.brand_name = 'Las Vegas Paver'
    and lower(p.product_name) = 'traditional combo'
    and pv.color_id = c.color_id
    and lower(c.color_name) = 'traditional black'
    and (
      pv.size = '3x6'
      or (
        pv.thickness_id = th.thickness_id
        and th.thickness_mm = '45'
      )
    );

  perform public._lvp_seed_variants('Urban Combo', std, '[
    {"size":"6x9","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":75,"pcs_pallet":240},
    {"size":"6x6","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":17,"pcs_pallet":80},
    {"size":"3x6","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":8,"pcs_pallet":80},
    {"size":"6x9","thickness_mm":"45","thickness_in":"2","sqft_pallet":75,"pcs_pallet":240},
    {"size":"6x6","thickness_mm":"45","thickness_in":"2","sqft_pallet":17,"pcs_pallet":80},
    {"size":"3x6","thickness_mm":"45","thickness_in":"2","sqft_pallet":8,"pcs_pallet":80}
  ]'::jsonb);

  perform public._lvp_seed_variants('Rugged Combo', std, '[
    {"size":"6x9","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":75,"pcs_pallet":240},
    {"size":"6x6","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":17,"pcs_pallet":80},
    {"size":"3x6","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":8,"pcs_pallet":80},
    {"size":"6x9","thickness_mm":"45","thickness_in":"2","sqft_pallet":75,"pcs_pallet":240},
    {"size":"6x6","thickness_mm":"45","thickness_in":"2","sqft_pallet":17,"pcs_pallet":80},
    {"size":"3x6","thickness_mm":"45","thickness_in":"2","sqft_pallet":8,"pcs_pallet":80}
  ]'::jsonb);

  perform public._lvp_seed_variants('Monumental Traditional Combo', std, '[
    {"size":"5.5x11","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":17,"pcs_pallet":40},
    {"size":"11x11","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":34,"pcs_pallet":40},
    {"size":"11x16.5","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":51,"pcs_pallet":40}
  ]'::jsonb);

  perform public._lvp_seed_variants('Monumental Urban Combo', std, '[
    {"size":"5.5x11","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":17,"pcs_pallet":40},
    {"size":"11x11","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":34,"pcs_pallet":40},
    {"size":"11x16.5","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":51,"pcs_pallet":40}
  ]'::jsonb);

  perform public._lvp_seed_variants('Monumental Rugged Combo', std, '[
    {"size":"5.5x11","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":17,"pcs_pallet":40},
    {"size":"11x11","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":34,"pcs_pallet":40},
    {"size":"11x16.5","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":51,"pcs_pallet":40}
  ]'::jsonb);

  perform public._lvp_seed_variants('Holland', holland, '[
    {"size":"4x8","thickness_mm":"45","thickness_in":"2","sqft_pallet":100,"pcs_pallet":440},
    {"size":"4x8","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":100,"pcs_pallet":440},
    {"size":"4x8","thickness_mm":"80","thickness_in":"3.15","sqft_pallet":80,"pcs_pallet":352}
  ]'::jsonb);

  perform public._lvp_seed_variants('Circle Kits', std, '[
    {"size":"4ft kit","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":0,"pcs_pallet":0}
  ]'::jsonb);

  perform public._lvp_seed_variants('Large Square', std, '[
    {"size":"11x11","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":0,"pcs_pallet":0},
    {"size":"18x18","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":0,"pcs_pallet":0}
  ]'::jsonb);

  perform public._lvp_seed_variants('Antique Split', std, '[
    {"size":"TBD","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":0,"pcs_pallet":0}
  ]'::jsonb);

  perform public._lvp_seed_variants('Bullnose & Pool Edge Coping', std, '[
    {"size":"6x14","thickness_mm":"60","thickness_in":"2.5","sqft_pallet":0,"pcs_pallet":0}
  ]'::jsonb);
end;
$$;

drop function if exists public._lvp_seed_variants(text, text[], jsonb);
