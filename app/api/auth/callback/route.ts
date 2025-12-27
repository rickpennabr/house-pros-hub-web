import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { validateFileMagicBytes, getExtensionFromMimeType } from '@/lib/utils/fileValidation';
import { MAX_FILE_SIZES } from '@/lib/utils/fileValidation';

/**
 * GET /api/auth/callback
 * OAuth callback handler for Supabase
 * 
 * Handles OAuth redirects from providers (Google, etc.)
 * and creates/updates user profile if needed
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const role = requestUrl.searchParams.get('role') as 'customer' | 'contractor' | 'both' | null;
  const locale = requestUrl.searchParams.get('locale') || 'en';
  const next = requestUrl.searchParams.get('next') || '/';

  // Normalize base URL - convert 0.0.0.0 to localhost for redirects
  let baseUrl = request.url;
  if (baseUrl.includes('0.0.0.0')) {
    baseUrl = baseUrl.replace('0.0.0.0', 'localhost');
  }
  const normalizedBaseUrl = new URL(baseUrl);

  if (code) {
    const supabase = await createClient();
    
    // Exchange code for session
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && exchangeData?.user) {
      // Get the full user record to access OAuth metadata
      // getUser() fetches from database and includes full metadata
      const {
        data: { user: fullUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !fullUser) {
        console.error('Error getting user after OAuth:', userError);
        return NextResponse.redirect(new URL(`/${locale}/signin?error=oauth_error`, normalizedBaseUrl));
      }

      // Get the session to check if user exists
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Extract metadata from multiple sources - OAuth metadata might be in different places
        // Try exchangeData first, then fullUser (from getUser), then session
        const metadata = 
          exchangeData.user.user_metadata || 
          fullUser.user_metadata || 
          session.user.user_metadata || 
          {};
        
        // Parse name from Google OAuth metadata
        // Google provides: name, full_name, but not firstName/lastName
        // Also check app_metadata which sometimes contains OAuth data
        const appMetadata = fullUser.app_metadata || {};
        const allMetadata = { ...metadata, ...appMetadata };
        
        // Try multiple possible fields for name
        const fullName = 
          allMetadata.full_name || 
          allMetadata.name || 
          metadata.full_name || 
          metadata.name || 
          '';
        
        // Split name into first and last
        const nameParts = fullName.trim().split(/\s+/).filter((part: string) => part.length > 0);
        const firstName = nameParts.length > 0 ? nameParts[0] : null;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
        
        // Get picture from metadata (try multiple possible fields)
        const userPicture = 
          allMetadata.avatar_url || 
          allMetadata.picture || 
          metadata.avatar_url || 
          metadata.picture || 
          null;
        
        // Log for debugging
        console.log('[OAuth Callback] Metadata extraction:', {
          hasExchangeData: !!exchangeData.user.user_metadata,
          hasFullUserMetadata: !!fullUser.user_metadata,
          hasSessionMetadata: !!session.user.user_metadata,
          hasAppMetadata: !!fullUser.app_metadata,
          metadataKeys: Object.keys(metadata),
          appMetadataKeys: Object.keys(appMetadata),
          allMetadataKeys: Object.keys(allMetadata),
          fullName,
          firstName,
          lastName,
          userPicture,
          nameParts,
        });
        
        // If we still don't have a name, try reading directly from auth.users table
        // This is a fallback in case metadata isn't in the expected format
        let finalFirstName = firstName;
        let finalLastName = lastName;
        let finalUserPicture = userPicture;
        
        if (!finalFirstName) {
          console.log('[OAuth Callback] Attempting to read raw_user_meta_data from auth.users table...');
          try {
            // Use service role client to read from auth.users (admin operation)
            const serviceRoleClient = createServiceRoleClient();
            // Note: We can't directly query auth.users with Supabase client
            // But we can try to get it from the user object which should have it
            // If that fails, we'll log it for debugging
            console.log('[OAuth Callback] Full user object:', JSON.stringify(fullUser, null, 2));
          } catch (err) {
            console.error('[OAuth Callback] Error reading raw metadata:', err);
          }
        }
        
        // Final validation
        if (!finalFirstName) {
          console.error('[OAuth Callback] CRITICAL: Could not extract first name from OAuth!', {
            userId: fullUser.id,
            email: fullUser.email,
            metadata,
            appMetadata,
            allMetadata,
            exchangeDataUser: exchangeData.user,
            fullUserObject: fullUser,
          });
        }
        
        // Check if profile already exists before processing picture
        // This prevents overwriting a custom profile picture on subsequent sign-ins
        const serviceRoleClient = createServiceRoleClient();
        const { data: existingProfile } = await serviceRoleClient
          .from('profiles')
          .select('user_picture')
          .eq('id', fullUser.id)
          .maybeSingle();
        
        const hasExistingPicture = existingProfile?.user_picture && 
          existingProfile.user_picture.trim().length > 0;
        
        // Only download and upload Google profile picture if:
        // 1. User doesn't have an existing profile picture, OR
        // 2. This is a new user (no profile exists yet)
        let uploadedPictureUrl: string | null = finalUserPicture;
        if (finalUserPicture && !hasExistingPicture) {
          try {
            console.log('[OAuth Callback] Downloading Google profile picture:', finalUserPicture);
            
            // Download the image from Google
            const imageResponse = await fetch(finalUserPicture);
            if (!imageResponse.ok) {
              console.warn('[OAuth Callback] Failed to download Google profile picture:', imageResponse.status);
            } else {
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              
              // Validate file size
              if (imageBuffer.length > MAX_FILE_SIZES.profile) {
                console.warn('[OAuth Callback] Google profile picture too large, skipping upload');
              } else {
                // Validate file type using magic bytes
                const validation = await validateFileMagicBytes(imageBuffer);
                
                if (validation.isValid && validation.mimeType) {
                  // Upload to Supabase storage
                  const fileExt = getExtensionFromMimeType(validation.mimeType);
                  // Path should be relative to bucket root (bucket is specified in .from())
                  // Format: userId/timestamp.ext
                  const filePath = `${fullUser.id}/${Date.now()}${fileExt}`;
                  
                  console.log('[OAuth Callback] Uploading to profile-pictures bucket with path:', filePath);
                  
                  const { data: uploadData, error: uploadError } = await serviceRoleClient.storage
                    .from('profile-pictures')
                    .upload(filePath, imageBuffer, {
                      cacheControl: '3600',
                      upsert: false,
                      contentType: validation.mimeType,
                    });
                  
                  if (uploadError) {
                    console.error('[OAuth Callback] Error uploading profile picture to storage:', {
                      error: uploadError,
                      message: uploadError.message,
                      filePath,
                    });
                  } else {
                    // Get public URL - uploadData.path should be the relative path within the bucket
                    const { data: { publicUrl } } = serviceRoleClient.storage
                      .from('profile-pictures')
                      .getPublicUrl(uploadData.path);
                    
                    uploadedPictureUrl = publicUrl;
                    console.log('[OAuth Callback] Profile picture uploaded successfully:', {
                      uploadPath: uploadData.path,
                      publicUrl,
                      bucket: 'profile-pictures',
                    });
                  }
                } else {
                  console.warn('[OAuth Callback] Invalid image type from Google, skipping upload');
                }
              }
            }
          } catch (error) {
            console.error('[OAuth Callback] Error processing Google profile picture:', error);
            // Continue with original Google URL if upload fails
          }
        } else if (hasExistingPicture) {
          // Keep existing picture, don't overwrite with Google's picture
          uploadedPictureUrl = existingProfile.user_picture;
          console.log('[OAuth Callback] User already has a profile picture, keeping existing:', uploadedPictureUrl);
        }
        
        // Store terms acceptance timestamp for audit trail
        // Since user went through terms agreement screen before OAuth, they agreed at signup time
        // TODO: Add terms_accepted_at column to profiles table, then uncomment this
        // const termsAcceptedAt = new Date().toISOString();
        
        const profileData = {
          id: fullUser.id,
          first_name: finalFirstName,
          last_name: finalLastName,
          // Only update user_picture if we have a new one to set
          // If user already has a picture, keep it (uploadedPictureUrl will be the existing one)
          user_picture: uploadedPictureUrl,
          // terms_accepted_at: termsAcceptedAt, // Uncomment when column is added to database
        };

        console.log('[OAuth Callback] Profile data to upsert:', profileData);

        // Use service role client to bypass RLS for profile upsert
        // This ensures the profile is created/updated even if RLS policies would block it
        // Reuse the serviceRoleClient created earlier
        const { data: upsertedProfile, error: profileError } = await serviceRoleClient
          .from('profiles')
          .upsert(profileData, {
            onConflict: 'id',
          })
          .select()
          .single();
        
        if (profileError) {
          console.error('[OAuth Callback] Error upserting profile:', {
            error: profileError,
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            profileData,
          });
        } else {
          console.log('[OAuth Callback] Profile upserted successfully:', upsertedProfile);
          
          // Verify the data was actually saved
          if (!upsertedProfile?.first_name || !upsertedProfile?.last_name) {
            console.warn('[OAuth Callback] WARNING: Profile upserted but first_name or last_name is missing!', upsertedProfile);
          }
        }

        // Assign role(s) if provided
        if (role) {
          const roles = role === 'both' 
            ? ['customer', 'contractor'] 
            : [role];
          
          // Use service role client for role operations too
          // Reuse the serviceRoleClient created earlier
          for (const r of roles) {
            // Check if role already exists
            // Use maybeSingle() instead of single() to handle case where role doesn't exist yet
            const { data: existingRole, error: roleCheckError } = await serviceRoleClient
              .from('user_roles')
              .select('id')
              .eq('user_id', fullUser.id)
              .eq('role', r as 'customer' | 'contractor')
              .maybeSingle();

            // Ignore errors when checking - if role doesn't exist, we'll create it
            if (roleCheckError && roleCheckError.code !== 'PGRST116') {
              console.warn(`Error checking for existing ${r} role:`, roleCheckError);
            }

            if (!existingRole) {
              const { error: roleError } = await serviceRoleClient
                .from('user_roles')
                .insert({
                  user_id: fullUser.id,
                  role: r as 'customer' | 'contractor',
                  is_active: true,
                  activated_at: new Date().toISOString(),
                });
              
              if (roleError) {
                console.error('[OAuth Callback] Error assigning role:', roleError);
              } else {
                console.log(`[OAuth Callback] Role ${r} assigned successfully`);
              }
            } else {
              // Reactivate role if it was deactivated
              const { error: reactivateError } = await serviceRoleClient
                .from('user_roles')
                .update({
                  is_active: true,
                  activated_at: new Date().toISOString(),
                  deactivated_at: null,
                })
                .eq('user_id', fullUser.id)
                .eq('role', r as 'customer' | 'contractor');
              
              if (reactivateError) {
                console.error('[OAuth Callback] Error reactivating role:', reactivateError);
              } else {
                console.log(`[OAuth Callback] Role ${r} reactivated successfully`);
              }
            }
          }
        }

        // Determine redirect path based on role
        let redirectPath = next;
        
        // Make redirectPath locale-aware if it doesn't already have a locale prefix
        if (redirectPath && !redirectPath.match(/^\/(en|es)(\/|$)/)) {
          // If next is just '/', use locale home
          if (redirectPath === '/') {
            redirectPath = `/${locale}`;
          } else {
            redirectPath = `/${locale}${redirectPath.startsWith('/') ? '' : '/'}${redirectPath}`;
          }
        }
        
        if (role) {
          // After OAuth signup, redirect contractors to profile completion
          // Customers go to success page, contractors need to complete profile info
          if (role === 'contractor' || role === 'both') {
            redirectPath = `/${locale}/signup/complete-profile?role=${role}`;
          } else {
            // Customer role - redirect to success page
            redirectPath = `/${locale}/signup/success?role=${role}`;
          }
        } else {
          // No role specified, redirect to home page
          redirectPath = `/${locale}`;
        }

        // Redirect to the determined path using normalized base URL
        return NextResponse.redirect(new URL(redirectPath, normalizedBaseUrl));
      }
    }
  }

  // If there's an error or no code, redirect to sign-in with error using normalized base URL
  return NextResponse.redirect(new URL(`/${locale}/signin?error=oauth_error`, normalizedBaseUrl));
}

