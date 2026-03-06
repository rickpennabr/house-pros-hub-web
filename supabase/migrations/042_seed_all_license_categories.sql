-- Seed all license options (as shown at signup) into license_categories.
-- 041 already seeds HANDYMAN and LICENSED_CONTRACTOR. Add GENERAL and all residential classifications.
INSERT INTO license_categories (code, name, description, requires_contractor_license, sort_order)
VALUES
  ('GENERAL', 'General Contractor License', NULL, true, 2),
  ('B-2', 'Residential and Small Commercial', 'General building contractor for residential structures up to 3 stories', true, 3),
  ('B-7', 'Residential Remodeling', 'Remodeling and improvement of single-family residences', true, 4),
  ('C-1', 'Plumbing and Heating Contracting', 'Plumbing, heating, water heaters, and related systems', true, 5),
  ('C-2', 'Electrical Contracting', 'Electrical wiring, fixtures, systems, and installations', true, 6),
  ('C-2d', 'Low Voltage Systems', 'Smart home systems, security cameras, home automation, security alarms, fire alarms, and low-voltage lighting (91 volts or less)', true, 7),
  ('C-3', 'Carpentry, Maintenance and Minor Repairs', 'Carpentry, drywall, insulation, overhead doors, and repairs', true, 8),
  ('C-4', 'Painting and Decorating', 'Painting, wallcovering, taping, finishing, and sandblasting', true, 9),
  ('C-5', 'Concrete Contracting', 'Concrete work, paving, sealants, and related services', true, 10),
  ('C-8', 'Glass and Glazing Contracting', 'Windows, glass, glazing, and storefronts', true, 11),
  ('C-10', 'Landscape Contracting', 'Landscaping, irrigation, drainage, and outdoor improvements', true, 12),
  ('C-15', 'Roofing and Siding', 'Roofing, siding, insulation, and waterproofing', true, 13),
  ('C-16', 'Finishing Floors', 'Floor coverings, carpet, and floor finishing', true, 14),
  ('C-17', 'Lathing and Plastering', 'Lathing, plastering, drywall, stucco, and acoustical tile', true, 15),
  ('C-18', 'Masonry', 'Brick, stone, block, and structural glass work', true, 16),
  ('C-19', 'Installing Terrazzo and Marble', 'Terrazzo, marble, and cultured stone installation', true, 17),
  ('C-20', 'Tiling', 'Ceramic tile, encaustic tile, and related products', true, 18),
  ('C-21', 'Refrigeration and Air-Conditioning', 'HVAC systems, refrigeration, air conditioning, and maintenance', true, 19),
  ('C-25', 'Fencing and Equipping Playgrounds', 'Fencing, ornamental ironwork, custom iron gates, guardrails, railings, and playground equipment', true, 20),
  ('A-7', 'Excavating and Grading', 'Excavation, grading, trenching, and earthwork', true, 21),
  ('A-10', 'Commercial and Residential Pools', 'Pool and spa construction, alteration, and repair', true, 22),
  ('C-27', 'Individual Sewerage', 'Septic systems, sewerage disposal, and related installations', true, 23),
  ('C-30', 'Water Treatment', 'Water filtration, treatment systems, and water quality improvement', true, 24),
  ('C-37', 'Solar Contracting', 'Solar panels, solar water heating, space heating, and pool heating systems', true, 25),
  ('C-39', 'Heaters', 'Heating systems, heaters, and related installations', true, 26),
  ('C-41', 'Fire Protection', 'Fire sprinklers, extinguishing systems, fire alarms, and hydrants', true, 27)
ON CONFLICT (code) DO NOTHING;
