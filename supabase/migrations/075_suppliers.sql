-- Supplier branches copied from PavExpertHub. Public read for the directory and admin list.
CREATE TABLE IF NOT EXISTS public.suppliers (
  id integer PRIMARY KEY,
  name text NOT NULL,
  supplier_type text NOT NULL,
  materials text[] NOT NULL DEFAULT '{}',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  logo text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view suppliers" ON public.suppliers;
CREATE POLICY "Public can view suppliers"
  ON public.suppliers FOR SELECT
  USING (true);

GRANT SELECT ON public.suppliers TO anon, authenticated;

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.suppliers (
  id, name, supplier_type, materials, address, phone, website, logo, latitude, longitude
)
VALUES
(1, 'Star Nursery - Ann Road & Decatur Blvd', 'Landscape Supplier', ARRAY['Type 2', 'Wash Concrete Sand', 'White Chad', 'Rocks', 'Pavers']::text[], '2600 W. Ann Road, North Las Vegas, NV 89031', '(702) 216-7827', 'https://www.starnursery.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/star-nursery-logo.png', 36.2764, -115.2289),
(2, 'Southwest Construction Supply - Arville & Flamingo', 'Pavers Supplier', ARRAY['Decor Drain', 'Pavers']::text[], '4214 Bertsos Ste #1, Las Vegas, NV 89103', '(702) 364-0003', 'https://www.swcslv.online', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/southwest-construction-logo.png', 36.113409, -115.201991),
(3, 'Star Nursery - Blue Diamond Rd & Arville St', 'Landscape Supplier', ARRAY['Type 2', 'Wash Concrete Sand', 'White Chad', 'Rocks', 'Pavers']::text[], '5380 Blue Diamond Road, Las Vegas, NV 89139', '(702) 444-7827', 'https://www.starnursery.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/star-nursery-logo.png', 35.9866, -115.2018),
(4, 'Boulder Placement - Bonanza Rd & Martin L King Blvd', 'Landscape Supplier', ARRAY['Type 2', 'Wash Concrete Sand', 'White Chad', 'Rocks', 'Pavers']::text[], '2049 W Bonanza Rd, Las Vegas, NV 89106', '(702) 896-2070', 'https://www.boulderplacement.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/boulder-placement-logo.png', 36.1802, -115.161),
(5, 'Star Nursery - Boulder Hwy & Harmon Ave', 'Landscape Supplier', ARRAY['(Big bag) Wash Concrete Sand', 'Pavers']::text[], '5340 Boulder Highway, Las Vegas, NV 89122', '(702) 435-7827', 'https://www.starnursery.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/star-nursery-logo.png', 36.0963, -115.0279),
(6, 'SiteOne - Bronco St & Blue Diamond Rd', 'Pavers Supplier', ARRAY['Pavers', 'Porcelain', 'Travertine', 'Polymeric Sand']::text[], '8845 S Bronco St, Las Vegas, NV 89139', '(702) 407-5557', 'https://www.siteone.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/siteone-logo.png', 35.9866, -115.257),
(7, 'Star Nursery - Charleston Blvd & Cimarron Rd', 'Landscape Supplier', ARRAY['(Big bag) Wash Concrete Sand', 'Pavers']::text[], '8170 W. Charleston Blvd, Las Vegas, NV 89117', '(702) 360-7827', 'https://www.starnursery.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/star-nursery-logo.png', 36.1481, -115.2891),
(8, 'Lowe''s - Charleston Blvd & Decatur Blvd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '4625 W. Charleston Blvd, Las Vegas, NV 89102', '(702) 352-1639', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.167, -115.2036),
(9, 'Lowe''s - Charleston Blvd & Mojave Rd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '2875 E. Charleston Blvd, Las Vegas, NV 89104', '(702) 352-1620', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.1666, -115.0898),
(10, 'The Home Depot - Charleston Blvd & Town Center Dr', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '9705 W Charleston Blvd, Las Vegas, NV 89117', '(702) 940-2426', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.1485, -115.3197),
(11, 'Star Nursery - Cheyenne Ave & Buffalo Dr', 'Landscape Supplier', ARRAY['(Big bag) Wash Concrete Sand', 'Pavers']::text[], '7330 W. Cheyenne Ave, Las Vegas, NV 89129', '(702) 253-7827', 'https://www.starnursery.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/star-nursery-logo.png', 36.2081, -115.2755),
(12, 'Lowe''s - Craig Rd & Jones Blvd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '6050 West Craig Road, Las Vegas, NV 89130', '(702) 352-2540', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.2307, -115.2505),
(13, 'The Home Depot - Craig Rd & Martin L King Blvd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '1275 W Craig Rd, North Las Vegas, NV 89032', '(702) 642-2600', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.2309, -115.1587),
(14, 'The Home Depot - Decatur Blvd & Tropicana Rd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '4750 S Decatur Blvd, Las Vegas, NV 89103', '(702) 871-5035', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.1158, -115.2289),
(15, 'SiteOne - Dewey Dr & Arville St', 'Pavers Supplier', ARRAY['Pavers', 'Porcelain', 'Travertine', 'Polymeric Sand']::text[], '4175 W Dewey Dr, Las Vegas, NV 89118', '(702) 736-8188', 'https://www.siteone.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/siteone-logo.png', 36.0711, -115.1956),
(16, 'The Home Depot - Dorrell Ln & Aliante Pkwy', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '855 East Dorrell Lane, North Las Vegas, NV 89086', '(702) 399-3566', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.3134, -115.1278),
(17, 'Lowe''s - Eastern Ave & Russell Rd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '5825 South Eastern Avenue, Las Vegas, NV 89119', '(702) 352-2271', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.0772, -115.1189),
(18, 'Lowe''s - Eastern Ave & St Rose Pkwy', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '9955 South Eastern Avenue, Las Vegas, NV 89183', '(702) 352-1719', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 35.9729, -115.118),
(19, 'Star Nursery - Eastern Ave & Wigwam Pkwy', 'Landscape Supplier', ARRAY['Type 2', 'Wash Concrete Sand', 'White Chad', 'Rocks', 'Pavers']::text[], '8725 S. Eastern Ave, Las Vegas, NV 89123', '(702) 333-7827', 'https://www.starnursery.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/star-nursery-logo.png', 36.0359, -115.118),
(20, 'Lowe''s - El Capitan Way & Centennial Pkwy', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '7751 N El Capitan Way, Las Vegas, NV 89143', '(702) 352-2844', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.2872, -115.3275),
(21, 'The Home Depot - Fort Apache Rd & Flamingo Rd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '4195 S Fort Apache Rd, Las Vegas, NV 89147', '(702) 220-4903', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.1086, -115.309),
(22, 'Lowe''s - Fort Apache Rd & Tropicana Ave', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '5050 South Fort Apache Road, Las Vegas, NV 89148', '(702) 248-1729', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.1008, -115.309),
(23, 'The Home Depot - Lamb Blvd & Charleston Blvd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '1401 S Lamb Blvd, Las Vegas, NV 89104', '(702) 641-9600', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.1643, -115.0594),
(24, 'Vegas Stone Brokers - Las Vegas Blvd & Blue Diamond Rd', 'Stone Supplier', ARRAY['Travertine', 'Porcelain', 'Pavers', 'Polymeric Sand']::text[], '8801 South Las Vegas Blvd Unit 200, Las Vegas, NV 89123', '(702) 780-4542', 'https://www.vegasstonebrokers.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/vegas-stone-brokers-logo.png', 36.035, -115.174),
(25, 'Apache Stone - Las Vegas Blvd & Cheyenne', 'Stone Supplier', ARRAY[]::text[], '3900 E Cheyenne Ave, Las Vegas, NV 89115', '(702) 651-0001', 'https://www.apachestone.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/apache-stone-logo.png', 36.218124, -115.088647),
(26, 'Lowe''s - Nellis Blvd & Cheyenne Ave', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '2465 N Nellis Boulevard, Las Vegas, NV 89115', '(702) 352-1865', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.2166, -115.0596),
(27, 'Lowe''s - Pavilion Center Dr & Town Center Dr', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '851 S. Pavilion Center Drive, Las Vegas, NV 89144', '(702) 352-1836', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.1264, -115.3189),
(28, 'Ewing Outdoor Supply - Pecos & Charleston', 'Landscape Supplier', ARRAY[]::text[], '72 Spectrum Blvd, Las Vegas, NV 89101', '(702) 459-9530', 'https://www.ewingoutdoorsupply.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/ewing-logo.png', 36.161966, -115.102078),
(29, 'The Home Depot - Pecos Rd & Patrick Ln', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '6025 S Pecos Rd, Las Vegas, NV 89120', '(702) 434-1948', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.0792, -115.0805),
(30, 'The Home Depot - Rainbow Blvd & Alta Dr', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '861 S Rainbow Blvd, Las Vegas, NV 89145', '(702) 870-9600', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.1557, -115.2755),
(31, 'The Home Depot - Rainbow Blvd & Arroyo Crossing Pkwy', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '7015 Arroyo Crossing Pkwy, Las Vegas, NV 89113', '(702) 270-6446', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.0396, -115.2754),
(32, 'Ewing Outdoor Supply - Rancho Dr & Gowan Rd', 'Landscape Supplier', ARRAY[]::text[], '3521 N Rancho Dr, Las Vegas, NV 89130', '(702) 839-9530', 'https://www.ewingoutdoorsupply.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/ewing-logo.png', 36.2227308, -115.2183857),
(33, 'The Home Depot - Serene Ave & Eastern Ave', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '2200 E Serene Ave, Las Vegas, NV 89123', '(702) 837-4300', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.0125, -115.1189),
(34, 'The Home Depot - Sunset Rd & Marks St', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '1030 Sunset Rd, Henderson, NV 89014', '(702) 434-2900', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.0395, -114.9817),
(35, 'Parson Rocks - Sunset Rd & Water St', 'Stone Supplier', ARRAY['Pavers', 'Type 2', 'Wash Concrete Sand', 'White Chad', 'Rocks', 'Polymeric Sand']::text[], '710 W Sunset Rd, Henderson, NV 89011', '(702) 566-7625', 'https://www.parsonsrocks.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/parsons-rocks-logo.png', 36.0094, -114.9818),
(36, 'Ewing Outdoor Supply - S Valley View & W Tompkins Ave', 'Landscape Supplier', ARRAY[]::text[], '4705 S Valley View Blvd, Las Vegas, NV 89103', '(702) 895-7612', 'https://www.ewingoutdoorsupply.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/ewing-logo.png', 36.104218, -115.190534),
(37, 'Bedrock Landscape Supply - Torrey Pines Dr & Blue Diamond Rd', 'Landscape Supplier', ARRAY['Type 2', 'Wash Concrete Sand', 'White Chad', 'Rocks', 'Pavers']::text[], '9185 S Torrey Pines Dr, Las Vegas, Nevada 89139', '(702) 638-1112', 'https://www.bedrocklandscapesupply.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/bedrock-logo.png', 36.0151, -115.2657),
(38, 'The Home Depot - Tropical Pkwy & Centennial Center Blvd', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '7881 W Tropical Pkwy, Las Vegas, NV 89149', '(702) 839-5100', 'https://www.homedepot.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/the-home-depot-logo.png', 36.2872, -115.2923),
(39, 'Star Nursery - Tropicana Ave & Fort Apache Rd', 'Landscape Supplier', ARRAY['(Big bag) Wash Concrete Sand', 'Pavers']::text[], '9480 W. Tropicana Ave, Las Vegas, NV 89147', '(702) 278-7827', 'https://www.starnursery.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/star-nursery-logo.png', 36.1008, -115.3129),
(40, 'SiteOne - Tule Springs Rd & Durango Dr', 'Pavers Supplier', ARRAY['Pavers', 'Porcelain', 'Travertine', 'Polymeric Sand', 'Type 2', 'Wash Concrete Sand', 'White Chad']::text[], '7375 Tule Springs Rd, Las Vegas, NV 89131', '(702) 645-4743', 'https://www.siteone.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/siteone-logo.png', 36.2872, -115.2891),
(41, 'Lowe''s - Washington Ave & Buffalo Dr', 'Home Improvement Supplier', ARRAY['Tools', 'Cement', 'Silica Sand', '(Big bag) Wash Concrete Sand', 'Pavers']::text[], '7550 West Washington, Las Vegas, NV 89128', '(702) 352-9079', 'https://www.lowes.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/lowes-logo.png', 36.1755, -115.2755),
(42, 'SiteOne - Wynn Rd & Tropicana Ave', 'Pavers Supplier', ARRAY['Pavers', 'Porcelain', 'Travertine', 'Polymeric Sand']::text[], '4730 Wynn Rd, Las Vegas, NV 89103', '(702) 889-6986', 'https://www.siteone.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/siteone-logo.png', 36.1008, -115.2036),
(43, 'Ewing Outdoor Supply - Annie Oakley', 'Landscape Supplier', ARRAY[]::text[], '6330 Annie Oakley Dr, Las Vegas, NV 89120', '(702) 547-9530', 'https://www.ewingoutdoorsupply.com', 'https://hzhyuuiovwayblkovfpr.supabase.co/storage/v1/object/public/brand-logos/ewing-logo.png', 36.074242, -115.086538)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  supplier_type = EXCLUDED.supplier_type,
  materials = EXCLUDED.materials,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  website = EXCLUDED.website,
  logo = EXCLUDED.logo,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;
