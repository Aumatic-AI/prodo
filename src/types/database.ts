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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_snapshots: {
        Row: {
          account_id: string
          captured_on: string
          followers: number | null
          id: string
          platform: string
          raw: Json | null
        }
        Insert: {
          account_id: string
          captured_on: string
          followers?: number | null
          id?: string
          platform: string
          raw?: Json | null
        }
        Update: {
          account_id?: string
          captured_on?: string
          followers?: number | null
          id?: string
          platform?: string
          raw?: Json | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent: string
          cost_usd: number
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          inngest_run_id: string | null
          input: Json | null
          media_id: string | null
          model: string | null
          output: Json | null
          plan_id: string | null
          plan_item_id: string | null
          status: string
          summary: string | null
          tokens_in: number | null
          tokens_out: number | null
          run_id: string | null
        }
        Insert: {
          agent: string
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          inngest_run_id?: string | null
          input?: Json | null
          media_id?: string | null
          model?: string | null
          output?: Json | null
          plan_id?: string | null
          plan_item_id?: string | null
          status?: string
          summary?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          run_id?: string | null
        }
        Update: {
          agent?: string
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          inngest_run_id?: string | null
          input?: Json | null
          media_id?: string | null
          model?: string | null
          output?: Json | null
          plan_id?: string | null
          plan_item_id?: string | null
          status?: string
          summary?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_plan_item_id_fkey"
            columns: ["plan_item_id"]
            isOneToOne: false
            referencedRelation: "plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          approval_timeout_hours: number
          autopilot_mode: string
          id: number
          monthly_budget_usd: number
          notify_email: string | null
          paused: boolean
          plan_time: string
          plan_weekday: number
          updated_at: string
          zernio_profile_id: string | null
        }
        Insert: {
          approval_timeout_hours?: number
          autopilot_mode?: string
          id?: number
          monthly_budget_usd?: number
          notify_email?: string | null
          paused?: boolean
          plan_time?: string
          plan_weekday?: number
          updated_at?: string
          zernio_profile_id?: string | null
        }
        Update: {
          approval_timeout_hours?: number
          autopilot_mode?: string
          id?: number
          monthly_budget_usd?: number
          notify_email?: string | null
          paused?: boolean
          plan_time?: string
          plan_weekday?: number
          updated_at?: string
          zernio_profile_id?: string | null
        }
        Relationships: []
      }
      brand_assets: {
        Row: {
          ai_description: string | null
          created_at: string
          id: string
          kind: string
          offering_id: string | null
          storage_key: string
          tags: string[]
        }
        Insert: {
          ai_description?: string | null
          created_at?: string
          id?: string
          kind: string
          offering_id?: string | null
          storage_key: string
          tags?: string[]
        }
        Update: {
          ai_description?: string | null
          created_at?: string
          id?: string
          kind?: string
          offering_id?: string | null
          storage_key?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_bible: {
        Row: {
          approved_at: string | null
          content: Json
          created_at: string
          id: string
          status: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          content?: Json
          created_at?: string
          id?: string
          status?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          content?: Json
          created_at?: string
          id?: string
          status?: string
          version?: number
        }
        Relationships: []
      }
      brand_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          source_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "brand_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kit: {
        Row: {
          colors: Json
          fonts: Json
          id: number
          layout_style: string | null
          logo_variants: Json
          photo_style: string | null
          template_ids: string[]
          updated_at: string
        }
        Insert: {
          colors?: Json
          fonts?: Json
          id?: number
          layout_style?: string | null
          logo_variants?: Json
          photo_style?: string | null
          template_ids?: string[]
          updated_at?: string
        }
        Update: {
          colors?: Json
          fonts?: Json
          id?: number
          layout_style?: string | null
          logo_variants?: Json
          photo_style?: string | null
          template_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      brand_sources: {
        Row: {
          competitor_id: string | null
          content_hash: string | null
          content_md: string | null
          fetched_at: string
          id: string
          kind: string
          metadata: Json
          title: string | null
          url: string | null
        }
        Insert: {
          competitor_id?: string | null
          content_hash?: string | null
          content_md?: string | null
          fetched_at?: string
          id?: string
          kind: string
          metadata?: Json
          title?: string | null
          url?: string | null
        }
        Update: {
          competitor_id?: string | null
          content_hash?: string | null
          content_md?: string | null
          fetched_at?: string
          id?: string
          kind?: string
          metadata?: Json
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_sources_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          business_type: string | null
          compliance: Json
          countries: string[]
          cta_links: Json
          description: string
          id: number
          language: string
          liked_brands: string[]
          logo_key: string | null
          music_mood: string | null
          name: string
          onboarding: Json
          onboarding_status: string
          posting_prefs: Json
          primary_goal: string | null
          social_urls: Json
          timezone: string | null
          tone: Json
          updated_at: string
          voice_id: string | null
          website: string | null
        }
        Insert: {
          business_type?: string | null
          compliance?: Json
          countries?: string[]
          cta_links?: Json
          description?: string
          id: number
          language?: string
          liked_brands?: string[]
          logo_key?: string | null
          music_mood?: string | null
          name?: string
          onboarding?: Json
          onboarding_status?: string
          posting_prefs?: Json
          primary_goal?: string | null
          social_urls?: Json
          timezone?: string | null
          tone?: Json
          updated_at?: string
          voice_id?: string | null
          website?: string | null
        }
        Update: {
          business_type?: string | null
          compliance?: Json
          countries?: string[]
          cta_links?: Json
          description?: string
          id?: number
          language?: string
          liked_brands?: string[]
          logo_key?: string | null
          music_mood?: string | null
          name?: string
          onboarding?: Json
          onboarding_status?: string
          posting_prefs?: Json
          primary_goal?: string | null
          social_urls?: Json
          timezone?: string | null
          tone?: Json
          updated_at?: string
          voice_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          date: string
          id: string
          kind: string
          name: string
          notes: string | null
          relevance: number
          source: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          kind: string
          name: string
          notes?: string | null
          relevance?: number
          source: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          relevance?: number
          source?: string
        }
        Relationships: []
      }
      competitors: {
        Row: {
          analysis: Json | null
          analyzed_at: string | null
          created_at: string
          id: string
          name: string
          social_urls: Json
          website: string | null
          source: string
        }
        Insert: {
          analysis?: Json | null
          analyzed_at?: string | null
          created_at?: string
          id?: string
          name: string
          social_urls?: Json
          website?: string | null
          source?: string
        }
        Update: {
          analysis?: Json | null
          analyzed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          social_urls?: Json
          website?: string | null
          source?: string
        }
        Relationships: []
      }
      content_pillars: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          funnel_stage: string | null
          id: string
          name: string
          target_share: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          funnel_stage?: string | null
          id?: string
          name: string
          target_share?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          funnel_stage?: string | null
          id?: string
          name?: string
          target_share?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_plans: {
        Row: {
          approved_at: string | null
          brand_bible_id: string | null
          created_at: string
          id: string
          status: string
          strategy: Json
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          brand_bible_id?: string | null
          created_at?: string
          id?: string
          status?: string
          strategy?: Json
          week_start: string
        }
        Update: {
          approved_at?: string | null
          brand_bible_id?: string | null
          created_at?: string
          id?: string
          status?: string
          strategy?: Json
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_plans_brand_bible_id_fkey"
            columns: ["brand_bible_id"]
            isOneToOne: false
            referencedRelation: "brand_bible"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          action: string
          created_at: string
          id: string
          media_id: string | null
          note: string | null
          plan_item_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          media_id?: string | null
          note?: string | null
          plan_item_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          media_id?: string | null
          note?: string | null
          plan_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_plan_item_id_fkey"
            columns: ["plan_item_id"]
            isOneToOne: false
            referencedRelation: "plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hook_library: {
        Row: {
          created_at: string
          embedding: string | null
          hook_type: string | null
          id: string
          plan_item_id: string | null
          platform: string | null
          score: number | null
          source: string
          text: string
          uses: number
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          hook_type?: string | null
          id?: string
          plan_item_id?: string | null
          platform?: string | null
          score?: number | null
          source: string
          text: string
          uses?: number
        }
        Update: {
          created_at?: string
          embedding?: string | null
          hook_type?: string | null
          id?: string
          plan_item_id?: string | null
          platform?: string | null
          score?: number | null
          source?: string
          text?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "hook_library_plan_item_id_fkey"
            columns: ["plan_item_id"]
            isOneToOne: false
            referencedRelation: "plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      learnings: {
        Row: {
          confidence: number | null
          dimension: string
          id: string
          insight: string | null
          platform: string | null
          sample_size: number
          score: number | null
          updated_at: string
          value: string
        }
        Insert: {
          confidence?: number | null
          dimension: string
          id?: string
          insight?: string | null
          platform?: string | null
          sample_size?: number
          score?: number | null
          updated_at?: string
          value: string
        }
        Update: {
          confidence?: number | null
          dimension?: string
          id?: string
          insight?: string | null
          platform?: string | null
          sample_size?: number
          score?: number | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          aspect_ratio: string | null
          audio_style: string | null
          character: string | null
          content: string | null
          cost_usd: number
          created_at: string
          creative_spec: Json | null
          duration_sec: number | null
          error: string | null
          id: string
          idea: string | null
          language: string | null
          offering_id: string | null
          plan_item_id: string | null
          reference_image_key: string | null
          source: string
          status: string
          storage_key: string | null
          type: string
          use_logo: boolean | null
          variant_of: string | null
          video_analysis: Json | null
          video_type: string | null
          voice_id: string | null
          voice_name: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          audio_style?: string | null
          character?: string | null
          content?: string | null
          cost_usd?: number
          created_at?: string
          creative_spec?: Json | null
          duration_sec?: number | null
          error?: string | null
          id?: string
          idea?: string | null
          language?: string | null
          offering_id?: string | null
          plan_item_id?: string | null
          reference_image_key?: string | null
          source: string
          status?: string
          storage_key?: string | null
          type: string
          use_logo?: boolean | null
          variant_of?: string | null
          video_analysis?: Json | null
          video_type?: string | null
          voice_id?: string | null
          voice_name?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          audio_style?: string | null
          character?: string | null
          content?: string | null
          cost_usd?: number
          created_at?: string
          creative_spec?: Json | null
          duration_sec?: number | null
          error?: string | null
          id?: string
          idea?: string | null
          language?: string | null
          offering_id?: string | null
          plan_item_id?: string | null
          reference_image_key?: string | null
          source?: string
          status?: string
          storage_key?: string | null
          type?: string
          use_logo?: boolean | null
          variant_of?: string | null
          video_analysis?: Json | null
          video_type?: string | null
          voice_id?: string | null
          voice_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_plan_item_id_fkey"
            columns: ["plan_item_id"]
            isOneToOne: false
            referencedRelation: "plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_variant_of_fkey"
            columns: ["variant_of"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          id: string
          media_id: string
          position: number
          role: string
          storage_key: string
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          media_id: string
          position?: number
          role: string
          storage_key: string
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          media_id?: string
          position?: number
          role?: string
          storage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_files_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
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
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      offerings: {
        Row: {
          active: boolean
          attributes: Json
          audience: string | null
          benefits: string[]
          created_at: string
          currency: string | null
          description: string | null
          id: string
          is_hero: boolean
          kind: string
          name: string
          objections: string[]
          price: number | null
          price_model: string | null
          priority: number
          updated_at: string
          url: string | null
          source_id: string | null
          verified: boolean
        }
        Insert: {
          active?: boolean
          attributes?: Json
          audience?: string | null
          benefits?: string[]
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_hero?: boolean
          kind: string
          name: string
          objections?: string[]
          price?: number | null
          price_model?: string | null
          priority?: number
          updated_at?: string
          url?: string | null
          source_id?: string | null
          verified?: boolean
        }
        Update: {
          active?: boolean
          attributes?: Json
          audience?: string | null
          benefits?: string[]
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_hero?: boolean
          kind?: string
          name?: string
          objections?: string[]
          price?: number | null
          price_model?: string | null
          priority?: number
          updated_at?: string
          url?: string | null
          source_id?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      offers: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          details: string | null
          ends_at: string | null
          id: string
          offering_id: string | null
          starts_at: string | null
          title: string
          updated_at: string
          source_id: string | null
          verified: boolean
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          details?: string | null
          ends_at?: string | null
          id?: string
          offering_id?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
          source_id?: string | null
          verified?: boolean
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          details?: string | null
          ends_at?: string | null
          id?: string
          offering_id?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          source_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "offers_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          active: boolean
          created_at: string
          desires: string[]
          id: string
          name: string
          objections: string[]
          pains: string[]
          phrases: string[]
          summary: string | null
          triggers: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          desires?: string[]
          id?: string
          name: string
          objections?: string[]
          pains?: string[]
          phrases?: string[]
          summary?: string | null
          triggers?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          desires?: string[]
          id?: string
          name?: string
          objections?: string[]
          pains?: string[]
          phrases?: string[]
          summary?: string | null
          triggers?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      plan_items: {
        Row: {
          angle: string | null
          attempts: number
          brief: Json | null
          brief_score: number | null
          captions: Json | null
          created_at: string
          error: string | null
          format: string
          framework: string | null
          funnel_stage: string | null
          hook_text: string | null
          hook_type: string | null
          id: string
          is_experiment: boolean
          levers: string[]
          objective: string | null
          offer_id: string | null
          offering_id: string | null
          persona_id: string | null
          pillar_id: string | null
          plan_id: string
          platforms: string[]
          qa_report: Json | null
          qa_score: number | null
          rationale: string | null
          selected_media_id: string | null
          slot_at: string
          status: string
          updated_at: string
        }
        Insert: {
          angle?: string | null
          attempts?: number
          brief?: Json | null
          brief_score?: number | null
          captions?: Json | null
          created_at?: string
          error?: string | null
          format: string
          framework?: string | null
          funnel_stage?: string | null
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          is_experiment?: boolean
          levers?: string[]
          objective?: string | null
          offer_id?: string | null
          offering_id?: string | null
          persona_id?: string | null
          pillar_id?: string | null
          plan_id: string
          platforms?: string[]
          qa_report?: Json | null
          qa_score?: number | null
          rationale?: string | null
          selected_media_id?: string | null
          slot_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          angle?: string | null
          attempts?: number
          brief?: Json | null
          brief_score?: number | null
          captions?: Json | null
          created_at?: string
          error?: string | null
          format?: string
          framework?: string | null
          funnel_stage?: string | null
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          is_experiment?: boolean
          levers?: string[]
          objective?: string | null
          offer_id?: string | null
          offering_id?: string | null
          persona_id?: string | null
          pillar_id?: string | null
          plan_id?: string
          platforms?: string[]
          qa_report?: Json | null
          qa_score?: number | null
          rationale?: string | null
          selected_media_id?: string | null
          slot_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_selected_media_id_fkey"
            columns: ["selected_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          avg_watch_sec: number | null
          captured_on: string
          clicks: number | null
          comments: number | null
          completion_rate: number | null
          engagement_rate: number | null
          followers_gained: number | null
          id: string
          impressions: number | null
          likes: number | null
          post_target_id: string
          raw: Json | null
          reach: number | null
          saves: number | null
          shares: number | null
          views: number | null
        }
        Insert: {
          avg_watch_sec?: number | null
          captured_on: string
          clicks?: number | null
          comments?: number | null
          completion_rate?: number | null
          engagement_rate?: number | null
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          post_target_id: string
          raw?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          avg_watch_sec?: number | null
          captured_on?: string
          clicks?: number | null
          comments?: number | null
          completion_rate?: number | null
          engagement_rate?: number | null
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          post_target_id?: string
          raw?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_post_target_id_fkey"
            columns: ["post_target_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      post_targets: {
        Row: {
          account_id: string
          account_name: string
          caption: string
          error: string | null
          id: string
          platform: string
          post_id: string
          provider: string
          provider_post_id: string | null
          provider_ref: string | null
          published_at: string | null
          status: string
          url: string | null
        }
        Insert: {
          account_id: string
          account_name: string
          caption?: string
          error?: string | null
          id?: string
          platform: string
          post_id: string
          provider?: string
          provider_post_id?: string | null
          provider_ref?: string | null
          published_at?: string | null
          status?: string
          url?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string
          caption?: string
          error?: string | null
          id?: string
          platform?: string
          post_id?: string
          provider?: string
          provider_post_id?: string | null
          provider_ref?: string | null
          published_at?: string | null
          status?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_targets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string
          id: string
          media_id: string
          origin: string
          plan_item_id: string | null
          publish_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          origin?: string
          plan_item_id?: string | null
          publish_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          origin?: string
          plan_item_id?: string | null
          publish_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_plan_item_id_fkey"
            columns: ["plan_item_id"]
            isOneToOne: true
            referencedRelation: "plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_items: {
        Row: {
          author: string | null
          content: string
          created_at: string
          id: string
          kind: string
          offering_id: string | null
          rating: number | null
          source_id: string | null
          verified: boolean
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string
          id?: string
          kind: string
          offering_id?: string | null
          rating?: number | null
          source_id?: string | null
          verified?: boolean
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          id?: string
          kind?: string
          offering_id?: string | null
          rating?: number | null
          source_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "proof_items_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "brand_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_research_state: {
        Args: { path: string[]; value: Json }
        Returns: undefined
      }
      match_brand_chunks: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
