'use client';

interface BusinessAboutTabProps {
  businessName: string;
  contractorType: string;
  description?: string;
}

export default function BusinessAboutTab({ 
  businessName, 
  contractorType,
  description 
}: BusinessAboutTabProps) {
  return (
    <div className="p-4 bg-white">
      <h2 className="text-xl font-bold text-black mb-4">About</h2>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Business Name</p>
          <p className="text-lg font-semibold text-black">{businessName}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Contractor Type</p>
          <p className="text-lg font-semibold text-black">{contractorType}</p>
        </div>
        {description && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Description</p>
            <p className="text-base text-black">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

