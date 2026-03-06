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
          business_id: string | null;
          company_role: string | null;
          company_role_other: string | null;
          user_picture: string | null;
          referral: string | null;
          referral_other: string | null;
          preferred_locale: string | null;
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
          business_id?: string | null;
          company_role?: string | null;
          company_role_other?: string | null;
          user_picture?: string | null;
          referral?: string | null;
          referral_other?: string | null;
          preferred_locale?: string | null;
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
          business_id?: string | null;
          company_role?: string | null;
          company_role_other?: string | null;
          user_picture?: string | null;
          referral?: string | null;
          referral_other?: string | null;
          preferred_locale?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
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
      contractor_invitation_codes: {
        Row: {
          id: string;
          code: string;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          created_at?: string;
          expires_at: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "contractor_invitation_codes_used_by_fkey"; columns: ["used_by"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
      admin_users: {
        Row: { user_id: string };
        Insert: { user_id: string };
        Update: { user_id?: string };
        Relationships: [
          { foreignKeyName: "admin_users_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
      admin_push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "admin_push_subscriptions_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
      business_push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "business_push_subscriptions_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
      visitor_push_subscriptions: {
        Row: {
          id: string;
          conversation_id: string;
          visitor_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          visitor_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          visitor_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      probot_conversations: {
        Row: {
          id: string;
          visitor_id: string;
          created_at: string;
          updated_at: string;
          visitor_display_name: string | null;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          visitor_id: string;
          created_at?: string;
          updated_at?: string;
          visitor_display_name?: string | null;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          visitor_id?: string;
          created_at?: string;
          updated_at?: string;
          visitor_display_name?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      probot_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender: 'visitor' | 'admin';
          body: string;
          created_at: string;
          business_id: string | null;
          read_at: string | null;
          attachments: Json;
          admin_sent_as: string | null;
          admin_user_id: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender: 'visitor' | 'admin';
          body: string;
          created_at?: string;
          business_id?: string | null;
          read_at?: string | null;
          attachments?: Json;
          admin_sent_as?: string | null;
          admin_user_id?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender?: 'visitor' | 'admin';
          body?: string;
          created_at?: string;
          business_id?: string | null;
          read_at?: string | null;
          attachments?: Json;
          admin_sent_as?: string | null;
          admin_user_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "probot_messages_conversation_id_fkey"; columns: ["conversation_id"]; referencedRelation: "probot_conversations"; referencedColumns: ["id"] }
        ];
      };
      chat_presence: {
        Row: {
          id: string;
          key: string;
          visitor_id: string | null;
          user_id: string | null;
          business_id: string | null;
          last_seen_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          visitor_id?: string | null;
          user_id?: string | null;
          business_id?: string | null;
          last_seen_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          visitor_id?: string | null;
          user_id?: string | null;
          business_id?: string | null;
          last_seen_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          business_background_position: string | null;
          company_description: string | null;
          email: string | null;
          phone: string | null;
          mobile_phone: string | null;
          business_address_id: string | null;
          links: Json | null;
          services: string[] | null;
          images: Json | null;
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
          business_background_position?: string | null;
          company_description?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile_phone?: string | null;
          business_address_id?: string | null;
          links?: Json | null;
          services?: string[] | null;
          images?: Json | null;
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
          business_background_position?: string | null;
          company_description?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile_phone?: string | null;
          business_address_id?: string | null;
          links?: Json | null;
          services?: string[] | null;
          images?: Json | null;
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
          license_number: string | null;
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
          license_number: string | null;
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
          license_number?: string | null;
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
      license_categories: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          requires_contractor_license: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          requires_contractor_license?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          requires_contractor_license?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      password_reset_attempts: {
        Row: {
          id: string;
          email: string;
          ip_address: string | null;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          ip_address?: string | null;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          ip_address?: string | null;
          attempted_at?: string;
        };
        Relationships: [];
      };
      estimates: {
        Row: {
          id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          street_address: string;
          city: string;
          state: string;
          zip_code: string;
          apartment: string | null;
          project_type: 'new_construction' | 'renovation' | 'repair' | 'remodel' | 'other';
          project_type_other: string | null;
          requires_hoa_approval: boolean;
          wants_3d: boolean;
          trades: Json;
          project_description: string;
          project_images: Json | null;
          budget_range: 'under_5k' | '5k_10k' | '10k_25k' | '25k_50k' | '50k_100k' | 'over_100k' | 'not_sure';
          timeline: 'asap' | 'within_month' | '1_3_months' | '3_6_months' | '6_plus_months' | 'flexible';
          preferred_contact_method: 'phone' | 'email' | 'text' | 'either';
          additional_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          street_address: string;
          city: string;
          state: string;
          zip_code: string;
          apartment?: string | null;
          project_type: 'new_construction' | 'renovation' | 'repair' | 'remodel' | 'other';
          project_type_other?: string | null;
          requires_hoa_approval?: boolean;
          wants_3d?: boolean;
          trades: Json;
          project_description: string;
          project_images?: Json | null;
          budget_range: 'under_5k' | '5k_10k' | '10k_25k' | '25k_50k' | '50k_100k' | 'over_100k' | 'not_sure';
          timeline: 'asap' | 'within_month' | '1_3_months' | '3_6_months' | '6_plus_months' | 'flexible';
          preferred_contact_method: 'phone' | 'email' | 'text' | 'either';
          additional_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          street_address?: string;
          city?: string;
          state?: string;
          zip_code?: string;
          apartment?: string | null;
          project_type?: 'new_construction' | 'renovation' | 'repair' | 'remodel' | 'other';
          project_type_other?: string | null;
          requires_hoa_approval?: boolean;
          wants_3d?: boolean;
          trades?: Json;
          project_description?: string;
          project_images?: Json | null;
          budget_range?: 'under_5k' | '5k_10k' | '10k_25k' | '25k_50k' | '50k_100k' | 'over_100k' | 'not_sure';
          timeline?: 'asap' | 'within_month' | '1_3_months' | '3_6_months' | '6_plus_months' | 'flexible';
          preferred_contact_method?: 'phone' | 'email' | 'text' | 'either';
          additional_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estimates_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      pro_crm_customers: {
        Row: {
          id: string;
          owner_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          street_address: string | null;
          apartment: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          street_address?: string | null;
          apartment?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          street_address?: string | null;
          apartment?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pro_crm_customers_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      pro_crm_estimates: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          amount_cents: number;
          line_items: Json | null;
          status: 'draft' | 'sent' | 'accepted' | 'declined';
          due_date: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id: string;
          amount_cents?: number;
          line_items?: Json | null;
          status?: 'draft' | 'sent' | 'accepted' | 'declined';
          due_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          amount_cents?: number;
          line_items?: Json | null;
          status?: 'draft' | 'sent' | 'accepted' | 'declined';
          due_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_estimates_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_estimates_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "pro_crm_customers"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_projects: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          estimate_id: string | null;
          name: string;
          status: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
          start_date: string | null;
          end_date: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id: string;
          estimate_id?: string | null;
          name: string;
          status?: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
          start_date?: string | null;
          end_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          estimate_id?: string | null;
          name?: string;
          status?: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
          start_date?: string | null;
          end_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_projects_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_projects_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "pro_crm_customers"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_projects_estimate_id_fkey"; columns: ["estimate_id"]; referencedRelation: "pro_crm_estimates"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_expenses: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string | null;
          amount_cents: number;
          category: string;
          expense_date: string;
          note: string | null;
          receipt_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          project_id?: string | null;
          amount_cents?: number;
          category?: string;
          expense_date?: string;
          note?: string | null;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          project_id?: string | null;
          amount_cents?: number;
          category?: string;
          expense_date?: string;
          note?: string | null;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_expenses_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_expenses_project_id_fkey"; columns: ["project_id"]; referencedRelation: "pro_crm_projects"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_availability: {
        Row: {
          id: string;
          owner_id: string;
          type: 'available' | 'unavailable' | 'appointment';
          start_at: string;
          end_at: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          type: 'available' | 'unavailable' | 'appointment';
          start_at: string;
          end_at: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          type?: 'available' | 'unavailable' | 'appointment';
          start_at?: string;
          end_at?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_availability_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
      csrf_tokens: {
        Row: {
          user_id: string;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          token: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "csrf_tokens_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      incoming_emails: {
        Row: {
          id: string;
          message_id: string | null;
          from_email: string;
          from_name: string | null;
          to_email: string;
          subject: string | null;
          text_content: string | null;
          html_content: string | null;
          attachments: Json | null;
          headers: Json | null;
          status: 'new' | 'processing' | 'processed' | 'failed' | 'archived';
          processed_at: string | null;
          error_message: string | null;
          user_id: string | null;
          received_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          message_id?: string | null;
          from_email: string;
          from_name?: string | null;
          to_email: string;
          subject?: string | null;
          text_content?: string | null;
          html_content?: string | null;
          attachments?: Json | null;
          headers?: Json | null;
          status?: 'new' | 'processing' | 'processed' | 'failed' | 'archived';
          processed_at?: string | null;
          error_message?: string | null;
          user_id?: string | null;
          received_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string | null;
          from_email?: string;
          from_name?: string | null;
          to_email?: string;
          subject?: string | null;
          text_content?: string | null;
          html_content?: string | null;
          attachments?: Json | null;
          headers?: Json | null;
          status?: 'new' | 'processing' | 'processed' | 'failed' | 'archived';
          processed_at?: string | null;
          error_message?: string | null;
          user_id?: string | null;
          received_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incoming_emails_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      admin_notification_read: {
        Row: {
          user_id: string;
          read_at: string;
        };
        Insert: {
          user_id: string;
          read_at?: string;
        };
        Update: {
          user_id?: string;
          read_at?: string;
        };
        Relationships: [];
      };
      admin_notification_events: {
        Row: {
          id: string;
          event_type: 'signup' | 'deletion';
          entity_type: 'customer' | 'contractor';
          entity_id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: 'signup' | 'deletion';
          entity_type: 'customer' | 'contractor';
          entity_id: string;
          display_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: 'signup' | 'deletion';
          entity_type?: 'customer' | 'contractor';
          entity_id?: string;
          display_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cleanup_expired_password_reset_attempts: {
        Args: Record<string, never>;
        Returns: void;
      };
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

export type ContractorInvitationCode = Database['public']['Tables']['contractor_invitation_codes']['Row'];
export type ContractorInvitationCodeInsert = Database['public']['Tables']['contractor_invitation_codes']['Insert'];
export type ContractorInvitationCodeUpdate = Database['public']['Tables']['contractor_invitation_codes']['Update'];

export type Address = Database['public']['Tables']['addresses']['Row'];
export type AddressInsert = Database['public']['Tables']['addresses']['Insert'];
export type AddressUpdate = Database['public']['Tables']['addresses']['Update'];

export type Business = Database['public']['Tables']['businesses']['Row'];
export type BusinessInsert = Database['public']['Tables']['businesses']['Insert'];
export type BusinessUpdate = Database['public']['Tables']['businesses']['Update'];

export type License = Database['public']['Tables']['licenses']['Row'];
export type LicenseInsert = Database['public']['Tables']['licenses']['Insert'];
export type LicenseUpdate = Database['public']['Tables']['licenses']['Update'];

export type Estimate = Database['public']['Tables']['estimates']['Row'];
export type EstimateInsert = Database['public']['Tables']['estimates']['Insert'];
export type EstimateUpdate = Database['public']['Tables']['estimates']['Update'];

export type IncomingEmail = Database['public']['Tables']['incoming_emails']['Row'];
export type IncomingEmailInsert = Database['public']['Tables']['incoming_emails']['Insert'];
export type IncomingEmailUpdate = Database['public']['Tables']['incoming_emails']['Update'];
