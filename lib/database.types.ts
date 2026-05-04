export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          organization_id: string
          scope: Database["public"]["Enums"]["ai_conversation_scope"]
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id: string
          scope: Database["public"]["Enums"]["ai_conversation_scope"]
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string
          scope?: Database["public"]["Enums"]["ai_conversation_scope"]
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["ai_message_role"]
          token_count: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["ai_message_role"]
          token_count?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["ai_message_role"]
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          call_count: number
          day: string
          feature: string
          organization_id: string
        }
        Insert: {
          call_count?: number
          day?: string
          feature: string
          organization_id: string
        }
        Update: {
          call_count?: number
          day?: string
          feature?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          conversation_id: string | null
          cost_usd_micro: number
          created_at: string
          feature: Database["public"]["Enums"]["ai_feature"]
          id: string
          input_tokens: number
          model: string
          organization_id: string
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          cost_usd_micro?: number
          created_at?: string
          feature: Database["public"]["Enums"]["ai_feature"]
          id?: string
          input_tokens?: number
          model: string
          organization_id: string
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          cost_usd_micro?: number
          created_at?: string
          feature?: Database["public"]["Enums"]["ai_feature"]
          id?: string
          input_tokens?: number
          model?: string
          organization_id?: string
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          id: number
          organization_id: string | null
          row_id: string
          summary: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: number
          organization_id?: string | null
          row_id: string
          summary?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: number
          organization_id?: string | null
          row_id?: string
          summary?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          archived_at: string | null
          country: string | null
          created_at: string
          description: string | null
          flag: string | null
          founder_email: string | null
          founder_emails: string[]
          founder_name: string | null
          founder_role: string | null
          id: string
          invested_usd: number
          investment_instrument:
            | Database["public"]["Enums"]["investment_instrument"]
            | null
          last_update_at: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          organization_id: string
          ownership_pct: number
          safe_cap_usd: number | null
          safe_discount_pct: number | null
          sector: string | null
          slug: string
          stage: Database["public"]["Enums"]["company_stage"]
          status: Database["public"]["Enums"]["company_status"]
          tracking_cadence: Database["public"]["Enums"]["tracking_cadence"]
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          flag?: string | null
          founder_email?: string | null
          founder_emails?: string[]
          founder_name?: string | null
          founder_role?: string | null
          id?: string
          invested_usd?: number
          investment_instrument?:
            | Database["public"]["Enums"]["investment_instrument"]
            | null
          last_update_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          organization_id: string
          ownership_pct?: number
          safe_cap_usd?: number | null
          safe_discount_pct?: number | null
          sector?: string | null
          slug: string
          stage: Database["public"]["Enums"]["company_stage"]
          status?: Database["public"]["Enums"]["company_status"]
          tracking_cadence?: Database["public"]["Enums"]["tracking_cadence"]
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          flag?: string | null
          founder_email?: string | null
          founder_emails?: string[]
          founder_name?: string | null
          founder_role?: string | null
          id?: string
          invested_usd?: number
          investment_instrument?:
            | Database["public"]["Enums"]["investment_instrument"]
            | null
          last_update_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          organization_id?: string
          ownership_pct?: number
          safe_cap_usd?: number | null
          safe_discount_pct?: number | null
          sector?: string | null
          slug?: string
          stage?: Database["public"]["Enums"]["company_stage"]
          status?: Database["public"]["Enums"]["company_status"]
          tracking_cadence?: Database["public"]["Enums"]["tracking_cadence"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_active_form: {
        Row: {
          assigned_at: string
          company_id: string
          due_at: string | null
          form_id: string
          id: string
          is_extra: boolean
          period_label: string | null
          status: Database["public"]["Enums"]["active_form_status"]
          submitted_at: string | null
        }
        Insert: {
          assigned_at?: string
          company_id: string
          due_at?: string | null
          form_id: string
          id?: string
          is_extra?: boolean
          period_label?: string | null
          status?: Database["public"]["Enums"]["active_form_status"]
          submitted_at?: string | null
        }
        Update: {
          assigned_at?: string
          company_id?: string
          due_at?: string | null
          form_id?: string
          id?: string
          is_extra?: boolean
          period_label?: string | null
          status?: Database["public"]["Enums"]["active_form_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_active_form_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_active_form_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_recipient_summary"
            referencedColumns: ["form_id"]
          },
          {
            foreignKeyName: "company_active_form_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      company_comments: {
        Row: {
          author_user_id: string
          body: string
          company_id: string
          created_at: string
          hidden: boolean
          id: string
        }
        Insert: {
          author_user_id: string
          body: string
          company_id: string
          created_at?: string
          hidden?: boolean
          id?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          company_id?: string
          created_at?: string
          hidden?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_fill_tokens: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          token: string
          use_count: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token: string
          use_count?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_fill_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_fill_tokens_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reactions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["reaction_kind"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_reactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_updates: {
        Row: {
          author_user_id: string | null
          body: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_updates_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_updates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_metric_values: {
        Row: {
          company_id: string
          created_at: string
          id: string
          metric_definition_id: string
          period_kind: Database["public"]["Enums"]["period_kind"]
          period_month: number | null
          period_year: number | null
          quarter: string
          updated_at: string
          value: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          metric_definition_id: string
          period_kind?: Database["public"]["Enums"]["period_kind"]
          period_month?: number | null
          period_year?: number | null
          quarter: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          metric_definition_id?: string
          period_kind?: Database["public"]["Enums"]["period_kind"]
          period_month?: number | null
          period_year?: number | null
          quarter?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_metric_values_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_metric_values_metric_definition_id_fkey"
            columns: ["metric_definition_id"]
            isOneToOne: false
            referencedRelation: "metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          flag_name: string
          id: string
          notes: string | null
          organization_id: string
          rollout_pct: number
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          flag_name: string
          id?: string
          notes?: string | null
          organization_id: string
          rollout_pct?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          rollout_pct?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      form_recipients: {
        Row: {
          company_id: string
          created_at: string
          form_id: string
          founder_email_override: string | null
          founder_emails: string[]
        }
        Insert: {
          company_id: string
          created_at?: string
          form_id: string
          founder_email_override?: string | null
          founder_emails?: string[]
        }
        Update: {
          company_id?: string
          created_at?: string
          form_id?: string
          founder_email_override?: string | null
          founder_emails?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "form_recipients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_recipients_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_recipient_summary"
            referencedColumns: ["form_id"]
          },
          {
            foreignKeyName: "form_recipients_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_reminders: {
        Row: {
          body: string | null
          created_at: string
          form_id: string
          id: string
          offset_days: number
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          form_id: string
          id?: string
          offset_days: number
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          form_id?: string
          id?: string
          offset_days?: number
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_reminders_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_recipient_summary"
            referencedColumns: ["form_id"]
          },
          {
            foreignKeyName: "form_reminders_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_schedules: {
        Row: {
          active: boolean
          anchor_month: number | null
          cadence: Database["public"]["Enums"]["form_schedule_cadence"]
          created_at: string
          email_body: string | null
          email_subject: string | null
          form_id: string
          id: string
          last_sent_at: string | null
          next_send_at: string | null
          reminder_offsets_days: number[]
          send_day_of_month: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          anchor_month?: number | null
          cadence?: Database["public"]["Enums"]["form_schedule_cadence"]
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          form_id: string
          id?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          reminder_offsets_days?: number[]
          send_day_of_month?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          anchor_month?: number | null
          cadence?: Database["public"]["Enums"]["form_schedule_cadence"]
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          form_id?: string
          id?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          reminder_offsets_days?: number[]
          send_day_of_month?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_schedules_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "form_recipient_summary"
            referencedColumns: ["form_id"]
          },
          {
            foreignKeyName: "form_schedules_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          ai_extracted: boolean
          ai_flags_json: Json | null
          company_id: string
          data_json: Json
          form_id: string
          id: string
          submitted_at: string
          submitted_by_email: string | null
        }
        Insert: {
          ai_extracted?: boolean
          ai_flags_json?: Json | null
          company_id: string
          data_json?: Json
          form_id: string
          id?: string
          submitted_at?: string
          submitted_by_email?: string | null
        }
        Update: {
          ai_extracted?: boolean
          ai_flags_json?: Json | null
          company_id?: string
          data_json?: Json
          form_id?: string
          id?: string
          submitted_at?: string
          submitted_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_recipient_summary"
            referencedColumns: ["form_id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean
          cadence: Database["public"]["Enums"]["form_cadence"]
          created_at: string
          fields_json: Json
          id: string
          last_sent_at: string | null
          name: string
          organization_id: string
          response_rate: number
          sent_to_count: number
          slug: string
        }
        Insert: {
          active?: boolean
          cadence: Database["public"]["Enums"]["form_cadence"]
          created_at?: string
          fields_json?: Json
          id?: string
          last_sent_at?: string | null
          name: string
          organization_id: string
          response_rate?: number
          sent_to_count?: number
          slug: string
        }
        Update: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["form_cadence"]
          created_at?: string
          fields_json?: Json
          id?: string
          last_sent_at?: string | null
          name?: string
          organization_id?: string
          response_rate?: number
          sent_to_count?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_messages: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          lp_id: string
          organization_id: string
          read_by_other_at: string | null
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          lp_id: string
          organization_id: string
          read_by_other_at?: string | null
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          lp_id?: string
          organization_id?: string
          read_by_other_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lp_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_messages_lp_id_fkey"
            columns: ["lp_id"]
            isOneToOne: false
            referencedRelation: "lps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lps: {
        Row: {
          commitment_usd: number
          country: string | null
          created_at: string
          email: string | null
          id: string
          last_access_at: string | null
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["lp_type"]
        }
        Insert: {
          commitment_usd: number
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_access_at?: string | null
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["lp_type"]
        }
        Update: {
          commitment_usd?: number
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_access_at?: string | null
          name?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["lp_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_definition_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          metric_definition_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          metric_definition_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          metric_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_definition_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_definition_companies_metric_definition_id_fkey"
            columns: ["metric_definition_id"]
            isOneToOne: false
            referencedRelation: "metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_definitions: {
        Row: {
          created_at: string
          id: string
          label: string
          organization_id: string
          type: Database["public"]["Enums"]["custom_metric_type"]
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          organization_id: string
          type?: Database["public"]["Enums"]["custom_metric_type"]
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["custom_metric_type"]
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_notes: {
        Row: {
          author_user_id: string | null
          company_id: string
          created_at: string
          id: string
          metric_key: string
          note: string
          period_kind: Database["public"]["Enums"]["period_kind"]
          period_month: number | null
          period_year: number | null
          quarter: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          metric_key: string
          note: string
          period_kind?: Database["public"]["Enums"]["period_kind"]
          period_month?: number | null
          period_year?: number | null
          quarter: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metric_key?: string
          note?: string
          period_kind?: Database["public"]["Enums"]["period_kind"]
          period_month?: number | null
          period_year?: number | null
          quarter?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          arr_usd: number | null
          burn_usd: number | null
          cash_usd: number | null
          company_id: string
          created_at: string
          headcount: number | null
          id: string
          period_kind: Database["public"]["Enums"]["period_kind"]
          period_month: number | null
          period_year: number | null
          quarter: string
          revenue_usd: number | null
        }
        Insert: {
          arr_usd?: number | null
          burn_usd?: number | null
          cash_usd?: number | null
          company_id: string
          created_at?: string
          headcount?: number | null
          id?: string
          period_kind?: Database["public"]["Enums"]["period_kind"]
          period_month?: number | null
          period_year?: number | null
          quarter: string
          revenue_usd?: number | null
        }
        Update: {
          arr_usd?: number | null
          burn_usd?: number | null
          cash_usd?: number | null
          company_id?: string
          created_at?: string
          headcount?: number | null
          id?: string
          period_kind?: Database["public"]["Enums"]["period_kind"]
          period_month?: number | null
          period_year?: number | null
          quarter?: string
          revenue_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          cadence: Database["public"]["Enums"]["newsletter_cadence"]
          cover_subtitle: string | null
          cover_title: string
          created_at: string
          created_by_user_id: string | null
          hero_metric_summary: string | null
          id: string
          organization_id: string
          period_label: string
          published_at: string | null
          published_by_user_id: string | null
          sections_json: Json
          status: Database["public"]["Enums"]["newsletter_status"]
          updated_at: string
        }
        Insert: {
          cadence?: Database["public"]["Enums"]["newsletter_cadence"]
          cover_subtitle?: string | null
          cover_title: string
          created_at?: string
          created_by_user_id?: string | null
          hero_metric_summary?: string | null
          id?: string
          organization_id: string
          period_label: string
          published_at?: string | null
          published_by_user_id?: string | null
          sections_json?: Json
          status?: Database["public"]["Enums"]["newsletter_status"]
          updated_at?: string
        }
        Update: {
          cadence?: Database["public"]["Enums"]["newsletter_cadence"]
          cover_subtitle?: string | null
          cover_title?: string
          created_at?: string
          created_by_user_id?: string | null
          hero_metric_summary?: string | null
          id?: string
          organization_id?: string
          period_label?: string
          published_at?: string | null
          published_by_user_id?: string | null
          sections_json?: Json
          status?: Database["public"]["Enums"]["newsletter_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletters_published_by_user_id_fkey"
            columns: ["published_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata_json: Json | null
          organization_id: string
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          metadata_json?: Json | null
          organization_id: string
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata_json?: Json | null
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          currency: string
          dashboard_config_json: Json | null
          data_columns_json: Json | null
          deployed_usd: number | null
          description: string | null
          founded_year: number | null
          id: string
          linkedin_url: string | null
          logo_url: string | null
          name: string
          size_usd: number | null
          slug: string
          theme_json: Json | null
          thesis: string | null
          updated_at: string
          vintage: number | null
          website: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          dashboard_config_json?: Json | null
          data_columns_json?: Json | null
          deployed_usd?: number | null
          description?: string | null
          founded_year?: number | null
          id?: string
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          size_usd?: number | null
          slug: string
          theme_json?: Json | null
          thesis?: string | null
          updated_at?: string
          vintage?: number | null
          website?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          dashboard_config_json?: Json | null
          data_columns_json?: Json | null
          deployed_usd?: number | null
          description?: string | null
          founded_year?: number | null
          id?: string
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          size_usd?: number | null
          slug?: string
          theme_json?: Json | null
          thesis?: string | null
          updated_at?: string
          vintage?: number | null
          website?: string | null
        }
        Relationships: []
      }
      share_links: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          lp_id: string | null
          organization_id: string
          token: string
          view_count: number
          watermark_email: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          lp_id?: string | null
          organization_id: string
          token: string
          view_count?: number
          watermark_email?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          lp_id?: string | null
          organization_id?: string
          token?: string
          view_count?: number
          watermark_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_links_lp_id_fkey"
            columns: ["lp_id"]
            isOneToOne: false
            referencedRelation: "lps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_columns: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          position: number
          sheet_id: string
          type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          position?: number
          sheet_id: string
          type: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          position?: number
          sheet_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_columns_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_rows: {
        Row: {
          created_at: string
          data: Json
          id: string
          position: number
          sheet_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          position?: number
          sheet_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          position?: number
          sheet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_rows_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["usage_event_kind"]
          metadata: Json | null
          organization_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["usage_event_kind"]
          metadata?: Json | null
          organization_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["usage_event_kind"]
          metadata?: Json | null
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access: {
        Row: {
          company_id: string
          granted_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          granted_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          revoked_at: string | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          revoked_at?: string | null
          role?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          is_admin: boolean
          name: string | null
          organization_id: string | null
          role: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean
          name?: string | null
          organization_id?: string | null
          role?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          name?: string | null
          organization_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      form_recipient_summary: {
        Row: {
          company_ids: string[] | null
          form_id: string | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ai_usage_summary: { Args: { p_days?: number }; Returns: Json }
      audit_actor: {
        Args: never
        Returns: {
          email: string
          organization_id: string
          user_id: string
        }[]
      }
      bump_ai_usage: {
        Args: { p_feature: string; p_org: string }
        Returns: number
      }
      can_access_company: { Args: { p_company_id: string }; Returns: boolean }
      compute_ai_cost_micro: {
        Args: {
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
        }
        Returns: number
      }
      create_organization_for_caller: {
        Args: {
          p_currency?: string
          p_description?: string
          p_name: string
          p_size_usd?: number
          p_slug: string
          p_thesis?: string
          p_vintage?: number
          p_website?: string
        }
        Returns: string
      }
      generate_company_fill_token: {
        Args: { p_company_id: string; p_label?: string }
        Returns: string
      }
      get_lp_letters: { Args: never; Returns: Json }
      get_org_members: { Args: never; Returns: Json }
      get_public_form: {
        Args: { p_company_slug: string; p_form_slug: string }
        Returns: Json
      }
      get_share_letter: { Args: { p_token: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      resolve_fill_token: {
        Args: { p_token: string }
        Returns: {
          company_id: string
          company_slug: string
          organization_id: string
        }[]
      }
      run_metric_alerts: { Args: never; Returns: Json }
      submit_public_form:
        | {
            Args: {
              p_ai_extracted?: boolean
              p_company_slug: string
              p_data: Json
              p_form_slug: string
            }
            Returns: string
          }
        | {
            Args: {
              p_ai_extracted?: boolean
              p_company_slug: string
              p_data: Json
              p_fill_token?: string
              p_form_slug: string
            }
            Returns: string
          }
      user_org_id: { Args: never; Returns: string }
      value_summary: { Args: { p_days?: number }; Returns: Json }
    }
    Enums: {
      active_form_status: "pending" | "submitted" | "overdue"
      ai_conversation_scope: "gp" | "lp"
      ai_feature:
        | "chat"
        | "form_helper"
        | "metric_alerts"
        | "lp_summary"
        | "auto_title"
      ai_message_role: "user" | "assistant"
      company_stage: "Pre-seed" | "Seed" | "Series A" | "Series B"
      company_status: "healthy" | "watch" | "critical" | "no_data"
      custom_metric_type: "currency" | "number" | "percent" | "ratio" | "count"
      form_cadence: "monthly" | "quarterly" | "annual" | "ad_hoc"
      form_field_type:
        | "currency"
        | "number"
        | "percent"
        | "text"
        | "longtext"
        | "select"
        | "date"
      form_schedule_cadence: "monthly" | "quarterly" | "annual" | "ad_hoc"
      investment_instrument:
        | "safe"
        | "convertible_note"
        | "equity"
        | "saft"
        | "warrant"
        | "loan"
        | "other"
      lp_type:
        | "Family Office"
        | "Institutional"
        | "Fund of Funds"
        | "Individual"
      newsletter_cadence: "monthly" | "quarterly" | "annual" | "ad_hoc"
      newsletter_status: "draft" | "published"
      period_kind: "month" | "quarter" | "annual"
      reaction_kind: "clap" | "rocket" | "concerned" | "thinking"
      tracking_cadence: "monthly" | "quarterly" | "annual"
      usage_event_kind:
        | "report_generated"
        | "alert_created"
        | "form_sent"
        | "form_received"
        | "chat_query"
        | "metrics_imported"
        | "lp_letter_published"
        | "company_update_posted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      active_form_status: ["pending", "submitted", "overdue"],
      ai_conversation_scope: ["gp", "lp"],
      ai_feature: [
        "chat",
        "form_helper",
        "metric_alerts",
        "lp_summary",
        "auto_title",
      ],
      ai_message_role: ["user", "assistant"],
      company_stage: ["Pre-seed", "Seed", "Series A", "Series B"],
      company_status: ["healthy", "watch", "critical", "no_data"],
      custom_metric_type: ["currency", "number", "percent", "ratio", "count"],
      form_cadence: ["monthly", "quarterly", "annual", "ad_hoc"],
      form_field_type: [
        "currency",
        "number",
        "percent",
        "text",
        "longtext",
        "select",
        "date",
      ],
      form_schedule_cadence: ["monthly", "quarterly", "annual", "ad_hoc"],
      investment_instrument: [
        "safe",
        "convertible_note",
        "equity",
        "saft",
        "warrant",
        "loan",
        "other",
      ],
      lp_type: [
        "Family Office",
        "Institutional",
        "Fund of Funds",
        "Individual",
      ],
      newsletter_cadence: ["monthly", "quarterly", "annual", "ad_hoc"],
      newsletter_status: ["draft", "published"],
      period_kind: ["month", "quarter", "annual"],
      reaction_kind: ["clap", "rocket", "concerned", "thinking"],
      tracking_cadence: ["monthly", "quarterly", "annual"],
      usage_event_kind: [
        "report_generated",
        "alert_created",
        "form_sent",
        "form_received",
        "chat_query",
        "metrics_imported",
        "lp_letter_published",
        "company_update_posted",
      ],
    },
  },
} as const
