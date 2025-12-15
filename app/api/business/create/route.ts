import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail, isNotEmpty } from '@/lib/validation';

/**
 * POST /api/business/create
 * Business creation endpoint
 * 
 * In production, this will:
 * - Validate business data
 * - Check user authentication
 * - Create business in database
 * - Associate business with user
 * - Return business data
 * 
 * For now, returns mock response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessName,
      licenses,
      address,
      streetAddress,
      city,
      state,
      zipCode,
      apartment,
      email,
      phone,
      links,
    } = body;

    // Validate required fields
    if (!businessName || !isNotEmpty(businessName)) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    // Validate licenses
    if (!licenses || !Array.isArray(licenses) || licenses.length === 0) {
      return NextResponse.json(
        { error: 'At least one license is required' },
        { status: 400 }
      );
    }

    for (let i = 0; i < licenses.length; i++) {
      const license = licenses[i];
      if (!license.license || !license.licenseNumber) {
        return NextResponse.json(
          { error: `License ${i + 1} must have both classification and number` },
          { status: 400 }
        );
      }
    }

    // Validate address
    if (!streetAddress && !address) {
      return NextResponse.json(
        { error: 'Street address is required' },
        { status: 400 }
      );
    }

    if (!city || !state || !zipCode) {
      return NextResponse.json(
        { error: 'City, state, and ZIP code are required' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone if provided
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        return NextResponse.json(
          { error: 'Phone number must be at least 10 digits' },
          { status: 400 }
        );
      }
    }

    // Validate link URLs if provided
    if (links && Array.isArray(links)) {
      for (const link of links) {
        if (link.url && link.url.trim()) {
          try {
            if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
              return NextResponse.json(
                { error: `Invalid URL format for ${link.type}. URLs must start with http:// or https://` },
                { status: 400 }
              );
            }
            new URL(link.url);
          } catch {
            return NextResponse.json(
              { error: `Invalid URL format for ${link.type}` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Mock response (replace with actual business creation in production)
    // In production:
    // 1. Check user authentication (from cookies/headers)
    // 2. Create business in database
    // 3. Associate business with authenticated user
    // 4. Return business data

    const mockBusiness = {
      id: `business_${Date.now()}`,
      businessName,
      licenses,
      address: {
        streetAddress: streetAddress || address,
        city,
        state,
        zipCode,
        apartment: apartment || null,
      },
      email: email || null,
      phone: phone || null,
      links: links || [],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      { business: mockBusiness },
      { status: 201 }
    );
  } catch (error) {
    console.error('Business creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

