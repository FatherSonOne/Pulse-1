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
      action_items: {
        Row: {
          assigned_to_email: string | null
          assigned_to_id: string | null
          assigned_to_name: string | null
          completed_at: string | null
          context: string | null
          created_at: string | null
          crm_sync_status: string | null
          crm_task_id: string | null
          due_date: string | null
          id: string
          last_sync_attempt: string | null
          last_sync_error: string | null
          meeting_id: string
          priority: string | null
          status: string | null
          task_description: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_email?: string | null
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          completed_at?: string | null
          context?: string | null
          created_at?: string | null
          crm_sync_status?: string | null
          crm_task_id?: string | null
          due_date?: string | null
          id?: string
          last_sync_attempt?: string | null
          last_sync_error?: string | null
          meeting_id: string
          priority?: string | null
          status?: string | null
          task_description: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_email?: string | null
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          completed_at?: string | null
          context?: string | null
          created_at?: string | null
          crm_sync_status?: string | null
          crm_task_id?: string | null
          due_date?: string | null
          id?: string
          last_sync_attempt?: string | null
          last_sync_error?: string | null
          meeting_id?: string
          priority?: string | null
          status?: string | null
          task_description?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_items_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_feed: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          doc_id: string | null
          id: string
          is_read: boolean | null
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          doc_id?: string | null
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          doc_id?: string | null
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action_category: string
          action_type: string
          created_at: string
          description: string
          details: Json | null
          device_info: Json | null
          error_message: string | null
          id: string
          ip_address: unknown
          location_info: Json | null
          severity: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_category: string
          action_type: string
          created_at?: string
          description: string
          details?: Json | null
          device_info?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          location_info?: Json | null
          severity?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_category?: string
          action_type?: string
          created_at?: string
          description?: string
          details?: Json | null
          device_info?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          location_info?: Json | null
          severity?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string | null
          details: string | null
          id: string
          target_id: string | null
          target_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_name?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          allow_new_registrations: boolean | null
          created_at: string | null
          email_notifications: boolean | null
          id: string
          maintenance_mode: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          allow_new_registrations?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          maintenance_mode?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          allow_new_registrations?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          maintenance_mode?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_execution_logs: {
        Row: {
          agent_id: string | null
          agent_type: string
          confidence: number | null
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          feedback_notes: string | null
          feedback_rating: number | null
          id: string
          input_context: Json | null
          output_suggestion: Json | null
          success: boolean | null
          trigger_type: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_type: string
          confidence?: number | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          feedback_notes?: string | null
          feedback_rating?: number | null
          id?: string
          input_context?: Json | null
          output_suggestion?: Json | null
          success?: boolean | null
          trigger_type?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_type?: string
          confidence?: number | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          feedback_notes?: string | null
          feedback_rating?: number | null
          id?: string
          input_context?: Json | null
          output_suggestion?: Json | null
          success?: boolean | null
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_run_steps: {
        Row: {
          agent_run_id: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json | null
          output: Json | null
          started_at: string
          status: string
          step_index: number
          step_type: string
        }
        Insert: {
          agent_run_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          started_at?: string
          status?: string
          step_index: number
          step_type: string
        }
        Update: {
          agent_run_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          started_at?: string
          status?: string
          step_index?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_steps_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string
          attempt: number
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          output: Json | null
          started_at: string
          status: string
          trigger_event_id: string
        }
        Insert: {
          agent_id: string
          attempt?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json | null
          started_at?: string
          status?: string
          trigger_event_id: string
        }
        Update: {
          agent_id?: string
          attempt?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json | null
          started_at?: string
          status?: string
          trigger_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          actions: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          guardrails: Json
          id: string
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          guardrails?: Json
          id?: string
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          guardrails?: Json
          id?: string
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          agent_type: string
          config: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          execution_count: number | null
          id: string
          last_executed_at: string | null
          name: string
          success_rate: number | null
          team_id: string | null
          triggers: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_type: string
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          execution_count?: number | null
          id?: string
          last_executed_at?: string | null
          name: string
          success_rate?: number | null
          team_id?: string | null
          triggers?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          execution_count?: number | null
          id?: string
          last_executed_at?: string | null
          name?: string
          success_rate?: number | null
          team_id?: string | null
          triggers?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_insights_cache: {
        Row: {
          confidence_score: number | null
          entity_id: string
          entity_type: string
          expires_at: string | null
          generated_at: string | null
          id: string
          insight_data: Json
          insight_type: string
        }
        Insert: {
          confidence_score?: number | null
          entity_id: string
          entity_type: string
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_data: Json
          insight_type: string
        }
        Update: {
          confidence_score?: number | null
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_data?: Json
          insight_type?: string
        }
        Relationships: []
      }
      ai_lab_outputs: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_shared: boolean | null
          metadata: Json | null
          title: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          metadata?: Json | null
          title: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          metadata?: Json | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_lab_templates: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          name: string
          prompt: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          name: string
          prompt: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          name?: string
          prompt?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_lab_workflows: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          steps: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          steps?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          steps?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          agent_id: string | null
          citations: Json | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          citations?: Json | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          citations?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_projects: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          name: string
          settings: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          settings?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          settings?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_suggestions: {
        Row: {
          context_summary: string | null
          created_at: string | null
          id: string
          is_used: boolean | null
          relevance_score: number | null
          session_id: string | null
          suggestion_text: string
        }
        Insert: {
          context_summary?: string | null
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          relevance_score?: number | null
          session_id?: string | null
          suggestion_text: string
        }
        Update: {
          context_summary?: string | null
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          relevance_score?: number | null
          session_id?: string | null
          suggestion_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_suggestions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          is_public: boolean | null
          project_id: string | null
          session_type: string | null
          settings: Json | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_public?: boolean | null
          project_id?: string | null
          session_type?: string | null
          settings?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_public?: boolean | null
          project_id?: string | null
          session_type?: string | null
          settings?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_thinking_logs: {
        Row: {
          created_at: string | null
          id: string
          message_id: string | null
          thinking_steps: Json
          total_thinking_time_ms: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          thinking_steps: Json
          total_thinking_time_ms?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          thinking_steps?: Json
          total_thinking_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_thinking_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_contact_engagement: {
        Row: {
          avg_response_time_minutes: number | null
          avg_sentiment: number | null
          common_topics: string[] | null
          communication_frequency: string | null
          contact_identifier: string
          contact_name: string | null
          created_at: string
          days_since_last_contact: number | null
          engagement_score: number | null
          engagement_trend: string | null
          first_contact_at: string | null
          id: string
          last_interaction_at: string | null
          preferred_channel: string | null
          response_rate: number | null
          sentiment_history: Json | null
          total_messages_received: number | null
          total_messages_sent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_response_time_minutes?: number | null
          avg_sentiment?: number | null
          common_topics?: string[] | null
          communication_frequency?: string | null
          contact_identifier: string
          contact_name?: string | null
          created_at?: string
          days_since_last_contact?: number | null
          engagement_score?: number | null
          engagement_trend?: string | null
          first_contact_at?: string | null
          id?: string
          last_interaction_at?: string | null
          preferred_channel?: string | null
          response_rate?: number | null
          sentiment_history?: Json | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_response_time_minutes?: number | null
          avg_sentiment?: number | null
          common_topics?: string[] | null
          communication_frequency?: string | null
          contact_identifier?: string
          contact_name?: string | null
          created_at?: string
          days_since_last_contact?: number | null
          engagement_score?: number | null
          engagement_trend?: string | null
          first_contact_at?: string | null
          id?: string
          last_interaction_at?: string | null
          preferred_channel?: string | null
          response_rate?: number | null
          sentiment_history?: Json | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_daily_metrics: {
        Row: {
          active_conversations: number | null
          avg_response_time_minutes: number | null
          avg_sentiment_score: number | null
          created_at: string
          date: string
          emails_received: number | null
          emails_sent: number | null
          fastest_response_minutes: number | null
          id: string
          messages_by_hour: Json | null
          messages_received: number | null
          messages_sent: number | null
          negative_messages: number | null
          neutral_messages: number | null
          new_contacts: number | null
          peak_hour: number | null
          positive_messages: number | null
          pulse_received: number | null
          pulse_sent: number | null
          responses_after_24h: number | null
          responses_within_1h: number | null
          responses_within_24h: number | null
          slack_received: number | null
          slack_sent: number | null
          slowest_response_minutes: number | null
          sms_received: number | null
          sms_sent: number | null
          unique_contacts_reached: number | null
          updated_at: string
          user_id: string
          voxer_received: number | null
          voxer_sent: number | null
        }
        Insert: {
          active_conversations?: number | null
          avg_response_time_minutes?: number | null
          avg_sentiment_score?: number | null
          created_at?: string
          date: string
          emails_received?: number | null
          emails_sent?: number | null
          fastest_response_minutes?: number | null
          id?: string
          messages_by_hour?: Json | null
          messages_received?: number | null
          messages_sent?: number | null
          negative_messages?: number | null
          neutral_messages?: number | null
          new_contacts?: number | null
          peak_hour?: number | null
          positive_messages?: number | null
          pulse_received?: number | null
          pulse_sent?: number | null
          responses_after_24h?: number | null
          responses_within_1h?: number | null
          responses_within_24h?: number | null
          slack_received?: number | null
          slack_sent?: number | null
          slowest_response_minutes?: number | null
          sms_received?: number | null
          sms_sent?: number | null
          unique_contacts_reached?: number | null
          updated_at?: string
          user_id: string
          voxer_received?: number | null
          voxer_sent?: number | null
        }
        Update: {
          active_conversations?: number | null
          avg_response_time_minutes?: number | null
          avg_sentiment_score?: number | null
          created_at?: string
          date?: string
          emails_received?: number | null
          emails_sent?: number | null
          fastest_response_minutes?: number | null
          id?: string
          messages_by_hour?: Json | null
          messages_received?: number | null
          messages_sent?: number | null
          negative_messages?: number | null
          neutral_messages?: number | null
          new_contacts?: number | null
          peak_hour?: number | null
          positive_messages?: number | null
          pulse_received?: number | null
          pulse_sent?: number | null
          responses_after_24h?: number | null
          responses_within_1h?: number | null
          responses_within_24h?: number | null
          slack_received?: number | null
          slack_sent?: number | null
          slowest_response_minutes?: number | null
          sms_received?: number | null
          sms_sent?: number | null
          unique_contacts_reached?: number | null
          updated_at?: string
          user_id?: string
          voxer_received?: number | null
          voxer_sent?: number | null
        }
        Relationships: []
      }
      analytics_period_summary: {
        Row: {
          active_contacts: number | null
          avg_response_time_minutes: number | null
          avg_sentiment: number | null
          channel_breakdown: Json | null
          churned_contacts: number | null
          created_at: string
          engagement_change_percent: number | null
          id: string
          insights: Json | null
          messages_change_percent: number | null
          new_contacts: number | null
          period_end: string
          period_start: string
          period_type: string
          response_rate: number | null
          response_time_change_percent: number | null
          sentiment_trend: string | null
          total_messages: number | null
          total_received: number | null
          total_sent: number | null
          user_id: string
        }
        Insert: {
          active_contacts?: number | null
          avg_response_time_minutes?: number | null
          avg_sentiment?: number | null
          channel_breakdown?: Json | null
          churned_contacts?: number | null
          created_at?: string
          engagement_change_percent?: number | null
          id?: string
          insights?: Json | null
          messages_change_percent?: number | null
          new_contacts?: number | null
          period_end: string
          period_start: string
          period_type: string
          response_rate?: number | null
          response_time_change_percent?: number | null
          sentiment_trend?: string | null
          total_messages?: number | null
          total_received?: number | null
          total_sent?: number | null
          user_id: string
        }
        Update: {
          active_contacts?: number | null
          avg_response_time_minutes?: number | null
          avg_sentiment?: number | null
          channel_breakdown?: Json | null
          churned_contacts?: number | null
          created_at?: string
          engagement_change_percent?: number | null
          id?: string
          insights?: Json | null
          messages_change_percent?: number | null
          new_contacts?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          response_rate?: number | null
          response_time_change_percent?: number | null
          sentiment_trend?: string | null
          total_messages?: number | null
          total_received?: number | null
          total_sent?: number | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_response_times: {
        Row: {
          channel: string
          contact_identifier: string
          created_at: string
          id: string
          incoming_at: string
          incoming_message_id: string | null
          is_business_hours: boolean | null
          response_at: string | null
          response_message_id: string | null
          response_time_minutes: number | null
          thread_id: string | null
          user_id: string
          was_responded: boolean | null
        }
        Insert: {
          channel: string
          contact_identifier: string
          created_at?: string
          id?: string
          incoming_at: string
          incoming_message_id?: string | null
          is_business_hours?: boolean | null
          response_at?: string | null
          response_message_id?: string | null
          response_time_minutes?: number | null
          thread_id?: string | null
          user_id: string
          was_responded?: boolean | null
        }
        Update: {
          channel?: string
          contact_identifier?: string
          created_at?: string
          id?: string
          incoming_at?: string
          incoming_message_id?: string | null
          is_business_hours?: boolean | null
          response_at?: string | null
          response_message_id?: string | null
          response_time_minutes?: number | null
          thread_id?: string | null
          user_id?: string
          was_responded?: boolean | null
        }
        Relationships: []
      }
      annotation_replies: {
        Row: {
          annotation_id: string | null
          content: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          annotation_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          annotation_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annotation_replies_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "doc_annotations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          metadata: Json | null
          name: string
          rate_limit: number
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          metadata?: Json | null
          name: string
          rate_limit?: number
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          metadata?: Json | null
          name?: string
          rate_limit?: number
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          api_key_id: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          id?: string
          request_count?: number
          window_start: string
        }
        Update: {
          api_key_id?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limits_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: unknown
          method: string
          request_body: Json | null
          response_time_ms: number | null
          status_code: number
          user_agent: string | null
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          method: string
          request_body?: Json | null
          response_time_ms?: number | null
          status_code: number
          user_agent?: string | null
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          method?: string
          request_body?: Json | null
          response_time_ms?: number | null
          status_code?: number
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_collections: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          icon: string
          id: string
          name: string
          pinned_at: string | null
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          name: string
          pinned_at?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          name?: string
          pinned_at?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: []
      }
      archive_shares: {
        Row: {
          archive_id: string
          created_at: string | null
          id: string
          permission: string
          shared_by: string
          shared_with: string
        }
        Insert: {
          archive_id: string
          created_at?: string | null
          id?: string
          permission?: string
          shared_by: string
          shared_with: string
        }
        Update: {
          archive_id?: string
          created_at?: string | null
          id?: string
          permission?: string
          shared_by?: string
          shared_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_shares_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_versions: {
        Row: {
          action: string
          archive_id: string
          content: string | null
          created_at: string
          id: string
          title: string | null
          user_name: string
        }
        Insert: {
          action?: string
          archive_id: string
          content?: string | null
          created_at?: string
          id?: string
          title?: string | null
          user_name?: string
        }
        Update: {
          action?: string
          archive_id?: string
          content?: string | null
          created_at?: string
          id?: string
          title?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_versions_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archives: {
        Row: {
          ai_summary: string | null
          ai_tags: string[] | null
          archive_type: string
          collection_id: string | null
          content: string
          created_at: string
          created_by: string | null
          date: string
          decision_status: string | null
          deleted_at: string | null
          drive_file_id: string | null
          drive_folder_id: string | null
          exported_at: string | null
          file_size: number | null
          file_url: string | null
          id: string
          last_viewed_at: string | null
          mime_type: string | null
          pinned_at: string | null
          related_contact_id: string | null
          related_item_ids: string[] | null
          search_vector: unknown
          sentiment: string | null
          shared_with: string[] | null
          source_id: string | null
          source_table: string | null
          starred: boolean | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          view_count: number | null
          visibility: string | null
        }
        Insert: {
          ai_summary?: string | null
          ai_tags?: string[] | null
          archive_type: string
          collection_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          date?: string
          decision_status?: string | null
          deleted_at?: string | null
          drive_file_id?: string | null
          drive_folder_id?: string | null
          exported_at?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          last_viewed_at?: string | null
          mime_type?: string | null
          pinned_at?: string | null
          related_contact_id?: string | null
          related_item_ids?: string[] | null
          search_vector?: unknown
          sentiment?: string | null
          shared_with?: string[] | null
          source_id?: string | null
          source_table?: string | null
          starred?: boolean | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          view_count?: number | null
          visibility?: string | null
        }
        Update: {
          ai_summary?: string | null
          ai_tags?: string[] | null
          archive_type?: string
          collection_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          date?: string
          decision_status?: string | null
          deleted_at?: string | null
          drive_file_id?: string | null
          drive_folder_id?: string | null
          exported_at?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          last_viewed_at?: string | null
          mime_type?: string | null
          pinned_at?: string | null
          related_contact_id?: string | null
          related_item_ids?: string[] | null
          search_vector?: unknown
          sentiment?: string | null
          shared_with?: string[] | null
          source_id?: string | null
          source_table?: string | null
          starred?: boolean | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archives_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "archive_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      attention_settings: {
        Row: {
          batch_interval_minutes: number | null
          created_at: string | null
          focus_hours_end: string | null
          focus_hours_start: string | null
          high_priority_bypass: boolean | null
          id: string
          max_daily_notifications: number | null
          updated_at: string | null
          user_id: string
          weekly_attention_goal: number | null
        }
        Insert: {
          batch_interval_minutes?: number | null
          created_at?: string | null
          focus_hours_end?: string | null
          focus_hours_start?: string | null
          high_priority_bypass?: boolean | null
          id?: string
          max_daily_notifications?: number | null
          updated_at?: string | null
          user_id: string
          weekly_attention_goal?: number | null
        }
        Update: {
          batch_interval_minutes?: number | null
          created_at?: string | null
          focus_hours_end?: string | null
          focus_hours_start?: string | null
          high_priority_bypass?: boolean | null
          id?: string
          max_daily_notifications?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_attention_goal?: number | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          category: string
          changes: Json | null
          created_at: string
          details: Json
          error_message: string | null
          id: string
          ip_address: unknown
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
          session_id: string | null
          status: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          category: string
          changes?: Json | null
          created_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          ip_address?: unknown
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          status?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          category?: string
          changes?: Json | null
          created_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          ip_address?: unknown
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          status?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          actions_executed: Json | null
          automation_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          success: boolean | null
          trigger_data: Json | null
          triggered_at: string
        }
        Insert: {
          actions_executed?: Json | null
          automation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          success?: boolean | null
          trigger_data?: Json | null
          triggered_at: string
        }
        Update: {
          actions_executed?: Json | null
          automation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          success?: boolean | null
          trigger_data?: Json | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_templates: {
        Row: {
          actions: Json
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          popular_count: number | null
          trigger_config: Json | null
          trigger_type: string
        }
        Insert: {
          actions?: Json
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id: string
          name: string
          popular_count?: number | null
          trigger_config?: Json | null
          trigger_type: string
        }
        Update: {
          actions?: Json
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          popular_count?: number | null
          trigger_config?: Json | null
          trigger_type?: string
        }
        Relationships: []
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          execution_count: number | null
          id: string
          last_executed_at: string | null
          name: string
          team_id: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actions: Json
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          execution_count?: number | null
          id?: string
          last_executed_at?: string | null
          name: string
          team_id?: string | null
          trigger_config: Json
          trigger_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actions?: Json
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          execution_count?: number | null
          id?: string
          last_executed_at?: string | null
          name?: string
          team_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_drift_log: {
        Row: {
          detected_at: string
          error_message: string | null
          expected_quantity: number | null
          id: string
          metadata: Json | null
          observed_quantity: number | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          workspace_id: string
        }
        Insert: {
          detected_at?: string
          error_message?: string | null
          expected_quantity?: number | null
          id?: string
          metadata?: Json | null
          observed_quantity?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          workspace_id: string
        }
        Update: {
          detected_at?: string
          error_message?: string | null
          expected_quantity?: number | null
          id?: string
          metadata?: Json | null
          observed_quantity?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_drift_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_senders: {
        Row: {
          auto_delete: boolean | null
          blocked_at: string
          created_at: string
          domain: string | null
          email_address: string | null
          id: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_delete?: boolean | null
          blocked_at?: string
          created_at?: string
          domain?: string | null
          email_address?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_delete?: boolean | null
          blocked_at?: string
          created_at?: string
          domain?: string | null
          email_address?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_pages: {
        Row: {
          availability_windows: Json | null
          buffer_after: number
          buffer_before: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          slug: string
          timezone: string
          title: string
          user_id: string
          video_type: string
        }
        Insert: {
          availability_windows?: Json | null
          buffer_after?: number
          buffer_before?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          slug: string
          timezone?: string
          title: string
          user_id: string
          video_type?: string
        }
        Update: {
          availability_windows?: Json | null
          buffer_after?: number
          buffer_before?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          slug?: string
          timezone?: string
          title?: string
          user_id?: string
          video_type?: string
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          booker_email: string
          booker_name: string
          booker_notes: string | null
          created_at: string
          event_id: string | null
          id: string
          page_id: string
          proposed_end: string
          proposed_start: string
          status: string
        }
        Insert: {
          booker_email: string
          booker_name: string
          booker_notes?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          page_id: string
          proposed_end: string
          proposed_start: string
          status?: string
        }
        Update: {
          booker_email?: string
          booker_name?: string
          booker_notes?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          page_id?: string
          proposed_end?: string
          proposed_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_sessions: {
        Row: {
          callback_token_hash: string | null
          created_at: string
          ended_at: string | null
          failure_reason: string | null
          id: string
          last_callback_at: string | null
          machine_id: string | null
          meeting_id: string
          meeting_url: string | null
          org_id: string
          platform: string
          recall_bot_id: string | null
          recording_url: string | null
          started_at: string | null
          status: string
          transcript_url: string | null
        }
        Insert: {
          callback_token_hash?: string | null
          created_at?: string
          ended_at?: string | null
          failure_reason?: string | null
          id: string
          last_callback_at?: string | null
          machine_id?: string | null
          meeting_id: string
          meeting_url?: string | null
          org_id: string
          platform: string
          recall_bot_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          transcript_url?: string | null
        }
        Update: {
          callback_token_hash?: string | null
          created_at?: string
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          last_callback_at?: string | null
          machine_id?: string | null
          meeting_id?: string
          meeting_url?: string | null
          org_id?: string
          platform?: string
          recall_bot_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          transcript_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "tenant_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brainstorm_ai_cache: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          input_hash: string
          operation_type: string
          result: Json
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          input_hash: string
          operation_type: string
          result: Json
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          input_hash?: string
          operation_type?: string
          result?: Json
          session_id?: string | null
        }
        Relationships: []
      }
      brainstorm_sessions: {
        Row: {
          clusters: Json | null
          collaborators: string[] | null
          created_at: string | null
          expires_at: string
          framework: string | null
          id: string
          ideas: Json | null
          owner_id: string
          topic: string
          updated_at: string | null
        }
        Insert: {
          clusters?: Json | null
          collaborators?: string[] | null
          created_at?: string | null
          expires_at?: string
          framework?: string | null
          id?: string
          ideas?: Json | null
          owner_id: string
          topic: string
          updated_at?: string | null
        }
        Update: {
          clusters?: Json | null
          collaborators?: string[] | null
          created_at?: string | null
          expires_at?: string
          framework?: string | null
          id?: string
          ideas?: Json | null
          owner_id?: string
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      broadcast_likes: {
        Row: {
          broadcast_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_likes_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          audio_url: string
          author_id: string | null
          author_name: string
          channel_id: string | null
          created_at: string | null
          description: string | null
          duration: number
          episode_number: number | null
          id: string
          is_live: boolean | null
          listen_count: number | null
          parent_broadcast_id: string | null
          published_at: string | null
          reaction_counts: Json | null
          scheduled_for: string | null
          tags: string[] | null
          title: string
          transcript: string | null
        }
        Insert: {
          audio_url: string
          author_id?: string | null
          author_name: string
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          duration: number
          episode_number?: number | null
          id?: string
          is_live?: boolean | null
          listen_count?: number | null
          parent_broadcast_id?: string | null
          published_at?: string | null
          reaction_counts?: Json | null
          scheduled_for?: string | null
          tags?: string[] | null
          title: string
          transcript?: string | null
        }
        Update: {
          audio_url?: string
          author_id?: string | null
          author_name?: string
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number
          episode_number?: number | null
          id?: string
          is_live?: boolean | null
          listen_count?: number | null
          parent_broadcast_id?: string | null
          published_at?: string | null
          reaction_counts?: Json | null
          scheduled_for?: string | null
          tags?: string[] | null
          title?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "pulse_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_parent_broadcast_id_fkey"
            columns: ["parent_broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      burnout_indicators: {
        Row: {
          assessed_at: string
          avg_response_time_30d: number | null
          avg_response_time_7d: number | null
          avg_response_time_increasing: boolean | null
          burnout_risk_score: number | null
          created_at: string | null
          id: string
          message_volume_increasing: boolean | null
          messages_per_day_30d: number | null
          messages_per_day_7d: number | null
          recommended_actions: string[] | null
          response_quality_dropping: boolean | null
          risk_level: string | null
          sentiment_declining: boolean | null
          user_id: string
          weekend_activity_high: boolean | null
          working_hours_extending: boolean | null
        }
        Insert: {
          assessed_at?: string
          avg_response_time_30d?: number | null
          avg_response_time_7d?: number | null
          avg_response_time_increasing?: boolean | null
          burnout_risk_score?: number | null
          created_at?: string | null
          id?: string
          message_volume_increasing?: boolean | null
          messages_per_day_30d?: number | null
          messages_per_day_7d?: number | null
          recommended_actions?: string[] | null
          response_quality_dropping?: boolean | null
          risk_level?: string | null
          sentiment_declining?: boolean | null
          user_id: string
          weekend_activity_high?: boolean | null
          working_hours_extending?: boolean | null
        }
        Update: {
          assessed_at?: string
          avg_response_time_30d?: number | null
          avg_response_time_7d?: number | null
          avg_response_time_increasing?: boolean | null
          burnout_risk_score?: number | null
          created_at?: string | null
          id?: string
          message_volume_increasing?: boolean | null
          messages_per_day_30d?: number | null
          messages_per_day_7d?: number | null
          recommended_actions?: string[] | null
          response_quality_dropping?: boolean | null
          risk_level?: string | null
          sentiment_declining?: boolean | null
          user_id?: string
          weekend_activity_high?: boolean | null
          working_hours_extending?: boolean | null
        }
        Relationships: []
      }
      cached_emails: {
        Row: {
          ai_action_items: Json | null
          ai_category: string | null
          ai_entities: Json | null
          ai_priority_score: number | null
          ai_sentiment: string | null
          ai_suggested_replies: Json | null
          ai_summary: string | null
          analyzed_at: string | null
          attachments: Json | null
          bcc_emails: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          created_at: string | null
          from_email: string
          from_name: string | null
          gmail_id: string | null
          has_attachments: boolean | null
          id: string
          is_archived: boolean | null
          is_draft: boolean | null
          is_important: boolean | null
          is_read: boolean | null
          is_sent: boolean | null
          is_starred: boolean | null
          is_trashed: boolean | null
          labels: Json | null
          received_at: string | null
          snippet: string | null
          subject: string | null
          synced_at: string | null
          thread_id: string
          to_emails: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_action_items?: Json | null
          ai_category?: string | null
          ai_entities?: Json | null
          ai_priority_score?: number | null
          ai_sentiment?: string | null
          ai_suggested_replies?: Json | null
          ai_summary?: string | null
          analyzed_at?: string | null
          attachments?: Json | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string | null
          from_email: string
          from_name?: string | null
          gmail_id?: string | null
          has_attachments?: boolean | null
          id: string
          is_archived?: boolean | null
          is_draft?: boolean | null
          is_important?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          is_starred?: boolean | null
          is_trashed?: boolean | null
          labels?: Json | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          thread_id: string
          to_emails?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_action_items?: Json | null
          ai_category?: string | null
          ai_entities?: Json | null
          ai_priority_score?: number | null
          ai_sentiment?: string | null
          ai_suggested_replies?: Json | null
          ai_summary?: string | null
          analyzed_at?: string | null
          attachments?: Json | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string | null
          from_email?: string
          from_name?: string | null
          gmail_id?: string | null
          has_attachments?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_draft?: boolean | null
          is_important?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          is_starred?: boolean | null
          is_trashed?: boolean | null
          labels?: Json | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          synced_at?: string | null
          thread_id?: string
          to_emails?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendees: string[] | null
          calendar_id: string
          color: string
          created_at: string
          description: string | null
          end_time: string
          event_status: string | null
          event_type: string
          id: string
          is_recurring_exception: boolean | null
          location: string | null
          recurrence_end: string | null
          recurrence_parent_id: string | null
          recurrence_rule: string | null
          search_vector: unknown
          start_time: string
          team_calendar_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          attendees?: string[] | null
          calendar_id?: string
          color?: string
          created_at?: string
          description?: string | null
          end_time: string
          event_status?: string | null
          event_type?: string
          id?: string
          is_recurring_exception?: boolean | null
          location?: string | null
          recurrence_end?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          search_vector?: unknown
          start_time: string
          team_calendar_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          attendees?: string[] | null
          calendar_id?: string
          color?: string
          created_at?: string
          description?: string | null
          end_time?: string
          event_status?: string | null
          event_type?: string
          id?: string
          is_recurring_exception?: boolean | null
          location?: string | null
          recurrence_end?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          search_vector?: unknown
          start_time?: string
          team_calendar_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_team_calendar_id_fkey"
            columns: ["team_calendar_id"]
            isOneToOne: false
            referencedRelation: "team_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      card_recipient_state: {
        Row: {
          card_id: string
          recipient_user_id: string
          recorded_at: string
          state: string
        }
        Insert: {
          card_id: string
          recipient_user_id: string
          recorded_at?: string
          state: string
        }
        Update: {
          card_id?: string
          recipient_user_id?: string
          recorded_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_recipient_state_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "contact_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_send_blocks: {
        Row: {
          blocked_at: string
          blocked_by_user_id: string
          sender_user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by_user_id: string
          sender_user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by_user_id?: string
          sender_user_id?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "message_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          attachments: Json
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_pinned: boolean
          message_type: string
          reactions: Json | null
          sender_id: string
          sender_name: string | null
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          message_type?: string
          reactions?: Json | null
          sender_id: string
          sender_name?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          message_type?: string
          reactions?: Json | null
          sender_id?: string
          sender_name?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "message_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string | null
          external_id: string
          id: string
          is_archived: boolean | null
          is_member: boolean | null
          metadata: Json | null
          name: string
          platform: string
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          external_id: string
          id?: string
          is_archived?: boolean | null
          is_member?: boolean | null
          metadata?: Json | null
          name: string
          platform: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          external_id?: string
          id?: string
          is_archived?: boolean | null
          is_member?: boolean | null
          metadata?: Json | null
          name?: string
          platform?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          bot_actions: Json | null
          bot_app: string | null
          bot_content: string | null
          bot_message_type: string | null
          bot_metadata: Json | null
          channel_id: string | null
          created_at: string | null
          encrypted_content: string | null
          id: string
          is_bot_message: boolean | null
          nonce: string | null
          sender_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          bot_actions?: Json | null
          bot_app?: string | null
          bot_content?: string | null
          bot_message_type?: string | null
          bot_metadata?: Json | null
          channel_id?: string | null
          created_at?: string | null
          encrypted_content?: string | null
          id?: string
          is_bot_message?: boolean | null
          nonce?: string | null
          sender_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          bot_actions?: Json | null
          bot_app?: string | null
          bot_content?: string | null
          bot_message_type?: string | null
          bot_metadata?: Json | null
          channel_id?: string | null
          created_at?: string | null
          encrypted_content?: string | null
          id?: string
          is_bot_message?: boolean | null
          nonce?: string | null
          sender_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "message_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_keywords: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          priority: string
          prompt_template: string
          updated_at: string
          variations: string[]
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          priority?: string
          prompt_template: string
          updated_at?: string
          variations?: string[]
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          priority?: string
          prompt_template?: string
          updated_at?: string
          variations?: string[]
        }
        Relationships: []
      }
      coaching_prompts: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          priority: string
          prompt_text: string
          prompt_type: string
          session_id: string
          shown_at: string
          snoozed_until: string | null
          trigger_context: Json
          trigger_reason: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          priority?: string
          prompt_text: string
          prompt_type: string
          session_id: string
          shown_at?: string
          snoozed_until?: string | null
          trigger_context?: Json
          trigger_reason?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          priority?: string
          prompt_text?: string
          prompt_type?: string
          session_id?: string
          shown_at?: string
          snoozed_until?: string | null
          trigger_context?: Json
          trigger_reason?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_prompts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_sessions: {
        Row: {
          coaching_enabled: boolean
          created_at: string
          deal_id: string | null
          ended_at: string | null
          id: string
          meeting_id: string
          prompts_dismissed: number
          prompts_shown: number
          prompts_used: number
          started_at: string
          talk_time_percentage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coaching_enabled?: boolean
          created_at?: string
          deal_id?: string | null
          ended_at?: string | null
          id?: string
          meeting_id: string
          prompts_dismissed?: number
          prompts_shown?: number
          prompts_used?: number
          started_at?: string
          talk_time_percentage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coaching_enabled?: boolean
          created_at?: string
          deal_id?: string | null
          ended_at?: string | null
          id?: string
          meeting_id?: string
          prompts_dismissed?: number
          prompts_shown?: number
          prompts_used?: number
          started_at?: string
          talk_time_percentage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      collection_docs: {
        Row: {
          added_at: string | null
          collection_id: string
          doc_id: string
          sort_order: number | null
        }
        Insert: {
          added_at?: string | null
          collection_id: string
          doc_id: string
          sort_order?: number | null
        }
        Update: {
          added_at?: string | null
          collection_id?: string
          doc_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_docs_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "document_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_docs_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      confidential_emails: {
        Row: {
          created_at: string
          disable_copy: boolean | null
          disable_download: boolean | null
          disable_forward: boolean | null
          disable_print: boolean | null
          email_id: string | null
          expires_at: string | null
          id: string
          passcode_hash: string | null
          require_passcode: boolean | null
          revoked: boolean | null
          revoked_at: string | null
          thread_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disable_copy?: boolean | null
          disable_download?: boolean | null
          disable_forward?: boolean | null
          disable_print?: boolean | null
          email_id?: string | null
          expires_at?: string | null
          id?: string
          passcode_hash?: string | null
          require_passcode?: boolean | null
          revoked?: boolean | null
          revoked_at?: string | null
          thread_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disable_copy?: boolean | null
          disable_download?: boolean | null
          disable_forward?: boolean | null
          disable_print?: boolean | null
          email_id?: string | null
          expires_at?: string | null
          id?: string
          passcode_hash?: string | null
          require_passcode?: boolean | null
          revoked?: boolean | null
          revoked_at?: string | null
          thread_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confidential_emails_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "cached_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      conflict_tracking: {
        Row: {
          channel: string | null
          conflict_type: string | null
          contact_identifier: string
          created_at: string | null
          escalated_by: string | null
          first_detected_at: string
          first_message_id: string | null
          hot_topic: boolean | null
          id: string
          initiated_by: string | null
          is_recurring: boolean | null
          previous_conflict_ids: string[] | null
          related_message_ids: string[] | null
          resolution_message_id: string | null
          resolution_method: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          tension_score: number | null
          time_to_resolution_hours: number | null
          trigger_keywords: string[] | null
          trigger_topic: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          conflict_type?: string | null
          contact_identifier: string
          created_at?: string | null
          escalated_by?: string | null
          first_detected_at: string
          first_message_id?: string | null
          hot_topic?: boolean | null
          id?: string
          initiated_by?: string | null
          is_recurring?: boolean | null
          previous_conflict_ids?: string[] | null
          related_message_ids?: string[] | null
          resolution_message_id?: string | null
          resolution_method?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          tension_score?: number | null
          time_to_resolution_hours?: number | null
          trigger_keywords?: string[] | null
          trigger_topic?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string | null
          conflict_type?: string | null
          contact_identifier?: string
          created_at?: string | null
          escalated_by?: string | null
          first_detected_at?: string
          first_message_id?: string | null
          hot_topic?: boolean | null
          id?: string
          initiated_by?: string | null
          is_recurring?: boolean | null
          previous_conflict_ids?: string[] | null
          related_message_ids?: string[] | null
          resolution_message_id?: string | null
          resolution_method?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          tension_score?: number | null
          time_to_resolution_hours?: number | null
          trigger_keywords?: string[] | null
          trigger_topic?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_cards: {
        Row: {
          card_snapshot: Json
          consumed_at: string | null
          created_at: string
          expires_at: string | null
          forwarded_from_card_id: string | null
          id: string
          intro_note: string | null
          is_forwardable: boolean
          recipient_hint: string | null
          recipient_user_id: string | null
          revoked_at: string | null
          sender_user_id: string
          token_policy: string
          view_count: number
        }
        Insert: {
          card_snapshot: Json
          consumed_at?: string | null
          created_at?: string
          expires_at?: string | null
          forwarded_from_card_id?: string | null
          id?: string
          intro_note?: string | null
          is_forwardable?: boolean
          recipient_hint?: string | null
          recipient_user_id?: string | null
          revoked_at?: string | null
          sender_user_id: string
          token_policy?: string
          view_count?: number
        }
        Update: {
          card_snapshot?: Json
          consumed_at?: string | null
          created_at?: string
          expires_at?: string | null
          forwarded_from_card_id?: string | null
          id?: string
          intro_note?: string | null
          is_forwardable?: boolean
          recipient_hint?: string | null
          recipient_user_id?: string | null
          revoked_at?: string | null
          sender_user_id?: string
          token_policy?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_cards_forwarded_from_card_id_fkey"
            columns: ["forwarded_from_card_id"]
            isOneToOne: false
            referencedRelation: "contact_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_circle_members: {
        Row: {
          added_at: string
          circle_id: string
          contact_id: string
        }
        Insert: {
          added_at?: string
          circle_id: string
          contact_id: string
        }
        Update: {
          added_at?: string
          circle_id?: string
          contact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "contact_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_circles: {
        Row: {
          color: string
          created_at: string
          description: string | null
          health_score: number | null
          icon: string | null
          id: string
          name: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          health_score?: number | null
          icon?: string | null
          id?: string
          name: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          health_score?: number | null
          icon?: string | null
          id?: string
          name?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_goals: {
        Row: {
          autopilot_enabled: boolean
          channel: string
          contact_email: string
          contact_id: string
          created_at: string | null
          frequency: string
          id: string
          last_completed_at: string | null
          next_action_at: string
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          autopilot_enabled?: boolean
          channel?: string
          contact_email: string
          contact_id: string
          created_at?: string | null
          frequency?: string
          id?: string
          last_completed_at?: string | null
          next_action_at: string
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          autopilot_enabled?: boolean
          channel?: string
          contact_email?: string
          contact_id?: string
          created_at?: string | null
          frequency?: string
          id?: string
          last_completed_at?: string | null
          next_action_at?: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_interactions: {
        Row: {
          ai_action_items: Json | null
          ai_key_points: Json | null
          ai_topics: Json | null
          attachment_count: number | null
          attachment_types: Json | null
          body_preview: string | null
          created_at: string | null
          has_attachment: boolean | null
          id: string
          interaction_date: string
          interaction_type: string
          is_response: boolean | null
          meeting_duration_minutes: number | null
          meeting_outcome: string | null
          meeting_type: string | null
          participant_count: number | null
          participants: Json | null
          profile_id: string | null
          responded_to_id: string | null
          response_time_hours: number | null
          sentiment: number | null
          sentiment_label: string | null
          snippet: string | null
          source_id: string | null
          source_type: string | null
          subject: string | null
          thread_id: string | null
          user_id: string | null
        }
        Insert: {
          ai_action_items?: Json | null
          ai_key_points?: Json | null
          ai_topics?: Json | null
          attachment_count?: number | null
          attachment_types?: Json | null
          body_preview?: string | null
          created_at?: string | null
          has_attachment?: boolean | null
          id?: string
          interaction_date: string
          interaction_type: string
          is_response?: boolean | null
          meeting_duration_minutes?: number | null
          meeting_outcome?: string | null
          meeting_type?: string | null
          participant_count?: number | null
          participants?: Json | null
          profile_id?: string | null
          responded_to_id?: string | null
          response_time_hours?: number | null
          sentiment?: number | null
          sentiment_label?: string | null
          snippet?: string | null
          source_id?: string | null
          source_type?: string | null
          subject?: string | null
          thread_id?: string | null
          user_id?: string | null
        }
        Update: {
          ai_action_items?: Json | null
          ai_key_points?: Json | null
          ai_topics?: Json | null
          attachment_count?: number | null
          attachment_types?: Json | null
          body_preview?: string | null
          created_at?: string | null
          has_attachment?: boolean | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          is_response?: boolean | null
          meeting_duration_minutes?: number | null
          meeting_outcome?: string | null
          meeting_type?: string | null
          participant_count?: number | null
          participants?: Json | null
          profile_id?: string | null
          responded_to_id?: string | null
          response_time_hours?: number | null
          sentiment?: number | null
          sentiment_label?: string | null
          snippet?: string | null
          source_id?: string | null
          source_type?: string | null
          subject?: string | null
          thread_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "relationship_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_responded_to_id_fkey"
            columns: ["responded_to_id"]
            isOneToOne: false
            referencedRelation: "contact_interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          archived_at: string | null
          avatar_color: string
          avatar_url: string | null
          birthday: string | null
          case_notes: string | null
          company: string | null
          contact_type: string | null
          created_at: string
          email: string
          external_id: string
          geo_accuracy: string | null
          groups: string[] | null
          home_address: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          import_label: string[] | null
          import_source: string | null
          last_synced: string | null
          location_updated_at: string | null
          name: string
          notes: string | null
          phone: string | null
          platform: string
          possible_duplicate_of: string | null
          pulse_user_id: string | null
          role: string
          search_vector: unknown
          slack_user_id: string | null
          source: string
          source_account_email: string | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
          work_address: string | null
          work_lat: number | null
          work_lng: number | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          avatar_color?: string
          avatar_url?: string | null
          birthday?: string | null
          case_notes?: string | null
          company?: string | null
          contact_type?: string | null
          created_at?: string
          email: string
          external_id?: string
          geo_accuracy?: string | null
          groups?: string[] | null
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          import_label?: string[] | null
          import_source?: string | null
          last_synced?: string | null
          location_updated_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          platform?: string
          possible_duplicate_of?: string | null
          pulse_user_id?: string | null
          role?: string
          search_vector?: unknown
          slack_user_id?: string | null
          source?: string
          source_account_email?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
          work_address?: string | null
          work_lat?: number | null
          work_lng?: number | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          avatar_color?: string
          avatar_url?: string | null
          birthday?: string | null
          case_notes?: string | null
          company?: string | null
          contact_type?: string | null
          created_at?: string
          email?: string
          external_id?: string
          geo_accuracy?: string | null
          groups?: string[] | null
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          import_label?: string[] | null
          import_source?: string | null
          last_synced?: string | null
          location_updated_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          platform?: string
          possible_duplicate_of?: string | null
          pulse_user_id?: string | null
          role?: string
          search_vector?: unknown
          slack_user_id?: string | null
          source?: string
          source_account_email?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          work_address?: string | null
          work_lat?: number | null
          work_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_possible_duplicate_of_fkey"
            columns: ["possible_duplicate_of"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_graphs: {
        Row: {
          created_at: string | null
          id: string
          participants: string[] | null
          related_messages: string[] | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          participants?: string[] | null
          related_messages?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          participants?: string[] | null
          related_messages?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_health: {
        Row: {
          action_items_created: number | null
          avg_response_time_hours: number | null
          communication_style: string | null
          conversation_id: string
          created_at: string | null
          decisions_count: number | null
          engagement_level: string | null
          health_score: number | null
          id: string
          last_calculated_at: string | null
          overall_sentiment: string | null
          participation_rate: number | null
          response_trend: string | null
          sentiment_trend: string | null
          tasks_created: number | null
          user_id: string
        }
        Insert: {
          action_items_created?: number | null
          avg_response_time_hours?: number | null
          communication_style?: string | null
          conversation_id: string
          created_at?: string | null
          decisions_count?: number | null
          engagement_level?: string | null
          health_score?: number | null
          id?: string
          last_calculated_at?: string | null
          overall_sentiment?: string | null
          participation_rate?: number | null
          response_trend?: string | null
          sentiment_trend?: string | null
          tasks_created?: number | null
          user_id: string
        }
        Update: {
          action_items_created?: number | null
          avg_response_time_hours?: number | null
          communication_style?: string | null
          conversation_id?: string
          created_at?: string | null
          decisions_count?: number | null
          engagement_level?: string | null
          health_score?: number | null
          id?: string
          last_calculated_at?: string | null
          overall_sentiment?: string | null
          participation_rate?: number | null
          response_trend?: string | null
          sentiment_trend?: string | null
          tasks_created?: number | null
          user_id?: string
        }
        Relationships: []
      }
      conversation_intelligence: {
        Row: {
          analysis_count: number | null
          channel_id: string
          created_at: string | null
          current_sentiment: string | null
          detected_topics: string[] | null
          engagement_trend: string | null
          id: string
          last_analyzed_at: string | null
          participant_engagement: Json | null
          sentiment_history: Json | null
          sentiment_score: number | null
          suggested_followups: string[] | null
          topic_confidence: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          analysis_count?: number | null
          channel_id: string
          created_at?: string | null
          current_sentiment?: string | null
          detected_topics?: string[] | null
          engagement_trend?: string | null
          id?: string
          last_analyzed_at?: string | null
          participant_engagement?: Json | null
          sentiment_history?: Json | null
          sentiment_score?: number | null
          suggested_followups?: string[] | null
          topic_confidence?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          analysis_count?: number | null
          channel_id?: string
          created_at?: string | null
          current_sentiment?: string | null
          detected_topics?: string[] | null
          engagement_trend?: string | null
          id?: string
          last_analyzed_at?: string | null
          participant_engagement?: Json | null
          sentiment_history?: Json | null
          sentiment_score?: number | null
          suggested_followups?: string[] | null
          topic_confidence?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_memory: {
        Row: {
          common_topics: string[] | null
          conversation_id: string
          created_at: string | null
          dna_hash: string | null
          frequent_links: string[] | null
          id: string
          milestones: Json | null
          typical_deadlines: string[] | null
          updated_at: string | null
          user_id: string
          usual_participants: string[] | null
        }
        Insert: {
          common_topics?: string[] | null
          conversation_id: string
          created_at?: string | null
          dna_hash?: string | null
          frequent_links?: string[] | null
          id?: string
          milestones?: Json | null
          typical_deadlines?: string[] | null
          updated_at?: string | null
          user_id: string
          usual_participants?: string[] | null
        }
        Update: {
          common_topics?: string[] | null
          conversation_id?: string
          created_at?: string | null
          dna_hash?: string | null
          frequent_links?: string[] | null
          id?: string
          milestones?: Json | null
          typical_deadlines?: string[] | null
          updated_at?: string | null
          user_id?: string
          usual_participants?: string[] | null
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          citations: Json | null
          confidence: number | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          citations?: Json | null
          confidence?: number | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          citations?: Json | null
          confidence?: number | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          action_items: string[] | null
          decisions: string[] | null
          expires_at: string | null
          generated_at: string | null
          id: string
          key_points: string[] | null
          message_count: number | null
          participants: string[] | null
          reference_id: string
          summary_text: string
          summary_type: string
          user_id: string
        }
        Insert: {
          action_items?: string[] | null
          decisions?: string[] | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          key_points?: string[] | null
          message_count?: number | null
          participants?: string[] | null
          reference_id: string
          summary_text: string
          summary_type: string
          user_id: string
        }
        Update: {
          action_items?: string[] | null
          decisions?: string[] | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          key_points?: string[] | null
          message_count?: number | null
          participants?: string[] | null
          reference_id?: string
          summary_text?: string
          summary_type?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          last_message_at: string | null
          started_at: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          last_message_at?: string | null
          started_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          last_message_at?: string | null
          started_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crm_actions: {
        Row: {
          action_payload: Json
          action_type: string
          created_at: string | null
          crm_id: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          status: string | null
          target_external_id: string | null
          template_name: string | null
          triggered_by_message_id: string | null
          triggered_by_user_id: string | null
          triggered_in_chat_id: string | null
        }
        Insert: {
          action_payload: Json
          action_type: string
          created_at?: string | null
          crm_id?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
          target_external_id?: string | null
          template_name?: string | null
          triggered_by_message_id?: string | null
          triggered_by_user_id?: string | null
          triggered_in_chat_id?: string | null
        }
        Update: {
          action_payload?: Json
          action_type?: string
          created_at?: string | null
          crm_id?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
          target_external_id?: string | null
          template_name?: string | null
          triggered_by_message_id?: string | null
          triggered_by_user_id?: string | null
          triggered_in_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_actions_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          annual_revenue: number | null
          contact_ids: string[] | null
          created_at: string | null
          crm_id: string | null
          custom_fields: Json | null
          employee_count: number | null
          external_id: string
          id: string
          industry: string | null
          last_updated_at: string | null
          name: string
          owner_id: string | null
          owner_name: string | null
          platform: string
          synced_at: string | null
          website: string | null
        }
        Insert: {
          annual_revenue?: number | null
          contact_ids?: string[] | null
          created_at?: string | null
          crm_id?: string | null
          custom_fields?: Json | null
          employee_count?: number | null
          external_id: string
          id?: string
          industry?: string | null
          last_updated_at?: string | null
          name: string
          owner_id?: string | null
          owner_name?: string | null
          platform: string
          synced_at?: string | null
          website?: string | null
        }
        Update: {
          annual_revenue?: number | null
          contact_ids?: string[] | null
          created_at?: string | null
          crm_id?: string | null
          custom_fields?: Json | null
          employee_count?: number | null
          external_id?: string
          id?: string
          industry?: string | null
          last_updated_at?: string | null
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          platform?: string
          synced_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string | null
          crm_id: string | null
          custom_fields: Json | null
          email: string | null
          external_id: string
          first_name: string | null
          id: string
          last_name: string | null
          last_updated_at: string | null
          lifecycle_stage: string | null
          owner_id: string | null
          owner_name: string | null
          phone: string | null
          platform: string
          pulse_user_id: string | null
          synced_at: string | null
          title: string | null
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          crm_id?: string | null
          custom_fields?: Json | null
          email?: string | null
          external_id: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_updated_at?: string | null
          lifecycle_stage?: string | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          platform: string
          pulse_user_id?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          crm_id?: string | null
          custom_fields?: Json | null
          email?: string | null
          external_id?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_updated_at?: string | null
          lifecycle_stage?: string | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          platform?: string
          pulse_user_id?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          close_date: string | null
          company_id: string | null
          company_name: string | null
          contact_ids: string[] | null
          created_at: string | null
          created_date: string | null
          crm_id: string | null
          currency: string | null
          custom_fields: Json | null
          deal_amount: number | null
          deal_stage: string
          external_id: string
          id: string
          is_closed: boolean | null
          is_won: boolean | null
          last_updated_at: string | null
          linked_channel_id: string | null
          linked_chat_id: string | null
          name: string
          owner_id: string | null
          owner_name: string | null
          platform: string
          probability: number | null
          synced_at: string | null
        }
        Insert: {
          close_date?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_ids?: string[] | null
          created_at?: string | null
          created_date?: string | null
          crm_id?: string | null
          currency?: string | null
          custom_fields?: Json | null
          deal_amount?: number | null
          deal_stage: string
          external_id: string
          id?: string
          is_closed?: boolean | null
          is_won?: boolean | null
          last_updated_at?: string | null
          linked_channel_id?: string | null
          linked_chat_id?: string | null
          name: string
          owner_id?: string | null
          owner_name?: string | null
          platform: string
          probability?: number | null
          synced_at?: string | null
        }
        Update: {
          close_date?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_ids?: string[] | null
          created_at?: string | null
          created_date?: string | null
          crm_id?: string | null
          currency?: string | null
          custom_fields?: Json | null
          deal_amount?: number | null
          deal_stage?: string
          external_id?: string
          id?: string
          is_closed?: boolean | null
          is_won?: boolean | null
          last_updated_at?: string | null
          linked_channel_id?: string | null
          linked_chat_id?: string | null
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          platform?: string
          probability?: number | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_integrations: {
        Row: {
          access_token: string | null
          api_key: string
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          platform: string
          refresh_token: string | null
          settings: Json | null
          sync_enabled: boolean | null
          sync_error_message: string | null
          sync_status: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
          webhook_secret: string | null
          webhook_url: string | null
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          api_key: string
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          platform: string
          refresh_token?: string | null
          settings?: Json | null
          sync_enabled?: boolean | null
          sync_error_message?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          api_key?: string
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          platform?: string
          refresh_token?: string | null
          settings?: Json | null
          sync_enabled?: boolean | null
          sync_error_message?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sidepanels: {
        Row: {
          chat_id: string
          created_at: string | null
          crm_id: string | null
          id: string
          is_open: boolean | null
          linked_external_id: string
          linked_record_type: string
          panel_position: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          crm_id?: string | null
          id?: string
          is_open?: boolean | null
          linked_external_id: string
          linked_record_type: string
          panel_position?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          crm_id?: string | null
          id?: string
          is_open?: boolean | null
          linked_external_id?: string
          linked_record_type?: string
          panel_position?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sidepanels_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_log: {
        Row: {
          completed_at: string | null
          created_at: string | null
          crm_entity_id: string | null
          crm_system: string
          data_snapshot: Json | null
          entity_id: string
          entity_type: string
          error_message: string | null
          fields_synced: Json | null
          id: string
          retry_count: number | null
          sync_direction: string
          sync_key: string | null
          sync_status: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          crm_entity_id?: string | null
          crm_system?: string
          data_snapshot?: Json | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          fields_synced?: Json | null
          id?: string
          retry_count?: number | null
          sync_direction?: string
          sync_key?: string | null
          sync_status?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          crm_entity_id?: string | null
          crm_system?: string
          data_snapshot?: Json | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          fields_synced?: Json | null
          id?: string
          retry_count?: number | null
          sync_direction?: string
          sync_key?: string | null
          sync_status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      crm_sync_logs: {
        Row: {
          companies_synced: number | null
          completed_at: string | null
          contacts_synced: number | null
          crm_id: string | null
          deals_synced: number | null
          duration_ms: number | null
          duration_seconds: number | null
          error_message: string | null
          errors: Json | null
          id: string
          integration_id: string | null
          records_synced: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          companies_synced?: number | null
          completed_at?: string | null
          contacts_synced?: number | null
          crm_id?: string | null
          deals_synced?: number | null
          duration_ms?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          errors?: Json | null
          id?: string
          integration_id?: string | null
          records_synced?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          companies_synced?: number | null
          completed_at?: string | null
          contacts_synced?: number | null
          crm_id?: string | null
          deals_synced?: number | null
          duration_ms?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          errors?: Json | null
          id?: string
          integration_id?: string | null
          records_synced?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_logs_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sync_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_labels: {
        Row: {
          color: string
          created_at: string
          display_order: number | null
          gmail_label_id: string | null
          id: string
          is_system: boolean | null
          message_count: number | null
          name: string
          parent_label_id: string | null
          unread_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number | null
          gmail_label_id?: string | null
          id?: string
          is_system?: boolean | null
          message_count?: number | null
          name: string
          parent_label_id?: string | null
          unread_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number | null
          gmail_label_id?: string | null
          id?: string
          is_system?: boolean | null
          message_count?: number | null
          name?: string
          parent_label_id?: string | null
          unread_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_labels_parent_label_id_fkey"
            columns: ["parent_label_id"]
            isOneToOne: false
            referencedRelation: "custom_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          context: Json
          created_at: string
          customer_id: string
          id: string
          message: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          suggested_action: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          context?: Json
          created_at?: string
          customer_id: string
          id?: string
          message: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          suggested_action?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          context?: Json
          created_at?: string
          customer_id?: string
          id?: string
          message?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          suggested_action?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_health: {
        Row: {
          calculated_at: string
          created_at: string
          customer_id: string
          deal_progress_factor: number
          engagement_factor: number
          health_label: string
          health_score: number
          id: string
          interaction_count_30d: number
          last_interaction: string | null
          responsiveness_factor: number
          sentiment_factor: number
          sentiment_trend: string
          task_completion_factor: number
          trend_direction: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          customer_id: string
          deal_progress_factor?: number
          engagement_factor?: number
          health_label: string
          health_score: number
          id?: string
          interaction_count_30d?: number
          last_interaction?: string | null
          responsiveness_factor?: number
          sentiment_factor?: number
          sentiment_trend?: string
          task_completion_factor?: number
          trend_direction?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          calculated_at?: string
          created_at?: string
          customer_id?: string
          deal_progress_factor?: number
          engagement_factor?: number
          health_label?: string
          health_score?: number
          id?: string
          interaction_count_30d?: number
          last_interaction?: string | null
          responsiveness_factor?: number
          sentiment_factor?: number
          sentiment_trend?: string
          task_completion_factor?: number
          trend_direction?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_health_history: {
        Row: {
          customer_id: string
          factors: Json
          health_label: string
          health_score: number
          id: string
          recorded_at: string
          user_id: string | null
        }
        Insert: {
          customer_id: string
          factors: Json
          health_label: string
          health_score: number
          id?: string
          recorded_at?: string
          user_id?: string | null
        }
        Update: {
          customer_id?: string
          factors?: Json
          health_label?: string
          health_score?: number
          id?: string
          recorded_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_sentiment: {
        Row: {
          analyzed_at: string
          confidence: number
          created_at: string
          customer_id: string
          emotional_signals: Json
          id: string
          key_phrases: Json
          sentiment_label: string
          sentiment_score: number
          source_id: string
          source_type: string
          user_id: string | null
        }
        Insert: {
          analyzed_at?: string
          confidence?: number
          created_at?: string
          customer_id: string
          emotional_signals?: Json
          id?: string
          key_phrases?: Json
          sentiment_label: string
          sentiment_score: number
          source_id: string
          source_type: string
          user_id?: string | null
        }
        Update: {
          analyzed_at?: string
          confidence?: number
          created_at?: string
          customer_id?: string
          emotional_signals?: Json
          id?: string
          key_phrases?: Json
          sentiment_label?: string
          sentiment_score?: number
          source_id?: string
          source_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_cleanup_logs: {
        Row: {
          cleanup_type: string
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          items_deleted: number
          retention_days: number
          status: string
          user_id: string
        }
        Insert: {
          cleanup_type: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          items_deleted?: number
          retention_days: number
          status?: string
          user_id: string
        }
        Update: {
          cleanup_type?: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          items_deleted?: number
          retention_days?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          deletion_type: string
          error_message: string | null
          id: string
          ip_address: unknown
          items_deleted_count: number | null
          metadata: Json | null
          processed_at: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          deletion_type: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          items_deleted_count?: number | null
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          deletion_type?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          items_deleted_count?: number | null
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      data_exports: {
        Row: {
          created_at: string
          download_count: number
          downloaded_at: string | null
          error_message: string | null
          expires_at: string
          export_type: string
          file_size_bytes: number | null
          file_url: string | null
          id: string
          metadata: Json | null
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          downloaded_at?: string | null
          error_message?: string | null
          expires_at: string
          export_type: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          downloaded_at?: string | null
          error_message?: string | null
          expires_at?: string
          export_type?: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          auto_cleanup_enabled: boolean
          brainstorm_retention_days: number
          calendar_retention_days: number
          cleanup_time_utc: string
          contacts_retention_days: number
          created_at: string
          emails_retention_days: number
          id: string
          last_cleanup_at: string | null
          messages_retention_days: number
          next_cleanup_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_cleanup_enabled?: boolean
          brainstorm_retention_days?: number
          calendar_retention_days?: number
          cleanup_time_utc?: string
          contacts_retention_days?: number
          created_at?: string
          emails_retention_days?: number
          id?: string
          last_cleanup_at?: string | null
          messages_retention_days?: number
          next_cleanup_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_cleanup_enabled?: boolean
          brainstorm_retention_days?: number
          calendar_retention_days?: number
          cleanup_time_utc?: string
          contacts_retention_days?: number
          created_at?: string
          emails_retention_days?: number
          id?: string
          last_cleanup_at?: string | null
          messages_retention_days?: number
          next_cleanup_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      decision_activity: {
        Row: {
          action: string
          created_at: string | null
          decision_id: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          decision_id: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          decision_id?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_activity_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_comments: {
        Row: {
          body: string
          created_at: string | null
          decision_id: string
          edited_at: string | null
          id: string
          mentioned_user_ids: string[] | null
          parent_comment_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          decision_id: string
          edited_at?: string | null
          id?: string
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          decision_id?: string
          edited_at?: string | null
          id?: string
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_comments_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "decision_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_option_scores: {
        Row: {
          created_at: string | null
          criterion_id: string
          decision_id: string
          id: string
          notes: string | null
          option_id: string
          score: number
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          criterion_id: string
          decision_id: string
          id?: string
          notes?: string | null
          option_id: string
          score: number
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          criterion_id?: string
          decision_id?: string
          id?: string
          notes?: string | null
          option_id?: string
          score?: number
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_option_scores_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_retrospective_prompts: {
        Row: {
          created_at: string | null
          decision_id: string
          dismissed_at: string | null
          fire_at: string
          id: string
          resolved_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          decision_id: string
          dismissed_at?: string | null
          fire_at: string
          id?: string
          resolved_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          decision_id?: string
          dismissed_at?: string | null
          fire_at?: string
          id?: string
          resolved_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_retrospective_prompts_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_tasks: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string | null
          decision_id: string
          id: string
          link_type: string
          task_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          decision_id: string
          id?: string
          link_type?: string
          task_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          decision_id?: string
          id?: string
          link_type?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_tasks_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "extracted_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          default_decision_type: string | null
          description: string | null
          description_template: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          last_used_at: string | null
          name: string
          suggested_tasks: Json | null
          template_config: Json | null
          title_template: string
          updated_at: string
          usage_count: number | null
          workspace_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_decision_type?: string | null
          description?: string | null
          description_template?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          last_used_at?: string | null
          name: string
          suggested_tasks?: Json | null
          template_config?: Json | null
          title_template: string
          updated_at?: string
          usage_count?: number | null
          workspace_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_decision_type?: string | null
          description?: string | null
          description_template?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          last_used_at?: string | null
          name?: string
          suggested_tasks?: Json | null
          template_config?: Json | null
          title_template?: string
          updated_at?: string
          usage_count?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_votes: {
        Row: {
          choice: string
          comment: string | null
          decision_id: string
          id: string
          user_id: string
          voted_at: string | null
        }
        Insert: {
          choice: string
          comment?: string | null
          decision_id: string
          id?: string
          user_id: string
          voted_at?: string | null
        }
        Update: {
          choice?: string
          comment?: string | null
          decision_id?: string
          id?: string
          user_id?: string
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_votes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          ai_insights: Json | null
          ai_predicted_completion: string | null
          ai_risk_level: string | null
          ai_suggested_stakeholders: string[] | null
          archived_at: string | null
          brief: string | null
          consensus_reached: boolean | null
          consensus_reached_at: string | null
          created_at: string | null
          created_by: string
          criteria: Json | null
          decide_by_date: string | null
          decided_at: string | null
          decision_type: string
          description: string | null
          frame_id: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          options: Json | null
          outcome: Json | null
          proposal_text: string
          resolved_at: string | null
          scoring_matrix: Json | null
          stakeholders: string[] | null
          status: string
          tasks_count: number | null
          tasks_generated_at: string | null
          template_id: string | null
          threshold: number
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          ai_insights?: Json | null
          ai_predicted_completion?: string | null
          ai_risk_level?: string | null
          ai_suggested_stakeholders?: string[] | null
          archived_at?: string | null
          brief?: string | null
          consensus_reached?: boolean | null
          consensus_reached_at?: string | null
          created_at?: string | null
          created_by: string
          criteria?: Json | null
          decide_by_date?: string | null
          decided_at?: string | null
          decision_type?: string
          description?: string | null
          frame_id?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          options?: Json | null
          outcome?: Json | null
          proposal_text: string
          resolved_at?: string | null
          scoring_matrix?: Json | null
          stakeholders?: string[] | null
          status?: string
          tasks_count?: number | null
          tasks_generated_at?: string | null
          template_id?: string | null
          threshold?: number
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          ai_insights?: Json | null
          ai_predicted_completion?: string | null
          ai_risk_level?: string | null
          ai_suggested_stakeholders?: string[] | null
          archived_at?: string | null
          brief?: string | null
          consensus_reached?: boolean | null
          consensus_reached_at?: string | null
          created_at?: string | null
          created_by?: string
          criteria?: Json | null
          decide_by_date?: string | null
          decided_at?: string | null
          decision_type?: string
          description?: string | null
          frame_id?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          options?: Json | null
          outcome?: Json | null
          proposal_text?: string
          resolved_at?: string | null
          scoring_matrix?: Json | null
          stakeholders?: string[] | null
          status?: string
          tasks_count?: number | null
          tasks_generated_at?: string | null
          template_id?: string | null
          threshold?: number
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      doc_annotations: {
        Row: {
          content: string
          created_at: string | null
          doc_id: string | null
          id: string
          position: Json
          resolved: boolean | null
          tags: string[] | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          doc_id?: string | null
          id?: string
          position: Json
          resolved?: boolean | null
          tags?: string[] | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          doc_id?: string | null
          id?: string
          position?: Json
          resolved?: boolean | null
          tags?: string[] | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_annotations_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_embeddings: {
        Row: {
          chunk_index: number | null
          content: string
          created_at: string | null
          doc_id: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index?: number | null
          content: string
          created_at?: string | null
          doc_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number | null
          content?: string
          created_at?: string | null
          doc_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_embeddings_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_favorites: {
        Row: {
          created_at: string | null
          doc_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          doc_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          doc_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_favorites_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_highlights: {
        Row: {
          color: string | null
          created_at: string | null
          doc_id: string | null
          end_offset: number
          highlighted_text: string
          id: string
          note: string | null
          start_offset: number
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          doc_id?: string | null
          end_offset: number
          highlighted_text: string
          id?: string
          note?: string | null
          start_offset: number
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          doc_id?: string | null
          end_offset?: number
          highlighted_text?: string
          id?: string
          note?: string | null
          start_offset?: number
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_highlights_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_recent_views: {
        Row: {
          doc_id: string
          user_id: string
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          doc_id: string
          user_id: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          doc_id?: string
          user_id?: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_recent_views_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_tags: {
        Row: {
          created_at: string | null
          doc_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          doc_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          doc_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_tags_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "document_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_collections: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          rules: Json | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          rules?: Json | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          rules?: Json | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      document_shares: {
        Row: {
          created_at: string | null
          doc_id: string | null
          expires_at: string | null
          id: string
          message: string | null
          permissions: Json | null
          public_link: string | null
          shared_by: string | null
          shared_with_email: string | null
          shared_with_user: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          doc_id?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          permissions?: Json | null
          public_link?: string | null
          shared_by?: string | null
          shared_with_email?: string | null
          shared_with_user?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          doc_id?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          permissions?: Json | null
          public_link?: string | null
          shared_by?: string | null
          shared_with_email?: string | null
          shared_with_user?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      duplicate_contacts: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          match_confidence: number | null
          match_reasons: Json | null
          merged_into_id: string | null
          profile_id: string | null
          reviewed_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          match_confidence?: number | null
          match_reasons?: Json | null
          merged_into_id?: string | null
          profile_id?: string | null
          reviewed_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          match_confidence?: number | null
          match_reasons?: Json | null
          merged_into_id?: string | null
          profile_id?: string | null
          reviewed_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_contacts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "relationship_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "relationship_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          direction: string
          error_message: string | null
          event_row_id: string
          event_type: string
          id: string
          payload: Json | null
          retry_count: number | null
          source: string
          target_app: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          direction: string
          error_message?: string | null
          event_row_id: string
          event_type: string
          id?: string
          payload?: Json | null
          retry_count?: number | null
          source: string
          target_app?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          event_row_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          retry_count?: number | null
          source?: string
          target_app?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_alerts_event_row_id_fkey"
            columns: ["event_row_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_bot_channels: {
        Row: {
          bot_app: string
          channel_id: string
          channel_purpose: string
          created_at: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          bot_app: string
          channel_id: string
          channel_purpose: string
          created_at?: string | null
          id?: string
          workspace_id: string
        }
        Update: {
          bot_app?: string
          channel_id?: string
          channel_purpose?: string
          created_at?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_bot_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "message_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_bot_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_config: {
        Row: {
          api_url: string
          app_name: string
          bot_url: string | null
          created_at: string | null
          enabled: boolean | null
          features: Json | null
          id: string
          inbound_token: string
          last_heartbeat: string | null
          service_token: string
          updated_at: string | null
        }
        Insert: {
          api_url: string
          app_name: string
          bot_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          features?: Json | null
          id?: string
          inbound_token: string
          last_heartbeat?: string | null
          service_token: string
          updated_at?: string | null
        }
        Update: {
          api_url?: string
          app_name?: string
          bot_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          features?: Json | null
          id?: string
          inbound_token?: string
          last_heartbeat?: string | null
          service_token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ecosystem_entity_map: {
        Row: {
          created_at: string | null
          id: string
          local_entity_id: string
          local_entity_type: string
          remote_app: string
          remote_entity_id: string
          remote_entity_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          local_entity_id: string
          local_entity_type: string
          remote_app: string
          remote_entity_id: string
          remote_entity_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          local_entity_id?: string
          local_entity_type?: string
          remote_app?: string
          remote_entity_id?: string
          remote_entity_type?: string
        }
        Relationships: []
      }
      ecosystem_events: {
        Row: {
          created_at: string | null
          direction: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processing_time_ms: number | null
          source: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          direction: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processing_time_ms?: number | null
          source: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processing_time_ms?: number | null
          source?: string
          status?: string | null
        }
        Relationships: []
      }
      ecosystem_inbound_diagnostics: {
        Row: {
          auth_prefix: string | null
          created_at: string
          event_id: string | null
          has_apikey: boolean | null
          has_auth: boolean | null
          has_token: boolean | null
          id: number
          matched_app: string | null
          outcome: string | null
          source: string | null
          token_prefix: string | null
        }
        Insert: {
          auth_prefix?: string | null
          created_at?: string
          event_id?: string | null
          has_apikey?: boolean | null
          has_auth?: boolean | null
          has_token?: boolean | null
          id?: number
          matched_app?: string | null
          outcome?: string | null
          source?: string | null
          token_prefix?: string | null
        }
        Update: {
          auth_prefix?: string | null
          created_at?: string
          event_id?: string | null
          has_apikey?: boolean | null
          has_auth?: boolean | null
          has_token?: boolean | null
          id?: number
          matched_app?: string | null
          outcome?: string | null
          source?: string | null
          token_prefix?: string | null
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          email_address: string
          id: string
          integration_id: string | null
          is_primary: boolean | null
          last_sync_at: string | null
          provider: string
          sync_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_address: string
          id?: string
          integration_id?: string | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          provider?: string
          sync_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_address?: string
          id?: string
          integration_id?: string | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          provider?: string
          sync_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          from_email: string | null
          from_name: string | null
          id: string
          name: string
          preview_text: string | null
          reply_to: string | null
          schedule_at: string | null
          segment_id: string | null
          segment_name: string
          sent_at: string | null
          stats: Json
          status: string
          subject: string | null
          subject_b: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          name: string
          preview_text?: string | null
          reply_to?: string | null
          schedule_at?: string | null
          segment_id?: string | null
          segment_name?: string
          sent_at?: string | null
          stats?: Json
          status?: string
          subject?: string | null
          subject_b?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          name?: string
          preview_text?: string | null
          reply_to?: string | null
          schedule_at?: string | null
          segment_id?: string | null
          segment_name?: string
          sent_at?: string | null
          stats?: Json
          status?: string
          subject?: string | null
          subject_b?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "email_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_contacts: {
        Row: {
          ai_communication_style: string | null
          ai_notes: string | null
          ai_relationship_type: string | null
          avatar_url: string | null
          avg_response_time_hours: number | null
          company: string | null
          created_at: string | null
          custom_notes: string | null
          email: string
          email_count_from_them: number | null
          email_count_to_them: number | null
          email_count_total: number | null
          first_contacted_at: string | null
          id: string
          is_blocked: boolean | null
          is_important: boolean | null
          last_contacted_at: string | null
          last_email_from_them: string | null
          last_email_to_them: string | null
          name: string | null
          phone: string | null
          relationship_strength: number | null
          response_rate: number | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_communication_style?: string | null
          ai_notes?: string | null
          ai_relationship_type?: string | null
          avatar_url?: string | null
          avg_response_time_hours?: number | null
          company?: string | null
          created_at?: string | null
          custom_notes?: string | null
          email: string
          email_count_from_them?: number | null
          email_count_to_them?: number | null
          email_count_total?: number | null
          first_contacted_at?: string | null
          id?: string
          is_blocked?: boolean | null
          is_important?: boolean | null
          last_contacted_at?: string | null
          last_email_from_them?: string | null
          last_email_to_them?: string | null
          name?: string | null
          phone?: string | null
          relationship_strength?: number | null
          response_rate?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_communication_style?: string | null
          ai_notes?: string | null
          ai_relationship_type?: string | null
          avatar_url?: string | null
          avg_response_time_hours?: number | null
          company?: string | null
          created_at?: string | null
          custom_notes?: string | null
          email?: string
          email_count_from_them?: number | null
          email_count_to_them?: number | null
          email_count_total?: number | null
          first_contacted_at?: string | null
          id?: string
          is_blocked?: boolean | null
          is_important?: boolean | null
          last_contacted_at?: string | null
          last_email_from_them?: string | null
          last_email_to_them?: string | null
          name?: string | null
          phone?: string | null
          relationship_strength?: number | null
          response_rate?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_daily_briefings: {
        Row: {
          ai_summary: string | null
          briefing_date: string
          computed_at: string | null
          follow_ups_needed_count: number | null
          id: string
          meeting_requests_count: number | null
          new_email_count: number | null
          priority_emails: Json | null
          urgent_count: number | null
          user_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          briefing_date: string
          computed_at?: string | null
          follow_ups_needed_count?: number | null
          id?: string
          meeting_requests_count?: number | null
          new_email_count?: number | null
          priority_emails?: Json | null
          urgent_count?: number | null
          user_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          briefing_date?: string
          computed_at?: string | null
          follow_ups_needed_count?: number | null
          id?: string
          meeting_requests_count?: number | null
          new_email_count?: number | null
          priority_emails?: Json | null
          urgent_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_filters: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          emails_processed: number | null
          enabled: boolean | null
          execution_order: number | null
          id: string
          last_applied_at: string | null
          match_type: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          emails_processed?: number | null
          enabled?: boolean | null
          execution_order?: number | null
          id?: string
          last_applied_at?: string | null
          match_type: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          emails_processed?: number | null
          enabled?: boolean | null
          execution_order?: number | null
          id?: string
          last_applied_at?: string | null
          match_type?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_follow_ups: {
        Row: {
          ai_follow_up_draft: string | null
          completed_at: string | null
          created_at: string | null
          days_waiting: number | null
          email_id: string | null
          follow_up_reason: string | null
          id: string
          status: string | null
          suggested_follow_up_date: string | null
          thread_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_follow_up_draft?: string | null
          completed_at?: string | null
          created_at?: string | null
          days_waiting?: number | null
          email_id?: string | null
          follow_up_reason?: string | null
          id?: string
          status?: string | null
          suggested_follow_up_date?: string | null
          thread_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_follow_up_draft?: string | null
          completed_at?: string | null
          created_at?: string | null
          days_waiting?: number | null
          email_id?: string | null
          follow_up_reason?: string | null
          id?: string
          status?: string | null
          suggested_follow_up_date?: string | null
          thread_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_follow_ups_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "cached_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_labels: {
        Row: {
          applied_at: string
          email_id: string
          label_id: string
        }
        Insert: {
          applied_at?: string
          email_id: string
          label_id: string
        }
        Update: {
          applied_at?: string
          email_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "custom_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      email_segments: {
        Row: {
          contact_count: number
          created_at: string
          description: string | null
          filter_rules: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_count?: number
          created_at?: string
          description?: string | null
          filter_rules?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_count?: number
          created_at?: string
          description?: string | null
          filter_rules?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_sync_state: {
        Row: {
          created_at: string | null
          error_count: number | null
          history_id: string | null
          id: string
          last_error: string | null
          last_full_sync_at: string | null
          last_incremental_sync_at: string | null
          sync_status: string | null
          total_emails_cached: number | null
          total_threads_cached: number | null
          updated_at: string | null
          user_id: string | null
          watch_expiration: string | null
          watch_history_id: string | null
          watch_last_renewed: string | null
          watch_topic: string | null
        }
        Insert: {
          created_at?: string | null
          error_count?: number | null
          history_id?: string | null
          id?: string
          last_error?: string | null
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          sync_status?: string | null
          total_emails_cached?: number | null
          total_threads_cached?: number | null
          updated_at?: string | null
          user_id?: string | null
          watch_expiration?: string | null
          watch_history_id?: string | null
          watch_last_renewed?: string | null
          watch_topic?: string | null
        }
        Update: {
          created_at?: string | null
          error_count?: number | null
          history_id?: string | null
          id?: string
          last_error?: string | null
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          sync_status?: string | null
          total_emails_cached?: number | null
          total_threads_cached?: number | null
          updated_at?: string | null
          user_id?: string | null
          watch_expiration?: string | null
          watch_history_id?: string | null
          watch_last_renewed?: string | null
          watch_topic?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string | null
          body_html: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          is_shared: boolean | null
          last_used_at: string | null
          name: string
          subject: string | null
          updated_at: string | null
          use_count: number | null
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          body?: string | null
          body_html?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          is_shared?: boolean | null
          last_used_at?: string | null
          name: string
          subject?: string | null
          updated_at?: string | null
          use_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string | null
          body_html?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          is_shared?: boolean | null
          last_used_at?: string | null
          name?: string
          subject?: string | null
          updated_at?: string | null
          use_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          ai_thread_status: string | null
          ai_thread_summary: string | null
          created_at: string | null
          first_message_at: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          participant_emails: Json | null
          participant_names: Json | null
          subject: string | null
          unread_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_thread_status?: string | null
          ai_thread_summary?: string | null
          created_at?: string | null
          first_message_at?: string | null
          id: string
          last_message_at?: string | null
          message_count?: number | null
          participant_emails?: Json | null
          participant_names?: Json | null
          subject?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_thread_status?: string | null
          ai_thread_summary?: string | null
          created_at?: string | null
          first_message_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          participant_emails?: Json | null
          participant_names?: Json | null
          subject?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          attachments: Json | null
          body: string | null
          cc_addresses: string[] | null
          created_at: string
          date: string
          external_id: string | null
          folder: string
          from_address: string
          id: string
          labels: string[] | null
          provider: string
          read: boolean
          search_vector: unknown
          snippet: string | null
          subject: string
          thread_id: string | null
          to_addresses: string[] | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          body?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          date?: string
          external_id?: string | null
          folder?: string
          from_address: string
          id?: string
          labels?: string[] | null
          provider?: string
          read?: boolean
          search_vector?: unknown
          snippet?: string | null
          subject: string
          thread_id?: string | null
          to_addresses?: string[] | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string | null
          cc_addresses?: string[] | null
          created_at?: string
          date?: string
          external_id?: string | null
          folder?: string
          from_address?: string
          id?: string
          labels?: string[] | null
          provider?: string
          read?: boolean
          search_vector?: unknown
          snippet?: string | null
          subject?: string
          thread_id?: string | null
          to_addresses?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          content_type: string
          created_at: string | null
          embedding: string | null
          id: string
          source_id: string
          source_type: string
          text_content: string | null
          updated_at: string | null
        }
        Insert: {
          content_type: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          source_id: string
          source_type: string
          text_content?: string | null
          updated_at?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          source_id?: string
          source_type?: string
          text_content?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          apps: Json | null
          features: Json | null
          is_trialing: boolean | null
          max_ai_messages_mo: number | null
          max_contacts: number | null
          max_integrations: number | null
          max_pipelines: number | null
          max_sms_mo: number | null
          max_storage_bytes: number | null
          max_summit_minutes_mo: number | null
          max_summit_session_sec: number | null
          max_users: number | null
          max_voxer_minutes_mo: number | null
          max_workflow_runs_mo: number | null
          max_workflows: number | null
          trial_ends_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          apps?: Json | null
          features?: Json | null
          is_trialing?: boolean | null
          max_ai_messages_mo?: number | null
          max_contacts?: number | null
          max_integrations?: number | null
          max_pipelines?: number | null
          max_sms_mo?: number | null
          max_storage_bytes?: number | null
          max_summit_minutes_mo?: number | null
          max_summit_session_sec?: number | null
          max_users?: number | null
          max_voxer_minutes_mo?: number | null
          max_workflow_runs_mo?: number | null
          max_workflows?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          apps?: Json | null
          features?: Json | null
          is_trialing?: boolean | null
          max_ai_messages_mo?: number | null
          max_contacts?: number | null
          max_integrations?: number | null
          max_pipelines?: number | null
          max_sms_mo?: number | null
          max_storage_bytes?: number | null
          max_summit_minutes_mo?: number | null
          max_summit_session_sec?: number | null
          max_users?: number | null
          max_voxer_minutes_mo?: number | null
          max_workflow_runs_mo?: number | null
          max_workflows?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_places: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          place_id: string
          role: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          place_id: string
          role?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          place_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      entomate_action_items: {
        Row: {
          assigned_to_email: string | null
          assigned_to_name: string | null
          assigned_to_user_id: string | null
          created_at: string | null
          crm_sync_status: string | null
          crm_task_id: string | null
          due_date: string | null
          id: string
          meeting_id: string | null
          priority: string | null
          pulse_task_id: string | null
          status: string | null
          task_description: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          created_at?: string | null
          crm_sync_status?: string | null
          crm_task_id?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          priority?: string | null
          pulse_task_id?: string | null
          status?: string | null
          task_description: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          created_at?: string | null
          crm_sync_status?: string | null
          crm_task_id?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          priority?: string | null
          pulse_task_id?: string | null
          status?: string | null
          task_description?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entomate_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "entomate_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      entomate_automation_logs: {
        Row: {
          automation_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          result: Json | null
          status: string
          trigger_data: Json | null
        }
        Insert: {
          automation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          result?: Json | null
          status: string
          trigger_data?: Json | null
        }
        Update: {
          automation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          result?: Json | null
          status?: string
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "entomate_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "entomate_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      entomate_automations: {
        Row: {
          actions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          run_count: number | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          run_count?: number | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          run_count?: number | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      entomate_meetings: {
        Row: {
          attendees: Json | null
          audio_file_url: string | null
          created_at: string | null
          created_by: string | null
          crm_deal_id: string | null
          decisions: Json | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          key_points: Json | null
          pulse_channel_id: string | null
          sentiment_label: string | null
          sentiment_score: number | null
          start_time: string | null
          summary: string | null
          title: string
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          attendees?: Json | null
          audio_file_url?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_deal_id?: string | null
          decisions?: Json | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          key_points?: Json | null
          pulse_channel_id?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          start_time?: string | null
          summary?: string | null
          title: string
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          attendees?: Json | null
          audio_file_url?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_deal_id?: string | null
          decisions?: Json | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          key_points?: Json | null
          pulse_channel_id?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          start_time?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      entomate_project_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string | null
          priority: string | null
          project_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entomate_project_tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "entomate_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entomate_project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "entomate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entomate_projects: {
        Row: {
          created_at: string | null
          crm_deal_id: string | null
          deal_value: number | null
          description: string | null
          end_date: string | null
          id: string
          logos_project_id: string | null
          name: string
          owner_id: string | null
          start_date: string | null
          status: string | null
          team_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_deal_id?: string | null
          deal_value?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          logos_project_id?: string | null
          name: string
          owner_id?: string | null
          start_date?: string | null
          status?: string | null
          team_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_deal_id?: string | null
          deal_value?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          logos_project_id?: string | null
          name?: string
          owner_id?: string | null
          start_date?: string | null
          status?: string | null
          team_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ephemeral_workspaces: {
        Row: {
          created_at: string | null
          created_by: string
          duration_minutes: number
          expires_at: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          outcome_description: string | null
          outcome_progress: number | null
          outcome_status: string | null
          outcome_target_date: string | null
          outcome_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          duration_minutes: number
          expires_at: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          outcome_description?: string | null
          outcome_progress?: number | null
          outcome_status?: string | null
          outcome_target_date?: string | null
          outcome_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          duration_minutes?: number
          expires_at?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          outcome_description?: string | null
          outcome_progress?: number | null
          outcome_status?: string | null
          outcome_target_date?: string | null
          outcome_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      eta_shares: {
        Row: {
          created_at: string
          destination_label: string | null
          destination_lat: number
          destination_lng: number
          ended_at: string | null
          expires_at: string
          id: string
          last_distance_m: number | null
          last_eta_seconds: number | null
          last_lat: number | null
          last_lng: number | null
          last_updated_at: string | null
          recipient_contact_id: string | null
          recipient_label: string | null
          started_at: string
          status: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_label?: string | null
          destination_lat: number
          destination_lng: number
          ended_at?: string | null
          expires_at: string
          id?: string
          last_distance_m?: number | null
          last_eta_seconds?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_updated_at?: string | null
          recipient_contact_id?: string | null
          recipient_label?: string | null
          started_at?: string
          status?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination_label?: string | null
          destination_lat?: number
          destination_lng?: number
          ended_at?: string | null
          expires_at?: string
          id?: string
          last_distance_m?: number | null
          last_eta_seconds?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_updated_at?: string | null
          recipient_contact_id?: string | null
          recipient_label?: string | null
          started_at?: string
          status?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      event_comments: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          event_id: string
          id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id: string
          id?: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id?: string
          id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "event_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvp: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          name: string | null
          notes: string | null
          responded_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          name?: string | null
          notes?: string | null
          responded_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          name?: string | null
          notes?: string | null
          responded_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvp_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          download_url: string | null
          error_message: string | null
          file_size: number | null
          format: string
          id: string
          name: string
          options: Json | null
          progress: number | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          download_url?: string | null
          error_message?: string | null
          file_size?: number | null
          format: string
          id?: string
          name: string
          options?: Json | null
          progress?: number | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          download_url?: string | null
          error_message?: string | null
          file_size?: number | null
          format?: string
          id?: string
          name?: string
          options?: Json | null
          progress?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      extracted_tasks: {
        Row: {
          archived_at: string | null
          assignee_id: string | null
          blocked_at: string | null
          blocked_reason: string | null
          completed_at: string | null
          deadline: string | null
          description: string | null
          extracted_at: string | null
          id: string
          metadata: Json | null
          origin_message_id: string | null
          priority: string | null
          recurrence_parent_id: string | null
          recurrence_rule: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          assignee_id?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          deadline?: string | null
          description?: string | null
          extracted_at?: string | null
          id?: string
          metadata?: Json | null
          origin_message_id?: string | null
          priority?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          assignee_id?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          deadline?: string | null
          description?: string | null
          extracted_at?: string | null
          id?: string
          metadata?: Json | null
          origin_message_id?: string | null
          priority?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      file_uploads: {
        Row: {
          created_at: string | null
          file_category: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          message_id: string | null
          metadata: Json | null
          public_url: string | null
          thread_id: string | null
          thumbnail_url: string | null
          uploaded_at: string | null
          user_id: string | null
          virus_scan_result: Json | null
          virus_scan_status: string | null
        }
        Insert: {
          created_at?: string | null
          file_category?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          public_url?: string | null
          thread_id?: string | null
          thumbnail_url?: string | null
          uploaded_at?: string | null
          user_id?: string | null
          virus_scan_result?: Json | null
          virus_scan_status?: string | null
        }
        Update: {
          created_at?: string | null
          file_category?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          public_url?: string | null
          thread_id?: string | null
          thumbnail_url?: string | null
          uploaded_at?: string | null
          user_id?: string | null
          virus_scan_result?: Json | null
          virus_scan_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_uploads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_uploads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_execution_log: {
        Row: {
          actions_applied: Json | null
          email_id: string
          error_message: string | null
          executed_at: string
          execution_time_ms: number | null
          filter_id: string
          id: string
          matched: boolean
        }
        Insert: {
          actions_applied?: Json | null
          email_id: string
          error_message?: string | null
          executed_at?: string
          execution_time_ms?: number | null
          filter_id: string
          id?: string
          matched: boolean
        }
        Update: {
          actions_applied?: Json | null
          email_id?: string
          error_message?: string | null
          executed_at?: string
          execution_time_ms?: number | null
          filter_id?: string
          id?: string
          matched?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "filter_execution_log_filter_id_fkey"
            columns: ["filter_id"]
            isOneToOne: false
            referencedRelation: "email_filters"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          actual_duration_minutes: number | null
          break_count: number
          created_at: string | null
          ended_at: string | null
          id: string
          interruption_count: number | null
          planned_duration_minutes: number
          started_at: string
          status: string
          thread_id: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          break_count?: number
          created_at?: string | null
          ended_at?: string | null
          id?: string
          interruption_count?: number | null
          planned_duration_minutes?: number
          started_at?: string
          status?: string
          thread_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_duration_minutes?: number | null
          break_count?: number
          created_at?: string | null
          ended_at?: string | null
          id?: string
          interruption_count?: number | null
          planned_duration_minutes?: number
          started_at?: string
          status?: string
          thread_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gemini_rate_limits: {
        Row: {
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          request_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      geofence_events: {
        Row: {
          accuracy_m: number | null
          distance_m: number
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          lat: number
          lng: number
          occurred_at: string
          payload: Json
          place_id: string
          surfaced: boolean
          surfaced_at: string | null
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          distance_m: number
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          lat: number
          lng: number
          occurred_at?: string
          payload?: Json
          place_id: string
          surfaced?: boolean
          surfaced_at?: string | null
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          distance_m?: number
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          lat?: number
          lng?: number
          occurred_at?: string
          payload?: Json
          place_id?: string
          surfaced?: boolean
          surfaced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          description: string | null
          goal_type: string
          id: string
          key_results: Json | null
          owner_id: string | null
          parent_goal_id: string | null
          progress: number | null
          quarter: string | null
          related_tasks: string[] | null
          start_date: string | null
          status: string | null
          target_date: string | null
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          goal_type: string
          id?: string
          key_results?: Json | null
          owner_id?: string | null
          parent_goal_id?: string | null
          progress?: number | null
          quarter?: string | null
          related_tasks?: string[] | null
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          team_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          key_results?: Json | null
          owner_id?: string | null
          parent_goal_id?: string | null
          progress?: number | null
          quarter?: string | null
          related_tasks?: string[] | null
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      google_contacts_auto_sync_config: {
        Row: {
          auto_label_enabled: boolean | null
          created_at: string
          enabled: boolean
          id: string
          interval_hours: number
          last_sync_at: string | null
          logos_vision_label_resource_name: string | null
          next_sync_at: string | null
          sync_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_label_enabled?: boolean | null
          created_at?: string
          enabled?: boolean
          id?: string
          interval_hours?: number
          last_sync_at?: string | null
          logos_vision_label_resource_name?: string | null
          next_sync_at?: string | null
          sync_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_label_enabled?: boolean | null
          created_at?: string
          enabled?: boolean
          id?: string
          interval_hours?: number
          last_sync_at?: string | null
          logos_vision_label_resource_name?: string | null
          next_sync_at?: string | null
          sync_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_contacts_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          domain: string | null
          error_details: Json | null
          error_message: string | null
          failed: number | null
          failed_database_error: number | null
          filter: Json | null
          id: string
          label: string | null
          skipped: number | null
          skipped_duplicate: number | null
          skipped_no_identifier: number | null
          started_at: string | null
          status: string
          sync_results: Json | null
          sync_type: string
          synced: number | null
          total_contacts: number | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          domain?: string | null
          error_details?: Json | null
          error_message?: string | null
          failed?: number | null
          failed_database_error?: number | null
          filter?: Json | null
          id?: string
          label?: string | null
          skipped?: number | null
          skipped_duplicate?: number | null
          skipped_no_identifier?: number | null
          started_at?: string | null
          status?: string
          sync_results?: Json | null
          sync_type?: string
          synced?: number | null
          total_contacts?: number | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          domain?: string | null
          error_details?: Json | null
          error_message?: string | null
          failed?: number | null
          failed_database_error?: number | null
          filter?: Json | null
          id?: string
          label?: string | null
          skipped?: number | null
          skipped_duplicate?: number | null
          skipped_no_identifier?: number | null
          started_at?: string | null
          status?: string
          sync_results?: Json | null
          sync_type?: string
          synced?: number | null
          total_contacts?: number | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expiry_date: number | null
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expiry_date?: number | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expiry_date?: number | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_grants: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          permission_key: string
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          permission_key: string
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          permission_key?: string
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_grants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "workspace_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_grants_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      hot_topics: {
        Row: {
          avg_severity: number | null
          avoidance_recommended: boolean | null
          communication_tip: string | null
          conflict_count: number | null
          contact_identifier: string
          created_at: string | null
          id: string
          last_conflict_at: string | null
          topic: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_severity?: number | null
          avoidance_recommended?: boolean | null
          communication_tip?: string | null
          conflict_count?: number | null
          contact_identifier: string
          created_at?: string | null
          id?: string
          last_conflict_at?: string | null
          topic: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_severity?: number | null
          avoidance_recommended?: boolean | null
          communication_tip?: string | null
          conflict_count?: number | null
          contact_identifier?: string
          created_at?: string | null
          id?: string
          last_conflict_at?: string | null
          topic?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      in_app_messages: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          custom_segment_query: Json | null
          display_duration_seconds: number | null
          ends_at: string | null
          event_trigger: string
          id: string
          is_active: boolean | null
          position: string | null
          priority: number | null
          recurring_schedule: string | null
          segment: string
          starts_at: string | null
          style_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          custom_segment_query?: Json | null
          display_duration_seconds?: number | null
          ends_at?: string | null
          event_trigger: string
          id?: string
          is_active?: boolean | null
          position?: string | null
          priority?: number | null
          recurring_schedule?: string | null
          segment?: string
          starts_at?: string | null
          style_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          custom_segment_query?: Json | null
          display_duration_seconds?: number | null
          ends_at?: string | null
          event_trigger?: string
          id?: string
          is_active?: boolean | null
          position?: string | null
          priority?: number | null
          recurring_schedule?: string | null
          segment?: string
          starts_at?: string | null
          style_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      integration_field_mappings: {
        Row: {
          created_at: string
          direction: string
          entity_type: string
          external_field: string
          id: string
          integration_id: string
          internal_field: string
          is_active: boolean
          transform: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          entity_type: string
          external_field: string
          id?: string
          integration_id: string
          internal_field: string
          is_active?: boolean
          transform?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          entity_type?: string
          external_field?: string
          id?: string
          integration_id?: string
          internal_field?: string
          is_active?: boolean
          transform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string | null
          destination_id: string | null
          destination_type: string | null
          error_message: string | null
          id: string
          next_retry_at: string | null
          retry_count: number | null
          source_id: string | null
          source_type: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          destination_id?: string | null
          destination_type?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          retry_count?: number | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          destination_id?: string | null
          destination_type?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          retry_count?: number | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      integration_sync_logs: {
        Row: {
          completed_at: string | null
          direction: string
          entity_type: string | null
          error_details: Json | null
          id: string
          integration_id: string
          records_failed: number
          records_processed: number
          records_succeeded: number
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          direction: string
          entity_type?: string | null
          error_details?: Json | null
          id?: string
          integration_id: string
          records_failed?: number
          records_processed?: number
          records_succeeded?: number
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          direction?: string
          entity_type?: string | null
          error_details?: Json | null
          id?: string
          integration_id?: string
          records_failed?: number
          records_processed?: number
          records_succeeded?: number
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          config: Json
          created_at: string
          display_name: string
          error_count: number
          id: string
          integration_type: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          config?: Json
          created_at?: string
          display_name: string
          error_count?: number
          id?: string
          integration_type: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          config?: Json
          created_at?: string
          display_name?: string
          error_count?: number
          id?: string
          integration_type?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string | null
          currency: string | null
          id: string
          invoice_pdf: string | null
          invoice_url: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string
          workspace_id: string
        }
        Insert: {
          amount_due: number
          amount_paid: number
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_pdf?: string | null
          invoice_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status: string
          stripe_invoice_id: string
          workspace_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_pdf?: string | null
          invoice_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          created_at: string
          current_value: number
          id: string
          outcome_id: string
          target_value: number
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          outcome_id: string
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          outcome_id?: string
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_docs: {
        Row: {
          ai_keywords: string[] | null
          ai_summary: string | null
          content: string | null
          created_at: string | null
          file_type: string | null
          id: string
          is_processed: boolean | null
          is_shared: boolean | null
          metadata: Json | null
          original_name: string | null
          processing_status: string | null
          source_type: string | null
          summary: string | null
          text_content: string | null
          title: string
          updated_at: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          ai_keywords?: string[] | null
          ai_summary?: string | null
          content?: string | null
          created_at?: string | null
          file_type?: string | null
          id?: string
          is_processed?: boolean | null
          is_shared?: boolean | null
          metadata?: Json | null
          original_name?: string | null
          processing_status?: string | null
          source_type?: string | null
          summary?: string | null
          text_content?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          ai_keywords?: string[] | null
          ai_summary?: string | null
          content?: string | null
          created_at?: string | null
          file_type?: string | null
          id?: string
          is_processed?: boolean | null
          is_shared?: boolean | null
          metadata?: Json | null
          original_name?: string | null
          processing_status?: string | null
          source_type?: string | null
          summary?: string | null
          text_content?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_docs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scores: {
        Row: {
          ai_best_contact_time: string | null
          ai_churn_risk: number | null
          ai_conversion_probability: number | null
          ai_next_action_prediction: string | null
          ai_predicted_value: number | null
          behavior_score: number | null
          buying_signal_count: number | null
          buying_signals: Json | null
          created_at: string | null
          engagement_score: number | null
          estimated_value: number | null
          expected_close_date: string | null
          frequency_score: number | null
          id: string
          last_buying_signal_at: string | null
          last_scored_at: string | null
          lead_grade: string | null
          lead_score: number | null
          lead_status: string | null
          pipeline_stage: string | null
          pipeline_stage_changed_at: string | null
          probability: number | null
          profile_id: string | null
          recency_score: number | null
          score_breakdown: Json | null
          score_history: Json | null
          sentiment_score: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_best_contact_time?: string | null
          ai_churn_risk?: number | null
          ai_conversion_probability?: number | null
          ai_next_action_prediction?: string | null
          ai_predicted_value?: number | null
          behavior_score?: number | null
          buying_signal_count?: number | null
          buying_signals?: Json | null
          created_at?: string | null
          engagement_score?: number | null
          estimated_value?: number | null
          expected_close_date?: string | null
          frequency_score?: number | null
          id?: string
          last_buying_signal_at?: string | null
          last_scored_at?: string | null
          lead_grade?: string | null
          lead_score?: number | null
          lead_status?: string | null
          pipeline_stage?: string | null
          pipeline_stage_changed_at?: string | null
          probability?: number | null
          profile_id?: string | null
          recency_score?: number | null
          score_breakdown?: Json | null
          score_history?: Json | null
          sentiment_score?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_best_contact_time?: string | null
          ai_churn_risk?: number | null
          ai_conversion_probability?: number | null
          ai_next_action_prediction?: string | null
          ai_predicted_value?: number | null
          behavior_score?: number | null
          buying_signal_count?: number | null
          buying_signals?: Json | null
          created_at?: string | null
          engagement_score?: number | null
          estimated_value?: number | null
          expected_close_date?: string | null
          frequency_score?: number | null
          id?: string
          last_buying_signal_at?: string | null
          last_scored_at?: string | null
          lead_grade?: string | null
          lead_score?: number | null
          lead_status?: string | null
          pipeline_stage?: string | null
          pipeline_stage_changed_at?: string | null
          probability?: number | null
          profile_id?: string | null
          recency_score?: number | null
          score_breakdown?: Json | null
          score_history?: Json | null
          sentiment_score?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "relationship_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      link_previews: {
        Row: {
          description: string | null
          expires_at: string
          fetched_at: string
          image_url: string | null
          og_type: string | null
          site_name: string | null
          status: string
          title: string | null
          url: string
          url_hash: string
        }
        Insert: {
          description?: string | null
          expires_at?: string
          fetched_at?: string
          image_url?: string | null
          og_type?: string | null
          site_name?: string | null
          status?: string
          title?: string | null
          url: string
          url_hash: string
        }
        Update: {
          description?: string | null
          expires_at?: string
          fetched_at?: string
          image_url?: string | null
          og_type?: string | null
          site_name?: string | null
          status?: string
          title?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      location_share_consents: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_granted: boolean
          share_level: string
          subject_user_id: string
          updated_at: string
          viewer_user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_granted?: boolean
          share_level?: string
          subject_user_id: string
          updated_at?: string
          viewer_user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_granted?: boolean
          share_level?: string
          subject_user_id?: string
          updated_at?: string
          viewer_user_id?: string
        }
        Relationships: []
      }
      logos_cases: {
        Row: {
          contact_id: string | null
          created_by: string | null
          custom_fields: Json | null
          description: string | null
          due_date: string | null
          external_id: string | null
          id: string
          priority: string | null
          project_id: string | null
          status: string | null
          synced_at: string | null
          title: string
        }
        Insert: {
          contact_id?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id: string
          priority?: string | null
          project_id?: string | null
          status?: string | null
          synced_at?: string | null
          title: string
        }
        Update: {
          contact_id?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          status?: string | null
          synced_at?: string | null
          title?: string
        }
        Relationships: []
      }
      logos_contacts: {
        Row: {
          company: string | null
          custom_fields: Json | null
          email: string | null
          external_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          status: string | null
          synced_at: string | null
          title: string | null
        }
        Insert: {
          company?: string | null
          custom_fields?: Json | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          status?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Update: {
          company?: string | null
          custom_fields?: Json | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          status?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      logos_notes: {
        Row: {
          attachments: Json | null
          case_id: string | null
          contact_id: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          project_id: string | null
          search_vector: unknown
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          case_id?: string | null
          contact_id?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id: string
          project_id?: string | null
          search_vector?: unknown
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          case_id?: string | null
          contact_id?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_id?: string | null
          search_vector?: unknown
          updated_at?: string | null
        }
        Relationships: []
      }
      logos_projects: {
        Row: {
          budget: number | null
          client_id: string | null
          client_name: string | null
          custom_fields: Json | null
          description: string | null
          due_date: string | null
          external_id: string | null
          id: string
          name: string
          owner_id: string | null
          owner_name: string | null
          start_date: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          budget?: number | null
          client_id?: string | null
          client_name?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id: string
          name: string
          owner_id?: string | null
          owner_name?: string | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          budget?: number | null
          client_id?: string | null
          client_name?: string | null
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      logos_pulse_activity: {
        Row: {
          activity_type: string | null
          description: string | null
          id: string
          logos_entity_id: string | null
          logos_entity_type: string | null
          logos_note_id: string | null
          performed_at: string | null
          performed_by: string | null
          pulse_channel_id: string | null
          pulse_message_id: string | null
          pulse_user_id: string | null
        }
        Insert: {
          activity_type?: string | null
          description?: string | null
          id: string
          logos_entity_id?: string | null
          logos_entity_type?: string | null
          logos_note_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          pulse_channel_id?: string | null
          pulse_message_id?: string | null
          pulse_user_id?: string | null
        }
        Update: {
          activity_type?: string | null
          description?: string | null
          id?: string
          logos_entity_id?: string | null
          logos_entity_type?: string | null
          logos_note_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          pulse_channel_id?: string | null
          pulse_message_id?: string | null
          pulse_user_id?: string | null
        }
        Relationships: []
      }
      logos_pulse_mappings: {
        Row: {
          created_at: string | null
          id: string
          last_sync_at: string | null
          logos_entity_id: string
          logos_entity_type: string
          pulse_entity_id: string
          pulse_entity_type: string
          sync_direction: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          last_sync_at?: string | null
          logos_entity_id: string
          logos_entity_type: string
          pulse_entity_id: string
          pulse_entity_type: string
          sync_direction?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          logos_entity_id?: string
          logos_entity_type?: string
          pulse_entity_id?: string
          pulse_entity_type?: string
          sync_direction?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      logos_sync_logs: {
        Row: {
          completed_at: string | null
          details: Json | null
          entity_type: string | null
          error_message: string | null
          id: string
          records_failed: number | null
          records_synced: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json | null
          entity_type?: string | null
          error_message?: string | null
          id: string
          records_failed?: number | null
          records_synced?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          details?: Json | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          records_failed?: number | null
          records_synced?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      logos_tasks: {
        Row: {
          assigned_to: string | null
          assigned_to_email: string | null
          case_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_email?: string | null
          case_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id: string
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          assigned_to_email?: string | null
          case_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_breakout_assignments: {
        Row: {
          created_at: string
          id: string
          participant_name: string | null
          participant_session_id: string
          participant_user_id: string | null
          session_id: string
          state: string
          sub_room_name: string
          sub_room_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_name?: string | null
          participant_session_id: string
          participant_user_id?: string | null
          session_id: string
          state?: string
          sub_room_name: string
          sub_room_url: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_name?: string | null
          participant_session_id?: string
          participant_user_id?: string | null
          session_id?: string
          state?: string
          sub_room_name?: string
          sub_room_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_breakout_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "meeting_breakout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_breakout_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          ends_at: string | null
          host_user_id: string
          id: string
          main_room_name: string
          status: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ends_at?: string | null
          host_user_id: string
          id?: string
          main_room_name: string
          status?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ends_at?: string | null
          host_user_id?: string
          id?: string
          main_room_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_breakout_sessions_main_room_name_fkey"
            columns: ["main_room_name"]
            isOneToOne: false
            referencedRelation: "pulse_video_rooms"
            referencedColumns: ["room_name"]
          },
        ]
      }
      meeting_prep_cards: {
        Row: {
          ai_follow_up_items: Json | null
          ai_meeting_purpose: string | null
          ai_questions_to_ask: Json | null
          ai_recent_context: string | null
          ai_relationship_notes: Json | null
          ai_summary: string | null
          ai_talking_points: Json | null
          ai_topics_to_avoid: Json | null
          attendee_count: number | null
          attendee_profiles: Json | null
          calendar_event_id: string
          event_description: string | null
          event_end: string | null
          event_location: string | null
          event_start: string
          event_title: string | null
          event_type: string | null
          generated_at: string | null
          id: string
          known_attendees: number | null
          open_action_items: Json | null
          recent_emails: Json | null
          recent_meetings: Json | null
          shared_files: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          user_notes: string | null
          user_objectives: Json | null
          viewed_at: string | null
        }
        Insert: {
          ai_follow_up_items?: Json | null
          ai_meeting_purpose?: string | null
          ai_questions_to_ask?: Json | null
          ai_recent_context?: string | null
          ai_relationship_notes?: Json | null
          ai_summary?: string | null
          ai_talking_points?: Json | null
          ai_topics_to_avoid?: Json | null
          attendee_count?: number | null
          attendee_profiles?: Json | null
          calendar_event_id: string
          event_description?: string | null
          event_end?: string | null
          event_location?: string | null
          event_start: string
          event_title?: string | null
          event_type?: string | null
          generated_at?: string | null
          id?: string
          known_attendees?: number | null
          open_action_items?: Json | null
          recent_emails?: Json | null
          recent_meetings?: Json | null
          shared_files?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_notes?: string | null
          user_objectives?: Json | null
          viewed_at?: string | null
        }
        Update: {
          ai_follow_up_items?: Json | null
          ai_meeting_purpose?: string | null
          ai_questions_to_ask?: Json | null
          ai_recent_context?: string | null
          ai_relationship_notes?: Json | null
          ai_summary?: string | null
          ai_talking_points?: Json | null
          ai_topics_to_avoid?: Json | null
          attendee_count?: number | null
          attendee_profiles?: Json | null
          calendar_event_id?: string
          event_description?: string | null
          event_end?: string | null
          event_location?: string | null
          event_start?: string
          event_title?: string | null
          event_type?: string | null
          generated_at?: string | null
          id?: string
          known_attendees?: number | null
          open_action_items?: Json | null
          recent_emails?: Json | null
          recent_meetings?: Json | null
          shared_files?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_notes?: string | null
          user_objectives?: Json | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          attendees: Json | null
          audio_file_url: string | null
          created_at: string | null
          created_by: string | null
          crm_deal_id: string | null
          decisions: Json | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          key_points: Json | null
          project_id: string | null
          sentiment_label: string | null
          sentiment_score: number | null
          start_time: string | null
          summary: string | null
          title: string
          topics: Json | null
          transcript: string | null
          transcript_embedding: string | null
          updated_at: string | null
        }
        Insert: {
          attendees?: Json | null
          audio_file_url?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_deal_id?: string | null
          decisions?: Json | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          key_points?: Json | null
          project_id?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          start_time?: string | null
          summary?: string | null
          title: string
          topics?: Json | null
          transcript?: string | null
          transcript_embedding?: string | null
          updated_at?: string | null
        }
        Update: {
          attendees?: Json | null
          audio_file_url?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_deal_id?: string | null
          decisions?: Json | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          key_points?: Json | null
          project_id?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          start_time?: string | null
          summary?: string | null
          title?: string
          topics?: Json | null
          transcript?: string | null
          transcript_embedding?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_annotations: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: string[]
          message_id: string
          parent_id: string | null
          resolved: boolean
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: string[]
          message_id: string
          parent_id?: string | null
          resolved?: boolean
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: string[]
          message_id?: string
          parent_id?: string | null
          resolved?: boolean
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_annotations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "pulse_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_annotations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "message_annotations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_auto_response_log: {
        Row: {
          ai_customized: boolean | null
          channel_id: string
          id: string
          message_id: string
          response_sent: string
          rule_id: string | null
          sender_id: string
          triggered_at: string | null
        }
        Insert: {
          ai_customized?: boolean | null
          channel_id: string
          id?: string
          message_id: string
          response_sent: string
          rule_id?: string | null
          sender_id: string
          triggered_at?: string | null
        }
        Update: {
          ai_customized?: boolean | null
          channel_id?: string
          id?: string
          message_id?: string
          response_sent?: string
          rule_id?: string | null
          sender_id?: string
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_auto_response_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "message_auto_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      message_auto_responses: {
        Row: {
          ai_customize: boolean | null
          created_at: string | null
          enabled: boolean | null
          id: string
          last_triggered_at: string | null
          priority: number | null
          response_template: string
          rule_type: string
          times_triggered: number | null
          trigger_conditions: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_customize?: boolean | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered_at?: string | null
          priority?: number | null
          response_template: string
          rule_type: string
          times_triggered?: number | null
          trigger_conditions?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_customize?: boolean | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered_at?: string | null
          priority?: number | null
          response_template?: string
          rule_type?: string
          times_triggered?: number | null
          trigger_conditions?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      message_bookmarks: {
        Row: {
          collection: string | null
          created_at: string
          id: string
          message_id: string
          note: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          collection?: string | null
          created_at?: string
          id?: string
          message_id: string
          note?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          collection?: string | null
          created_at?: string
          id?: string
          message_id?: string
          note?: string | null
          tags?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "pulse_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_channels: {
        Row: {
          bot_app: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_bot_channel: boolean | null
          is_group: boolean | null
          is_public: boolean | null
          name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          bot_app?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_bot_channel?: boolean | null
          is_group?: boolean | null
          is_public?: boolean | null
          name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          bot_app?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_bot_channel?: boolean | null
          is_group?: boolean | null
          is_public?: boolean | null
          name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      message_drafts: {
        Row: {
          channel_id: string
          content: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_drafts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "message_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_highlights: {
        Row: {
          color: string
          created_at: string
          highlighted: string
          id: string
          label: string | null
          message_id: string
          range_end: number
          range_start: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          highlighted: string
          id?: string
          label?: string | null
          message_id: string
          range_end: number
          range_start: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          highlighted?: string
          id?: string
          label?: string | null
          message_id?: string
          range_end?: number
          range_start?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_highlights_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "pulse_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_impact: {
        Row: {
          actions_generated: number | null
          calculated_at: string | null
          conversation_id: string
          cross_channel_mentions: number | null
          decisions_generated: number | null
          engagement_rate: number | null
          id: string
          immediate_readers: number | null
          impact_score: number | null
          message_id: string
          referenced_count: number | null
          total_readers: number | null
        }
        Insert: {
          actions_generated?: number | null
          calculated_at?: string | null
          conversation_id: string
          cross_channel_mentions?: number | null
          decisions_generated?: number | null
          engagement_rate?: number | null
          id?: string
          immediate_readers?: number | null
          impact_score?: number | null
          message_id: string
          referenced_count?: number | null
          total_readers?: number | null
        }
        Update: {
          actions_generated?: number | null
          calculated_at?: string | null
          conversation_id?: string
          cross_channel_mentions?: number | null
          decisions_generated?: number | null
          engagement_rate?: number | null
          id?: string
          immediate_readers?: number | null
          impact_score?: number | null
          message_id?: string
          referenced_count?: number | null
          total_readers?: number | null
        }
        Relationships: []
      }
      message_interactions: {
        Row: {
          clicked_at: string | null
          created_at: string | null
          device_type: string | null
          dismissed_at: string | null
          id: string
          message_id: string | null
          opened_at: string | null
          page_url: string | null
          session_id: string | null
          shown_at: string | null
          triggered_by: string | null
          user_id: string
          user_segment: string | null
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string | null
          device_type?: string | null
          dismissed_at?: string | null
          id?: string
          message_id?: string | null
          opened_at?: string | null
          page_url?: string | null
          session_id?: string | null
          shown_at?: string | null
          triggered_by?: string | null
          user_id: string
          user_segment?: string | null
        }
        Update: {
          clicked_at?: string | null
          created_at?: string | null
          device_type?: string | null
          dismissed_at?: string | null
          id?: string
          message_id?: string | null
          opened_at?: string | null
          page_url?: string | null
          session_id?: string | null
          shown_at?: string | null
          triggered_by?: string | null
          user_id?: string
          user_segment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_interactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "in_app_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_sync_state: {
        Row: {
          channel_external_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          last_message_timestamp: string | null
          last_sync_at: string | null
          platform: string
          sync_cursor: string | null
          sync_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          channel_external_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_message_timestamp?: string | null
          last_sync_at?: string | null
          platform: string
          sync_cursor?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          channel_external_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_message_timestamp?: string | null
          last_sync_at?: string | null
          platform?: string
          sync_cursor?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          tags: string[]
          updated_at: string
          usage_count: number
          user_id: string
          variables: Json
          workspace_id: string | null
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          tags?: string[]
          updated_at?: string
          usage_count?: number
          user_id: string
          variables?: Json
          workspace_id?: string | null
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          tags?: string[]
          updated_at?: string
          usage_count?: number
          user_id?: string
          variables?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_translations: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          message_id: string
          original_language: string
          target_language: string
          translated_text: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          message_id: string
          original_language: string
          target_language: string
          translated_text: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          message_id?: string
          original_language?: string
          target_language?: string
          translated_text?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_duration: number | null
          attachment_name: string | null
          attachment_size: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          decision_data: Json | null
          id: string
          reactions: Json | null
          related_task_id: string | null
          reply_to_id: string | null
          search_vector: unknown
          sender: string
          source: string | null
          status: string | null
          text: string
          thread_id: string
          timestamp: string
          voice_analysis: Json | null
        }
        Insert: {
          attachment_duration?: number | null
          attachment_name?: string | null
          attachment_size?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          decision_data?: Json | null
          id?: string
          reactions?: Json | null
          related_task_id?: string | null
          reply_to_id?: string | null
          search_vector?: unknown
          sender: string
          source?: string | null
          status?: string | null
          text: string
          thread_id: string
          timestamp?: string
          voice_analysis?: Json | null
        }
        Update: {
          attachment_duration?: number | null
          attachment_name?: string | null
          attachment_size?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          decision_data?: Json | null
          id?: string
          reactions?: Json | null
          related_task_id?: string | null
          reply_to_id?: string | null
          search_vector?: unknown
          sender?: string
          source?: string | null
          status?: string | null
          text?: string
          thread_id?: string
          timestamp?: string
          voice_analysis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_training_data: {
        Row: {
          created_at: string | null
          data_point_date: string
          features: Json
          id: string
          outcome_timestamp: string | null
          outcome_type: string
          outcome_value: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_point_date: string
          features: Json
          id?: string
          outcome_timestamp?: string | null
          outcome_type: string
          outcome_value?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_point_date?: string
          features?: Json
          id?: string
          outcome_timestamp?: string | null
          outcome_type?: string
          outcome_value?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          conditions: Json
          created_at: string
          enabled: boolean | null
          id: string
          name: string
          notify_desktop: boolean | null
          notify_email: boolean | null
          notify_mobile: boolean | null
          notify_sound: string | null
          priority: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          respect_quiet_hours: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          enabled?: boolean | null
          id?: string
          name: string
          notify_desktop?: boolean | null
          notify_email?: boolean | null
          notify_mobile?: boolean | null
          notify_sound?: string | null
          priority?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          respect_quiet_hours?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          enabled?: boolean | null
          id?: string
          name?: string
          notify_desktop?: boolean | null
          notify_email?: boolean | null
          notify_mobile?: boolean | null
          notify_sound?: string | null
          priority?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          respect_quiet_hours?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_connected_apps: {
        Row: {
          access_count: number
          app_client_id: string
          app_name: string
          created_at: string
          first_used_at: string
          id: string
          is_active: boolean
          is_trusted: boolean
          last_used_at: string | null
          permissions_granted: string[]
          provider: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number
          app_client_id: string
          app_name: string
          created_at?: string
          first_used_at?: string
          id?: string
          is_active?: boolean
          is_trusted?: boolean
          last_used_at?: string | null
          permissions_granted?: string[]
          provider?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number
          app_client_id?: string
          app_name?: string
          created_at?: string
          first_used_at?: string
          id?: string
          is_active?: boolean
          is_trusted?: boolean
          last_used_at?: string | null
          permissions_granted?: string[]
          provider?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      org_ai_usage_monthly: {
        Row: {
          estimated_cost: number | null
          id: string
          month: string
          org_id: string
          request_count: number | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          estimated_cost?: number | null
          id?: string
          month: string
          org_id: string
          request_count?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          estimated_cost?: number | null
          id?: string
          month?: string
          org_id?: string
          request_count?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_ai_usage_monthly_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "tenant_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "tenant_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "tenant_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_blockers: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          outcome_id: string | null
          reported_by: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          outcome_id?: string | null
          reported_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          outcome_id?: string | null
          reported_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_blockers_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "workspace_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_milestones: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          outcome_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          outcome_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          outcome_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_milestones_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "workspace_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          blockers: string[] | null
          created_at: string
          description: string | null
          id: string
          progress: number
          status: string
          target_date: string | null
          thread_id: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          blockers?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          thread_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          blockers?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          thread_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          label: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          key: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string | null
          color: string | null
          created_at: string
          created_by: string | null
          geofence_radius_m: number | null
          id: string
          lat: number
          lng: number
          name: string | null
          notes: string | null
          owner_user_id: string
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          address?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          geofence_radius_m?: number | null
          id?: string
          lat: number
          lng: number
          name?: string | null
          notes?: string | null
          owner_user_id: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          address?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          geofence_radius_m?: number | null
          id?: string
          lat?: number
          lng?: number
          name?: string | null
          notes?: string | null
          owner_user_id?: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          app: string
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_ai_messages_mo: number | null
          max_contacts: number | null
          max_integrations: number | null
          max_pipelines: number | null
          max_sms_mo: number | null
          max_storage_bytes: number | null
          max_summit_minutes_mo: number | null
          max_summit_session_sec: number | null
          max_users: number | null
          max_voxer_minutes_mo: number | null
          max_workflow_runs_mo: number | null
          max_workflows: number | null
          name: string
          stripe_price_monthly: string
          stripe_price_yearly: string
          tier: number
        }
        Insert: {
          app: string
          created_at?: string | null
          features?: Json | null
          id: string
          is_active?: boolean | null
          max_ai_messages_mo?: number | null
          max_contacts?: number | null
          max_integrations?: number | null
          max_pipelines?: number | null
          max_sms_mo?: number | null
          max_storage_bytes?: number | null
          max_summit_minutes_mo?: number | null
          max_summit_session_sec?: number | null
          max_users?: number | null
          max_voxer_minutes_mo?: number | null
          max_workflow_runs_mo?: number | null
          max_workflows?: number | null
          name: string
          stripe_price_monthly: string
          stripe_price_yearly: string
          tier?: number
        }
        Update: {
          app?: string
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_ai_messages_mo?: number | null
          max_contacts?: number | null
          max_integrations?: number | null
          max_pipelines?: number | null
          max_sms_mo?: number | null
          max_storage_bytes?: number | null
          max_summit_minutes_mo?: number | null
          max_summit_session_sec?: number | null
          max_users?: number | null
          max_voxer_minutes_mo?: number | null
          max_workflow_runs_mo?: number | null
          max_workflows?: number | null
          name?: string
          stripe_price_monthly?: string
          stripe_price_yearly?: string
          tier?: number
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          explanation: string
          id: string
          model_version: string
          predicted_value: Json
          prediction_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          explanation: string
          id?: string
          model_version?: string
          predicted_value: Json
          prediction_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          explanation?: string
          id?: string
          model_version?: string
          predicted_value?: Json
          prediction_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      predictions_cache: {
        Row: {
          actual_outcome: string | null
          confidence_level: number | null
          created_at: string | null
          expires_at: string | null
          factors: Json | null
          id: string
          outcome_tracked: boolean | null
          predicted_at: string
          prediction_accuracy: number | null
          prediction_label: string | null
          prediction_type: string
          prediction_value: number | null
          recommendations: string[] | null
          subject_identifier: string | null
          subject_type: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          actual_outcome?: string | null
          confidence_level?: number | null
          created_at?: string | null
          expires_at?: string | null
          factors?: Json | null
          id?: string
          outcome_tracked?: boolean | null
          predicted_at?: string
          prediction_accuracy?: number | null
          prediction_label?: string | null
          prediction_type: string
          prediction_value?: number | null
          recommendations?: string[] | null
          subject_identifier?: string | null
          subject_type: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          actual_outcome?: string | null
          confidence_level?: number | null
          created_at?: string | null
          expires_at?: string | null
          factors?: Json | null
          id?: string
          outcome_tracked?: boolean | null
          predicted_at?: string
          prediction_accuracy?: number | null
          prediction_label?: string | null
          prediction_type?: string
          prediction_value?: number | null
          recommendations?: string[] | null
          subject_identifier?: string | null
          subject_type?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          event_type: string | null
          processed_at: string | null
        }
        Insert: {
          event_id: string
          event_type?: string | null
          processed_at?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string | null
          processed_at?: string | null
        }
        Relationships: []
      }
      project_docs: {
        Row: {
          added_at: string | null
          added_by: string | null
          created_at: string | null
          doc_id: string
          project_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          created_at?: string | null
          doc_id: string
          project_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          created_at?: string | null
          doc_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_docs_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_docs_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_shares: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          message: string | null
          permissions: Json | null
          project_id: string | null
          public_link: string | null
          shared_by: string | null
          shared_with_email: string | null
          shared_with_user: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          permissions?: Json | null
          project_id?: string | null
          public_link?: string | null
          shared_by?: string | null
          shared_with_email?: string | null
          shared_with_user?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          permissions?: Json | null
          project_id?: string | null
          public_link?: string | null
          shared_by?: string | null
          shared_with_email?: string | null
          shared_with_user?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          default_assignee_roles: Json | null
          default_duration_days: number | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          milestones: Json | null
          name: string
          tasks: Json | null
          times_used: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_assignee_roles?: Json | null
          default_duration_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          milestones?: Json | null
          name: string
          tasks?: Json | null
          times_used?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_assignee_roles?: Json | null
          default_duration_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          milestones?: Json | null
          name?: string
          tasks?: Json | null
          times_used?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          crm_deal_id: string | null
          deal_value: number | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          owner_id: string | null
          settings: Json | null
          start_date: string | null
          status: string | null
          tags: Json | null
          team_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_deal_id?: string | null
          deal_value?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          owner_id?: string | null
          settings?: Json | null
          start_date?: string | null
          status?: string | null
          tags?: Json | null
          team_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_deal_id?: string | null
          deal_value?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          settings?: Json | null
          start_date?: string | null
          status?: string | null
          tags?: Json | null
          team_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_blockers: {
        Row: {
          channel_id: string | null
          created_at: string | null
          description: string | null
          id: string
          outcome_id: string | null
          resolved: boolean | null
          title: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          outcome_id?: string | null
          resolved?: boolean | null
          title: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          outcome_id?: string | null
          resolved?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_blockers_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "pulse_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_channel_subscriptions: {
        Row: {
          channel_id: string | null
          created_at: string | null
          id: string
          notifications_enabled: boolean | null
          subscriber_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          notifications_enabled?: boolean | null
          subscriber_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          notifications_enabled?: boolean | null
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pulse_channel_subscriptions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "pulse_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_channel_subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_channels: {
        Row: {
          avatar_url: string | null
          category: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          last_broadcast_at: string | null
          name: string
          owner_id: string | null
          subscriber_count: number | null
          tags: string[] | null
          total_listens: number | null
        }
        Insert: {
          avatar_url?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          last_broadcast_at?: string | null
          name: string
          owner_id?: string | null
          subscriber_count?: number | null
          tags?: string[] | null
          total_listens?: number | null
        }
        Update: {
          avatar_url?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          last_broadcast_at?: string | null
          name?: string
          owner_id?: string | null
          subscriber_count?: number | null
          tags?: string[] | null
          total_listens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pulse_channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_context_summaries: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          message_count: number
          summary: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          message_count: number
          summary: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          message_count?: number
          summary?: string
        }
        Relationships: []
      }
      pulse_conversations: {
        Row: {
          created_at: string | null
          external_display_name: string | null
          external_email: string | null
          external_slack_user_id: string | null
          id: string
          is_archived_by_user1: boolean | null
          is_archived_by_user2: boolean | null
          is_deleted_by_user1: boolean
          is_deleted_by_user2: boolean
          is_muted_by_user1: boolean | null
          is_muted_by_user2: boolean | null
          last_message_at: string | null
          last_message_id: string | null
          last_message_preview: string | null
          transport: string
          updated_at: string | null
          user1_id: string
          user1_unread_count: number | null
          user2_id: string
          user2_unread_count: number | null
        }
        Insert: {
          created_at?: string | null
          external_display_name?: string | null
          external_email?: string | null
          external_slack_user_id?: string | null
          id?: string
          is_archived_by_user1?: boolean | null
          is_archived_by_user2?: boolean | null
          is_deleted_by_user1?: boolean
          is_deleted_by_user2?: boolean
          is_muted_by_user1?: boolean | null
          is_muted_by_user2?: boolean | null
          last_message_at?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          transport?: string
          updated_at?: string | null
          user1_id: string
          user1_unread_count?: number | null
          user2_id: string
          user2_unread_count?: number | null
        }
        Update: {
          created_at?: string | null
          external_display_name?: string | null
          external_email?: string | null
          external_slack_user_id?: string | null
          id?: string
          is_archived_by_user1?: boolean | null
          is_archived_by_user2?: boolean | null
          is_deleted_by_user1?: boolean
          is_deleted_by_user2?: boolean
          is_muted_by_user1?: boolean | null
          is_muted_by_user2?: boolean | null
          last_message_at?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          transport?: string
          updated_at?: string | null
          user1_id?: string
          user1_unread_count?: number | null
          user2_id?: string
          user2_unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pulse_conversations_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "pulse_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_decisions: {
        Row: {
          channel_id: string
          created_at: string | null
          created_by: string | null
          decided_at: string | null
          description: string | null
          id: string
          message_id: string | null
          status: string
          title: string
          votes_approve: number | null
          votes_reject: number | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          created_by?: string | null
          decided_at?: string | null
          description?: string | null
          id?: string
          message_id?: string | null
          status?: string
          title: string
          votes_approve?: number | null
          votes_reject?: number | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          created_by?: string | null
          decided_at?: string | null
          description?: string | null
          id?: string
          message_id?: string | null
          status?: string
          title?: string
          votes_approve?: number | null
          votes_reject?: number | null
        }
        Relationships: []
      }
      pulse_files: {
        Row: {
          channel_id: string | null
          created_at: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      pulse_follows: {
        Row: {
          created_at: string | null
          follower_id: string | null
          following_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "pulse_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_messages: {
        Row: {
          content: string
          content_type: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          is_read: boolean | null
          media_url: string | null
          metadata: Json | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          thread_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          content_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          media_url?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          thread_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          media_url?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          thread_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pulse_notes: {
        Row: {
          ai_insight: string | null
          archived_at: string | null
          content: string
          content_html: string | null
          created_at: string
          id: string
          kind: string | null
          routed_decision_id: string | null
          routed_task_id: string | null
          search_tsv: unknown
          source_id: string | null
          source_section: string
          source_url: string | null
          tags: string[]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          ai_insight?: string | null
          archived_at?: string | null
          content: string
          content_html?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          routed_decision_id?: string | null
          routed_task_id?: string | null
          search_tsv?: unknown
          source_id?: string | null
          source_section?: string
          source_url?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          ai_insight?: string | null
          archived_at?: string | null
          content?: string
          content_html?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          routed_decision_id?: string | null
          routed_task_id?: string | null
          search_tsv?: unknown
          source_id?: string | null
          source_section?: string
          source_url?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_notes_routed_decision_id_fkey"
            columns: ["routed_decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_notes_routed_task_id_fkey"
            columns: ["routed_task_id"]
            isOneToOne: false
            referencedRelation: "extracted_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_notifications: {
        Row: {
          channel_id: string | null
          content: string
          created_at: string | null
          id: string
          message_id: string | null
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          message_id?: string | null
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          message_id?: string | null
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pulse_nudges: {
        Row: {
          channel_id: string
          created_at: string | null
          dismissed: boolean | null
          id: string
          message_id: string | null
          priority: string
          reason: string
          type: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          dismissed?: boolean | null
          id?: string
          message_id?: string | null
          priority: string
          reason: string
          type: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          dismissed?: boolean | null
          id?: string
          message_id?: string | null
          priority?: string
          reason?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pulse_outcomes: {
        Row: {
          channel_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          progress: number | null
          status: string | null
          title: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          progress?: number | null
          status?: string | null
          title: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          progress?: number | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      pulse_scheduled_messages: {
        Row: {
          content: string
          content_type: string
          created_at: string
          id: string
          media_url: string | null
          recipient_id: string
          scheduled_for: string
          sender_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content: string
          content_type?: string
          created_at?: string
          id?: string
          media_url?: string | null
          recipient_id: string
          scheduled_for: string
          sender_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string
          id?: string
          media_url?: string | null
          recipient_id?: string
          scheduled_for?: string
          sender_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pulse_starred_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "pulse_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_tasks: {
        Row: {
          assigned_to: string | null
          channel_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          id: string
          message_id: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          channel_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          message_id?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          channel_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          message_id?: string | null
          title?: string
        }
        Relationships: []
      }
      pulse_typing: {
        Row: {
          channel_id: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pulse_users: {
        Row: {
          auth_user_id: string | null
          avatar_color: string
          avatar_url: string | null
          bio: string | null
          bot_app: string | null
          bot_config: Json | null
          created_at: string | null
          display_name: string
          follower_count: number | null
          following_count: number | null
          handle: string
          id: string
          is_bot: boolean | null
          is_verified: boolean | null
          last_active_at: string | null
          settings: Json | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_color?: string
          avatar_url?: string | null
          bio?: string | null
          bot_app?: string | null
          bot_config?: Json | null
          created_at?: string | null
          display_name: string
          follower_count?: number | null
          following_count?: number | null
          handle: string
          id?: string
          is_bot?: boolean | null
          is_verified?: boolean | null
          last_active_at?: string | null
          settings?: Json | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_color?: string
          avatar_url?: string | null
          bio?: string | null
          bot_app?: string | null
          bot_config?: Json | null
          created_at?: string | null
          display_name?: string
          follower_count?: number | null
          following_count?: number | null
          handle?: string
          id?: string
          is_bot?: boolean | null
          is_verified?: boolean | null
          last_active_at?: string | null
          settings?: Json | null
        }
        Relationships: []
      }
      pulse_video_rooms: {
        Row: {
          calendar_event_id: string | null
          created_at: string | null
          created_by: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          recording_id: string | null
          recording_url: string | null
          room_name: string
          room_url: string
          started_at: string | null
          status: string
          summary: string | null
          title: string | null
          transcript: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string | null
          created_by: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          recording_id?: string | null
          recording_url?: string | null
          room_name: string
          room_url: string
          started_at?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string | null
          created_by?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          recording_id?: string | null
          recording_url?: string | null
          room_name?: string
          room_url?: string
          started_at?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pulse_video_rooms_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          device_name: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          p256dh_key: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          device_name?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          device_name?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pwa_settings: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      quick_vox_favorites: {
        Row: {
          avatar_color: string
          contact_handle: string | null
          contact_id: string
          contact_name: string
          created_at: string | null
          id: string
          last_vox_at: string | null
          position: number
          user_id: string
        }
        Insert: {
          avatar_color?: string
          contact_handle?: string | null
          contact_id: string
          contact_name: string
          created_at?: string | null
          id?: string
          last_vox_at?: string | null
          position?: number
          user_id: string
        }
        Update: {
          avatar_color?: string
          contact_handle?: string | null
          contact_id?: string
          contact_name?: string
          created_at?: string | null
          id?: string
          last_vox_at?: string | null
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      quick_vox_messages: {
        Row: {
          analysis: Json | null
          audio_url: string
          created_at: string | null
          delivered_at: string | null
          duration: number
          id: string
          played_at: string | null
          recipient_id: string
          sender_id: string
          status: string
          transcript: string | null
          workspace_id: string
        }
        Insert: {
          analysis?: Json | null
          audio_url: string
          created_at?: string | null
          delivered_at?: string | null
          duration: number
          id?: string
          played_at?: string | null
          recipient_id: string
          sender_id: string
          status?: string
          transcript?: string | null
          workspace_id: string
        }
        Update: {
          analysis?: Json | null
          audio_url?: string
          created_at?: string | null
          delivered_at?: string | null
          duration?: number
          id?: string
          played_at?: string | null
          recipient_id?: string
          sender_id?: string
          status?: string
          transcript?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_vox_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_vox_status: {
        Row: {
          is_online: boolean | null
          is_recording: boolean | null
          last_seen: string | null
          user_id: string
        }
        Insert: {
          is_online?: boolean | null
          is_recording?: boolean | null
          last_seen?: string | null
          user_id: string
        }
        Update: {
          is_online?: boolean | null
          is_recording?: boolean | null
          last_seen?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recognition_events: {
        Row: {
          channel: string
          created_at: string | null
          detected_at: string
          direction: string
          event_type: string
          from_contact_identifier: string | null
          from_contact_name: string | null
          id: string
          impact_level: string | null
          is_milestone: boolean | null
          keywords_detected: string[] | null
          message_excerpt: string | null
          message_id: string | null
          milestone_description: string | null
          milestone_type: string | null
          positivity_score: number | null
          recognition_category: string | null
          to_contact_identifier: string | null
          to_contact_name: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          detected_at?: string
          direction: string
          event_type: string
          from_contact_identifier?: string | null
          from_contact_name?: string | null
          id?: string
          impact_level?: string | null
          is_milestone?: boolean | null
          keywords_detected?: string[] | null
          message_excerpt?: string | null
          message_id?: string | null
          milestone_description?: string | null
          milestone_type?: string | null
          positivity_score?: number | null
          recognition_category?: string | null
          to_contact_identifier?: string | null
          to_contact_name?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          detected_at?: string
          direction?: string
          event_type?: string
          from_contact_identifier?: string | null
          from_contact_name?: string | null
          id?: string
          impact_level?: string | null
          is_milestone?: boolean | null
          keywords_detected?: string[] | null
          message_excerpt?: string | null
          message_id?: string | null
          milestone_description?: string | null
          milestone_type?: string | null
          positivity_score?: number | null
          recognition_category?: string | null
          to_contact_identifier?: string | null
          to_contact_name?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recognition_summary: {
        Row: {
          appreciation_score: number | null
          contact_identifier: string
          contact_name: string | null
          created_at: string | null
          id: string
          kudos_given_count: number | null
          kudos_received_count: number | null
          last_kudos_given_at: string | null
          last_kudos_received_at: string | null
          most_appreciated_for: string[] | null
          most_appreciates_about: string[] | null
          reciprocity_score: number | null
          recognition_trend: string | null
          total_recognition_events: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appreciation_score?: number | null
          contact_identifier: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          kudos_given_count?: number | null
          kudos_received_count?: number | null
          last_kudos_given_at?: string | null
          last_kudos_received_at?: string | null
          most_appreciated_for?: string[] | null
          most_appreciates_about?: string[] | null
          reciprocity_score?: number | null
          recognition_trend?: string | null
          total_recognition_events?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appreciation_score?: number | null
          contact_identifier?: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          kudos_given_count?: number | null
          kudos_received_count?: number | null
          last_kudos_given_at?: string | null
          last_kudos_received_at?: string | null
          most_appreciated_for?: string[] | null
          most_appreciates_about?: string[] | null
          reciprocity_score?: number | null
          recognition_trend?: string | null
          total_recognition_events?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      relationship_alerts: {
        Row: {
          action_data: Json | null
          action_template: string | null
          action_type: string | null
          actioned_at: string | null
          actioned_type: string | null
          alert_type: string
          context_data: Json | null
          created_at: string | null
          description: string | null
          dismissed_reason: string | null
          expires_at: string | null
          id: string
          priority: number | null
          profile_id: string | null
          recurrence_rule: string | null
          recurring: boolean | null
          severity: string | null
          snoozed_until: string | null
          status: string | null
          suggested_action: string | null
          title: string
          trigger_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_data?: Json | null
          action_template?: string | null
          action_type?: string | null
          actioned_at?: string | null
          actioned_type?: string | null
          alert_type: string
          context_data?: Json | null
          created_at?: string | null
          description?: string | null
          dismissed_reason?: string | null
          expires_at?: string | null
          id?: string
          priority?: number | null
          profile_id?: string | null
          recurrence_rule?: string | null
          recurring?: boolean | null
          severity?: string | null
          snoozed_until?: string | null
          status?: string | null
          suggested_action?: string | null
          title: string
          trigger_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_data?: Json | null
          action_template?: string | null
          action_type?: string | null
          actioned_at?: string | null
          actioned_type?: string | null
          alert_type?: string
          context_data?: Json | null
          created_at?: string | null
          description?: string | null
          dismissed_reason?: string | null
          expires_at?: string | null
          id?: string
          priority?: number | null
          profile_id?: string | null
          recurrence_rule?: string | null
          recurring?: boolean | null
          severity?: string | null
          snoozed_until?: string | null
          status?: string | null
          suggested_action?: string | null
          title?: string
          trigger_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "relationship_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_events: {
        Row: {
          actor: string | null
          created_at: string
          event_payload: Json
          event_type: string
          id: string
          relationship_id: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_payload?: Json
          event_type: string
          id?: string
          relationship_id?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_payload?: Json
          event_type?: string
          id?: string
          relationship_id?: string | null
        }
        Relationships: []
      }
      relationship_health: {
        Row: {
          at_risk_reason: string[] | null
          avg_response_time_contact: number | null
          avg_response_time_user: number | null
          contact_identifier: string
          contact_name: string | null
          conversation_count_30d: number | null
          created_at: string | null
          days_since_last_message: number | null
          health_score: number | null
          health_status: string | null
          id: string
          interaction_frequency: string | null
          intervention_message: string | null
          intervention_suggested: boolean | null
          last_calculated_at: string | null
          last_negative_interaction_at: string | null
          last_positive_interaction_at: string | null
          longest_gap_days: number | null
          message_count_30d: number | null
          response_reciprocity_score: number | null
          sentiment_balance: number | null
          sentiment_trend: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          at_risk_reason?: string[] | null
          avg_response_time_contact?: number | null
          avg_response_time_user?: number | null
          contact_identifier: string
          contact_name?: string | null
          conversation_count_30d?: number | null
          created_at?: string | null
          days_since_last_message?: number | null
          health_score?: number | null
          health_status?: string | null
          id?: string
          interaction_frequency?: string | null
          intervention_message?: string | null
          intervention_suggested?: boolean | null
          last_calculated_at?: string | null
          last_negative_interaction_at?: string | null
          last_positive_interaction_at?: string | null
          longest_gap_days?: number | null
          message_count_30d?: number | null
          response_reciprocity_score?: number | null
          sentiment_balance?: number | null
          sentiment_trend?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          at_risk_reason?: string[] | null
          avg_response_time_contact?: number | null
          avg_response_time_user?: number | null
          contact_identifier?: string
          contact_name?: string | null
          conversation_count_30d?: number | null
          created_at?: string | null
          days_since_last_message?: number | null
          health_score?: number | null
          health_status?: string | null
          id?: string
          interaction_frequency?: string | null
          intervention_message?: string | null
          intervention_suggested?: boolean | null
          last_calculated_at?: string | null
          last_negative_interaction_at?: string | null
          last_positive_interaction_at?: string | null
          longest_gap_days?: number | null
          message_count_30d?: number | null
          response_reciprocity_score?: number | null
          sentiment_balance?: number | null
          sentiment_trend?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      relationship_milestones: {
        Row: {
          celebration_sent: boolean | null
          created_at: string | null
          description: string | null
          id: string
          milestone_date: string
          milestone_type: string
          milestone_value: string | null
          profile_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          celebration_sent?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          milestone_date: string
          milestone_type: string
          milestone_value?: string | null
          profile_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          celebration_sent?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          milestone_date?: string
          milestone_type?: string
          milestone_value?: string | null
          profile_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_milestones_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "relationship_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_profiles: {
        Row: {
          ai_buying_signals: Json | null
          ai_communication_style: string | null
          ai_next_action_suggestion: string | null
          ai_relationship_summary: string | null
          ai_sentiment_average: number | null
          ai_talking_points: Json | null
          ai_topics: Json | null
          anniversary: string | null
          avg_response_time_hours: number | null
          birthday: string | null
          canonical_email: string | null
          communication_frequency: string | null
          company: string | null
          contact_email: string
          contact_name: string | null
          created_at: string | null
          custom_notes: string | null
          custom_tags: Json | null
          department: string | null
          extracted_signature: Json | null
          first_interaction_at: string | null
          google_resource_name: string | null
          id: string
          is_blocked: boolean | null
          is_favorite: boolean | null
          is_merged: boolean | null
          is_vip: boolean | null
          last_analyzed_at: string | null
          last_call_at: string | null
          last_email_received_at: string | null
          last_email_sent_at: string | null
          last_interaction_at: string | null
          last_meeting_at: string | null
          last_synced_to_google_at: string | null
          linkedin_url: string | null
          location: string | null
          merged_from: Json | null
          phone: string | null
          preferred_channel: string | null
          relationship_score: number | null
          relationship_trend: string | null
          relationship_type: string | null
          response_rate: number | null
          source: string | null
          sync_direction: string | null
          synced_to_google: boolean | null
          timezone: string | null
          title: string | null
          total_calls: number | null
          total_emails_received: number | null
          total_emails_sent: number | null
          total_meetings: number | null
          total_shared_files: number | null
          twitter_handle: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_buying_signals?: Json | null
          ai_communication_style?: string | null
          ai_next_action_suggestion?: string | null
          ai_relationship_summary?: string | null
          ai_sentiment_average?: number | null
          ai_talking_points?: Json | null
          ai_topics?: Json | null
          anniversary?: string | null
          avg_response_time_hours?: number | null
          birthday?: string | null
          canonical_email?: string | null
          communication_frequency?: string | null
          company?: string | null
          contact_email: string
          contact_name?: string | null
          created_at?: string | null
          custom_notes?: string | null
          custom_tags?: Json | null
          department?: string | null
          extracted_signature?: Json | null
          first_interaction_at?: string | null
          google_resource_name?: string | null
          id?: string
          is_blocked?: boolean | null
          is_favorite?: boolean | null
          is_merged?: boolean | null
          is_vip?: boolean | null
          last_analyzed_at?: string | null
          last_call_at?: string | null
          last_email_received_at?: string | null
          last_email_sent_at?: string | null
          last_interaction_at?: string | null
          last_meeting_at?: string | null
          last_synced_to_google_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          merged_from?: Json | null
          phone?: string | null
          preferred_channel?: string | null
          relationship_score?: number | null
          relationship_trend?: string | null
          relationship_type?: string | null
          response_rate?: number | null
          source?: string | null
          sync_direction?: string | null
          synced_to_google?: boolean | null
          timezone?: string | null
          title?: string | null
          total_calls?: number | null
          total_emails_received?: number | null
          total_emails_sent?: number | null
          total_meetings?: number | null
          total_shared_files?: number | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_buying_signals?: Json | null
          ai_communication_style?: string | null
          ai_next_action_suggestion?: string | null
          ai_relationship_summary?: string | null
          ai_sentiment_average?: number | null
          ai_talking_points?: Json | null
          ai_topics?: Json | null
          anniversary?: string | null
          avg_response_time_hours?: number | null
          birthday?: string | null
          canonical_email?: string | null
          communication_frequency?: string | null
          company?: string | null
          contact_email?: string
          contact_name?: string | null
          created_at?: string | null
          custom_notes?: string | null
          custom_tags?: Json | null
          department?: string | null
          extracted_signature?: Json | null
          first_interaction_at?: string | null
          google_resource_name?: string | null
          id?: string
          is_blocked?: boolean | null
          is_favorite?: boolean | null
          is_merged?: boolean | null
          is_vip?: boolean | null
          last_analyzed_at?: string | null
          last_call_at?: string | null
          last_email_received_at?: string | null
          last_email_sent_at?: string | null
          last_interaction_at?: string | null
          last_meeting_at?: string | null
          last_synced_to_google_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          merged_from?: Json | null
          phone?: string | null
          preferred_channel?: string | null
          relationship_score?: number | null
          relationship_trend?: string | null
          relationship_type?: string | null
          response_rate?: number | null
          source?: string | null
          sync_direction?: string | null
          synced_to_google?: boolean | null
          timezone?: string | null
          title?: string | null
          total_calls?: number | null
          total_emails_received?: number | null
          total_emails_sent?: number | null
          total_meetings?: number | null
          total_shared_files?: number | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      relationships: {
        Row: {
          confidence: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          evidence: Json
          id: string
          is_deleted: boolean
          relationship_type: string
          rule_version: string
          source_id: string
          source_system: string
          source_type: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          evidence?: Json
          id?: string
          is_deleted?: boolean
          relationship_type: string
          rule_version?: string
          source_id: string
          source_system?: string
          source_type: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          evidence?: Json
          id?: string
          is_deleted?: boolean
          relationship_type?: string
          rule_version?: string
          source_id?: string
          source_system?: string
          source_type?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      relay_triage_dismissals: {
        Row: {
          dismissed_at: string
          kind: string
          row_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          kind: string
          row_id: string
          user_id?: string
        }
        Update: {
          dismissed_at?: string
          kind?: string
          row_id?: string
          user_id?: string
        }
        Relationships: []
      }
      reserved_handles: {
        Row: {
          created_at: string | null
          handle: string
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          handle: string
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          handle?: string
          reason?: string | null
        }
        Relationships: []
      }
      retention_policies: {
        Row: {
          archive_before_delete: boolean
          created_at: string
          id: string
          is_active: boolean
          notify_before_delete: boolean
          notify_days_before: number
          resource_type: string
          retention_days: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          archive_before_delete?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          notify_before_delete?: boolean
          notify_days_before?: number
          resource_type: string
          retention_days: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          archive_before_delete?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          notify_before_delete?: boolean
          notify_days_before?: number
          resource_type?: string
          retention_days?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          granted_at: string
          permission_key: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          permission_key: string
          role_id: string
        }
        Update: {
          granted_at?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "workspace_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          name: string
          permissions: Json
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean
          name: string
          permissions?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean
          name?: string
          permissions?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          id: string
          name: string
          predicate_json: Json
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          predicate_json: Json
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          predicate_json?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alert_enabled: boolean
          alert_frequency: string | null
          created_at: string | null
          filters: Json | null
          icon: string | null
          id: string
          is_pinned: boolean | null
          last_alert_at: string | null
          last_used: string | null
          last_used_at: string | null
          name: string
          parsed_query: Json | null
          query: string
          search_type: string
          updated_at: string | null
          use_count: number | null
          user_id: string | null
        }
        Insert: {
          alert_enabled?: boolean
          alert_frequency?: string | null
          created_at?: string | null
          filters?: Json | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          last_alert_at?: string | null
          last_used?: string | null
          last_used_at?: string | null
          name: string
          parsed_query?: Json | null
          query: string
          search_type?: string
          updated_at?: string | null
          use_count?: number | null
          user_id?: string | null
        }
        Update: {
          alert_enabled?: boolean
          alert_frequency?: string | null
          created_at?: string | null
          filters?: Json | null
          icon?: string | null
          id?: string
          is_pinned?: boolean | null
          last_alert_at?: string | null
          last_used?: string | null
          last_used_at?: string | null
          name?: string
          parsed_query?: Json | null
          query?: string
          search_type?: string
          updated_at?: string | null
          use_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      scheduled_emails: {
        Row: {
          bcc_emails: Json | null
          body: string | null
          body_html: string | null
          cc_emails: Json | null
          created_at: string | null
          error_message: string | null
          id: string
          in_reply_to: string | null
          is_html: boolean | null
          retry_count: number | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
          subject: string | null
          thread_id: string | null
          timezone: string | null
          to_emails: Json
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bcc_emails?: Json | null
          body?: string | null
          body_html?: string | null
          cc_emails?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          in_reply_to?: string | null
          is_html?: boolean | null
          retry_count?: number | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          thread_id?: string | null
          timezone?: string | null
          to_emails: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bcc_emails?: Json | null
          body?: string | null
          body_html?: string | null
          cc_emails?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          in_reply_to?: string | null
          is_html?: boolean | null
          retry_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          thread_id?: string | null
          timezone?: string | null
          to_emails?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_clipboard: {
        Row: {
          category: string | null
          color: string | null
          content: string
          content_type: string
          conversation_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          pinned: boolean
          position_x: number | null
          position_y: number | null
          related_items: Json | null
          source_id: string | null
          source_type: string | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          content: string
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          pinned?: boolean
          position_x?: number | null
          position_y?: number | null
          related_items?: Json | null
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          content?: string
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          pinned?: boolean
          position_x?: number | null
          position_y?: number | null
          related_items?: Json | null
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_documents: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          source_id: string
          source_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id: string
          source_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id?: string
          source_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          count: number
          created_at: string | null
          execution_time: number | null
          id: string
          query: string
          results_count: number | null
          search_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          count?: number
          created_at?: string | null
          execution_time?: number | null
          id?: string
          query: string
          results_count?: number | null
          search_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          count?: number
          created_at?: string | null
          execution_time?: number | null
          id?: string
          query?: string
          results_count?: number | null
          search_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      search_index: {
        Row: {
          content: string | null
          content_id: string | null
          content_type: string | null
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_level: string
          alert_type: string
          created_at: string
          description: string
          device_info: Json | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          ip_address: unknown
          location_info: Json | null
          metadata: Json | null
          push_sent: boolean | null
          push_sent_at: string | null
          resolved_at: string | null
          status: string | null
          title: string
          trigger_activity_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_level?: string
          alert_type: string
          created_at?: string
          description: string
          device_info?: Json | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          ip_address?: unknown
          location_info?: Json | null
          metadata?: Json | null
          push_sent?: boolean | null
          push_sent_at?: string | null
          resolved_at?: string | null
          status?: string | null
          title: string
          trigger_activity_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_level?: string
          alert_type?: string
          created_at?: string
          description?: string
          device_info?: Json | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          ip_address?: unknown
          location_info?: Json | null
          metadata?: Json | null
          push_sent?: boolean | null
          push_sent_at?: string | null
          resolved_at?: string | null
          status?: string | null
          title?: string
          trigger_activity_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_trigger_activity_id_fkey"
            columns: ["trigger_activity_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_settings: {
        Row: {
          activity_retention_days: number | null
          alerts_enabled: boolean | null
          created_at: string
          email_alerts_enabled: boolean | null
          id: string
          monitor_data_exports: boolean | null
          monitor_failed_logins: boolean | null
          monitor_new_devices: boolean | null
          monitor_new_locations: boolean | null
          monitor_unusual_times: boolean | null
          push_alerts_enabled: boolean | null
          trusted_device_fingerprints: Json | null
          trusted_ip_ranges: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_retention_days?: number | null
          alerts_enabled?: boolean | null
          created_at?: string
          email_alerts_enabled?: boolean | null
          id?: string
          monitor_data_exports?: boolean | null
          monitor_failed_logins?: boolean | null
          monitor_new_devices?: boolean | null
          monitor_new_locations?: boolean | null
          monitor_unusual_times?: boolean | null
          push_alerts_enabled?: boolean | null
          trusted_device_fingerprints?: Json | null
          trusted_ip_ranges?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_retention_days?: number | null
          alerts_enabled?: boolean | null
          created_at?: string
          email_alerts_enabled?: boolean | null
          id?: string
          monitor_data_exports?: boolean | null
          monitor_failed_logins?: boolean | null
          monitor_new_devices?: boolean | null
          monitor_new_locations?: boolean | null
          monitor_unusual_times?: boolean | null
          push_alerts_enabled?: boolean | null
          trusted_device_fingerprints?: Json | null
          trusted_ip_ranges?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sentiment_history: {
        Row: {
          channel_id: string
          id: string
          intelligence_id: string | null
          message_count: number | null
          reason: string | null
          recorded_at: string | null
          sentiment: string
          sentiment_score: number
        }
        Insert: {
          channel_id: string
          id?: string
          intelligence_id?: string | null
          message_count?: number | null
          reason?: string | null
          recorded_at?: string | null
          sentiment: string
          sentiment_score: number
        }
        Update: {
          channel_id?: string
          id?: string
          intelligence_id?: string | null
          message_count?: number | null
          reason?: string | null
          recorded_at?: string | null
          sentiment?: string
          sentiment_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_history_intelligence_id_fkey"
            columns: ["intelligence_id"]
            isOneToOne: false
            referencedRelation: "conversation_intelligence"
            referencedColumns: ["id"]
          },
        ]
      }
      session_docs: {
        Row: {
          added_at: string | null
          doc_id: string
          session_id: string
        }
        Insert: {
          added_at?: string | null
          doc_id: string
          session_id: string
        }
        Update: {
          added_at?: string | null
          doc_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_docs_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_docs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      share_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invite_type: string
          invited_by: string | null
          permissions: Json | null
          resource_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_type: string
          invited_by?: string | null
          permissions?: Json | null
          resource_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_type?: string
          invited_by?: string | null
          permissions?: Json | null
          resource_id?: string
          token?: string
        }
        Relationships: []
      }
      slack_channel_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_outgoing: boolean
          metadata: Json
          sender_name: string
          sender_shadow_id: string | null
          sender_slack_id: string | null
          slack_thread_ts: string | null
          slack_ts: string | null
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_outgoing?: boolean
          metadata?: Json
          sender_name: string
          sender_shadow_id?: string | null
          sender_slack_id?: string | null
          slack_thread_ts?: string | null
          slack_ts?: string | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_outgoing?: boolean
          metadata?: Json
          sender_name?: string
          sender_shadow_id?: string | null
          sender_slack_id?: string | null
          slack_thread_ts?: string | null
          slack_ts?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_channel_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "slack_channel_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_channel_threads: {
        Row: {
          channel_name: string | null
          created_at: string
          id: string
          is_private: boolean
          last_message_at: string | null
          owner_pulse_id: string
          slack_channel_id: string
          slack_team_id: string
          transport: string
        }
        Insert: {
          channel_name?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          last_message_at?: string | null
          owner_pulse_id: string
          slack_channel_id: string
          slack_team_id: string
          transport?: string
        }
        Update: {
          channel_name?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          last_message_at?: string | null
          owner_pulse_id?: string
          slack_channel_id?: string
          slack_team_id?: string
          transport?: string
        }
        Relationships: []
      }
      slack_channels: {
        Row: {
          channel_id: string
          channel_name: string
          created_at: string
          id: string
          is_member: boolean
          is_private: boolean
          member_count: number | null
          user_id: string
          workspace_id: string | null
          workspace_name: string | null
        }
        Insert: {
          channel_id: string
          channel_name: string
          created_at?: string
          id?: string
          is_member?: boolean
          is_private?: boolean
          member_count?: number | null
          user_id: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          channel_id?: string
          channel_name?: string
          created_at?: string
          id?: string
          is_member?: boolean
          is_private?: boolean
          member_count?: number | null
          user_id?: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      smart_contact_groups: {
        Row: {
          ai_confidence: number | null
          ai_reasoning: string | null
          ai_suggested_at: string | null
          auto_refresh: boolean | null
          color: string | null
          created_at: string | null
          criteria: Json | null
          description: string | null
          emoji: string | null
          group_type: string
          icon: string | null
          id: string
          is_hidden: boolean | null
          is_pinned: boolean | null
          is_system: boolean | null
          last_refreshed_at: string | null
          member_count: number | null
          member_profile_ids: Json | null
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          ai_suggested_at?: string | null
          auto_refresh?: boolean | null
          color?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          emoji?: string | null
          group_type: string
          icon?: string | null
          id?: string
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          is_system?: boolean | null
          last_refreshed_at?: string | null
          member_count?: number | null
          member_profile_ids?: Json | null
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          ai_suggested_at?: string | null
          auto_refresh?: boolean | null
          color?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          emoji?: string | null
          group_type?: string
          icon?: string | null
          id?: string
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          is_system?: boolean | null
          last_refreshed_at?: string | null
          member_count?: number | null
          member_profile_ids?: Json | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      smart_folders: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          icon: string
          id: string
          name: string
          rule_operator: string
          rules: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          name: string
          rule_operator?: string
          rules?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          name?: string
          rule_operator?: string
          rules?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      smart_groups: {
        Row: {
          auto_sync_enabled: boolean | null
          channel_id: string
          channel_name: string
          created_at: string | null
          crm_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          member_contact_ids: string[] | null
          member_user_ids: string[] | null
          membership_rules: Json
          updated_at: string | null
        }
        Insert: {
          auto_sync_enabled?: boolean | null
          channel_id: string
          channel_name: string
          created_at?: string | null
          crm_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          member_contact_ids?: string[] | null
          member_user_ids?: string[] | null
          membership_rules: Json
          updated_at?: string | null
        }
        Update: {
          auto_sync_enabled?: boolean | null
          channel_id?: string
          channel_name?: string
          created_at?: string | null
          crm_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          member_contact_ids?: string[] | null
          member_user_ids?: string[] | null
          membership_rules?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_groups_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crm_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_suggestions_cache: {
        Row: {
          context_hash: string
          conversation_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          suggestions: Json
          user_id: string
        }
        Insert: {
          context_hash: string
          conversation_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          suggestions: Json
          user_id: string
        }
        Update: {
          context_hash?: string
          conversation_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          suggestions?: Json
          user_id?: string
        }
        Relationships: []
      }
      sms_conversations: {
        Row: {
          avatar_color: string
          contact_name: string | null
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          phone_number: string
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_color?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          phone_number: string
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_color?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          phone_number?: string
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          media_url: string | null
          search_vector: unknown
          sender: string
          status: string | null
          text: string
          timestamp: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          media_url?: string | null
          search_vector?: unknown
          sender: string
          status?: string | null
          text: string
          timestamp?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          media_url?: string | null
          search_vector?: unknown
          sender?: string
          status?: string | null
          text?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sms_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      snoozed_emails: {
        Row: {
          created_at: string | null
          email_id: string | null
          gmail_id: string | null
          id: string
          original_labels: Json | null
          restored_at: string | null
          snooze_until: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_id?: string | null
          gmail_id?: string | null
          id?: string
          original_labels?: Json | null
          restored_at?: string | null
          snooze_until: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_id?: string | null
          gmail_id?: string | null
          id?: string
          original_labels?: Json | null
          restored_at?: string | null
          snooze_until?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snoozed_emails_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "cached_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_configs: {
        Row: {
          allowed_domains: string[]
          auto_provision_users: boolean
          created_at: string
          default_role_id: string | null
          id: string
          is_enabled: boolean
          oauth_authorization_url: string | null
          oauth_client_id: string | null
          oauth_client_secret: string | null
          oauth_scopes: string[] | null
          oauth_token_url: string | null
          oauth_userinfo_url: string | null
          protocol: string
          provider: string
          saml_certificate: string | null
          saml_entry_point: string | null
          saml_issuer: string | null
          saml_logout_url: string | null
          saml_signature_algorithm: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allowed_domains?: string[]
          auto_provision_users?: boolean
          created_at?: string
          default_role_id?: string | null
          id?: string
          is_enabled?: boolean
          oauth_authorization_url?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          oauth_scopes?: string[] | null
          oauth_token_url?: string | null
          oauth_userinfo_url?: string | null
          protocol: string
          provider: string
          saml_certificate?: string | null
          saml_entry_point?: string | null
          saml_issuer?: string | null
          saml_logout_url?: string | null
          saml_signature_algorithm?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allowed_domains?: string[]
          auto_provision_users?: boolean
          created_at?: string
          default_role_id?: string | null
          id?: string
          is_enabled?: boolean
          oauth_authorization_url?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          oauth_scopes?: string[] | null
          oauth_token_url?: string | null
          oauth_userinfo_url?: string | null
          protocol?: string
          provider?: string
          saml_certificate?: string | null
          saml_entry_point?: string | null
          saml_issuer?: string | null
          saml_logout_url?: string | null
          saml_signature_algorithm?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_configs_default_role_id_fkey"
            columns: ["default_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_sessions: {
        Row: {
          attributes: Json | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          name_id: string | null
          provider: string
          session_index: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name_id?: string | null
          provider: string
          session_index?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name_id?: string | null
          provider?: string
          session_index?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      storage_quotas: {
        Row: {
          created_at: string | null
          file_count: number | null
          last_calculated_at: string | null
          quota_bytes: number | null
          total_bytes_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_count?: number | null
          last_calculated_at?: string | null
          quota_bytes?: number | null
          total_bytes_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_count?: number | null
          last_calculated_at?: string | null
          quota_bytes?: number | null
          total_bytes_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscription_items: {
        Row: {
          created_at: string | null
          id: string
          plan_id: string
          quantity: number | null
          stripe_subscription_item_id: string | null
          subscription_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_id: string
          quantity?: number | null
          stripe_subscription_item_id?: string | null
          subscription_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_id?: string
          quantity?: number | null
          stripe_subscription_item_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_subscription_id: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_subscription_id: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_subscription_id?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_completed: boolean | null
          position: number | null
          task_id: string
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_completed?: boolean | null
          position?: number | null
          task_id: string
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_completed?: boolean | null
          position?: number | null
          task_id?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "extracted_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      summary_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string | null
          id: string
          message_count: number | null
          summary_data: Json
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message_count?: number | null
          summary_data: Json
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message_count?: number | null
          summary_data?: Json
        }
        Relationships: []
      }
      summit_metered_sessions: {
        Row: {
          applied_at: string
          minutes: number
          period_start: string
          session_id: string
          workspace_id: string
        }
        Insert: {
          applied_at?: string
          minutes: number
          period_start: string
          session_id: string
          workspace_id: string
        }
        Update: {
          applied_at?: string
          minutes?: number
          period_start?: string
          session_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      summit_sessions: {
        Row: {
          artifact_count: number
          capture_count: number
          created_at: string
          data: Json
          duration_sec: number
          ended_at: string
          id: string
          last_line: string | null
          started_at: string
          takeaway: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          artifact_count?: number
          capture_count?: number
          created_at?: string
          data?: Json
          duration_sec: number
          ended_at: string
          id?: string
          last_line?: string | null
          started_at: string
          takeaway?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          artifact_count?: number
          capture_count?: number
          created_at?: string
          data?: Json
          duration_sec?: number
          ended_at?: string
          id?: string
          last_line?: string | null
          started_at?: string
          takeaway?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      tag_definitions: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "extracted_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          body: string
          created_at: string | null
          edited_at: string | null
          id: string
          mentioned_user_ids: string[] | null
          parent_comment_id: string | null
          task_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          task_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          task_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "extracted_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string | null
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: []
      }
      task_updates: {
        Row: {
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
          updated_at: string | null
          updated_by: string
        }
        Insert: {
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
          updated_at?: string | null
          updated_by: string
        }
        Update: {
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          updated_at?: string | null
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "extracted_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          ai_predicted_duration: string | null
          ai_priority_score: number | null
          ai_suggested_assignee: string | null
          assignee_id: string | null
          blocked_by_task_ids: string[] | null
          blocks_task_ids: string[] | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          list_id: string
          metadata: Json | null
          origin_message_id: string | null
          priority: string | null
          search_vector: unknown
          status: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          ai_predicted_duration?: string | null
          ai_priority_score?: number | null
          ai_suggested_assignee?: string | null
          assignee_id?: string | null
          blocked_by_task_ids?: string[] | null
          blocks_task_ids?: string[] | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          list_id?: string
          metadata?: Json | null
          origin_message_id?: string | null
          priority?: string | null
          search_vector?: unknown
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          ai_predicted_duration?: string | null
          ai_priority_score?: number | null
          ai_suggested_assignee?: string | null
          assignee_id?: string | null
          blocked_by_task_ids?: string[] | null
          blocks_task_ids?: string[] | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          list_id?: string
          metadata?: Json | null
          origin_message_id?: string | null
          priority?: string | null
          search_vector?: unknown
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_calendar_members: {
        Row: {
          calendar_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          calendar_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_calendar_members_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "team_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      team_calendars: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_calendars_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          added_at: string | null
          id: string
          member_id: string
          member_type: string
          role: string | null
          team_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          member_id: string
          member_type: string
          role?: string | null
          team_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          member_id?: string
          member_type?: string
          role?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "user_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_vox_messages: {
        Row: {
          action_items: string[] | null
          audio_url: string
          channel_id: string | null
          created_at: string | null
          duration: number
          id: string
          mentions: string[] | null
          message_type: string
          reactions: Json | null
          sender_id: string | null
          sender_name: string
          transcript: string | null
          workspace_id: string
        }
        Insert: {
          action_items?: string[] | null
          audio_url: string
          channel_id?: string | null
          created_at?: string | null
          duration: number
          id?: string
          mentions?: string[] | null
          message_type?: string
          reactions?: Json | null
          sender_id?: string | null
          sender_name: string
          transcript?: string | null
          workspace_id: string
        }
        Update: {
          action_items?: string[] | null
          audio_url?: string
          channel_id?: string | null
          created_at?: string | null
          duration?: number
          id?: string
          mentions?: string[] | null
          message_type?: string
          reactions?: Json | null
          sender_id?: string | null
          sender_name?: string
          transcript?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_vox_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "vox_team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_vox_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
        }
        Relationships: []
      }
      template_categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_organizations: {
        Row: {
          ai_custom_api_key: string | null
          ai_custom_api_key_active: boolean | null
          ai_monthly_limit: number | null
          created_at: string | null
          ecosystem_access: boolean
          id: string
          name: string
          plan: string | null
          settings: Json | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_custom_api_key?: string | null
          ai_custom_api_key_active?: boolean | null
          ai_monthly_limit?: number | null
          created_at?: string | null
          ecosystem_access?: boolean
          id?: string
          name: string
          plan?: string | null
          settings?: Json | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_custom_api_key?: string | null
          ai_custom_api_key_active?: boolean | null
          ai_monthly_limit?: number | null
          created_at?: string | null
          ecosystem_access?: boolean
          id?: string
          name?: string
          plan?: string | null
          settings?: Json | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      test_matrix_results: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          status: string
          test_id: string
          tester_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          status: string
          test_id: string
          tester_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          test_id?: string
          tester_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      thread_actions: {
        Row: {
          archived_at: string | null
          conversation_id: string
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          is_starred: boolean | null
          muted_at: string | null
          pinned_at: string | null
          starred_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          is_starred?: boolean | null
          muted_at?: string | null
          pinned_at?: string | null
          starred_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          is_starred?: boolean | null
          muted_at?: string | null
          pinned_at?: string | null
          starred_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      thread_reminders: {
        Row: {
          conversation_id: string
          conversation_kind: string
          created_at: string
          fired_at: string | null
          id: string
          message_id: string | null
          note: string | null
          remind_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          conversation_kind: string
          created_at?: string
          fired_at?: string | null
          id?: string
          message_id?: string | null
          note?: string | null
          remind_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          conversation_kind?: string
          created_at?: string
          fired_at?: string | null
          id?: string
          message_id?: string | null
          note?: string | null
          remind_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      thread_tags: {
        Row: {
          applied_at: string
          applied_by: string
          conversation_id: string
          conversation_kind: string
          id: string
          tag_id: string
        }
        Insert: {
          applied_at?: string
          applied_by: string
          conversation_id: string
          conversation_kind: string
          id?: string
          tag_id: string
        }
        Update: {
          applied_at?: string
          applied_by?: string
          conversation_id?: string
          conversation_kind?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          avatar_color: string
          contact_id: string
          contact_name: string
          created_at: string
          id: string
          outcome_blockers: string[] | null
          outcome_goal: string | null
          outcome_progress: number | null
          outcome_status: string | null
          pinned: boolean
          search_vector: unknown
          unread: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_color?: string
          contact_id: string
          contact_name: string
          created_at?: string
          id?: string
          outcome_blockers?: string[] | null
          outcome_goal?: string | null
          outcome_progress?: number | null
          outcome_status?: string | null
          pinned?: boolean
          search_vector?: unknown
          unread?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_color?: string
          contact_id?: string
          contact_name?: string
          created_at?: string
          id?: string
          outcome_blockers?: string[] | null
          outcome_goal?: string | null
          outcome_progress?: number | null
          outcome_status?: string | null
          pinned?: boolean
          search_vector?: unknown
          unread?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      today_feed_items: {
        Row: {
          ai_draft_message: string | null
          completed_at: string | null
          contact_id: string
          contact_name: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          item_type: string
          metadata: Json | null
          priority: number | null
          snoozed_until: string | null
          status: string | null
          subtitle: string | null
          suggested_action: string
          suggested_channel: string | null
          title: string
          user_id: string
        }
        Insert: {
          ai_draft_message?: string | null
          completed_at?: string | null
          contact_id: string
          contact_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          item_type: string
          metadata?: Json | null
          priority?: number | null
          snoozed_until?: string | null
          status?: string | null
          subtitle?: string | null
          suggested_action: string
          suggested_channel?: string | null
          title: string
          user_id: string
        }
        Update: {
          ai_draft_message?: string | null
          completed_at?: string | null
          contact_id?: string
          contact_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          item_type?: string
          metadata?: Json | null
          priority?: number | null
          snoozed_until?: string | null
          status?: string | null
          subtitle?: string | null
          suggested_action?: string
          suggested_channel?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      topic_detection_history: {
        Row: {
          channel_id: string
          confidence: number | null
          first_detected_at: string | null
          id: string
          intelligence_id: string | null
          last_mentioned_at: string | null
          mention_count: number | null
          topic: string
        }
        Insert: {
          channel_id: string
          confidence?: number | null
          first_detected_at?: string | null
          id?: string
          intelligence_id?: string | null
          last_mentioned_at?: string | null
          mention_count?: number | null
          topic: string
        }
        Update: {
          channel_id?: string
          confidence?: number | null
          first_detected_at?: string | null
          id?: string
          intelligence_id?: string | null
          last_mentioned_at?: string | null
          mention_count?: number | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_detection_history_intelligence_id_fkey"
            columns: ["intelligence_id"]
            isOneToOne: false
            referencedRelation: "conversation_intelligence"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_messages: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          content: string
          conversation_graph_id: string | null
          created_at: string
          external_id: string
          id: string
          is_read: boolean
          is_starred: boolean | null
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          platform: string
          priority: string | null
          search_vector: unknown
          searchable_content: string | null
          sender_email: string | null
          sender_id: string | null
          sender_name: string
          source: string
          starred: boolean
          tags: string[] | null
          thread_id: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          content: string
          conversation_graph_id?: string | null
          created_at?: string
          external_id?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          platform?: string
          priority?: string | null
          search_vector?: unknown
          searchable_content?: string | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name: string
          source: string
          starred?: boolean
          tags?: string[] | null
          thread_id?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          content?: string
          conversation_graph_id?: string | null
          created_at?: string
          external_id?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          platform?: string
          priority?: string | null
          search_vector?: unknown
          searchable_content?: string | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string
          source?: string
          starred?: boolean
          tags?: string[] | null
          thread_id?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_records: {
        Row: {
          created_at: string | null
          id: string
          metric: string
          period_end: string
          period_start: string
          quantity: number
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric: string
          period_end: string
          period_start: string
          quantity?: number
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metric?: string
          period_end?: string
          period_start?: string
          quantity?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          category: string
          created_at: string | null
          description: string
          icon: string
          id: string
          max_progress: number
          progress: number | null
          rarity: string
          title: string
          unlocked: boolean | null
          unlocked_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          category: string
          created_at?: string | null
          description: string
          icon: string
          id?: string
          max_progress: number
          progress?: number | null
          rarity: string
          title: string
          unlocked?: boolean | null
          unlocked_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          category?: string
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          max_progress?: number
          progress?: number | null
          rarity?: string
          title?: string
          unlocked?: boolean | null
          unlocked_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_ai_preferences: {
        Row: {
          ai_aggressiveness: string | null
          dismissed_nudges: Json | null
          enable_ai_assistant: boolean | null
          enable_auto_priority: boolean | null
          enable_proactive_nudges: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_aggressiveness?: string | null
          dismissed_nudges?: Json | null
          enable_ai_assistant?: boolean | null
          enable_auto_priority?: boolean | null
          enable_proactive_nudges?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_aggressiveness?: string | null
          dismissed_nudges?: Json | null
          enable_ai_assistant?: boolean | null
          enable_auto_priority?: boolean | null
          enable_proactive_nudges?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_contact_annotations: {
        Row: {
          created_at: string | null
          custom_address: string | null
          custom_birthday: string | null
          custom_company: string | null
          custom_email: string | null
          custom_notes: string | null
          custom_phone: string | null
          custom_role: string | null
          custom_tags: string[] | null
          id: string
          interaction_count: number | null
          is_blocked: boolean | null
          is_favorite: boolean | null
          last_interaction_at: string | null
          nickname: string | null
          target_user_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_address?: string | null
          custom_birthday?: string | null
          custom_company?: string | null
          custom_email?: string | null
          custom_notes?: string | null
          custom_phone?: string | null
          custom_role?: string | null
          custom_tags?: string[] | null
          id?: string
          interaction_count?: number | null
          is_blocked?: boolean | null
          is_favorite?: boolean | null
          last_interaction_at?: string | null
          nickname?: string | null
          target_user_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_address?: string | null
          custom_birthday?: string | null
          custom_company?: string | null
          custom_email?: string | null
          custom_notes?: string | null
          custom_phone?: string | null
          custom_role?: string | null
          custom_tags?: string[] | null
          id?: string
          interaction_count?: number | null
          is_blocked?: boolean | null
          is_favorite?: boolean | null
          last_interaction_at?: string | null
          nickname?: string | null
          target_user_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_gmail_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expiry_date: number | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_google_contacts_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expiry_date: number | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expiry_date: number | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          accuracy_m: number | null
          heading: number | null
          is_sharing: boolean
          lat: number
          lng: number
          location_label: string | null
          speed_kmh: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          heading?: number | null
          is_sharing?: boolean
          lat: number
          lng: number
          location_label?: string | null
          speed_kmh?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          heading?: number | null
          is_sharing?: boolean
          lat?: number
          lng?: number
          location_label?: string | null
          speed_kmh?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_message_statistics: {
        Row: {
          active_conversations: string[] | null
          created_at: string | null
          decisions_made: number | null
          fast_responses: number | null
          id: string
          last_login_date: string | null
          login_streak: number | null
          messages_sent: number | null
          people_helped: string[] | null
          tasks_created: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_conversations?: string[] | null
          created_at?: string | null
          decisions_made?: number | null
          fast_responses?: number | null
          id?: string
          last_login_date?: string | null
          login_streak?: number | null
          messages_sent?: number | null
          people_helped?: string[] | null
          tasks_created?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_conversations?: string[] | null
          created_at?: string | null
          decisions_made?: number | null
          fast_responses?: number | null
          id?: string
          last_login_date?: string | null
          login_streak?: number | null
          messages_sent?: number | null
          people_helped?: string[] | null
          tasks_created?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_microsoft_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expiry_date: number | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expiry_date?: number | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_openai_keys: {
        Row: {
          created_at: string
          key_hint: string
          last_validated_at: string | null
          last_validation_ok: boolean | null
          updated_at: string
          user_id: string
          vault_secret_id: string
        }
        Insert: {
          created_at?: string
          key_hint: string
          last_validated_at?: string | null
          last_validation_ok?: boolean | null
          updated_at?: string
          user_id: string
          vault_secret_id: string
        }
        Update: {
          created_at?: string
          key_hint?: string
          last_validated_at?: string | null
          last_validation_ok?: boolean | null
          updated_at?: string
          user_id?: string
          vault_secret_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          full_name: string | null
          groups_count: number | null
          handle: string | null
          id: string
          is_public: boolean | null
          is_verified: boolean | null
          language: string
          last_active_at: string | null
          last_seen_at: string | null
          messages_count: number | null
          online_status: string | null
          phone: string | null
          role: string | null
          settings: Json | null
          status: string | null
          timezone: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          full_name?: string | null
          groups_count?: number | null
          handle?: string | null
          id: string
          is_public?: boolean | null
          is_verified?: boolean | null
          language?: string
          last_active_at?: string | null
          last_seen_at?: string | null
          messages_count?: number | null
          online_status?: string | null
          phone?: string | null
          role?: string | null
          settings?: Json | null
          status?: string | null
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          full_name?: string | null
          groups_count?: number | null
          handle?: string | null
          id?: string
          is_public?: boolean | null
          is_verified?: boolean | null
          language?: string
          last_active_at?: string | null
          last_seen_at?: string | null
          messages_count?: number | null
          online_status?: string | null
          phone?: string | null
          role?: string | null
          settings?: Json | null
          status?: string | null
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_retention_cohorts: {
        Row: {
          cohort_date: string
          created_at: string | null
          id: string
          returned_day_1: boolean | null
          returned_day_30: boolean | null
          returned_day_7: boolean | null
          total_messages_clicked: number | null
          total_messages_seen: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cohort_date: string
          created_at?: string | null
          id?: string
          returned_day_1?: boolean | null
          returned_day_30?: boolean | null
          returned_day_7?: boolean | null
          total_messages_clicked?: number | null
          total_messages_seen?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cohort_date?: string
          created_at?: string | null
          id?: string
          returned_day_1?: boolean | null
          returned_day_30?: boolean | null
          returned_day_7?: boolean | null
          total_messages_clicked?: number | null
          total_messages_seen?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          access_token_prefix: string
          browser_name: string | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          is_current: boolean | null
          last_active_at: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          metadata: Json | null
          mfa_verified: boolean | null
          os_name: string | null
          refresh_token_prefix: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          session_hash: string | null
          timezone: string | null
          trusted: boolean | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_token_prefix: string
          browser_name?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          is_current?: boolean | null
          last_active_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          metadata?: Json | null
          mfa_verified?: boolean | null
          os_name?: string | null
          refresh_token_prefix?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          session_hash?: string | null
          timezone?: string | null
          trusted?: boolean | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_token_prefix?: string
          browser_name?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          is_current?: boolean | null
          last_active_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          metadata?: Json | null
          mfa_verified?: boolean | null
          os_name?: string | null
          refresh_token_prefix?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          session_hash?: string | null
          timezone?: string | null
          trusted?: boolean | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_slack_tokens: {
        Row: {
          access_token: string
          bot_user_id: string | null
          created_at: string | null
          scope: string | null
          slack_team_id: string | null
          slack_user_id: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          bot_user_id?: string | null
          created_at?: string | null
          scope?: string | null
          slack_team_id?: string | null
          slack_user_id?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          bot_user_id?: string | null
          created_at?: string | null
          scope?: string | null
          slack_team_id?: string | null
          slack_user_id?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_id: string | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_teams: {
        Row: {
          avatar_color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          name: string | null
          role: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          name?: string | null
          role?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          name?: string | null
          role?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_responder: {
        Row: {
          created_at: string
          enabled: boolean | null
          end_date: string
          id: string
          last_sent_at: string | null
          message_html: string
          message_text: string
          only_contacts: boolean | null
          only_first_email: boolean | null
          start_date: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          end_date: string
          id?: string
          last_sent_at?: string | null
          message_html: string
          message_text: string
          only_contacts?: boolean | null
          only_first_email?: boolean | null
          start_date: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          end_date?: string
          id?: string
          last_sent_at?: string | null
          message_html?: string
          message_text?: string
          only_contacts?: boolean | null
          only_first_email?: boolean | null
          start_date?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vacation_responder_log: {
        Row: {
          id: string
          original_email_id: string | null
          recipient_email: string
          responder_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          original_email_id?: string | null
          recipient_email: string
          responder_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          original_email_id?: string | null
          recipient_email?: string
          responder_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_responder_log_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "vacation_responder"
            referencedColumns: ["id"]
          },
        ]
      }
      video_vox_ai_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          message_id: string | null
          started_at: string | null
          status: string
          tasks: string[] | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message_id?: string | null
          started_at?: string | null
          status?: string
          tasks?: string[] | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message_id?: string | null
          started_at?: string | null
          status?: string
          tasks?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_ai_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "video_vox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_ai_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "video_vox_messages_with_reactions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_vox_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          message_id: string | null
          note: string | null
          timestamp: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          note?: string | null
          timestamp?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          note?: string | null
          timestamp?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages_with_reactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      video_vox_conversation_members: {
        Row: {
          conversation_id: string | null
          id: string
          is_muted: boolean | null
          joined_at: string | null
          last_read_at: string | null
          unread_count: number | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          unread_count?: number | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          unread_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "video_vox_conversation_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "video_vox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      video_vox_conversations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_id: string | null
          participant_ids: string[]
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          participant_ids: string[]
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          participant_ids?: string[]
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_conversations_last_message_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_conversations_last_message_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages_with_reactions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_vox_messages: {
        Row: {
          action_items: string[] | null
          caption: string | null
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          duration: number
          expires_at: string | null
          file_size: number | null
          height: number | null
          id: string
          mentions: string[] | null
          metadata: Json | null
          processing_status: string | null
          quoted_text: string | null
          reply_to_id: string | null
          reply_to_timestamp: number | null
          sender_avatar_url: string | null
          sender_handle: string | null
          sender_id: string | null
          sender_name: string
          sentiment: string | null
          status: string
          summary: string | null
          thread_count: number | null
          thumbnail_url: string
          topics: string[] | null
          transcript: string | null
          video_url: string
          width: number | null
        }
        Insert: {
          action_items?: string[] | null
          caption?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          duration: number
          expires_at?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          mentions?: string[] | null
          metadata?: Json | null
          processing_status?: string | null
          quoted_text?: string | null
          reply_to_id?: string | null
          reply_to_timestamp?: number | null
          sender_avatar_url?: string | null
          sender_handle?: string | null
          sender_id?: string | null
          sender_name: string
          sentiment?: string | null
          status?: string
          summary?: string | null
          thread_count?: number | null
          thumbnail_url: string
          topics?: string[] | null
          transcript?: string | null
          video_url: string
          width?: number | null
        }
        Update: {
          action_items?: string[] | null
          caption?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          duration?: number
          expires_at?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          mentions?: string[] | null
          metadata?: Json | null
          processing_status?: string | null
          quoted_text?: string | null
          reply_to_id?: string | null
          reply_to_timestamp?: number | null
          sender_avatar_url?: string | null
          sender_handle?: string | null
          sender_id?: string | null
          sender_name?: string
          sentiment?: string | null
          status?: string
          summary?: string | null
          thread_count?: number | null
          thumbnail_url?: string
          topics?: string[] | null
          transcript?: string | null
          video_url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "video_vox_conversation_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "video_vox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages_with_reactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      video_vox_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string | null
          timestamp: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id?: string | null
          timestamp?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string | null
          timestamp?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages_with_reactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      video_vox_read_receipts: {
        Row: {
          completed: boolean | null
          id: string
          message_id: string | null
          user_id: string | null
          viewed_at: string | null
          watch_duration: number | null
        }
        Insert: {
          completed?: boolean | null
          id?: string
          message_id?: string | null
          user_id?: string | null
          viewed_at?: string | null
          watch_duration?: number | null
        }
        Update: {
          completed?: boolean | null
          id?: string
          message_id?: string | null
          user_id?: string | null
          viewed_at?: string | null
          watch_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages_with_reactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_message_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          message_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_message_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_message_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_reminders: {
        Row: {
          created_at: string
          fired_at: string | null
          id: string
          note: string | null
          remind_at: string
          source_id: string
          status: string
          updated_at: string
          user_id: string
          voice_kind: string
        }
        Insert: {
          created_at?: string
          fired_at?: string | null
          id?: string
          note?: string | null
          remind_at: string
          source_id: string
          status?: string
          updated_at?: string
          user_id: string
          voice_kind: string
        }
        Update: {
          created_at?: string
          fired_at?: string | null
          id?: string
          note?: string | null
          remind_at?: string
          source_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          voice_kind?: string
        }
        Relationships: []
      }
      voice_room_participants: {
        Row: {
          avatar_color: string | null
          is_muted: boolean
          is_speaking: boolean
          joined_at: string
          room_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          avatar_color?: string | null
          is_muted?: boolean
          is_speaking?: boolean
          joined_at?: string
          room_id: string
          user_id: string
          user_name: string
        }
        Update: {
          avatar_color?: string | null
          is_muted?: boolean
          is_speaking?: boolean
          joined_at?: string
          room_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_rooms: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_private: boolean
          max_participants: number
          name: string
          settings: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean
          max_participants?: number
          name: string
          settings?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean
          max_participants?: number
          name?: string
          settings?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      voice_thread_messages: {
        Row: {
          audio_url: string
          created_at: string | null
          deleted_at: string | null
          duration: number
          edited_at: string | null
          forwarded_from_message_id: string | null
          forwarded_from_thread_id: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          is_pinned: boolean | null
          pinned_at: string | null
          pinned_by: string | null
          quoted_text: string | null
          read_by: string[] | null
          reply_to_id: string | null
          reply_to_timestamp: number | null
          sender_id: string | null
          sender_name: string
          thread_id: string | null
          transcript: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          deleted_at?: string | null
          duration: number
          edited_at?: string | null
          forwarded_from_message_id?: string | null
          forwarded_from_thread_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          quoted_text?: string | null
          read_by?: string[] | null
          reply_to_id?: string | null
          reply_to_timestamp?: number | null
          sender_id?: string | null
          sender_name: string
          thread_id?: string | null
          transcript?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          deleted_at?: string | null
          duration?: number
          edited_at?: string | null
          forwarded_from_message_id?: string | null
          forwarded_from_thread_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          quoted_text?: string | null
          read_by?: string[] | null
          reply_to_id?: string | null
          reply_to_timestamp?: number | null
          sender_id?: string | null
          sender_name?: string
          thread_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_message_id_fkey"
            columns: ["forwarded_from_message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_message_id_fkey"
            columns: ["forwarded_from_message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_thread_id_fkey"
            columns: ["forwarded_from_thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_thread_id_fkey"
            columns: ["forwarded_from_thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_thread_participants: {
        Row: {
          id: string
          is_muted: boolean | null
          joined_at: string | null
          last_read_at: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_thread_tags: {
        Row: {
          created_at: string | null
          id: string
          tag: string
          thread_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          tag: string
          thread_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          tag?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_thread_tags_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_tags_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_threads: {
        Row: {
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_pinned: boolean | null
          last_activity_at: string | null
          message_count: number | null
          participants: string[]
          root_message_id: string | null
          status: string | null
          subject: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string | null
          message_count?: number | null
          participants: string[]
          root_message_id?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string | null
          message_count?: number | null
          participants?: string[]
          root_message_id?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_drops: {
        Row: {
          audio_url: string
          created_at: string | null
          delivered_at: string | null
          duration: number
          id: string
          is_recurring: boolean | null
          message: string | null
          recipient_ids: string[]
          recurring_pattern: Json | null
          reveal_condition: Json | null
          scheduled_for: string
          sender_id: string
          status: string
          title: string | null
          transcript: string | null
          workspace_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          delivered_at?: string | null
          duration: number
          id?: string
          is_recurring?: boolean | null
          message?: string | null
          recipient_ids: string[]
          recurring_pattern?: Json | null
          reveal_condition?: Json | null
          scheduled_for: string
          sender_id: string
          status?: string
          title?: string | null
          transcript?: string | null
          workspace_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          delivered_at?: string | null
          duration?: number
          id?: string
          is_recurring?: boolean | null
          message?: string | null
          recipient_ids?: string[]
          recurring_pattern?: Json | null
          reveal_condition?: Json | null
          scheduled_for?: string
          sender_id?: string
          status?: string
          title?: string | null
          transcript?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_drops_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_notes: {
        Row: {
          audio_url: string
          created_at: string | null
          duration: number
          id: string
          is_favorite: boolean | null
          linked_items: Json | null
          summary: string | null
          tags: string[] | null
          title: string | null
          transcript: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          duration: number
          id?: string
          is_favorite?: boolean | null
          linked_items?: Json | null
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          transcript?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          duration?: number
          id?: string
          is_favorite?: boolean | null
          linked_items?: Json | null
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          transcript?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_read: boolean | null
          related_vox_id: string | null
          sender_id: string | null
          sender_name: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          related_vox_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          related_vox_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      vox_team_channels: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_pinned: boolean | null
          last_message_at: string | null
          member_ids: string[] | null
          name: string
          type: string
          unread_count: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          member_ids?: string[] | null
          name: string
          type?: string
          unread_count?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          member_ids?: string[] | null
          name?: string
          type?: string
          unread_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_team_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      voxer_recordings: {
        Row: {
          analysis: Json | null
          audio_url: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          duration: number
          id: string
          is_outgoing: boolean
          notes: Json | null
          played: boolean
          recorded_at: string
          search_vector: unknown
          starred: boolean
          tags: string[] | null
          title: string | null
          transcript: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          analysis?: Json | null
          audio_url?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          duration?: number
          id?: string
          is_outgoing?: boolean
          notes?: Json | null
          played?: boolean
          recorded_at?: string
          search_vector?: unknown
          starred?: boolean
          tags?: string[] | null
          title?: string | null
          transcript?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          analysis?: Json | null
          audio_url?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          duration?: number
          id?: string
          is_outgoing?: boolean
          notes?: Json | null
          played?: boolean
          recorded_at?: string
          search_vector?: unknown
          starred?: boolean
          tags?: string[] | null
          title?: string | null
          transcript?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voxer_recordings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_count: number
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_headers: Json | null
          response_status: number | null
          status: string
          triggered_at: string
          webhook_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          status?: string
          triggered_at?: string
          webhook_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          status?: string
          triggered_at?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          consecutive_failures: number
          created_at: string
          custom_headers: Json
          events: string[]
          filters: Json | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          secret: string
          updated_at: string
          url: string
          user_id: string | null
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          custom_headers?: Json
          events: string[]
          filters?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          secret: string
          updated_at?: string
          url: string
          user_id?: string | null
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          custom_headers?: Json
          events?: string[]
          filters?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      wins_tracker: {
        Row: {
          celebrated: boolean | null
          celebration_message: string | null
          channel: string | null
          created_at: string | null
          detected_at: string
          id: string
          mentioned_by_contact: string | null
          mentioned_in_message_id: string | null
          user_id: string
          win_description: string | null
          win_title: string
          win_type: string | null
        }
        Insert: {
          celebrated?: boolean | null
          celebration_message?: string | null
          channel?: string | null
          created_at?: string | null
          detected_at: string
          id?: string
          mentioned_by_contact?: string | null
          mentioned_in_message_id?: string | null
          user_id: string
          win_description?: string | null
          win_title: string
          win_type?: string | null
        }
        Update: {
          celebrated?: boolean | null
          celebration_message?: string | null
          channel?: string | null
          created_at?: string | null
          detected_at?: string
          id?: string
          mentioned_by_contact?: string | null
          mentioned_in_message_id?: string | null
          user_id?: string
          win_description?: string | null
          win_title?: string
          win_type?: string | null
        }
        Relationships: []
      }
      workspace_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: number
          metadata: Json | null
          target_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: never
          metadata?: Json | null
          target_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: never
          metadata?: Json | null
          target_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_contacts: {
        Row: {
          contact_id: string
          shared_at: string
          shared_by: string | null
          workspace_id: string
        }
        Insert: {
          contact_id: string
          shared_at?: string
          shared_by?: string | null
          workspace_id: string
        }
        Update: {
          contact_id?: string
          shared_at?: string
          shared_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_group_members: {
        Row: {
          added_at: string
          added_by: string | null
          group_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          group_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "workspace_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_groups: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_integrations: {
        Row: {
          connected_by: string | null
          created_at: string
          id: string
          integration_key: string
          is_enabled: boolean
          notes: string | null
          scope: string
          shared_config: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          id?: string
          integration_key: string
          is_enabled?: boolean
          notes?: string | null
          scope?: string
          shared_config?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          id?: string
          integration_key?: string
          is_enabled?: boolean
          notes?: string | null
          scope?: string
          shared_config?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_outcomes: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          goal: string
          id: string
          metadata: Json | null
          progress: number
          status: string
          target_date: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          goal: string
          id?: string
          metadata?: Json | null
          progress?: number
          status?: string
          target_date?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          goal?: string
          id?: string
          metadata?: Json | null
          progress?: number
          status?: string
          target_date?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      workspace_participants: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string | null
          public_key: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          public_key: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          public_key?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_participants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "ephemeral_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          key: string
          name: string
          rank: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          rank?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          rank?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          audit_json: Json
          data_controls_json: Json
          security_json: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          audit_json?: Json
          data_controls_json?: Json
          security_json?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          audit_json?: Json
          data_controls_json?: Json
          security_json?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          ai_allowed_providers: Json
          ai_output_retention_days: number
          ai_pii_masking_enforced: boolean
          auto_join_domain: string | null
          auto_join_enabled: boolean | null
          avatar_url: string | null
          billing_address: Json | null
          billing_contacts: string[]
          billing_cycle_anchor: string | null
          billing_email: string | null
          billing_name: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          enforce_2fa: boolean
          id: string
          industry: string | null
          ip_allowlist: Json
          legal_hold: boolean
          legal_name: string | null
          name: string
          onboarding_step: string
          owner_id: string
          parent_workspace_id: string | null
          plan: string
          session_timeout_minutes: number
          size_bucket: string | null
          slug: string | null
          stripe_customer_id: string | null
          tax_id: string | null
          tax_id_type: string | null
          tax_id_value: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          ai_allowed_providers?: Json
          ai_output_retention_days?: number
          ai_pii_masking_enforced?: boolean
          auto_join_domain?: string | null
          auto_join_enabled?: boolean | null
          avatar_url?: string | null
          billing_address?: Json | null
          billing_contacts?: string[]
          billing_cycle_anchor?: string | null
          billing_email?: string | null
          billing_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          enforce_2fa?: boolean
          id?: string
          industry?: string | null
          ip_allowlist?: Json
          legal_hold?: boolean
          legal_name?: string | null
          name: string
          onboarding_step?: string
          owner_id: string
          parent_workspace_id?: string | null
          plan?: string
          session_timeout_minutes?: number
          size_bucket?: string | null
          slug?: string | null
          stripe_customer_id?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          tax_id_value?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_allowed_providers?: Json
          ai_output_retention_days?: number
          ai_pii_masking_enforced?: boolean
          auto_join_domain?: string | null
          auto_join_enabled?: boolean | null
          avatar_url?: string | null
          billing_address?: Json | null
          billing_contacts?: string[]
          billing_cycle_anchor?: string | null
          billing_email?: string | null
          billing_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          enforce_2fa?: boolean
          id?: string
          industry?: string | null
          ip_allowlist?: Json
          legal_hold?: boolean
          legal_name?: string | null
          name?: string
          onboarding_step?: string
          owner_id?: string
          parent_workspace_id?: string | null
          plan?: string
          session_timeout_minutes?: number
          size_bucket?: string | null
          slug?: string | null
          stripe_customer_id?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          tax_id_value?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_parent_workspace_id_fkey"
            columns: ["parent_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_sessions_summary: {
        Row: {
          active_session_count: number | null
          countries: string[] | null
          device_types: string[] | null
          most_recent_activity: string | null
          user_id: string | null
        }
        Relationships: []
      }
      unified_search_view: {
        Row: {
          content: string | null
          id: string | null
          metadata: Json | null
          result_timestamp: string | null
          result_type: string | null
          sender: string | null
          sender_email: string | null
          source: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
      user_active_sessions: {
        Row: {
          browser_name: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          expires_at: string | null
          id: string | null
          ip_address: unknown
          is_current: boolean | null
          last_active_at: string | null
          location: string | null
          mfa_verified: boolean | null
          os_name: string | null
          trusted: boolean | null
          user_id: string | null
        }
        Insert: {
          browser_name?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string | null
          ip_address?: unknown
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          mfa_verified?: boolean | null
          os_name?: string | null
          trusted?: boolean | null
          user_id?: string | null
        }
        Update: {
          browser_name?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string | null
          ip_address?: unknown
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          mfa_verified?: boolean | null
          os_name?: string | null
          trusted?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      video_vox_conversation_list: {
        Row: {
          created_at: string | null
          id: string | null
          last_message_at: string | null
          last_message_caption: string | null
          last_message_duration: number | null
          last_message_sender: string | null
          last_message_thumbnail: string | null
          participant_ids: string[] | null
          title: string | null
        }
        Relationships: []
      }
      video_vox_messages_with_reactions: {
        Row: {
          action_items: string[] | null
          caption: string | null
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          duration: number | null
          expires_at: string | null
          file_size: number | null
          height: number | null
          id: string | null
          mentions: string[] | null
          metadata: Json | null
          processing_status: string | null
          quoted_text: string | null
          reaction_counts: Json | null
          reply_to_id: string | null
          reply_to_timestamp: number | null
          sender_avatar_url: string | null
          sender_handle: string | null
          sender_id: string | null
          sender_name: string | null
          sentiment: string | null
          status: string | null
          summary: string | null
          thread_count: number | null
          thumbnail_url: string | null
          topics: string[] | null
          transcript: string | null
          video_url: string | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_vox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "video_vox_conversation_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "video_vox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "video_vox_messages_with_reactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_vox_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "pulse_users"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_thread_messages_with_metadata: {
        Row: {
          audio_url: string | null
          bookmark_count: number | null
          created_at: string | null
          deleted_at: string | null
          duration: number | null
          edited_at: string | null
          forwarded_from_message_id: string | null
          forwarded_from_thread_id: string | null
          id: string | null
          is_deleted: boolean | null
          is_edited: boolean | null
          is_forwarded: boolean | null
          is_pinned: boolean | null
          pinned_at: string | null
          pinned_by: string | null
          quoted_text: string | null
          reaction_counts: Json | null
          read_by: string[] | null
          reply_to_id: string | null
          reply_to_timestamp: number | null
          sender_id: string | null
          sender_name: string | null
          thread_id: string | null
          transcript: string | null
        }
        Insert: {
          audio_url?: string | null
          bookmark_count?: never
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          edited_at?: string | null
          forwarded_from_message_id?: string | null
          forwarded_from_thread_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_forwarded?: never
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          quoted_text?: string | null
          reaction_counts?: never
          read_by?: string[] | null
          reply_to_id?: string | null
          reply_to_timestamp?: number | null
          sender_id?: string | null
          sender_name?: string | null
          thread_id?: string | null
          transcript?: string | null
        }
        Update: {
          audio_url?: string | null
          bookmark_count?: never
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          edited_at?: string | null
          forwarded_from_message_id?: string | null
          forwarded_from_thread_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_forwarded?: never
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          quoted_text?: string | null
          reaction_counts?: never
          read_by?: string[] | null
          reply_to_id?: string | null
          reply_to_timestamp?: number | null
          sender_id?: string | null
          sender_name?: string | null
          thread_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_message_id_fkey"
            columns: ["forwarded_from_message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_message_id_fkey"
            columns: ["forwarded_from_message_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_thread_id_fkey"
            columns: ["forwarded_from_thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_forwarded_from_thread_id_fkey"
            columns: ["forwarded_from_thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "voice_thread_messages_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "voice_threads_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_threads_batch_stats: {
        Row: {
          avg_messages_per_thread: number | null
          max_messages_in_thread: number | null
          total_messages: number | null
          total_reactions: number | null
          total_tags: number | null
          total_threads: number | null
        }
        Relationships: []
      }
      voice_threads_with_metadata: {
        Row: {
          created_at: string | null
          id: string | null
          is_archived: boolean | null
          is_pinned: boolean | null
          last_activity_at: string | null
          message_count: number | null
          participant_metadata: Json | null
          participants: string[] | null
          root_message_id: string | null
          status: string | null
          subject: string | null
          total_messages: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_archived?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string | null
          message_count?: number | null
          participant_metadata?: never
          participants?: string[] | null
          root_message_id?: string | null
          status?: string | null
          subject?: string | null
          total_messages?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_archived?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string | null
          message_count?: number | null
          participant_metadata?: never
          participants?: string[] | null
          root_message_id?: string | null
          status?: string | null
          subject?: string | null
          total_messages?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _assert_caller_is: { Args: { p_user_id: string }; Returns: undefined }
      accept_workspace_invite: { Args: { p_token: string }; Returns: Json }
      acknowledge_alert: {
        Args: { p_alert_id: string; p_user_id: string }
        Returns: boolean
      }
      add_slack_channel_reaction: {
        Args: {
          p_emoji: string
          p_owner_pulse_id: string
          p_reactor: string
          p_slack_channel_id: string
          p_slack_ts: string
          p_team_id: string
        }
        Returns: string
      }
      advance_contact_goal: { Args: { p_goal_id: string }; Returns: undefined }
      assign_role: {
        Args: {
          p_expires_at?: string
          p_granted_by?: string
          p_role_id: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_detect_event_type: {
        Args: { p_description?: string; p_location?: string; p_title: string }
        Returns: string
      }
      backfill_slack_channel_message: {
        Args: {
          p_channel_name: string
          p_display_name?: string
          p_email?: string
          p_is_private: boolean
          p_owner_pulse_id: string
          p_sender_slack_id: string
          p_slack_channel_id: string
          p_slack_thread_ts?: string
          p_slack_ts: string
          p_team_id: string
          p_text: string
        }
        Returns: string
      }
      bootstrap_workspace: {
        Args: {
          p_description?: string
          p_id?: string
          p_name: string
          p_plan?: string
          p_slug: string
        }
        Returns: string
      }
      cache_summary: {
        Args: {
          p_reference_id: string
          p_summary_data: Json
          p_summary_type: string
          p_ttl_minutes?: number
        }
        Returns: undefined
      }
      calculate_customer_health: {
        Args: {
          p_customer_id: string
          p_deal_progress_factor?: number
          p_engagement_factor?: number
          p_interaction_count_30d?: number
          p_last_interaction?: string
          p_responsiveness_factor?: number
          p_sentiment_factor?: number
          p_task_completion_factor?: number
        }
        Returns: {
          calculated_at: string
          created_at: string
          customer_id: string
          deal_progress_factor: number
          engagement_factor: number
          health_label: string
          health_score: number
          id: string
          interaction_count_30d: number
          last_interaction: string | null
          responsiveness_factor: number
          sentiment_factor: number
          sentiment_trend: string
          task_completion_factor: number
          trend_direction: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customer_health"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_engagement_score: {
        Args: {
          p_avg_response_time: number
          p_avg_sentiment: number
          p_days_since_last: number
          p_response_rate: number
          p_total_messages: number
        }
        Returns: number
      }
      calculate_engagement_trend: {
        Args: { p_channel_id: string; p_user_id: string }
        Returns: string
      }
      calculate_next_cleanup_time: {
        Args: { p_cleanup_time_utc: string; p_from_time?: string }
        Returns: string
      }
      calculate_relationship_health_score: {
        Args: {
          p_conversation_count_30d: number
          p_days_since_last: number
          p_message_count_30d: number
          p_reciprocity_score: number
          p_sentiment_balance: number
        }
        Returns: number
      }
      calculate_relationship_score: {
        Args: {
          p_avg_response_hours: number
          p_days_since_interaction: number
          p_response_rate: number
          p_sentiment_avg: number
          p_total_interactions: number
        }
        Returns: number
      }
      calculate_response_rate: {
        Args: { p_contact_identifier: string; p_user_id: string }
        Returns: number
      }
      check_and_increment_gemini_rate_limit: {
        Args: { p_user_id: string; p_window_start: string }
        Returns: number
      }
      check_filter_match: {
        Args: {
          p_email: Record<string, unknown>
          p_filter: Record<string, unknown>
        }
        Returns: boolean
      }
      cleanup_expired_ai_insights: { Args: never; Returns: number }
      cleanup_expired_brainstorm_cache: { Args: never; Returns: undefined }
      cleanup_expired_exports: { Args: never; Returns: undefined }
      cleanup_expired_feed_items: { Args: never; Returns: number }
      cleanup_expired_sessions: {
        Args: never
        Returns: {
          deleted_count: number
          expired_count: number
        }[]
      }
      cleanup_expired_suggestions: { Args: never; Returns: undefined }
      cleanup_expired_summaries: { Args: never; Returns: undefined }
      cleanup_inactive_push_subscriptions: { Args: never; Returns: number }
      cleanup_old_activity_logs:
        | { Args: never; Returns: number }
        | { Args: { retention_days?: number }; Returns: undefined }
      cleanup_old_filter_logs: { Args: never; Returns: undefined }
      cleanup_old_intelligence_history: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_request_logs: { Args: never; Returns: undefined }
      cm_is_channel_admin: {
        Args: { ch_id: string; uid: string }
        Returns: boolean
      }
      cm_is_channel_member: {
        Args: { ch_id: string; uid: string }
        Returns: boolean
      }
      complete_integration_sync: {
        Args: {
          p_error_details?: Json
          p_records_failed: number
          p_records_processed: number
          p_records_succeeded: number
          p_status?: string
          p_sync_id: string
        }
        Returns: {
          completed_at: string | null
          direction: string
          entity_type: string | null
          error_details: Json | null
          id: string
          integration_id: string
          records_failed: number
          records_processed: number
          records_succeeded: number
          started_at: string
          status: string
          sync_type: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_sync_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_booking: {
        Args: {
          p_email: string
          p_end: string
          p_name: string
          p_notes?: string
          p_page_id: string
          p_start: string
        }
        Returns: {
          booker_email: string
          booker_name: string
          booker_notes: string | null
          created_at: string
          event_id: string | null
          id: string
          page_id: string
          proposed_end: string
          proposed_start: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "booking_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_child_workspace: {
        Args: { p_description?: string; p_name: string; p_parent_id: string }
        Returns: {
          ai_allowed_providers: Json
          ai_output_retention_days: number
          ai_pii_masking_enforced: boolean
          auto_join_domain: string | null
          auto_join_enabled: boolean | null
          avatar_url: string | null
          billing_address: Json | null
          billing_contacts: string[]
          billing_cycle_anchor: string | null
          billing_email: string | null
          billing_name: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          enforce_2fa: boolean
          id: string
          industry: string | null
          ip_allowlist: Json
          legal_hold: boolean
          legal_name: string | null
          name: string
          onboarding_step: string
          owner_id: string
          parent_workspace_id: string | null
          plan: string
          session_timeout_minutes: number
          size_bucket: string | null
          slug: string | null
          stripe_customer_id: string | null
          tax_id: string | null
          tax_id_type: string | null
          tax_id_value: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_custom_role: {
        Args: {
          p_description: string
          p_display_name: string
          p_name: string
          p_permissions: Json
          p_tenant_id: string
        }
        Returns: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          name: string
          permissions: Json
          tenant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_customer_alert: {
        Args: {
          p_alert_type: string
          p_context?: Json
          p_customer_id: string
          p_message: string
          p_severity: string
          p_suggested_action?: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          context: Json
          created_at: string
          customer_id: string
          id: string
          message: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          suggested_action: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customer_alerts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_org_for_user: {
        Args: { p_name: string; p_plan?: string; p_slug: string }
        Returns: string
      }
      create_webhook: {
        Args: {
          p_custom_headers?: Json
          p_events: string[]
          p_filters?: Json
          p_name: string
          p_url: string
        }
        Returns: {
          consecutive_failures: number
          created_at: string
          custom_headers: Json
          events: string[]
          filters: Json | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          secret: string
          updated_at: string
          url: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "webhooks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decrement_follower_count: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      decrement_following_count: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      delete_user_account: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      delete_user_openai_key: { Args: never; Returns: undefined }
      discover_pulse_users: {
        Args: {
          p_cursor?: string
          p_limit?: number
          p_query?: string
          p_workspace_id: string
        }
        Returns: {
          already_in_contacts: boolean
          avatar_url: string
          display_name: string
          handle: string
          joined_at: string
          online_status: string
          shared_workspace_id: string
          shared_workspace_role: string
          user_id: string
        }[]
      }
      edit_slack_channel_message: {
        Args: {
          p_owner_pulse_id: string
          p_slack_channel_id: string
          p_slack_ts: string
          p_team_id: string
          p_text: string
        }
        Returns: string
      }
      end_coaching_session: {
        Args: { p_session_id: string; p_talk_time_percentage?: number }
        Returns: boolean
      }
      ensure_pulse_user_for_auth: {
        Args: { p_auth_user_id: string }
        Returns: string
      }
      ensure_slack_shadow_user: {
        Args: {
          p_display_name?: string
          p_email?: string
          p_slack_user_id: string
          p_team_id: string
        }
        Returns: string
      }
      evaluate_all_customer_alerts: {
        Args: never
        Returns: {
          alerts_created: number
          customers_evaluated: number
        }[]
      }
      evaluate_customer_alerts: {
        Args: { p_customer_id: string }
        Returns: number
      }
      execute_data_cleanup: { Args: never; Returns: undefined }
      expire_old_invites: { Args: never; Returns: undefined }
      expire_old_sessions: { Args: never; Returns: undefined }
      generate_api_key: {
        Args: {
          p_expires_at?: string
          p_name: string
          p_rate_limit?: number
          p_scopes?: string[]
          p_user_id: string
        }
        Returns: {
          api_key: string
          key_id: string
          key_prefix: string
        }[]
      }
      generate_public_link: { Args: never; Returns: string }
      get_active_session_count: { Args: { p_user_id: string }; Returns: number }
      get_alert_statistics: {
        Args: never
        Returns: {
          avg_resolution_hours: number
          critical_count: number
          total_active: number
          unacknowledged_count: number
          warning_count: number
        }[]
      }
      get_alerts_by_type: {
        Args: never
        Returns: {
          active_count: number
          alert_type: string
          resolved_today: number
        }[]
      }
      get_analytics_dashboard: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          avg_response_time: number
          avg_sentiment: number
          channel_breakdown: Json
          daily_activity: Json
          messages_received: number
          messages_sent: number
          response_rate: number
          top_contacts: Json
          total_messages: number
        }[]
      }
      get_audit_statistics: {
        Args: { p_days?: number; p_tenant_id: string }
        Returns: {
          failure_count: number
          success_count: number
          top_action: string
          top_category: string
          total_events: number
          unique_users: number
        }[]
      }
      get_available_permissions: {
        Args: never
        Returns: {
          actions: string[]
          resource: string
        }[]
      }
      get_avg_response_time: {
        Args: { p_contact_identifier: string; p_user_id: string }
        Returns: number
      }
      get_batch_thread_unread_counts: {
        Args: { p_thread_ids: string[]; p_user_id: string }
        Returns: {
          thread_id: string
          unread_count: number
        }[]
      }
      get_blocked_tasks: {
        Args: { task_uuid: string }
        Returns: {
          blocked_task_id: string
        }[]
      }
      get_cached_summary: {
        Args: {
          p_reference_id: string
          p_summary_type: string
          p_user_id: string
        }
        Returns: {
          action_items: string[]
          decisions: string[]
          from_cache: boolean
          key_points: string[]
          message_count: number
          participants: string[]
          summary_text: string
        }[]
      }
      get_cleanup_eligible_count: {
        Args: {
          p_data_type: string
          p_retention_days: number
          p_user_id: string
        }
        Returns: number
      }
      get_coaching_stats: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          avg_talk_time: number
          top_prompt_type: string
          total_prompts_shown: number
          total_prompts_used: number
          total_sessions: number
          usage_rate: number
        }[]
      }
      get_communication_frequency: {
        Args: {
          p_first_interaction_at: string
          p_last_interaction_at: string
          p_total_interactions: number
        }
        Returns: string
      }
      get_communication_trends: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          avg_response_time: number
          avg_sentiment: number
          date: string
          received: number
          sent: number
          total_messages: number
        }[]
      }
      get_customer_avg_sentiment: {
        Args: { p_customer_id: string; p_days?: number }
        Returns: number
      }
      get_customers_needing_attention: {
        Args: { p_limit?: number }
        Returns: {
          customer_id: string
          days_since_interaction: number
          health_label: string
          health_score: number
          sentiment_trend: string
          top_concern: string
          trend_direction: number
        }[]
      }
      get_doc_by_public_link: {
        Args: { link: string }
        Returns: {
          doc_id: string
          permissions: Json
        }[]
      }
      get_doc_permissions: {
        Args: { check_doc_id: string; check_user_id: string }
        Returns: Json
      }
      get_due_autopilot_goals: {
        Args: { p_user_id: string }
        Returns: {
          autopilot_enabled: boolean
          channel: string
          contact_email: string
          contact_id: string
          created_at: string | null
          frequency: string
          id: string
          last_completed_at: string | null
          next_action_at: string
          notes: string | null
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "contact_goals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_enriched_user_profile: {
        Args: { p_requesting_user_id: string; p_target_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          birthday: string
          company: string
          custom_address: string
          custom_birthday: string
          custom_company: string
          custom_email: string
          custom_notes: string
          custom_phone: string
          custom_role: string
          custom_tags: string[]
          display_name: string
          email: string
          full_name: string
          handle: string
          id: string
          is_blocked: boolean
          is_favorite: boolean
          is_verified: boolean
          last_active_at: string
          last_seen_at: string
          location: string
          nickname: string
          online_status: string
          phone_number: string
          role: string
        }[]
      }
      get_enriched_workspace_members: {
        Args: { p_workspace_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          email: string
          full_name: string
          handle: string
          invited_by: string
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }[]
      }
      get_eta_share_by_token: {
        Args: { p_token: string }
        Returns: {
          destination_label: string
          destination_lat: number
          destination_lng: number
          ended_at: string
          expires_at: string
          id: string
          last_distance_m: number
          last_eta_seconds: number
          last_lat: number
          last_lng: number
          last_updated_at: string
          recipient_label: string
          started_at: string
          status: string
          token: string
        }[]
      }
      get_health_distribution: {
        Args: never
        Returns: {
          customer_count: number
          health_label: string
          percentage: number
        }[]
      }
      get_intelligence_summary: {
        Args: { p_channel_id: string; p_user_id: string }
        Returns: {
          engagement_trend: string
          followups: string[]
          last_updated: string
          sentiment: string
          sentiment_score: number
          topics: string[]
        }[]
      }
      get_last_active_status: { Args: { p_user_id: string }; Returns: string }
      get_lead_grade: { Args: { score: number }; Returns: string }
      get_message_metrics: {
        Args: { message_uuid: string }
        Returns: {
          avg_time_to_action: number
          click_rate: number
          open_rate: number
          total_clicked: number
          total_dismissed: number
          total_opened: number
          total_shown: number
        }[]
      }
      get_message_reaction_counts: {
        Args: { p_message_id: string }
        Returns: Json
      }
      get_online_users_count: { Args: never; Returns: number }
      get_or_create_annotation: {
        Args: { p_target_user_id: string; p_user_id: string }
        Returns: string
      }
      get_or_create_conversation: {
        Args: { user_a: string; user_b: string }
        Returns: string
      }
      get_or_create_dm_channel: {
        Args: { user1_id: string; user2_id: string }
        Returns: string
      }
      get_or_create_email_thread: {
        Args: { p_subject: string; p_thread_id: string; p_user_id: string }
        Returns: string
      }
      get_or_create_relationship_profile: {
        Args: {
          p_contact_email: string
          p_contact_name?: string
          p_user_id: string
        }
        Returns: string
      }
      get_or_create_slack_channel_thread: {
        Args: {
          p_channel_name?: string
          p_is_private?: boolean
          p_owner_pulse_id: string
          p_slack_channel_id: string
          p_team_id: string
        }
        Returns: string
      }
      get_or_create_slack_conversation: {
        Args: {
          p_external_display_name?: string
          p_external_email?: string
          p_external_slack_user_id?: string
          p_pulse_user_id: string
          p_shadow_id: string
        }
        Returns: string
      }
      get_or_create_thread_actions: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: {
          archived_at: string | null
          conversation_id: string
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          is_starred: boolean | null
          muted_at: string | null
          pinned_at: string | null
          starred_at: string | null
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "thread_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_video_vox_conversation: {
        Args: { p_created_by: string; p_participant_ids: string[] }
        Returns: string
      }
      get_retention_by_engagement: {
        Args: never
        Returns: {
          day_1_retention_rate: number
          day_30_retention_rate: number
          day_7_retention_rate: number
          engagement_level: string
          total_users: number
        }[]
      }
      get_retention_by_message_exposure: {
        Args: never
        Returns: {
          day_1_retention: number
          day_30_retention: number
          day_7_retention: number
          exposed_to_messages: boolean
          user_count: number
        }[]
      }
      get_retention_policy: {
        Args: { p_resource_type: string; p_tenant_id?: string }
        Returns: {
          archive_before_delete: boolean
          created_at: string
          id: string
          is_active: boolean
          notify_before_delete: boolean
          notify_days_before: number
          resource_type: string
          retention_days: number
          tenant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "retention_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_role_by_name: {
        Args: { p_role_name: string; p_tenant_id?: string }
        Returns: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          name: string
          permissions: Json
          tenant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_search_suggestions: {
        Args: { p_limit?: number; p_thread_id: string; partial_query: string }
        Returns: {
          frequency: number
          suggestion: string
        }[]
      }
      get_smart_collection_docs: {
        Args: { collection_id: string }
        Returns: {
          doc_id: string
        }[]
      }
      get_task_dependencies: {
        Args: { task_uuid: string }
        Returns: {
          dependency_path: string[]
          depends_on_id: string
          depth: number
          task_id: string
        }[]
      }
      get_thread_unread_count: {
        Args: { p_thread_id: string; p_user_id: string }
        Returns: number
      }
      get_user_permissions: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: Json
      }
      get_user_roles: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: {
          display_name: string
          expires_at: string
          granted_at: string
          is_system: boolean
          role_id: string
          role_name: string
        }[]
      }
      get_webhook_events: { Args: never; Returns: string[] }
      get_webhooks_for_event: {
        Args: { p_event_type: string }
        Returns: {
          consecutive_failures: number
          created_at: string
          custom_headers: Json
          events: string[]
          filters: Json | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          secret: string
          updated_at: string
          url: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "webhooks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_workspace_member_connections: {
        Args: { p_workspace_id: string }
        Returns: {
          app_count: number
          joined_at: string
          last_connected_at: string
          providers: string[]
          user_avatar_url: string
          user_email: string
          user_id: string
          user_name: string
          user_role: string
        }[]
      }
      get_workspace_sign_in_activity: {
        Args: { p_limit?: number; p_workspace_id: string }
        Returns: {
          browser_name: string
          created_at: string
          device_name: string
          device_type: string
          ip_address: unknown
          is_active: boolean
          is_current: boolean
          last_active_at: string
          location: string
          os_name: string
          revoked_at: string
          session_id: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_workspace_unread_count: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: number
      }
      graduate_slack_conversation: {
        Args: { p_shadow_conversation_id: string }
        Returns: string
      }
      hard_delete_workspace: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      health_score_to_label: { Args: { score: number }; Returns: string }
      increment_decision_template_usage: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      increment_follower_count: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      increment_following_count: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      increment_messages_clicked:
        | {
            Args: { user_uuid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.increment_messages_clicked(user_uuid => text), public.increment_messages_clicked(user_uuid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { user_uuid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.increment_messages_clicked(user_uuid => text), public.increment_messages_clicked(user_uuid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      increment_messages_seen:
        | {
            Args: { user_uuid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.increment_messages_seen(user_uuid => text), public.increment_messages_seen(user_uuid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { user_uuid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.increment_messages_seen(user_uuid => text), public.increment_messages_seen(user_uuid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      increment_search_usage: { Args: never; Returns: undefined }
      increment_session_counter: {
        Args: { p_column_name: string; p_session_id: string }
        Returns: undefined
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      increment_usage: {
        Args: {
          p_metric: string
          p_period_end: string
          p_period_start: string
          p_quantity: number
          p_workspace_id: string
        }
        Returns: undefined
      }
      increment_user_stat: {
        Args: { p_increment?: number; p_stat_name: string; p_user_id: string }
        Returns: undefined
      }
      increment_webhook_failures: {
        Args: { p_webhook_id: string }
        Returns: number
      }
      ingest_slack_channel_message: {
        Args: {
          p_channel_name: string
          p_display_name?: string
          p_email?: string
          p_is_private: boolean
          p_owner_pulse_id: string
          p_sender_slack_id: string
          p_slack_channel_id: string
          p_slack_thread_ts?: string
          p_slack_ts: string
          p_team_id: string
          p_text: string
        }
        Returns: string
      }
      ingest_slack_inbound_message: {
        Args: {
          p_display_name?: string
          p_email?: string
          p_owner_pulse_id: string
          p_sender_slack_id: string
          p_slack_channel: string
          p_slack_ts: string
          p_team_id: string
          p_text: string
        }
        Returns: string
      }
      initialize_user_smart_lists: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      invalidate_sso_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      invalidate_user_sso_sessions: {
        Args: { p_user_id: string }
        Returns: number
      }
      is_handle_available: { Args: { check_handle: string }; Returns: boolean }
      is_thread_participant: {
        Args: { thread_id: string; user_id: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_category: string
          p_changes?: Json
          p_details?: Json
          p_error_message?: string
          p_ip_address?: unknown
          p_request_id?: string
          p_resource_id?: string
          p_resource_type?: string
          p_session_id?: string
          p_status?: string
          p_tenant_id: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: {
          action: string
          category: string
          changes: Json | null
          created_at: string
          details: Json
          error_message: string | null
          id: string
          ip_address: unknown
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
          session_id: string | null
          status: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "audit_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_integration_sync: {
        Args: {
          p_direction: string
          p_entity_type?: string
          p_integration_id: string
          p_sync_type: string
        }
        Returns: {
          completed_at: string | null
          direction: string
          entity_type: string | null
          error_details: Json | null
          id: string
          integration_id: string
          records_failed: number
          records_processed: number
          records_succeeded: number
          started_at: string
          status: string
          sync_type: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_sync_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_current_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      mark_inactive_users: {
        Args: { p_timeout_minutes?: number }
        Returns: number
      }
      mark_messages_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      mark_quick_vox_delivered_all: { Args: never; Returns: undefined }
      mark_quick_vox_played: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      mark_thread_as_read: {
        Args: { p_thread_id: string; p_user_id: string }
        Returns: undefined
      }
      match_documents: {
        Args: {
          filter_doc_ids?: string[]
          filter_user_id?: string
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          doc_id: string
          doc_title: string
          doc_url: string
          id: string
          similarity: number
        }[]
      }
      normalize_email: { Args: { email: string }; Returns: string }
      notify_decision_voters: {
        Args: { p_decision_id: string }
        Returns: number
      }
      purge_deleted_relationships: {
        Args: { p_older_than_days?: number }
        Returns: number
      }
      query_audit_logs: {
        Args: {
          p_action?: string
          p_category?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_resource_type?: string
          p_start_date?: string
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: {
          action: string
          category: string
          created_at: string
          details: Json
          id: string
          resource_id: string
          resource_type: string
          status: string
          tenant_id: string
          user_id: string
        }[]
      }
      queue_billing_drift_entry: {
        Args: {
          p_error_message?: string
          p_expected_quantity?: number
          p_metadata?: Json
          p_observed_quantity?: number
          p_source: string
          p_workspace_id: string
        }
        Returns: string
      }
      read_user_openai_key: { Args: never; Returns: string }
      rebuild_entitlements: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      recalculate_all_engagement_scores: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      record_activity: {
        Args: {
          p_action: string
          p_actor_id: string
          p_details?: Json
          p_doc_id?: string
          p_project_id?: string
          p_user_id: string
        }
        Returns: string
      }
      record_summit_minutes: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_quantity: number
          p_session_id: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      remove_role: {
        Args: { p_role_id: string; p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
      remove_slack_channel_reaction: {
        Args: {
          p_emoji: string
          p_owner_pulse_id: string
          p_reactor: string
          p_slack_channel_id: string
          p_slack_ts: string
          p_team_id: string
        }
        Returns: string
      }
      reset_webhook_failures: {
        Args: { p_webhook_id: string }
        Returns: undefined
      }
      resolve_alert: {
        Args: {
          p_alert_id: string
          p_resolution_notes?: string
          p_user_id: string
        }
        Returns: boolean
      }
      resolve_pulse_user_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      resolve_pulse_user_id: { Args: { p_id: string }; Returns: string }
      resolve_room_for_join: {
        Args: { p_room_name: string }
        Returns: {
          room_name: string
          room_url: string
          status: string
          title: string
        }[]
      }
      restore_relationship: {
        Args: { p_relationship_id: string }
        Returns: boolean
      }
      restore_workspace: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      revoke_contact_card_cascade: {
        Args: { p_card_id: string; p_sender_user_id: string }
        Returns: Json
      }
      revoke_other_sessions: {
        Args: { p_current_session_id: string; p_user_id: string }
        Returns: undefined
      }
      save_user_openai_key: {
        Args: { p_hint: string; p_key: string }
        Returns: undefined
      }
      search_documents_by_embedding: {
        Args: {
          filter_date_from?: string
          filter_date_to?: string
          filter_source_types?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
          title: string
        }[]
      }
      search_embeddings: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          content_type: string
          id: string
          similarity: number
          source_id: string
          source_type: string
          text_content: string
        }[]
      }
      search_messages: {
        Args: {
          p_end_date?: string
          p_has_attachments?: boolean
          p_limit?: number
          p_offset?: number
          p_start_date?: string
          p_thread_id?: string
          search_query: string
        }
        Returns: {
          attachment_url: string
          created_at: string
          id: string
          rank: number
          sender: string
          text: string
          thread_id: string
        }[]
      }
      search_users: {
        Args: { limit_count?: number; search_query: string }
        Returns: {
          avatar_url: string
          display_name: string
          full_name: string
          handle: string
          id: string
          is_verified: boolean
        }[]
      }
      send_pulse_message: {
        Args: {
          p_content: string
          p_content_type?: string
          p_media_url?: string
          p_recipient_id: string
          p_sender_id: string
        }
        Returns: string
      }
      sentiment_score_to_label: { Args: { score: number }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_relationship: {
        Args: { p_deleted_by?: string; p_relationship_id: string }
        Returns: boolean
      }
      soft_delete_workspace: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      start_pulse_team_trial: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      toggle_thread_archive: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_thread_mute: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_thread_pin: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_thread_star: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      tombstone_slack_channel_message: {
        Args: {
          p_owner_pulse_id: string
          p_slack_channel_id: string
          p_slack_ts: string
          p_team_id: string
        }
        Returns: string
      }
      transfer_workspace_ownership: {
        Args: { p_new_owner_id: string; p_workspace_id: string }
        Returns: Json
      }
      update_contact_annotation: {
        Args: {
          p_custom_address?: string
          p_custom_birthday?: string
          p_custom_company?: string
          p_custom_email?: string
          p_custom_notes?: string
          p_custom_phone?: string
          p_custom_role?: string
          p_custom_tags?: string[]
          p_is_blocked?: boolean
          p_is_favorite?: boolean
          p_nickname?: string
          p_target_user_id: string
          p_user_id: string
        }
        Returns: string
      }
      update_contact_recency: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      update_daily_metrics: {
        Args: {
          p_channel: string
          p_date: string
          p_is_sent: boolean
          p_sentiment_score?: number
          p_user_id: string
        }
        Returns: undefined
      }
      update_user_presence: {
        Args: { p_status?: string; p_user_id: string }
        Returns: undefined
      }
      user_has_channel_access: { Args: { ch_id: string }; Returns: boolean }
      user_has_doc_access: {
        Args: { check_doc_id: string; check_user_id: string }
        Returns: boolean
      }
      user_has_permission:
        | {
            Args: {
              p_permission: string
              p_tenant_id: string
              p_user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_permission_key: string
              p_resource_id?: string
              p_workspace_id: string
            }
            Returns: boolean
          }
      user_has_workspace_access: { Args: { ws_id: string }; Returns: boolean }
      user_org_id: { Args: never; Returns: string }
      validate_api_key: {
        Args: { p_api_key: string }
        Returns: {
          error_message: string
          is_valid: boolean
          key_id: string
          scopes: string[]
          user_id: string
        }[]
      }
      write_workspace_audit: {
        Args: {
          p_action: string
          p_actor_id: string
          p_metadata?: Json
          p_target_id?: string
          p_workspace_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
