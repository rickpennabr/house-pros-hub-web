# Supabase Storage Setup Guide

This guide explains how to set up Supabase Storage buckets for image uploads in the House Pros Hub application.

## Required Storage Buckets

You need to create three public storage buckets in your Supabase project:

1. **profile-pictures** - For user profile pictures
2. **business-logos** - For business logo images
3. **business-backgrounds** - For business background images

## Setup Steps

### 1. Create Storage Buckets

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Create each bucket with the following settings:

#### Profile Pictures Bucket
- **Name**: `profile-pictures`
- **Public bucket**: ✅ Yes (checked)
- **File size limit**: 2 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Business Logos Bucket
- **Name**: `business-logos`
- **Public bucket**: ✅ Yes (checked)
- **File size limit**: 2 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Business Backgrounds Bucket
- **Name**: `business-backgrounds`
- **Public bucket**: ✅ Yes (checked)
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

### 2. Set Up RLS Policies

After creating the buckets, you need to set up Row Level Security (RLS) policies. You can do this by:

1. Running the migration file: `supabase/migrations/003_create_storage_buckets.sql`
2. Or manually creating the policies in the Supabase Dashboard under **Storage** > **Policies**

The migration file includes all necessary RLS policies for:
- Users uploading their own profile pictures
- Business owners uploading logos and backgrounds for their businesses
- Public read access for all images

### 3. Verify Setup

After setup, test the image upload functionality:

1. **Profile Picture Upload**: 
   - Sign up or edit your profile
   - Upload a profile picture
   - Verify it appears correctly

2. **Business Logo Upload**:
   - Create or edit a business
   - Upload a business logo
   - Verify it appears correctly

3. **Business Background Upload**:
   - Create or edit a business
   - Upload a business background
   - Verify it appears correctly

## Migration File

The RLS policies are defined in:
```
supabase/migrations/003_create_storage_buckets.sql
```

Run this migration to automatically set up all the necessary policies.

## Notes

- All buckets should be **public** to allow image display without authentication
- Images are automatically resized before upload to optimize storage and performance
- Old images are automatically deleted when users upload new ones
- The storage structure organizes files by user/business ID for easy management

## Troubleshooting

If you encounter issues:

1. **"Bucket not found"**: Make sure all three buckets are created
2. **"Permission denied"**: Check that RLS policies are correctly set up
3. **"File too large"**: Verify file size limits match the bucket settings
4. **Images not displaying**: Ensure buckets are set to public

