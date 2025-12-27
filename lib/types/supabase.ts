/**
 * Supabase Database Types
 * 
 * This file should be generated using Supabase CLI:
 * npx supabase gen types typescript --project-id <project-id> > lib/types/supabase.ts
 * 
 * For now, we'll define the types manually based on the database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          street_address: string | null;
          apartment: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          gate_code: string | null;
          address_note: string | null;
          company_name: string | null;
          company_role: string | null;
          company_role_other: string | null;
          user_picture: string | null;
          referral: string | null;
          referral_other: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          street_address?: string | null;
          apartment?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          gate_code?: string | null;
          address_note?: string | null;
          company_name?: string | null;
          company_role?: string | null;
          company_role_other?: string | null;
          user_picture?: string | null;
          referral?: string | null;
          referral_other?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          street_address?: string | null;
          apartment?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          gate_code?: string | null;
          address_note?: string | null;
          company_name?: string | null;
          company_role?: string | null;
          company_role_other?: string | null;
          user_picture?: string | null;
          referral?: string | null;
          referral_other?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'customer' | 'contractor';
          is_active: boolean;
          activated_at: string | null;
          deactivated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'customer' | 'contractor';
          is_active?: boolean;
          activated_at?: string | null;
          deactivated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'customer' | 'contractor';
          is_active?: boolean;
          activated_at?: string | null;
          deactivated_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          address_type: 'personal' | 'business';
          street_address: string | null;
          apartment: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          gate_code: string | null;
          address_note: string | null;
          is_public: boolean;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address_type: 'personal' | 'business';
          street_address?: string | null;
          apartment?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          gate_code?: string | null;
          address_note?: string | null;
          is_public?: boolean;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          address_type?: 'personal' | 'business';
          street_address?: string | null;
          apartment?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          gate_code?: string | null;
          address_note?: string | null;
          is_public?: boolean;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          business_name: string;
          slug: string | null;
          business_logo: string | null;
          business_background: string | null;
          company_description: string | null;
          email: string | null;
          phone: string | null;
          mobile_phone: string | null;
          business_address_id: string | null;
          links: Json | null;
          operating_hours: Json | null;
          timezone: string;
          is_active: boolean;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          business_name: string;
          slug?: string | null;
          business_logo?: string | null;
          business_background?: string | null;
          company_description?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile_phone?: string | null;
          business_address_id?: string | null;
          links?: Json | null;
          operating_hours?: Json | null;
          timezone?: string;
          is_active?: boolean;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          business_name?: string;
          slug?: string | null;
          business_logo?: string | null;
          business_background?: string | null;
          company_description?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile_phone?: string | null;
          business_address_id?: string | null;
          links?: Json | null;
          operating_hours?: Json | null;
          timezone?: string;
          is_active?: boolean;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "businesses_business_address_id_fkey";
            columns: ["business_address_id"];
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          }
        ];
      };
      licenses: {
        Row: {
          id: string;
          business_id: string;
          license_number: string;
          license_type: string;
          license_name: string | null;
          issued_date: string | null;
          expiry_date: string | null;
          issuing_authority: string | null;
          is_active: boolean;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          license_number: string;
          license_type: string;
          license_name?: string | null;
          issued_date?: string | null;
          expiry_date?: string | null;
          issuing_authority?: string | null;
          is_active?: boolean;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          license_number?: string;
          license_type?: string;
          license_name?: string | null;
          issued_date?: string | null;
          expiry_date?: string | null;
          issuing_authority?: string | null;
          is_active?: boolean;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "licenses_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type UserRole = Database['public']['Tables']['user_roles']['Row'];
export type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert'];
export type UserRoleUpdate = Database['public']['Tables']['user_roles']['Update'];

export type Address = Database['public']['Tables']['addresses']['Row'];
export type AddressInsert = Database['public']['Tables']['addresses']['Insert'];
export type AddressUpdate = Database['public']['Tables']['addresses']['Update'];

export type Business = Database['public']['Tables']['businesses']['Row'];
export type BusinessInsert = Database['public']['Tables']['businesses']['Insert'];
export type BusinessUpdate = Database['public']['Tables']['businesses']['Update'];

export type License = Database['public']['Tables']['licenses']['Row'];
export type LicenseInsert = Database['public']['Tables']['licenses']['Insert'];
export type LicenseUpdate = Database['public']['Tables']['licenses']['Update'];
