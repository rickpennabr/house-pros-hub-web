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
          phone_digits: string | null;
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
          role: 'customer' | 'contractor' | 'realtor' | 'installer';
          is_active: boolean;
          activated_at: string | null;
          deactivated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'customer' | 'contractor' | 'realtor' | 'installer';
          is_active?: boolean;
          activated_at?: string | null;
          deactivated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'customer' | 'contractor' | 'realtor' | 'installer';
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
      installer_profiles: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          display_name: string;
          photo_url: string | null;
          phone: string | null;
          email: string | null;
          bio: string | null;
          trades: string[];
          service_area: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          display_name: string;
          photo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          bio?: string | null;
          trades?: string[];
          service_area?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          display_name?: string;
          photo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          bio?: string | null;
          trades?: string[];
          service_area?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "installer_profiles_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      invitation_codes: {
        Row: {
          id: string;
          role: 'contractor' | 'realtor' | 'installer';
          code: string;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          id?: string;
          role: 'contractor' | 'realtor' | 'installer';
          code: string;
          created_at?: string;
          expires_at: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          id?: string;
          role?: 'contractor' | 'realtor' | 'installer';
          code?: string;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invitation_codes_used_by_fkey";
            columns: ["used_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      business_services: {
        Row: {
          business_id: string;
          service_name: string;
        };
        Insert: {
          business_id: string;
          service_name: string;
        };
        Update: {
          business_id?: string;
          service_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_services_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          }
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
          agent_paused_at: string | null;
        };
        Insert: {
          id?: string;
          visitor_id: string;
          created_at?: string;
          updated_at?: string;
          visitor_display_name?: string | null;
          user_id?: string | null;
          agent_paused_at?: string | null;
        };
        Update: {
          id?: string;
          visitor_id?: string;
          created_at?: string;
          updated_at?: string;
          visitor_display_name?: string | null;
          user_id?: string | null;
          agent_paused_at?: string | null;
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
          payload: Json | null;
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
          payload?: Json | null;
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
          payload?: Json | null;
        };
        Relationships: [
          { foreignKeyName: "probot_messages_conversation_id_fkey"; columns: ["conversation_id"]; referencedRelation: "probot_conversations"; referencedColumns: ["id"] }
        ];
      };
      probot_reply_traces: {
        Row: {
          id: string;
          conversation_id: string;
          provider: string;
          model: string;
          playbook_attached: boolean;
          latency_ms: number;
          outcome: 'model' | 'fallback';
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          provider: string;
          model: string;
          playbook_attached: boolean;
          latency_ms: number;
          outcome: 'model' | 'fallback';
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          provider?: string;
          model?: string;
          playbook_attached?: boolean;
          latency_ms?: number;
          outcome?: 'model' | 'fallback';
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "probot_reply_traces_conversation_id_fkey"; columns: ["conversation_id"]; referencedRelation: "probot_conversations"; referencedColumns: ["id"] }
        ];
      };
      probot_agent_steps: {
        Row: {
          id: string;
          conversation_id: string;
          message_id: string | null;
          step_index: number;
          tool_name: string;
          status: 'ok' | 'needs_confirm' | 'confirmed' | 'failed' | 'fallback';
          latency_ms: number;
          input: Json | null;
          output: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          message_id?: string | null;
          step_index: number;
          tool_name: string;
          status: 'ok' | 'needs_confirm' | 'confirmed' | 'failed' | 'fallback';
          latency_ms?: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          message_id?: string | null;
          step_index?: number;
          tool_name?: string;
          status?: 'ok' | 'needs_confirm' | 'confirmed' | 'failed' | 'fallback';
          latency_ms?: number;
          input?: Json | null;
          output?: Json | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "probot_agent_steps_conversation_id_fkey"; columns: ["conversation_id"]; referencedRelation: "probot_conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "probot_agent_steps_message_id_fkey"; columns: ["message_id"]; referencedRelation: "probot_messages"; referencedColumns: ["id"] }
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
          display_id: string;
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
          display_order: number | null;
          show_calendar_on_procard: boolean;
          appointment_slot_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_id?: string;
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
          display_order?: number | null;
          show_calendar_on_procard?: boolean;
          appointment_slot_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_id?: string;
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
          display_order?: number | null;
          show_calendar_on_procard?: boolean;
          appointment_slot_minutes?: number;
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
      referral_options: {
        Row: {
          id: string;
          label: string;
          asks_for_name: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          asks_for_name?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          asks_for_name?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: number;
          name: string;
          supplier_type: string;
          materials: string[];
          address: string;
          phone: string;
          website: string;
          logo: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          name: string;
          supplier_type: string;
          materials?: string[];
          address?: string;
          phone?: string;
          website?: string;
          logo?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          supplier_type?: string;
          materials?: string[];
          address?: string;
          phone?: string;
          website?: string;
          logo?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          locale: 'en' | 'es' | 'pt';
          slug: string;
          title: string;
          excerpt: string;
          body: string;
          category: 'hardscape' | 'landscape';
          region: string;
          cover_image_url: string | null;
          published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          locale?: 'en' | 'es' | 'pt';
          slug: string;
          title: string;
          excerpt?: string;
          body?: string;
          category: 'hardscape' | 'landscape';
          region?: string;
          cover_image_url?: string | null;
          published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          locale?: 'en' | 'es' | 'pt';
          slug?: string;
          title?: string;
          excerpt?: string;
          body?: string;
          category?: 'hardscape' | 'landscape';
          region?: string;
          cover_image_url?: string | null;
          published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_jobs: {
        Row: {
          id: string;
          owner_id: string;
          business_id: string;
          title: string;
          description: string;
          category: string;
          employment_type: 'full_time' | 'part_time' | 'contract' | 'hourly';
          workplace_type: 'on_site' | 'hybrid';
          workplace_language: 'en' | 'es' | 'bilingual';
          city: string;
          state: string;
          pay: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          business_id: string;
          title: string;
          description: string;
          category: string;
          employment_type: 'full_time' | 'part_time' | 'contract' | 'hourly';
          workplace_type: 'on_site' | 'hybrid';
          workplace_language: 'en' | 'es' | 'bilingual';
          city: string;
          state: string;
          pay?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          business_id?: string;
          title?: string;
          description?: string;
          category?: string;
          employment_type?: 'full_time' | 'part_time' | 'contract' | 'hourly';
          workplace_type?: 'on_site' | 'hybrid';
          workplace_language?: 'en' | 'es' | 'bilingual';
          city?: string;
          state?: string;
          pay?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pro_jobs_business_id_fkey';
            columns: ['business_id'];
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          }
        ];
      };
      pro_resumes: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          headline: string;
          email: string;
          phone: string;
          city: string;
          state: string;
          summary: string;
          skills: Json;
          experience: Json;
          education: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string;
          headline?: string;
          email?: string;
          phone?: string;
          city?: string;
          state?: string;
          summary?: string;
          skills?: Json;
          experience?: Json;
          education?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          headline?: string;
          email?: string;
          phone?: string;
          city?: string;
          state?: string;
          summary?: string;
          skills?: Json;
          experience?: Json;
          education?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_job_applications: {
        Row: {
          id: string;
          job_id: string;
          installer_id: string;
          snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          installer_id: string;
          snapshot: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          installer_id?: string;
          snapshot?: Json;
          created_at?: string;
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
          project_type: 'new_construction' | 'renovation' | 'repair' | 'remodel' | 'addition_extension' | 'other';
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
          source: 'web' | 'agent' | 'quick_repair';
          latitude: number | null;
          longitude: number | null;
          location_accuracy_m: number | null;
          project_drive_file_ids: string[];
          agent_app_id: string | null;
          idempotency_key: string | null;
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
          project_type: 'new_construction' | 'renovation' | 'repair' | 'remodel' | 'addition_extension' | 'other';
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
          source?: 'web' | 'agent' | 'quick_repair';
          latitude?: number | null;
          longitude?: number | null;
          location_accuracy_m?: number | null;
          project_drive_file_ids?: string[];
          agent_app_id?: string | null;
          idempotency_key?: string | null;
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
          project_type?: 'new_construction' | 'renovation' | 'repair' | 'remodel' | 'addition_extension' | 'other';
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
          source?: 'web' | 'agent' | 'quick_repair';
          latitude?: number | null;
          longitude?: number | null;
          location_accuracy_m?: number | null;
          project_drive_file_ids?: string[];
          agent_app_id?: string | null;
          idempotency_key?: string | null;
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
      agent_apps: {
        Row: {
          id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          created_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          created_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      pro_crm_customers: {
        Row: {
          id: string;
          owner_id: string;
          display_id: string;
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
          title: string | null;
          middle_name: string | null;
          suffix: string | null;
          company_name: string | null;
          display_name: string | null;
          cc: string | null;
          bcc: string | null;
          mobile_number: string | null;
          fax: string | null;
          other: string | null;
          website: string | null;
          name_on_checks: string | null;
          billing_address_street_1: string | null;
          billing_address_street_2: string | null;
          billing_address_city: string | null;
          billing_address_state: string | null;
          billing_address_zip_code: string | null;
          billing_address_country: string | null;
          shipping_same_as_billing: boolean;
          shipping_address_street_1: string | null;
          shipping_address_street_2: string | null;
          shipping_address_city: string | null;
          shipping_address_state: string | null;
          shipping_address_zip_code: string | null;
          shipping_address_country: string | null;
          notes: string | null;
          primary_payment_method: string | null;
          payment_terms: string | null;
          invoice_language: 'en' | 'es';
          opening_balance: number | null;
          portal_user_id: string | null;
          place_id: string | null;
          portal_kind: 'house' | 'business' | 'building' | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_id?: string;
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
          title?: string | null;
          middle_name?: string | null;
          suffix?: string | null;
          company_name?: string | null;
          display_name?: string | null;
          cc?: string | null;
          bcc?: string | null;
          mobile_number?: string | null;
          fax?: string | null;
          other?: string | null;
          website?: string | null;
          name_on_checks?: string | null;
          billing_address_street_1?: string | null;
          billing_address_street_2?: string | null;
          billing_address_city?: string | null;
          billing_address_state?: string | null;
          billing_address_zip_code?: string | null;
          billing_address_country?: string | null;
          shipping_same_as_billing?: boolean;
          shipping_address_street_1?: string | null;
          shipping_address_street_2?: string | null;
          shipping_address_city?: string | null;
          shipping_address_state?: string | null;
          shipping_address_zip_code?: string | null;
          shipping_address_country?: string | null;
          notes?: string | null;
          primary_payment_method?: string | null;
          payment_terms?: string | null;
          invoice_language?: 'en' | 'es';
          opening_balance?: number | null;
          portal_user_id?: string | null;
          place_id?: string | null;
          portal_kind?: 'house' | 'business' | 'building' | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_id?: string;
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
          title?: string | null;
          middle_name?: string | null;
          suffix?: string | null;
          company_name?: string | null;
          display_name?: string | null;
          cc?: string | null;
          bcc?: string | null;
          mobile_number?: string | null;
          fax?: string | null;
          other?: string | null;
          website?: string | null;
          name_on_checks?: string | null;
          billing_address_street_1?: string | null;
          billing_address_street_2?: string | null;
          billing_address_city?: string | null;
          billing_address_state?: string | null;
          billing_address_zip_code?: string | null;
          billing_address_country?: string | null;
          shipping_same_as_billing?: boolean;
          shipping_address_street_1?: string | null;
          shipping_address_street_2?: string | null;
          shipping_address_city?: string | null;
          shipping_address_state?: string | null;
          shipping_address_zip_code?: string | null;
          shipping_address_country?: string | null;
          notes?: string | null;
          primary_payment_method?: string | null;
          payment_terms?: string | null;
          invoice_language?: 'en' | 'es';
          opening_balance?: number | null;
          portal_user_id?: string | null;
          place_id?: string | null;
          portal_kind?: 'house' | 'business' | 'building' | null;
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
      pro_crm_roles: {
        Row: {
          id: string;
          owner_id: string | null;
          slug: string;
          name: string;
          can_invoice: boolean;
          is_system: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          slug: string;
          name: string;
          can_invoice?: boolean;
          is_system?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          slug?: string;
          name?: string;
          can_invoice?: boolean;
          is_system?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_roles_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_contact_roles: {
        Row: {
          contact_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          contact_id: string;
          role_id: string;
          created_at?: string;
        };
        Update: {
          contact_id?: string;
          role_id?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_contact_roles_contact_id_fkey"; columns: ["contact_id"]; referencedRelation: "pro_crm_customers"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_contact_roles_role_id_fkey"; columns: ["role_id"]; referencedRelation: "pro_crm_roles"; referencedColumns: ["id"] }
        ];
      };
      customer_places: {
        Row: {
          id: string;
          user_id: string;
          kind: 'house' | 'business' | 'building';
          name: string;
          street: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind?: 'house' | 'business' | 'building';
          name: string;
          street?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: 'house' | 'business' | 'building';
          name?: string;
          street?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_crm_project_phases: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          name: string;
          sort_order: number;
          status: 'planned' | 'in_progress' | 'done';
          start_date: string | null;
          end_date: string | null;
          customer_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id: string;
          name: string;
          sort_order?: number;
          status?: 'planned' | 'in_progress' | 'done';
          start_date?: string | null;
          end_date?: string | null;
          customer_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          owner_id?: string;
          name?: string;
          sort_order?: number;
          status?: 'planned' | 'in_progress' | 'done';
          start_date?: string | null;
          end_date?: string | null;
          customer_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_crm_maintenance_plans: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          name: string;
          summary: string | null;
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
          next_visit_date: string | null;
          last_visit_date: string | null;
          end_date: string | null;
          is_active: boolean;
          amount_cents: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id: string;
          name: string;
          summary?: string | null;
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
          next_visit_date?: string | null;
          last_visit_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          amount_cents?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          name?: string;
          summary?: string | null;
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
          next_visit_date?: string | null;
          last_visit_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          amount_cents?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_crm_customer_documents: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          project_id: string | null;
          maintenance_plan_id: string | null;
          kind: 'contract' | 'project_pdf' | 'agreement' | 'other';
          title: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          content_type: string;
          visible_to_customer: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id: string;
          project_id?: string | null;
          maintenance_plan_id?: string | null;
          kind: 'contract' | 'project_pdf' | 'agreement' | 'other';
          title: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          content_type: string;
          visible_to_customer?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          project_id?: string | null;
          maintenance_plan_id?: string | null;
          kind?: 'contract' | 'project_pdf' | 'agreement' | 'other';
          title?: string;
          file_name?: string;
          file_path?: string;
          file_size_bytes?: number;
          content_type?: string;
          visible_to_customer?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_crm_customer_attachments: {
        Row: {
          id: string;
          customer_id: string;
          owner_id: string;
          file_name: string;
          storage_path: string;
          file_size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          owner_id: string;
          file_name: string;
          storage_path: string;
          file_size_bytes: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          owner_id?: string;
          file_name?: string;
          storage_path?: string;
          file_size_bytes?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pro_crm_customer_attachments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "pro_crm_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pro_crm_customer_attachments_owner_id_fkey";
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
          display_id: string;
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
          display_id?: string;
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
          display_id?: string;
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
          display_id: string;
          customer_id: string;
          estimate_id: string | null;
          name: string;
          status: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
          start_date: string | null;
          end_date: string | null;
          note: string | null;
          shared: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_id?: string;
          customer_id: string;
          estimate_id?: string | null;
          name: string;
          status?: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
          start_date?: string | null;
          end_date?: string | null;
          note?: string | null;
          shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_id?: string;
          customer_id?: string;
          estimate_id?: string | null;
          name?: string;
          status?: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
          start_date?: string | null;
          end_date?: string | null;
          note?: string | null;
          shared?: boolean;
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
          description: string | null;
          supplier_id: string | null;
          po_number: string | null;
          quantity: number | null;
          unit: string | null;
          requested_by: string | null;
          ordered_by: string | null;
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
          description?: string | null;
          supplier_id?: string | null;
          po_number?: string | null;
          quantity?: number | null;
          unit?: string | null;
          requested_by?: string | null;
          ordered_by?: string | null;
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
          description?: string | null;
          supplier_id?: string | null;
          po_number?: string | null;
          quantity?: number | null;
          unit?: string | null;
          requested_by?: string | null;
          ordered_by?: string | null;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_expenses_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_expenses_project_id_fkey"; columns: ["project_id"]; referencedRelation: "pro_crm_projects"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_expenses_supplier_id_fkey"; columns: ["supplier_id"]; referencedRelation: "pro_crm_customers"; referencedColumns: ["id"] }
        ];
      };
      pro_invoice_settings: {
        Row: {
          owner_id: string;
          default_business_id: string | null;
          theme_color_hex: string;
          invoice_prefix: string;
          next_number: number;
          company_tagline: string | null;
          default_display_name_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          default_business_id?: string | null;
          theme_color_hex?: string;
          invoice_prefix?: string;
          next_number?: number;
          company_tagline?: string | null;
          default_display_name_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          default_business_id?: string | null;
          theme_color_hex?: string;
          invoice_prefix?: string;
          next_number?: number;
          company_tagline?: string | null;
          default_display_name_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_invoice_settings_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_invoice_settings_default_business_id_fkey"; columns: ["default_business_id"]; referencedRelation: "businesses"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_invoices: {
        Row: {
          id: string;
          owner_id: string;
          display_id: string;
          customer_id: string;
          estimate_id: string | null;
          business_id: string | null;
          invoice_number: string;
          amount_cents: number;
          payment_applied_cents: number;
          line_items: Json | null;
          status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
          invoice_date: string;
          due_date: string | null;
          payment_terms: string | null;
          note: string | null;
          company_display: Json | null;
          last_reminded_at: string | null;
          recurring_invoice_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_id?: string;
          customer_id: string;
          estimate_id?: string | null;
          business_id?: string | null;
          invoice_number: string;
          amount_cents?: number;
          payment_applied_cents?: number;
          line_items?: Json | null;
          status?: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
          invoice_date?: string;
          due_date?: string | null;
          payment_terms?: string | null;
          note?: string | null;
          company_display?: Json | null;
          last_reminded_at?: string | null;
          recurring_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_id?: string;
          customer_id?: string;
          estimate_id?: string | null;
          business_id?: string | null;
          invoice_number?: string;
          amount_cents?: number;
          payment_applied_cents?: number;
          line_items?: Json | null;
          status?: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
          invoice_date?: string;
          due_date?: string | null;
          payment_terms?: string | null;
          note?: string | null;
          company_display?: Json | null;
          last_reminded_at?: string | null;
          recurring_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_invoices_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_invoices_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "pro_crm_customers"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_invoices_estimate_id_fkey"; columns: ["estimate_id"]; referencedRelation: "pro_crm_estimates"; referencedColumns: ["id"] },
          { foreignKeyName: "pro_crm_invoices_business_id_fkey"; columns: ["business_id"]; referencedRelation: "businesses"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_invoice_payments: {
        Row: {
          id: string;
          owner_id: string;
          invoice_id: string;
          amount_cents: number;
          payment_date: string;
          method: 'cash' | 'check' | 'card' | 'transfer' | 'other';
          reference: string | null;
          note: string | null;
          voided_at: string | null;
          voided_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          invoice_id: string;
          amount_cents: number;
          payment_date?: string;
          method?: 'cash' | 'check' | 'card' | 'transfer' | 'other';
          reference?: string | null;
          note?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          invoice_id?: string;
          amount_cents?: number;
          payment_date?: string;
          method?: 'cash' | 'check' | 'card' | 'transfer' | 'other';
          reference?: string | null;
          note?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_invoice_payments_invoice_id_fkey"; columns: ["invoice_id"]; referencedRelation: "pro_crm_invoices"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_document_events: {
        Row: {
          id: string;
          owner_id: string;
          invoice_id: string;
          actor_id: string | null;
          action: 'sent' | 'payment_recorded' | 'payment_voided' | 'cancelled' | 'reminded' | 'recurred';
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          invoice_id: string;
          actor_id?: string | null;
          action: 'sent' | 'payment_recorded' | 'payment_voided' | 'cancelled' | 'reminded' | 'recurred';
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          invoice_id?: string;
          actor_id?: string | null;
          action?: 'sent' | 'payment_recorded' | 'payment_voided' | 'cancelled' | 'reminded' | 'recurred';
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_document_events_invoice_id_fkey"; columns: ["invoice_id"]; referencedRelation: "pro_crm_invoices"; referencedColumns: ["id"] }
        ];
      };
      pro_crm_recurring_invoices: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          business_id: string | null;
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
          next_run_date: string;
          end_date: string | null;
          is_active: boolean;
          amount_cents: number;
          line_items: Json | null;
          payment_terms: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          customer_id: string;
          business_id?: string | null;
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
          next_run_date: string;
          end_date?: string | null;
          is_active?: boolean;
          amount_cents?: number;
          line_items?: Json | null;
          payment_terms?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          business_id?: string | null;
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
          next_run_date?: string;
          end_date?: string | null;
          is_active?: boolean;
          amount_cents?: number;
          line_items?: Json | null;
          payment_terms?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_crm_recurring_invoices_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "pro_crm_customers"; referencedColumns: ["id"] }
        ];
      };
      pro_invoice_view_tokens: {
        Row: {
          id: string;
          invoice_id: string;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_invoice_view_tokens_invoice_id_fkey"; columns: ["invoice_id"]; referencedRelation: "pro_crm_invoices"; referencedColumns: ["id"] }
        ];
      };
      pro_estimate_view_tokens: {
        Row: {
          id: string;
          estimate_id: string;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          estimate_id: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          estimate_id?: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "pro_estimate_view_tokens_estimate_id_fkey"; columns: ["estimate_id"]; referencedRelation: "pro_crm_estimates"; referencedColumns: ["id"] }
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
          event_type: 'signup' | 'deletion' | 'estimate' | 'estimate_accepted' | 'booking' | 'incoming_email';
          entity_type: 'customer' | 'contractor' | 'realtor' | 'installer' | 'business' | 'estimate' | 'booking' | 'email';
          entity_id: string;
          display_name: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: 'signup' | 'deletion' | 'estimate' | 'estimate_accepted' | 'booking' | 'incoming_email';
          entity_type: 'customer' | 'contractor' | 'realtor' | 'installer' | 'business' | 'estimate' | 'booking' | 'email';
          entity_id: string;
          display_name: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: 'signup' | 'deletion' | 'estimate' | 'estimate_accepted' | 'booking' | 'incoming_email';
          entity_type?: 'customer' | 'contractor' | 'realtor' | 'installer' | 'business' | 'estimate' | 'booking' | 'email';
          entity_id?: string;
          display_name?: string;
          detail?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_drive_folders: {
        Row: {
          id: string;
          owner_type: 'user' | 'business';
          owner_id: string;
          parent_id: string | null;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: 'user' | 'business';
          owner_id: string;
          parent_id?: string | null;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: 'user' | 'business';
          owner_id?: string;
          parent_id?: string | null;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_drive_files: {
        Row: {
          id: string;
          owner_type: 'user' | 'business';
          owner_id: string;
          folder_id: string | null;
          name: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_type: 'user' | 'business';
          owner_id: string;
          folder_id?: string | null;
          name: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_type?: 'user' | 'business';
          owner_id?: string;
          folder_id?: string | null;
          name?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hub_subscriptions: {
        Row: {
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: 'free' | 'pro';
          status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: 'free' | 'pro';
          status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: 'free' | 'pro';
          status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_drive_billing: {
        Row: {
          user_id: string;
          overage_enabled: boolean;
          overage_stripe_subscription_id: string | null;
          overage_stripe_item_id: string | null;
          warned_at_80: string | null;
          warned_at_100: string | null;
          last_usage_reported_gb: number;
          last_usage_reported_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          overage_enabled?: boolean;
          overage_stripe_subscription_id?: string | null;
          overage_stripe_item_id?: string | null;
          warned_at_80?: string | null;
          warned_at_100?: string | null;
          last_usage_reported_gb?: number;
          last_usage_reported_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          overage_enabled?: boolean;
          overage_stripe_subscription_id?: string | null;
          overage_stripe_item_id?: string | null;
          warned_at_80?: string | null;
          warned_at_100?: string | null;
          last_usage_reported_gb?: number;
          last_usage_reported_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_jobsite_photos: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          drive_file_id: string;
          caption: string | null;
          taken_at: string;
          latitude: number | null;
          longitude: number | null;
          accuracy_m: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id: string;
          drive_file_id: string;
          caption?: string | null;
          taken_at?: string;
          latitude?: number | null;
          longitude?: number | null;
          accuracy_m?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          owner_id?: string;
          drive_file_id?: string;
          caption?: string | null;
          taken_at?: string;
          latitude?: number | null;
          longitude?: number | null;
          accuracy_m?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          brand: string;
          product_type: string;
          description: string;
          image_url: string | null;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          brand?: string;
          product_type?: string;
          description?: string;
          image_url?: string | null;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          brand?: string;
          product_type?: string;
          description?: string;
          image_url?: string | null;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_booking_services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string;
          category: string;
          price_cents: number;
          price_max_cents: number | null;
          price_type: 'fixed' | 'starting_at' | 'range';
          unit: 'job' | 'hour' | 'sqft' | 'each';
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string;
          category?: string;
          price_cents?: number;
          price_max_cents?: number | null;
          price_type?: 'fixed' | 'starting_at' | 'range';
          unit?: 'job' | 'hour' | 'sqft' | 'each';
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string;
          category?: string;
          price_cents?: number;
          price_max_cents?: number | null;
          price_type?: 'fixed' | 'starting_at' | 'range';
          unit?: 'job' | 'hour' | 'sqft' | 'each';
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_estimate_bookings: {
        Row: {
          id: string;
          business_id: string;
          customer_user_id: string | null;
          guest_email: string | null;
          guest_first_name: string | null;
          guest_last_name: string | null;
          guest_phone: string | null;
          service_id: string | null;
          service_name: string | null;
          slot_start_at: string;
          slot_end_at: string;
          status: 'confirmed' | 'cancelled' | 'completed';
          day_of_reminder_sent_at: string | null;
          manage_token: string;
          customer_locale: string;
          visit_street: string | null;
          visit_city: string | null;
          visit_state: string | null;
          visit_zip: string | null;
          visit_note: string | null;
          ics_sequence: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_user_id?: string | null;
          guest_email?: string | null;
          guest_first_name?: string | null;
          guest_last_name?: string | null;
          guest_phone?: string | null;
          service_id?: string | null;
          service_name?: string | null;
          slot_start_at: string;
          slot_end_at: string;
          status?: 'confirmed' | 'cancelled' | 'completed';
          day_of_reminder_sent_at?: string | null;
          manage_token?: string;
          customer_locale?: string;
          visit_street?: string | null;
          visit_city?: string | null;
          visit_state?: string | null;
          visit_zip?: string | null;
          visit_note?: string | null;
          ics_sequence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_user_id?: string | null;
          guest_email?: string | null;
          guest_first_name?: string | null;
          guest_last_name?: string | null;
          guest_phone?: string | null;
          service_id?: string | null;
          service_name?: string | null;
          slot_start_at?: string;
          slot_end_at?: string;
          status?: 'confirmed' | 'cancelled' | 'completed';
          day_of_reminder_sent_at?: string | null;
          manage_token?: string;
          customer_locale?: string;
          visit_street?: string | null;
          visit_city?: string | null;
          visit_state?: string | null;
          visit_zip?: string | null;
          visit_note?: string | null;
          ics_sequence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_invoice_display_names: {
        Row: {
          id: string;
          owner_id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_crm_invoice_attachments: {
        Row: {
          id: string;
          invoice_id: string;
          owner_id: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          content_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          owner_id: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          content_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          owner_id?: string;
          file_name?: string;
          file_path?: string;
          file_size_bytes?: number;
          content_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_crm_items: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          item_type: 'service' | 'product';
          sku: string | null;
          category: string | null;
          image_url: string | null;
          description: string | null;
          price_cents: number;
          unit: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          item_type?: 'service' | 'product';
          sku?: string | null;
          category?: string | null;
          image_url?: string | null;
          description?: string | null;
          price_cents?: number;
          unit?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          item_type?: 'service' | 'product';
          sku?: string | null;
          category?: string | null;
          image_url?: string | null;
          description?: string | null;
          price_cents?: number;
          unit?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_crm_services: {
        Row: {
          id: string;
          owner_id: string;
          display_id: string;
          name: string;
          category: string | null;
          description: string | null;
          unit: string;
          price_type: string;
          price_mode: 'flat' | 'unit' | 'range';
          price_cents: number;
          price_min_cents: number | null;
          price_max_cents: number | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_id?: string;
          name: string;
          category?: string | null;
          description?: string | null;
          unit?: string;
          price_type?: string;
          price_mode?: 'flat' | 'unit' | 'range';
          price_cents?: number;
          price_min_cents?: number | null;
          price_max_cents?: number | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_id?: string;
          name?: string;
          category?: string | null;
          description?: string | null;
          unit?: string;
          price_type?: string;
          price_mode?: 'flat' | 'unit' | 'range';
          price_cents?: number;
          price_min_cents?: number | null;
          price_max_cents?: number | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_crm_service_images: {
        Row: {
          id: string;
          service_id: string;
          owner_id: string;
          image_url: string;
          storage_path: string | null;
          sort_order: number;
          is_thumbnail: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          owner_id: string;
          image_url: string;
          storage_path?: string | null;
          sort_order?: number;
          is_thumbnail?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          owner_id?: string;
          image_url?: string;
          storage_path?: string | null;
          sort_order?: number;
          is_thumbnail?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_crm_products: {
        Row: {
          id: string;
          owner_id: string;
          display_id: string;
          name: string;
          brand: string;
          sku: string | null;
          upc: string | null;
          category: string | null;
          description: string | null;
          unit: string;
          price_cents: number;
          status: 'active' | 'draft';
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_id?: string;
          name: string;
          brand?: string;
          sku?: string | null;
          upc?: string | null;
          category?: string | null;
          description?: string | null;
          unit?: string;
          price_cents?: number;
          status?: 'active' | 'draft';
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_id?: string;
          name?: string;
          brand?: string;
          sku?: string | null;
          upc?: string | null;
          category?: string | null;
          description?: string | null;
          unit?: string;
          price_cents?: number;
          status?: 'active' | 'draft';
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pro_crm_product_images: {
        Row: {
          id: string;
          product_id: string;
          owner_id: string;
          image_url: string;
          storage_path: string | null;
          sort_order: number;
          is_thumbnail: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          owner_id: string;
          image_url: string;
          storage_path?: string | null;
          sort_order?: number;
          is_thumbnail?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          owner_id?: string;
          image_url?: string;
          storage_path?: string | null;
          sort_order?: number;
          is_thumbnail?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_crm_product_specs: {
        Row: {
          id: string;
          product_id: string;
          owner_id: string;
          name: string;
          value: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          owner_id: string;
          name: string;
          value: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          owner_id?: string;
          name?: string;
          value?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      pro_crm_catalog_terms: {
        Row: {
          id: string;
          owner_id: string;
          kind: 'service_category' | 'product_category' | 'unit' | 'price_type' | 'spec_name';
          label: string;
          label_key: string;
          price_mode: 'flat' | 'unit' | 'range' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          kind: 'service_category' | 'product_category' | 'unit' | 'price_type' | 'spec_name';
          label: string;
          price_mode?: 'flat' | 'unit' | 'range' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          kind?: 'service_category' | 'product_category' | 'unit' | 'price_type' | 'spec_name';
          label?: string;
          price_mode?: 'flat' | 'unit' | 'range' | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pro_crm_tasks: {
        Row: {
          id: string;
          owner_id: string;
          display_id: string;
          task_type: 'estimate_appointment' | 'business_meeting' | 'follow_up' | 'other';
          other_label: string | null;
          customer_id: string | null;
          meeting_with: string | null;
          start_at: string;
          end_at: string;
          note: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_id?: string;
          task_type: 'estimate_appointment' | 'business_meeting' | 'follow_up' | 'other';
          other_label?: string | null;
          customer_id?: string | null;
          meeting_with?: string | null;
          start_at: string;
          end_at: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_id?: string;
          task_type?: 'estimate_appointment' | 'business_meeting' | 'follow_up' | 'other';
          other_label?: string | null;
          customer_id?: string | null;
          meeting_with?: string | null;
          start_at?: string;
          end_at?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          brand_id: number;
          brand_name: string;
        };
        Insert: {
          brand_id?: number;
          brand_name: string;
        };
        Update: {
          brand_id?: number;
          brand_name?: string;
        };
        Relationships: [];
      };
      colors: {
        Row: {
          color_id: number;
          color_name: string;
        };
        Insert: {
          color_id?: number;
          color_name: string;
        };
        Update: {
          color_id?: number;
          color_name?: string;
        };
        Relationships: [];
      };
      thicknesses: {
        Row: {
          thickness_id: number;
          thickness_mm: string;
          thickness_in: string;
        };
        Insert: {
          thickness_id?: number;
          thickness_mm: string;
          thickness_in: string;
        };
        Update: {
          thickness_id?: number;
          thickness_mm?: string;
          thickness_in?: string;
        };
        Relationships: [];
      };
      base_products: {
        Row: {
          base_product_id: number;
          brand_id: number | null;
          product_name: string;
          product_type: string;
          product_note: string;
          image_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          base_product_id?: number;
          brand_id?: number | null;
          product_name: string;
          product_type?: string;
          product_note?: string;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          base_product_id?: number;
          brand_id?: number | null;
          product_name?: string;
          product_type?: string;
          product_note?: string;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          variant_id: number;
          base_product_id: number;
          color_id: number | null;
          thickness_id: number | null;
          product_name: string;
          size: string;
          sqft_pallet: number;
          sqft_layer: number;
          lnft_pallet: number;
          layer_pallet: number;
          pcs_pallet: number;
        };
        Insert: {
          variant_id?: number;
          base_product_id: number;
          color_id?: number | null;
          thickness_id?: number | null;
          product_name?: string;
          size?: string;
          sqft_pallet?: number;
          sqft_layer?: number;
          lnft_pallet?: number;
          layer_pallet?: number;
          pcs_pallet?: number;
        };
        Update: {
          variant_id?: number;
          base_product_id?: number;
          color_id?: number | null;
          thickness_id?: number | null;
          product_name?: string;
          size?: string;
          sqft_pallet?: number;
          sqft_layer?: number;
          lnft_pallet?: number;
          layer_pallet?: number;
          pcs_pallet?: number;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          image_id: number;
          variant_id: number;
          image_path: string;
        };
        Insert: {
          image_id?: number;
          variant_id: number;
          image_path: string;
        };
        Update: {
          image_id?: number;
          variant_id?: number;
          image_path?: string;
        };
        Relationships: [];
      };
      product_specs: {
        Row: {
          spec_id: number;
          base_product_id: number;
          spec_name: string;
          spec_value: string;
          sort_order: number;
        };
        Insert: {
          spec_id?: number;
          base_product_id: number;
          spec_name: string;
          spec_value: string;
          sort_order?: number;
        };
        Update: {
          spec_id?: number;
          base_product_id?: number;
          spec_name?: string;
          spec_value?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      qr_codes: {
        Row: {
          id: string;
          code: string;
          owner_id: string | null;
          kind: 'site' | 'card' | 'extra';
          label: string;
          destination: string;
          scan_count: number;
          last_scanned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          owner_id?: string | null;
          kind: 'site' | 'card' | 'extra';
          label: string;
          destination: string;
          scan_count?: number;
          last_scanned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          owner_id?: string | null;
          kind?: 'site' | 'card' | 'extra';
          label?: string;
          destination?: string;
          scan_count?: number;
          last_scanned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      qr_scans: {
        Row: {
          id: string;
          qr_code_id: string;
          scanned_at: string;
          device: 'phone' | 'tablet' | 'computer';
          visitor_hash: string;
        };
        Insert: {
          id?: string;
          qr_code_id: string;
          scanned_at?: string;
          device: 'phone' | 'tablet' | 'computer';
          visitor_hash: string;
        };
        Update: {
          id?: string;
          qr_code_id?: string;
          scanned_at?: string;
          device?: 'phone' | 'tablet' | 'computer';
          visitor_hash?: string;
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
      list_directory_business_ids: {
        Args: {
          search: string | null;
          license_types: string[] | null;
          category_name: string | null;
          lim: number;
          off: number;
        };
        Returns: { id: string | null; total_count: number }[];
      };
      record_qr_scan: {
        Args: {
          p_code: string;
          p_device: string;
          p_visitor: string;
        };
        Returns: string;
      };
      consume_rate_limit: {
        Args: {
          p_key: string;
          p_window_ms: number;
          p_max: number;
        };
        Returns: { allowed: boolean; retry_after_seconds: number };
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

export type InvitationCode = Database['public']['Tables']['invitation_codes']['Row'];
export type InvitationCodeInsert = Database['public']['Tables']['invitation_codes']['Insert'];
export type InvitationCodeUpdate = Database['public']['Tables']['invitation_codes']['Update'];

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

export type ProInvoiceSettings = Database['public']['Tables']['pro_invoice_settings']['Row'];
export type ProInvoiceSettingsInsert = Database['public']['Tables']['pro_invoice_settings']['Insert'];
export type ProInvoiceSettingsUpdate = Database['public']['Tables']['pro_invoice_settings']['Update'];

export type ProCrmInvoice = Database['public']['Tables']['pro_crm_invoices']['Row'];
export type ProCrmInvoiceInsert = Database['public']['Tables']['pro_crm_invoices']['Insert'];
export type ProCrmInvoiceUpdate = Database['public']['Tables']['pro_crm_invoices']['Update'];
