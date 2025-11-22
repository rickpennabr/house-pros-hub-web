import ProCardGrid from '@/components/proscard/ProCardGrid';
import { ProCardData } from '@/components/proscard/ProCard';

// Sample data - replace with actual data from your API/database
const sampleProCards: ProCardData[] = [
  {
    id: '1',
    businessName: 'ABC Landscaping',
    contractorType: 'Landscaping Contractor',
    logo: '/houseproshub-logo-black.png',
    links: [
      { type: 'phone', value: '555-1234' },
      { type: 'instagram', url: 'https://instagram.com/abc_landscaping' },
      { type: 'facebook', url: 'https://facebook.com/abc_landscaping' },
      { type: 'website', url: 'https://abc-landscaping.com' },
      { type: 'email', value: 'info@abc-landscaping.com' },
      { type: 'location', url: 'https://maps.google.com' },
      { type: 'calendar', url: 'https://calendly.com/abc' },
    ],
    reactions: {
      love: 42,
      feedback: 15,
      link: 8,
      save: 23,
    },
  },
  {
    id: '2',
    businessName: 'XYZ Roofing Co',
    contractorType: 'Roofing Contractor',
    // No logo - will show initials "XR"
    links: [
      { type: 'phone', value: '555-5678' },
      { type: 'website', url: 'https://xyz-roofing.com' },
      { type: 'email', value: 'contact@xyz-roofing.com' },
      { type: 'instagram', url: 'https://instagram.com/xyz_roofing' },
      { type: 'facebook', url: 'https://facebook.com/xyz_roofing' },
    ],
    reactions: {
      love: 38,
      feedback: 12,
      link: 5,
      save: 19,
    },
  },
  {
    id: '3',
    businessName: 'Elite Tile Works',
    contractorType: 'Tile Contractor',
    // No logo - will show initials "ET"
    links: [
      { type: 'phone', value: '555-9012' },
      { type: 'website', url: 'https://elite-tile.com' },
      { type: 'instagram', url: 'https://instagram.com/elite_tile' },
    ],
    reactions: {
      love: 29,
      feedback: 8,
      link: 3,
      save: 14,
    },
  },
  {
    id: '4',
    businessName: 'Premier Plumbing',
    contractorType: 'Plumbing Contractor',
    links: [
      { type: 'phone', value: '555-3456' },
      { type: 'website', url: 'https://premier-plumbing.com' },
      { type: 'email', value: 'info@premier-plumbing.com' },
      { type: 'calendar', url: 'https://calendly.com/premier' },
    ],
    reactions: {
      love: 51,
      feedback: 22,
      link: 10,
      save: 31,
    },
  },
];

export default function BusinessList() {
  return (
    <div className="w-full">
      <ProCardGrid cards={sampleProCards} />
    </div>
  );
}
