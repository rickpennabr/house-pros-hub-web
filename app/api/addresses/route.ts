import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { addressSchema } from '@/lib/schemas/address';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/addresses
 * Get all addresses for the authenticated user
 * Query params: type (optional) - filter by 'personal' or 'business'
 */
async function handleGetAddresses(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const addressType = searchParams.get('type');

    let query = supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filter by type if provided
    if (addressType === 'personal' || addressType === 'business') {
      query = query.eq('address_type', addressType);
    }

    const { data: addresses, error } = await query;

    if (error) {
      logger.error('Error fetching addresses', { endpoint: '/api/addresses' }, error as Error);
      return NextResponse.json(
        { error: 'Failed to fetch addresses' },
        { status: 500 }
      );
    }

    // Format addresses for response
    const formattedAddresses = (addresses || []).map((addr) => ({
      id: addr.id,
      addressType: addr.address_type,
      streetAddress: addr.street_address,
      apartment: addr.apartment,
      city: addr.city,
      state: addr.state,
      zipCode: addr.zip_code,
      gateCode: addr.gate_code,
      addressNote: addr.address_note,
      isPublic: addr.is_public,
      isVerified: addr.is_verified,
      createdAt: addr.created_at,
      updatedAt: addr.updated_at,
    }));

    return NextResponse.json({
      addresses: formattedAddresses,
    });
  } catch (error) {
    logger.error('Error in GET /api/addresses', { endpoint: '/api/addresses' }, error as Error);
    return handleError(error, { endpoint: '/api/addresses' });
  }
}

/**
 * POST /api/addresses
 * Create a new address for the authenticated user
 */
async function handleCreateAddress(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = request._body || await request.json();
    const validationResult = addressSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const supabase = await createClient();

    // Create address
    const { data: address, error } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        address_type: data.addressType,
        street_address: data.streetAddress,
        apartment: data.apartment || null,
        city: data.city,
        state: data.state,
        zip_code: data.zipCode,
        gate_code: data.gateCode || null,
        address_note: data.addressNote || null,
        is_public: data.isPublic || false,
        is_verified: false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating address', { endpoint: '/api/addresses' }, error as Error);
      return NextResponse.json(
        { error: 'Failed to create address' },
        { status: 500 }
      );
    }

    // Format address for response
    const formattedAddress = {
      id: address.id,
      addressType: address.address_type,
      streetAddress: address.street_address,
      apartment: address.apartment,
      city: address.city,
      state: address.state,
      zipCode: address.zip_code,
      gateCode: address.gate_code,
      addressNote: address.address_note,
      isPublic: address.is_public,
      isVerified: address.is_verified,
      createdAt: address.created_at,
      updatedAt: address.updated_at,
    };

    return NextResponse.json(
      {
        message: 'Address created successfully',
        address: formattedAddress,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error in POST /api/addresses', { endpoint: '/api/addresses' }, error as Error);
    return handleError(error, { endpoint: '/api/addresses' });
  }
}

export async function GET(request: NextRequest) {
  return requireAuth(handleGetAddresses)(request);
}

export async function POST(request: NextRequest) {
  return requireAuth(handleCreateAddress)(request);
}

