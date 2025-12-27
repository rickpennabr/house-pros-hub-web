import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { addressUpdateSchema } from '@/lib/schemas/address';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/addresses/[id]
 * Get a specific address by ID
 */
async function handleGetAddress(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();

    // Fetch address and verify ownership
    const { data: address, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !address) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Address not found' },
          { status: 404 }
        );
      }
      logger.error('Error fetching address', { endpoint: `/api/addresses/${id}` }, error as Error);
      return NextResponse.json(
        { error: 'Failed to fetch address' },
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

    return NextResponse.json({
      address: formattedAddress,
    });
  } catch (error) {
    logger.error('Error in GET /api/addresses/[id]', { endpoint: `/api/addresses/${await params.then(p => p.id)}` }, error as Error);
    return handleError(error, { endpoint: '/api/addresses/[id]' });
  }
}

/**
 * PUT /api/addresses/[id]
 * Update an address
 */
async function handleUpdateAddress(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = request._body || await request.json();
    const validationResult = addressUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;
    const supabase = await createClient();

    // Verify ownership before updating
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id, address_type')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existingAddress) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (updates.addressType !== undefined) {
      updateData.address_type = updates.addressType;
    }
    if (updates.streetAddress !== undefined) {
      updateData.street_address = updates.streetAddress;
    }
    if (updates.apartment !== undefined) {
      updateData.apartment = updates.apartment || null;
    }
    if (updates.city !== undefined) {
      updateData.city = updates.city;
    }
    if (updates.state !== undefined) {
      updateData.state = updates.state;
    }
    if (updates.zipCode !== undefined) {
      updateData.zip_code = updates.zipCode;
    }
    if (updates.gateCode !== undefined) {
      updateData.gate_code = updates.gateCode || null;
    }
    if (updates.addressNote !== undefined) {
      updateData.address_note = updates.addressNote || null;
    }
    if (updates.isPublic !== undefined) {
      updateData.is_public = updates.isPublic;
    }

    // Update address
    const { data: address, error } = await supabase
      .from('addresses')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating address', { endpoint: `/api/addresses/${id}` }, error as Error);
      return NextResponse.json(
        { error: 'Failed to update address' },
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

    return NextResponse.json({
      message: 'Address updated successfully',
      address: formattedAddress,
    });
  } catch (error) {
    logger.error('Error in PUT /api/addresses/[id]', { endpoint: `/api/addresses/${await params.then(p => p.id)}` }, error as Error);
    return handleError(error, { endpoint: '/api/addresses/[id]' });
  }
}

/**
 * DELETE /api/addresses/[id]
 * Delete an address
 */
async function handleDeleteAddress(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();

    // Verify ownership and check if address is referenced by a business
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id, address_type')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existingAddress) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    // Check if this address is referenced by a business
    if (existingAddress.address_type === 'business') {
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('business_address_id', id)
        .maybeSingle();

      if (business) {
        return NextResponse.json(
          { 
            error: 'Cannot delete address',
            message: 'This address is currently being used by a business. Please update or remove the business first.',
          },
          { status: 400 }
        );
      }
    }

    // Delete address
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error deleting address', { endpoint: `/api/addresses/${id}` }, error as Error);
      return NextResponse.json(
        { error: 'Failed to delete address' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Address deleted successfully',
    });
  } catch (error) {
    logger.error('Error in DELETE /api/addresses/[id]', { endpoint: `/api/addresses/${await params.then(p => p.id)}` }, error as Error);
    return handleError(error, { endpoint: '/api/addresses/[id]' });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return requireAuth((req) => handleGetAddress(req, context))(request);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return requireAuth((req) => handleUpdateAddress(req, context))(request);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return requireAuth((req) => handleDeleteAddress(req, context))(request);
}

