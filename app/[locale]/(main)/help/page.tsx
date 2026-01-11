'use client';

import { useState } from 'react';
import { Phone, Mail } from 'lucide-react';
import Accordion from '@/components/ui/Accordion';

export default function HelpPage() {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const handlePhoneClick = () => {
    window.location.href = 'tel:702-232-0411';
  };

  const handleEmailClick = () => {
    window.location.href = 'mailto:contact@houseproshub.com';
  };

  const toggleAccordion = (id: string) => {
    setOpenAccordion(openAccordion === id ? null : id);
  };

  const faqs = [
    {
      id: '1',
      question: 'How do I find a contractor?',
      answer: 'You can browse our directory of local contractors by category, location, or search for specific services. Each contractor profile includes their contact information, services offered, and business details to help you make an informed decision.',
    },
    {
      id: '2',
      question: 'How do I request a free estimate?',
      answer: 'Click on the "Free Estimate" button in the navigation menu or on any contractor profile page. Fill out the estimate form with your project details, contact information, and preferred contact method. Our contractors will reach out to you directly to discuss your project.',
    },
  ];

  return (
    <div className="w-full bg-white">
      <div className="md:p-6 space-y-6">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-4xl font-bold text-black mb-2">Help & Support</h1>
          <p className="text-base md:text-lg text-gray-600">
            We're here to help! Find answers to common questions or contact us directly.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="space-y-4">
          <h2 className="text-lg md:text-2xl font-bold text-black mb-4">Frequently Asked Questions</h2>
          {faqs.map((faq) => (
            <Accordion
              key={faq.id}
              title={faq.question}
              isOpen={openAccordion === faq.id}
              onToggle={() => toggleAccordion(faq.id)}
              isComplete={false}
              required={false}
            >
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">{faq.answer}</p>
            </Accordion>
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-8">
          <h2 className="text-xl md:text-2xl font-bold text-black mb-4">Contact Us</h2>
          <p className="text-sm md:text-base text-gray-600 mb-4">
            Still have questions? Reach out to us directly and we'll be happy to help.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div 
              className="border-2 border-black rounded-lg bg-white p-2 md:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={handlePhoneClick}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-black" />
                </div>
                <div className="flex-1">
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Phone</p>
                  <p className="text-base md:text-lg font-semibold text-black">702-232-0411</p>
                </div>
              </div>
            </div>

            <div 
              className="border-2 border-black rounded-lg bg-white p-2 md:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={handleEmailClick}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-black" />
                </div>
                <div className="flex-1">
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Email</p>
                  <p className="text-base md:text-lg font-semibold text-black break-all">contact@houseproshub.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

