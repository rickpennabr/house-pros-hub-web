export interface ContractorLicense {
  code: string;
  name: string;
  description: string;
}

export const RESIDENTIAL_CONTRACTOR_LICENSES: ContractorLicense[] = [
  // General Building
  { 
    code: 'B-2', 
    name: 'Residential and Small Commercial', 
    description: 'General building contractor for residential structures up to 3 stories' 
  },
  { 
    code: 'B-7', 
    name: 'Residential Remodeling', 
    description: 'Remodeling and improvement of single-family residences' 
  },
  
  // Plumbing & Heating
  { 
    code: 'C-1', 
    name: 'Plumbing and Heating Contracting', 
    description: 'Plumbing, heating, water heaters, and related systems' 
  },
  
  // Electrical
  { 
    code: 'C-2', 
    name: 'Electrical Contracting', 
    description: 'Electrical wiring, fixtures, systems, and installations' 
  },
  
  // Carpentry & Repairs
  { 
    code: 'C-3', 
    name: 'Carpentry, Maintenance and Minor Repairs', 
    description: 'Carpentry, drywall, insulation, overhead doors, and repairs' 
  },
  
  // Painting
  { 
    code: 'C-4', 
    name: 'Painting and Decorating', 
    description: 'Painting, wallcovering, taping, finishing, and sandblasting' 
  },
  
  // Concrete
  { 
    code: 'C-5', 
    name: 'Concrete Contracting', 
    description: 'Concrete work, paving, sealants, and related services' 
  },
  
  // Glass & Glazing
  { 
    code: 'C-8', 
    name: 'Glass and Glazing Contracting', 
    description: 'Windows, glass, glazing, and storefronts' 
  },
  
  // Landscape
  { 
    code: 'C-10', 
    name: 'Landscape Contracting', 
    description: 'Landscaping, irrigation, drainage, and outdoor improvements' 
  },
  
  // Roofing & Siding
  { 
    code: 'C-15', 
    name: 'Roofing and Siding', 
    description: 'Roofing, siding, insulation, and waterproofing' 
  },
  
  // Flooring
  { 
    code: 'C-16', 
    name: 'Finishing Floors', 
    description: 'Floor coverings, carpet, and floor finishing' 
  },
  
  // Lathing & Plastering
  { 
    code: 'C-17', 
    name: 'Lathing and Plastering', 
    description: 'Lathing, plastering, drywall, stucco, and acoustical tile' 
  },
  
  // Masonry
  { 
    code: 'C-18', 
    name: 'Masonry', 
    description: 'Brick, stone, block, and structural glass work' 
  },
  
  // Terrazzo & Marble
  { 
    code: 'C-19', 
    name: 'Installing Terrazzo and Marble', 
    description: 'Terrazzo, marble, and cultured stone installation' 
  },
  
  // Tiling
  { 
    code: 'C-20', 
    name: 'Tiling', 
    description: 'Ceramic tile, encaustic tile, and related products' 
  },
  
  // HVAC
  { 
    code: 'C-21', 
    name: 'Refrigeration and Air-Conditioning', 
    description: 'HVAC systems, refrigeration, air conditioning, and maintenance' 
  },
  
  // Fencing
  { 
    code: 'C-25', 
    name: 'Fencing and Equipping Playgrounds', 
    description: 'Fencing, guardrails, and playground equipment' 
  },
  
  // General Engineering (for driveways, excavation, etc.)
  { 
    code: 'A-7', 
    name: 'Excavating and Grading', 
    description: 'Excavation, grading, trenching, and earthwork' 
  },
  
  // Pools & Spas (commercial and residential combined)
  { 
    code: 'A-10', 
    name: 'Commercial and Residential Pools', 
    description: 'Pool and spa construction, alteration, and repair' 
  },
];

