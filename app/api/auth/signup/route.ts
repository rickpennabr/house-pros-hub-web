import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail, isValidPassword, isNotEmpty } from '@/lib/validation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { validateBase64Image, getExtensionFromMimeType } from '@/lib/utils/fileValidation';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { sendWelcomeEmail } from '@/lib/services/emailService';
import { getMessages } from 'next-intl/server';
import { logger } from '@/lib/utils/logger';
import type { WelcomeEmailTranslations } from '@/lib/utils/emailTemplates';

/**
 * Convert base64 string to Buffer for server-side file handling
 */
function base64ToBuffer(base64String: string): Buffer {
  // Remove data URL prefix if present
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  return Buffer.from(base64Data, 'base64');
}

/**
 * Upload base64 image to Supabase Storage
 */
async function uploadBase64Image(
  supabase: ReturnType<typeof createServiceRoleClient>,
  bucket: string,
  filePath: string,
  base64String: string,
  contentType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    const buffer = base64ToBuffer(base64String);
    // Supabase storage accepts Buffer directly (it extends Uint8Array)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType,
      });

    if (error) {
      console.error(`Error uploading to ${bucket}:`, error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error(`Error in uploadBase64Image to ${bucket}:`, error);
    return null;
  }
}

/**
 * POST /api/auth/signup
 * Signup endpoint using Supabase
 * 
 * Creates a new user in Supabase Auth and creates a profile record.
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit for auth endpoints
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email, password, firstName, lastName, phone, referral, referralOther, streetAddress, apartment, city, state, zipCode, gateCode, addressNote, companyName, companyRole, userPicture, userType } = body;
    
    // Log received data (without password) for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Signup API] Received data:', { 
        email, 
        firstName, 
        lastName, 
        hasPhone: !!phone, 
        phone: phone ? '***' : null,
        hasReferral: !!referral, 
        referral,
        referralOther: referralOther ? '***' : null,
        hasAddress: !!(streetAddress || city || state || zipCode),
        streetAddress: streetAddress ? '***' : null,
        city,
        state,
        zipCode,
        hasUserPicture: !!userPicture,
        userType
      });
    }
    
    // Trim and normalize all string fields (convert empty strings to null)
    const normalizeString = (value: string | undefined | null): string | null => {
      if (!value || typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain uppercase, lowercase, and number' },
        { status: 400 }
      );
    }

    // Validate name fields
    if (!isNotEmpty(firstName) || !isNotEmpty(lastName)) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await createClient();

    // Sign up with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
        },
      },
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Use service role client to bypass RLS for profile and role creation
    // This is necessary because if email confirmation is required, there's no session yet
    const serviceRoleClient = createServiceRoleClient();

    // Upload profile picture to storage if provided (base64 string)
    let profilePictureUrl: string | null = null;
    if (userPicture && typeof userPicture === 'string' && userPicture.startsWith('data:image')) {
      // Validate base64 image using magic bytes
      const validation = await validateBase64Image(userPicture);
      if (!validation.isValid || !validation.buffer || !validation.mimeType) {
        // Don't fail signup if image is invalid, just skip upload
        console.warn('Invalid profile picture provided during signup');
      } else {
        const fileExt = getExtensionFromMimeType(validation.mimeType);
        const filePath = `profile-pictures/${authData.user.id}/${Date.now()}${fileExt}`;
        profilePictureUrl = await uploadBase64Image(
          serviceRoleClient,
          'profile-pictures',
          filePath,
          userPicture,
          validation.mimeType
        );
      }
    }

    // Create or update profile in database (trigger may have created basic profile)
    // NOTE: Address fields are now stored in the 'addresses' table, not in 'profiles'
    // Only save profile-specific fields here
    const profileData = {
      id: authData.user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: normalizeString(phone),
      referral: normalizeString(referral),
      referral_other: normalizeString(referralOther),
      // Address fields removed - they're saved to addresses table below
      // company_name removed - businesses are linked via business_id foreign key
      company_role: normalizeString(companyRole),
      user_picture: profilePictureUrl || null,
    };

    // Log profile data before database operation
    if (process.env.NODE_ENV === 'development') {
      console.log('[Signup API] Profile data to save:', JSON.stringify(profileData, null, 2));
    }

    // Use upsert to handle case where trigger already created basic profile
    // This ensures all fields are properly set even if they're null
    // The trigger runs AFTER INSERT, so there may be a race condition
    // Using upsert with onConflict ensures we update if the profile exists, or insert if it doesn't
    const { data: upsertedProfile, error: profileError } = await serviceRoleClient
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (profileError) {
      console.error('[Signup API] Profile save error:', {
        error: profileError,
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
      // Log profile data that failed in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[Signup API] Profile data that failed:', JSON.stringify(profileData, null, 2));
      }
      // Don't fail - profile can be updated later, but log the error
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Signup API] Profile saved successfully:', {
          id: upsertedProfile?.id,
          phone: upsertedProfile?.phone ? '***' : null,
          referral: upsertedProfile?.referral,
        });
      }
    }

    // Save address to addresses table if address fields are provided
    const hasAnyAddressField = !!(
      normalizeString(streetAddress) ||
      normalizeString(city) ||
      normalizeString(state) ||
      normalizeString(zipCode)
    );

    if (hasAnyAddressField) {
      // Required fields must always be included
      const addressData = {
        user_id: authData.user.id,
        address_type: 'personal' as const,
        street_address: normalizeString(streetAddress) || undefined,
        apartment: normalizeString(apartment) || undefined,
        city: normalizeString(city) || undefined,
        state: normalizeString(state) || undefined,
        zip_code: normalizeString(zipCode) || undefined,
        gate_code: normalizeString(gateCode) || undefined,
        address_note: normalizeString(addressNote) || undefined,
        is_public: false,
        is_verified: false,
      };

      const { error: addressError } = await serviceRoleClient
        .from('addresses')
        .insert(addressData);

      if (addressError) {
        console.error('[Signup API] Address save error:', {
          error: addressError,
          code: addressError.code,
          message: addressError.message,
          details: addressError.details,
          hint: addressError.hint,
        });
        // Don't fail signup if address save fails - user can add address later
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Signup API] Address saved successfully');
        }
      }
    }

    // Assign role(s) if provided and valid
    const validUserTypes = ['customer', 'contractor', 'both'] as const;
    if (userType && validUserTypes.includes(userType as typeof validUserTypes[number])) {
      const roles: ('customer' | 'contractor')[] = userType === 'both' 
        ? ['customer', 'contractor'] 
        : [userType as 'customer' | 'contractor'];
      
      for (const role of roles) {
        // Check if role already exists
        // Use maybeSingle() instead of single() to handle case where role doesn't exist yet
        const { data: existingRole, error: roleCheckError } = await serviceRoleClient
          .from('user_roles')
          .select('id')
          .eq('user_id', authData.user.id)
          .eq('role', role as 'customer' | 'contractor')
          .maybeSingle();

        // Ignore errors when checking - if role doesn't exist, we'll create it
        if (roleCheckError && roleCheckError.code !== 'PGRST116') {
          console.warn(`Error checking for existing ${role} role:`, roleCheckError);
        }

        if (!existingRole) {
          const { error: roleError } = await serviceRoleClient
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role: role as 'customer' | 'contractor',
              is_active: true,
              activated_at: new Date().toISOString(),
            });

          if (roleError) {
            console.error(`[Signup API] Error assigning ${role} role:`, {
              error: roleError,
              code: roleError.code,
              message: roleError.message,
              details: roleError.details,
              hint: roleError.hint,
            });
            // Don't fail - role can be assigned later
          }
        }
      }
    }

    // Return user data (use normalized values to match what was saved)
    const user = {
      id: authData.user.id,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: normalizeString(phone),
      referral: normalizeString(referral),
      referralOther: normalizeString(referralOther),
      streetAddress: normalizeString(streetAddress),
      apartment: normalizeString(apartment),
      city: normalizeString(city),
      state: normalizeString(state),
      zipCode: normalizeString(zipCode),
      gateCode: normalizeString(gateCode),
      addressNote: normalizeString(addressNote),
      // companyName removed - businesses are linked via business_id foreign key
      companyRole: normalizeString(companyRole),
      userPicture: profilePictureUrl || null,
    };

    // Send welcome email (non-blocking - don't fail signup if email fails)
    try {
      // Get locale from request headers or default to 'en'
      const locale = request.headers.get('x-locale') || 'en';

      // Get email translations using getMessages for better API route support
      const messages = await getMessages({ locale });
      const welcomeEmailMessages = messages?.auth?.welcomeEmail as Record<string, any> | undefined;
      const footerMessages = welcomeEmailMessages?.footer as Record<string, string> | undefined;

      if (!welcomeEmailMessages) {
        logger.warn('Welcome email translations not found', { locale, endpoint: '/api/auth/signup' });
      }

      const emailTranslations: WelcomeEmailTranslations = {
        subject: welcomeEmailMessages?.subject || 'Welcome to House Pros Hub!',
        greeting: welcomeEmailMessages?.greeting || 'Hello',
        customerWelcomeMessage: welcomeEmailMessages?.customerWelcomeMessage || '',
        contractorWelcomeMessage: welcomeEmailMessages?.contractorWelcomeMessage || '',
        bothWelcomeMessage: welcomeEmailMessages?.bothWelcomeMessage || '',
        nextSteps: welcomeEmailMessages?.nextSteps || 'Next Steps',
        customerNextSteps: welcomeEmailMessages?.customerNextSteps || '',
        contractorNextSteps: welcomeEmailMessages?.contractorNextSteps || '',
        bothNextSteps: welcomeEmailMessages?.bothNextSteps || '',
        footer: {
          companyName: footerMessages?.companyName || 'House Pros Hub',
          contactInfo: footerMessages?.contactInfo || 'If you have any questions, please contact us.',
          unsubscribe: footerMessages?.unsubscribe || 'You are receiving this email because you created an account with House Pros Hub.',
        },
      };

      // Prepare welcome email data
      const welcomeEmailData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        userType: (userType || 'customer') as 'customer' | 'contractor' | 'both',
      };

      // Send welcome email (errors are logged but don't fail signup)
      const emailResult = await sendWelcomeEmail(welcomeEmailData, normalizedEmail, emailTranslations);
      if (!emailResult.success) {
        logger.warn('Failed to send welcome email', {
          endpoint: '/api/auth/signup',
          userId: authData.user.id,
          userEmail: normalizedEmail,
          error: emailResult.error,
        });
      }
    } catch (emailError) {
      // Log error but don't fail signup
      logger.error('Error sending welcome email', {
        endpoint: '/api/auth/signup',
        userId: authData.user.id,
        userEmail: normalizedEmail,
      }, emailError as Error);
    }

    return NextResponse.json(
      { user },
      { status: 201 }
    );
  } catch (error) {
    // Log error server-side (in production, use proper logging service)
    console.error('[Signup API] Unhandled error:', error);
    if (error instanceof Error) {
      console.error('[Signup API] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
