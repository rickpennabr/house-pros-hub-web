'use client';

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full h-[60px] border-t-2 border-black bg-white mt-auto">
      <div className="max-w-7xl mx-auto h-full px-2 py-2 md:px-2 md:py-4 flex items-center">
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-2 md:gap-6">
          {/* Legal Links */}
          <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6 text-sm">
            <Link 
              href="/legal/terms" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-black underline transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              href="/legal/privacy" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-black underline transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              href="/legal/cookies" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-black underline transition-colors"
            >
              Cookie Policy
            </Link>
          </div>

          {/* Copyright */}
          <div className="text-sm text-gray-600 text-center md:text-right">
            <p>&copy; {currentYear} House Pros Hub. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

