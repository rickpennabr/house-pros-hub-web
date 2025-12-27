import { ProCardData } from '@/components/proscard/ProCard';

export const mockBusinesses: ProCardData[] = [
  // 5 businesses with 2 licenses each
  {
    id: '30',
    businessName: 'Solid Foundation Builders',
    contractorType: 'Foundation Contractor',
    tradeIcon: 'Layers',
    category: 'General',
    licenses: [
      { license: 'C-18', licenseNumber: '30001', tradeName: 'Masonry', tradeIcon: 'Home' },
      { license: 'C-16', licenseNumber: '30002', tradeName: 'Finishing Floors', tradeIcon: 'Layers' },
    ],
    links: [
      { type: 'phone', value: '555-1470' },
      { type: 'website', url: 'https://solidfoundation.com' },
      { type: 'email', value: 'contact@solidfoundation.com' },
      { type: 'calendar', url: 'https://calendly.com/solidfoundation' },
    ],
    reactions: {
      love: 48,
      feedback: 20,
      link: 9,
      save: 32,
    },
  },
  {
    id: '31',
    businessName: 'Window Masters',
    contractorType: 'Window & Door Contractor',
    tradeIcon: 'RectangleHorizontal',
    category: 'Windows',
    licenses: [
      { license: 'C-8', licenseNumber: '31001', tradeName: 'Glass and Glazing', tradeIcon: 'RectangleHorizontal' },
      { license: 'C-8', licenseNumber: '31002', tradeName: 'Windows', tradeIcon: 'RectangleHorizontal' },
    ],
    links: [
      { type: 'phone', value: '555-8520' },
      { type: 'website', url: 'https://windowmasters.com' },
      { type: 'instagram', url: 'https://instagram.com/windowmasters' },
      { type: 'facebook', url: 'https://facebook.com/windowmasters' },
    ],
    reactions: {
      love: 41,
      feedback: 16,
      link: 6,
      save: 26,
    },
  },
  {
    id: '32',
    businessName: 'Complete Home Solutions',
    contractorType: 'General Contractor',
    tradeIcon: 'Home',
    category: 'General',
    licenses: [
      { license: 'B-2', licenseNumber: '32001', tradeName: 'Residential and Small Commercial', tradeIcon: 'Home' },
      { license: 'C-3', licenseNumber: '32002', tradeName: 'Carpentry', tradeIcon: 'Home' },
    ],
    links: [
      { type: 'phone', value: '555-9630' },
      { type: 'website', url: 'https://completehomesolutions.com' },
      { type: 'email', value: 'info@completehomesolutions.com' },
      { type: 'instagram', url: 'https://instagram.com/completehomesolutions' },
      { type: 'facebook', url: 'https://facebook.com/completehomesolutions' },
    ],
    reactions: {
      love: 52,
      feedback: 22,
      link: 10,
      save: 33,
    },
  },
  {
    id: '33',
    businessName: 'Elite Flooring & Tile',
    contractorType: 'Flooring Contractor',
    tradeIcon: 'Layers',
    category: 'Flooring',
    licenses: [
      { license: 'C-16', licenseNumber: '33001', tradeName: 'Finishing Floors', tradeIcon: 'Layers' },
      { license: 'C-20', licenseNumber: '33002', tradeName: 'Tiling', tradeIcon: 'Grid3x3' },
    ],
    links: [
      { type: 'phone', value: '555-7410' },
      { type: 'website', url: 'https://eliteflooringtile.com' },
      { type: 'email', value: 'contact@eliteflooringtile.com' },
      { type: 'instagram', url: 'https://instagram.com/eliteflooringtile' },
      { type: 'calendar', url: 'https://calendly.com/eliteflooring' },
    ],
    reactions: {
      love: 56,
      feedback: 24,
      link: 11,
      save: 35,
    },
  },
  {
    id: '34',
    businessName: 'Desert Design Build',
    contractorType: 'General Contractor',
    tradeIcon: 'Home',
    category: 'General',
    licenses: [
      { license: 'B-7', licenseNumber: '34001', tradeName: 'Residential Remodeling', tradeIcon: 'Home' },
      { license: 'C-4', licenseNumber: '34002', tradeName: 'Painting and Decorating', tradeIcon: 'Paintbrush' },
    ],
    links: [
      { type: 'phone', value: '555-2580' },
      { type: 'website', url: 'https://desertdesignbuild.com' },
      { type: 'email', value: 'info@desertdesignbuild.com' },
      { type: 'facebook', url: 'https://facebook.com/desertdesignbuild' },
      { type: 'calendar', url: 'https://calendly.com/desertdesign' },
    ],
    reactions: {
      love: 59,
      feedback: 25,
      link: 12,
      save: 38,
    },
  },
];

export const getBusinessData = async (id: string): Promise<ProCardData | null> => {
  return mockBusinesses.find(b => b.id === id) || null;
};
