


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."acknowledge_alert"("p_alert_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE customer_alerts
  SET 
    acknowledged_at = NOW(),
    acknowledged_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_alert_id
    AND acknowledged_at IS NULL;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;


ALTER FUNCTION "public"."acknowledge_alert"("p_alert_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_email_filters"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_filter RECORD;
  v_matches BOOLEAN;
  v_action JSONB;
BEGIN
  -- Get all active filters for this user, ordered by priority
  FOR v_filter IN
    SELECT * FROM email_filters
    WHERE user_id = NEW.user_id
      AND enabled = true
    ORDER BY priority ASC
  LOOP
    -- Check if email matches filter conditions
    v_matches := check_filter_match(NEW, v_filter);

    IF v_matches THEN
      -- Apply filter actions
      IF v_filter.actions IS NOT NULL THEN
        -- Mark as read
        IF (v_filter.actions ? 'mark_read') AND (v_filter.actions->>'mark_read')::boolean THEN
          NEW.is_read := true;
        END IF;

        -- Star
        IF (v_filter.actions ? 'star') AND (v_filter.actions->>'star')::boolean THEN
          NEW.is_starred := true;
        END IF;

        -- Mark as important
        IF (v_filter.actions ? 'important') AND (v_filter.actions->>'important')::boolean THEN
          NEW.is_important := true;
        END IF;

        -- Move to folder
        IF v_filter.actions ? 'move_to_folder' THEN
          NEW.folder := v_filter.actions->>'move_to_folder';
        END IF;

        -- Delete (move to trash)
        IF (v_filter.actions ? 'delete') AND (v_filter.actions->>'delete')::boolean THEN
          NEW.folder := 'trash';
        END IF;

        -- Archive
        IF (v_filter.actions ? 'archive') AND (v_filter.actions->>'archive')::boolean THEN
          NEW.folder := 'archive';
        END IF;

        -- Apply label (stored in metadata for now)
        IF v_filter.actions ? 'apply_label' THEN
          -- Add label to metadata
          IF NEW.metadata IS NULL THEN
            NEW.metadata := '{}'::jsonb;
          END IF;
          NEW.metadata := jsonb_set(
            NEW.metadata,
            '{auto_labels}',
            COALESCE(NEW.metadata->'auto_labels', '[]'::jsonb) || jsonb_build_array(v_filter.actions->>'apply_label')
          );
        END IF;
      END IF;

      -- If filter is set to stop processing, break
      IF v_filter.stop_processing THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the email insert
    RAISE WARNING 'Filter application error: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_email_filters"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_email_filters"() IS 'Automatically applies email filters to new emails';



CREATE OR REPLACE FUNCTION "public"."archives_search_vector_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."archives_search_vector_update"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Many-to-many assignment of roles to users';



COMMENT ON COLUMN "public"."user_roles"."granted_by" IS 'UUID of user who granted this role (NULL if system-assigned)';



COMMENT ON COLUMN "public"."user_roles"."expires_at" IS 'Optional expiration date for temporary role assignments';



CREATE OR REPLACE FUNCTION "public"."assign_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid", "p_granted_by" "uuid" DEFAULT NULL::"uuid", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."user_roles"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result user_roles;
BEGIN
  INSERT INTO user_roles (
    user_id,
    role_id,
    tenant_id,
    granted_by,
    granted_at,
    expires_at
  ) VALUES (
    p_user_id,
    p_role_id,
    p_tenant_id,
    p_granted_by,
    NOW(),
    p_expires_at
  )
  ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE SET
    granted_by = EXCLUDED.granted_by,
    granted_at = NOW(),
    expires_at = EXCLUDED.expires_at
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."assign_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid", "p_granted_by" "uuid", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "text" NOT NULL,
    "health_score" integer NOT NULL,
    "health_label" "text" NOT NULL,
    "sentiment_factor" integer DEFAULT 50 NOT NULL,
    "engagement_factor" integer DEFAULT 50 NOT NULL,
    "responsiveness_factor" integer DEFAULT 50 NOT NULL,
    "deal_progress_factor" integer DEFAULT 50 NOT NULL,
    "task_completion_factor" integer DEFAULT 50 NOT NULL,
    "sentiment_trend" "text" DEFAULT 'stable'::"text" NOT NULL,
    "trend_direction" integer DEFAULT 0 NOT NULL,
    "last_interaction" timestamp with time zone,
    "interaction_count_30d" integer DEFAULT 0 NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_health_factors_range" CHECK ((("sentiment_factor" >= 0) AND ("sentiment_factor" <= 100) AND ("engagement_factor" >= 0) AND ("engagement_factor" <= 100) AND ("responsiveness_factor" >= 0) AND ("responsiveness_factor" <= 100) AND ("deal_progress_factor" >= 0) AND ("deal_progress_factor" <= 100) AND ("task_completion_factor" >= 0) AND ("task_completion_factor" <= 100))),
    CONSTRAINT "customer_health_non_empty_customer" CHECK (("length"(TRIM(BOTH FROM "customer_id")) > 0)),
    CONSTRAINT "customer_health_score_range" CHECK ((("health_score" >= 0) AND ("health_score" <= 100))),
    CONSTRAINT "customer_health_trend_direction_range" CHECK ((("trend_direction" >= '-2'::integer) AND ("trend_direction" <= 2))),
    CONSTRAINT "customer_health_valid_label" CHECK (("health_label" = ANY (ARRAY['healthy'::"text", 'needs_attention'::"text", 'at_risk'::"text", 'critical'::"text"]))),
    CONSTRAINT "customer_health_valid_trend" CHECK (("sentiment_trend" = ANY (ARRAY['improving'::"text", 'stable'::"text", 'declining'::"text"])))
);


ALTER TABLE "public"."customer_health" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_health" IS 'Aggregated customer health scores with factor breakdown';



COMMENT ON COLUMN "public"."customer_health"."health_score" IS 'Overall health score 0-100 (weighted average of factors)';



COMMENT ON COLUMN "public"."customer_health"."health_label" IS 'healthy (80-100), needs_attention (60-79), at_risk (40-59), critical (0-39)';



COMMENT ON COLUMN "public"."customer_health"."sentiment_factor" IS 'Score based on recent sentiment analysis (0-100)';



COMMENT ON COLUMN "public"."customer_health"."engagement_factor" IS 'Score based on interaction frequency (0-100)';



COMMENT ON COLUMN "public"."customer_health"."responsiveness_factor" IS 'Score based on response times (0-100)';



COMMENT ON COLUMN "public"."customer_health"."deal_progress_factor" IS 'Score based on deal movement (0-100)';



COMMENT ON COLUMN "public"."customer_health"."task_completion_factor" IS 'Score based on task completion rate (0-100)';



COMMENT ON COLUMN "public"."customer_health"."trend_direction" IS '-2 (strongly declining) to +2 (strongly improving)';



CREATE OR REPLACE FUNCTION "public"."calculate_customer_health"("p_customer_id" "text", "p_sentiment_factor" integer DEFAULT 50, "p_engagement_factor" integer DEFAULT 50, "p_responsiveness_factor" integer DEFAULT 50, "p_deal_progress_factor" integer DEFAULT 50, "p_task_completion_factor" integer DEFAULT 50, "p_last_interaction" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_interaction_count_30d" integer DEFAULT 0) RETURNS "public"."customer_health"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_health_score INT;
  v_health_label TEXT;
  v_trend TEXT;
  v_trend_direction INT;
  v_previous_score INT;
  v_result customer_health;
BEGIN
  -- Calculate weighted health score
  -- Weights: sentiment 30%, engagement 25%, responsiveness 15%, deal_progress 15%, task_completion 15%
  v_health_score := ROUND(
    p_sentiment_factor * 0.30 +
    p_engagement_factor * 0.25 +
    p_responsiveness_factor * 0.15 +
    p_deal_progress_factor * 0.15 +
    p_task_completion_factor * 0.15
  );
  
  -- Ensure score is within bounds
  v_health_score := GREATEST(0, LEAST(100, v_health_score));
  
  -- Determine health label
  v_health_label := health_score_to_label(v_health_score);
  
  -- Calculate trend by comparing to 14-day-old score
  SELECT health_score INTO v_previous_score
  FROM customer_health_history
  WHERE customer_id = p_customer_id
    AND recorded_at <= NOW() - INTERVAL '14 days'
  ORDER BY recorded_at DESC
  LIMIT 1;
  
  IF v_previous_score IS NULL THEN
    v_trend := 'stable';
    v_trend_direction := 0;
  ELSIF v_health_score - v_previous_score > 10 THEN
    v_trend := 'improving';
    v_trend_direction := 2;
  ELSIF v_health_score - v_previous_score > 5 THEN
    v_trend := 'improving';
    v_trend_direction := 1;
  ELSIF v_health_score - v_previous_score < -10 THEN
    v_trend := 'declining';
    v_trend_direction := -2;
  ELSIF v_health_score - v_previous_score < -5 THEN
    v_trend := 'declining';
    v_trend_direction := -1;
  ELSE
    v_trend := 'stable';
    v_trend_direction := 0;
  END IF;
  
  -- Upsert customer health record
  INSERT INTO customer_health (
    customer_id,
    health_score,
    health_label,
    sentiment_factor,
    engagement_factor,
    responsiveness_factor,
    deal_progress_factor,
    task_completion_factor,
    sentiment_trend,
    trend_direction,
    last_interaction,
    interaction_count_30d,
    calculated_at,
    updated_at
  ) VALUES (
    p_customer_id,
    v_health_score,
    v_health_label,
    p_sentiment_factor,
    p_engagement_factor,
    p_responsiveness_factor,
    p_deal_progress_factor,
    p_task_completion_factor,
    v_trend,
    v_trend_direction,
    p_last_interaction,
    p_interaction_count_30d,
    NOW(),
    NOW()
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    health_score = EXCLUDED.health_score,
    health_label = EXCLUDED.health_label,
    sentiment_factor = EXCLUDED.sentiment_factor,
    engagement_factor = EXCLUDED.engagement_factor,
    responsiveness_factor = EXCLUDED.responsiveness_factor,
    deal_progress_factor = EXCLUDED.deal_progress_factor,
    task_completion_factor = EXCLUDED.task_completion_factor,
    sentiment_trend = EXCLUDED.sentiment_trend,
    trend_direction = EXCLUDED.trend_direction,
    last_interaction = EXCLUDED.last_interaction,
    interaction_count_30d = EXCLUDED.interaction_count_30d,
    calculated_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  -- Record history snapshot
  INSERT INTO customer_health_history (
    customer_id,
    health_score,
    health_label,
    factors
  ) VALUES (
    p_customer_id,
    v_health_score,
    v_health_label,
    jsonb_build_object(
      'sentiment', p_sentiment_factor,
      'engagement', p_engagement_factor,
      'responsiveness', p_responsiveness_factor,
      'deal_progress', p_deal_progress_factor,
      'task_completion', p_task_completion_factor
    )
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."calculate_customer_health"("p_customer_id" "text", "p_sentiment_factor" integer, "p_engagement_factor" integer, "p_responsiveness_factor" integer, "p_deal_progress_factor" integer, "p_task_completion_factor" integer, "p_last_interaction" timestamp with time zone, "p_interaction_count_30d" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_engagement_score"("p_total_messages" integer, "p_response_rate" numeric, "p_avg_response_time" numeric, "p_days_since_last" integer, "p_avg_sentiment" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_score NUMERIC := 0;
  v_volume_score NUMERIC;
  v_response_score NUMERIC;
  v_recency_score NUMERIC;
  v_sentiment_score NUMERIC;
BEGIN
  v_volume_score := LEAST(p_total_messages / 4.0, 25);
  v_response_score := COALESCE(p_response_rate, 50) * 0.3;
  v_recency_score := CASE
    WHEN p_days_since_last IS NULL THEN 12.5
    WHEN p_days_since_last <= 1 THEN 25
    WHEN p_days_since_last <= 7 THEN 20
    WHEN p_days_since_last <= 30 THEN 15
    WHEN p_days_since_last <= 90 THEN 10
    ELSE 5
  END;
  v_sentiment_score := (COALESCE(p_avg_sentiment, 0) + 1) * 10;
  v_score := v_volume_score + v_response_score + v_recency_score + v_sentiment_score;
  RETURN LEAST(GREATEST(v_score, 0), 100);
END;
$$;


ALTER FUNCTION "public"."calculate_engagement_score"("p_total_messages" integer, "p_response_rate" numeric, "p_avg_response_time" numeric, "p_days_since_last" integer, "p_avg_sentiment" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_relationship_score"("p_response_rate" double precision, "p_avg_response_hours" double precision, "p_days_since_interaction" integer, "p_total_interactions" integer, "p_sentiment_avg" double precision) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_score FLOAT := 50;
  v_response_factor FLOAT;
  v_recency_factor FLOAT;
  v_volume_factor FLOAT;
  v_sentiment_factor FLOAT;
BEGIN
  -- Response rate contributes 25 points (0-25)
  v_response_factor := COALESCE(p_response_rate, 0.5) * 25;

  -- Response time contributes 20 points (faster is better)
  v_response_factor := v_response_factor + CASE
    WHEN p_avg_response_hours IS NULL THEN 10
    WHEN p_avg_response_hours <= 1 THEN 20
    WHEN p_avg_response_hours <= 4 THEN 17
    WHEN p_avg_response_hours <= 24 THEN 14
    WHEN p_avg_response_hours <= 72 THEN 10
    ELSE 5
  END;

  -- Recency contributes 25 points
  v_recency_factor := CASE
    WHEN p_days_since_interaction IS NULL THEN 12
    WHEN p_days_since_interaction <= 1 THEN 25
    WHEN p_days_since_interaction <= 7 THEN 22
    WHEN p_days_since_interaction <= 14 THEN 18
    WHEN p_days_since_interaction <= 30 THEN 14
    WHEN p_days_since_interaction <= 60 THEN 10
    WHEN p_days_since_interaction <= 90 THEN 6
    ELSE 2
  END;

  -- Volume contributes 15 points
  v_volume_factor := CASE
    WHEN p_total_interactions >= 100 THEN 15
    WHEN p_total_interactions >= 50 THEN 13
    WHEN p_total_interactions >= 20 THEN 11
    WHEN p_total_interactions >= 10 THEN 9
    WHEN p_total_interactions >= 5 THEN 7
    ELSE p_total_interactions
  END;

  -- Sentiment contributes 15 points
  v_sentiment_factor := CASE
    WHEN p_sentiment_avg IS NULL THEN 7.5
    ELSE (p_sentiment_avg + 1) / 2 * 15  -- Convert -1 to 1 range to 0-15
  END;

  v_score := v_response_factor + v_recency_factor + v_volume_factor + v_sentiment_factor;

  RETURN LEAST(GREATEST(ROUND(v_score)::INTEGER, 0), 100);
END;
$$;


ALTER FUNCTION "public"."calculate_relationship_score"("p_response_rate" double precision, "p_avg_response_hours" double precision, "p_days_since_interaction" integer, "p_total_interactions" integer, "p_sentiment_avg" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_relationship_score"("p_response_rate" double precision, "p_avg_response_hours" double precision, "p_days_since_interaction" integer, "p_total_interactions" integer, "p_sentiment_avg" double precision) IS 'Calculates relationship health score (0-100) from various factors';



CREATE OR REPLACE FUNCTION "public"."calculate_response_rate"("p_user_id" "uuid", "p_contact_identifier" "text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_total_received INTEGER;
  v_total_responded INTEGER;
  v_rate NUMERIC;
BEGIN
  -- Count messages received from contact
  SELECT COUNT(*) INTO v_total_received
  FROM analytics_response_times
  WHERE user_id = p_user_id
    AND contact_identifier = p_contact_identifier;

  -- Count how many we responded to
  SELECT COUNT(*) INTO v_total_responded
  FROM analytics_response_times
  WHERE user_id = p_user_id
    AND contact_identifier = p_contact_identifier
    AND was_responded = true;

  IF v_total_received = 0 THEN
    RETURN 100; -- No data yet, assume 100%
  END IF;

  v_rate := (v_total_responded::NUMERIC / v_total_received::NUMERIC) * 100;
  RETURN ROUND(v_rate, 2);
END;
$$;


ALTER FUNCTION "public"."calculate_response_rate"("p_user_id" "uuid", "p_contact_identifier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_decision_threshold"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  approval_count INTEGER;
  decision_threshold INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE choice = 'approve'),
    d.threshold
  INTO approval_count, decision_threshold
  FROM decision_votes dv
  JOIN decisions d ON d.id = dv.decision_id
  WHERE dv.decision_id = NEW.decision_id
  GROUP BY d.threshold;

  IF approval_count >= decision_threshold THEN
    UPDATE decisions
    SET status = 'approved',
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.decision_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_decision_threshold"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_filter_match"("p_email" "record", "p_filter" "record") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_matches BOOLEAN := true;
  v_condition JSONB;
  v_operator TEXT;
  v_field TEXT;
  v_value TEXT;
  v_email_value TEXT;
BEGIN
  -- If no conditions, always match
  IF p_filter.conditions IS NULL OR jsonb_array_length(p_filter.conditions) = 0 THEN
    RETURN true;
  END IF;

  -- Check match_type (all vs any)
  IF p_filter.match_type = 'any' THEN
    v_matches := false; -- Start with false for OR logic
  END IF;

  -- Check each condition
  FOR v_condition IN SELECT * FROM jsonb_array_elements(p_filter.conditions)
  LOOP
    v_field := v_condition->>'field';
    v_operator := COALESCE(v_condition->>'operator', 'contains');
    v_value := v_condition->>'value';

    -- Get email field value
    CASE v_field
      WHEN 'from' THEN
        v_email_value := p_email.from_email || ' ' || COALESCE(p_email.from_name, '');
      WHEN 'to' THEN
        v_email_value := p_email.to_emails::text;
      WHEN 'subject' THEN
        v_email_value := COALESCE(p_email.subject, '');
      WHEN 'body' THEN
        v_email_value := COALESCE(p_email.body_text, '');
      WHEN 'has_attachment' THEN
        -- Boolean field
        IF (v_value::boolean = p_email.has_attachments) THEN
          IF p_filter.match_type = 'any' THEN
            RETURN true;
          END IF;
          CONTINUE;
        ELSE
          IF p_filter.match_type = 'all' THEN
            RETURN false;
          END IF;
          CONTINUE;
        END IF;
      ELSE
        v_email_value := '';
    END CASE;

    -- Apply operator
    CASE v_operator
      WHEN 'contains' THEN
        IF v_email_value ILIKE '%' || v_value || '%' THEN
          IF p_filter.match_type = 'any' THEN
            RETURN true;
          END IF;
        ELSIF p_filter.match_type = 'all' THEN
          RETURN false;
        END IF;

      WHEN 'not_contains' THEN
        IF v_email_value NOT ILIKE '%' || v_value || '%' THEN
          IF p_filter.match_type = 'any' THEN
            RETURN true;
          END IF;
        ELSIF p_filter.match_type = 'all' THEN
          RETURN false;
        END IF;

      WHEN 'equals' THEN
        IF v_email_value ILIKE v_value THEN
          IF p_filter.match_type = 'any' THEN
            RETURN true;
          END IF;
        ELSIF p_filter.match_type = 'all' THEN
          RETURN false;
        END IF;

      WHEN 'starts_with' THEN
        IF v_email_value ILIKE v_value || '%' THEN
          IF p_filter.match_type = 'any' THEN
            RETURN true;
          END IF;
        ELSIF p_filter.match_type = 'all' THEN
          RETURN false;
        END IF;

      WHEN 'ends_with' THEN
        IF v_email_value ILIKE '%' || v_value THEN
          IF p_filter.match_type = 'any' THEN
            RETURN true;
          END IF;
        ELSIF p_filter.match_type = 'all' THEN
          RETURN false;
        END IF;
    END CASE;
  END LOOP;

  -- If we get here with match_type = 'all', all conditions matched
  -- If match_type = 'any' and we're here, no conditions matched
  RETURN (p_filter.match_type = 'all');
END;
$$;


ALTER FUNCTION "public"."check_filter_match"("p_email" "record", "p_filter" "record") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_filter_match"("p_email" "record", "p_filter" "record") IS 'Checks if an email matches filter conditions';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_suggestions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM smart_suggestions_cache
  WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_suggestions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_rate_limits"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM api_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_request_logs"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM api_request_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_request_logs"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "sync_type" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "entity_type" "text",
    "records_processed" integer DEFAULT 0 NOT NULL,
    "records_succeeded" integer DEFAULT 0 NOT NULL,
    "records_failed" integer DEFAULT 0 NOT NULL,
    "error_details" "jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    CONSTRAINT "sync_logs_valid_direction" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'bidirectional'::"text"]))),
    CONSTRAINT "sync_logs_valid_status" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "sync_logs_valid_type" CHECK (("sync_type" = ANY (ARRAY['full'::"text", 'incremental'::"text", 'webhook'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."integration_sync_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."integration_sync_logs" IS 'Log of integration sync operations';



CREATE OR REPLACE FUNCTION "public"."complete_integration_sync"("p_sync_id" "uuid", "p_records_processed" integer, "p_records_succeeded" integer, "p_records_failed" integer, "p_status" "text" DEFAULT 'success'::"text", "p_error_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."integration_sync_logs"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_log integration_sync_logs;
BEGIN
  UPDATE integration_sync_logs
  SET records_processed = p_records_processed,
      records_succeeded = p_records_succeeded,
      records_failed = p_records_failed,
      status = p_status,
      error_details = p_error_details,
      completed_at = NOW()
  WHERE id = p_sync_id
  RETURNING * INTO v_log;
  
  UPDATE integrations
  SET last_sync_at = NOW(),
      error_count = CASE WHEN p_status = 'success' THEN 0 ELSE error_count + 1 END,
      last_error = CASE WHEN p_status = 'failed' THEN p_error_details::TEXT ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_log.integration_id;
  
  RETURN v_log;
END;
$$;


ALTER FUNCTION "public"."complete_integration_sync"("p_sync_id" "uuid", "p_records_processed" integer, "p_records_succeeded" integer, "p_records_failed" integer, "p_status" "text", "p_error_details" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roles_non_empty_display_name" CHECK (("length"(TRIM(BOTH FROM "display_name")) > 0)),
    CONSTRAINT "roles_non_empty_name" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles" IS 'Role definitions for RBAC - includes system and custom roles';



COMMENT ON COLUMN "public"."roles"."tenant_id" IS 'NULL for system-wide roles, UUID for tenant-specific roles';



COMMENT ON COLUMN "public"."roles"."permissions" IS 'JSON array of permission strings (e.g., ["meetings:read", "tasks:*"])';



COMMENT ON COLUMN "public"."roles"."is_system" IS 'System roles cannot be modified or deleted';



CREATE OR REPLACE FUNCTION "public"."create_custom_role"("p_tenant_id" "uuid", "p_name" "text", "p_display_name" "text", "p_description" "text", "p_permissions" "jsonb") RETURNS "public"."roles"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_role roles;
BEGIN
  INSERT INTO roles (
    tenant_id,
    name,
    display_name,
    description,
    permissions,
    is_system
  ) VALUES (
    p_tenant_id,
    p_name,
    p_display_name,
    p_description,
    p_permissions,
    FALSE
  )
  RETURNING * INTO v_role;
  
  RETURN v_role;
END;
$$;


ALTER FUNCTION "public"."create_custom_role"("p_tenant_id" "uuid", "p_name" "text", "p_display_name" "text", "p_description" "text", "p_permissions" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "text" NOT NULL,
    "alert_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "message" "text" NOT NULL,
    "suggested_action" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_alerts_non_empty_customer" CHECK (("length"(TRIM(BOTH FROM "customer_id")) > 0)),
    CONSTRAINT "customer_alerts_non_empty_message" CHECK (("length"(TRIM(BOTH FROM "message")) > 0)),
    CONSTRAINT "customer_alerts_valid_severity" CHECK (("severity" = ANY (ARRAY['warning'::"text", 'critical'::"text"]))),
    CONSTRAINT "customer_alerts_valid_type" CHECK (("alert_type" = ANY (ARRAY['score_drop'::"text", 'declining_trend'::"text", 'no_interaction'::"text", 'repeated_negative'::"text", 'churn_risk'::"text", 'engagement_drop'::"text"])))
);


ALTER TABLE "public"."customer_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_alerts" IS 'Alerts for at-risk customers requiring attention';



COMMENT ON COLUMN "public"."customer_alerts"."alert_type" IS 'Type: score_drop, declining_trend, no_interaction, repeated_negative, churn_risk, engagement_drop';



COMMENT ON COLUMN "public"."customer_alerts"."severity" IS 'Severity level: warning or critical';



COMMENT ON COLUMN "public"."customer_alerts"."suggested_action" IS 'Recommended action to address this alert';



COMMENT ON COLUMN "public"."customer_alerts"."context" IS 'JSON with additional alert context (previous score, days since interaction, etc.)';



CREATE OR REPLACE FUNCTION "public"."create_customer_alert"("p_customer_id" "text", "p_alert_type" "text", "p_severity" "text", "p_message" "text", "p_suggested_action" "text" DEFAULT NULL::"text", "p_context" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."customer_alerts"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_existing_alert customer_alerts;
  v_new_alert customer_alerts;
BEGIN
  -- Check for existing active alert of same type
  SELECT * INTO v_existing_alert
  FROM customer_alerts
  WHERE customer_id = p_customer_id
    AND alert_type = p_alert_type
    AND resolved_at IS NULL
  LIMIT 1;
  
  -- If active alert exists, return it (don't create duplicate)
  IF v_existing_alert.id IS NOT NULL THEN
    RETURN v_existing_alert;
  END IF;
  
  -- Create new alert
  INSERT INTO customer_alerts (
    customer_id,
    alert_type,
    severity,
    message,
    suggested_action,
    context
  ) VALUES (
    p_customer_id,
    p_alert_type,
    p_severity,
    p_message,
    p_suggested_action,
    p_context
  )
  RETURNING * INTO v_new_alert;
  
  RETURN v_new_alert;
END;
$$;


ALTER FUNCTION "public"."create_customer_alert"("p_customer_id" "text", "p_alert_type" "text", "p_severity" "text", "p_message" "text", "p_suggested_action" "text", "p_context" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "secret" "text" NOT NULL,
    "events" "text"[] NOT NULL,
    "filters" "jsonb",
    "custom_headers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_triggered_at" timestamp with time zone,
    "consecutive_failures" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "webhooks_non_empty_events" CHECK (("array_length"("events", 1) > 0)),
    CONSTRAINT "webhooks_non_empty_name" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "webhooks_non_empty_url" CHECK (("length"(TRIM(BOTH FROM "url")) > 0))
);


ALTER TABLE "public"."webhooks" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhooks" IS 'Outbound webhook configurations';



CREATE OR REPLACE FUNCTION "public"."create_webhook"("p_name" "text", "p_url" "text", "p_events" "text"[], "p_filters" "jsonb" DEFAULT NULL::"jsonb", "p_custom_headers" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."webhooks"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_webhook webhooks;
BEGIN
  INSERT INTO webhooks (name, url, secret, events, filters, custom_headers)
  VALUES (p_name, p_url, encode(gen_random_bytes(32), 'hex'), p_events, p_filters, p_custom_headers)
  RETURNING * INTO v_webhook;
  RETURN v_webhook;
END;
$$;


ALTER FUNCTION "public"."create_webhook"("p_name" "text", "p_url" "text", "p_events" "text"[], "p_filters" "jsonb", "p_custom_headers" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_follower_count"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE pulse_users
  SET follower_count = GREATEST(follower_count - 1, 0)
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."decrement_follower_count"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_following_count"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE pulse_users
  SET following_count = GREATEST(following_count - 1, 0)
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."decrement_following_count"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_coaching_session"("p_session_id" "uuid", "p_talk_time_percentage" double precision DEFAULT NULL::double precision) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE coaching_sessions
  SET 
    ended_at = NOW(),
    talk_time_percentage = COALESCE(p_talk_time_percentage, talk_time_percentage),
    updated_at = NOW()
  WHERE id = p_session_id
    AND ended_at IS NULL;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;


ALTER FUNCTION "public"."end_coaching_session"("p_session_id" "uuid", "p_talk_time_percentage" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evaluate_all_customer_alerts"() RETURNS TABLE("customers_evaluated" bigint, "alerts_created" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_customer RECORD;
  v_total_customers BIGINT := 0;
  v_total_alerts BIGINT := 0;
  v_alerts INT;
BEGIN
  FOR v_customer IN 
    SELECT customer_id FROM customer_health
  LOOP
    v_alerts := evaluate_customer_alerts(v_customer.customer_id);
    v_total_customers := v_total_customers + 1;
    v_total_alerts := v_total_alerts + v_alerts;
  END LOOP;
  
  RETURN QUERY SELECT v_total_customers, v_total_alerts;
END;
$$;


ALTER FUNCTION "public"."evaluate_all_customer_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evaluate_customer_alerts"("p_customer_id" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_health customer_health;
  v_alerts_created INT := 0;
  v_days_since_interaction INT;
  v_previous_score INT;
  v_negative_count INT;
BEGIN
  -- Get current health record
  SELECT * INTO v_health
  FROM customer_health
  WHERE customer_id = p_customer_id;
  
  IF v_health.customer_id IS NULL THEN
    RETURN 0;  -- No health record, skip
  END IF;
  
  -- Calculate days since last interaction
  v_days_since_interaction := CASE 
    WHEN v_health.last_interaction IS NULL THEN 999
    ELSE EXTRACT(DAY FROM NOW() - v_health.last_interaction)::INT
  END;
  
  -- Get score from 14 days ago for comparison
  SELECT health_score INTO v_previous_score
  FROM customer_health_history
  WHERE customer_id = p_customer_id
    AND recorded_at <= NOW() - INTERVAL '14 days'
  ORDER BY recorded_at DESC
  LIMIT 1;
  
  -- Count recent negative sentiments
  SELECT COUNT(*) INTO v_negative_count
  FROM customer_sentiment
  WHERE customer_id = p_customer_id
    AND analyzed_at >= NOW() - INTERVAL '7 days'
    AND sentiment_score < -0.2;
  
  -- ============================================
  -- Alert Rule 1: Score Drop
  -- ============================================
  IF v_previous_score IS NOT NULL THEN
    IF v_health.health_score - v_previous_score <= -20 THEN
      PERFORM create_customer_alert(
        p_customer_id,
        'score_drop',
        'critical',
        format('Health score dropped %s points in 14 days (from %s to %s)', 
          v_previous_score - v_health.health_score, v_previous_score, v_health.health_score),
        'Schedule a check-in call immediately to understand what changed',
        jsonb_build_object('previous_score', v_previous_score, 'current_score', v_health.health_score)
      );
      v_alerts_created := v_alerts_created + 1;
    ELSIF v_health.health_score - v_previous_score <= -10 THEN
      PERFORM create_customer_alert(
        p_customer_id,
        'score_drop',
        'warning',
        format('Health score dropped %s points in 14 days (from %s to %s)', 
          v_previous_score - v_health.health_score, v_previous_score, v_health.health_score),
        'Review recent interactions for potential issues',
        jsonb_build_object('previous_score', v_previous_score, 'current_score', v_health.health_score)
      );
      v_alerts_created := v_alerts_created + 1;
    END IF;
  END IF;
  
  -- ============================================
  -- Alert Rule 2: Declining Trend (2+ weeks)
  -- ============================================
  IF v_health.sentiment_trend = 'declining' AND v_health.trend_direction <= -1 THEN
    PERFORM create_customer_alert(
      p_customer_id,
      'declining_trend',
      'warning',
      'Customer health has been declining for 2+ weeks',
      'Investigate root cause and plan intervention strategy',
      jsonb_build_object('trend_direction', v_health.trend_direction, 'current_score', v_health.health_score)
    );
    v_alerts_created := v_alerts_created + 1;
  END IF;
  
  -- ============================================
  -- Alert Rule 3: No Interaction
  -- ============================================
  IF v_days_since_interaction > 30 THEN
    PERFORM create_customer_alert(
      p_customer_id,
      'no_interaction',
      'critical',
      format('No interaction in %s days', v_days_since_interaction),
      'Reach out immediately to re-engage the customer',
      jsonb_build_object('days_since_interaction', v_days_since_interaction)
    );
    v_alerts_created := v_alerts_created + 1;
  ELSIF v_days_since_interaction > 14 THEN
    PERFORM create_customer_alert(
      p_customer_id,
      'no_interaction',
      'warning',
      format('No interaction in %s days', v_days_since_interaction),
      'Schedule a check-in call or send a touchpoint message',
      jsonb_build_object('days_since_interaction', v_days_since_interaction)
    );
    v_alerts_created := v_alerts_created + 1;
  END IF;
  
  -- ============================================
  -- Alert Rule 4: Repeated Negative Interactions
  -- ============================================
  IF v_negative_count >= 3 THEN
    PERFORM create_customer_alert(
      p_customer_id,
      'repeated_negative',
      'critical',
      format('%s negative interactions in the past week', v_negative_count),
      'Escalate to customer success manager for immediate attention',
      jsonb_build_object('negative_count', v_negative_count)
    );
    v_alerts_created := v_alerts_created + 1;
  END IF;
  
  -- ============================================
  -- Alert Rule 5: Critical Health Score
  -- ============================================
  IF v_health.health_label = 'critical' THEN
    PERFORM create_customer_alert(
      p_customer_id,
      'churn_risk',
      'critical',
      format('Customer health is critical (score: %s)', v_health.health_score),
      'Immediate executive attention required - high churn risk',
      jsonb_build_object('health_score', v_health.health_score, 'health_label', v_health.health_label)
    );
    v_alerts_created := v_alerts_created + 1;
  END IF;
  
  -- ============================================
  -- Alert Rule 6: Engagement Drop
  -- ============================================
  IF v_health.engagement_factor < 30 THEN
    PERFORM create_customer_alert(
      p_customer_id,
      'engagement_drop',
      'warning',
      format('Customer engagement is very low (factor: %s/100)', v_health.engagement_factor),
      'Review engagement strategy and consider proactive outreach',
      jsonb_build_object('engagement_factor', v_health.engagement_factor)
    );
    v_alerts_created := v_alerts_created + 1;
  END IF;
  
  RETURN v_alerts_created;
END;
$$;


ALTER FUNCTION "public"."evaluate_customer_alerts"("p_customer_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_old_invites"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.team_invites
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."expire_old_invites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_api_key"("p_user_id" "uuid", "p_name" "text", "p_scopes" "text"[] DEFAULT ARRAY['read'::"text"], "p_rate_limit" integer DEFAULT 100, "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("key_id" "uuid", "api_key" "text", "key_prefix" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_key_id UUID;
  v_random_part TEXT;
  v_full_key TEXT;
  v_prefix TEXT;
  v_hash TEXT;
BEGIN
  -- Generate random key part (32 chars)
  v_random_part := encode(gen_random_bytes(24), 'base64');
  v_random_part := replace(replace(replace(v_random_part, '+', ''), '/', ''), '=', '');
  v_random_part := LEFT(v_random_part, 32);

  -- Create full key with prefix
  v_prefix := 'pk_live_';
  v_full_key := v_prefix || v_random_part;

  -- Hash for storage
  v_hash := encode(sha256(v_full_key::bytea), 'hex');

  -- Insert the key
  INSERT INTO api_keys (
    user_id,
    name,
    key_prefix,
    key_hash,
    scopes,
    rate_limit,
    expires_at
  )
  VALUES (
    p_user_id,
    p_name,
    LEFT(v_full_key, 12),
    v_hash,
    p_scopes,
    p_rate_limit,
    p_expires_at
  )
  RETURNING id INTO v_key_id;

  -- Return the key (only time it's visible unhashed)
  RETURN QUERY SELECT
    v_key_id,
    v_full_key,
    LEFT(v_full_key, 12);
END;
$$;


ALTER FUNCTION "public"."generate_api_key"("p_user_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_rate_limit" integer, "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_public_link"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$;


ALTER FUNCTION "public"."generate_public_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_alert_statistics"() RETURNS TABLE("total_active" bigint, "critical_count" bigint, "warning_count" bigint, "unacknowledged_count" bigint, "avg_resolution_hours" double precision)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE resolved_at IS NULL)::BIGINT as total_active,
    COUNT(*) FILTER (WHERE resolved_at IS NULL AND severity = 'critical')::BIGINT as critical_count,
    COUNT(*) FILTER (WHERE resolved_at IS NULL AND severity = 'warning')::BIGINT as warning_count,
    COUNT(*) FILTER (WHERE resolved_at IS NULL AND acknowledged_at IS NULL)::BIGINT as unacknowledged_count,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
    ) FILTER (WHERE resolved_at IS NOT NULL)::NUMERIC, 1)::DOUBLE PRECISION as avg_resolution_hours
  FROM customer_alerts;
END;
$$;


ALTER FUNCTION "public"."get_alert_statistics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_alerts_by_type"() RETURNS TABLE("alert_type" "text", "active_count" bigint, "resolved_today" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.alert_type,
    COUNT(*) FILTER (WHERE ca.resolved_at IS NULL)::BIGINT as active_count,
    COUNT(*) FILTER (WHERE ca.resolved_at >= CURRENT_DATE)::BIGINT as resolved_today
  FROM customer_alerts ca
  GROUP BY ca.alert_type
  ORDER BY active_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_alerts_by_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_analytics_dashboard"("p_user_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("total_messages" bigint, "messages_sent" bigint, "messages_received" bigint, "avg_response_time" numeric, "response_rate" numeric, "avg_sentiment" numeric, "top_contacts" "jsonb", "channel_breakdown" "jsonb", "daily_activity" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT
      SUM(dm.messages_sent + dm.messages_received) as total,
      SUM(dm.messages_sent) as sent,
      SUM(dm.messages_received) as received,
      AVG(dm.avg_response_time_minutes) as avg_resp,
      AVG(dm.avg_sentiment_score) as avg_sent,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'date', dm.date,
          'sent', dm.messages_sent,
          'received', dm.messages_received,
          'sentiment', dm.avg_sentiment_score
        ) ORDER BY dm.date
      ) as daily
    FROM analytics_daily_metrics dm
    WHERE dm.user_id = p_user_id
      AND dm.date >= CURRENT_DATE - p_days
  ),
  top_contacts_data AS (
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'identifier', ce.contact_identifier,
        'name', ce.contact_name,
        'score', ce.engagement_score,
        'trend', ce.engagement_trend,
        'last_contact', ce.last_interaction_at
      ) ORDER BY ce.engagement_score DESC
    ) as contacts
    FROM (
      SELECT * FROM analytics_contact_engagement
      WHERE user_id = p_user_id
      ORDER BY engagement_score DESC
      LIMIT 10
    ) ce
  ),
  channel_data AS (
    SELECT JSONB_BUILD_OBJECT(
      'email', SUM(COALESCE(emails_sent, 0) + COALESCE(emails_received, 0)),
      'sms', SUM(COALESCE(sms_sent, 0) + COALESCE(sms_received, 0)),
      'slack', SUM(COALESCE(slack_sent, 0) + COALESCE(slack_received, 0))
    ) as channels
    FROM analytics_daily_metrics
    WHERE user_id = p_user_id
      AND date >= CURRENT_DATE - p_days
  )
  SELECT
    COALESCE(dd.total, 0)::BIGINT,
    COALESCE(dd.sent, 0)::BIGINT,
    COALESCE(dd.received, 0)::BIGINT,
    COALESCE(dd.avg_resp, 0)::NUMERIC,
    0::NUMERIC,
    COALESCE(dd.avg_sent, 0)::NUMERIC,
    COALESCE(tc.contacts, '[]'::JSONB),
    COALESCE(cd.channels, '{}'::JSONB),
    COALESCE(dd.daily, '[]'::JSONB)
  FROM daily_data dd
  CROSS JOIN top_contacts_data tc
  CROSS JOIN channel_data cd;
END;
$$;


ALTER FUNCTION "public"."get_analytics_dashboard"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_audit_statistics"("p_tenant_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("total_events" bigint, "success_count" bigint, "failure_count" bigint, "unique_users" bigint, "top_action" "text", "top_category" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_events,
    COUNT(*) FILTER (WHERE al.status = 'success')::BIGINT as success_count,
    COUNT(*) FILTER (WHERE al.status = 'failure')::BIGINT as failure_count,
    COUNT(DISTINCT al.user_id)::BIGINT as unique_users,
    (
      SELECT al2.action
      FROM audit_logs al2
      WHERE al2.tenant_id = p_tenant_id
        AND al2.created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY al2.action
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as top_action,
    (
      SELECT al3.category
      FROM audit_logs al3
      WHERE al3.tenant_id = p_tenant_id
        AND al3.created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY al3.category
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as top_category
  FROM audit_logs al
  WHERE al.tenant_id = p_tenant_id
    AND al.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;


ALTER FUNCTION "public"."get_audit_statistics"("p_tenant_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_permissions"() RETURNS TABLE("resource" "text", "actions" "text"[])
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (VALUES
    ('agents', ARRAY['*', 'create', 'read', 'update', 'delete', 'run']),
    ('meetings', ARRAY['*', 'own', 'team', 'read', 'create', 'update', 'delete']),
    ('tasks', ARRAY['*', 'own', 'team', 'read', 'create', 'update', 'delete']),
    ('customers', ARRAY['*', 'read', 'create', 'update', 'delete']),
    ('analytics', ARRAY['*', 'read', 'team', 'export']),
    ('team', ARRAY['*', 'read', 'manage']),
    ('settings', ARRAY['*', 'read', 'update']),
    ('coaching', ARRAY['*', 'own', 'team', 'read', 'manage']),
    ('audit', ARRAY['*', 'read', 'export']),
    ('integrations', ARRAY['*', 'read', 'manage']),
    ('webhooks', ARRAY['*', 'read', 'create', 'update', 'delete'])
  ) AS t(resource, actions);
END;
$$;


ALTER FUNCTION "public"."get_available_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_avg_response_time"("p_user_id" "uuid", "p_contact_identifier" "text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT AVG(response_time_minutes) INTO v_avg
  FROM analytics_response_times
  WHERE user_id = p_user_id
    AND contact_identifier = p_contact_identifier
    AND was_responded = true;

  RETURN COALESCE(ROUND(v_avg, 2), 0);
END;
$$;


ALTER FUNCTION "public"."get_avg_response_time"("p_user_id" "uuid", "p_contact_identifier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_batch_thread_unread_counts"("p_thread_ids" "uuid"[], "p_user_id" "uuid") RETURNS TABLE("thread_id" "uuid", "unread_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.thread_id,
    COUNT(*)::INTEGER as unread_count
  FROM voice_thread_messages m
  WHERE
    m.thread_id = ANY(p_thread_ids)
    AND NOT (p_user_id = ANY(m.read_by))
    AND m.sender_id != p_user_id
    AND m.is_deleted = false
  GROUP BY m.thread_id;

  -- Note: Threads with 0 unread messages won't appear in the result.
  -- The frontend handles this by initializing all threads to 0, then
  -- updating only those that appear in the result set.
END;
$$;


ALTER FUNCTION "public"."get_batch_thread_unread_counts"("p_thread_ids" "uuid"[], "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_batch_thread_unread_counts"("p_thread_ids" "uuid"[], "p_user_id" "uuid") IS 'Batch operation to get unread message counts for multiple threads. Returns only threads with unread messages. Threads with 0 unread are omitted. Uses SECURITY DEFINER to bypass RLS for performance while maintaining security through parameter checks.';



CREATE OR REPLACE FUNCTION "public"."get_coaching_stats"("p_user_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("total_sessions" bigint, "total_prompts_shown" bigint, "total_prompts_used" bigint, "usage_rate" double precision, "avg_talk_time" double precision, "top_prompt_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_sessions,
    SUM(cs.prompts_shown)::BIGINT as total_prompts_shown,
    SUM(cs.prompts_used)::BIGINT as total_prompts_used,
    CASE 
      WHEN SUM(cs.prompts_shown) > 0 
      THEN ROUND((SUM(cs.prompts_used)::DOUBLE PRECISION / SUM(cs.prompts_shown)::DOUBLE PRECISION) * 100, 1)
      ELSE 0 
    END as usage_rate,
    ROUND(AVG(cs.talk_time_percentage)::NUMERIC, 1)::DOUBLE PRECISION as avg_talk_time,
    (
      SELECT cp.prompt_type 
      FROM coaching_prompts cp
      JOIN coaching_sessions cs2 ON cp.session_id = cs2.id
      WHERE cs2.user_id = p_user_id
        AND cs2.created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND cp.used_at IS NOT NULL
      GROUP BY cp.prompt_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as top_prompt_type
  FROM coaching_sessions cs
  WHERE cs.user_id = p_user_id
    AND cs.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;


ALTER FUNCTION "public"."get_coaching_stats"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_communication_frequency"("p_total_interactions" integer, "p_first_interaction_at" timestamp with time zone, "p_last_interaction_at" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_days_active INTEGER;
  v_avg_per_week FLOAT;
BEGIN
  IF p_first_interaction_at IS NULL OR p_last_interaction_at IS NULL THEN
    RETURN 'unknown';
  END IF;

  v_days_active := GREATEST(EXTRACT(EPOCH FROM (p_last_interaction_at - p_first_interaction_at)) / 86400, 1)::INTEGER;
  v_avg_per_week := (p_total_interactions::FLOAT / v_days_active) * 7;

  RETURN CASE
    WHEN v_avg_per_week >= 5 THEN 'daily'
    WHEN v_avg_per_week >= 1 THEN 'weekly'
    WHEN v_avg_per_week >= 0.25 THEN 'monthly'
    WHEN v_avg_per_week > 0 THEN 'sporadic'
    ELSE 'dormant'
  END;
END;
$$;


ALTER FUNCTION "public"."get_communication_frequency"("p_total_interactions" integer, "p_first_interaction_at" timestamp with time zone, "p_last_interaction_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_communication_frequency"("p_total_interactions" integer, "p_first_interaction_at" timestamp with time zone, "p_last_interaction_at" timestamp with time zone) IS 'Determines communication frequency pattern';



CREATE OR REPLACE FUNCTION "public"."get_communication_trends"("p_user_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("date" "date", "total_messages" integer, "sent" integer, "received" integer, "avg_response_time" numeric, "avg_sentiment" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    dm.date,
    (dm.messages_sent + dm.messages_received)::INTEGER as total_messages,
    dm.messages_sent::INTEGER as sent,
    dm.messages_received::INTEGER as received,
    dm.avg_response_time_minutes,
    dm.avg_sentiment_score
  FROM analytics_daily_metrics dm
  WHERE dm.user_id = p_user_id
    AND dm.date >= CURRENT_DATE - p_days
  ORDER BY dm.date ASC;
END;
$$;


ALTER FUNCTION "public"."get_communication_trends"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_avg_sentiment"("p_customer_id" "text", "p_days" integer DEFAULT 30) RETURNS double precision
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  avg_score DOUBLE PRECISION;
BEGIN
  SELECT AVG(sentiment_score) INTO avg_score
  FROM customer_sentiment
  WHERE customer_id = p_customer_id
    AND analyzed_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN COALESCE(avg_score, 0);
END;
$$;


ALTER FUNCTION "public"."get_customer_avg_sentiment"("p_customer_id" "text", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customers_needing_attention"("p_limit" integer DEFAULT 20) RETURNS TABLE("customer_id" "text", "health_score" integer, "health_label" "text", "sentiment_trend" "text", "trend_direction" integer, "days_since_interaction" integer, "top_concern" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ch.customer_id,
    ch.health_score,
    ch.health_label,
    ch.sentiment_trend,
    ch.trend_direction,
    CASE 
      WHEN ch.last_interaction IS NULL THEN 999
      ELSE EXTRACT(DAY FROM NOW() - ch.last_interaction)::INT
    END as days_since_interaction,
    CASE
      WHEN ch.sentiment_factor < 40 THEN 'Low sentiment'
      WHEN ch.engagement_factor < 40 THEN 'Low engagement'
      WHEN ch.responsiveness_factor < 40 THEN 'Slow responses'
      WHEN ch.deal_progress_factor < 40 THEN 'Stalled deals'
      WHEN ch.task_completion_factor < 40 THEN 'Incomplete tasks'
      ELSE 'Multiple factors'
    END as top_concern
  FROM customer_health ch
  WHERE ch.health_label IN ('at_risk', 'critical')
     OR ch.sentiment_trend = 'declining'
  ORDER BY 
    CASE ch.health_label
      WHEN 'critical' THEN 1
      WHEN 'at_risk' THEN 2
      ELSE 3
    END,
    ch.health_score ASC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_customers_needing_attention"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_doc_by_public_link"("link" character varying) RETURNS TABLE("doc_id" "uuid", "permissions" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT ds.doc_id, ds.permissions
  FROM document_shares ds
  WHERE ds.public_link = link
  AND (ds.expires_at IS NULL OR ds.expires_at > NOW());
END;
$$;


ALTER FUNCTION "public"."get_doc_by_public_link"("link" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_doc_permissions"("check_user_id" "uuid", "check_doc_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if user owns the document (full permissions)
  IF EXISTS (
    SELECT 1 FROM knowledge_docs d
    WHERE d.id = check_doc_id AND d.user_id = check_user_id
  ) THEN
    RETURN '{"canView": true, "canComment": true, "canEdit": true, "canShare": true, "isOwner": true}'::jsonb;
  END IF;

  -- Get direct document share permissions
  SELECT ds.permissions INTO result
  FROM document_shares ds
  WHERE ds.doc_id = check_doc_id
  AND ds.shared_with_user = check_user_id
  AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
  LIMIT 1;

  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Get project share permissions
  SELECT ps.permissions INTO result
  FROM knowledge_docs d
  JOIN project_shares ps ON ps.project_id = d.project_id
  WHERE d.id = check_doc_id
  AND ps.shared_with_user = check_user_id
  AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
  LIMIT 1;

  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- No access
  RETURN '{"canView": false, "canComment": false, "canEdit": false, "canShare": false}'::jsonb;
END;
$$;


ALTER FUNCTION "public"."get_doc_permissions"("check_user_id" "uuid", "check_doc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_enriched_user_profile"("p_requesting_user_id" "uuid", "p_target_user_id" "uuid") RETURNS TABLE("id" "uuid", "handle" "text", "display_name" "text", "full_name" "text", "bio" "text", "avatar_url" "text", "phone_number" "text", "email" "text", "company" "text", "role" "text", "location" "text", "birthday" "date", "is_verified" boolean, "online_status" "text", "last_active_at" timestamp with time zone, "last_seen_at" timestamp with time zone, "nickname" "text", "custom_notes" "text", "custom_tags" "text"[], "custom_phone" "text", "custom_email" "text", "custom_birthday" "date", "custom_company" "text", "custom_role" "text", "custom_address" "text", "is_favorite" boolean, "is_blocked" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.handle,
        p.display_name,
        p.full_name,
        p.bio,
        p.avatar_url,
        p.phone_number,  -- Explicitly use p.phone_number
        p.email,         -- Use email from user_profiles table
        p.company,
        p.role,
        p.location,
        p.birthday,
        p.is_verified,
        p.online_status,
        p.last_active_at,
        p.last_seen_at,
        -- Annotation fields (NULL if no annotation exists)
        a.nickname,
        a.custom_notes,
        a.custom_tags,
        a.custom_phone,
        a.custom_email,
        a.custom_birthday,
        a.custom_company,
        a.custom_role,
        a.custom_address,
        COALESCE(a.is_favorite, false) as is_favorite,
        COALESCE(a.is_blocked, false) as is_blocked
    FROM public.user_profiles p
    LEFT JOIN public.user_contact_annotations a 
        ON a.user_id = p_requesting_user_id AND a.target_user_id = p.id
    WHERE p.id = p_target_user_id;
END;
$$;


ALTER FUNCTION "public"."get_enriched_user_profile"("p_requesting_user_id" "uuid", "p_target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_enriched_user_profile"("p_requesting_user_id" "uuid", "p_target_user_id" "uuid") IS 'Gets user profile enriched with requesting user''s private annotations - FIXED ambiguous column reference';



CREATE OR REPLACE FUNCTION "public"."get_health_distribution"() RETURNS TABLE("health_label" "text", "customer_count" bigint, "percentage" double precision)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COUNT(*) INTO total FROM customer_health;
  
  RETURN QUERY
  SELECT 
    ch.health_label,
    COUNT(*)::BIGINT as customer_count,
    CASE WHEN total > 0 
      THEN ROUND((COUNT(*)::DOUBLE PRECISION / total) * 100, 1)
      ELSE 0 
    END as percentage
  FROM customer_health ch
  GROUP BY ch.health_label
  ORDER BY 
    CASE ch.health_label
      WHEN 'critical' THEN 1
      WHEN 'at_risk' THEN 2
      WHEN 'needs_attention' THEN 3
      WHEN 'healthy' THEN 4
    END;
END;
$$;


ALTER FUNCTION "public"."get_health_distribution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_last_active_status"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    profile RECORD;
    minutes_ago INTEGER;
    hours_ago INTEGER;
    days_ago INTEGER;
BEGIN
    SELECT online_status, last_active_at 
    INTO profile
    FROM public.user_profiles
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN 'Unknown';
    END IF;
    
    IF profile.online_status = 'online' THEN
        RETURN 'Active now';
    END IF;
    
    -- Calculate time difference
    minutes_ago := EXTRACT(EPOCH FROM (NOW() - profile.last_active_at)) / 60;
    
    IF minutes_ago < 1 THEN
        RETURN 'Active just now';
    ELSIF minutes_ago < 60 THEN
        RETURN 'Active ' || minutes_ago || 'm ago';
    ELSE
        hours_ago := minutes_ago / 60;
        IF hours_ago < 24 THEN
            RETURN 'Active ' || hours_ago || 'h ago';
        ELSE
            days_ago := hours_ago / 24;
            IF days_ago = 1 THEN
                RETURN 'Active yesterday';
            ELSE
                RETURN 'Active ' || days_ago || 'd ago';
            END IF;
        END IF;
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_last_active_status"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_last_active_status"("p_user_id" "uuid") IS 'Returns human-readable last active status (e.g., "Active 5m ago")';



CREATE OR REPLACE FUNCTION "public"."get_lead_grade"("score" integer) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN CASE
    WHEN score >= 80 THEN 'A'
    WHEN score >= 60 THEN 'B'
    WHEN score >= 40 THEN 'C'
    WHEN score >= 20 THEN 'D'
    ELSE 'F'
  END;
END;
$$;


ALTER FUNCTION "public"."get_lead_grade"("score" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_lead_grade"("score" integer) IS 'Converts numeric lead score to letter grade (A-F)';



CREATE OR REPLACE FUNCTION "public"."get_message_metrics"("message_uuid" "uuid") RETURNS TABLE("total_shown" bigint, "total_opened" bigint, "total_clicked" bigint, "total_dismissed" bigint, "open_rate" numeric, "click_rate" numeric, "avg_time_to_action" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE interaction_type = 'shown') AS total_shown,
    COUNT(*) FILTER (WHERE interaction_type IN ('clicked', 'cta_clicked')) AS total_opened,
    COUNT(*) FILTER (WHERE interaction_type = 'clicked') AS total_clicked,
    COUNT(*) FILTER (WHERE interaction_type = 'dismissed') AS total_dismissed,
    -- Open rate = (clicked OR cta_clicked) / shown
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND(
          (COUNT(DISTINCT user_id) FILTER (WHERE interaction_type IN ('clicked', 'cta_clicked'))::NUMERIC /
          COUNT(DISTINCT user_id) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100,
          2
        )
      ELSE 0
    END AS open_rate,
    -- Click rate = clicked / shown
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE interaction_type = 'clicked')::NUMERIC /
          COUNT(*) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100,
          2
        )
      ELSE 0
    END AS click_rate,
    -- Average view duration (as time to action)
    ROUND(AVG(viewed_duration_seconds) FILTER (WHERE viewed_duration_seconds IS NOT NULL), 2) AS avg_time_to_action
  FROM message_interactions
  WHERE message_id = message_uuid;
END;
$$;


ALTER FUNCTION "public"."get_message_metrics"("message_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_message_reaction_counts"("p_message_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_counts JSONB;
BEGIN
  SELECT jsonb_object_agg(emoji, count)
  INTO v_counts
  FROM (
    SELECT emoji, COUNT(*)::int as count
    FROM voice_message_reactions
    WHERE message_id = p_message_id
    GROUP BY emoji
  ) counts;

  RETURN COALESCE(v_counts, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_message_reaction_counts"("p_message_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_message_reaction_counts"("p_message_id" "uuid") IS 'Returns aggregated reaction counts as JSONB object';



CREATE OR REPLACE FUNCTION "public"."get_online_users_count"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM public.user_profiles
    WHERE online_status = 'online'
    AND last_active_at > NOW() - INTERVAL '5 minutes';
    
    RETURN count;
END;
$$;


ALTER FUNCTION "public"."get_online_users_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    annotation_id UUID;
BEGIN
    -- Try to find existing annotation
    SELECT id INTO annotation_id
    FROM public.user_contact_annotations
    WHERE user_id = p_user_id AND target_user_id = p_target_user_id;
    
    -- Create if not exists
    IF annotation_id IS NULL THEN
        INSERT INTO public.user_contact_annotations (user_id, target_user_id)
        VALUES (p_user_id, p_target_user_id)
        RETURNING id INTO annotation_id;
    END IF;
    
    RETURN annotation_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_conversation"("user_a" "uuid", "user_b" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    conv_id UUID;
BEGIN
    -- Try to find existing conversation
    SELECT id INTO conv_id
    FROM public.pulse_conversations
    WHERE (user1_id = LEAST(user_a, user_b) AND user2_id = GREATEST(user_a, user_b));

    -- Create if not exists
    IF conv_id IS NULL THEN
        INSERT INTO public.pulse_conversations (user1_id, user2_id)
        VALUES (LEAST(user_a, user_b), GREATEST(user_a, user_b))
        RETURNING id INTO conv_id;
    END IF;

    RETURN conv_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_conversation"("user_a" "uuid", "user_b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_dm_channel"("user1_id" "uuid", "user2_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  channel_id UUID;
BEGIN
  SELECT id INTO channel_id
  FROM pulse_channels
  WHERE type = 'direct'
    AND participant_ids @> ARRAY[user1_id, user2_id]
    AND participant_ids <@ ARRAY[user1_id, user2_id];
  
  IF channel_id IS NULL THEN
    INSERT INTO pulse_channels (name, type, participant_ids)
    VALUES ('DM', 'direct', ARRAY[user1_id, user2_id])
    RETURNING id INTO channel_id;
  END IF;
  
  RETURN channel_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_dm_channel"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_email_thread"("p_thread_id" "text", "p_user_id" "uuid", "p_subject" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO email_threads (id, user_id, subject, first_message_at)
  VALUES (p_thread_id, p_user_id, p_subject, NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN p_thread_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_email_thread"("p_thread_id" "text", "p_user_id" "uuid", "p_subject" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_relationship_profile"("p_user_id" "uuid", "p_contact_email" "text", "p_contact_name" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_profile_id UUID;
  v_canonical_email TEXT;
BEGIN
  v_canonical_email := normalize_email(p_contact_email);

  -- Try to find existing profile
  SELECT id INTO v_profile_id
  FROM relationship_profiles
  WHERE user_id = p_user_id AND (contact_email = p_contact_email OR canonical_email = v_canonical_email);

  -- Create if not exists
  IF v_profile_id IS NULL THEN
    INSERT INTO relationship_profiles (user_id, contact_email, contact_name, canonical_email)
    VALUES (p_user_id, LOWER(p_contact_email), p_contact_name, v_canonical_email)
    RETURNING id INTO v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_relationship_profile"("p_user_id" "uuid", "p_contact_email" "text", "p_contact_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_relationship_profile"("p_user_id" "uuid", "p_contact_email" "text", "p_contact_name" "text") IS 'Gets existing or creates new relationship profile';



CREATE TABLE IF NOT EXISTS "public"."thread_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "is_starred" boolean DEFAULT false,
    "is_muted" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "pinned_at" timestamp with time zone,
    "starred_at" timestamp with time zone,
    "muted_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."thread_actions" OWNER TO "postgres";


COMMENT ON TABLE "public"."thread_actions" IS 'User-specific actions on conversation threads (pin, star, mute, archive)';



CREATE OR REPLACE FUNCTION "public"."get_or_create_thread_actions"("p_user_id" "uuid", "p_conversation_id" "uuid") RETURNS "public"."thread_actions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_actions thread_actions;
BEGIN
  SELECT * INTO v_actions
  FROM thread_actions
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
  
  IF NOT FOUND THEN
    INSERT INTO thread_actions (user_id, conversation_id)
    VALUES (p_user_id, p_conversation_id)
    RETURNING * INTO v_actions;
  END IF;
  
  RETURN v_actions;
END;
$$;


ALTER FUNCTION "public"."get_or_create_thread_actions"("p_user_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_video_vox_conversation"("p_participant_ids" "uuid"[], "p_created_by" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_conversation_id UUID;
  v_sorted_ids UUID[];
BEGIN
  -- Sort participant IDs for consistent lookup
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_sorted_ids FROM UNNEST(p_participant_ids) AS id;

  -- Try to find existing conversation with exact same participants
  SELECT id INTO v_conversation_id
  FROM video_vox_conversations
  WHERE participant_ids @> v_sorted_ids
    AND participant_ids <@ v_sorted_ids;

  -- If not found, create new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO video_vox_conversations (participant_ids, created_by)
    VALUES (v_sorted_ids, p_created_by)
    RETURNING id INTO v_conversation_id;

    -- Add all participants as members
    INSERT INTO video_vox_conversation_members (conversation_id, user_id)
    SELECT v_conversation_id, UNNEST(v_sorted_ids);
  END IF;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_video_vox_conversation"("p_participant_ids" "uuid"[], "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_retention_by_engagement"() RETURNS TABLE("engagement_level" "text", "total_users" bigint, "day_1_retention_rate" numeric, "day_7_retention_rate" numeric, "day_30_retention_rate" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN total_messages_clicked >= 3 THEN 'High Engagement'
      WHEN total_messages_clicked >= 1 THEN 'Medium Engagement'
      ELSE 'No Engagement'
    END AS engagement_level,
    COUNT(*) AS total_users,
    ROUND((COUNT(*) FILTER (WHERE returned_day_1 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_1_retention_rate,
    ROUND((COUNT(*) FILTER (WHERE returned_day_7 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_7_retention_rate,
    ROUND((COUNT(*) FILTER (WHERE returned_day_30 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_30_retention_rate
  FROM user_retention_cohorts
  GROUP BY engagement_level
  ORDER BY
    CASE engagement_level
      WHEN 'High Engagement' THEN 1
      WHEN 'Medium Engagement' THEN 2
      ELSE 3
    END;
END;
$$;


ALTER FUNCTION "public"."get_retention_by_engagement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_retention_by_message_exposure"() RETURNS TABLE("exposed_to_messages" boolean, "user_count" bigint, "day_1_retention" numeric, "day_7_retention" numeric, "day_30_retention" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    (total_messages_seen > 0) AS exposed_to_messages,
    COUNT(*) AS user_count,
    ROUND((COUNT(*) FILTER (WHERE returned_day_1 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_1_retention,
    ROUND((COUNT(*) FILTER (WHERE returned_day_7 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_7_retention,
    ROUND((COUNT(*) FILTER (WHERE returned_day_30 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_30_retention
  FROM user_retention_cohorts
  GROUP BY exposed_to_messages
  ORDER BY exposed_to_messages DESC;
END;
$$;


ALTER FUNCTION "public"."get_retention_by_message_exposure"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."retention_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "resource_type" "text" NOT NULL,
    "retention_days" integer NOT NULL,
    "archive_before_delete" boolean DEFAULT true NOT NULL,
    "notify_before_delete" boolean DEFAULT true NOT NULL,
    "notify_days_before" integer DEFAULT 7 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "retention_policies_positive_days" CHECK (("retention_days" > 0)),
    CONSTRAINT "retention_policies_valid_notify_days" CHECK ((("notify_days_before" >= 0) AND ("notify_days_before" < "retention_days")))
);


ALTER TABLE "public"."retention_policies" OWNER TO "postgres";


COMMENT ON TABLE "public"."retention_policies" IS 'Data retention policies per resource type';



COMMENT ON COLUMN "public"."retention_policies"."resource_type" IS 'Resource: meeting_transcripts, meeting_recordings, audit_logs, agent_runs, etc.';



COMMENT ON COLUMN "public"."retention_policies"."archive_before_delete" IS 'Whether to archive data before permanent deletion';



CREATE OR REPLACE FUNCTION "public"."get_retention_policy"("p_resource_type" "text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."retention_policies"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_policy retention_policies;
BEGIN
  -- First try tenant-specific policy
  IF p_tenant_id IS NOT NULL THEN
    SELECT * INTO v_policy
    FROM retention_policies
    WHERE resource_type = p_resource_type
      AND tenant_id = p_tenant_id
      AND is_active = TRUE;
    
    IF v_policy.id IS NOT NULL THEN
      RETURN v_policy;
    END IF;
  END IF;
  
  -- Fall back to default policy
  SELECT * INTO v_policy
  FROM retention_policies
  WHERE resource_type = p_resource_type
    AND tenant_id IS NULL
    AND is_active = TRUE;
  
  RETURN v_policy;
END;
$$;


ALTER FUNCTION "public"."get_retention_policy"("p_resource_type" "text", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_role_by_name"("p_role_name" "text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."roles"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_role roles;
BEGIN
  SELECT * INTO v_role
  FROM roles
  WHERE name = p_role_name
    AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
  ORDER BY tenant_id NULLS LAST  -- Prefer tenant-specific over system
  LIMIT 1;
  
  RETURN v_role;
END;
$$;


ALTER FUNCTION "public"."get_role_by_name"("p_role_name" "text", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_smart_collection_docs"("collection_id" "uuid") RETURNS TABLE("doc_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  collection_rules JSONB;
  collection_user UUID;
BEGIN
  -- Get the collection rules and user
  SELECT rules, user_id INTO collection_rules, collection_user
  FROM document_collections
  WHERE id = collection_id AND type = 'smart';

  IF collection_rules IS NULL THEN
    RETURN;
  END IF;

  -- Return matching documents
  RETURN QUERY
  SELECT d.id
  FROM knowledge_docs d
  WHERE d.user_id = collection_user
    AND d.processing_status = 'completed'
    -- Filter by keywords in title or content
    AND (
      collection_rules->'keywords' IS NULL
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(collection_rules->'keywords') k
        WHERE d.title ILIKE '%' || k || '%'
           OR d.text_content ILIKE '%' || k || '%'
      )
    )
    -- Filter by file types
    AND (
      collection_rules->'fileTypes' IS NULL
      OR d.file_type = ANY(
        SELECT jsonb_array_elements_text(collection_rules->'fileTypes')
      )
    )
    -- Filter by date range
    AND (
      collection_rules->'dateRange' IS NULL
      OR (
        d.created_at >= (collection_rules->'dateRange'->>0)::timestamp
        AND d.created_at <= (collection_rules->'dateRange'->>1)::timestamp
      )
    )
    -- Filter by tags
    AND (
      collection_rules->'tags' IS NULL
      OR EXISTS (
        SELECT 1 FROM doc_tags dt
        JOIN document_tags t ON t.id = dt.tag_id
        WHERE dt.doc_id = d.id
        AND t.name = ANY(
          SELECT jsonb_array_elements_text(collection_rules->'tags')
        )
      )
    );
END;
$$;


ALTER FUNCTION "public"."get_smart_collection_docs"("collection_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_thread_unread_count"("p_thread_id" "uuid", "p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM voice_thread_messages
  WHERE thread_id = p_thread_id
    AND NOT (p_user_id = ANY(read_by))
    AND sender_id != p_user_id
    AND is_deleted = false;

  RETURN COALESCE(v_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_thread_unread_count"("p_thread_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_thread_unread_count"("p_thread_id" "uuid", "p_user_id" "uuid") IS 'Returns the number of unread messages in a thread for a specific user';



CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_permissions JSONB := '[]'::jsonb;
BEGIN
  SELECT jsonb_agg(DISTINCT perm)
  INTO v_permissions
  FROM (
    SELECT jsonb_array_elements_text(r.permissions) as perm
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND (ur.tenant_id = p_tenant_id OR r.tenant_id IS NULL)
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ) perms;
  
  RETURN COALESCE(v_permissions, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_roles"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS TABLE("role_id" "uuid", "role_name" "text", "display_name" "text", "is_system" boolean, "granted_at" timestamp with time zone, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as role_id,
    r.name as role_name,
    r.display_name,
    r.is_system,
    ur.granted_at,
    ur.expires_at
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
    AND (ur.tenant_id = p_tenant_id OR r.tenant_id IS NULL)
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY r.is_system DESC, r.name;
END;
$$;


ALTER FUNCTION "public"."get_user_roles"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_webhook_events"() RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN ARRAY[
    'meeting.created', 'meeting.completed', 'meeting.transcribed',
    'task.created', 'task.completed',
    'deal.created', 'deal.stage_changed', 'deal.won', 'deal.lost',
    'agent.run.completed', 'agent.run.failed',
    'customer.health.changed', 'customer.alert.created'
  ];
END;
$$;


ALTER FUNCTION "public"."get_webhook_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_webhooks_for_event"("p_event_type" "text") RETURNS SETOF "public"."webhooks"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM webhooks WHERE is_active = TRUE AND p_event_type = ANY(events);
END;
$$;


ALTER FUNCTION "public"."get_webhooks_for_event"("p_event_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_vacation_responder"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_responder RECORD;
  v_already_responded BOOLEAN;
  v_response_count INTEGER;
BEGIN
  -- Only process incoming emails (not sent, drafts, or spam)
  IF NEW.folder NOT IN ('inbox', 'important') THEN
    RETURN NEW;
  END IF;

  -- Check if user has active vacation responder
  SELECT * INTO v_responder
  FROM vacation_responder
  WHERE user_id = NEW.user_id
    AND enabled = true
    AND start_date <= NOW()
    AND (end_date IS NULL OR end_date >= NOW());

  -- No active vacation responder
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check if we already responded to this sender recently (within 7 days)
  SELECT EXISTS(
    SELECT 1
    FROM vacation_responder_log
    WHERE responder_id = v_responder.id
      AND sender_email = NEW.from_email
      AND sent_at > NOW() - INTERVAL '7 days'
  ) INTO v_already_responded;

  -- If only_first_email is enabled and we already responded, skip
  IF v_already_responded AND v_responder.only_first_email THEN
    RETURN NEW;
  END IF;

  -- If only_contacts_only is enabled, check if sender is a contact
  IF v_responder.contacts_only THEN
    IF NOT EXISTS(
      SELECT 1 FROM email_contacts
      WHERE user_id = NEW.user_id
        AND email = NEW.from_email
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Insert into queue for async processing
  INSERT INTO vacation_responder_queue (
    responder_id,
    email_id,
    sender_email,
    message,
    status
  ) VALUES (
    v_responder.id,
    NEW.id,
    NEW.from_email,
    v_responder.message,
    'pending'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the email insert
    RAISE WARNING 'Vacation responder error: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_vacation_responder"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_vacation_responder"() IS 'Automatically queues vacation responses for new emails';



CREATE OR REPLACE FUNCTION "public"."health_score_to_label"("score" integer) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF score >= 80 THEN RETURN 'healthy';
  ELSIF score >= 60 THEN RETURN 'needs_attention';
  ELSIF score >= 40 THEN RETURN 'at_risk';
  ELSE RETURN 'critical';
  END IF;
END;
$$;


ALTER FUNCTION "public"."health_score_to_label"("score" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_follower_count"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE pulse_users
  SET follower_count = follower_count + 1
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."increment_follower_count"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_following_count"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE pulse_users
  SET following_count = following_count + 1
  WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."increment_following_count"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_messages_clicked"("user_uuid" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO user_retention_cohorts (user_id, cohort_date, messages_clicked_count, last_seen_at, created_at, updated_at)
  VALUES (
    user_uuid,
    CURRENT_DATE,
    1,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, cohort_date)
  DO UPDATE SET
    messages_clicked_count = user_retention_cohorts.messages_clicked_count + 1,
    last_seen_at = NOW(),
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_messages_clicked"("user_uuid" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_messages_clicked"("user_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE user_retention_cohorts
  SET messages_clicked_count = messages_clicked_count + 1, last_seen_at = NOW()
  WHERE user_id = user_uuid;
END;
$$;


ALTER FUNCTION "public"."increment_messages_clicked"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_messages_seen"("user_uuid" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO user_retention_cohorts (user_id, cohort_date, messages_seen_count, last_seen_at, created_at, updated_at)
  VALUES (
    user_uuid,
    CURRENT_DATE,
    1,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, cohort_date)
  DO UPDATE SET
    messages_seen_count = user_retention_cohorts.messages_seen_count + 1,
    last_seen_at = NOW(),
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_messages_seen"("user_uuid" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_messages_seen"("user_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE user_retention_cohorts
  SET messages_seen_count = messages_seen_count + 1, last_seen_at = NOW()
  WHERE user_id = user_uuid;
END;
$$;


ALTER FUNCTION "public"."increment_messages_seen"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_search_usage"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- This will be called from application code
  -- UPDATE saved_searches SET use_count = use_count + 1, last_used_at = NOW() WHERE id = search_id;
END;
$$;


ALTER FUNCTION "public"."increment_search_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_session_counter"("p_session_id" "uuid", "p_column_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_column_name = 'prompts_shown' THEN
    UPDATE coaching_sessions 
    SET prompts_shown = prompts_shown + 1, updated_at = NOW()
    WHERE id = p_session_id;
  ELSIF p_column_name = 'prompts_used' THEN
    UPDATE coaching_sessions 
    SET prompts_used = prompts_used + 1, updated_at = NOW()
    WHERE id = p_session_id;
  ELSIF p_column_name = 'prompts_dismissed' THEN
    UPDATE coaching_sessions 
    SET prompts_dismissed = prompts_dismissed + 1, updated_at = NOW()
    WHERE id = p_session_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."increment_session_counter"("p_session_id" "uuid", "p_column_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_user_stat"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_message_statistics (user_id, messages_sent, fast_responses, tasks_created, decisions_made)
  VALUES (p_user_id, 
    CASE WHEN p_stat_name = 'messages_sent' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'fast_responses' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'tasks_created' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'decisions_made' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    messages_sent = user_message_statistics.messages_sent + 
      CASE WHEN p_stat_name = 'messages_sent' THEN p_increment ELSE 0 END,
    fast_responses = user_message_statistics.fast_responses + 
      CASE WHEN p_stat_name = 'fast_responses' THEN p_increment ELSE 0 END,
    tasks_created = user_message_statistics.tasks_created + 
      CASE WHEN p_stat_name = 'tasks_created' THEN p_increment ELSE 0 END,
    decisions_made = user_message_statistics.decisions_made + 
      CASE WHEN p_stat_name = 'decisions_made' THEN p_increment ELSE 0 END,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_user_stat"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_video_vox_unread"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE video_vox_conversation_members
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_video_vox_unread"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_webhook_failures"("p_webhook_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE webhooks 
  SET consecutive_failures = consecutive_failures + 1, updated_at = NOW()
  WHERE id = p_webhook_id
  RETURNING consecutive_failures INTO v_count;
  
  IF v_count >= 10 THEN
    UPDATE webhooks SET is_active = FALSE, updated_at = NOW() WHERE id = p_webhook_id;
  END IF;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."increment_webhook_failures"("p_webhook_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_user_smart_lists"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Needs Follow-up
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Needs Follow-up',
    'Contacts awaiting your response or needing follow-up',
    'system',
    '{"type": "needs_follow_up", "days_since_response": 7, "has_pending_thread": true}'::jsonb,
    'clock',
    '#8b5cf6',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Warm Leads
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Warm Leads',
    'Contacts with high engagement and positive interactions',
    'system',
    '{"type": "warm_leads", "min_score": 70, "trends": ["rising", "stable"], "recent_activity": true}'::jsonb,
    'fire',
    '#f97316',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Inactive > 30 Days
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Inactive > 30 Days',
    'Contacts with no interaction in over 30 days',
    'system',
    '{"type": "inactive", "days_since_contact": 30}'::jsonb,
    'moon',
    '#eab308',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- VIP Contacts
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'VIP Contacts',
    'Your most important contacts',
    'system',
    '{"type": "vip", "is_vip": true}'::jsonb,
    'star',
    '#eab308',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Hot Leads
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Hot Leads',
    'Contacts showing strong buying signals',
    'system',
    '{"type": "hot_leads", "min_lead_score": 80, "has_buying_signals": true}'::jsonb,
    'trending-up',
    '#ef4444',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- At Risk Relationships
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'At Risk',
    'Relationships showing signs of decline',
    'system',
    '{"type": "at_risk", "trend": "falling", "score_drop": 15}'::jsonb,
    'alert-triangle',
    '#ef4444',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_user_smart_lists"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_user_smart_lists"("p_user_id" "uuid") IS 'Creates default system smart lists for a new user';



CREATE OR REPLACE FUNCTION "public"."invalidate_sso_session"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE sso_sessions
  SET is_active = FALSE
  WHERE id = p_session_id
    AND is_active = TRUE;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;


ALTER FUNCTION "public"."invalidate_sso_session"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invalidate_user_sso_sessions"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE sso_sessions
  SET is_active = FALSE
  WHERE user_id = p_user_id
    AND is_active = TRUE;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;


ALTER FUNCTION "public"."invalidate_user_sso_sessions"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_handle_available"("check_handle" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
    -- Check format (3-30 chars, lowercase alphanumeric and underscores)
    IF NOT (check_handle ~ '^[a-z0-9_]{3,30}$') THEN
        RETURN false;
    END IF;

    -- Check double underscores (escape _ with backslash in LIKE pattern)
    IF check_handle LIKE '%\_\_%' ESCAPE '\' THEN
        RETURN false;
    END IF;

    -- Check leading/trailing underscore (use LEFT/RIGHT instead of buggy LIKE pattern)
    IF LEFT(check_handle, 1) = '_' OR RIGHT(check_handle, 1) = '_' THEN
        RETURN false;
    END IF;

    -- Check reserved
    IF EXISTS (SELECT 1 FROM public.reserved_handles WHERE handle = check_handle) THEN
        RETURN false;
    END IF;

    -- Check taken
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE handle = check_handle) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$_$;


ALTER FUNCTION "public"."is_handle_available"("check_handle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_thread_participant"("thread_id" "uuid", "user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM voice_threads vt
    WHERE vt.id = thread_id
      AND user_id = ANY(vt.participants)
  );
END;
$$;


ALTER FUNCTION "public"."is_thread_participant"("thread_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_thread_participant"("thread_id" "uuid", "user_id" "uuid") IS 'Helper function to check if a user is a participant in a thread. Used by RLS policies.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "session_id" "text",
    "action" "text" NOT NULL,
    "category" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "request_id" "text",
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_logs_non_empty_action" CHECK (("length"(TRIM(BOTH FROM "action")) > 0)),
    CONSTRAINT "audit_logs_valid_category" CHECK (("category" = ANY (ARRAY['auth'::"text", 'access'::"text", 'modification'::"text", 'admin'::"text", 'agent'::"text", 'system'::"text", 'security'::"text"]))),
    CONSTRAINT "audit_logs_valid_status" CHECK (("status" = ANY (ARRAY['success'::"text", 'failure'::"text", 'warning'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Comprehensive audit log for all system actions';



COMMENT ON COLUMN "public"."audit_logs"."category" IS 'Category: auth, access, modification, admin, agent, system, security';



COMMENT ON COLUMN "public"."audit_logs"."changes" IS 'For modifications: JSON with before/after state';



COMMENT ON COLUMN "public"."audit_logs"."status" IS 'Result: success, failure, warning';



CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text" DEFAULT NULL::"text", "p_resource_id" "text" DEFAULT NULL::"text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_changes" "jsonb" DEFAULT NULL::"jsonb", "p_status" "text" DEFAULT 'success'::"text", "p_error_message" "text" DEFAULT NULL::"text", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text", "p_request_id" "text" DEFAULT NULL::"text", "p_session_id" "text" DEFAULT NULL::"text") RETURNS "public"."audit_logs"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_log audit_logs;
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    session_id,
    action,
    category,
    resource_type,
    resource_id,
    details,
    changes,
    ip_address,
    user_agent,
    request_id,
    status,
    error_message
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_session_id,
    p_action,
    p_category,
    p_resource_type,
    p_resource_id,
    p_details,
    p_changes,
    p_ip_address,
    p_user_agent,
    p_request_id,
    p_status,
    p_error_message
  )
  RETURNING * INTO v_log;
  
  RETURN v_log;
END;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_resource_id" "text", "p_details" "jsonb", "p_changes" "jsonb", "p_status" "text", "p_error_message" "text", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" "text", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_integration_sync"("p_integration_id" "uuid", "p_sync_type" "text", "p_direction" "text", "p_entity_type" "text" DEFAULT NULL::"text") RETURNS "public"."integration_sync_logs"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_log integration_sync_logs;
BEGIN
  INSERT INTO integration_sync_logs (integration_id, sync_type, direction, entity_type)
  VALUES (p_integration_id, p_sync_type, p_direction, p_entity_type)
  RETURNING * INTO v_log;
  RETURN v_log;
END;
$$;


ALTER FUNCTION "public"."log_integration_sync"("p_integration_id" "uuid", "p_sync_type" "text", "p_direction" "text", "p_entity_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_relationship_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
    VALUES (
      NEW.id,
      'created',
      NEW.created_by,
      jsonb_build_object(
        'source_type', NEW.source_type,
        'source_id', NEW.source_id,
        'target_type', NEW.target_type,
        'target_id', NEW.target_id,
        'relationship_type', NEW.relationship_type
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log soft delete as 'deleted' event
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
      INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
      VALUES (
        NEW.id,
        'deleted',
        NEW.deleted_by,
        jsonb_build_object('reason', 'soft_delete')
      );
    -- Log restore as 'restored' event
    ELSIF OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
      INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
      VALUES (
        NEW.id,
        'restored',
        NULL,
        jsonb_build_object('reason', 'restored')
      );
    -- Log other updates
    ELSE
      INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
      VALUES (
        NEW.id,
        'updated',
        NULL,
        jsonb_build_object(
          'old_confidence', OLD.confidence,
          'new_confidence', NEW.confidence,
          'evidence_changed', OLD.evidence IS DISTINCT FROM NEW.evidence
        )
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_relationship_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_inactive_users"("p_timeout_minutes" integer DEFAULT 5) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    WITH updated AS (
        UPDATE public.user_profiles
        SET
            online_status = 'offline',
            updated_at = NOW()
        WHERE online_status != 'offline'
        AND last_active_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;
    
    RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_inactive_users"("p_timeout_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_messages_read"("p_user_id" "uuid", "p_conversation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Mark messages as read
    UPDATE public.pulse_messages
    SET is_read = true, read_at = NOW()
    WHERE thread_id = p_conversation_id
    AND recipient_id = p_user_id
    AND is_read = false;

    -- Reset unread count in conversation
    UPDATE public.pulse_conversations
    SET
        user1_unread_count = CASE WHEN user1_id = p_user_id THEN 0 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN user2_id = p_user_id THEN 0 ELSE user2_unread_count END,
        updated_at = NOW()
    WHERE id = p_conversation_id;
END;
$$;


ALTER FUNCTION "public"."mark_messages_read"("p_user_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_thread_as_read"("p_thread_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update all unread messages in the thread
  UPDATE voice_thread_messages
  SET read_by = array_append(read_by, p_user_id)
  WHERE thread_id = p_thread_id
    AND NOT (p_user_id = ANY(read_by))
    AND sender_id != p_user_id
    AND is_deleted = false;

  -- Update last_read_at in participants table
  UPDATE voice_thread_participants
  SET last_read_at = NOW()
  WHERE thread_id = p_thread_id
    AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."mark_thread_as_read"("p_thread_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_thread_as_read"("p_thread_id" "uuid", "p_user_id" "uuid") IS 'Marks all messages in a thread as read for a specific user';



CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "content" "text", "similarity" double precision, "doc_title" "text", "doc_url" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.content,
    1 - (de.embedding <=> query_embedding) AS similarity,
    kd.title AS doc_title,
    kd.url AS doc_url
  FROM doc_embeddings de
  JOIN knowledge_docs kd ON de.doc_id = kd.id
  WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
  AND (
    kd.is_shared = true 
    OR (filter_user_id IS NOT NULL AND kd.user_id = filter_user_id)
  )
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Lowercase, remove dots from gmail local part, handle + aliases
  RETURN LOWER(
    CASE
      WHEN email LIKE '%@gmail.com' OR email LIKE '%@googlemail.com' THEN
        REPLACE(SPLIT_PART(SPLIT_PART(email, '@', 1), '+', 1), '.', '') || '@gmail.com'
      ELSE
        SPLIT_PART(email, '+', 1) || '@' || SPLIT_PART(email, '@', 2)
    END
  );
END;
$$;


ALTER FUNCTION "public"."normalize_email"("email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."normalize_email"("email" "text") IS 'Normalizes email addresses for deduplication (handles Gmail dots, + aliases)';



CREATE OR REPLACE FUNCTION "public"."prevent_circular_label_nesting"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_parent UUID;
  depth INTEGER := 0;
  max_depth INTEGER := 10;
BEGIN
  IF NEW.parent_label_id IS NULL THEN
    RETURN NEW;
  END IF;

  current_parent := NEW.parent_label_id;

  -- Check if parent exists and belongs to same user
  IF NOT EXISTS (
    SELECT 1 FROM custom_labels
    WHERE id = current_parent
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Parent label does not exist or belongs to different user';
  END IF;

  -- Traverse up the parent chain to detect cycles
  WHILE current_parent IS NOT NULL AND depth < max_depth LOOP
    IF current_parent = NEW.id THEN
      RAISE EXCEPTION 'Circular label nesting detected';
    END IF;

    SELECT parent_label_id INTO current_parent
    FROM custom_labels
    WHERE id = current_parent;

    depth := depth + 1;
  END LOOP;

  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Label nesting depth exceeds maximum of %', max_depth;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_circular_label_nesting"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_deleted_relationships"("p_older_than_days" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM relationships
  WHERE is_deleted = TRUE
    AND deleted_at < NOW() - (p_older_than_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."purge_deleted_relationships"("p_older_than_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."query_audit_logs"("p_tenant_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_action" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_resource_type" "text" DEFAULT NULL::"text", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "tenant_id" "uuid", "user_id" "uuid", "action" "text", "category" "text", "resource_type" "text", "resource_id" "text", "details" "jsonb", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.tenant_id,
    al.user_id,
    al.action,
    al.category,
    al.resource_type,
    al.resource_id,
    al.details,
    al.status,
    al.created_at
  FROM audit_logs al
  WHERE al.tenant_id = p_tenant_id
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_category IS NULL OR al.category = p_category)
    AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."query_audit_logs"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_all_engagement_scores"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_contact RECORD;
  v_new_score NUMERIC;
BEGIN
  FOR v_contact IN 
    SELECT * FROM analytics_contact_engagement WHERE user_id = p_user_id
  LOOP
    -- Calculate new score
    v_new_score := calculate_engagement_score(
      v_contact.total_messages_sent + v_contact.total_messages_received,
      COALESCE(v_contact.response_rate, 50),
      COALESCE(v_contact.avg_response_time_minutes, 60),
      v_contact.days_since_last_contact,
      COALESCE(v_contact.avg_sentiment, 0)
    );

    -- Update the score
    UPDATE analytics_contact_engagement
    SET 
      engagement_score = v_new_score,
      updated_at = NOW()
    WHERE id = v_contact.id;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."recalculate_all_engagement_scores"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_activity"("p_user_id" "uuid", "p_actor_id" "uuid", "p_action" character varying, "p_project_id" "uuid" DEFAULT NULL::"uuid", "p_doc_id" "uuid" DEFAULT NULL::"uuid", "p_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO activity_feed (user_id, actor_id, action, project_id, doc_id, details)
  VALUES (p_user_id, p_actor_id, p_action, p_project_id, p_doc_id, p_details)
  RETURNING id INTO activity_id;

  RETURN activity_id;
END;
$$;


ALTER FUNCTION "public"."record_activity"("p_user_id" "uuid", "p_actor_id" "uuid", "p_action" character varying, "p_project_id" "uuid", "p_doc_id" "uuid", "p_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected INT;
BEGIN
  DELETE FROM user_roles
  WHERE user_id = p_user_id
    AND role_id = p_role_id
    AND tenant_id = p_tenant_id;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;


ALTER FUNCTION "public"."remove_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_webhook_failures"("p_webhook_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE webhooks SET consecutive_failures = 0, updated_at = NOW() WHERE id = p_webhook_id;
END;
$$;


ALTER FUNCTION "public"."reset_webhook_failures"("p_webhook_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_alert"("p_alert_id" "uuid", "p_user_id" "uuid", "p_resolution_notes" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE customer_alerts
  SET 
    resolved_at = NOW(),
    resolved_by = p_user_id,
    resolution_notes = p_resolution_notes,
    updated_at = NOW()
  WHERE id = p_alert_id
    AND resolved_at IS NULL;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;


ALTER FUNCTION "public"."resolve_alert"("p_alert_id" "uuid", "p_user_id" "uuid", "p_resolution_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_relationship"("p_relationship_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE relationships
  SET
    is_deleted = FALSE,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = p_relationship_id
    AND is_deleted = TRUE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;


ALTER FUNCTION "public"."restore_relationship"("p_relationship_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 20, "filter_source_types" "text"[] DEFAULT NULL::"text"[], "filter_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "filter_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "text", "title" "text", "content" "text", "metadata" "jsonb", "chunk_index" integer, "created_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.id,
    sd.source_type,
    sd.source_id,
    sd.title,
    sd.content,
    sd.metadata,
    sd.chunk_index,
    sd.created_at,
    1 - (sd.embedding <=> query_embedding) AS similarity
  FROM search_documents sd
  WHERE
    sd.embedding IS NOT NULL
    AND 1 - (sd.embedding <=> query_embedding) > match_threshold
    AND (filter_source_types IS NULL OR sd.source_type = ANY(filter_source_types))
    AND (filter_date_from IS NULL OR sd.created_at >= filter_date_from)
    AND (filter_date_to IS NULL OR sd.created_at <= filter_date_to)
  ORDER BY sd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer DEFAULT 10, "similarity_threshold" double precision DEFAULT 0.5) RETURNS TABLE("id" "uuid", "content_type" "text", "source_id" "uuid", "source_type" "text", "text_content" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
        BEGIN
            RETURN QUERY
            SELECT
                e.id,
                e.content_type,
                e.source_id,
                e.source_type,
                e.text_content,
                1 - (e.embedding <=> query_embedding) AS similarity
            FROM embeddings e
            WHERE 1 - (e.embedding <=> query_embedding) > similarity_threshold
            ORDER BY e.embedding <=> query_embedding
            LIMIT match_count;
        END;
        $$;


ALTER FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_users"("search_query" "text", "limit_count" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "handle" "text", "display_name" "text", "full_name" "text", "avatar_url" "text", "is_verified" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.handle,
        p.display_name,
        p.full_name,
        p.avatar_url,
        p.is_verified
    FROM public.user_profiles p
    WHERE p.is_public = true
    AND (
        p.handle ILIKE '%' || search_query || '%'
        OR p.display_name ILIKE '%' || search_query || '%'
        OR p.full_name ILIKE '%' || search_query || '%'
    )
    ORDER BY
        CASE
            WHEN p.handle = lower(search_query) THEN 0
            WHEN p.handle LIKE lower(search_query) || '%' THEN 1
            WHEN p.display_name ILIKE search_query || '%' THEN 2
            ELSE 3
        END,
        p.display_name
    LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."search_users"("search_query" "text", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_pulse_message"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_content" "text", "p_content_type" "text" DEFAULT 'text'::"text", "p_media_url" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    msg_id UUID;
    conv_id UUID;
BEGIN
    -- Get or create conversation
    conv_id := get_or_create_conversation(p_sender_id, p_recipient_id);

    -- Insert message
    INSERT INTO public.pulse_messages (sender_id, recipient_id, thread_id, content, content_type, media_url)
    VALUES (p_sender_id, p_recipient_id, conv_id, p_content, p_content_type, p_media_url)
    RETURNING id INTO msg_id;

    -- Update conversation
    UPDATE public.pulse_conversations
    SET
        last_message_id = msg_id,
        last_message_at = NOW(),
        last_message_preview = LEFT(p_content, 100),
        user1_unread_count = CASE WHEN user1_id = p_recipient_id THEN user1_unread_count + 1 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN user2_id = p_recipient_id THEN user2_unread_count + 1 ELSE user2_unread_count END,
        updated_at = NOW()
    WHERE id = conv_id;

    RETURN msg_id;
END;
$$;


ALTER FUNCTION "public"."send_pulse_message"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_content" "text", "p_content_type" "text", "p_media_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sentiment_score_to_label"("score" double precision) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF score <= -0.6 THEN RETURN 'very_negative';
  ELSIF score <= -0.2 THEN RETURN 'negative';
  ELSIF score <= 0.2 THEN RETURN 'neutral';
  ELSIF score <= 0.6 THEN RETURN 'positive';
  ELSE RETURN 'very_positive';
  END IF;
END;
$$;


ALTER FUNCTION "public"."sentiment_score_to_label"("score" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_canonical_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.canonical_email := normalize_email(NEW.contact_email);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_canonical_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_relationship"("p_relationship_id" "uuid", "p_deleted_by" "text" DEFAULT 'system'::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE relationships
  SET
    is_deleted = TRUE,
    deleted_at = NOW(),
    deleted_by = p_deleted_by
  WHERE id = p_relationship_id
    AND is_deleted = FALSE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;


ALTER FUNCTION "public"."soft_delete_relationship"("p_relationship_id" "uuid", "p_deleted_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_voice_thread_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- When a new participant is added to the table, ensure they're in the array
  IF TG_OP = 'INSERT' THEN
    UPDATE voice_threads
    SET participants = array_append(participants, NEW.user_id)
    WHERE id = NEW.thread_id
      AND NOT (NEW.user_id = ANY(participants));
  END IF;

  -- When a participant is removed from the table, remove from array
  IF TG_OP = 'DELETE' THEN
    UPDATE voice_threads
    SET participants = array_remove(participants, OLD.user_id)
    WHERE id = OLD.thread_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."sync_voice_thread_participants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_thread_archive"("p_user_id" "uuid", "p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_is_archived BOOLEAN;
BEGIN
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_archived = NOT is_archived, archived_at = CASE WHEN NOT is_archived THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_archived INTO v_is_archived;
  RETURN v_is_archived;
END;
$$;


ALTER FUNCTION "public"."toggle_thread_archive"("p_user_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_thread_mute"("p_user_id" "uuid", "p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_is_muted BOOLEAN;
BEGIN
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_muted = NOT is_muted, muted_at = CASE WHEN NOT is_muted THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_muted INTO v_is_muted;
  RETURN v_is_muted;
END;
$$;


ALTER FUNCTION "public"."toggle_thread_mute"("p_user_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_thread_pin"("p_user_id" "uuid", "p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_is_pinned BOOLEAN;
BEGIN
  -- Get or create actions
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  
  -- Toggle pin
  UPDATE thread_actions
  SET 
    is_pinned = NOT is_pinned,
    pinned_at = CASE WHEN NOT is_pinned THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id
  RETURNING is_pinned INTO v_is_pinned;
  
  RETURN v_is_pinned;
END;
$$;


ALTER FUNCTION "public"."toggle_thread_pin"("p_user_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_thread_star"("p_user_id" "uuid", "p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_is_starred BOOLEAN;
BEGIN
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_starred = NOT is_starred, starred_at = CASE WHEN NOT is_starred THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_starred INTO v_is_starred;
  RETURN v_is_starred;
END;
$$;


ALTER FUNCTION "public"."toggle_thread_star"("p_user_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_blocked_senders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_blocked_senders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contact_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_nickname" "text" DEFAULT NULL::"text", "p_custom_notes" "text" DEFAULT NULL::"text", "p_custom_tags" "text"[] DEFAULT NULL::"text"[], "p_custom_phone" "text" DEFAULT NULL::"text", "p_custom_email" "text" DEFAULT NULL::"text", "p_custom_birthday" "date" DEFAULT NULL::"date", "p_custom_company" "text" DEFAULT NULL::"text", "p_custom_role" "text" DEFAULT NULL::"text", "p_custom_address" "text" DEFAULT NULL::"text", "p_is_favorite" boolean DEFAULT NULL::boolean, "p_is_blocked" boolean DEFAULT NULL::boolean) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    annotation_id UUID;
BEGIN
    -- Get or create annotation
    annotation_id := get_or_create_annotation(p_user_id, p_target_user_id);
    
    -- Update with provided values (NULL means don't update that field)
    UPDATE public.user_contact_annotations
    SET
        nickname = COALESCE(p_nickname, nickname),
        custom_notes = COALESCE(p_custom_notes, custom_notes),
        custom_tags = COALESCE(p_custom_tags, custom_tags),
        custom_phone = COALESCE(p_custom_phone, custom_phone),
        custom_email = COALESCE(p_custom_email, custom_email),
        custom_birthday = COALESCE(p_custom_birthday, custom_birthday),
        custom_company = COALESCE(p_custom_company, custom_company),
        custom_role = COALESCE(p_custom_role, custom_role),
        custom_address = COALESCE(p_custom_address, custom_address),
        is_favorite = COALESCE(p_is_favorite, is_favorite),
        is_blocked = COALESCE(p_is_blocked, is_blocked),
        updated_at = NOW()
    WHERE id = annotation_id;
    
    RETURN annotation_id;
END;
$$;


ALTER FUNCTION "public"."update_contact_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_nickname" "text", "p_custom_notes" "text", "p_custom_tags" "text"[], "p_custom_phone" "text", "p_custom_email" "text", "p_custom_birthday" "date", "p_custom_company" "text", "p_custom_role" "text", "p_custom_address" "text", "p_is_favorite" boolean, "p_is_blocked" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contact_recency"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE analytics_contact_engagement
  SET 
    days_since_last_contact = EXTRACT(DAY FROM (NOW() - last_interaction_at))::INTEGER,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND last_interaction_at IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."update_contact_recency"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_custom_label_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_custom_label_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_metrics"("p_user_id" "uuid", "p_date" "date", "p_channel" "text", "p_is_sent" boolean, "p_sentiment_score" numeric DEFAULT NULL::numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO analytics_daily_metrics (user_id, date, messages_sent, messages_received)
  VALUES (p_user_id, p_date, 0, 0)
  ON CONFLICT (user_id, date) DO NOTHING;

  IF p_is_sent THEN
    UPDATE analytics_daily_metrics
    SET
      messages_sent = messages_sent + 1,
      emails_sent = CASE WHEN p_channel = 'email' THEN emails_sent + 1 ELSE emails_sent END,
      sms_sent = CASE WHEN p_channel = 'sms' THEN sms_sent + 1 ELSE sms_sent END,
      slack_sent = CASE WHEN p_channel = 'slack' THEN slack_sent + 1 ELSE slack_sent END,
      updated_at = NOW()
    WHERE user_id = p_user_id AND date = p_date;
  ELSE
    UPDATE analytics_daily_metrics
    SET
      messages_received = messages_received + 1,
      emails_received = CASE WHEN p_channel = 'email' THEN emails_received + 1 ELSE emails_received END,
      sms_received = CASE WHEN p_channel = 'sms' THEN sms_received + 1 ELSE sms_received END,
      slack_received = CASE WHEN p_channel = 'slack' THEN slack_received + 1 ELSE slack_received END,
      updated_at = NOW()
    WHERE user_id = p_user_id AND date = p_date;
  END IF;

  IF p_sentiment_score IS NOT NULL THEN
    UPDATE analytics_daily_metrics
    SET
      avg_sentiment_score = COALESCE(
        (avg_sentiment_score * (messages_sent + messages_received - 1) + p_sentiment_score) /
        (messages_sent + messages_received),
        p_sentiment_score
      ),
      positive_messages = CASE WHEN p_sentiment_score > 0.2 THEN positive_messages + 1 ELSE positive_messages END,
      neutral_messages = CASE WHEN p_sentiment_score BETWEEN -0.2 AND 0.2 THEN neutral_messages + 1 ELSE neutral_messages END,
      negative_messages = CASE WHEN p_sentiment_score < -0.2 THEN negative_messages + 1 ELSE negative_messages END,
      updated_at = NOW()
    WHERE user_id = p_user_id AND date = p_date;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_daily_metrics"("p_user_id" "uuid", "p_date" "date", "p_channel" "text", "p_is_sent" boolean, "p_sentiment_score" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_contact_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  contact_record RECORD;
BEGIN
  -- Update or create contact for sender
  INSERT INTO email_contacts (user_id, email, name, last_email_from_them, email_count_from_them, email_count_total)
  VALUES (NEW.user_id, NEW.from_email, NEW.from_name, NEW.received_at, 1, 1)
  ON CONFLICT (user_id, email)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, email_contacts.name),
    last_email_from_them = GREATEST(EXCLUDED.last_email_from_them, email_contacts.last_email_from_them),
    email_count_from_them = email_contacts.email_count_from_them + 1,
    email_count_total = email_contacts.email_count_total + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_email_contact_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_thread_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update thread stats
  UPDATE email_threads
  SET
    message_count = (SELECT COUNT(*) FROM cached_emails WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id),
    unread_count = (SELECT COUNT(*) FROM cached_emails WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id AND is_read = false),
    last_message_at = (SELECT MAX(received_at) FROM cached_emails WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id),
    updated_at = NOW()
  WHERE id = NEW.thread_id AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_email_thread_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_label_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment message count
    UPDATE custom_labels
    SET message_count = message_count + 1
    WHERE id = NEW.label_id;

    -- Increment unread count if email is unread
    IF EXISTS (
      SELECT 1 FROM cached_emails
      WHERE id = NEW.email_id
        AND is_read = false
    ) THEN
      UPDATE custom_labels
      SET unread_count = unread_count + 1
      WHERE id = NEW.label_id;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement message count
    UPDATE custom_labels
    SET message_count = GREATEST(0, message_count - 1)
    WHERE id = OLD.label_id;

    -- Decrement unread count if email is unread
    IF EXISTS (
      SELECT 1 FROM cached_emails
      WHERE id = OLD.email_id
        AND is_read = false
    ) THEN
      UPDATE custom_labels
      SET unread_count = GREATEST(0, unread_count - 1)
      WHERE id = OLD.label_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_label_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_label_unread_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    -- Email marked as read, decrement unread counts
    UPDATE custom_labels
    SET unread_count = GREATEST(0, unread_count - 1)
    WHERE id IN (
      SELECT label_id FROM email_labels WHERE email_id = NEW.id
    );
  ELSIF OLD.is_read = true AND NEW.is_read = false THEN
    -- Email marked as unread, increment unread counts
    UPDATE custom_labels
    SET unread_count = unread_count + 1
    WHERE id IN (
      SELECT label_id FROM email_labels WHERE email_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_label_unread_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_rules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notification_rules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_outcome_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.outcome_id IS NOT NULL THEN
    UPDATE workspace_outcomes
    SET progress = (
      SELECT COALESCE(
        (COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0))::INTEGER,
        0
      )
      FROM outcome_milestones
      WHERE outcome_id = NEW.outcome_id
    ),
    updated_at = NOW()
    WHERE id = NEW.outcome_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_outcome_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_stats_from_interaction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update the relationship profile with new stats
  UPDATE relationship_profiles
  SET
    last_interaction_at = GREATEST(last_interaction_at, NEW.interaction_date),
    last_email_sent_at = CASE
      WHEN NEW.interaction_type = 'email_sent' THEN GREATEST(last_email_sent_at, NEW.interaction_date)
      ELSE last_email_sent_at
    END,
    last_email_received_at = CASE
      WHEN NEW.interaction_type = 'email_received' THEN GREATEST(last_email_received_at, NEW.interaction_date)
      ELSE last_email_received_at
    END,
    last_meeting_at = CASE
      WHEN NEW.interaction_type IN ('meeting_scheduled', 'meeting_attended') THEN GREATEST(last_meeting_at, NEW.interaction_date)
      ELSE last_meeting_at
    END,
    total_emails_sent = total_emails_sent + CASE WHEN NEW.interaction_type = 'email_sent' THEN 1 ELSE 0 END,
    total_emails_received = total_emails_received + CASE WHEN NEW.interaction_type = 'email_received' THEN 1 ELSE 0 END,
    total_meetings = total_meetings + CASE WHEN NEW.interaction_type IN ('meeting_scheduled', 'meeting_attended') THEN 1 ELSE 0 END,
    first_interaction_at = COALESCE(first_interaction_at, NEW.interaction_date),
    updated_at = NOW()
  WHERE id = NEW.profile_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_profile_stats_from_interaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_saved_search_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_saved_search_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_saved_searches_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_saved_searches_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_search_clipboard_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_search_clipboard_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_search_history_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_search_history_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_team_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_team_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_presence"("p_user_id" "uuid", "p_status" "text" DEFAULT 'online'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        online_status = p_status,
        last_active_at = NOW(),
        last_seen_at = CASE WHEN p_status = 'offline' THEN NOW() ELSE last_seen_at END,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_user_presence"("p_user_id" "uuid", "p_status" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_presence"("p_user_id" "uuid", "p_status" "text") IS 'Updates user online status and activity timestamp';



CREATE OR REPLACE FUNCTION "public"."update_user_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_vacation_responder_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_vacation_responder_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_video_vox_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE video_vox_conversations
  SET
    last_message_id = NEW.id,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_video_vox_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_video_vox_thread_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL THEN
    UPDATE video_vox_messages
    SET thread_count = thread_count + 1
    WHERE id = NEW.reply_to_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_video_vox_thread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_voice_thread_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_voice_thread_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_doc_access"("check_user_id" "uuid", "check_doc_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if user owns the document
  IF EXISTS (
    SELECT 1 FROM knowledge_docs d
    WHERE d.id = check_doc_id AND d.user_id = check_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if document is shared with user (not expired)
  IF EXISTS (
    SELECT 1 FROM document_shares ds
    WHERE ds.doc_id = check_doc_id
    AND ds.shared_with_user = check_user_id
    AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if document's project is shared with user
  IF EXISTS (
    SELECT 1 FROM knowledge_docs d
    JOIN project_shares ps ON ps.project_id = d.project_id
    WHERE d.id = check_doc_id
    AND ps.shared_with_user = check_user_id
    AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."user_has_doc_access"("check_user_id" "uuid", "check_doc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_permission"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_permissions JSONB;
  v_perm TEXT;
  v_resource TEXT;
  v_action TEXT;
BEGIN
  -- Get user's permissions
  v_permissions := get_user_permissions(p_user_id, p_tenant_id);
  
  -- Check for superadmin
  IF v_permissions ? '*' THEN
    RETURN TRUE;
  END IF;
  
  -- Check for exact match
  IF v_permissions ? p_permission THEN
    RETURN TRUE;
  END IF;
  
  -- Check for wildcard match (e.g., "meetings:*" covers "meetings:read")
  v_resource := split_part(p_permission, ':', 1);
  v_action := split_part(p_permission, ':', 2);
  
  IF v_permissions ? (v_resource || ':*') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."user_has_permission"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_api_key"("p_api_key" "text") RETURNS TABLE("is_valid" boolean, "user_id" "uuid", "key_id" "uuid", "scopes" "text"[], "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_key_prefix TEXT;
  v_key_hash TEXT;
  v_api_key api_keys%ROWTYPE;
  v_window_start TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  -- Extract prefix (first 12 chars including "pk_live_" or "pk_test_")
  v_key_prefix := LEFT(p_api_key, 12);

  -- Hash the full key for comparison
  v_key_hash := encode(sha256(p_api_key::bytea), 'hex');

  -- Find the API key
  SELECT * INTO v_api_key
  FROM api_keys
  WHERE key_hash = v_key_hash
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF v_api_key IS NULL THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      NULL::UUID,
      NULL::UUID,
      NULL::TEXT[],
      'Invalid or expired API key'::TEXT;
    RETURN;
  END IF;

  -- Check rate limit (per-minute sliding window)
  v_window_start := date_trunc('minute', NOW());

  SELECT request_count INTO v_request_count
  FROM api_rate_limits
  WHERE api_key_id = v_api_key.id
    AND window_start = v_window_start;

  IF v_request_count IS NOT NULL AND v_request_count >= v_api_key.rate_limit THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      v_api_key.user_id,
      v_api_key.id,
      v_api_key.scopes,
      'Rate limit exceeded. Try again in a minute.'::TEXT;
    RETURN;
  END IF;

  -- Increment rate limit counter
  INSERT INTO api_rate_limits (api_key_id, window_start, request_count)
  VALUES (v_api_key.id, v_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1;

  -- Update last used timestamp
  UPDATE api_keys
  SET last_used_at = NOW(), updated_at = NOW()
  WHERE id = v_api_key.id;

  -- Return success
  RETURN QUERY SELECT
    true::BOOLEAN,
    v_api_key.user_id,
    v_api_key.id,
    v_api_key.scopes,
    NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."validate_api_key"("p_api_key" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."action_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "task_description" "text" NOT NULL,
    "context" "text",
    "assigned_to_email" character varying(255),
    "assigned_to_name" character varying(255),
    "assigned_to_id" "uuid",
    "due_date" "date",
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(20) DEFAULT 'open'::character varying,
    "crm_sync_status" character varying(20) DEFAULT 'pending'::character varying,
    "crm_task_id" character varying(256),
    "last_sync_attempt" timestamp without time zone,
    "last_sync_error" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "completed_at" timestamp without time zone
);


ALTER TABLE "public"."action_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_feed" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "project_id" "uuid",
    "doc_id" "uuid",
    "action" character varying(100) NOT NULL,
    "actor_id" "uuid",
    "details" "jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text",
    "target_id" "uuid",
    "target_name" "text",
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "allow_new_registrations" boolean DEFAULT true,
    "email_notifications" boolean DEFAULT true,
    "maintenance_mode" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_execution_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "agent_type" "text" NOT NULL,
    "trigger_type" "text",
    "input_context" "jsonb",
    "output_suggestion" "jsonb",
    "execution_time_ms" integer,
    "success" boolean DEFAULT true,
    "error_message" "text",
    "confidence" numeric(3,2),
    "feedback_rating" integer,
    "feedback_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_execution_logs_feedback_rating_check" CHECK ((("feedback_rating" >= 1) AND ("feedback_rating" <= 5)))
);


ALTER TABLE "public"."agent_execution_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_execution_logs" IS 'AI agent execution history (Week 7)';



CREATE TABLE IF NOT EXISTS "public"."agent_run_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_run_id" "uuid" NOT NULL,
    "step_index" integer NOT NULL,
    "step_type" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "input" "jsonb",
    "output" "jsonb",
    "error" "text",
    CONSTRAINT "agent_run_steps_valid_status" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."agent_run_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "trigger_event_id" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output" "jsonb",
    "error" "text",
    "attempt" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "agent_runs_non_empty_trigger_event_id" CHECK (("length"(TRIM(BOTH FROM "trigger_event_id")) > 0)),
    CONSTRAINT "agent_runs_valid_status" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."agent_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "enabled" boolean DEFAULT false NOT NULL,
    "trigger_type" "text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "guardrails" "jsonb" DEFAULT '{"dryRunDefault": true, "maxCrmTasksPerRun": 10, "maxTotalActionsPerRun": 25, "maxPulseMessagesPerRun": 3}'::"jsonb" NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agents_actions_is_array" CHECK (("jsonb_typeof"("actions") = 'array'::"text")),
    CONSTRAINT "agents_non_empty_name" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "agents_non_empty_trigger_type" CHECK (("length"(TRIM(BOTH FROM "trigger_type")) > 0))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "team_id" "text" DEFAULT 'default'::"text",
    "name" "text" NOT NULL,
    "description" "text",
    "agent_type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "triggers" "jsonb" DEFAULT '[]'::"jsonb",
    "enabled" boolean DEFAULT true,
    "execution_count" integer DEFAULT 0,
    "success_rate" numeric(5,2) DEFAULT 0,
    "last_executed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_agents" IS 'AI agent configurations (Week 7)';



CREATE TABLE IF NOT EXISTS "public"."ai_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "agent_id" "text",
    "content" "text" NOT NULL,
    "citations" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#ec4899'::"text",
    "icon" "text" DEFAULT 'fa-folder'::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_prompt_suggestions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid",
    "suggestion_text" "text" NOT NULL,
    "context_summary" "text",
    "relevance_score" double precision,
    "is_used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_prompt_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text" DEFAULT 'New Session'::"text" NOT NULL,
    "description" "text",
    "session_type" "text" DEFAULT 'chat'::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_archived" boolean DEFAULT false,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "project_id" "uuid"
);


ALTER TABLE "public"."ai_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_thinking_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_id" "uuid",
    "thinking_steps" "jsonb" NOT NULL,
    "total_thinking_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_thinking_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_contact_engagement" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contact_identifier" "text" NOT NULL,
    "contact_name" "text",
    "engagement_score" numeric(5,2) DEFAULT 0,
    "engagement_trend" "text" DEFAULT 'stable'::"text",
    "last_interaction_at" timestamp with time zone,
    "total_messages_sent" integer DEFAULT 0,
    "total_messages_received" integer DEFAULT 0,
    "avg_response_time_minutes" numeric(10,2),
    "response_rate" numeric(5,2),
    "first_contact_at" timestamp with time zone,
    "days_since_last_contact" integer,
    "communication_frequency" "text",
    "preferred_channel" "text",
    "avg_sentiment" numeric(3,2),
    "sentiment_history" "jsonb" DEFAULT '[]'::"jsonb",
    "common_topics" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_contact_engagement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "messages_sent" integer DEFAULT 0,
    "messages_received" integer DEFAULT 0,
    "emails_sent" integer DEFAULT 0,
    "emails_received" integer DEFAULT 0,
    "sms_sent" integer DEFAULT 0,
    "sms_received" integer DEFAULT 0,
    "slack_sent" integer DEFAULT 0,
    "slack_received" integer DEFAULT 0,
    "avg_response_time_minutes" numeric(10,2),
    "fastest_response_minutes" numeric(10,2),
    "slowest_response_minutes" numeric(10,2),
    "responses_within_1h" integer DEFAULT 0,
    "responses_within_24h" integer DEFAULT 0,
    "responses_after_24h" integer DEFAULT 0,
    "active_conversations" integer DEFAULT 0,
    "new_contacts" integer DEFAULT 0,
    "unique_contacts_reached" integer DEFAULT 0,
    "avg_sentiment_score" numeric(3,2),
    "positive_messages" integer DEFAULT 0,
    "neutral_messages" integer DEFAULT 0,
    "negative_messages" integer DEFAULT 0,
    "peak_hour" integer,
    "messages_by_hour" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voxer_sent" integer DEFAULT 0,
    "voxer_received" integer DEFAULT 0,
    "pulse_sent" integer DEFAULT 0,
    "pulse_received" integer DEFAULT 0
);


ALTER TABLE "public"."analytics_daily_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_period_summary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_type" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "total_messages" integer DEFAULT 0,
    "total_sent" integer DEFAULT 0,
    "total_received" integer DEFAULT 0,
    "channel_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "avg_response_time_minutes" numeric(10,2),
    "response_rate" numeric(5,2),
    "active_contacts" integer DEFAULT 0,
    "new_contacts" integer DEFAULT 0,
    "churned_contacts" integer DEFAULT 0,
    "avg_sentiment" numeric(3,2),
    "sentiment_trend" "text",
    "messages_change_percent" numeric(5,2),
    "response_time_change_percent" numeric(5,2),
    "engagement_change_percent" numeric(5,2),
    "insights" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_period_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_response_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "contact_identifier" "text" NOT NULL,
    "incoming_message_id" "text",
    "incoming_at" timestamp with time zone NOT NULL,
    "response_message_id" "text",
    "response_at" timestamp with time zone,
    "response_time_minutes" numeric(10,2),
    "was_responded" boolean DEFAULT false,
    "thread_id" "text",
    "is_business_hours" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_response_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."annotation_replies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "annotation_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."annotation_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "scopes" "text"[] DEFAULT ARRAY['read'::"text"] NOT NULL,
    "rate_limit" integer DEFAULT 100 NOT NULL,
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key_id" "uuid" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."api_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_request_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "method" "text" NOT NULL,
    "status_code" integer NOT NULL,
    "response_time_ms" integer,
    "ip_address" "inet",
    "user_agent" "text",
    "request_body" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."api_request_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archive_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#ef4444'::"text" NOT NULL,
    "icon" "text" DEFAULT 'fa-folder'::"text" NOT NULL,
    "pinned_at" timestamp with time zone,
    "visibility" "text" DEFAULT 'private'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "archive_collections_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'team'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."archive_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archive_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "archive_id" "uuid" NOT NULL,
    "shared_by" "uuid" NOT NULL,
    "shared_with" "uuid" NOT NULL,
    "permission" "text" DEFAULT 'view'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "archive_shares_permission_check" CHECK (("permission" = ANY (ARRAY['view'::"text", 'edit'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."archive_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archives" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "archive_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "related_contact_id" "text",
    "decision_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "collection_id" "uuid",
    "drive_file_id" "text",
    "drive_folder_id" "text",
    "file_url" "text",
    "file_size" bigint,
    "mime_type" "text",
    "thumbnail_url" "text",
    "ai_tags" "text"[] DEFAULT '{}'::"text"[],
    "related_item_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "sentiment" "text",
    "ai_summary" "text",
    "exported_at" timestamp with time zone,
    "pinned_at" timestamp with time zone,
    "starred" boolean DEFAULT false,
    "view_count" integer DEFAULT 0,
    "last_viewed_at" timestamp with time zone,
    "visibility" "text" DEFAULT 'private'::"text",
    "shared_with" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_by" "uuid",
    "search_vector" "tsvector",
    CONSTRAINT "archives_archive_type_check" CHECK (("archive_type" = ANY (ARRAY['transcript'::"text", 'meeting_note'::"text", 'journal'::"text", 'summary'::"text", 'vox_transcript'::"text", 'decision_log'::"text", 'artifact'::"text", 'research'::"text"]))),
    CONSTRAINT "archives_decision_status_check" CHECK (("decision_status" = ANY (ARRAY['approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "archives_sentiment_check" CHECK (("sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text"]))),
    CONSTRAINT "archives_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'team'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."archives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attention_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "source" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attention_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attention_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "max_daily_notifications" integer DEFAULT 50,
    "batch_interval_minutes" integer DEFAULT 30,
    "focus_hours_start" "text" DEFAULT '09:00'::"text",
    "focus_hours_end" "text" DEFAULT '12:00'::"text",
    "high_priority_bypass" boolean DEFAULT true,
    "weekly_attention_goal" integer DEFAULT 20,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attention_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "automation_id" "uuid",
    "triggered_at" timestamp without time zone NOT NULL,
    "trigger_data" "jsonb",
    "actions_executed" "jsonb",
    "success" boolean,
    "error_message" "text",
    "duration_ms" integer,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."automation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."automation_logs" IS 'Execution history for automations (Week 7)';



CREATE TABLE IF NOT EXISTS "public"."automation_templates" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text",
    "icon" "text",
    "trigger_type" "text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "popular_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."automation_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."automation_templates" IS 'Pre-built automation templates (Week 7)';



CREATE TABLE IF NOT EXISTS "public"."automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "trigger_type" character varying(100) NOT NULL,
    "trigger_config" "jsonb" NOT NULL,
    "actions" "jsonb" NOT NULL,
    "enabled" boolean DEFAULT true,
    "created_by" "uuid",
    "team_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "user_id" "uuid",
    "conditions" "jsonb" DEFAULT '[]'::"jsonb",
    "execution_count" integer DEFAULT 0,
    "last_executed_at" timestamp with time zone
);


ALTER TABLE "public"."automations" OWNER TO "postgres";


COMMENT ON TABLE "public"."automations" IS 'User-created automation workflows (Week 7)';



CREATE TABLE IF NOT EXISTS "public"."blocked_senders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_address" "text",
    "domain" "text",
    "reason" "text",
    "auto_delete" boolean DEFAULT false,
    "blocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocked_senders_email_or_domain" CHECK (((("email_address" IS NOT NULL) AND ("email_address" <> ''::"text")) OR (("domain" IS NOT NULL) AND ("domain" <> ''::"text"))))
);


ALTER TABLE "public"."blocked_senders" OWNER TO "postgres";


COMMENT ON TABLE "public"."blocked_senders" IS 'User-defined blocked email addresses or domains';



COMMENT ON COLUMN "public"."blocked_senders"."auto_delete" IS 'Auto-delete emails from this sender/domain';



CREATE TABLE IF NOT EXISTS "public"."broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "author_id" "uuid",
    "author_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "transcript" "text",
    "listen_count" integer DEFAULT 0,
    "reaction_counts" "jsonb" DEFAULT '{}'::"jsonb",
    "is_live" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "scheduled_for" timestamp with time zone,
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "episode_number" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cached_emails" (
    "id" "text" NOT NULL,
    "thread_id" "text" NOT NULL,
    "user_id" "uuid",
    "gmail_id" "text",
    "from_email" "text" NOT NULL,
    "from_name" "text",
    "to_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "cc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "bcc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "subject" "text",
    "snippet" "text",
    "body_text" "text",
    "body_html" "text",
    "labels" "jsonb" DEFAULT '[]'::"jsonb",
    "is_read" boolean DEFAULT false,
    "is_starred" boolean DEFAULT false,
    "is_important" boolean DEFAULT false,
    "is_draft" boolean DEFAULT false,
    "is_sent" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "is_trashed" boolean DEFAULT false,
    "has_attachments" boolean DEFAULT false,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_summary" "text",
    "ai_category" "text",
    "ai_priority_score" integer DEFAULT 50,
    "ai_action_items" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_sentiment" "text",
    "ai_suggested_replies" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_entities" "jsonb" DEFAULT '{}'::"jsonb",
    "received_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "analyzed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cached_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."cached_emails" IS 'Locally cached emails from Gmail for offline access and AI analysis';



CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "description" "text",
    "location" "text",
    "attendees" "text"[] DEFAULT '{}'::"text"[],
    "calendar_id" "text" DEFAULT 'primary'::"text" NOT NULL,
    "all_day" boolean DEFAULT false NOT NULL,
    "event_type" "text" DEFAULT 'event'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "calendar_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['event'::"text", 'meet'::"text", 'reminder'::"text", 'call'::"text", 'deadline'::"text"])))
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "platform" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "is_member" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "sender_id" "text" NOT NULL,
    "encrypted_content" "text" NOT NULL,
    "nonce" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coaching_keywords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "keyword" "text" NOT NULL,
    "variations" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "prompt_template" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coaching_keywords_non_empty_keyword" CHECK (("length"(TRIM(BOTH FROM "keyword")) > 0)),
    CONSTRAINT "coaching_keywords_non_empty_template" CHECK (("length"(TRIM(BOTH FROM "prompt_template")) > 0)),
    CONSTRAINT "coaching_keywords_valid_category" CHECK (("category" = ANY (ARRAY['objection'::"text", 'competitor'::"text", 'topic'::"text", 'sentiment'::"text", 'question'::"text"]))),
    CONSTRAINT "coaching_keywords_valid_priority" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."coaching_keywords" OWNER TO "postgres";


COMMENT ON TABLE "public"."coaching_keywords" IS 'Configurable keywords that trigger real-time coaching prompts';



COMMENT ON COLUMN "public"."coaching_keywords"."category" IS 'Category: objection, competitor, topic, sentiment, question';



COMMENT ON COLUMN "public"."coaching_keywords"."variations" IS 'Array of alternative phrasings to also match';



COMMENT ON COLUMN "public"."coaching_keywords"."prompt_template" IS 'Template text with {{placeholders}} for dynamic content';



CREATE TABLE IF NOT EXISTS "public"."coaching_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "prompt_type" "text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "trigger_reason" "text",
    "trigger_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "shown_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "snoozed_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coaching_prompts_non_empty_text" CHECK (("length"(TRIM(BOTH FROM "prompt_text")) > 0)),
    CONSTRAINT "coaching_prompts_valid_priority" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "coaching_prompts_valid_type" CHECK (("prompt_type" = ANY (ARRAY['deal_context'::"text", 'objection_price'::"text", 'objection_timeline'::"text", 'objection_budget'::"text", 'objection_authority'::"text", 'objection_competitor'::"text", 'competitor_mentioned'::"text", 'talk_time_warning'::"text", 'key_topic_reminder'::"text", 'question_suggestion'::"text", 'next_steps_reminder'::"text"])))
);


ALTER TABLE "public"."coaching_prompts" OWNER TO "postgres";


COMMENT ON TABLE "public"."coaching_prompts" IS 'Individual coaching prompts shown during real-time sessions';



COMMENT ON COLUMN "public"."coaching_prompts"."prompt_type" IS 'Type of prompt: objection handling, competitor alert, talk time, etc.';



COMMENT ON COLUMN "public"."coaching_prompts"."trigger_reason" IS 'Human-readable reason why this prompt was triggered';



COMMENT ON COLUMN "public"."coaching_prompts"."trigger_context" IS 'JSON context: detected keyword, transcript snippet, etc.';



COMMENT ON COLUMN "public"."coaching_prompts"."snoozed_until" IS 'If user snoozed, when to potentially show similar prompts again';



CREATE TABLE IF NOT EXISTS "public"."coaching_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "deal_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "prompts_shown" integer DEFAULT 0 NOT NULL,
    "prompts_used" integer DEFAULT 0 NOT NULL,
    "prompts_dismissed" integer DEFAULT 0 NOT NULL,
    "talk_time_percentage" double precision,
    "coaching_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coaching_sessions_prompts_non_negative" CHECK ((("prompts_shown" >= 0) AND ("prompts_used" >= 0) AND ("prompts_dismissed" >= 0))),
    CONSTRAINT "coaching_sessions_talk_time_range" CHECK ((("talk_time_percentage" IS NULL) OR (("talk_time_percentage" >= (0)::double precision) AND ("talk_time_percentage" <= (100)::double precision))))
);


ALTER TABLE "public"."coaching_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."coaching_sessions" IS 'Real-time coaching sessions - one per meeting per user';



COMMENT ON COLUMN "public"."coaching_sessions"."prompts_shown" IS 'Total number of coaching prompts displayed to user';



COMMENT ON COLUMN "public"."coaching_sessions"."prompts_used" IS 'Number of prompts marked as helpful by user';



COMMENT ON COLUMN "public"."coaching_sessions"."prompts_dismissed" IS 'Number of prompts dismissed by user';



COMMENT ON COLUMN "public"."coaching_sessions"."talk_time_percentage" IS 'Percentage of meeting time user was speaking (0-100)';



CREATE TABLE IF NOT EXISTS "public"."collection_docs" (
    "collection_id" "uuid" NOT NULL,
    "doc_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."collection_docs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "profile_id" "uuid",
    "interaction_type" "text" NOT NULL,
    "interaction_date" timestamp with time zone NOT NULL,
    "source_type" "text",
    "source_id" "text",
    "thread_id" "text",
    "subject" "text",
    "snippet" "text",
    "body_preview" "text",
    "sentiment" double precision,
    "sentiment_label" "text",
    "participants" "jsonb" DEFAULT '[]'::"jsonb",
    "participant_count" integer DEFAULT 1,
    "has_attachment" boolean DEFAULT false,
    "attachment_count" integer DEFAULT 0,
    "attachment_types" "jsonb" DEFAULT '[]'::"jsonb",
    "meeting_duration_minutes" integer,
    "meeting_type" "text",
    "meeting_outcome" "text",
    "response_time_hours" double precision,
    "is_response" boolean DEFAULT false,
    "responded_to_id" "uuid",
    "ai_topics" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_action_items" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_key_points" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contact_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['email_sent'::"text", 'email_received'::"text", 'meeting_scheduled'::"text", 'meeting_attended'::"text", 'meeting_declined'::"text", 'file_shared'::"text", 'file_received'::"text", 'call_made'::"text", 'call_received'::"text", 'slack_sent'::"text", 'slack_received'::"text", 'sms_sent'::"text", 'sms_received'::"text"]))),
    CONSTRAINT "contact_interactions_meeting_type_check" CHECK (("meeting_type" = ANY (ARRAY['one_on_one'::"text", 'small_group'::"text", 'large_meeting'::"text", 'recurring'::"text", NULL::"text"]))),
    CONSTRAINT "contact_interactions_sentiment_check" CHECK ((("sentiment" >= ('-1'::integer)::double precision) AND ("sentiment" <= (1)::double precision))),
    CONSTRAINT "contact_interactions_sentiment_label_check" CHECK (("sentiment_label" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text", 'urgent'::"text"]))),
    CONSTRAINT "contact_interactions_source_type_check" CHECK (("source_type" = ANY (ARRAY['gmail'::"text", 'calendar'::"text", 'drive'::"text", 'slack'::"text", 'sms'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."contact_interactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."contact_interactions" IS 'Unified log of all interactions across email, calendar, and other channels';



CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" DEFAULT 'Contact'::"text" NOT NULL,
    "company" "text",
    "avatar_color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "status" "text" DEFAULT 'offline'::"text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "notes" "text",
    "case_notes" "text",
    "website" "text",
    "birthday" "text",
    "groups" "text"[] DEFAULT '{}'::"text"[],
    "source" "text" DEFAULT 'local'::"text" NOT NULL,
    "last_synced" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "external_id" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "contacts_source_check" CHECK (("source" = ANY (ARRAY['local'::"text", 'google'::"text", 'vision'::"text"]))),
    CONSTRAINT "contacts_status_check" CHECK (("status" = ANY (ARRAY['online'::"text", 'offline'::"text", 'busy'::"text", 'away'::"text"])))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_graphs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "participants" "uuid"[] DEFAULT '{}'::"uuid"[],
    "related_messages" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_graphs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "health_score" integer DEFAULT 50,
    "avg_response_time_hours" numeric(8,2),
    "response_trend" "text",
    "engagement_level" "text",
    "participation_rate" numeric(5,2),
    "overall_sentiment" "text",
    "sentiment_trend" "text",
    "tasks_created" integer DEFAULT 0,
    "decisions_count" integer DEFAULT 0,
    "action_items_created" integer DEFAULT 0,
    "communication_style" "text",
    "last_calculated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_health" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_health" IS 'Health metrics for conversations including response times and engagement';



CREATE TABLE IF NOT EXISTS "public"."conversation_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "common_topics" "text"[] DEFAULT ARRAY[]::"text"[],
    "usual_participants" "text"[] DEFAULT ARRAY[]::"text"[],
    "typical_deadlines" "text"[] DEFAULT ARRAY[]::"text"[],
    "frequent_links" "text"[] DEFAULT ARRAY[]::"text"[],
    "milestones" "jsonb" DEFAULT '[]'::"jsonb",
    "dna_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_memory" IS 'Long-term memory and patterns detected in conversations';



CREATE TABLE IF NOT EXISTS "public"."conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "citations" "jsonb",
    "confidence" numeric(3,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_messages" IS 'Individual messages in Ask AI conversations (Week 6)';



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "last_message_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'Ask AI conversation threads (Week 6)';



CREATE TABLE IF NOT EXISTS "public"."crm_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" "text" NOT NULL,
    "template_name" "text",
    "crm_id" "uuid",
    "target_external_id" "text",
    "action_payload" "jsonb" NOT NULL,
    "triggered_by_user_id" "uuid",
    "triggered_in_chat_id" "text",
    "triggered_by_message_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "executed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crm_id" "uuid",
    "external_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "name" "text" NOT NULL,
    "website" "text",
    "industry" "text",
    "employee_count" integer,
    "annual_revenue" bigint,
    "owner_id" "text",
    "owner_name" "text",
    "contact_ids" "text"[] DEFAULT ARRAY[]::"text"[],
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "last_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crm_id" "uuid",
    "external_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "company_name" "text",
    "company_id" "text",
    "title" "text",
    "lifecycle_stage" "text",
    "owner_id" "text",
    "owner_name" "text",
    "pulse_user_id" "uuid",
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "last_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_deals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crm_id" "uuid",
    "external_id" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "name" "text" NOT NULL,
    "deal_stage" "text" NOT NULL,
    "deal_amount" numeric(15,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "close_date" "date",
    "created_date" "date",
    "contact_ids" "text"[] DEFAULT ARRAY[]::"text"[],
    "company_id" "text",
    "company_name" "text",
    "owner_id" "text",
    "owner_name" "text",
    "probability" numeric(5,2),
    "is_closed" boolean DEFAULT false,
    "is_won" boolean DEFAULT false,
    "linked_chat_id" "uuid",
    "linked_channel_id" "text",
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "last_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_deals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "workspace_id" "uuid",
    "is_active" boolean DEFAULT true,
    "sync_enabled" boolean DEFAULT true,
    "webhook_url" "text",
    "webhook_secret" "text",
    "last_sync_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'idle'::"text",
    "sync_error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_sidepanels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "text" NOT NULL,
    "user_id" "uuid",
    "crm_id" "uuid",
    "linked_record_type" "text" NOT NULL,
    "linked_external_id" "text" NOT NULL,
    "is_open" boolean DEFAULT true,
    "panel_position" "text" DEFAULT 'right'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_sidepanels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "crm_system" "text" DEFAULT 'logos_vision'::"text" NOT NULL,
    "crm_entity_id" "text",
    "sync_direction" "text" DEFAULT 'outbound'::"text" NOT NULL,
    "sync_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "fields_synced" "jsonb" DEFAULT '[]'::"jsonb",
    "data_snapshot" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "triggered_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "sync_key" "text"
);


ALTER TABLE "public"."crm_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crm_id" "uuid",
    "sync_type" "text" NOT NULL,
    "contacts_synced" integer DEFAULT 0,
    "companies_synced" integer DEFAULT 0,
    "deals_synced" integer DEFAULT 0,
    "status" "text" NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "duration_seconds" integer
);


ALTER TABLE "public"."crm_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#6b7280'::"text" NOT NULL,
    "parent_label_id" "uuid",
    "gmail_label_id" "text",
    "is_system" boolean DEFAULT false,
    "message_count" integer DEFAULT 0,
    "unread_count" integer DEFAULT 0,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "color_hex_format" CHECK (("color" ~* '^#[0-9a-f]{6}$'::"text"))
);


ALTER TABLE "public"."custom_labels" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_labels" IS 'User-created labels for organizing emails';



COMMENT ON COLUMN "public"."custom_labels"."parent_label_id" IS 'Parent label for nested label structure';



COMMENT ON COLUMN "public"."custom_labels"."gmail_label_id" IS 'Gmail label ID for bi-directional sync';



COMMENT ON COLUMN "public"."custom_labels"."is_system" IS 'System labels cannot be modified or deleted';



COMMENT ON COLUMN "public"."custom_labels"."message_count" IS 'Total number of emails with this label';



COMMENT ON COLUMN "public"."custom_labels"."unread_count" IS 'Number of unread emails with this label';



COMMENT ON COLUMN "public"."custom_labels"."display_order" IS 'Order for displaying labels in UI';



CREATE TABLE IF NOT EXISTS "public"."customer_health_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "text" NOT NULL,
    "health_score" integer NOT NULL,
    "health_label" "text" NOT NULL,
    "factors" "jsonb" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_health_history_score_range" CHECK ((("health_score" >= 0) AND ("health_score" <= 100))),
    CONSTRAINT "customer_health_history_valid_label" CHECK (("health_label" = ANY (ARRAY['healthy'::"text", 'needs_attention'::"text", 'at_risk'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."customer_health_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_health_history" IS 'Historical snapshots of customer health for trend analysis';



COMMENT ON COLUMN "public"."customer_health_history"."factors" IS 'JSON snapshot of all factor scores at time of recording';



CREATE TABLE IF NOT EXISTS "public"."customer_sentiment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "sentiment_score" double precision NOT NULL,
    "sentiment_label" "text" NOT NULL,
    "confidence" double precision DEFAULT 1.0 NOT NULL,
    "key_phrases" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "emotional_signals" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "analyzed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_sentiment_confidence_range" CHECK ((("confidence" >= (0.0)::double precision) AND ("confidence" <= (1.0)::double precision))),
    CONSTRAINT "customer_sentiment_non_empty_customer" CHECK (("length"(TRIM(BOTH FROM "customer_id")) > 0)),
    CONSTRAINT "customer_sentiment_score_range" CHECK ((("sentiment_score" >= ('-1.0'::numeric)::double precision) AND ("sentiment_score" <= (1.0)::double precision))),
    CONSTRAINT "customer_sentiment_valid_label" CHECK (("sentiment_label" = ANY (ARRAY['very_negative'::"text", 'negative'::"text", 'neutral'::"text", 'positive'::"text", 'very_positive'::"text"]))),
    CONSTRAINT "customer_sentiment_valid_source_type" CHECK (("source_type" = ANY (ARRAY['meeting'::"text", 'pulse_message'::"text", 'email'::"text", 'support_ticket'::"text", 'crm_activity'::"text", 'call'::"text"])))
);


ALTER TABLE "public"."customer_sentiment" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_sentiment" IS 'Individual sentiment measurements from meetings, messages, emails, etc.';



COMMENT ON COLUMN "public"."customer_sentiment"."sentiment_score" IS 'Score from -1.0 (very negative) to 1.0 (very positive)';



COMMENT ON COLUMN "public"."customer_sentiment"."sentiment_label" IS 'Human-readable label: very_negative, negative, neutral, positive, very_positive';



COMMENT ON COLUMN "public"."customer_sentiment"."key_phrases" IS 'JSON array of phrases that indicate sentiment';



COMMENT ON COLUMN "public"."customer_sentiment"."emotional_signals" IS 'JSON object with frustration, satisfaction, urgency, enthusiasm scores (0-100)';



CREATE TABLE IF NOT EXISTS "public"."decision_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "decision_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "choice" "text" NOT NULL,
    "comment" "text",
    "voted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."decision_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "workspace_id" "uuid",
    "created_by" "text" NOT NULL,
    "proposal_text" "text" NOT NULL,
    "decision_type" "text" DEFAULT 'proposal'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "threshold" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_annotations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doc_id" "uuid",
    "user_id" "uuid",
    "position" "jsonb" NOT NULL,
    "content" "text" NOT NULL,
    "type" character varying(20) DEFAULT 'note'::character varying,
    "resolved" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_embeddings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doc_id" "uuid",
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(768),
    "chunk_index" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."doc_embeddings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_favorites" (
    "user_id" "uuid" NOT NULL,
    "doc_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_highlights" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doc_id" "uuid",
    "user_id" "uuid",
    "start_offset" integer NOT NULL,
    "end_offset" integer NOT NULL,
    "highlighted_text" "text" NOT NULL,
    "color" character varying(20) DEFAULT 'yellow'::character varying,
    "note" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_highlights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_recent_views" (
    "user_id" "uuid" NOT NULL,
    "doc_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "view_count" integer DEFAULT 1
);


ALTER TABLE "public"."doc_recent_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_tags" (
    "doc_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_collections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "name" character varying(200) NOT NULL,
    "description" "text",
    "type" character varying(20) DEFAULT 'manual'::character varying,
    "icon" character varying(50) DEFAULT 'fa-folder'::character varying,
    "color" character varying(7) DEFAULT '#3b82f6'::character varying,
    "rules" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_shares" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doc_id" "uuid",
    "shared_by" "uuid",
    "shared_with_user" "uuid",
    "shared_with_email" character varying(255),
    "permissions" "jsonb" DEFAULT '{"canEdit": false, "canView": true, "canShare": false, "canComment": false}'::"jsonb",
    "public_link" character varying(64),
    "expires_at" timestamp with time zone,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_share_target" CHECK ((("shared_with_user" IS NOT NULL) OR ("shared_with_email" IS NOT NULL) OR ("public_link" IS NOT NULL)))
);


ALTER TABLE "public"."document_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_tags" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "name" character varying(100) NOT NULL,
    "color" character varying(7) DEFAULT '#f43f5e'::character varying,
    "icon" character varying(50) DEFAULT 'fa-tag'::character varying,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."duplicate_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "group_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "match_confidence" double precision,
    "match_reasons" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_at" timestamp with time zone,
    "merged_into_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "duplicate_contacts_match_confidence_check" CHECK ((("match_confidence" >= (0)::double precision) AND ("match_confidence" <= (1)::double precision))),
    CONSTRAINT "duplicate_contacts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'rejected'::"text", 'merged'::"text"])))
);


ALTER TABLE "public"."duplicate_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."duplicate_contacts" IS 'Potential duplicate contacts for merging';



CREATE TABLE IF NOT EXISTS "public"."email_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "company" "text",
    "title" "text",
    "avatar_url" "text",
    "phone" "text",
    "first_contacted_at" timestamp with time zone,
    "last_contacted_at" timestamp with time zone,
    "last_email_from_them" timestamp with time zone,
    "last_email_to_them" timestamp with time zone,
    "email_count_total" integer DEFAULT 0,
    "email_count_from_them" integer DEFAULT 0,
    "email_count_to_them" integer DEFAULT 0,
    "avg_response_time_hours" double precision,
    "response_rate" double precision,
    "relationship_strength" integer DEFAULT 50,
    "ai_notes" "text",
    "ai_relationship_type" "text",
    "ai_communication_style" "text",
    "custom_notes" "text",
    "is_important" boolean DEFAULT false,
    "is_blocked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_contacts" IS 'Contact intelligence and relationship tracking for email correspondents';



CREATE TABLE IF NOT EXISTS "public"."email_daily_briefings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "briefing_date" "date" NOT NULL,
    "new_email_count" integer DEFAULT 0,
    "urgent_count" integer DEFAULT 0,
    "meeting_requests_count" integer DEFAULT 0,
    "follow_ups_needed_count" integer DEFAULT 0,
    "priority_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_summary" "text",
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_daily_briefings" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_daily_briefings" IS 'Pre-computed daily email briefings and summaries';



CREATE TABLE IF NOT EXISTS "public"."email_follow_ups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email_id" "text",
    "thread_id" "text",
    "follow_up_reason" "text",
    "suggested_follow_up_date" timestamp with time zone,
    "ai_follow_up_draft" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "completed_at" timestamp with time zone,
    "days_waiting" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_follow_ups" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_follow_ups" IS 'Emails flagged for follow-up with AI-generated suggestions';



CREATE TABLE IF NOT EXISTS "public"."email_labels" (
    "email_id" "text" NOT NULL,
    "label_id" "uuid" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_labels" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_labels" IS 'Junction table linking emails to labels';



CREATE TABLE IF NOT EXISTS "public"."email_sync_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "history_id" "text",
    "last_full_sync_at" timestamp with time zone,
    "last_incremental_sync_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'idle'::"text",
    "last_error" "text",
    "error_count" integer DEFAULT 0,
    "total_emails_cached" integer DEFAULT 0,
    "total_threads_cached" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_sync_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_sync_state" IS 'Tracks Gmail sync state for incremental updates';



CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "subject" "text",
    "body" "text",
    "body_html" "text",
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "category" "text",
    "is_favorite" boolean DEFAULT false,
    "use_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_templates" IS 'User-created email templates with variable substitution';



CREATE TABLE IF NOT EXISTS "public"."email_threads" (
    "id" "text" NOT NULL,
    "user_id" "uuid",
    "subject" "text",
    "participant_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "participant_names" "jsonb" DEFAULT '[]'::"jsonb",
    "message_count" integer DEFAULT 0,
    "unread_count" integer DEFAULT 0,
    "last_message_at" timestamp with time zone,
    "first_message_at" timestamp with time zone,
    "ai_thread_summary" "text",
    "ai_thread_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_threads" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_threads" IS 'Email conversation threads grouping related messages';



CREATE TABLE IF NOT EXISTS "public"."emails" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "from_address" "text" NOT NULL,
    "to_addresses" "text"[] DEFAULT '{}'::"text"[],
    "cc_addresses" "text"[] DEFAULT '{}'::"text"[],
    "subject" "text" NOT NULL,
    "snippet" "text",
    "body" "text",
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "provider" "text" DEFAULT 'google'::"text" NOT NULL,
    "folder" "text" DEFAULT 'inbox'::"text" NOT NULL,
    "labels" "text"[] DEFAULT '{}'::"text"[],
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "external_id" "text",
    "thread_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "emails_folder_check" CHECK (("folder" = ANY (ARRAY['inbox'::"text", 'sent'::"text", 'spam'::"text", 'drafts'::"text", 'trash'::"text", 'archive'::"text"]))),
    CONSTRAINT "emails_provider_check" CHECK (("provider" = ANY (ARRAY['google'::"text", 'microsoft'::"text", 'icloud'::"text"])))
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "text_content" "text",
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."embeddings" OWNER TO "postgres";


COMMENT ON TABLE "public"."embeddings" IS 'Stores vector embeddings for semantic search (Week 6)';



CREATE TABLE IF NOT EXISTS "public"."entomate_action_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "meeting_id" "uuid",
    "task_description" "text" NOT NULL,
    "assigned_to_user_id" "uuid",
    "assigned_to_name" character varying(255),
    "assigned_to_email" character varying(255),
    "due_date" "date",
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(20) DEFAULT 'open'::character varying,
    "crm_sync_status" character varying(20) DEFAULT 'pending'::character varying,
    "crm_task_id" character varying(256),
    "pulse_task_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."entomate_action_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entomate_automation_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "automation_id" "uuid",
    "status" character varying(20) NOT NULL,
    "trigger_data" "jsonb",
    "result" "jsonb",
    "error_message" "text",
    "duration_ms" integer,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."entomate_automation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entomate_automations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "trigger_type" character varying(50) NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "last_run_at" timestamp without time zone,
    "run_count" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."entomate_automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entomate_meetings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "transcript" "text",
    "summary" "text",
    "key_points" "jsonb" DEFAULT '[]'::"jsonb",
    "decisions" "jsonb" DEFAULT '[]'::"jsonb",
    "sentiment_score" double precision,
    "sentiment_label" character varying(20),
    "audio_file_url" character varying(512),
    "start_time" timestamp without time zone,
    "end_time" timestamp without time zone,
    "duration_minutes" integer,
    "attendees" "jsonb" DEFAULT '[]'::"jsonb",
    "pulse_channel_id" "uuid",
    "crm_deal_id" character varying(256),
    "created_by" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."entomate_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entomate_project_tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "status" character varying(20) DEFAULT 'todo'::character varying,
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "due_date" "date",
    "meeting_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."entomate_project_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entomate_projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(20) DEFAULT 'active'::character varying,
    "logos_project_id" "text",
    "crm_deal_id" character varying(256),
    "deal_value" numeric(12,2),
    "start_date" "date",
    "end_date" "date",
    "owner_id" "uuid",
    "team_ids" "uuid"[],
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."entomate_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ephemeral_workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "duration_minutes" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "outcome_title" "text",
    "outcome_description" "text",
    "outcome_status" "text" DEFAULT 'not_started'::"text",
    "outcome_progress" integer DEFAULT 0,
    "outcome_target_date" timestamp with time zone,
    CONSTRAINT "ephemeral_workspaces_outcome_progress_check" CHECK ((("outcome_progress" >= 0) AND ("outcome_progress" <= 100))),
    CONSTRAINT "ephemeral_workspaces_outcome_status_check" CHECK (("outcome_status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'blocked'::"text", 'achieved'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."ephemeral_workspaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."extracted_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "origin_message_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "assignee_id" "text",
    "deadline" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text",
    "extracted_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."extracted_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."focus_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "planned_duration_minutes" integer DEFAULT 25 NOT NULL,
    "actual_duration_minutes" integer,
    "interruption_count" integer DEFAULT 0,
    "topic" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."focus_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(500) NOT NULL,
    "description" "text",
    "goal_type" character varying(20) NOT NULL,
    "parent_goal_id" "uuid",
    "owner_id" "uuid",
    "team_id" "uuid",
    "quarter" character varying(20),
    "start_date" "date",
    "target_date" "date",
    "status" character varying(20) DEFAULT 'planning'::character varying,
    "progress" numeric(5,2) DEFAULT 0,
    "key_results" "jsonb" DEFAULT '[]'::"jsonb",
    "related_tasks" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "goals_goal_type_check" CHECK ((("goal_type")::"text" = ANY ((ARRAY['company'::character varying, 'team'::character varying, 'individual'::character varying])::"text"[]))),
    CONSTRAINT "goals_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['planning'::character varying, 'active'::character varying, 'completed'::character varying, 'abandoned'::character varying])::"text"[])))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."in_app_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "cta_text" "text",
    "cta_url" "text",
    "event_trigger" "text" NOT NULL,
    "segment" "text" DEFAULT 'all'::"text" NOT NULL,
    "custom_segment_query" "jsonb",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "display_duration_seconds" integer DEFAULT 8,
    "position" "text" DEFAULT 'bottom-right'::"text",
    "style_type" "text" DEFAULT 'info'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."in_app_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_field_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "external_field" "text" NOT NULL,
    "internal_field" "text" NOT NULL,
    "transform" "text",
    "direction" "text" DEFAULT 'bidirectional'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "field_mappings_valid_direction" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'bidirectional'::"text"]))),
    CONSTRAINT "field_mappings_valid_entity" CHECK (("entity_type" = ANY (ARRAY['deal'::"text", 'contact'::"text", 'account'::"text", 'meeting'::"text", 'task'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."integration_field_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."integration_field_mappings" IS 'Field mappings between external systems and Entomate';



CREATE TABLE IF NOT EXISTS "public"."integration_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" character varying(50),
    "source_id" "uuid",
    "destination_type" character varying(50),
    "destination_id" character varying(256),
    "status" character varying(20),
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "next_retry_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_type" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_error" "text",
    "error_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "integrations_valid_type" CHECK (("integration_type" = ANY (ARRAY['salesforce'::"text", 'hubspot'::"text", 'pipedrive'::"text", 'zoho_crm'::"text", 'zoom'::"text", 'teams'::"text", 'google_meet'::"text", 'webex'::"text", 'google_calendar'::"text", 'outlook_calendar'::"text", 'slack'::"text", 'gmail'::"text", 'outlook_mail'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."integrations" IS 'Third-party integration configurations';



CREATE TABLE IF NOT EXISTS "public"."key_results" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "outcome_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "current_value" numeric DEFAULT 0 NOT NULL,
    "target_value" numeric NOT NULL,
    "unit" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."key_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_docs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "original_name" "text",
    "file_type" "text",
    "url" "text",
    "summary" "text",
    "text_content" "text",
    "is_processed" boolean DEFAULT false,
    "is_shared" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ai_summary" "text",
    "ai_keywords" "text"[],
    "processing_status" "text" DEFAULT 'pending'::"text"
);


ALTER TABLE "public"."knowledge_docs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "profile_id" "uuid",
    "lead_score" integer DEFAULT 0,
    "lead_grade" "text",
    "lead_status" "text" DEFAULT 'unknown'::"text",
    "engagement_score" integer DEFAULT 0,
    "recency_score" integer DEFAULT 0,
    "frequency_score" integer DEFAULT 0,
    "behavior_score" integer DEFAULT 0,
    "sentiment_score" integer DEFAULT 0,
    "score_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "buying_signals" "jsonb" DEFAULT '[]'::"jsonb",
    "buying_signal_count" integer DEFAULT 0,
    "last_buying_signal_at" timestamp with time zone,
    "pipeline_stage" "text",
    "pipeline_stage_changed_at" timestamp with time zone,
    "estimated_value" numeric(12,2),
    "probability" integer,
    "expected_close_date" "date",
    "ai_conversion_probability" double precision,
    "ai_churn_risk" double precision,
    "ai_next_action_prediction" "text",
    "ai_best_contact_time" "text",
    "ai_predicted_value" numeric(12,2),
    "score_history" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_scored_at" timestamp with time zone,
    CONSTRAINT "lead_scores_ai_churn_risk_check" CHECK ((("ai_churn_risk" >= (0)::double precision) AND ("ai_churn_risk" <= (1)::double precision))),
    CONSTRAINT "lead_scores_ai_conversion_probability_check" CHECK ((("ai_conversion_probability" >= (0)::double precision) AND ("ai_conversion_probability" <= (1)::double precision))),
    CONSTRAINT "lead_scores_lead_grade_check" CHECK (("lead_grade" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text", 'F'::"text"]))),
    CONSTRAINT "lead_scores_lead_score_check" CHECK ((("lead_score" >= 0) AND ("lead_score" <= 100))),
    CONSTRAINT "lead_scores_lead_status_check" CHECK (("lead_status" = ANY (ARRAY['cold'::"text", 'warming'::"text", 'warm'::"text", 'hot'::"text", 'customer'::"text", 'churned'::"text", 'unknown'::"text"]))),
    CONSTRAINT "lead_scores_probability_check" CHECK ((("probability" >= 0) AND ("probability" <= 100)))
);


ALTER TABLE "public"."lead_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_scores" IS 'Lead scoring and pipeline intelligence';



CREATE TABLE IF NOT EXISTS "public"."logos_cases" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "project_id" "text",
    "contact_id" "text",
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "due_date" timestamp with time zone,
    "created_by" "text",
    "custom_fields" "jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "external_id" "text"
);


ALTER TABLE "public"."logos_cases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logos_contacts" (
    "id" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "company" "text",
    "title" "text",
    "status" "text" DEFAULT 'active'::"text",
    "custom_fields" "jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "external_id" "text"
);


ALTER TABLE "public"."logos_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logos_notes" (
    "id" "text" NOT NULL,
    "content" "text" NOT NULL,
    "case_id" "text",
    "project_id" "text",
    "contact_id" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "attachments" "jsonb"
);


ALTER TABLE "public"."logos_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logos_projects" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "client_id" "text",
    "client_name" "text",
    "owner_id" "text",
    "owner_name" "text",
    "start_date" timestamp with time zone,
    "due_date" timestamp with time zone,
    "budget" numeric,
    "custom_fields" "jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "external_id" "text"
);


ALTER TABLE "public"."logos_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logos_pulse_activity" (
    "id" "text" NOT NULL,
    "logos_entity_type" "text",
    "logos_entity_id" "text",
    "pulse_channel_id" "text",
    "pulse_user_id" "uuid",
    "activity_type" "text",
    "description" "text",
    "performed_by" "text",
    "performed_at" timestamp with time zone DEFAULT "now"(),
    "pulse_message_id" "text",
    "logos_note_id" "text"
);


ALTER TABLE "public"."logos_pulse_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logos_pulse_mappings" (
    "id" "text" NOT NULL,
    "logos_entity_type" "text" NOT NULL,
    "logos_entity_id" "text" NOT NULL,
    "pulse_entity_type" "text" NOT NULL,
    "pulse_entity_id" "text" NOT NULL,
    "sync_direction" "text" DEFAULT 'logos_to_pulse'::"text",
    "last_sync_at" timestamp with time zone DEFAULT "now"(),
    "sync_status" "text" DEFAULT 'synced'::"text",
    "sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logos_pulse_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logos_sync_logs" (
    "id" "text" NOT NULL,
    "sync_type" "text" NOT NULL,
    "entity_type" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "records_synced" integer DEFAULT 0,
    "records_failed" integer DEFAULT 0,
    "status" "text" NOT NULL,
    "error_message" "text",
    "details" "jsonb"
);


ALTER TABLE "public"."logos_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logos_tasks" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "project_id" "text",
    "case_id" "text",
    "assigned_to" "text",
    "assigned_to_email" "text",
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logos_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_prep_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "calendar_event_id" "text" NOT NULL,
    "event_title" "text",
    "event_description" "text",
    "event_start" timestamp with time zone NOT NULL,
    "event_end" timestamp with time zone,
    "event_location" "text",
    "event_type" "text",
    "attendee_profiles" "jsonb" DEFAULT '[]'::"jsonb",
    "attendee_count" integer DEFAULT 0,
    "known_attendees" integer DEFAULT 0,
    "ai_summary" "text",
    "ai_meeting_purpose" "text",
    "ai_talking_points" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_questions_to_ask" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_topics_to_avoid" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_relationship_notes" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_recent_context" "text",
    "ai_follow_up_items" "jsonb" DEFAULT '[]'::"jsonb",
    "recent_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "recent_meetings" "jsonb" DEFAULT '[]'::"jsonb",
    "shared_files" "jsonb" DEFAULT '[]'::"jsonb",
    "open_action_items" "jsonb" DEFAULT '[]'::"jsonb",
    "user_notes" "text",
    "user_objectives" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'generated'::"text",
    "viewed_at" timestamp with time zone,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "meeting_prep_cards_event_type_check" CHECK (("event_type" = ANY (ARRAY['one_on_one'::"text", 'small_group'::"text", 'large_meeting'::"text", 'recurring'::"text", 'external'::"text"]))),
    CONSTRAINT "meeting_prep_cards_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'generated'::"text", 'viewed'::"text", 'used'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."meeting_prep_cards" OWNER TO "postgres";


COMMENT ON TABLE "public"."meeting_prep_cards" IS 'Pre-meeting context and preparation cards';



CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "transcript" "text",
    "summary" "text",
    "audio_file_url" character varying(512),
    "sentiment_label" character varying(20),
    "sentiment_score" double precision,
    "key_points" "jsonb" DEFAULT '[]'::"jsonb",
    "decisions" "jsonb" DEFAULT '[]'::"jsonb",
    "start_time" timestamp without time zone,
    "end_time" timestamp without time zone,
    "duration_minutes" integer,
    "attendees" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "uuid",
    "project_id" "uuid",
    "crm_deal_id" character varying(256),
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "topics" "jsonb" DEFAULT '[]'::"jsonb",
    "transcript_embedding" "public"."vector"(768)
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT true,
    "is_group" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_impact" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "impact_score" numeric(4,2) DEFAULT 0,
    "immediate_readers" integer DEFAULT 0,
    "total_readers" integer DEFAULT 0,
    "decisions_generated" integer DEFAULT 0,
    "actions_generated" integer DEFAULT 0,
    "referenced_count" integer DEFAULT 0,
    "cross_channel_mentions" integer DEFAULT 0,
    "engagement_rate" numeric(5,2) DEFAULT 0,
    "calculated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_impact" OWNER TO "postgres";


COMMENT ON TABLE "public"."message_impact" IS 'Analytics data tracking the impact and reach of individual messages';



CREATE TABLE IF NOT EXISTS "public"."message_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "shown_at" timestamp with time zone DEFAULT "now"(),
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "triggered_by" "text",
    "user_segment" "text",
    "session_id" "text",
    "page_url" "text",
    "device_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_sync_state" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "platform" "text" NOT NULL,
    "channel_external_id" "text",
    "last_sync_at" timestamp with time zone,
    "last_message_timestamp" timestamp with time zone,
    "sync_cursor" "text",
    "sync_status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_sync_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "original_language" "text" NOT NULL,
    "target_language" "text" NOT NULL,
    "translated_text" "text" NOT NULL,
    "confidence" numeric(3,2) DEFAULT 0.95,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_translations" OWNER TO "postgres";


COMMENT ON TABLE "public"."message_translations" IS 'Cached translations of messages for multi-language support';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "text" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "attachment_type" "text",
    "attachment_name" "text",
    "attachment_url" "text",
    "attachment_size" "text",
    "attachment_duration" integer,
    "reply_to_id" "uuid",
    "reactions" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text",
    "decision_data" "jsonb",
    "related_task_id" "uuid",
    "voice_analysis" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_attachment_type_check" CHECK (("attachment_type" = ANY (ARRAY['image'::"text", 'file'::"text", 'audio'::"text"]))),
    CONSTRAINT "messages_sender_check" CHECK (("sender" = ANY (ARRAY['me'::"text", 'other'::"text"]))),
    CONSTRAINT "messages_source_check" CHECK (("source" = ANY (ARRAY['pulse'::"text", 'slack'::"text", 'email'::"text", 'sms'::"text"]))),
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'read'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "conditions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notify_desktop" boolean DEFAULT true,
    "notify_mobile" boolean DEFAULT true,
    "notify_email" boolean DEFAULT false,
    "notify_sound" "text",
    "respect_quiet_hours" boolean DEFAULT false,
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_rules_conditions_array" CHECK (("jsonb_typeof"("conditions") = 'array'::"text")),
    CONSTRAINT "notification_rules_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "notification_rules_quiet_hours_valid" CHECK ((("respect_quiet_hours" = false) OR (("quiet_hours_start" IS NOT NULL) AND ("quiet_hours_end" IS NOT NULL))))
);


ALTER TABLE "public"."notification_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_rules" IS 'User-defined notification rules for email events';



COMMENT ON COLUMN "public"."notification_rules"."conditions" IS 'Array of conditions for when to notify';



COMMENT ON COLUMN "public"."notification_rules"."notify_sound" IS 'Custom notification sound identifier';



COMMENT ON COLUMN "public"."notification_rules"."respect_quiet_hours" IS 'Whether to suppress notifications during quiet hours';



CREATE TABLE IF NOT EXISTS "public"."outcome_blockers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "outcome_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "reported_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."outcome_blockers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outcome_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "outcome_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" timestamp with time zone,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outcome_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outcomes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "workspace_id" "text",
    "thread_id" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "target_date" timestamp with time zone,
    "blockers" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "outcomes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'achieved'::"text", 'blocked'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prediction_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "predicted_value" "jsonb" NOT NULL,
    "explanation" "text" NOT NULL,
    "model_version" "text" DEFAULT 'baseline_v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "predictions_entity_id_has_colon" CHECK ((POSITION((':'::"text") IN ("entity_id")) > 1)),
    CONSTRAINT "predictions_non_empty_entity_id" CHECK (("length"(TRIM(BOTH FROM "entity_id")) > 0)),
    CONSTRAINT "predictions_non_empty_entity_type" CHECK (("length"(TRIM(BOTH FROM "entity_type")) > 0)),
    CONSTRAINT "predictions_non_empty_explanation" CHECK (("length"(TRIM(BOTH FROM "explanation")) > 0)),
    CONSTRAINT "predictions_non_empty_prediction_type" CHECK (("length"(TRIM(BOTH FROM "prediction_type")) > 0)),
    CONSTRAINT "predictions_valid_entity_type" CHECK (("entity_type" = ANY (ARRAY['deal'::"text", 'task'::"text"]))),
    CONSTRAINT "predictions_valid_prediction_type" CHECK (("prediction_type" = ANY (ARRAY['deal_close_probability'::"text", 'task_eta'::"text"]))),
    CONSTRAINT "predictions_valid_type" CHECK (("prediction_type" = ANY (ARRAY['deal_close_probability'::"text", 'task_eta'::"text"])))
);


ALTER TABLE "public"."predictions" OWNER TO "postgres";


COMMENT ON TABLE "public"."predictions" IS 'Stores predictive analytics results for deals and tasks';



COMMENT ON COLUMN "public"."predictions"."prediction_type" IS 'Type: deal_close_probability or task_eta';



COMMENT ON COLUMN "public"."predictions"."entity_type" IS 'Entity being predicted: deal or task';



COMMENT ON COLUMN "public"."predictions"."entity_id" IS 'Prefixed entity ID: deal:123, task:abc-456';



COMMENT ON COLUMN "public"."predictions"."predicted_value" IS 'JSON with probability, dates, confidence, etc.';



COMMENT ON COLUMN "public"."predictions"."explanation" IS 'Human-readable explanation of prediction factors';



COMMENT ON COLUMN "public"."predictions"."model_version" IS 'Model version for tracking (e.g., baseline_v1)';



CREATE TABLE IF NOT EXISTS "public"."project_docs" (
    "project_id" "uuid" NOT NULL,
    "doc_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_docs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_shares" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "shared_by" "uuid",
    "shared_with_user" "uuid",
    "shared_with_email" character varying(255),
    "permissions" "jsonb" DEFAULT '{"canEdit": false, "canView": true, "canShare": false, "canAddDocs": false, "canComment": false}'::"jsonb",
    "public_link" character varying(64),
    "expires_at" timestamp with time zone,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_project_share_target" CHECK ((("shared_with_user" IS NOT NULL) OR ("shared_with_email" IS NOT NULL) OR ("public_link" IS NOT NULL)))
);


ALTER TABLE "public"."project_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'onboarding'::"text",
    "tasks" "jsonb" DEFAULT '[]'::"jsonb",
    "milestones" "jsonb" DEFAULT '[]'::"jsonb",
    "default_duration_days" integer DEFAULT 30,
    "default_assignee_roles" "jsonb" DEFAULT '{}'::"jsonb",
    "times_used" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(20) DEFAULT 'planning'::character varying,
    "crm_deal_id" character varying(256),
    "deal_value" numeric(12,2),
    "start_date" "date",
    "end_date" "date",
    "owner_id" "uuid",
    "team_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_blockers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "outcome_id" "uuid",
    "channel_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "resolved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_blockers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_channel_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "subscriber_id" "uuid",
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_channel_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "avatar_url" "text",
    "cover_url" "text",
    "is_public" boolean DEFAULT true,
    "subscriber_count" integer DEFAULT 0,
    "total_listens" integer DEFAULT 0,
    "category" "text" DEFAULT 'general'::"text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_broadcast_at" timestamp with time zone
);


ALTER TABLE "public"."pulse_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_context_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "summary" "text" NOT NULL,
    "message_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_context_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user1_id" "uuid" NOT NULL,
    "user2_id" "uuid" NOT NULL,
    "last_message_id" "uuid",
    "last_message_at" timestamp with time zone,
    "last_message_preview" "text",
    "user1_unread_count" integer DEFAULT 0,
    "user2_unread_count" integer DEFAULT 0,
    "is_archived_by_user1" boolean DEFAULT false,
    "is_archived_by_user2" boolean DEFAULT false,
    "is_muted_by_user1" boolean DEFAULT false,
    "is_muted_by_user2" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "different_users" CHECK (("user1_id" <> "user2_id"))
);


ALTER TABLE "public"."pulse_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."pulse_conversations" IS 'Conversations between Pulse users';



CREATE TABLE IF NOT EXISTS "public"."pulse_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'proposal'::"text" NOT NULL,
    "votes_approve" integer DEFAULT 0,
    "votes_reject" integer DEFAULT 0,
    "created_by" "uuid",
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pulse_decisions_status_check" CHECK (("status" = ANY (ARRAY['proposal'::"text", 'voting'::"text", 'decided'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."pulse_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "channel_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid",
    "following_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "thread_id" "uuid",
    "content" "text" NOT NULL,
    "content_type" "text" DEFAULT 'text'::"text",
    "media_url" "text",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_self_message" CHECK (("sender_id" <> "recipient_id"))
);


ALTER TABLE "public"."pulse_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."pulse_messages" IS 'Direct messages between Pulse users - realtime enabled';



CREATE TABLE IF NOT EXISTS "public"."pulse_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel_id" "uuid",
    "message_id" "uuid",
    "type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pulse_notifications_type_check" CHECK (("type" = ANY (ARRAY['mention'::"text", 'reply'::"text", 'invite'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."pulse_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_nudges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "priority" "text" NOT NULL,
    "dismissed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pulse_nudges_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "pulse_nudges_type_check" CHECK (("type" = ANY (ARRAY['follow_up'::"text", 'clarify'::"text", 'de_escalate'::"text", 'check_in'::"text"])))
);


ALTER TABLE "public"."pulse_nudges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "progress" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pulse_outcomes_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "pulse_outcomes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."pulse_outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "title" "text" NOT NULL,
    "assigned_to" "uuid",
    "deadline" timestamp with time zone,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_typing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_typing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "handle" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "avatar_color" "text" DEFAULT '#10b981'::"text" NOT NULL,
    "bio" "text",
    "is_verified" boolean DEFAULT false,
    "follower_count" integer DEFAULT 0,
    "following_count" integer DEFAULT 0,
    "settings" "jsonb" DEFAULT '{"privacyLevel": "followers", "defaultVoxMode": "quick_vox", "autoPlayIncoming": false, "pushNotifications": true, "emailNotifications": true, "notificationsEnabled": true, "transcriptionEnabled": true}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_active_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_vox_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "contact_handle" "text",
    "contact_name" "text" NOT NULL,
    "avatar_color" "text" DEFAULT '#3B82F6'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "last_vox_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quick_vox_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_vox_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "delivered_at" timestamp with time zone,
    "played_at" timestamp with time zone,
    CONSTRAINT "quick_vox_messages_status_check" CHECK (("status" = ANY (ARRAY['sending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'played'::"text"])))
);


ALTER TABLE "public"."quick_vox_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_vox_status" (
    "user_id" "uuid" NOT NULL,
    "is_recording" boolean DEFAULT false,
    "is_online" boolean DEFAULT false,
    "last_seen" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quick_vox_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationship_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "profile_id" "uuid",
    "alert_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text",
    "priority" integer DEFAULT 50,
    "title" "text" NOT NULL,
    "description" "text",
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "suggested_action" "text",
    "action_type" "text",
    "action_template" "text",
    "action_data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "snoozed_until" timestamp with time zone,
    "actioned_at" timestamp with time zone,
    "actioned_type" "text",
    "dismissed_reason" "text",
    "trigger_date" "date",
    "expires_at" timestamp with time zone,
    "recurring" boolean DEFAULT false,
    "recurrence_rule" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "relationship_alerts_action_type_check" CHECK (("action_type" = ANY (ARRAY['send_email'::"text", 'schedule_meeting'::"text", 'make_call'::"text", 'send_message'::"text", 'review'::"text", 'dismiss'::"text", NULL::"text"]))),
    CONSTRAINT "relationship_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['relationship_decay'::"text", 'cold_contact'::"text", 'warm_lead'::"text", 'birthday_reminder'::"text", 'anniversary_reminder'::"text", 'follow_up_due'::"text", 'no_response'::"text", 'awaiting_response'::"text", 'milestone'::"text", 'meeting_prep'::"text", 're_engagement'::"text", 'vip_activity'::"text"]))),
    CONSTRAINT "relationship_alerts_priority_check" CHECK ((("priority" >= 0) AND ("priority" <= 100))),
    CONSTRAINT "relationship_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"]))),
    CONSTRAINT "relationship_alerts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'snoozed'::"text", 'dismissed'::"text", 'actioned'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."relationship_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."relationship_alerts" IS 'Proactive relationship management alerts and reminders';



CREATE TABLE IF NOT EXISTS "public"."relationship_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "relationship_id" "uuid",
    "event_type" "text" NOT NULL,
    "actor" "text",
    "event_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "relationship_events_valid_type" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'updated'::"text", 'deleted'::"text", 'restored'::"text"])))
);


ALTER TABLE "public"."relationship_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."relationship_events" IS 'Audit log for relationship changes - tracks created/updated/deleted events';



COMMENT ON COLUMN "public"."relationship_events"."event_type" IS 'Type of event: created, updated, deleted, restored';



COMMENT ON COLUMN "public"."relationship_events"."actor" IS 'Who triggered this: user:<id>, agent:<id>, system, job:<name>';



COMMENT ON COLUMN "public"."relationship_events"."event_payload" IS 'JSON details about what changed';



CREATE TABLE IF NOT EXISTS "public"."relationship_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "profile_id" "uuid",
    "milestone_type" "text" NOT NULL,
    "milestone_value" "text",
    "milestone_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "celebration_sent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "relationship_milestones_milestone_type_check" CHECK (("milestone_type" = ANY (ARRAY['first_contact'::"text", 'first_meeting'::"text", 'email_milestone'::"text", 'meeting_milestone'::"text", 'anniversary'::"text", 'score_milestone'::"text", 'converted'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."relationship_milestones" OWNER TO "postgres";


COMMENT ON TABLE "public"."relationship_milestones" IS 'Significant relationship events and milestones';



CREATE TABLE IF NOT EXISTS "public"."relationship_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "contact_email" "text" NOT NULL,
    "contact_name" "text",
    "relationship_score" integer DEFAULT 50,
    "relationship_trend" "text" DEFAULT 'stable'::"text",
    "relationship_type" "text" DEFAULT 'unknown'::"text",
    "communication_frequency" "text" DEFAULT 'unknown'::"text",
    "preferred_channel" "text" DEFAULT 'email'::"text",
    "avg_response_time_hours" double precision,
    "response_rate" double precision,
    "total_emails_sent" integer DEFAULT 0,
    "total_emails_received" integer DEFAULT 0,
    "total_meetings" integer DEFAULT 0,
    "total_shared_files" integer DEFAULT 0,
    "total_calls" integer DEFAULT 0,
    "last_email_sent_at" timestamp with time zone,
    "last_email_received_at" timestamp with time zone,
    "last_meeting_at" timestamp with time zone,
    "last_call_at" timestamp with time zone,
    "last_interaction_at" timestamp with time zone,
    "first_interaction_at" timestamp with time zone,
    "ai_communication_style" "text",
    "ai_topics" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_sentiment_average" double precision,
    "ai_relationship_summary" "text",
    "ai_talking_points" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_next_action_suggestion" "text",
    "ai_buying_signals" "jsonb" DEFAULT '[]'::"jsonb",
    "company" "text",
    "title" "text",
    "department" "text",
    "linkedin_url" "text",
    "twitter_handle" "text",
    "phone" "text",
    "timezone" "text",
    "location" "text",
    "extracted_signature" "jsonb" DEFAULT '{}'::"jsonb",
    "canonical_email" "text",
    "merged_from" "jsonb" DEFAULT '[]'::"jsonb",
    "is_merged" boolean DEFAULT false,
    "custom_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "custom_notes" "text",
    "is_favorite" boolean DEFAULT false,
    "is_vip" boolean DEFAULT false,
    "is_blocked" boolean DEFAULT false,
    "birthday" "date",
    "anniversary" "date",
    "source" "text" DEFAULT 'email'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_analyzed_at" timestamp with time zone,
    CONSTRAINT "relationship_profiles_ai_communication_style_check" CHECK (("ai_communication_style" = ANY (ARRAY['formal'::"text", 'casual'::"text", 'brief'::"text", 'detailed'::"text", NULL::"text"]))),
    CONSTRAINT "relationship_profiles_ai_sentiment_average_check" CHECK ((("ai_sentiment_average" >= ('-1'::integer)::double precision) AND ("ai_sentiment_average" <= (1)::double precision))),
    CONSTRAINT "relationship_profiles_communication_frequency_check" CHECK (("communication_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'sporadic'::"text", 'dormant'::"text", 'unknown'::"text"]))),
    CONSTRAINT "relationship_profiles_preferred_channel_check" CHECK (("preferred_channel" = ANY (ARRAY['email'::"text", 'calendar'::"text", 'slack'::"text", 'sms'::"text", 'mixed'::"text"]))),
    CONSTRAINT "relationship_profiles_relationship_score_check" CHECK ((("relationship_score" >= 0) AND ("relationship_score" <= 100))),
    CONSTRAINT "relationship_profiles_relationship_trend_check" CHECK (("relationship_trend" = ANY (ARRAY['rising'::"text", 'falling'::"text", 'stable'::"text"]))),
    CONSTRAINT "relationship_profiles_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['colleague'::"text", 'client'::"text", 'prospect'::"text", 'personal'::"text", 'vendor'::"text", 'unknown'::"text"]))),
    CONSTRAINT "relationship_profiles_response_rate_check" CHECK ((("response_rate" >= (0)::double precision) AND ("response_rate" <= (1)::double precision))),
    CONSTRAINT "relationship_profiles_source_check" CHECK (("source" = ANY (ARRAY['email'::"text", 'google_contacts'::"text", 'calendar'::"text", 'manual'::"text", 'import'::"text"])))
);


ALTER TABLE "public"."relationship_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."relationship_profiles" IS 'Central hub for relationship intelligence data per contact';



CREATE TABLE IF NOT EXISTS "public"."relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "confidence" double precision DEFAULT 1.0 NOT NULL,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_system" "text" DEFAULT 'entomate'::"text" NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rule_version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "text",
    CONSTRAINT "relationships_confidence_range" CHECK ((("confidence" >= (0.0)::double precision) AND ("confidence" <= (1.0)::double precision))),
    CONSTRAINT "relationships_no_self_link" CHECK ((NOT (("source_type" = "target_type") AND ("source_id" = "target_id")))),
    CONSTRAINT "relationships_non_empty_relationship_type" CHECK (("length"(TRIM(BOTH FROM "relationship_type")) > 0)),
    CONSTRAINT "relationships_non_empty_source_id" CHECK (("length"(TRIM(BOTH FROM "source_id")) > 0)),
    CONSTRAINT "relationships_non_empty_source_type" CHECK (("length"(TRIM(BOTH FROM "source_type")) > 0)),
    CONSTRAINT "relationships_non_empty_target_id" CHECK (("length"(TRIM(BOTH FROM "target_id")) > 0)),
    CONSTRAINT "relationships_non_empty_target_type" CHECK (("length"(TRIM(BOTH FROM "target_type")) > 0)),
    CONSTRAINT "relationships_source_id_has_colon" CHECK ((POSITION((':'::"text") IN ("source_id")) > 1)),
    CONSTRAINT "relationships_target_id_has_colon" CHECK ((POSITION((':'::"text") IN ("target_id")) > 1))
);


ALTER TABLE "public"."relationships" OWNER TO "postgres";


COMMENT ON TABLE "public"."relationships" IS 'Knowledge Graph edges - stores relationships between entities';



COMMENT ON COLUMN "public"."relationships"."source_type" IS 'Entity type: meeting, deal, task, project, contact, pulse_message';



COMMENT ON COLUMN "public"."relationships"."source_id" IS 'Prefixed entity ID: e.g., meeting:abc-123';



COMMENT ON COLUMN "public"."relationships"."relationship_type" IS 'Type of relationship: meeting_mentions_deal, action_item_created_task, etc.';



COMMENT ON COLUMN "public"."relationships"."confidence" IS 'Confidence score 0.0-1.0 (1.0 = explicit link, lower = inferred)';



COMMENT ON COLUMN "public"."relationships"."evidence" IS 'JSON evidence explaining why this link exists';



COMMENT ON COLUMN "public"."relationships"."rule_version" IS 'Version of rules that created this link (e.g., v1, v2)';



COMMENT ON COLUMN "public"."relationships"."is_deleted" IS 'Soft delete flag - true means hidden but not removed';



COMMENT ON COLUMN "public"."relationships"."deleted_at" IS 'When the relationship was soft-deleted';



COMMENT ON COLUMN "public"."relationships"."deleted_by" IS 'Who deleted this: user:<id> or agent:<id> or system';



CREATE TABLE IF NOT EXISTS "public"."reserved_handles" (
    "handle" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reserved_handles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "query" "text" NOT NULL,
    "search_type" "text" DEFAULT 'semantic'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "alert_enabled" boolean DEFAULT false NOT NULL,
    "alert_frequency" "text" DEFAULT 'daily'::"text",
    "last_alert_at" timestamp with time zone,
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "last_used" timestamp with time zone DEFAULT "now"(),
    "parsed_query" "jsonb",
    "icon" "text" DEFAULT 'search'::"text",
    "is_pinned" boolean DEFAULT false,
    "last_used_at" timestamp with time zone,
    "use_count" integer DEFAULT 0,
    CONSTRAINT "saved_searches_alert_frequency_check" CHECK (("alert_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'instant'::"text"])))
);


ALTER TABLE "public"."saved_searches" OWNER TO "postgres";


COMMENT ON TABLE "public"."saved_searches" IS 'User-saved search queries for quick access (Week 6)';



COMMENT ON COLUMN "public"."saved_searches"."parsed_query" IS 'Parsed query structure stored as JSONB for optimization';



COMMENT ON COLUMN "public"."saved_searches"."is_pinned" IS 'Pinned searches appear at top of list';



COMMENT ON COLUMN "public"."saved_searches"."last_used_at" IS 'Last time this search was executed';



COMMENT ON COLUMN "public"."saved_searches"."use_count" IS 'Number of times this search has been executed';



CREATE TABLE IF NOT EXISTS "public"."scheduled_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "to_emails" "jsonb" NOT NULL,
    "cc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "bcc_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "subject" "text",
    "body" "text",
    "body_html" "text",
    "is_html" boolean DEFAULT false,
    "thread_id" "text",
    "in_reply_to" "text",
    "scheduled_for" timestamp with time zone NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scheduled_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."scheduled_emails" IS 'Emails scheduled to be sent at a future time';



CREATE TABLE IF NOT EXISTS "public"."search_clipboard" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "content_type" "text" DEFAULT 'note'::"text" NOT NULL,
    "source_type" "text",
    "source_id" "text",
    "source_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "category" "text",
    "pinned" boolean DEFAULT false NOT NULL,
    "related_items" "jsonb" DEFAULT '[]'::"jsonb",
    "conversation_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "position_x" integer,
    "position_y" integer,
    "color" "text" DEFAULT '#FFD700'::"text",
    CONSTRAINT "search_clipboard_content_type_check" CHECK (("content_type" = ANY (ARRAY['note'::"text", 'message'::"text", 'conversation'::"text", 'snippet'::"text", 'reminder'::"text"])))
);


ALTER TABLE "public"."search_clipboard" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_clipboard" IS 'Clipboard/sticky notes for saving and organizing search results and snippets from Pulse';



CREATE TABLE IF NOT EXISTS "public"."search_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "embedding" "public"."vector"(768),
    "chunk_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "search_documents_non_empty_content" CHECK (("length"(TRIM(BOTH FROM "content")) > 0)),
    CONSTRAINT "search_documents_non_empty_source_id" CHECK (("length"(TRIM(BOTH FROM "source_id")) > 0)),
    CONSTRAINT "search_documents_non_empty_source_type" CHECK (("length"(TRIM(BOTH FROM "source_type")) > 0)),
    CONSTRAINT "search_documents_source_id_has_colon" CHECK ((POSITION((':'::"text") IN ("source_id")) > 1)),
    CONSTRAINT "search_documents_valid_source_type" CHECK (("source_type" = ANY (ARRAY['meeting'::"text", 'task'::"text", 'project'::"text", 'crm_deal'::"text", 'crm_contact'::"text", 'pulse_message'::"text"])))
);


ALTER TABLE "public"."search_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "query" "text" NOT NULL,
    "search_type" "text" DEFAULT 'keyword'::"text" NOT NULL,
    "results_count" integer DEFAULT 0,
    "execution_time" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "count" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."search_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_history" IS 'Tracks user search queries for analytics and suggestions (Week 6)';



CREATE TABLE IF NOT EXISTS "public"."search_index" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" character varying(50),
    "content_id" "uuid",
    "title" character varying(255),
    "content" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."search_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_docs" (
    "session_id" "uuid" NOT NULL,
    "doc_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."session_docs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."share_invites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "invite_type" character varying(20) NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "invited_by" "uuid",
    "permissions" "jsonb",
    "token" character varying(64) NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."share_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slack_channels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "channel_id" "text" NOT NULL,
    "channel_name" "text" NOT NULL,
    "workspace_id" "text",
    "workspace_name" "text",
    "is_private" boolean DEFAULT false NOT NULL,
    "is_member" boolean DEFAULT true NOT NULL,
    "member_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."slack_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smart_contact_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "group_type" "text" NOT NULL,
    "criteria" "jsonb" DEFAULT '{}'::"jsonb",
    "icon" "text" DEFAULT 'users'::"text",
    "color" "text" DEFAULT '#3b82f6'::"text",
    "emoji" "text",
    "member_profile_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "member_count" integer DEFAULT 0,
    "ai_confidence" double precision,
    "ai_reasoning" "text",
    "ai_suggested_at" timestamp with time zone,
    "is_pinned" boolean DEFAULT false,
    "is_system" boolean DEFAULT false,
    "is_hidden" boolean DEFAULT false,
    "auto_refresh" boolean DEFAULT true,
    "last_refreshed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "smart_contact_groups_ai_confidence_check" CHECK ((("ai_confidence" >= (0)::double precision) AND ("ai_confidence" <= (1)::double precision))),
    CONSTRAINT "smart_contact_groups_group_type_check" CHECK (("group_type" = ANY (ARRAY['system'::"text", 'ai_suggested'::"text", 'manual'::"text", 'smart_rule'::"text", 'company'::"text", 'tag'::"text"])))
);


ALTER TABLE "public"."smart_contact_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."smart_contact_groups" IS 'AI-suggested and rule-based contact groupings';



CREATE TABLE IF NOT EXISTS "public"."smart_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3b82f6'::"text" NOT NULL,
    "icon" "text" DEFAULT 'fa-wand-magic-sparkles'::"text" NOT NULL,
    "rules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "rule_operator" "text" DEFAULT 'and'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "smart_folders_rule_operator_check" CHECK (("rule_operator" = ANY (ARRAY['and'::"text", 'or'::"text"])))
);


ALTER TABLE "public"."smart_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smart_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "text" NOT NULL,
    "channel_name" "text" NOT NULL,
    "description" "text",
    "crm_id" "uuid",
    "membership_rules" "jsonb" NOT NULL,
    "member_contact_ids" "text"[] DEFAULT ARRAY[]::"text"[],
    "member_user_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "is_active" boolean DEFAULT true,
    "auto_sync_enabled" boolean DEFAULT true,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."smart_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smart_suggestions_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "context_hash" "text" NOT NULL,
    "suggestions" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '01:00:00'::interval)
);


ALTER TABLE "public"."smart_suggestions_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."smart_suggestions_cache" IS 'Cached AI-generated suggestions to reduce API calls';



CREATE TABLE IF NOT EXISTS "public"."sms_conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "phone_number" "text" NOT NULL,
    "contact_name" "text",
    "avatar_color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "last_message" "text",
    "last_message_at" timestamp with time zone,
    "unread_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sms_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "text" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'sent'::"text",
    "media_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sms_messages_sender_check" CHECK (("sender" = ANY (ARRAY['me'::"text", 'them'::"text"]))),
    CONSTRAINT "sms_messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."snoozed_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email_id" "text",
    "gmail_id" "text",
    "snooze_until" timestamp with time zone NOT NULL,
    "original_labels" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'snoozed'::"text",
    "restored_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."snoozed_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."snoozed_emails" IS 'Emails temporarily hidden until a specified time';



CREATE TABLE IF NOT EXISTS "public"."sso_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "protocol" "text" NOT NULL,
    "is_enabled" boolean DEFAULT false NOT NULL,
    "saml_entry_point" "text",
    "saml_issuer" "text",
    "saml_certificate" "text",
    "saml_signature_algorithm" "text" DEFAULT 'sha256'::"text",
    "saml_logout_url" "text",
    "oauth_client_id" "text",
    "oauth_client_secret" "text",
    "oauth_authorization_url" "text",
    "oauth_token_url" "text",
    "oauth_userinfo_url" "text",
    "oauth_scopes" "text"[] DEFAULT '{}'::"text"[],
    "auto_provision_users" boolean DEFAULT true NOT NULL,
    "default_role_id" "uuid",
    "allowed_domains" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sso_configs_valid_protocol" CHECK (("protocol" = ANY (ARRAY['saml'::"text", 'oauth'::"text", 'oidc'::"text"]))),
    CONSTRAINT "sso_configs_valid_provider" CHECK (("provider" = ANY (ARRAY['okta'::"text", 'azure_ad'::"text", 'google'::"text", 'onelogin'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."sso_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."sso_configs" IS 'SSO configuration per tenant - supports SAML and OAuth';



COMMENT ON COLUMN "public"."sso_configs"."provider" IS 'SSO provider: okta, azure_ad, google, onelogin, custom';



COMMENT ON COLUMN "public"."sso_configs"."protocol" IS 'Authentication protocol: saml, oauth, oidc';



COMMENT ON COLUMN "public"."sso_configs"."allowed_domains" IS 'Email domains allowed to authenticate (empty = all)';



CREATE TABLE IF NOT EXISTS "public"."sso_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "provider" "text" NOT NULL,
    "session_index" "text",
    "name_id" "text",
    "attributes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."sso_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sso_sessions" IS 'SSO session tracking for debugging and audit';



COMMENT ON COLUMN "public"."sso_sessions"."session_index" IS 'SAML session index for single logout';



COMMENT ON COLUMN "public"."sso_sessions"."name_id" IS 'SAML NameID or OAuth subject';



COMMENT ON COLUMN "public"."sso_sessions"."attributes" IS 'User attributes received from identity provider';



CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "depends_on_task_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "task_dependencies_check" CHECK (("task_id" <> "depends_on_task_id"))
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "updated_by" "text" NOT NULL,
    "field_changed" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "due_date" timestamp with time zone,
    "list_id" "text" DEFAULT 'work'::"text" NOT NULL,
    "assignee_id" "text",
    "origin_message_id" "text",
    "priority" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_invites" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "invited_by" "uuid",
    "invited_by_name" "text" NOT NULL,
    "workspace_id" "text",
    "workspace_name" "text" DEFAULT 'Pulse Team'::"text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "team_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text"]))),
    CONSTRAINT "valid_email" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))
);


ALTER TABLE "public"."team_invites" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_invites" IS 'Stores team invitation records for Pulse app';



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "member_type" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "added_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_members_member_type_check" CHECK (("member_type" = ANY (ARRAY['pulse_user'::"text", 'contact'::"text"]))),
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_members" IS 'Members of user teams (can be Pulse users or contacts)';



COMMENT ON COLUMN "public"."team_members"."member_type" IS 'Type of member: pulse_user (from user_profiles) or contact (from contacts table)';



COMMENT ON COLUMN "public"."team_members"."member_id" IS 'ID of the member (user_profiles.id for pulse_user, contacts.id for contact)';



CREATE TABLE IF NOT EXISTS "public"."team_vox_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "workspace_id" "uuid",
    "sender_id" "uuid",
    "sender_name" "text" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "transcript" "text",
    "message_type" "text" DEFAULT 'normal'::"text" NOT NULL,
    "action_items" "text"[] DEFAULT ARRAY[]::"text"[],
    "mentions" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "reactions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_vox_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['normal'::"text", 'standup'::"text", 'announcement'::"text"])))
);


ALTER TABLE "public"."team_vox_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "logo_url" character varying(512),
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_matrix_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "tester_name" "text" DEFAULT ''::"text",
    "user_id" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "test_matrix_results_status_check" CHECK (("status" = ANY (ARRAY['pass'::"text", 'fail'::"text", 'pending'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."test_matrix_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "contact_id" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "avatar_color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "unread" boolean DEFAULT false NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "outcome_goal" "text",
    "outcome_status" "text",
    "outcome_progress" integer DEFAULT 0,
    "outcome_blockers" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "threads_outcome_status_check" CHECK (("outcome_status" = ANY (ARRAY['on_track'::"text", 'at_risk'::"text", 'completed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unified_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "sender_id" "text",
    "sender_email" "text",
    "content" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "channel_id" "text",
    "channel_name" "text",
    "thread_id" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "starred" boolean DEFAULT false NOT NULL,
    "priority" "text",
    "message_type" "text" DEFAULT 'text'::"text",
    "conversation_graph_id" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "media_url" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "searchable_content" "text" GENERATED ALWAYS AS (((((COALESCE("content", ''::"text") || ' '::"text") || COALESCE("sender_name", ''::"text")) || ' '::"text") || COALESCE("channel_name", ''::"text"))) STORED,
    "platform" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "is_starred" boolean DEFAULT false,
    "external_id" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "unified_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'file'::"text", 'voice'::"text"]))),
    CONSTRAINT "unified_messages_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."unified_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voxer_recordings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text",
    "audio_url" "text",
    "duration" integer DEFAULT 0 NOT NULL,
    "transcript" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_id" "text",
    "contact_name" "text",
    "is_outgoing" boolean DEFAULT true NOT NULL,
    "played" boolean DEFAULT false NOT NULL,
    "starred" boolean DEFAULT false NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "notes" "jsonb" DEFAULT '[]'::"jsonb",
    "analysis" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."voxer_recordings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unified_search_view" AS
 SELECT 'unified_message'::"text" AS "result_type",
    ("unified_messages"."id")::"text" AS "id",
    "unified_messages"."user_id",
    COALESCE("unified_messages"."channel_name", "unified_messages"."sender_name", "unified_messages"."source") AS "title",
    "unified_messages"."content",
    "unified_messages"."timestamp" AS "result_timestamp",
    "unified_messages"."source",
    "unified_messages"."sender_name" AS "sender",
    "unified_messages"."sender_email",
    '{}'::"jsonb" AS "metadata"
   FROM "public"."unified_messages"
  WHERE ("unified_messages"."user_id" IS NOT NULL)
UNION ALL
 SELECT 'email'::"text" AS "result_type",
    ("emails"."id")::"text" AS "id",
    "emails"."user_id",
    "emails"."subject" AS "title",
    COALESCE("emails"."body", "emails"."snippet", ''::"text") AS "content",
    "emails"."date" AS "result_timestamp",
    'email'::"text" AS "source",
    "emails"."from_address" AS "sender",
    "emails"."from_address" AS "sender_email",
    "jsonb_build_object"('folder', "emails"."folder", 'labels', "emails"."labels", 'thread_id', "emails"."thread_id") AS "metadata"
   FROM "public"."emails"
  WHERE ("emails"."user_id" IS NOT NULL)
UNION ALL
 SELECT 'vox'::"text" AS "result_type",
    ("voxer_recordings"."id")::"text" AS "id",
    "voxer_recordings"."user_id",
    COALESCE("voxer_recordings"."title", ('Vox: '::"text" || "voxer_recordings"."contact_name")) AS "title",
    COALESCE("voxer_recordings"."transcript", ''::"text") AS "content",
    "voxer_recordings"."recorded_at" AS "result_timestamp",
    'voxer'::"text" AS "source",
    "voxer_recordings"."contact_name" AS "sender",
    NULL::"text" AS "sender_email",
    "jsonb_build_object"('duration', "voxer_recordings"."duration", 'is_outgoing', "voxer_recordings"."is_outgoing", 'contact_id', "voxer_recordings"."contact_id") AS "metadata"
   FROM "public"."voxer_recordings"
  WHERE ("voxer_recordings"."user_id" IS NOT NULL)
UNION ALL
 SELECT 'task'::"text" AS "result_type",
    ("tasks"."id")::"text" AS "id",
    "tasks"."user_id",
    "tasks"."title",
    ''::"text" AS "content",
    "tasks"."created_at" AS "result_timestamp",
    'pulse'::"text" AS "source",
    NULL::"text" AS "sender",
    NULL::"text" AS "sender_email",
    "jsonb_build_object"('completed', "tasks"."completed", 'due_date', "tasks"."due_date", 'priority', "tasks"."priority") AS "metadata"
   FROM "public"."tasks"
  WHERE ("tasks"."user_id" IS NOT NULL);


ALTER VIEW "public"."unified_search_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."unified_search_view" IS 'Unified view of all searchable content for Pulse search functionality';



CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "category" "text" NOT NULL,
    "rarity" "text" NOT NULL,
    "progress" integer DEFAULT 0,
    "max_progress" integer NOT NULL,
    "unlocked" boolean DEFAULT false,
    "unlocked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_achievements" IS 'Gamification achievements earned by users';



CREATE TABLE IF NOT EXISTS "public"."user_contact_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "nickname" "text",
    "custom_notes" "text",
    "custom_tags" "text"[],
    "custom_phone" "text",
    "custom_email" "text",
    "custom_birthday" "date",
    "custom_company" "text",
    "custom_role" "text",
    "custom_address" "text",
    "is_favorite" boolean DEFAULT false,
    "is_blocked" boolean DEFAULT false,
    "last_interaction_at" timestamp with time zone,
    "interaction_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_self_annotation" CHECK (("user_id" <> "target_user_id"))
);


ALTER TABLE "public"."user_contact_annotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_contact_annotations" IS 'User-specific customization and notes about other Pulse users (private to each user)';



CREATE TABLE IF NOT EXISTS "public"."user_message_statistics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "messages_sent" integer DEFAULT 0,
    "fast_responses" integer DEFAULT 0,
    "tasks_created" integer DEFAULT 0,
    "decisions_made" integer DEFAULT 0,
    "people_helped" "text"[] DEFAULT ARRAY[]::"text"[],
    "active_conversations" "text"[] DEFAULT ARRAY[]::"text"[],
    "login_streak" integer DEFAULT 0,
    "last_login_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_message_statistics" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_message_statistics" IS 'Aggregated statistics for achievement tracking';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "handle" "text",
    "display_name" "text",
    "full_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "phone" "text",
    "is_public" boolean DEFAULT true,
    "is_verified" boolean DEFAULT false,
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'user'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "messages_count" integer DEFAULT 0,
    "groups_count" integer DEFAULT 0,
    "online_status" "text" DEFAULT 'offline'::"text",
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "user_profiles_online_status_check" CHECK (("online_status" = ANY (ARRAY['online'::"text", 'offline'::"text", 'away'::"text", 'busy'::"text"]))),
    CONSTRAINT "valid_handle" CHECK ((("handle" IS NULL) OR (("handle" ~ '^[a-z0-9_]{3,30}$'::"text") AND ("handle" !~~ "like_escape"('%\_\_%'::"text", '\'::"text")) AND ("left"("handle", 1) <> '_'::"text") AND ("right"("handle", 1) <> '_'::"text"))))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'User profiles with Pulse handles for in-app messaging';



COMMENT ON COLUMN "public"."user_profiles"."online_status" IS 'Current online status: online, offline, away, busy';



COMMENT ON COLUMN "public"."user_profiles"."last_active_at" IS 'Last time user was actively using the app';



CREATE TABLE IF NOT EXISTS "public"."user_retention_cohorts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "cohort_date" "date" NOT NULL,
    "returned_day_1" boolean DEFAULT false,
    "returned_day_7" boolean DEFAULT false,
    "returned_day_30" boolean DEFAULT false,
    "total_messages_seen" integer DEFAULT 0,
    "total_messages_clicked" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_retention_cohorts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "avatar_color" "text" DEFAULT '#ec4899'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_teams" IS 'User-defined teams for organizing contacts and Pulse users';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "avatar_url" character varying(512),
    "role" character varying(50) DEFAULT 'member'::character varying,
    "team_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "name" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vacation_responder" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "subject" "text" NOT NULL,
    "message_html" "text" NOT NULL,
    "message_text" "text" NOT NULL,
    "only_contacts" boolean DEFAULT false,
    "only_first_email" boolean DEFAULT true,
    "last_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vacation_responder_date_range" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."vacation_responder" OWNER TO "postgres";


COMMENT ON TABLE "public"."vacation_responder" IS 'Auto-reply configuration for out-of-office responses';



COMMENT ON COLUMN "public"."vacation_responder"."only_contacts" IS 'Only send replies to contacts';



COMMENT ON COLUMN "public"."vacation_responder"."only_first_email" IS 'Only send one reply per sender during the period';



CREATE TABLE IF NOT EXISTS "public"."vacation_responder_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "responder_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "original_email_id" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vacation_responder_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."vacation_responder_log" IS 'Tracks auto-replies sent by vacation responder';



COMMENT ON COLUMN "public"."vacation_responder_log"."recipient_email" IS 'Recipient email address';



COMMENT ON COLUMN "public"."vacation_responder_log"."original_email_id" IS 'Cached email ID that triggered the reply';



CREATE TABLE IF NOT EXISTS "public"."video_vox_ai_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "tasks" "text"[] DEFAULT ARRAY['transcribe'::"text", 'summarize'::"text", 'extract_topics'::"text"],
    "attempts" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 3,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "video_vox_ai_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."video_vox_ai_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_vox_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "message_id" "uuid",
    "note" "text",
    "timestamp" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."video_vox_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_vox_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_ids" "uuid"[] NOT NULL,
    "title" "text",
    "last_message_id" "uuid",
    "last_message_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."video_vox_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_vox_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "sender_name" "text" NOT NULL,
    "sender_handle" "text",
    "sender_avatar_url" "text",
    "video_url" "text" NOT NULL,
    "thumbnail_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "width" integer DEFAULT 1080,
    "height" integer DEFAULT 1920,
    "file_size" integer,
    "caption" "text",
    "transcript" "text",
    "summary" "text",
    "topics" "text"[] DEFAULT ARRAY[]::"text"[],
    "sentiment" "text",
    "action_items" "text"[] DEFAULT ARRAY[]::"text"[],
    "reply_to_id" "uuid",
    "reply_to_timestamp" integer,
    "quoted_text" "text",
    "thread_count" integer DEFAULT 0,
    "mentions" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "processing_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "delivered_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "video_vox_messages_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'transcribing'::"text", 'summarizing'::"text", 'complete'::"text", 'failed'::"text"]))),
    CONSTRAINT "video_vox_messages_sentiment_check" CHECK (("sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text", 'mixed'::"text"]))),
    CONSTRAINT "video_vox_messages_status_check" CHECK (("status" = ANY (ARRAY['uploading'::"text", 'processing'::"text", 'sent'::"text", 'delivered'::"text", 'viewed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."video_vox_messages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."video_vox_conversation_list" AS
 SELECT "c"."id",
    "c"."participant_ids",
    "c"."title",
    "c"."last_message_at",
    "c"."created_at",
    "m"."caption" AS "last_message_caption",
    "m"."sender_name" AS "last_message_sender",
    "m"."duration" AS "last_message_duration",
    "m"."thumbnail_url" AS "last_message_thumbnail"
   FROM ("public"."video_vox_conversations" "c"
     LEFT JOIN "public"."video_vox_messages" "m" ON (("c"."last_message_id" = "m"."id")))
  ORDER BY "c"."last_message_at" DESC NULLS LAST;


ALTER VIEW "public"."video_vox_conversation_list" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_vox_conversation_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "user_id" "uuid",
    "unread_count" integer DEFAULT 0,
    "is_muted" boolean DEFAULT false,
    "last_read_at" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."video_vox_conversation_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."video_vox_messages_with_reactions" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "conversation_id",
    NULL::"uuid" AS "sender_id",
    NULL::"text" AS "sender_name",
    NULL::"text" AS "sender_handle",
    NULL::"text" AS "sender_avatar_url",
    NULL::"text" AS "video_url",
    NULL::"text" AS "thumbnail_url",
    NULL::integer AS "duration",
    NULL::integer AS "width",
    NULL::integer AS "height",
    NULL::integer AS "file_size",
    NULL::"text" AS "caption",
    NULL::"text" AS "transcript",
    NULL::"text" AS "summary",
    NULL::"text"[] AS "topics",
    NULL::"text" AS "sentiment",
    NULL::"text"[] AS "action_items",
    NULL::"uuid" AS "reply_to_id",
    NULL::integer AS "reply_to_timestamp",
    NULL::"text" AS "quoted_text",
    NULL::integer AS "thread_count",
    NULL::"uuid"[] AS "mentions",
    NULL::"text" AS "status",
    NULL::"text" AS "processing_status",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "delivered_at",
    NULL::timestamp with time zone AS "expires_at",
    NULL::"jsonb" AS "metadata",
    NULL::"jsonb" AS "reaction_counts";


ALTER VIEW "public"."video_vox_messages_with_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_vox_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid",
    "emoji" "text" NOT NULL,
    "timestamp" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."video_vox_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_vox_read_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid",
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "watch_duration" integer,
    "completed" boolean DEFAULT false
);


ALTER TABLE "public"."video_vox_read_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_message_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_message_bookmarks" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_message_bookmarks" IS 'User bookmarks for important messages';



CREATE TABLE IF NOT EXISTS "public"."voice_message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "emoji" character varying(10) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_message_reactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_message_reactions" IS 'Emoji reactions on voice thread messages';



CREATE TABLE IF NOT EXISTS "public"."voice_thread_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid",
    "sender_id" "uuid",
    "sender_name" "text" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "transcript" "text",
    "reply_to_id" "uuid",
    "reply_to_timestamp" integer,
    "quoted_text" "text",
    "read_by" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_pinned" boolean DEFAULT false,
    "pinned_at" timestamp with time zone,
    "pinned_by" "uuid",
    "is_edited" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "forwarded_from_thread_id" "uuid",
    "forwarded_from_message_id" "uuid"
);


ALTER TABLE "public"."voice_thread_messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."voice_thread_messages"."is_pinned" IS 'Whether this message is pinned within the thread';



COMMENT ON COLUMN "public"."voice_thread_messages"."is_edited" IS 'Whether the message transcript has been edited';



COMMENT ON COLUMN "public"."voice_thread_messages"."is_deleted" IS 'Soft delete flag - message still exists but hidden';



CREATE OR REPLACE VIEW "public"."voice_thread_messages_with_metadata" AS
 SELECT "id",
    "thread_id",
    "sender_id",
    "sender_name",
    "audio_url",
    "duration",
    "transcript",
    "reply_to_id",
    "reply_to_timestamp",
    "quoted_text",
    "read_by",
    "created_at",
    "is_pinned",
    "pinned_at",
    "pinned_by",
    "is_edited",
    "edited_at",
    "is_deleted",
    "deleted_at",
    "forwarded_from_thread_id",
    "forwarded_from_message_id",
    "public"."get_message_reaction_counts"("id") AS "reaction_counts",
    ( SELECT "count"(*) AS "count"
           FROM "public"."voice_message_bookmarks" "b"
          WHERE ("b"."message_id" = "m"."id")) AS "bookmark_count",
        CASE
            WHEN ("forwarded_from_message_id" IS NOT NULL) THEN true
            ELSE false
        END AS "is_forwarded"
   FROM "public"."voice_thread_messages" "m"
  WHERE ("is_deleted" = false);


ALTER VIEW "public"."voice_thread_messages_with_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_thread_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    "is_muted" boolean DEFAULT false,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_thread_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_thread_participants" IS 'Per-user metadata for thread participants, complementing the voice_threads.participants array';



CREATE TABLE IF NOT EXISTS "public"."voice_thread_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid",
    "tag" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_thread_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_thread_tags" IS 'User-defined tags for organizing threads';



CREATE TABLE IF NOT EXISTS "public"."voice_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participants" "uuid"[] NOT NULL,
    "subject" "text",
    "root_message_id" "uuid",
    "message_count" integer DEFAULT 0,
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "is_pinned" boolean DEFAULT false,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "voice_threads_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'archived'::character varying, 'pinned'::character varying])::"text"[])))
);


ALTER TABLE "public"."voice_threads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."voice_threads"."is_pinned" IS 'Whether this thread is pinned to the top of the list';



COMMENT ON COLUMN "public"."voice_threads"."status" IS 'Thread status: active, resolved, archived, or pinned';



COMMENT ON COLUMN "public"."voice_threads"."updated_at" IS 'Last time thread metadata was updated (auto-updated by trigger)';



CREATE OR REPLACE VIEW "public"."voice_threads_batch_stats" AS
 SELECT "count"(*) AS "total_threads",
    "avg"("message_count") AS "avg_messages_per_thread",
    "max"("message_count") AS "max_messages_in_thread",
    ( SELECT "count"(*) AS "count"
           FROM "public"."voice_thread_messages"
          WHERE ("voice_thread_messages"."is_deleted" = false)) AS "total_messages",
    ( SELECT "count"(*) AS "count"
           FROM "public"."voice_message_reactions") AS "total_reactions",
    ( SELECT "count"(*) AS "count"
           FROM "public"."voice_thread_tags") AS "total_tags"
   FROM "public"."voice_threads"
  WHERE ("is_archived" = false);


ALTER VIEW "public"."voice_threads_batch_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."voice_threads_batch_stats" IS 'Statistics view for monitoring Voice Threads performance and data volumes. Useful for understanding batch operation efficiency and scaling needs.';



CREATE OR REPLACE VIEW "public"."voice_threads_with_metadata" AS
 SELECT "id",
    "participants",
    "subject",
    "root_message_id",
    "message_count",
    "is_archived",
    "created_at",
    "last_activity_at",
    "is_pinned",
    "status",
    "updated_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."voice_thread_messages" "m"
          WHERE (("m"."thread_id" = "vt"."id") AND ("m"."is_deleted" = false))) AS "total_messages",
    ( SELECT "json_agg"("json_build_object"('user_id', "vtp"."user_id", 'last_read_at', "vtp"."last_read_at", 'is_muted', "vtp"."is_muted", 'joined_at', "vtp"."joined_at")) AS "json_agg"
           FROM "public"."voice_thread_participants" "vtp"
          WHERE ("vtp"."thread_id" = "vt"."id")) AS "participant_metadata"
   FROM "public"."voice_threads" "vt";


ALTER VIEW "public"."voice_threads_with_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vox_drops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_ids" "uuid"[] NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "transcript" "text",
    "title" "text",
    "message" "text",
    "scheduled_for" timestamp with time zone NOT NULL,
    "delivered_at" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "reveal_condition" "jsonb",
    "is_recurring" boolean DEFAULT false,
    "recurring_pattern" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vox_drops_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'delivered'::"text", 'opened'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."vox_drops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vox_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "transcript" "text",
    "title" "text",
    "summary" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "linked_items" "jsonb" DEFAULT '[]'::"jsonb",
    "is_favorite" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vox_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vox_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "related_vox_id" "uuid",
    "sender_id" "uuid",
    "sender_name" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vox_notifications_type_check" CHECK (("type" = ANY (ARRAY['new_vox'::"text", 'reaction'::"text", 'reply'::"text", 'mention'::"text", 'broadcast'::"text", 'vox_drop'::"text"])))
);


ALTER TABLE "public"."vox_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vox_team_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "member_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "last_message_at" timestamp with time zone,
    "unread_count" integer DEFAULT 0,
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vox_team_channels_type_check" CHECK (("type" = ANY (ARRAY['general'::"text", 'standup'::"text", 'announcement'::"text", 'project'::"text"])))
);


ALTER TABLE "public"."vox_team_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vox_workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "owner_id" "uuid",
    "member_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[] NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vox_workspaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "webhook_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "response_status" integer,
    "response_body" "text",
    "response_headers" "jsonb",
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    CONSTRAINT "deliveries_valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text", 'retrying'::"text"])))
);


ALTER TABLE "public"."webhook_deliveries" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhook_deliveries" IS 'Log of webhook delivery attempts';



CREATE TABLE IF NOT EXISTS "public"."workspace_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "goal" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'on_track'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "target_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."workspace_outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."workspace_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_settings" (
    "workspace_id" "uuid" NOT NULL,
    "security_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "audit_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "data_controls_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspace_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_items"
    ADD CONSTRAINT "action_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_activity_logs"
    ADD CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_settings"
    ADD CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_execution_logs"
    ADD CONSTRAINT "agent_execution_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_run_steps"
    ADD CONSTRAINT "agent_run_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_projects"
    ADD CONSTRAINT "ai_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_prompt_suggestions"
    ADD CONSTRAINT "ai_prompt_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_sessions"
    ADD CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_thinking_logs"
    ADD CONSTRAINT "ai_thinking_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_contact_engagement"
    ADD CONSTRAINT "analytics_contact_engagement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_contact_engagement"
    ADD CONSTRAINT "analytics_contact_engagement_user_id_contact_identifier_key" UNIQUE ("user_id", "contact_identifier");



ALTER TABLE ONLY "public"."analytics_daily_metrics"
    ADD CONSTRAINT "analytics_daily_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_daily_metrics"
    ADD CONSTRAINT "analytics_daily_metrics_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."analytics_period_summary"
    ADD CONSTRAINT "analytics_period_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_period_summary"
    ADD CONSTRAINT "analytics_period_summary_user_id_period_type_period_start_key" UNIQUE ("user_id", "period_type", "period_start");



ALTER TABLE ONLY "public"."analytics_response_times"
    ADD CONSTRAINT "analytics_response_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotation_replies"
    ADD CONSTRAINT "annotation_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_api_key_id_window_start_key" UNIQUE ("api_key_id", "window_start");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_request_logs"
    ADD CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archive_collections"
    ADD CONSTRAINT "archive_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archive_shares"
    ADD CONSTRAINT "archive_shares_archive_id_shared_with_key" UNIQUE ("archive_id", "shared_with");



ALTER TABLE ONLY "public"."archive_shares"
    ADD CONSTRAINT "archive_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archives"
    ADD CONSTRAINT "archives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attention_logs"
    ADD CONSTRAINT "attention_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attention_settings"
    ADD CONSTRAINT "attention_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attention_settings"
    ADD CONSTRAINT "attention_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_logs"
    ADD CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_templates"
    ADD CONSTRAINT "automation_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_senders"
    ADD CONSTRAINT "blocked_senders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cached_emails"
    ADD CONSTRAINT "cached_emails_gmail_id_key" UNIQUE ("gmail_id");



ALTER TABLE ONLY "public"."cached_emails"
    ADD CONSTRAINT "cached_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_user_id_platform_external_id_key" UNIQUE ("user_id", "platform", "external_id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaching_keywords"
    ADD CONSTRAINT "coaching_keywords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaching_prompts"
    ADD CONSTRAINT "coaching_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaching_sessions"
    ADD CONSTRAINT "coaching_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaching_sessions"
    ADD CONSTRAINT "coaching_sessions_unique_meeting_user" UNIQUE ("meeting_id", "user_id");



ALTER TABLE ONLY "public"."collection_docs"
    ADD CONSTRAINT "collection_docs_pkey" PRIMARY KEY ("collection_id", "doc_id");



ALTER TABLE ONLY "public"."contact_interactions"
    ADD CONSTRAINT "contact_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_graphs"
    ADD CONSTRAINT "conversation_graphs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_health"
    ADD CONSTRAINT "conversation_health_conversation_id_key" UNIQUE ("conversation_id");



ALTER TABLE ONLY "public"."conversation_health"
    ADD CONSTRAINT "conversation_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_memory"
    ADD CONSTRAINT "conversation_memory_conversation_id_key" UNIQUE ("conversation_id");



ALTER TABLE ONLY "public"."conversation_memory"
    ADD CONSTRAINT "conversation_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_actions"
    ADD CONSTRAINT "crm_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_companies"
    ADD CONSTRAINT "crm_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_deals"
    ADD CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_integrations"
    ADD CONSTRAINT "crm_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_integrations"
    ADD CONSTRAINT "crm_integrations_platform_key" UNIQUE ("platform");



ALTER TABLE ONLY "public"."crm_sidepanels"
    ADD CONSTRAINT "crm_sidepanels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_sync_log"
    ADD CONSTRAINT "crm_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_sync_log"
    ADD CONSTRAINT "crm_sync_log_sync_key_key" UNIQUE ("sync_key");



ALTER TABLE ONLY "public"."crm_sync_logs"
    ADD CONSTRAINT "crm_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_labels"
    ADD CONSTRAINT "custom_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_alerts"
    ADD CONSTRAINT "customer_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_health"
    ADD CONSTRAINT "customer_health_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."customer_health_history"
    ADD CONSTRAINT "customer_health_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_health"
    ADD CONSTRAINT "customer_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_sentiment"
    ADD CONSTRAINT "customer_sentiment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_sentiment"
    ADD CONSTRAINT "customer_sentiment_unique_source" UNIQUE ("source_type", "source_id");



ALTER TABLE ONLY "public"."decision_votes"
    ADD CONSTRAINT "decision_votes_decision_id_user_id_key" UNIQUE ("decision_id", "user_id");



ALTER TABLE ONLY "public"."decision_votes"
    ADD CONSTRAINT "decision_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decisions"
    ADD CONSTRAINT "decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_annotations"
    ADD CONSTRAINT "doc_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_embeddings"
    ADD CONSTRAINT "doc_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_favorites"
    ADD CONSTRAINT "doc_favorites_pkey" PRIMARY KEY ("user_id", "doc_id");



ALTER TABLE ONLY "public"."doc_highlights"
    ADD CONSTRAINT "doc_highlights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_recent_views"
    ADD CONSTRAINT "doc_recent_views_pkey" PRIMARY KEY ("user_id", "doc_id");



ALTER TABLE ONLY "public"."doc_tags"
    ADD CONSTRAINT "doc_tags_pkey" PRIMARY KEY ("doc_id", "tag_id");



ALTER TABLE ONLY "public"."document_collections"
    ADD CONSTRAINT "document_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_shares"
    ADD CONSTRAINT "document_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_shares"
    ADD CONSTRAINT "document_shares_public_link_key" UNIQUE ("public_link");



ALTER TABLE ONLY "public"."document_tags"
    ADD CONSTRAINT "document_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_tags"
    ADD CONSTRAINT "document_tags_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."duplicate_contacts"
    ADD CONSTRAINT "duplicate_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_contacts"
    ADD CONSTRAINT "email_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_contacts"
    ADD CONSTRAINT "email_contacts_user_id_email_key" UNIQUE ("user_id", "email");



ALTER TABLE ONLY "public"."email_daily_briefings"
    ADD CONSTRAINT "email_daily_briefings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_daily_briefings"
    ADD CONSTRAINT "email_daily_briefings_user_id_briefing_date_key" UNIQUE ("user_id", "briefing_date");



ALTER TABLE ONLY "public"."email_follow_ups"
    ADD CONSTRAINT "email_follow_ups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_labels"
    ADD CONSTRAINT "email_labels_pkey" PRIMARY KEY ("email_id", "label_id");



ALTER TABLE ONLY "public"."email_sync_state"
    ADD CONSTRAINT "email_sync_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_sync_state"
    ADD CONSTRAINT "email_sync_state_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embeddings"
    ADD CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entomate_action_items"
    ADD CONSTRAINT "entomate_action_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entomate_automation_logs"
    ADD CONSTRAINT "entomate_automation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entomate_automations"
    ADD CONSTRAINT "entomate_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entomate_meetings"
    ADD CONSTRAINT "entomate_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entomate_project_tasks"
    ADD CONSTRAINT "entomate_project_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entomate_projects"
    ADD CONSTRAINT "entomate_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ephemeral_workspaces"
    ADD CONSTRAINT "ephemeral_workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."extracted_tasks"
    ADD CONSTRAINT "extracted_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_field_mappings"
    ADD CONSTRAINT "field_mappings_unique" UNIQUE ("integration_id", "entity_type", "external_field");



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."in_app_messages"
    ADD CONSTRAINT "in_app_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_field_mappings"
    ADD CONSTRAINT "integration_field_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_sync_logs"
    ADD CONSTRAINT "integration_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_integration_type_key" UNIQUE ("integration_type");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."key_results"
    ADD CONSTRAINT "key_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_docs"
    ADD CONSTRAINT "knowledge_docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_labels"
    ADD CONSTRAINT "label_name_unique_per_user" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."lead_scores"
    ADD CONSTRAINT "lead_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_scores"
    ADD CONSTRAINT "lead_scores_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."logos_cases"
    ADD CONSTRAINT "logos_cases_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."logos_cases"
    ADD CONSTRAINT "logos_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logos_contacts"
    ADD CONSTRAINT "logos_contacts_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."logos_contacts"
    ADD CONSTRAINT "logos_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logos_notes"
    ADD CONSTRAINT "logos_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logos_projects"
    ADD CONSTRAINT "logos_projects_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."logos_projects"
    ADD CONSTRAINT "logos_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logos_pulse_activity"
    ADD CONSTRAINT "logos_pulse_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logos_pulse_mappings"
    ADD CONSTRAINT "logos_pulse_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logos_sync_logs"
    ADD CONSTRAINT "logos_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logos_tasks"
    ADD CONSTRAINT "logos_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_prep_cards"
    ADD CONSTRAINT "meeting_prep_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_prep_cards"
    ADD CONSTRAINT "meeting_prep_cards_user_id_calendar_event_id_key" UNIQUE ("user_id", "calendar_event_id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_channels"
    ADD CONSTRAINT "message_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_channels"
    ADD CONSTRAINT "message_channels_workspace_id_name_key" UNIQUE ("workspace_id", "name");



ALTER TABLE ONLY "public"."message_drafts"
    ADD CONSTRAINT "message_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_drafts"
    ADD CONSTRAINT "message_drafts_user_id_channel_id_key" UNIQUE ("user_id", "channel_id");



ALTER TABLE ONLY "public"."message_impact"
    ADD CONSTRAINT "message_impact_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."message_impact"
    ADD CONSTRAINT "message_impact_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_interactions"
    ADD CONSTRAINT "message_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_sync_state"
    ADD CONSTRAINT "message_sync_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_sync_state"
    ADD CONSTRAINT "message_sync_state_user_id_platform_channel_external_id_key" UNIQUE ("user_id", "platform", "channel_external_id");



ALTER TABLE ONLY "public"."message_translations"
    ADD CONSTRAINT "message_translations_message_id_user_id_target_language_key" UNIQUE ("message_id", "user_id", "target_language");



ALTER TABLE ONLY "public"."message_translations"
    ADD CONSTRAINT "message_translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_rules"
    ADD CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outcome_blockers"
    ADD CONSTRAINT "outcome_blockers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outcome_milestones"
    ADD CONSTRAINT "outcome_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outcomes"
    ADD CONSTRAINT "outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."predictions"
    ADD CONSTRAINT "predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_docs"
    ADD CONSTRAINT "project_docs_pkey" PRIMARY KEY ("project_id", "doc_id");



ALTER TABLE ONLY "public"."project_shares"
    ADD CONSTRAINT "project_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_shares"
    ADD CONSTRAINT "project_shares_public_link_key" UNIQUE ("public_link");



ALTER TABLE ONLY "public"."project_templates"
    ADD CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_blockers"
    ADD CONSTRAINT "pulse_blockers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_channel_subscriptions"
    ADD CONSTRAINT "pulse_channel_subscriptions_channel_id_subscriber_id_key" UNIQUE ("channel_id", "subscriber_id");



ALTER TABLE ONLY "public"."pulse_channel_subscriptions"
    ADD CONSTRAINT "pulse_channel_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_channels"
    ADD CONSTRAINT "pulse_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_context_summaries"
    ADD CONSTRAINT "pulse_context_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_conversations"
    ADD CONSTRAINT "pulse_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_decisions"
    ADD CONSTRAINT "pulse_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_files"
    ADD CONSTRAINT "pulse_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_follows"
    ADD CONSTRAINT "pulse_follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."pulse_follows"
    ADD CONSTRAINT "pulse_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_messages"
    ADD CONSTRAINT "pulse_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_notifications"
    ADD CONSTRAINT "pulse_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_nudges"
    ADD CONSTRAINT "pulse_nudges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_outcomes"
    ADD CONSTRAINT "pulse_outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_tasks"
    ADD CONSTRAINT "pulse_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_typing"
    ADD CONSTRAINT "pulse_typing_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."pulse_typing"
    ADD CONSTRAINT "pulse_typing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_users"
    ADD CONSTRAINT "pulse_users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."pulse_users"
    ADD CONSTRAINT "pulse_users_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."pulse_users"
    ADD CONSTRAINT "pulse_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_vox_favorites"
    ADD CONSTRAINT "quick_vox_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_vox_messages"
    ADD CONSTRAINT "quick_vox_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_vox_status"
    ADD CONSTRAINT "quick_vox_status_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."relationship_alerts"
    ADD CONSTRAINT "relationship_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationship_events"
    ADD CONSTRAINT "relationship_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationship_milestones"
    ADD CONSTRAINT "relationship_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationship_profiles"
    ADD CONSTRAINT "relationship_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationship_profiles"
    ADD CONSTRAINT "relationship_profiles_user_id_contact_email_key" UNIQUE ("user_id", "contact_email");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_unique_edge" UNIQUE ("source_type", "source_id", "target_type", "target_id", "relationship_type");



ALTER TABLE ONLY "public"."reserved_handles"
    ADD CONSTRAINT "reserved_handles_pkey" PRIMARY KEY ("handle");



ALTER TABLE ONLY "public"."retention_policies"
    ADD CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."retention_policies"
    ADD CONSTRAINT "retention_policies_unique_per_tenant" UNIQUE ("tenant_id", "resource_type");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_unique_name_per_tenant" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_clipboard"
    ADD CONSTRAINT "search_clipboard_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_documents"
    ADD CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_documents"
    ADD CONSTRAINT "search_documents_unique_chunk" UNIQUE ("source_type", "source_id", "chunk_index");



ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_user_id_query_key" UNIQUE ("user_id", "query");



ALTER TABLE ONLY "public"."search_index"
    ADD CONSTRAINT "search_index_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_docs"
    ADD CONSTRAINT "session_docs_pkey" PRIMARY KEY ("session_id", "doc_id");



ALTER TABLE ONLY "public"."share_invites"
    ADD CONSTRAINT "share_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."share_invites"
    ADD CONSTRAINT "share_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."slack_channels"
    ADD CONSTRAINT "slack_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_contact_groups"
    ADD CONSTRAINT "smart_contact_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_contact_groups"
    ADD CONSTRAINT "smart_contact_groups_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."smart_folders"
    ADD CONSTRAINT "smart_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_groups"
    ADD CONSTRAINT "smart_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_suggestions_cache"
    ADD CONSTRAINT "smart_suggestions_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smart_suggestions_cache"
    ADD CONSTRAINT "smart_suggestions_cache_user_id_conversation_id_context_has_key" UNIQUE ("user_id", "conversation_id", "context_hash");



ALTER TABLE ONLY "public"."sms_conversations"
    ADD CONSTRAINT "sms_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snoozed_emails"
    ADD CONSTRAINT "snoozed_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sso_configs"
    ADD CONSTRAINT "sso_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sso_configs"
    ADD CONSTRAINT "sso_configs_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."sso_sessions"
    ADD CONSTRAINT "sso_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_depends_on_task_id_key" UNIQUE ("task_id", "depends_on_task_id");



ALTER TABLE ONLY "public"."task_updates"
    ADD CONSTRAINT "task_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_member_type_member_id_key" UNIQUE ("team_id", "member_type", "member_id");



ALTER TABLE ONLY "public"."team_vox_messages"
    ADD CONSTRAINT "team_vox_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_matrix_results"
    ADD CONSTRAINT "test_matrix_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_actions"
    ADD CONSTRAINT "thread_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_actions"
    ADD CONSTRAINT "thread_actions_user_id_conversation_id_key" UNIQUE ("user_id", "conversation_id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unified_messages"
    ADD CONSTRAINT "unified_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_matrix_results"
    ADD CONSTRAINT "unique_test_per_user" UNIQUE ("test_id", "user_id");



ALTER TABLE ONLY "public"."vacation_responder"
    ADD CONSTRAINT "unique_vacation_responder_per_user" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."user_contact_annotations"
    ADD CONSTRAINT "user_contact_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_contact_annotations"
    ADD CONSTRAINT "user_contact_annotations_user_id_target_user_id_key" UNIQUE ("user_id", "target_user_id");



ALTER TABLE ONLY "public"."user_message_statistics"
    ADD CONSTRAINT "user_message_statistics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_message_statistics"
    ADD CONSTRAINT "user_message_statistics_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_retention_cohorts"
    ADD CONSTRAINT "user_retention_cohorts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_retention_cohorts"
    ADD CONSTRAINT "user_retention_cohorts_user_id_cohort_date_key" UNIQUE ("user_id", "cohort_date");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_unique_assignment" UNIQUE ("tenant_id", "user_id", "role_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_teams"
    ADD CONSTRAINT "user_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_teams"
    ADD CONSTRAINT "user_teams_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vacation_responder_log"
    ADD CONSTRAINT "vacation_responder_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vacation_responder"
    ADD CONSTRAINT "vacation_responder_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_vox_ai_queue"
    ADD CONSTRAINT "video_vox_ai_queue_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."video_vox_ai_queue"
    ADD CONSTRAINT "video_vox_ai_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_vox_bookmarks"
    ADD CONSTRAINT "video_vox_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_vox_bookmarks"
    ADD CONSTRAINT "video_vox_bookmarks_user_id_message_id_key" UNIQUE ("user_id", "message_id");



ALTER TABLE ONLY "public"."video_vox_conversation_members"
    ADD CONSTRAINT "video_vox_conversation_members_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."video_vox_conversation_members"
    ADD CONSTRAINT "video_vox_conversation_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_vox_conversations"
    ADD CONSTRAINT "video_vox_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_vox_messages"
    ADD CONSTRAINT "video_vox_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_vox_reactions"
    ADD CONSTRAINT "video_vox_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."video_vox_reactions"
    ADD CONSTRAINT "video_vox_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_vox_read_receipts"
    ADD CONSTRAINT "video_vox_read_receipts_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."video_vox_read_receipts"
    ADD CONSTRAINT "video_vox_read_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_message_bookmarks"
    ADD CONSTRAINT "voice_message_bookmarks_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."voice_message_bookmarks"
    ADD CONSTRAINT "voice_message_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_message_reactions"
    ADD CONSTRAINT "voice_message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."voice_message_reactions"
    ADD CONSTRAINT "voice_message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_thread_messages"
    ADD CONSTRAINT "voice_thread_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_thread_participants"
    ADD CONSTRAINT "voice_thread_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_thread_participants"
    ADD CONSTRAINT "voice_thread_participants_thread_id_user_id_key" UNIQUE ("thread_id", "user_id");



ALTER TABLE ONLY "public"."voice_thread_tags"
    ADD CONSTRAINT "voice_thread_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_thread_tags"
    ADD CONSTRAINT "voice_thread_tags_thread_id_tag_key" UNIQUE ("thread_id", "tag");



ALTER TABLE ONLY "public"."voice_threads"
    ADD CONSTRAINT "voice_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vox_drops"
    ADD CONSTRAINT "vox_drops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vox_notes"
    ADD CONSTRAINT "vox_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vox_notifications"
    ADD CONSTRAINT "vox_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vox_team_channels"
    ADD CONSTRAINT "vox_team_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vox_workspaces"
    ADD CONSTRAINT "vox_workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voxer_recordings"
    ADD CONSTRAINT "voxer_recordings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhooks"
    ADD CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_outcomes"
    ADD CONSTRAINT "workspace_outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_participants"
    ADD CONSTRAINT "workspace_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_participants"
    ADD CONSTRAINT "workspace_participants_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("workspace_id");



CREATE INDEX "idx_action_items_assigned_to" ON "public"."action_items" USING "btree" ("assigned_to_id");



CREATE INDEX "idx_action_items_crm_sync" ON "public"."action_items" USING "btree" ("crm_sync_status");



CREATE INDEX "idx_action_items_meeting" ON "public"."action_items" USING "btree" ("meeting_id");



CREATE INDEX "idx_action_items_status" ON "public"."action_items" USING "btree" ("status");



CREATE INDEX "idx_activity_created" ON "public"."activity_feed" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_doc" ON "public"."activity_feed" USING "btree" ("doc_id");



CREATE INDEX "idx_activity_feed_created" ON "public"."activity_feed" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_feed_project" ON "public"."activity_feed" USING "btree" ("project_id") WHERE ("project_id" IS NOT NULL);



CREATE INDEX "idx_activity_feed_user" ON "public"."activity_feed" USING "btree" ("user_id");



CREATE INDEX "idx_activity_logos" ON "public"."logos_pulse_activity" USING "btree" ("logos_entity_type", "logos_entity_id");



CREATE INDEX "idx_activity_logs_actor" ON "public"."admin_activity_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_activity_logs_created" ON "public"."admin_activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_project" ON "public"."activity_feed" USING "btree" ("project_id");



CREATE INDEX "idx_activity_pulse" ON "public"."logos_pulse_activity" USING "btree" ("pulse_channel_id", "pulse_user_id");



CREATE INDEX "idx_activity_unread" ON "public"."activity_feed" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_activity_user" ON "public"."activity_feed" USING "btree" ("user_id");



CREATE INDEX "idx_agent_logs_agent" ON "public"."agent_execution_logs" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_logs_created" ON "public"."agent_execution_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_agent_logs_type" ON "public"."agent_execution_logs" USING "btree" ("agent_type");



CREATE INDEX "idx_agent_run_steps_run_id" ON "public"."agent_run_steps" USING "btree" ("agent_run_id");



CREATE INDEX "idx_agent_run_steps_run_id_index" ON "public"."agent_run_steps" USING "btree" ("agent_run_id", "step_index");



CREATE INDEX "idx_agent_runs_agent_id" ON "public"."agent_runs" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_runs_idempotency" ON "public"."agent_runs" USING "btree" ("agent_id", "trigger_event_id", "status");



CREATE INDEX "idx_agent_runs_started_at" ON "public"."agent_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_agent_runs_status" ON "public"."agent_runs" USING "btree" ("status");



CREATE INDEX "idx_agent_runs_trigger_event_id" ON "public"."agent_runs" USING "btree" ("trigger_event_id");



CREATE INDEX "idx_agents_created_at" ON "public"."agents" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_agents_enabled" ON "public"."agents" USING "btree" ("enabled");



CREATE INDEX "idx_agents_trigger_type" ON "public"."agents" USING "btree" ("trigger_type");



CREATE INDEX "idx_ai_agents_enabled" ON "public"."ai_agents" USING "btree" ("enabled");



CREATE INDEX "idx_ai_agents_type" ON "public"."ai_agents" USING "btree" ("agent_type");



CREATE INDEX "idx_ai_agents_user" ON "public"."ai_agents" USING "btree" ("user_id");



CREATE INDEX "idx_ai_messages_created" ON "public"."ai_messages" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_ai_messages_session" ON "public"."ai_messages" USING "btree" ("session_id");



CREATE INDEX "idx_ai_projects_updated" ON "public"."ai_projects" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_ai_projects_user" ON "public"."ai_projects" USING "btree" ("user_id");



CREATE INDEX "idx_ai_sessions_project" ON "public"."ai_sessions" USING "btree" ("project_id") WHERE ("project_id" IS NOT NULL);



CREATE INDEX "idx_ai_sessions_updated" ON "public"."ai_sessions" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_ai_sessions_user" ON "public"."ai_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_analytics_contact_score" ON "public"."analytics_contact_engagement" USING "btree" ("user_id", "engagement_score" DESC);



CREATE INDEX "idx_analytics_contact_user" ON "public"."analytics_contact_engagement" USING "btree" ("user_id");



CREATE INDEX "idx_analytics_daily_user_date" ON "public"."analytics_daily_metrics" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_analytics_period_user" ON "public"."analytics_period_summary" USING "btree" ("user_id", "period_type", "period_start" DESC);



CREATE INDEX "idx_analytics_response_contact" ON "public"."analytics_response_times" USING "btree" ("user_id", "contact_identifier");



CREATE INDEX "idx_analytics_response_user" ON "public"."analytics_response_times" USING "btree" ("user_id", "incoming_at" DESC);



CREATE INDEX "idx_annotations_doc" ON "public"."doc_annotations" USING "btree" ("doc_id");



CREATE INDEX "idx_annotations_resolved" ON "public"."doc_annotations" USING "btree" ("resolved");



CREATE INDEX "idx_annotations_type" ON "public"."doc_annotations" USING "btree" ("type");



CREATE INDEX "idx_annotations_user" ON "public"."doc_annotations" USING "btree" ("user_id");



CREATE INDEX "idx_api_keys_active" ON "public"."api_keys" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_api_keys_key_prefix" ON "public"."api_keys" USING "btree" ("key_prefix");



CREATE INDEX "idx_api_keys_user_id" ON "public"."api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_api_rate_limits_key_window" ON "public"."api_rate_limits" USING "btree" ("api_key_id", "window_start");



CREATE INDEX "idx_api_request_logs_created" ON "public"."api_request_logs" USING "btree" ("created_at");



CREATE INDEX "idx_api_request_logs_key_id" ON "public"."api_request_logs" USING "btree" ("api_key_id");



CREATE INDEX "idx_api_request_logs_user_id" ON "public"."api_request_logs" USING "btree" ("user_id");



CREATE INDEX "idx_archive_collections_pinned" ON "public"."archive_collections" USING "btree" ("pinned_at") WHERE ("pinned_at" IS NOT NULL);



CREATE INDEX "idx_archive_collections_user_id" ON "public"."archive_collections" USING "btree" ("user_id");



CREATE INDEX "idx_archive_shares_archive_id" ON "public"."archive_shares" USING "btree" ("archive_id");



CREATE INDEX "idx_archive_shares_shared_with" ON "public"."archive_shares" USING "btree" ("shared_with");



CREATE INDEX "idx_archives_ai_tags" ON "public"."archives" USING "gin" ("ai_tags");



CREATE INDEX "idx_archives_collection_id" ON "public"."archives" USING "btree" ("collection_id");



CREATE INDEX "idx_archives_drive_file_id" ON "public"."archives" USING "btree" ("drive_file_id") WHERE ("drive_file_id" IS NOT NULL);



CREATE INDEX "idx_archives_pinned" ON "public"."archives" USING "btree" ("pinned_at") WHERE ("pinned_at" IS NOT NULL);



CREATE INDEX "idx_archives_search_vector" ON "public"."archives" USING "gin" ("search_vector");



CREATE INDEX "idx_archives_starred" ON "public"."archives" USING "btree" ("starred") WHERE ("starred" = true);



CREATE INDEX "idx_archives_type" ON "public"."archives" USING "btree" ("archive_type");



CREATE INDEX "idx_archives_user_id" ON "public"."archives" USING "btree" ("user_id");



CREATE INDEX "idx_archives_visibility" ON "public"."archives" USING "btree" ("visibility");



CREATE INDEX "idx_attention_logs_event_type" ON "public"."attention_logs" USING "btree" ("user_id", "event_type", "created_at" DESC);



CREATE INDEX "idx_attention_logs_user_date" ON "public"."attention_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "idx_audit_logs_category" ON "public"."audit_logs" USING "btree" ("category", "created_at" DESC);



CREATE INDEX "idx_audit_logs_created" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_resource" ON "public"."audit_logs" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "idx_audit_logs_status" ON "public"."audit_logs" USING "btree" ("status") WHERE ("status" <> 'success'::"text");



CREATE INDEX "idx_audit_logs_tenant_time" ON "public"."audit_logs" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_automation_logs_automation" ON "public"."automation_logs" USING "btree" ("automation_id");



CREATE INDEX "idx_automation_logs_created" ON "public"."automation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_automation_logs_success" ON "public"."automation_logs" USING "btree" ("success");



CREATE INDEX "idx_automations_enabled" ON "public"."automations" USING "btree" ("enabled");



CREATE INDEX "idx_automations_team_id" ON "public"."automations" USING "btree" ("team_id");



CREATE INDEX "idx_automations_trigger" ON "public"."automations" USING "btree" ("trigger_type");



CREATE INDEX "idx_automations_user" ON "public"."automations" USING "btree" ("user_id");



CREATE INDEX "idx_blocked_senders_domain" ON "public"."blocked_senders" USING "btree" ("lower"("domain"));



CREATE INDEX "idx_blocked_senders_email" ON "public"."blocked_senders" USING "btree" ("lower"("email_address"));



CREATE UNIQUE INDEX "idx_blocked_senders_unique_domain" ON "public"."blocked_senders" USING "btree" ("user_id", "lower"("domain")) WHERE ("domain" IS NOT NULL);



CREATE UNIQUE INDEX "idx_blocked_senders_unique_email" ON "public"."blocked_senders" USING "btree" ("user_id", "lower"("email_address")) WHERE ("email_address" IS NOT NULL);



CREATE INDEX "idx_blocked_senders_user" ON "public"."blocked_senders" USING "btree" ("user_id");



CREATE INDEX "idx_blockers_outcome" ON "public"."outcome_blockers" USING "btree" ("outcome_id");



CREATE INDEX "idx_blockers_status" ON "public"."outcome_blockers" USING "btree" ("status");



CREATE INDEX "idx_blockers_workspace" ON "public"."outcome_blockers" USING "btree" ("workspace_id");



CREATE INDEX "idx_broadcasts_channel" ON "public"."broadcasts" USING "btree" ("channel_id");



CREATE INDEX "idx_broadcasts_published" ON "public"."broadcasts" USING "btree" ("published_at" DESC);



CREATE INDEX "idx_cached_emails_ai_category" ON "public"."cached_emails" USING "btree" ("ai_category");



CREATE INDEX "idx_cached_emails_ai_priority" ON "public"."cached_emails" USING "btree" ("ai_priority_score" DESC);



CREATE INDEX "idx_cached_emails_gmail_id" ON "public"."cached_emails" USING "btree" ("gmail_id");



CREATE INDEX "idx_cached_emails_labels" ON "public"."cached_emails" USING "gin" ("labels");



CREATE INDEX "idx_cached_emails_received_at" ON "public"."cached_emails" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_cached_emails_thread_id" ON "public"."cached_emails" USING "btree" ("thread_id");



CREATE INDEX "idx_cached_emails_user_id" ON "public"."cached_emails" USING "btree" ("user_id");



CREATE INDEX "idx_calendar_events_start" ON "public"."calendar_events" USING "btree" ("start_time");



CREATE INDEX "idx_calendar_events_user_id" ON "public"."calendar_events" USING "btree" ("user_id");



CREATE INDEX "idx_calendar_events_user_start" ON "public"."calendar_events" USING "btree" ("user_id", "start_time" DESC);



CREATE INDEX "idx_channels_external_id" ON "public"."channels" USING "btree" ("external_id");



CREATE INDEX "idx_channels_user_platform" ON "public"."channels" USING "btree" ("user_id", "platform");



CREATE INDEX "idx_coaching_keywords_active" ON "public"."coaching_keywords" USING "btree" ("is_active", "category");



CREATE INDEX "idx_coaching_keywords_category" ON "public"."coaching_keywords" USING "btree" ("category") WHERE ("is_active" = true);



CREATE INDEX "idx_coaching_prompts_priority" ON "public"."coaching_prompts" USING "btree" ("priority") WHERE (("used_at" IS NULL) AND ("dismissed_at" IS NULL));



CREATE INDEX "idx_coaching_prompts_session" ON "public"."coaching_prompts" USING "btree" ("session_id", "shown_at" DESC);



CREATE INDEX "idx_coaching_prompts_type" ON "public"."coaching_prompts" USING "btree" ("prompt_type");



CREATE INDEX "idx_coaching_sessions_active" ON "public"."coaching_sessions" USING "btree" ("started_at" DESC) WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_coaching_sessions_deal" ON "public"."coaching_sessions" USING "btree" ("deal_id") WHERE ("deal_id" IS NOT NULL);



CREATE INDEX "idx_coaching_sessions_meeting" ON "public"."coaching_sessions" USING "btree" ("meeting_id");



CREATE INDEX "idx_coaching_sessions_user" ON "public"."coaching_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_cohorts_date" ON "public"."user_retention_cohorts" USING "btree" ("cohort_date");



CREATE INDEX "idx_cohorts_user" ON "public"."user_retention_cohorts" USING "btree" ("user_id");



CREATE INDEX "idx_collection_docs_collection" ON "public"."collection_docs" USING "btree" ("collection_id");



CREATE INDEX "idx_collection_docs_doc" ON "public"."collection_docs" USING "btree" ("doc_id");



CREATE INDEX "idx_collections_type" ON "public"."document_collections" USING "btree" ("type");



CREATE INDEX "idx_collections_user" ON "public"."document_collections" USING "btree" ("user_id");



CREATE INDEX "idx_contact_interactions_date" ON "public"."contact_interactions" USING "btree" ("interaction_date" DESC);



CREATE INDEX "idx_contact_interactions_profile_id" ON "public"."contact_interactions" USING "btree" ("profile_id");



CREATE INDEX "idx_contact_interactions_sentiment" ON "public"."contact_interactions" USING "btree" ("sentiment_label");



CREATE INDEX "idx_contact_interactions_source" ON "public"."contact_interactions" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_contact_interactions_thread" ON "public"."contact_interactions" USING "btree" ("thread_id");



CREATE INDEX "idx_contact_interactions_type" ON "public"."contact_interactions" USING "btree" ("interaction_type");



CREATE INDEX "idx_contact_interactions_user_id" ON "public"."contact_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_contacts_email" ON "public"."contacts" USING "btree" ("email");



CREATE INDEX "idx_contacts_email_gin" ON "public"."contacts" USING "gin" ("email" "public"."gin_trgm_ops");



CREATE INDEX "idx_contacts_external_id" ON "public"."contacts" USING "btree" ("external_id");



CREATE INDEX "idx_contacts_name_gin" ON "public"."contacts" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_contacts_user_id" ON "public"."contacts" USING "btree" ("user_id");



CREATE INDEX "idx_contacts_user_platform" ON "public"."contacts" USING "btree" ("user_id", "platform");



CREATE INDEX "idx_contacts_user_updated" ON "public"."contacts" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_conv_messages_conversation" ON "public"."conversation_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_conv_messages_created" ON "public"."conversation_messages" USING "btree" ("created_at");



CREATE INDEX "idx_conversation_health_score" ON "public"."conversation_health" USING "btree" ("health_score" DESC);



CREATE INDEX "idx_conversation_health_user" ON "public"."conversation_health" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_memory_dna" ON "public"."conversation_memory" USING "btree" ("dna_hash");



CREATE INDEX "idx_conversation_memory_user" ON "public"."conversation_memory" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_started" ON "public"."conversations" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_conversations_user" ON "public"."conversations" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_crm_action_crm" ON "public"."crm_actions" USING "btree" ("crm_id");



CREATE INDEX "idx_crm_action_status" ON "public"."crm_actions" USING "btree" ("status");



CREATE INDEX "idx_crm_action_type" ON "public"."crm_actions" USING "btree" ("action_type");



CREATE UNIQUE INDEX "idx_crm_company_external" ON "public"."crm_companies" USING "btree" ("crm_id", "external_id");



CREATE INDEX "idx_crm_company_name" ON "public"."crm_companies" USING "btree" ("name");



CREATE INDEX "idx_crm_contact_company" ON "public"."crm_contacts" USING "btree" ("company_id");



CREATE INDEX "idx_crm_contact_email" ON "public"."crm_contacts" USING "btree" ("email");



CREATE UNIQUE INDEX "idx_crm_contact_external" ON "public"."crm_contacts" USING "btree" ("crm_id", "external_id");



CREATE INDEX "idx_crm_contact_pulse_user" ON "public"."crm_contacts" USING "btree" ("pulse_user_id");



CREATE INDEX "idx_crm_deal_company" ON "public"."crm_deals" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_crm_deal_external" ON "public"."crm_deals" USING "btree" ("crm_id", "external_id");



CREATE INDEX "idx_crm_deal_linked_chat" ON "public"."crm_deals" USING "btree" ("linked_chat_id");



CREATE INDEX "idx_crm_deal_owner" ON "public"."crm_deals" USING "btree" ("owner_id");



CREATE INDEX "idx_crm_deal_stage" ON "public"."crm_deals" USING "btree" ("deal_stage");



CREATE INDEX "idx_crm_platform" ON "public"."crm_integrations" USING "btree" ("platform");



CREATE INDEX "idx_crm_sync_log_created_at" ON "public"."crm_sync_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_crm_sync_log_entity" ON "public"."crm_sync_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_crm_sync_log_status" ON "public"."crm_sync_log" USING "btree" ("sync_status");



CREATE INDEX "idx_crm_workspace" ON "public"."crm_integrations" USING "btree" ("workspace_id");



CREATE INDEX "idx_custom_labels_gmail" ON "public"."custom_labels" USING "btree" ("gmail_label_id") WHERE ("gmail_label_id" IS NOT NULL);



CREATE INDEX "idx_custom_labels_parent" ON "public"."custom_labels" USING "btree" ("parent_label_id") WHERE ("parent_label_id" IS NOT NULL);



CREATE INDEX "idx_custom_labels_system" ON "public"."custom_labels" USING "btree" ("user_id", "is_system") WHERE ("is_system" = true);



CREATE INDEX "idx_custom_labels_user_id" ON "public"."custom_labels" USING "btree" ("user_id");



CREATE INDEX "idx_customer_alerts_active" ON "public"."customer_alerts" USING "btree" ("customer_id", "alert_type") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_customer_alerts_created" ON "public"."customer_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_customer_alerts_customer" ON "public"."customer_alerts" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_customer_alerts_severity" ON "public"."customer_alerts" USING "btree" ("severity", "created_at" DESC) WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_customer_alerts_type" ON "public"."customer_alerts" USING "btree" ("alert_type", "created_at" DESC);



CREATE INDEX "idx_customer_alerts_unacknowledged" ON "public"."customer_alerts" USING "btree" ("created_at" DESC) WHERE (("acknowledged_at" IS NULL) AND ("resolved_at" IS NULL));



CREATE INDEX "idx_customer_health_at_risk" ON "public"."customer_health" USING "btree" ("health_score") WHERE ("health_label" = ANY (ARRAY['at_risk'::"text", 'critical'::"text"]));



CREATE INDEX "idx_customer_health_calculated" ON "public"."customer_health" USING "btree" ("calculated_at" DESC);



CREATE INDEX "idx_customer_health_history_customer" ON "public"."customer_health_history" USING "btree" ("customer_id", "recorded_at" DESC);



CREATE INDEX "idx_customer_health_history_recorded" ON "public"."customer_health_history" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_customer_health_label" ON "public"."customer_health" USING "btree" ("health_label");



CREATE INDEX "idx_customer_health_score" ON "public"."customer_health" USING "btree" ("health_score" DESC);



CREATE INDEX "idx_customer_health_trend" ON "public"."customer_health" USING "btree" ("sentiment_trend");



CREATE INDEX "idx_customer_sentiment_customer" ON "public"."customer_sentiment" USING "btree" ("customer_id", "analyzed_at" DESC);



CREATE INDEX "idx_customer_sentiment_label" ON "public"."customer_sentiment" USING "btree" ("sentiment_label", "analyzed_at" DESC);



CREATE INDEX "idx_customer_sentiment_recent" ON "public"."customer_sentiment" USING "btree" ("analyzed_at" DESC);



CREATE INDEX "idx_customer_sentiment_score" ON "public"."customer_sentiment" USING "btree" ("sentiment_score");



CREATE INDEX "idx_customer_sentiment_source" ON "public"."customer_sentiment" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_decision_votes_decision" ON "public"."decision_votes" USING "btree" ("decision_id");



CREATE INDEX "idx_decisions_channel" ON "public"."pulse_decisions" USING "btree" ("channel_id");



CREATE INDEX "idx_decisions_status" ON "public"."decisions" USING "btree" ("status");



CREATE INDEX "idx_decisions_workspace" ON "public"."decisions" USING "btree" ("workspace_id");



CREATE INDEX "idx_deliveries_status" ON "public"."webhook_deliveries" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'retrying'::"text"]));



CREATE INDEX "idx_deliveries_webhook" ON "public"."webhook_deliveries" USING "btree" ("webhook_id", "triggered_at" DESC);



CREATE INDEX "idx_doc_annotations_doc_user" ON "public"."doc_annotations" USING "btree" ("doc_id", "user_id");



CREATE INDEX "idx_doc_annotations_unresolved" ON "public"."doc_annotations" USING "btree" ("doc_id") WHERE ("resolved" = false);



CREATE INDEX "idx_doc_embeddings_chunk" ON "public"."doc_embeddings" USING "btree" ("doc_id", "chunk_index");



CREATE INDEX "idx_doc_embeddings_doc" ON "public"."doc_embeddings" USING "btree" ("doc_id");



CREATE INDEX "idx_doc_embeddings_embedding" ON "public"."doc_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_doc_favorites_user" ON "public"."doc_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_doc_highlights_doc_user" ON "public"."doc_highlights" USING "btree" ("doc_id", "user_id");



CREATE INDEX "idx_doc_recent_views_user" ON "public"."doc_recent_views" USING "btree" ("user_id");



CREATE INDEX "idx_doc_recent_views_viewed" ON "public"."doc_recent_views" USING "btree" ("user_id", "viewed_at" DESC);



CREATE INDEX "idx_doc_shares_doc" ON "public"."document_shares" USING "btree" ("doc_id");



CREATE INDEX "idx_doc_shares_public_link" ON "public"."document_shares" USING "btree" ("public_link");



CREATE INDEX "idx_doc_shares_shared_by" ON "public"."document_shares" USING "btree" ("shared_by");



CREATE INDEX "idx_doc_shares_shared_with_email" ON "public"."document_shares" USING "btree" ("shared_with_email");



CREATE INDEX "idx_doc_shares_shared_with_user" ON "public"."document_shares" USING "btree" ("shared_with_user");



CREATE INDEX "idx_doc_tags_doc" ON "public"."doc_tags" USING "btree" ("doc_id");



CREATE INDEX "idx_doc_tags_tag" ON "public"."doc_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_document_shares_public_link" ON "public"."document_shares" USING "btree" ("public_link") WHERE ("public_link" IS NOT NULL);



CREATE INDEX "idx_document_shares_shared_with" ON "public"."document_shares" USING "btree" ("shared_with_user");



CREATE INDEX "idx_document_tags_user" ON "public"."document_tags" USING "btree" ("user_id");



CREATE INDEX "idx_duplicate_contacts_group_id" ON "public"."duplicate_contacts" USING "btree" ("group_id");



CREATE INDEX "idx_duplicate_contacts_pending" ON "public"."duplicate_contacts" USING "btree" ("user_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_duplicate_contacts_profile_id" ON "public"."duplicate_contacts" USING "btree" ("profile_id");



CREATE INDEX "idx_duplicate_contacts_status" ON "public"."duplicate_contacts" USING "btree" ("status");



CREATE INDEX "idx_duplicate_contacts_user_id" ON "public"."duplicate_contacts" USING "btree" ("user_id");



CREATE INDEX "idx_email_contacts_email" ON "public"."email_contacts" USING "btree" ("email");



CREATE INDEX "idx_email_contacts_relationship" ON "public"."email_contacts" USING "btree" ("relationship_strength" DESC);



CREATE INDEX "idx_email_contacts_user_id" ON "public"."email_contacts" USING "btree" ("user_id");



CREATE INDEX "idx_email_daily_briefings_user_date" ON "public"."email_daily_briefings" USING "btree" ("user_id", "briefing_date" DESC);



CREATE INDEX "idx_email_follow_ups_status" ON "public"."email_follow_ups" USING "btree" ("status");



CREATE INDEX "idx_email_follow_ups_suggested_date" ON "public"."email_follow_ups" USING "btree" ("suggested_follow_up_date");



CREATE INDEX "idx_email_follow_ups_user_id" ON "public"."email_follow_ups" USING "btree" ("user_id");



CREATE INDEX "idx_email_labels_composite" ON "public"."email_labels" USING "btree" ("label_id", "email_id");



CREATE INDEX "idx_email_labels_email" ON "public"."email_labels" USING "btree" ("email_id");



CREATE INDEX "idx_email_labels_label" ON "public"."email_labels" USING "btree" ("label_id");



CREATE INDEX "idx_email_sync_state_user_id" ON "public"."email_sync_state" USING "btree" ("user_id");



CREATE INDEX "idx_email_templates_category" ON "public"."email_templates" USING "btree" ("category");



CREATE INDEX "idx_email_templates_user_id" ON "public"."email_templates" USING "btree" ("user_id");



CREATE INDEX "idx_email_threads_last_message" ON "public"."email_threads" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_email_threads_user_id" ON "public"."email_threads" USING "btree" ("user_id");



CREATE INDEX "idx_emails_body_gin" ON "public"."emails" USING "gin" ("body" "public"."gin_trgm_ops");



CREATE INDEX "idx_emails_date" ON "public"."emails" USING "btree" ("date");



CREATE INDEX "idx_emails_folder" ON "public"."emails" USING "btree" ("folder");



CREATE INDEX "idx_emails_subject_gin" ON "public"."emails" USING "gin" ("subject" "public"."gin_trgm_ops");



CREATE INDEX "idx_emails_user_date" ON "public"."emails" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_emails_user_id" ON "public"."emails" USING "btree" ("user_id");



CREATE INDEX "idx_embeddings_source" ON "public"."embeddings" USING "btree" ("source_id", "source_type");



CREATE INDEX "idx_entomate_action_items_assigned" ON "public"."entomate_action_items" USING "btree" ("assigned_to_user_id");



CREATE INDEX "idx_entomate_action_items_meeting" ON "public"."entomate_action_items" USING "btree" ("meeting_id");



CREATE INDEX "idx_entomate_action_items_status" ON "public"."entomate_action_items" USING "btree" ("status");



CREATE INDEX "idx_entomate_automations_active" ON "public"."entomate_automations" USING "btree" ("is_active");



CREATE INDEX "idx_entomate_meetings_channel" ON "public"."entomate_meetings" USING "btree" ("pulse_channel_id");



CREATE INDEX "idx_entomate_meetings_created_at" ON "public"."entomate_meetings" USING "btree" ("created_at");



CREATE INDEX "idx_entomate_meetings_created_by" ON "public"."entomate_meetings" USING "btree" ("created_by");



CREATE INDEX "idx_entomate_project_tasks_assigned" ON "public"."entomate_project_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_entomate_project_tasks_project" ON "public"."entomate_project_tasks" USING "btree" ("project_id");



CREATE INDEX "idx_entomate_projects_owner" ON "public"."entomate_projects" USING "btree" ("owner_id");



CREATE INDEX "idx_entomate_projects_status" ON "public"."entomate_projects" USING "btree" ("status");



CREATE INDEX "idx_favorites_user" ON "public"."doc_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_field_mappings_integration" ON "public"."integration_field_mappings" USING "btree" ("integration_id");



CREATE INDEX "idx_files_channel" ON "public"."pulse_files" USING "btree" ("channel_id");



CREATE INDEX "idx_focus_sessions_user_status" ON "public"."focus_sessions" USING "btree" ("user_id", "status", "started_at" DESC);



CREATE INDEX "idx_goals_owner" ON "public"."goals" USING "btree" ("owner_id");



CREATE INDEX "idx_goals_parent" ON "public"."goals" USING "btree" ("parent_goal_id");



CREATE INDEX "idx_goals_quarter" ON "public"."goals" USING "btree" ("quarter");



CREATE INDEX "idx_goals_status" ON "public"."goals" USING "btree" ("status");



CREATE INDEX "idx_goals_type" ON "public"."goals" USING "btree" ("goal_type");



CREATE INDEX "idx_highlights_created" ON "public"."doc_highlights" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_highlights_doc" ON "public"."doc_highlights" USING "btree" ("doc_id");



CREATE INDEX "idx_highlights_user" ON "public"."doc_highlights" USING "btree" ("user_id");



CREATE INDEX "idx_integrations_active" ON "public"."integrations" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_integrations_type" ON "public"."integrations" USING "btree" ("integration_type");



CREATE INDEX "idx_interactions_message" ON "public"."message_interactions" USING "btree" ("message_id");



CREATE INDEX "idx_interactions_shown" ON "public"."message_interactions" USING "btree" ("shown_at");



CREATE INDEX "idx_interactions_user" ON "public"."message_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_invites_email" ON "public"."share_invites" USING "btree" ("email");



CREATE INDEX "idx_invites_resource" ON "public"."share_invites" USING "btree" ("invite_type", "resource_id");



CREATE INDEX "idx_invites_token" ON "public"."share_invites" USING "btree" ("token");



CREATE INDEX "idx_key_results_outcome_id" ON "public"."key_results" USING "btree" ("outcome_id");



CREATE INDEX "idx_knowledge_docs_created" ON "public"."knowledge_docs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_knowledge_docs_file_type" ON "public"."knowledge_docs" USING "btree" ("file_type");



CREATE INDEX "idx_knowledge_docs_processing" ON "public"."knowledge_docs" USING "btree" ("processing_status") WHERE ("processing_status" IS NOT NULL);



CREATE INDEX "idx_knowledge_docs_text_search" ON "public"."knowledge_docs" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("text_content", ''::"text") || ' '::"text") || COALESCE("ai_summary", ''::"text"))));



CREATE INDEX "idx_knowledge_docs_user" ON "public"."knowledge_docs" USING "btree" ("user_id");



CREATE INDEX "idx_lead_scores_grade" ON "public"."lead_scores" USING "btree" ("lead_grade");



CREATE INDEX "idx_lead_scores_hot" ON "public"."lead_scores" USING "btree" ("user_id", "lead_status") WHERE ("lead_status" = ANY (ARRAY['warm'::"text", 'hot'::"text"]));



CREATE INDEX "idx_lead_scores_profile_id" ON "public"."lead_scores" USING "btree" ("profile_id");



CREATE INDEX "idx_lead_scores_score" ON "public"."lead_scores" USING "btree" ("lead_score" DESC);



CREATE INDEX "idx_lead_scores_stage" ON "public"."lead_scores" USING "btree" ("pipeline_stage");



CREATE INDEX "idx_lead_scores_status" ON "public"."lead_scores" USING "btree" ("lead_status");



CREATE INDEX "idx_lead_scores_user_id" ON "public"."lead_scores" USING "btree" ("user_id");



CREATE INDEX "idx_logos_cases_contact" ON "public"."logos_cases" USING "btree" ("contact_id");



CREATE INDEX "idx_logos_cases_project" ON "public"."logos_cases" USING "btree" ("project_id");



CREATE INDEX "idx_logos_contacts_email" ON "public"."logos_contacts" USING "btree" ("email");



CREATE INDEX "idx_logos_notes_case" ON "public"."logos_notes" USING "btree" ("case_id");



CREATE INDEX "idx_logos_projects_client" ON "public"."logos_projects" USING "btree" ("client_id");



CREATE INDEX "idx_logos_projects_owner" ON "public"."logos_projects" USING "btree" ("owner_id");



CREATE INDEX "idx_logos_tasks_assigned" ON "public"."logos_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_logos_tasks_project" ON "public"."logos_tasks" USING "btree" ("project_id");



CREATE INDEX "idx_mappings_logos" ON "public"."logos_pulse_mappings" USING "btree" ("logos_entity_type", "logos_entity_id");



CREATE INDEX "idx_mappings_pulse" ON "public"."logos_pulse_mappings" USING "btree" ("pulse_entity_type", "pulse_entity_id");



CREATE INDEX "idx_meeting_prep_event_id" ON "public"."meeting_prep_cards" USING "btree" ("calendar_event_id");



CREATE INDEX "idx_meeting_prep_event_start" ON "public"."meeting_prep_cards" USING "btree" ("event_start");



CREATE INDEX "idx_meeting_prep_status" ON "public"."meeting_prep_cards" USING "btree" ("status");



CREATE INDEX "idx_meeting_prep_upcoming" ON "public"."meeting_prep_cards" USING "btree" ("user_id", "event_start", "status") WHERE ("status" <> 'archived'::"text");



CREATE INDEX "idx_meeting_prep_user_id" ON "public"."meeting_prep_cards" USING "btree" ("user_id");



CREATE INDEX "idx_meetings_created_at" ON "public"."meetings" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_meetings_created_by" ON "public"."meetings" USING "btree" ("created_by");



CREATE INDEX "idx_meetings_project_id" ON "public"."meetings" USING "btree" ("project_id");



CREATE INDEX "idx_message_bookmarks_message" ON "public"."voice_message_bookmarks" USING "btree" ("message_id");



CREATE INDEX "idx_message_bookmarks_user" ON "public"."voice_message_bookmarks" USING "btree" ("user_id");



CREATE INDEX "idx_message_impact_conversation" ON "public"."message_impact" USING "btree" ("conversation_id");



CREATE INDEX "idx_message_impact_score" ON "public"."message_impact" USING "btree" ("impact_score" DESC);



CREATE INDEX "idx_message_reactions_message" ON "public"."voice_message_reactions" USING "btree" ("message_id");



CREATE INDEX "idx_message_reactions_user" ON "public"."voice_message_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_message_translations_message" ON "public"."message_translations" USING "btree" ("message_id");



CREATE INDEX "idx_messages_active" ON "public"."in_app_messages" USING "btree" ("is_active");



CREATE INDEX "idx_messages_channel" ON "public"."unified_messages" USING "btree" ("channel_id", "timestamp" DESC);



CREATE INDEX "idx_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_deleted" ON "public"."voice_thread_messages" USING "btree" ("thread_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_messages_event" ON "public"."in_app_messages" USING "btree" ("event_trigger");



CREATE INDEX "idx_messages_forwarded" ON "public"."voice_thread_messages" USING "btree" ("forwarded_from_message_id") WHERE ("forwarded_from_message_id" IS NOT NULL);



CREATE INDEX "idx_messages_pinned" ON "public"."voice_thread_messages" USING "btree" ("thread_id", "is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_messages_platform" ON "public"."unified_messages" USING "btree" ("user_id", "platform", "timestamp" DESC);



CREATE INDEX "idx_messages_schedule" ON "public"."in_app_messages" USING "btree" ("starts_at", "ends_at");



CREATE INDEX "idx_messages_starred" ON "public"."unified_messages" USING "btree" ("user_id", "is_starred", "timestamp" DESC);



CREATE INDEX "idx_messages_text_gin" ON "public"."messages" USING "gin" ("text" "public"."gin_trgm_ops");



CREATE INDEX "idx_messages_thread_id" ON "public"."messages" USING "btree" ("thread_id");



CREATE INDEX "idx_messages_thread_id_deleted" ON "public"."voice_thread_messages" USING "btree" ("thread_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_messages_timestamp" ON "public"."messages" USING "btree" ("timestamp");



CREATE INDEX "idx_messages_unread" ON "public"."unified_messages" USING "btree" ("user_id", "is_read", "timestamp" DESC);



CREATE INDEX "idx_messages_unread_lookup" ON "public"."voice_thread_messages" USING "btree" ("thread_id", "sender_id", "is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_messages_user_timestamp" ON "public"."unified_messages" USING "btree" ("user_id", "timestamp" DESC);



CREATE INDEX "idx_messages_workspace_id" ON "public"."chat_messages" USING "btree" ("workspace_id");



CREATE INDEX "idx_milestones_outcome" ON "public"."outcome_milestones" USING "btree" ("outcome_id");



CREATE INDEX "idx_notification_rules_enabled" ON "public"."notification_rules" USING "btree" ("user_id", "enabled") WHERE ("enabled" = true);



CREATE INDEX "idx_notification_rules_priority" ON "public"."notification_rules" USING "btree" ("user_id", "priority");



CREATE INDEX "idx_notification_rules_user" ON "public"."notification_rules" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user" ON "public"."pulse_notifications" USING "btree" ("user_id", "read");



CREATE INDEX "idx_nudges_user" ON "public"."pulse_nudges" USING "btree" ("user_id", "dismissed");



CREATE INDEX "idx_outcomes_status" ON "public"."outcomes" USING "btree" ("status");



CREATE INDEX "idx_outcomes_user_id" ON "public"."outcomes" USING "btree" ("user_id");



CREATE INDEX "idx_outcomes_workspace" ON "public"."workspace_outcomes" USING "btree" ("workspace_id");



CREATE INDEX "idx_participants_workspace_id" ON "public"."workspace_participants" USING "btree" ("workspace_id");



CREATE INDEX "idx_predictions_created_at" ON "public"."predictions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_predictions_entity" ON "public"."predictions" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_predictions_entity_latest" ON "public"."predictions" USING "btree" ("entity_type", "entity_id", "prediction_type", "created_at" DESC);



CREATE INDEX "idx_predictions_entity_type_latest" ON "public"."predictions" USING "btree" ("entity_type", "entity_id", "prediction_type", "created_at" DESC);



CREATE INDEX "idx_predictions_model_version" ON "public"."predictions" USING "btree" ("model_version");



CREATE INDEX "idx_predictions_type" ON "public"."predictions" USING "btree" ("prediction_type");



CREATE INDEX "idx_project_docs_doc" ON "public"."project_docs" USING "btree" ("doc_id");



CREATE INDEX "idx_project_docs_project" ON "public"."project_docs" USING "btree" ("project_id");



CREATE INDEX "idx_project_shares_project" ON "public"."project_shares" USING "btree" ("project_id");



CREATE INDEX "idx_project_shares_public_link" ON "public"."project_shares" USING "btree" ("public_link");



CREATE INDEX "idx_project_shares_shared_by" ON "public"."project_shares" USING "btree" ("shared_by");



CREATE INDEX "idx_project_shares_shared_with_user" ON "public"."project_shares" USING "btree" ("shared_with_user");



CREATE INDEX "idx_project_templates_active" ON "public"."project_templates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_project_templates_category" ON "public"."project_templates" USING "btree" ("category");



CREATE INDEX "idx_projects_crm_deal_id" ON "public"."projects" USING "btree" ("crm_deal_id");



CREATE INDEX "idx_projects_owner_id" ON "public"."projects" USING "btree" ("owner_id");



CREATE INDEX "idx_prompt_suggestions_session" ON "public"."ai_prompt_suggestions" USING "btree" ("session_id");



CREATE INDEX "idx_pulse_channels_owner" ON "public"."pulse_channels" USING "btree" ("owner_id");



CREATE INDEX "idx_pulse_channels_public" ON "public"."pulse_channels" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE UNIQUE INDEX "idx_pulse_conversations_unique_pair" ON "public"."pulse_conversations" USING "btree" (LEAST("user1_id", "user2_id"), GREATEST("user1_id", "user2_id"));



CREATE INDEX "idx_pulse_conversations_user1" ON "public"."pulse_conversations" USING "btree" ("user1_id", "last_message_at" DESC);



CREATE INDEX "idx_pulse_conversations_user2" ON "public"."pulse_conversations" USING "btree" ("user2_id", "last_message_at" DESC);



CREATE INDEX "idx_pulse_follows_follower" ON "public"."pulse_follows" USING "btree" ("follower_id");



CREATE INDEX "idx_pulse_follows_following" ON "public"."pulse_follows" USING "btree" ("following_id");



CREATE INDEX "idx_pulse_messages_conversation" ON "public"."pulse_messages" USING "btree" (LEAST("sender_id", "recipient_id"), GREATEST("sender_id", "recipient_id"), "created_at" DESC);



CREATE INDEX "idx_pulse_messages_recipient" ON "public"."pulse_messages" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_pulse_messages_sender" ON "public"."pulse_messages" USING "btree" ("sender_id", "created_at" DESC);



CREATE INDEX "idx_pulse_messages_thread" ON "public"."pulse_messages" USING "btree" ("thread_id", "created_at" DESC);



CREATE INDEX "idx_pulse_messages_unread" ON "public"."pulse_messages" USING "btree" ("recipient_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_pulse_users_auth" ON "public"."pulse_users" USING "btree" ("auth_user_id");



CREATE INDEX "idx_pulse_users_handle" ON "public"."pulse_users" USING "btree" ("handle");



CREATE UNIQUE INDEX "idx_quick_vox_favorites_unique" ON "public"."quick_vox_favorites" USING "btree" ("user_id", "contact_id");



CREATE INDEX "idx_quick_vox_favorites_user" ON "public"."quick_vox_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_quick_vox_messages_conversation" ON "public"."quick_vox_messages" USING "btree" ("sender_id", "recipient_id");



CREATE INDEX "idx_quick_vox_messages_recipient" ON "public"."quick_vox_messages" USING "btree" ("recipient_id");



CREATE INDEX "idx_quick_vox_messages_sender" ON "public"."quick_vox_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_recent_views_time" ON "public"."doc_recent_views" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_recent_views_user" ON "public"."doc_recent_views" USING "btree" ("user_id");



CREATE INDEX "idx_relationship_alerts_active" ON "public"."relationship_alerts" USING "btree" ("user_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_relationship_alerts_priority" ON "public"."relationship_alerts" USING "btree" ("priority" DESC);



CREATE INDEX "idx_relationship_alerts_profile_id" ON "public"."relationship_alerts" USING "btree" ("profile_id");



CREATE INDEX "idx_relationship_alerts_severity" ON "public"."relationship_alerts" USING "btree" ("severity");



CREATE INDEX "idx_relationship_alerts_status" ON "public"."relationship_alerts" USING "btree" ("status");



CREATE INDEX "idx_relationship_alerts_trigger" ON "public"."relationship_alerts" USING "btree" ("trigger_date");



CREATE INDEX "idx_relationship_alerts_type" ON "public"."relationship_alerts" USING "btree" ("alert_type");



CREATE INDEX "idx_relationship_alerts_user_id" ON "public"."relationship_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_relationship_events_created_at" ON "public"."relationship_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_relationship_events_relationship" ON "public"."relationship_events" USING "btree" ("relationship_id", "created_at" DESC);



CREATE INDEX "idx_relationship_events_type" ON "public"."relationship_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_relationship_milestones_date" ON "public"."relationship_milestones" USING "btree" ("milestone_date" DESC);



CREATE INDEX "idx_relationship_milestones_profile_id" ON "public"."relationship_milestones" USING "btree" ("profile_id");



CREATE INDEX "idx_relationship_milestones_type" ON "public"."relationship_milestones" USING "btree" ("milestone_type");



CREATE INDEX "idx_relationship_milestones_user_id" ON "public"."relationship_milestones" USING "btree" ("user_id");



CREATE INDEX "idx_relationship_profiles_canonical" ON "public"."relationship_profiles" USING "btree" ("canonical_email");



CREATE INDEX "idx_relationship_profiles_company" ON "public"."relationship_profiles" USING "btree" ("company");



CREATE INDEX "idx_relationship_profiles_email" ON "public"."relationship_profiles" USING "btree" ("contact_email");



CREATE INDEX "idx_relationship_profiles_favorite" ON "public"."relationship_profiles" USING "btree" ("is_favorite") WHERE ("is_favorite" = true);



CREATE INDEX "idx_relationship_profiles_frequency" ON "public"."relationship_profiles" USING "btree" ("communication_frequency");



CREATE INDEX "idx_relationship_profiles_last_interaction" ON "public"."relationship_profiles" USING "btree" ("last_interaction_at" DESC);



CREATE INDEX "idx_relationship_profiles_score" ON "public"."relationship_profiles" USING "btree" ("relationship_score" DESC);



CREATE INDEX "idx_relationship_profiles_type" ON "public"."relationship_profiles" USING "btree" ("relationship_type");



CREATE INDEX "idx_relationship_profiles_user_id" ON "public"."relationship_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_relationship_profiles_vip" ON "public"."relationship_profiles" USING "btree" ("is_vip") WHERE ("is_vip" = true);



CREATE INDEX "idx_relationships_active_source" ON "public"."relationships" USING "btree" ("source_type", "source_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_relationships_active_target" ON "public"."relationships" USING "btree" ("target_type", "target_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_relationships_active_type" ON "public"."relationships" USING "btree" ("relationship_type") WHERE ("is_deleted" = false);



CREATE INDEX "idx_relationships_created_at" ON "public"."relationships" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_relationships_not_deleted_source" ON "public"."relationships" USING "btree" ("source_type", "source_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_relationships_not_deleted_target" ON "public"."relationships" USING "btree" ("target_type", "target_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_relationships_source" ON "public"."relationships" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_relationships_source_type_rel" ON "public"."relationships" USING "btree" ("source_type", "source_id", "relationship_type");



CREATE INDEX "idx_relationships_target" ON "public"."relationships" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_relationships_target_type_rel" ON "public"."relationships" USING "btree" ("target_type", "target_id", "relationship_type");



CREATE INDEX "idx_relationships_type" ON "public"."relationships" USING "btree" ("relationship_type");



CREATE INDEX "idx_replies_annotation" ON "public"."annotation_replies" USING "btree" ("annotation_id");



CREATE INDEX "idx_replies_user" ON "public"."annotation_replies" USING "btree" ("user_id");



CREATE INDEX "idx_retention_policies_active" ON "public"."retention_policies" USING "btree" ("is_active", "resource_type") WHERE ("is_active" = true);



CREATE INDEX "idx_retention_policies_tenant" ON "public"."retention_policies" USING "btree" ("tenant_id");



CREATE INDEX "idx_roles_name" ON "public"."roles" USING "btree" ("name");



CREATE INDEX "idx_roles_system" ON "public"."roles" USING "btree" ("is_system") WHERE ("is_system" = true);



CREATE INDEX "idx_roles_tenant" ON "public"."roles" USING "btree" ("tenant_id");



CREATE INDEX "idx_saved_searches_alerts" ON "public"."saved_searches" USING "btree" ("user_id", "alert_enabled") WHERE ("alert_enabled" = true);



CREATE INDEX "idx_saved_searches_created" ON "public"."saved_searches" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_saved_searches_last_used" ON "public"."saved_searches" USING "btree" ("user_id", "last_used" DESC);



CREATE INDEX "idx_saved_searches_pinned" ON "public"."saved_searches" USING "btree" ("user_id", "is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_saved_searches_user" ON "public"."saved_searches" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_saved_searches_user_id" ON "public"."saved_searches" USING "btree" ("user_id");



CREATE INDEX "idx_scheduled_emails_scheduled_for" ON "public"."scheduled_emails" USING "btree" ("scheduled_for");



CREATE INDEX "idx_scheduled_emails_status" ON "public"."scheduled_emails" USING "btree" ("status");



CREATE INDEX "idx_scheduled_emails_user_id" ON "public"."scheduled_emails" USING "btree" ("user_id");



CREATE INDEX "idx_search_clipboard_category" ON "public"."search_clipboard" USING "btree" ("user_id", "category");



CREATE INDEX "idx_search_clipboard_content_gin" ON "public"."search_clipboard" USING "gin" ("content" "public"."gin_trgm_ops");



CREATE INDEX "idx_search_clipboard_pinned" ON "public"."search_clipboard" USING "btree" ("user_id", "pinned" DESC, "updated_at" DESC);



CREATE INDEX "idx_search_clipboard_source" ON "public"."search_clipboard" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_search_clipboard_tags" ON "public"."search_clipboard" USING "gin" ("tags");



CREATE INDEX "idx_search_clipboard_title_gin" ON "public"."search_clipboard" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_search_clipboard_updated" ON "public"."search_clipboard" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_search_clipboard_user_id" ON "public"."search_clipboard" USING "btree" ("user_id");



CREATE INDEX "idx_search_documents_created_at" ON "public"."search_documents" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_search_documents_embedding" ON "public"."search_documents" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_search_documents_metadata" ON "public"."search_documents" USING "gin" ("metadata");



CREATE INDEX "idx_search_documents_source" ON "public"."search_documents" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_search_documents_source_type" ON "public"."search_documents" USING "btree" ("source_type");



CREATE INDEX "idx_search_history_count" ON "public"."search_history" USING "btree" ("user_id", "count" DESC);



CREATE INDEX "idx_search_history_created" ON "public"."search_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_search_history_updated" ON "public"."search_history" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_search_history_user" ON "public"."search_history" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_search_history_user_id" ON "public"."search_history" USING "btree" ("user_id");



CREATE INDEX "idx_sidepanel_chat" ON "public"."crm_sidepanels" USING "btree" ("chat_id");



CREATE INDEX "idx_sidepanel_crm" ON "public"."crm_sidepanels" USING "btree" ("crm_id");



CREATE INDEX "idx_sidepanel_user" ON "public"."crm_sidepanels" USING "btree" ("user_id");



CREATE INDEX "idx_slack_channels_user_id" ON "public"."slack_channels" USING "btree" ("user_id");



CREATE INDEX "idx_smart_contact_groups_pinned" ON "public"."smart_contact_groups" USING "btree" ("is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_smart_contact_groups_system" ON "public"."smart_contact_groups" USING "btree" ("is_system") WHERE ("is_system" = true);



CREATE INDEX "idx_smart_contact_groups_type" ON "public"."smart_contact_groups" USING "btree" ("group_type");



CREATE INDEX "idx_smart_contact_groups_user_id" ON "public"."smart_contact_groups" USING "btree" ("user_id");



CREATE INDEX "idx_smart_folders_user_id" ON "public"."smart_folders" USING "btree" ("user_id");



CREATE INDEX "idx_smart_group_channel" ON "public"."smart_groups" USING "btree" ("channel_id");



CREATE INDEX "idx_smart_group_crm" ON "public"."smart_groups" USING "btree" ("crm_id");



CREATE INDEX "idx_sms_conversations_phone" ON "public"."sms_conversations" USING "btree" ("phone_number");



CREATE INDEX "idx_sms_conversations_user_id" ON "public"."sms_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_sms_messages_conversation_id" ON "public"."sms_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_sms_messages_timestamp" ON "public"."sms_messages" USING "btree" ("timestamp");



CREATE INDEX "idx_sms_messages_user_timestamp" ON "public"."sms_messages" USING "btree" ("conversation_id", "timestamp" DESC);



CREATE INDEX "idx_snoozed_emails_snooze_until" ON "public"."snoozed_emails" USING "btree" ("snooze_until");



CREATE INDEX "idx_snoozed_emails_status" ON "public"."snoozed_emails" USING "btree" ("status");



CREATE INDEX "idx_snoozed_emails_user_id" ON "public"."snoozed_emails" USING "btree" ("user_id");



CREATE INDEX "idx_sso_configs_enabled" ON "public"."sso_configs" USING "btree" ("is_enabled") WHERE ("is_enabled" = true);



CREATE INDEX "idx_sso_configs_tenant" ON "public"."sso_configs" USING "btree" ("tenant_id");



CREATE INDEX "idx_sso_sessions_active" ON "public"."sso_sessions" USING "btree" ("tenant_id", "user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_sso_sessions_tenant" ON "public"."sso_sessions" USING "btree" ("tenant_id");



CREATE INDEX "idx_sso_sessions_user" ON "public"."sso_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_suggestions_expires" ON "public"."smart_suggestions_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_suggestions_user_conversation" ON "public"."smart_suggestions_cache" USING "btree" ("user_id", "conversation_id");



CREATE INDEX "idx_summaries_channel" ON "public"."pulse_context_summaries" USING "btree" ("channel_id");



CREATE INDEX "idx_sync_log_crm" ON "public"."crm_sync_logs" USING "btree" ("crm_id");



CREATE INDEX "idx_sync_log_started" ON "public"."crm_sync_logs" USING "btree" ("started_at");



CREATE INDEX "idx_sync_logs_integration" ON "public"."integration_sync_logs" USING "btree" ("integration_id", "started_at" DESC);



CREATE INDEX "idx_sync_logs_started" ON "public"."logos_sync_logs" USING "btree" ("started_at");



CREATE INDEX "idx_sync_logs_status" ON "public"."logos_sync_logs" USING "btree" ("status");



CREATE INDEX "idx_sync_state_user_platform" ON "public"."message_sync_state" USING "btree" ("user_id", "platform");



CREATE INDEX "idx_task_updates_task" ON "public"."task_updates" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_assigned" ON "public"."pulse_tasks" USING "btree" ("assigned_to", "completed");



CREATE INDEX "idx_tasks_assignee" ON "public"."extracted_tasks" USING "btree" ("assignee_id");



CREATE INDEX "idx_tasks_channel" ON "public"."pulse_tasks" USING "btree" ("channel_id");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_list_id" ON "public"."tasks" USING "btree" ("list_id");



CREATE INDEX "idx_tasks_status" ON "public"."extracted_tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_title_gin" ON "public"."tasks" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_tasks_user_created" ON "public"."tasks" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_tasks_user_due_date" ON "public"."tasks" USING "btree" ("user_id", "due_date" DESC NULLS LAST);



CREATE INDEX "idx_tasks_user_id" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_workspace" ON "public"."extracted_tasks" USING "btree" ("workspace_id");



CREATE INDEX "idx_team_invites_email" ON "public"."team_invites" USING "btree" ("email");



CREATE INDEX "idx_team_invites_invited_by" ON "public"."team_invites" USING "btree" ("invited_by");



CREATE INDEX "idx_team_invites_status" ON "public"."team_invites" USING "btree" ("status");



CREATE INDEX "idx_team_members_member" ON "public"."team_members" USING "btree" ("member_type", "member_id");



CREATE INDEX "idx_team_members_team_id" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_team_vox_messages_channel" ON "public"."team_vox_messages" USING "btree" ("channel_id");



CREATE INDEX "idx_team_vox_messages_created" ON "public"."team_vox_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_test_matrix_test_id" ON "public"."test_matrix_results" USING "btree" ("test_id");



CREATE INDEX "idx_test_matrix_user_id" ON "public"."test_matrix_results" USING "btree" ("user_id");



CREATE INDEX "idx_thinking_logs_message" ON "public"."ai_thinking_logs" USING "btree" ("message_id");



CREATE INDEX "idx_thread_actions_pinned" ON "public"."thread_actions" USING "btree" ("user_id", "is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_thread_actions_starred" ON "public"."thread_actions" USING "btree" ("user_id", "is_starred") WHERE ("is_starred" = true);



CREATE INDEX "idx_thread_actions_user" ON "public"."thread_actions" USING "btree" ("user_id");



CREATE INDEX "idx_thread_participants_muted" ON "public"."voice_thread_participants" USING "btree" ("thread_id", "user_id") WHERE ("is_muted" = true);



CREATE INDEX "idx_thread_participants_thread" ON "public"."voice_thread_participants" USING "btree" ("thread_id");



CREATE INDEX "idx_thread_participants_user" ON "public"."voice_thread_participants" USING "btree" ("user_id");



CREATE INDEX "idx_thread_tags_tag" ON "public"."voice_thread_tags" USING "btree" ("tag");



CREATE INDEX "idx_thread_tags_thread" ON "public"."voice_thread_tags" USING "btree" ("thread_id");



CREATE INDEX "idx_threads_contact_id" ON "public"."threads" USING "btree" ("contact_id");



CREATE INDEX "idx_threads_pinned" ON "public"."voice_threads" USING "btree" ("is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_threads_status" ON "public"."voice_threads" USING "btree" ("status");



CREATE INDEX "idx_threads_updated" ON "public"."voice_threads" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_threads_user_id" ON "public"."threads" USING "btree" ("user_id");



CREATE INDEX "idx_threads_user_updated" ON "public"."threads" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_typing_channel" ON "public"."pulse_typing" USING "btree" ("channel_id");



CREATE INDEX "idx_unified_messages_channel_perf" ON "public"."unified_messages" USING "btree" ("channel_id", "timestamp" DESC);



CREATE INDEX "idx_unified_messages_content_gin" ON "public"."unified_messages" USING "gin" ("content" "public"."gin_trgm_ops");



CREATE INDEX "idx_unified_messages_is_read" ON "public"."unified_messages" USING "btree" ("is_read");



CREATE INDEX "idx_unified_messages_searchable_gin" ON "public"."unified_messages" USING "gin" ("searchable_content" "public"."gin_trgm_ops");



CREATE INDEX "idx_unified_messages_sender_gin" ON "public"."unified_messages" USING "gin" ("sender_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_unified_messages_source" ON "public"."unified_messages" USING "btree" ("source");



CREATE INDEX "idx_unified_messages_timestamp" ON "public"."unified_messages" USING "btree" ("timestamp");



CREATE INDEX "idx_unified_messages_user_id" ON "public"."unified_messages" USING "btree" ("user_id");



CREATE INDEX "idx_unified_messages_user_perf" ON "public"."unified_messages" USING "btree" ("user_id", "timestamp" DESC);



CREATE INDEX "idx_user_achievements_unlocked" ON "public"."user_achievements" USING "btree" ("user_id", "unlocked") WHERE ("unlocked" = true);



CREATE INDEX "idx_user_achievements_user" ON "public"."user_achievements" USING "btree" ("user_id");



CREATE INDEX "idx_user_contact_annotations_blocked" ON "public"."user_contact_annotations" USING "btree" ("user_id", "is_blocked") WHERE ("is_blocked" = true);



CREATE INDEX "idx_user_contact_annotations_favorite" ON "public"."user_contact_annotations" USING "btree" ("user_id", "is_favorite") WHERE ("is_favorite" = true);



CREATE INDEX "idx_user_contact_annotations_target" ON "public"."user_contact_annotations" USING "btree" ("target_user_id");



CREATE INDEX "idx_user_contact_annotations_user" ON "public"."user_contact_annotations" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_display_name" ON "public"."user_profiles" USING "btree" ("display_name");



CREATE INDEX "idx_user_profiles_full_name" ON "public"."user_profiles" USING "btree" ("full_name");



CREATE INDEX "idx_user_profiles_handle" ON "public"."user_profiles" USING "btree" ("handle");



CREATE INDEX "idx_user_profiles_is_public" ON "public"."user_profiles" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_user_profiles_online_status" ON "public"."user_profiles" USING "btree" ("online_status", "last_active_at") WHERE ("online_status" <> 'offline'::"text");



CREATE INDEX "idx_user_profiles_search" ON "public"."user_profiles" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((COALESCE("display_name", ''::"text") || ' '::"text") || COALESCE("full_name", ''::"text")) || ' '::"text") || COALESCE("handle", ''::"text"))));



CREATE INDEX "idx_user_retention_cohorts_cohort_date" ON "public"."user_retention_cohorts" USING "btree" ("cohort_date");



CREATE INDEX "idx_user_retention_cohorts_user_id" ON "public"."user_retention_cohorts" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_role" ON "public"."user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_roles_tenant" ON "public"."user_roles" USING "btree" ("tenant_id");



CREATE INDEX "idx_user_roles_user" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_user_tenant" ON "public"."user_roles" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "idx_user_stats_user" ON "public"."user_message_statistics" USING "btree" ("user_id");



CREATE INDEX "idx_user_teams_updated_at" ON "public"."user_teams" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_user_teams_user_id" ON "public"."user_teams" USING "btree" ("user_id");



CREATE INDEX "idx_vacation_responder_enabled" ON "public"."vacation_responder" USING "btree" ("user_id", "enabled") WHERE ("enabled" = true);



CREATE INDEX "idx_vacation_responder_log_recipient" ON "public"."vacation_responder_log" USING "btree" ("user_id", "lower"("recipient_email"));



CREATE UNIQUE INDEX "idx_vacation_responder_log_unique" ON "public"."vacation_responder_log" USING "btree" ("user_id", "lower"("recipient_email"), "responder_id");



CREATE INDEX "idx_vacation_responder_log_user" ON "public"."vacation_responder_log" USING "btree" ("user_id", "sent_at" DESC);



CREATE INDEX "idx_vacation_responder_user" ON "public"."vacation_responder" USING "btree" ("user_id");



CREATE INDEX "idx_video_vox_ai_queue_message" ON "public"."video_vox_ai_queue" USING "btree" ("message_id");



CREATE INDEX "idx_video_vox_ai_queue_status" ON "public"."video_vox_ai_queue" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_video_vox_bookmarks_user" ON "public"."video_vox_bookmarks" USING "btree" ("user_id");



CREATE INDEX "idx_video_vox_conversations_last_message" ON "public"."video_vox_conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_video_vox_conversations_participants" ON "public"."video_vox_conversations" USING "gin" ("participant_ids");



CREATE INDEX "idx_video_vox_members_conversation" ON "public"."video_vox_conversation_members" USING "btree" ("conversation_id");



CREATE INDEX "idx_video_vox_members_user" ON "public"."video_vox_conversation_members" USING "btree" ("user_id");



CREATE INDEX "idx_video_vox_messages_conversation" ON "public"."video_vox_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_video_vox_messages_created" ON "public"."video_vox_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_video_vox_messages_mentions" ON "public"."video_vox_messages" USING "gin" ("mentions");



CREATE INDEX "idx_video_vox_messages_reply" ON "public"."video_vox_messages" USING "btree" ("reply_to_id") WHERE ("reply_to_id" IS NOT NULL);



CREATE INDEX "idx_video_vox_messages_sender" ON "public"."video_vox_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_video_vox_messages_topics" ON "public"."video_vox_messages" USING "gin" ("topics");



CREATE INDEX "idx_video_vox_reactions_message" ON "public"."video_vox_reactions" USING "btree" ("message_id");



CREATE INDEX "idx_video_vox_reactions_user" ON "public"."video_vox_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_video_vox_receipts_message" ON "public"."video_vox_read_receipts" USING "btree" ("message_id");



CREATE INDEX "idx_video_vox_receipts_user" ON "public"."video_vox_read_receipts" USING "btree" ("user_id");



CREATE INDEX "idx_voice_message_bookmarks_user_message" ON "public"."voice_message_bookmarks" USING "btree" ("user_id", "message_id");



CREATE INDEX "idx_voice_message_reactions_user_message" ON "public"."voice_message_reactions" USING "btree" ("user_id", "message_id");



CREATE INDEX "idx_voice_thread_messages_created" ON "public"."voice_thread_messages" USING "btree" ("created_at");



CREATE INDEX "idx_voice_thread_messages_sender" ON "public"."voice_thread_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_voice_thread_messages_thread" ON "public"."voice_thread_messages" USING "btree" ("thread_id");



CREATE INDEX "idx_voice_threads_activity" ON "public"."voice_threads" USING "btree" ("last_activity_at" DESC);



CREATE INDEX "idx_voice_threads_participants" ON "public"."voice_threads" USING "gin" ("participants");



CREATE INDEX "idx_voice_threads_participants_gin" ON "public"."voice_threads" USING "gin" ("participants");



CREATE INDEX "idx_vox_drops_recipients" ON "public"."vox_drops" USING "gin" ("recipient_ids");



CREATE INDEX "idx_vox_drops_scheduled" ON "public"."vox_drops" USING "btree" ("scheduled_for") WHERE ("status" = 'scheduled'::"text");



CREATE INDEX "idx_vox_drops_sender" ON "public"."vox_drops" USING "btree" ("sender_id");



CREATE INDEX "idx_vox_notes_created" ON "public"."vox_notes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_vox_notes_tags" ON "public"."vox_notes" USING "gin" ("tags");



CREATE INDEX "idx_vox_notes_user" ON "public"."vox_notes" USING "btree" ("user_id");



CREATE INDEX "idx_vox_notifications_unread" ON "public"."vox_notifications" USING "btree" ("user_id") WHERE ("is_read" = false);



CREATE INDEX "idx_vox_notifications_user" ON "public"."vox_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_vox_team_channels_workspace" ON "public"."vox_team_channels" USING "btree" ("workspace_id");



CREATE INDEX "idx_vox_workspaces_members" ON "public"."vox_workspaces" USING "gin" ("member_ids");



CREATE INDEX "idx_vox_workspaces_owner" ON "public"."vox_workspaces" USING "btree" ("owner_id");



CREATE INDEX "idx_voxer_recordings_recorded_at" ON "public"."voxer_recordings" USING "btree" ("recorded_at");



CREATE INDEX "idx_voxer_recordings_timestamp" ON "public"."voxer_recordings" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_voxer_recordings_user_id" ON "public"."voxer_recordings" USING "btree" ("user_id");



CREATE INDEX "idx_voxer_recordings_user_timestamp" ON "public"."voxer_recordings" USING "btree" ("user_id", "recorded_at" DESC);



CREATE INDEX "idx_voxer_transcript_gin" ON "public"."voxer_recordings" USING "gin" ("transcript" "public"."gin_trgm_ops");



CREATE INDEX "idx_webhooks_active" ON "public"."webhooks" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_webhooks_events" ON "public"."webhooks" USING "gin" ("events");



CREATE INDEX "idx_workspaces_expires_at" ON "public"."ephemeral_workspaces" USING "btree" ("expires_at");



CREATE INDEX "idx_workspaces_is_active" ON "public"."ephemeral_workspaces" USING "btree" ("is_active");



CREATE OR REPLACE VIEW "public"."video_vox_messages_with_reactions" AS
 SELECT "m"."id",
    "m"."conversation_id",
    "m"."sender_id",
    "m"."sender_name",
    "m"."sender_handle",
    "m"."sender_avatar_url",
    "m"."video_url",
    "m"."thumbnail_url",
    "m"."duration",
    "m"."width",
    "m"."height",
    "m"."file_size",
    "m"."caption",
    "m"."transcript",
    "m"."summary",
    "m"."topics",
    "m"."sentiment",
    "m"."action_items",
    "m"."reply_to_id",
    "m"."reply_to_timestamp",
    "m"."quoted_text",
    "m"."thread_count",
    "m"."mentions",
    "m"."status",
    "m"."processing_status",
    "m"."created_at",
    "m"."delivered_at",
    "m"."expires_at",
    "m"."metadata",
    COALESCE("jsonb_object_agg"("r"."emoji", "r"."count") FILTER (WHERE ("r"."emoji" IS NOT NULL)), '{}'::"jsonb") AS "reaction_counts"
   FROM ("public"."video_vox_messages" "m"
     LEFT JOIN ( SELECT "video_vox_reactions"."message_id",
            "video_vox_reactions"."emoji",
            "count"(*) AS "count"
           FROM "public"."video_vox_reactions"
          GROUP BY "video_vox_reactions"."message_id", "video_vox_reactions"."emoji") "r" ON (("m"."id" = "r"."message_id")))
  GROUP BY "m"."id";



CREATE OR REPLACE TRIGGER "archives_search_vector_trigger" BEFORE INSERT OR UPDATE ON "public"."archives" FOR EACH ROW EXECUTE FUNCTION "public"."archives_search_vector_update"();



CREATE OR REPLACE TRIGGER "blocked_senders_updated_at" BEFORE UPDATE ON "public"."blocked_senders" FOR EACH ROW EXECUTE FUNCTION "public"."update_blocked_senders_updated_at"();



CREATE OR REPLACE TRIGGER "custom_labels_updated_at" BEFORE UPDATE ON "public"."custom_labels" FOR EACH ROW EXECUTE FUNCTION "public"."update_custom_label_updated_at"();



CREATE OR REPLACE TRIGGER "decision_vote_trigger" AFTER INSERT ON "public"."decision_votes" FOR EACH ROW EXECUTE FUNCTION "public"."check_decision_threshold"();



CREATE OR REPLACE TRIGGER "milestone_progress_trigger" AFTER INSERT OR UPDATE ON "public"."outcome_milestones" FOR EACH ROW EXECUTE FUNCTION "public"."update_outcome_progress"();



CREATE OR REPLACE TRIGGER "notification_rules_updated_at" BEFORE UPDATE ON "public"."notification_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_rules_updated_at"();



CREATE OR REPLACE TRIGGER "on_new_email_apply_filters" BEFORE INSERT ON "public"."cached_emails" FOR EACH ROW EXECUTE FUNCTION "public"."apply_email_filters"();



COMMENT ON TRIGGER "on_new_email_apply_filters" ON "public"."cached_emails" IS 'Applies email filters automatically to new emails';



CREATE OR REPLACE TRIGGER "on_new_email_vacation_responder" AFTER INSERT ON "public"."cached_emails" FOR EACH ROW EXECUTE FUNCTION "public"."handle_vacation_responder"();



COMMENT ON TRIGGER "on_new_email_vacation_responder" ON "public"."cached_emails" IS 'Triggers vacation responder for incoming emails';



CREATE OR REPLACE TRIGGER "prevent_circular_label_nesting_trigger" BEFORE INSERT OR UPDATE ON "public"."custom_labels" FOR EACH ROW WHEN (("new"."parent_label_id" IS NOT NULL)) EXECUTE FUNCTION "public"."prevent_circular_label_nesting"();



CREATE OR REPLACE TRIGGER "saved_searches_updated_at" BEFORE UPDATE ON "public"."saved_searches" FOR EACH ROW EXECUTE FUNCTION "public"."update_saved_search_updated_at"();



CREATE OR REPLACE TRIGGER "sync_participants_to_array" AFTER INSERT OR DELETE ON "public"."voice_thread_participants" FOR EACH ROW EXECUTE FUNCTION "public"."sync_voice_thread_participants"();



CREATE OR REPLACE TRIGGER "team_updated_at_trigger" BEFORE UPDATE ON "public"."user_teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_team_updated_at"();



CREATE OR REPLACE TRIGGER "trg_agents_set_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_relationship_event" AFTER INSERT OR UPDATE ON "public"."relationships" FOR EACH ROW EXECUTE FUNCTION "public"."log_relationship_event"();



CREATE OR REPLACE TRIGGER "trg_relationship_audit_log" AFTER INSERT OR UPDATE ON "public"."relationships" FOR EACH ROW EXECUTE FUNCTION "public"."log_relationship_event"();



CREATE OR REPLACE TRIGGER "trg_relationships_set_updated_at" BEFORE UPDATE ON "public"."relationships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_search_documents_set_updated_at" BEFORE UPDATE ON "public"."search_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_video_vox_increment_unread" AFTER INSERT ON "public"."video_vox_messages" FOR EACH ROW EXECUTE FUNCTION "public"."increment_video_vox_unread"();



CREATE OR REPLACE TRIGGER "trg_video_vox_message_insert" AFTER INSERT ON "public"."video_vox_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_video_vox_conversation_last_message"();



CREATE OR REPLACE TRIGGER "trg_video_vox_thread_count" AFTER INSERT ON "public"."video_vox_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_video_vox_thread_count"();



CREATE OR REPLACE TRIGGER "trigger_set_canonical_email" BEFORE INSERT OR UPDATE OF "contact_email" ON "public"."relationship_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_canonical_email"();



CREATE OR REPLACE TRIGGER "trigger_update_email_contact_stats" AFTER INSERT ON "public"."cached_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_contact_stats"();



CREATE OR REPLACE TRIGGER "trigger_update_email_thread_stats" AFTER INSERT OR UPDATE ON "public"."cached_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_thread_stats"();



CREATE OR REPLACE TRIGGER "trigger_update_profile_stats" AFTER INSERT ON "public"."contact_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_stats_from_interaction"();



CREATE OR REPLACE TRIGGER "trigger_update_saved_searches_updated_at" BEFORE UPDATE ON "public"."saved_searches" FOR EACH ROW EXECUTE FUNCTION "public"."update_saved_searches_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_search_clipboard_updated_at" BEFORE UPDATE ON "public"."search_clipboard" FOR EACH ROW EXECUTE FUNCTION "public"."update_search_clipboard_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_search_history_updated_at" BEFORE UPDATE ON "public"."search_history" FOR EACH ROW EXECUTE FUNCTION "public"."update_search_history_updated_at"();



CREATE OR REPLACE TRIGGER "update_ai_sessions_updated_at" BEFORE UPDATE ON "public"."ai_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_annotations_updated_at" BEFORE UPDATE ON "public"."doc_annotations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_channels_updated_at" BEFORE UPDATE ON "public"."channels" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_collections_updated_at" BEFORE UPDATE ON "public"."document_collections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_doc_shares_updated_at" BEFORE UPDATE ON "public"."document_shares" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_highlights_updated_at" BEFORE UPDATE ON "public"."doc_highlights" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_integrations_updated_at" BEFORE UPDATE ON "public"."integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_knowledge_docs_updated_at" BEFORE UPDATE ON "public"."knowledge_docs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_label_counts_trigger" AFTER INSERT OR DELETE ON "public"."email_labels" FOR EACH ROW EXECUTE FUNCTION "public"."update_label_counts"();



CREATE OR REPLACE TRIGGER "update_messages_updated_at" BEFORE UPDATE ON "public"."unified_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_shares_updated_at" BEFORE UPDATE ON "public"."project_shares" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pulse_conversations_updated_at" BEFORE UPDATE ON "public"."pulse_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pulse_messages_updated_at" BEFORE UPDATE ON "public"."pulse_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_replies_updated_at" BEFORE UPDATE ON "public"."annotation_replies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sync_state_updated_at" BEFORE UPDATE ON "public"."message_sync_state" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_contact_annotations_updated_at" BEFORE UPDATE ON "public"."user_contact_annotations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "vacation_responder_updated_at" BEFORE UPDATE ON "public"."vacation_responder" FOR EACH ROW EXECUTE FUNCTION "public"."update_vacation_responder_updated_at"();



CREATE OR REPLACE TRIGGER "voice_threads_updated_at" BEFORE UPDATE ON "public"."voice_threads" FOR EACH ROW EXECUTE FUNCTION "public"."update_voice_thread_timestamp"();



ALTER TABLE ONLY "public"."action_items"
    ADD CONSTRAINT "action_items_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."action_items"
    ADD CONSTRAINT "action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."ai_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_activity_logs"
    ADD CONSTRAINT "admin_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_settings"
    ADD CONSTRAINT "admin_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_execution_logs"
    ADD CONSTRAINT "agent_execution_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_run_steps"
    ADD CONSTRAINT "agent_run_steps_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_projects"
    ADD CONSTRAINT "ai_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_prompt_suggestions"
    ADD CONSTRAINT "ai_prompt_suggestions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_sessions"
    ADD CONSTRAINT "ai_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."ai_projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_sessions"
    ADD CONSTRAINT "ai_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_thinking_logs"
    ADD CONSTRAINT "ai_thinking_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_contact_engagement"
    ADD CONSTRAINT "analytics_contact_engagement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_daily_metrics"
    ADD CONSTRAINT "analytics_daily_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_period_summary"
    ADD CONSTRAINT "analytics_period_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_response_times"
    ADD CONSTRAINT "analytics_response_times_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_replies"
    ADD CONSTRAINT "annotation_replies_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "public"."doc_annotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_replies"
    ADD CONSTRAINT "annotation_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_request_logs"
    ADD CONSTRAINT "api_request_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_request_logs"
    ADD CONSTRAINT "api_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archive_collections"
    ADD CONSTRAINT "archive_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archive_shares"
    ADD CONSTRAINT "archive_shares_archive_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "public"."archives"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archive_shares"
    ADD CONSTRAINT "archive_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archive_shares"
    ADD CONSTRAINT "archive_shares_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archives"
    ADD CONSTRAINT "archives_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."archive_collections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."archives"
    ADD CONSTRAINT "archives_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."automation_logs"
    ADD CONSTRAINT "automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id");



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."blocked_senders"
    ADD CONSTRAINT "blocked_senders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."pulse_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."pulse_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cached_emails"
    ADD CONSTRAINT "cached_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."message_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."ephemeral_workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coaching_prompts"
    ADD CONSTRAINT "coaching_prompts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."coaching_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_docs"
    ADD CONSTRAINT "collection_docs_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."document_collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_docs"
    ADD CONSTRAINT "collection_docs_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_interactions"
    ADD CONSTRAINT "contact_interactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."relationship_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_interactions"
    ADD CONSTRAINT "contact_interactions_responded_to_id_fkey" FOREIGN KEY ("responded_to_id") REFERENCES "public"."contact_interactions"("id");



ALTER TABLE ONLY "public"."contact_interactions"
    ADD CONSTRAINT "contact_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_health"
    ADD CONSTRAINT "conversation_health_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_memory"
    ADD CONSTRAINT "conversation_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_actions"
    ADD CONSTRAINT "crm_actions_crm_id_fkey" FOREIGN KEY ("crm_id") REFERENCES "public"."crm_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_actions"
    ADD CONSTRAINT "crm_actions_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_companies"
    ADD CONSTRAINT "crm_companies_crm_id_fkey" FOREIGN KEY ("crm_id") REFERENCES "public"."crm_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_crm_id_fkey" FOREIGN KEY ("crm_id") REFERENCES "public"."crm_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_pulse_user_id_fkey" FOREIGN KEY ("pulse_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_deals"
    ADD CONSTRAINT "crm_deals_crm_id_fkey" FOREIGN KEY ("crm_id") REFERENCES "public"."crm_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_deals"
    ADD CONSTRAINT "crm_deals_linked_chat_id_fkey" FOREIGN KEY ("linked_chat_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_integrations"
    ADD CONSTRAINT "crm_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_sidepanels"
    ADD CONSTRAINT "crm_sidepanels_crm_id_fkey" FOREIGN KEY ("crm_id") REFERENCES "public"."crm_integrations"("id");



ALTER TABLE ONLY "public"."crm_sidepanels"
    ADD CONSTRAINT "crm_sidepanels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_sync_logs"
    ADD CONSTRAINT "crm_sync_logs_crm_id_fkey" FOREIGN KEY ("crm_id") REFERENCES "public"."crm_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_labels"
    ADD CONSTRAINT "custom_labels_parent_label_id_fkey" FOREIGN KEY ("parent_label_id") REFERENCES "public"."custom_labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_labels"
    ADD CONSTRAINT "custom_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."decision_votes"
    ADD CONSTRAINT "decision_votes_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_annotations"
    ADD CONSTRAINT "doc_annotations_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_annotations"
    ADD CONSTRAINT "doc_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_embeddings"
    ADD CONSTRAINT "doc_embeddings_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_favorites"
    ADD CONSTRAINT "doc_favorites_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_favorites"
    ADD CONSTRAINT "doc_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_highlights"
    ADD CONSTRAINT "doc_highlights_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_highlights"
    ADD CONSTRAINT "doc_highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_recent_views"
    ADD CONSTRAINT "doc_recent_views_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_recent_views"
    ADD CONSTRAINT "doc_recent_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_tags"
    ADD CONSTRAINT "doc_tags_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_tags"
    ADD CONSTRAINT "doc_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."document_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_collections"
    ADD CONSTRAINT "document_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_shares"
    ADD CONSTRAINT "document_shares_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_shares"
    ADD CONSTRAINT "document_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_shares"
    ADD CONSTRAINT "document_shares_shared_with_user_fkey" FOREIGN KEY ("shared_with_user") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_tags"
    ADD CONSTRAINT "document_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duplicate_contacts"
    ADD CONSTRAINT "duplicate_contacts_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "public"."relationship_profiles"("id");



ALTER TABLE ONLY "public"."duplicate_contacts"
    ADD CONSTRAINT "duplicate_contacts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."relationship_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duplicate_contacts"
    ADD CONSTRAINT "duplicate_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_contacts"
    ADD CONSTRAINT "email_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_daily_briefings"
    ADD CONSTRAINT "email_daily_briefings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_follow_ups"
    ADD CONSTRAINT "email_follow_ups_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."cached_emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_follow_ups"
    ADD CONSTRAINT "email_follow_ups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_labels"
    ADD CONSTRAINT "email_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."custom_labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_sync_state"
    ADD CONSTRAINT "email_sync_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entomate_action_items"
    ADD CONSTRAINT "entomate_action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."entomate_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entomate_automation_logs"
    ADD CONSTRAINT "entomate_automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."entomate_automations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entomate_project_tasks"
    ADD CONSTRAINT "entomate_project_tasks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."entomate_meetings"("id");



ALTER TABLE ONLY "public"."entomate_project_tasks"
    ADD CONSTRAINT "entomate_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."entomate_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."integration_field_mappings"
    ADD CONSTRAINT "integration_field_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_sync_logs"
    ADD CONSTRAINT "integration_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."key_results"
    ADD CONSTRAINT "key_results_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."outcomes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_docs"
    ADD CONSTRAINT "knowledge_docs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_scores"
    ADD CONSTRAINT "lead_scores_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."relationship_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_scores"
    ADD CONSTRAINT "lead_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_prep_cards"
    ADD CONSTRAINT "meeting_prep_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."message_drafts"
    ADD CONSTRAINT "message_drafts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."message_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_drafts"
    ADD CONSTRAINT "message_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_interactions"
    ADD CONSTRAINT "message_interactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."in_app_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_translations"
    ADD CONSTRAINT "message_translations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_rules"
    ADD CONSTRAINT "notification_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outcome_blockers"
    ADD CONSTRAINT "outcome_blockers_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."workspace_outcomes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outcome_milestones"
    ADD CONSTRAINT "outcome_milestones_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."workspace_outcomes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_docs"
    ADD CONSTRAINT "project_docs_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_docs"
    ADD CONSTRAINT "project_docs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."ai_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_shares"
    ADD CONSTRAINT "project_shares_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."ai_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_shares"
    ADD CONSTRAINT "project_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_shares"
    ADD CONSTRAINT "project_shares_shared_with_user_fkey" FOREIGN KEY ("shared_with_user") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pulse_blockers"
    ADD CONSTRAINT "pulse_blockers_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."pulse_outcomes"("id");



ALTER TABLE ONLY "public"."pulse_channel_subscriptions"
    ADD CONSTRAINT "pulse_channel_subscriptions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."pulse_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_channel_subscriptions"
    ADD CONSTRAINT "pulse_channel_subscriptions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_channels"
    ADD CONSTRAINT "pulse_channels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_conversations"
    ADD CONSTRAINT "pulse_conversations_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "public"."pulse_messages"("id");



ALTER TABLE ONLY "public"."pulse_conversations"
    ADD CONSTRAINT "pulse_conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_conversations"
    ADD CONSTRAINT "pulse_conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_follows"
    ADD CONSTRAINT "pulse_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_follows"
    ADD CONSTRAINT "pulse_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_messages"
    ADD CONSTRAINT "pulse_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_messages"
    ADD CONSTRAINT "pulse_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationship_alerts"
    ADD CONSTRAINT "relationship_alerts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."relationship_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationship_alerts"
    ADD CONSTRAINT "relationship_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationship_milestones"
    ADD CONSTRAINT "relationship_milestones_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."relationship_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationship_milestones"
    ADD CONSTRAINT "relationship_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationship_profiles"
    ADD CONSTRAINT "relationship_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_docs"
    ADD CONSTRAINT "session_docs_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_docs"
    ADD CONSTRAINT "session_docs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."share_invites"
    ADD CONSTRAINT "share_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."share_invites"
    ADD CONSTRAINT "share_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smart_contact_groups"
    ADD CONSTRAINT "smart_contact_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smart_folders"
    ADD CONSTRAINT "smart_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smart_groups"
    ADD CONSTRAINT "smart_groups_crm_id_fkey" FOREIGN KEY ("crm_id") REFERENCES "public"."crm_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smart_suggestions_cache"
    ADD CONSTRAINT "smart_suggestions_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."sms_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snoozed_emails"
    ADD CONSTRAINT "snoozed_emails_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."cached_emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snoozed_emails"
    ADD CONSTRAINT "snoozed_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sso_configs"
    ADD CONSTRAINT "sso_configs_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."task_updates"
    ADD CONSTRAINT "task_updates_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."extracted_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_vox_messages"
    ADD CONSTRAINT "team_vox_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."vox_team_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_vox_messages"
    ADD CONSTRAINT "team_vox_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."vox_workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_actions"
    ADD CONSTRAINT "thread_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_contact_annotations"
    ADD CONSTRAINT "user_contact_annotations_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_contact_annotations"
    ADD CONSTRAINT "user_contact_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_message_statistics"
    ADD CONSTRAINT "user_message_statistics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."vacation_responder_log"
    ADD CONSTRAINT "vacation_responder_log_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "public"."vacation_responder"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacation_responder_log"
    ADD CONSTRAINT "vacation_responder_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacation_responder"
    ADD CONSTRAINT "vacation_responder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_ai_queue"
    ADD CONSTRAINT "video_vox_ai_queue_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."video_vox_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_bookmarks"
    ADD CONSTRAINT "video_vox_bookmarks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."video_vox_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_bookmarks"
    ADD CONSTRAINT "video_vox_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_conversation_members"
    ADD CONSTRAINT "video_vox_conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."video_vox_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_conversation_members"
    ADD CONSTRAINT "video_vox_conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_conversations"
    ADD CONSTRAINT "video_vox_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."pulse_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."video_vox_messages"
    ADD CONSTRAINT "video_vox_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."video_vox_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_messages"
    ADD CONSTRAINT "video_vox_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."video_vox_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."video_vox_messages"
    ADD CONSTRAINT "video_vox_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."pulse_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."video_vox_reactions"
    ADD CONSTRAINT "video_vox_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."video_vox_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_reactions"
    ADD CONSTRAINT "video_vox_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_read_receipts"
    ADD CONSTRAINT "video_vox_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."video_vox_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_vox_read_receipts"
    ADD CONSTRAINT "video_vox_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."pulse_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_message_bookmarks"
    ADD CONSTRAINT "voice_message_bookmarks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."voice_thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_message_reactions"
    ADD CONSTRAINT "voice_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."voice_thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_thread_messages"
    ADD CONSTRAINT "voice_thread_messages_forwarded_from_message_id_fkey" FOREIGN KEY ("forwarded_from_message_id") REFERENCES "public"."voice_thread_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."voice_thread_messages"
    ADD CONSTRAINT "voice_thread_messages_forwarded_from_thread_id_fkey" FOREIGN KEY ("forwarded_from_thread_id") REFERENCES "public"."voice_threads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."voice_thread_messages"
    ADD CONSTRAINT "voice_thread_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."voice_thread_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."voice_thread_messages"
    ADD CONSTRAINT "voice_thread_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."voice_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_thread_participants"
    ADD CONSTRAINT "voice_thread_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."voice_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_thread_tags"
    ADD CONSTRAINT "voice_thread_tags_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."voice_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vox_team_channels"
    ADD CONSTRAINT "vox_team_channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."vox_workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_participants"
    ADD CONSTRAINT "workspace_participants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."ephemeral_workspaces"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage SSO configs" ON "public"."sso_configs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage retention policies" ON "public"."retention_policies" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage role assignments" ON "public"."user_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage roles" ON "public"."roles" TO "authenticated" USING (("is_system" = false)) WITH CHECK (("is_system" = false));



CREATE POLICY "Admins can view SSO configs" ON "public"."sso_configs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all access" ON "public"."archives" USING (true);



CREATE POLICY "Allow all access" ON "public"."contacts" USING (true);



CREATE POLICY "Allow all access" ON "public"."emails" USING (true);



CREATE POLICY "Allow all access" ON "public"."key_results" USING (true);



CREATE POLICY "Allow all access" ON "public"."outcomes" USING (true);



CREATE POLICY "Allow all access" ON "public"."slack_channels" USING (true);



CREATE POLICY "Allow all access" ON "public"."sms_conversations" USING (true);



CREATE POLICY "Allow all access" ON "public"."sms_messages" USING (true);



CREATE POLICY "Allow all access" ON "public"."voxer_recordings" USING (true);



CREATE POLICY "Allow all access to goals" ON "public"."goals" USING (true);



CREATE POLICY "Allow all attention_logs" ON "public"."attention_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all attention_settings" ON "public"."attention_settings" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all decision_votes" ON "public"."decision_votes" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all decisions" ON "public"."decisions" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all extracted_tasks" ON "public"."extracted_tasks" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all focus_sessions" ON "public"."focus_sessions" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on video_vox_ai_queue" ON "public"."video_vox_ai_queue" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on video_vox_bookmarks" ON "public"."video_vox_bookmarks" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on video_vox_conversation_members" ON "public"."video_vox_conversation_members" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on video_vox_conversations" ON "public"."video_vox_conversations" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on video_vox_messages" ON "public"."video_vox_messages" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on video_vox_reactions" ON "public"."video_vox_reactions" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on video_vox_read_receipts" ON "public"."video_vox_read_receipts" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on broadcasts" ON "public"."broadcasts" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on pulse_channel_subscriptions" ON "public"."pulse_channel_subscriptions" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on pulse_channels" ON "public"."pulse_channels" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on pulse_follows" ON "public"."pulse_follows" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on pulse_users" ON "public"."pulse_users" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on quick_vox_favorites" ON "public"."quick_vox_favorites" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on quick_vox_messages" ON "public"."quick_vox_messages" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on quick_vox_status" ON "public"."quick_vox_status" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on team_vox_messages" ON "public"."team_vox_messages" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on vox_drops" ON "public"."vox_drops" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on vox_notes" ON "public"."vox_notes" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on vox_notifications" ON "public"."vox_notifications" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on vox_team_channels" ON "public"."vox_team_channels" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on vox_workspaces" ON "public"."vox_workspaces" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all outcome_blockers" ON "public"."outcome_blockers" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all outcome_milestones" ON "public"."outcome_milestones" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all task_updates" ON "public"."task_updates" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all user_settings" ON "public"."user_settings" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all workspace_outcomes" ON "public"."workspace_outcomes" USING (true) WITH CHECK (true);



CREATE POLICY "Allow inserting dependencies" ON "public"."task_dependencies" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow inserting messages" ON "public"."chat_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow inserting participants" ON "public"."workspace_participants" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow viewing active workspaces" ON "public"."ephemeral_workspaces" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Allow viewing dependencies" ON "public"."task_dependencies" FOR SELECT USING (true);



CREATE POLICY "Allow viewing messages" ON "public"."chat_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ephemeral_workspaces"
  WHERE (("ephemeral_workspaces"."id" = "chat_messages"."workspace_id") AND ("ephemeral_workspaces"."is_active" = true)))));



CREATE POLICY "Allow viewing participants" ON "public"."workspace_participants" FOR SELECT USING (true);



CREATE POLICY "Anyone can view reserved handles" ON "public"."reserved_handles" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create invites" ON "public"."team_invites" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users log interactions" ON "public"."message_interactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Doc owners can create shares" ON "public"."document_shares" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "document_shares"."doc_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "Doc owners can delete shares" ON "public"."document_shares" FOR DELETE USING ((("auth"."uid"() = "shared_by") OR (EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "document_shares"."doc_id") AND ("d"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Doc owners can update shares" ON "public"."document_shares" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "document_shares"."doc_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "Enable all access" ON "public"."calendar_events" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access" ON "public"."messages" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access" ON "public"."tasks" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access" ON "public"."threads" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access" ON "public"."unified_messages" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_blockers" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_context_summaries" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_decisions" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_files" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_notifications" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_nudges" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_outcomes" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_tasks" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."pulse_typing" TO "authenticated" USING (true);



CREATE POLICY "Inviters can delete their invites" ON "public"."share_invites" FOR DELETE USING (("auth"."uid"() = "invited_by"));



CREATE POLICY "Inviters can view their invites" ON "public"."share_invites" FOR SELECT USING (("auth"."uid"() = "invited_by"));



CREATE POLICY "Manage field mappings" ON "public"."integration_field_mappings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Manage integrations" ON "public"."integrations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Manage sync logs" ON "public"."integration_sync_logs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Manage webhook deliveries" ON "public"."webhook_deliveries" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Manage webhooks" ON "public"."webhooks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Participants can add new members" ON "public"."voice_thread_participants" FOR INSERT WITH CHECK ("public"."is_thread_participant"("thread_id", "auth"."uid"()));



CREATE POLICY "Participants can add tags" ON "public"."voice_thread_tags" FOR INSERT WITH CHECK ("public"."is_thread_participant"("thread_id", "auth"."uid"()));



CREATE POLICY "Participants can delete threads" ON "public"."voice_threads" FOR DELETE USING (("auth"."uid"() = ANY ("participants")));



CREATE POLICY "Participants can remove members" ON "public"."voice_thread_participants" FOR DELETE USING ("public"."is_thread_participant"("thread_id", "auth"."uid"()));



CREATE POLICY "Participants can remove tags" ON "public"."voice_thread_tags" FOR DELETE USING ("public"."is_thread_participant"("thread_id", "auth"."uid"()));



CREATE POLICY "Participants can send messages" ON "public"."voice_thread_messages" FOR INSERT WITH CHECK ("public"."is_thread_participant"("thread_id", "auth"."uid"()));



CREATE POLICY "Participants can update thread metadata" ON "public"."voice_threads" FOR UPDATE USING (("auth"."uid"() = ANY ("participants"))) WITH CHECK (("auth"."uid"() = ANY ("participants")));



CREATE POLICY "Project owners can create shares" ON "public"."project_shares" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_projects" "p"
  WHERE (("p"."id" = "project_shares"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Project owners can delete shares" ON "public"."project_shares" FOR DELETE USING ((("auth"."uid"() = "shared_by") OR (EXISTS ( SELECT 1
   FROM "public"."ai_projects" "p"
  WHERE (("p"."id" = "project_shares"."project_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Project owners can update shares" ON "public"."project_shares" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."ai_projects" "p"
  WHERE (("p"."id" = "project_shares"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."user_profiles" FOR SELECT USING ((("is_public" = true) OR ("id" = "auth"."uid"())));



CREATE POLICY "Public read active messages" ON "public"."in_app_messages" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Senders can delete their messages" ON "public"."voice_thread_messages" FOR DELETE USING ((("sender_id" = "auth"."uid"()) AND "public"."is_thread_participant"("thread_id", "auth"."uid"())));



CREATE POLICY "Senders can update their messages" ON "public"."voice_thread_messages" FOR UPDATE USING ((("sender_id" = "auth"."uid"()) AND "public"."is_thread_participant"("thread_id", "auth"."uid"()))) WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_thread_participant"("thread_id", "auth"."uid"())));



COMMENT ON POLICY "Senders can update their messages" ON "public"."voice_thread_messages" IS 'Only the original sender can update their message (e.g., edit transcript, pin)';



CREATE POLICY "Service role can insert logs" ON "public"."api_request_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can create audit logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert activity" ON "public"."activity_feed" FOR INSERT WITH CHECK ((("auth"."uid"() = "actor_id") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "System can manage SSO sessions" ON "public"."sso_sessions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can accept invites to their email" ON "public"."team_invites" FOR UPDATE USING (("lower"("email") = "lower"(("auth"."jwt"() ->> 'email'::"text"))));



CREATE POLICY "Users can access embeddings of visible docs" ON "public"."doc_embeddings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs"
  WHERE (("knowledge_docs"."id" = "doc_embeddings"."doc_id") AND (("knowledge_docs"."is_shared" = true) OR ("knowledge_docs"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can access their own suggestions" ON "public"."smart_suggestions_cache" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can add docs to their collections" ON "public"."collection_docs" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."document_collections" "c"
  WHERE (("c"."id" = "collection_docs"."collection_id") AND ("c"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "collection_docs"."doc_id") AND ("d"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can add favorites" ON "public"."doc_favorites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can add reactions to messages in their threads" ON "public"."voice_message_reactions" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."voice_thread_messages" "m"
  WHERE (("m"."id" = "voice_message_reactions"."message_id") AND "public"."is_thread_participant"("m"."thread_id", "auth"."uid"()))))));



CREATE POLICY "Users can bookmark messages in their threads" ON "public"."voice_message_bookmarks" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."voice_thread_messages" "m"
  WHERE (("m"."id" = "voice_message_bookmarks"."message_id") AND "public"."is_thread_participant"("m"."thread_id", "auth"."uid"()))))));



CREATE POLICY "Users can create annotations on their docs" ON "public"."doc_annotations" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "doc_annotations"."doc_id") AND ("d"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create coaching prompts" ON "public"."coaching_prompts" FOR INSERT TO "authenticated" WITH CHECK (("session_id" IN ( SELECT "coaching_sessions"."id"
   FROM "public"."coaching_sessions"
  WHERE ("coaching_sessions"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create customer alerts" ON "public"."customer_alerts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create customer health history" ON "public"."customer_health_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create customer sentiment" ON "public"."customer_sentiment" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create highlights on their docs" ON "public"."doc_highlights" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "doc_highlights"."doc_id") AND ("d"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create invites for their resources" ON "public"."share_invites" FOR INSERT WITH CHECK (("auth"."uid"() = "invited_by"));



CREATE POLICY "Users can create own blocked senders" ON "public"."blocked_senders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own coaching sessions" ON "public"."coaching_sessions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create own collections" ON "public"."archive_collections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own labels" ON "public"."custom_labels" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_system" = false)));



CREATE POLICY "Users can create own notification rules" ON "public"."notification_rules" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own saved searches" ON "public"."saved_searches" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own smart folders" ON "public"."smart_folders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own vacation responder" ON "public"."vacation_responder" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create predictions" ON "public"."predictions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create recent views" ON "public"."doc_recent_views" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create relationship events" ON "public"."relationship_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create relationships" ON "public"."relationships" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create replies" ON "public"."annotation_replies" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."doc_annotations" "a"
     JOIN "public"."knowledge_docs" "d" ON (("d"."id" = "a"."doc_id")))
  WHERE (("a"."id" = "annotation_replies"."annotation_id") AND ("d"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create shares for own archives" ON "public"."archive_shares" FOR INSERT WITH CHECK (("auth"."uid"() = "shared_by"));



CREATE POLICY "Users can create their own API keys" ON "public"."api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own collections" ON "public"."document_collections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own tags" ON "public"."document_tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own translations" ON "public"."message_translations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create threads" ON "public"."voice_threads" FOR INSERT WITH CHECK (("auth"."uid"() = ANY ("participants")));



CREATE POLICY "Users can delete members from their own teams" ON "public"."team_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_teams"
  WHERE (("user_teams"."id" = "team_members"."team_id") AND ("user_teams"."user_id" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can delete own annotations" ON "public"."user_contact_annotations" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own blocked senders" ON "public"."blocked_senders" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own cached emails" ON "public"."cached_emails" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own collections" ON "public"."archive_collections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own contact interactions" ON "public"."contact_interactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own duplicate contacts" ON "public"."duplicate_contacts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own email contacts" ON "public"."email_contacts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own email templates" ON "public"."email_templates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own email threads" ON "public"."email_threads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own follow ups" ON "public"."email_follow_ups" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own labels" ON "public"."custom_labels" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("is_system" = false)));



CREATE POLICY "Users can delete own lead scores" ON "public"."lead_scores" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own meeting prep cards" ON "public"."meeting_prep_cards" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notification rules" ON "public"."notification_rules" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own relationship alerts" ON "public"."relationship_alerts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own relationship milestones" ON "public"."relationship_milestones" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own relationship profiles" ON "public"."relationship_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own saved searches" ON "public"."saved_searches" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own scheduled emails" ON "public"."scheduled_emails" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own smart contact groups" ON "public"."smart_contact_groups" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own smart folders" ON "public"."smart_folders" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own snoozed emails" ON "public"."snoozed_emails" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own test results" ON "public"."test_matrix_results" FOR DELETE USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" = 'anonymous'::"text")));



CREATE POLICY "Users can delete own vacation responder" ON "public"."vacation_responder" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete relationships" ON "public"."relationships" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete shares they created" ON "public"."archive_shares" FOR DELETE USING (("auth"."uid"() = "shared_by"));



CREATE POLICY "Users can delete their own API keys" ON "public"."api_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own annotations" ON "public"."doc_annotations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own clipboard items" ON "public"."search_clipboard" FOR DELETE USING (((("auth"."uid"())::"text" = "user_id") OR (("auth"."jwt"() ->> 'email'::"text") = "user_id")));



CREATE POLICY "Users can delete their own collections" ON "public"."document_collections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own documents" ON "public"."knowledge_docs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own highlights" ON "public"."doc_highlights" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own recent views" ON "public"."doc_recent_views" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own replies" ON "public"."annotation_replies" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own tags" ON "public"."document_tags" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own teams" ON "public"."user_teams" FOR DELETE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can delete their own thread actions" ON "public"."thread_actions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can edit own documents" ON "public"."knowledge_docs" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can edit own sessions" ON "public"."ai_sessions" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert embeddings for own docs" ON "public"."doc_embeddings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs"
  WHERE (("knowledge_docs"."id" = "doc_embeddings"."doc_id") AND ("knowledge_docs"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert members to their own teams" ON "public"."team_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_teams"
  WHERE (("user_teams"."id" = "team_members"."team_id") AND ("user_teams"."user_id" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can insert messages in visible sessions" ON "public"."ai_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_sessions"
  WHERE (("ai_sessions"."id" = "ai_messages"."session_id") AND (("ai_sessions"."user_id" = "auth"."uid"()) OR ("ai_sessions"."is_public" = true))))));



CREATE POLICY "Users can insert own annotations" ON "public"."user_contact_annotations" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own cached emails" ON "public"."cached_emails" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own contact interactions" ON "public"."contact_interactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own daily briefings" ON "public"."email_daily_briefings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own duplicate contacts" ON "public"."duplicate_contacts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own email contacts" ON "public"."email_contacts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own email templates" ON "public"."email_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own email threads" ON "public"."email_threads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own follow ups" ON "public"."email_follow_ups" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own lead scores" ON "public"."lead_scores" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own meeting prep cards" ON "public"."meeting_prep_cards" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can insert own relationship alerts" ON "public"."relationship_alerts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own relationship milestones" ON "public"."relationship_milestones" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own relationship profiles" ON "public"."relationship_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own scheduled emails" ON "public"."scheduled_emails" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own smart contact groups" ON "public"."smart_contact_groups" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own snoozed emails" ON "public"."snoozed_emails" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own sync state" ON "public"."email_sync_state" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own test results" ON "public"."test_matrix_results" FOR INSERT WITH CHECK (((("auth"."uid"())::"text" = "user_id") OR ("user_id" = 'anonymous'::"text")));



CREATE POLICY "Users can insert own vacation responder logs" ON "public"."vacation_responder_log" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own clipboard items" ON "public"."search_clipboard" FOR INSERT WITH CHECK (((("auth"."uid"())::"text" = "user_id") OR (("auth"."jwt"() ->> 'email'::"text") = "user_id")));



CREATE POLICY "Users can insert their own conversation health" ON "public"."conversation_health" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own teams" ON "public"."user_teams" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can insert their own thread actions" ON "public"."thread_actions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert thinking logs for own messages" ON "public"."ai_thinking_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."ai_messages"
     JOIN "public"."ai_sessions" ON (("ai_messages"."session_id" = "ai_sessions"."id")))
  WHERE (("ai_messages"."id" = "ai_thinking_logs"."message_id") AND ("ai_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage customer health" ON "public"."customer_health" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage docs in own projects" ON "public"."project_docs" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_projects"
  WHERE (("ai_projects"."id" = "project_docs"."project_id") AND ("ai_projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage docs in their sessions" ON "public"."session_docs" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_sessions"
  WHERE (("ai_sessions"."id" = "session_docs"."session_id") AND ("ai_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage own drafts" ON "public"."message_drafts" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own email labels" ON "public"."email_labels" USING ((EXISTS ( SELECT 1
   FROM "public"."cached_emails"
  WHERE (("cached_emails"."id" = "email_labels"."email_id") AND ("cached_emails"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cached_emails"
  WHERE (("cached_emails"."id" = "email_labels"."email_id") AND ("cached_emails"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage own projects" ON "public"."ai_projects" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own achievements" ON "public"."user_achievements" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own contact engagement" ON "public"."analytics_contact_engagement" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own conversation memory" ON "public"."conversation_memory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own daily metrics" ON "public"."analytics_daily_metrics" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own period summaries" ON "public"."analytics_period_summary" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own response times" ON "public"."analytics_response_times" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own saved searches" ON "public"."saved_searches" USING (((("user_id")::"text" = ("auth"."uid"())::"text") OR (("user_id")::"text" = COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))));



CREATE POLICY "Users can manage their own search history" ON "public"."search_history" USING (((("user_id")::"text" = ("auth"."uid"())::"text") OR (("user_id")::"text" = COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))));



CREATE POLICY "Users can manage their own statistics" ON "public"."user_message_statistics" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark their activity as read" ON "public"."activity_feed" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own test results" ON "public"."test_matrix_results" FOR SELECT USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" = 'anonymous'::"text")));



CREATE POLICY "Users can remove docs from their collections" ON "public"."collection_docs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."document_collections" "c"
  WHERE (("c"."id" = "collection_docs"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can remove favorites" ON "public"."doc_favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove tags from their docs" ON "public"."doc_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "doc_tags"."doc_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can remove their own bookmarks" ON "public"."voice_message_bookmarks" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can remove their own reactions" ON "public"."voice_message_reactions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can send messages" ON "public"."pulse_messages" FOR INSERT WITH CHECK (("sender_id" = "auth"."uid"()));



CREATE POLICY "Users can tag their own docs" ON "public"."doc_tags" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "doc_tags"."doc_id") AND ("d"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."document_tags" "t"
  WHERE (("t"."id" = "doc_tags"."tag_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update customer alerts" ON "public"."customer_alerts" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update docs in their collections" ON "public"."collection_docs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."document_collections" "c"
  WHERE (("c"."id" = "collection_docs"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update members of their own teams" ON "public"."team_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_teams"
  WHERE (("user_teams"."id" = "team_members"."team_id") AND ("user_teams"."user_id" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can update own annotations" ON "public"."user_contact_annotations" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own blocked senders" ON "public"."blocked_senders" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own cached emails" ON "public"."cached_emails" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own coaching prompts" ON "public"."coaching_prompts" FOR UPDATE TO "authenticated" USING (("session_id" IN ( SELECT "coaching_sessions"."id"
   FROM "public"."coaching_sessions"
  WHERE ("coaching_sessions"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own coaching sessions" ON "public"."coaching_sessions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own collections" ON "public"."archive_collections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own contact interactions" ON "public"."contact_interactions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own daily briefings" ON "public"."email_daily_briefings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own duplicate contacts" ON "public"."duplicate_contacts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own email contacts" ON "public"."email_contacts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own email templates" ON "public"."email_templates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own email threads" ON "public"."email_threads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own follow ups" ON "public"."email_follow_ups" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own labels" ON "public"."custom_labels" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("is_system" = false))) WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_system" = false)));



CREATE POLICY "Users can update own lead scores" ON "public"."lead_scores" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own meeting prep cards" ON "public"."meeting_prep_cards" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notification rules" ON "public"."notification_rules" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own relationship alerts" ON "public"."relationship_alerts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own relationship milestones" ON "public"."relationship_milestones" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own relationship profiles" ON "public"."relationship_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own saved searches" ON "public"."saved_searches" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own scheduled emails" ON "public"."scheduled_emails" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own smart contact groups" ON "public"."smart_contact_groups" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own smart folders" ON "public"."smart_folders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own snoozed emails" ON "public"."snoozed_emails" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own sync state" ON "public"."email_sync_state" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own test results" ON "public"."test_matrix_results" FOR UPDATE USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" = 'anonymous'::"text")));



CREATE POLICY "Users can update own vacation responder" ON "public"."vacation_responder" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update relationships" ON "public"."relationships" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update their conversations" ON "public"."pulse_conversations" FOR UPDATE USING ((("user1_id" = "auth"."uid"()) OR ("user2_id" = "auth"."uid"())));



CREATE POLICY "Users can update their own API keys" ON "public"."api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own annotations" ON "public"."doc_annotations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own clipboard items" ON "public"."search_clipboard" FOR UPDATE USING (((("auth"."uid"())::"text" = "user_id") OR (("auth"."jwt"() ->> 'email'::"text") = "user_id")));



CREATE POLICY "Users can update their own collections" ON "public"."document_collections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own conversation health" ON "public"."conversation_health" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own highlights" ON "public"."doc_highlights" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own participant record" ON "public"."voice_thread_participants" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own recent views" ON "public"."doc_recent_views" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own replies" ON "public"."annotation_replies" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tags" ON "public"."document_tags" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own teams" ON "public"."user_teams" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can update their own thread actions" ON "public"."thread_actions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their sent messages" ON "public"."pulse_messages" FOR UPDATE USING ((("sender_id" = "auth"."uid"()) OR ("recipient_id" = "auth"."uid"())));



CREATE POLICY "Users can upload documents" ON "public"."knowledge_docs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view active coaching keywords" ON "public"."coaching_keywords" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Users can view annotations on docs they can access" ON "public"."doc_annotations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "doc_annotations"."doc_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view channel members" ON "public"."channel_members" FOR SELECT USING (("channel_id" IN ( SELECT "channel_members_1"."channel_id"
   FROM "public"."channel_members" "channel_members_1"
  WHERE ("channel_members_1"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view channels they're members of" ON "public"."message_channels" FOR SELECT USING ((("is_public" = true) OR ("id" IN ( SELECT "channel_members"."channel_id"
   FROM "public"."channel_members"
  WHERE ("channel_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view customer alerts" ON "public"."customer_alerts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view customer health" ON "public"."customer_health" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view customer health history" ON "public"."customer_health_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view customer sentiment" ON "public"."customer_sentiment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view docs in their collections" ON "public"."collection_docs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."document_collections" "c"
  WHERE (("c"."id" = "collection_docs"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view highlights on docs they can access" ON "public"."doc_highlights" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "doc_highlights"."doc_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view invites to their email" ON "public"."team_invites" FOR SELECT USING (("lower"("email") = "lower"(("auth"."jwt"() ->> 'email'::"text"))));



CREATE POLICY "Users can view members of their own teams" ON "public"."team_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_teams"
  WHERE (("user_teams"."id" = "team_members"."team_id") AND ("user_teams"."user_id" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can view messages in their threads" ON "public"."voice_thread_messages" FOR SELECT USING (("public"."is_thread_participant"("thread_id", "auth"."uid"()) AND ("is_deleted" = false)));



COMMENT ON POLICY "Users can view messages in their threads" ON "public"."voice_thread_messages" IS 'Users can only view messages in threads they participate in, excluding deleted messages';



CREATE POLICY "Users can view messages in visible sessions" ON "public"."ai_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ai_sessions"
  WHERE (("ai_sessions"."id" = "ai_messages"."session_id") AND (("ai_sessions"."user_id" = "auth"."uid"()) OR ("ai_sessions"."is_public" = true))))));



CREATE POLICY "Users can view own SSO sessions" ON "public"."sso_sessions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "Users can view own annotations" ON "public"."user_contact_annotations" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own blocked senders" ON "public"."blocked_senders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own cached emails" ON "public"."cached_emails" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own coaching prompts" ON "public"."coaching_prompts" FOR SELECT TO "authenticated" USING (("session_id" IN ( SELECT "coaching_sessions"."id"
   FROM "public"."coaching_sessions"
  WHERE ("coaching_sessions"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own coaching sessions" ON "public"."coaching_sessions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own collections" ON "public"."archive_collections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own contact interactions" ON "public"."contact_interactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own daily briefings" ON "public"."email_daily_briefings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own duplicate contacts" ON "public"."duplicate_contacts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own email contacts" ON "public"."email_contacts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own email labels" ON "public"."email_labels" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cached_emails"
  WHERE (("cached_emails"."id" = "email_labels"."email_id") AND ("cached_emails"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own email templates" ON "public"."email_templates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own email threads" ON "public"."email_threads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own follow ups" ON "public"."email_follow_ups" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own labels" ON "public"."custom_labels" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own lead scores" ON "public"."lead_scores" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own meeting prep cards" ON "public"."meeting_prep_cards" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notification rules" ON "public"."notification_rules" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own or public sessions" ON "public"."ai_sessions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("is_public" = true)));



CREATE POLICY "Users can view own relationship alerts" ON "public"."relationship_alerts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own relationship milestones" ON "public"."relationship_milestones" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own relationship profiles" ON "public"."relationship_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own role assignments" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view own saved searches" ON "public"."saved_searches" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own scheduled emails" ON "public"."scheduled_emails" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own smart contact groups" ON "public"."smart_contact_groups" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own smart folders" ON "public"."smart_folders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own snoozed emails" ON "public"."snoozed_emails" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own sync state" ON "public"."email_sync_state" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own vacation responder" ON "public"."vacation_responder" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own vacation responder logs" ON "public"."vacation_responder_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view participant records for their threads" ON "public"."voice_thread_participants" FOR SELECT USING ("public"."is_thread_participant"("thread_id", "auth"."uid"()));



CREATE POLICY "Users can view predictions" ON "public"."predictions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view reactions in their threads" ON "public"."voice_message_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."voice_thread_messages" "m"
  WHERE (("m"."id" = "voice_message_reactions"."message_id") AND "public"."is_thread_participant"("m"."thread_id", "auth"."uid"())))));



CREATE POLICY "Users can view relationship events" ON "public"."relationship_events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view relationships" ON "public"."relationships" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view replies on annotations they can access" ON "public"."annotation_replies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."doc_annotations" "a"
     JOIN "public"."knowledge_docs" "d" ON (("d"."id" = "a"."doc_id")))
  WHERE (("a"."id" = "annotation_replies"."annotation_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view retention policies" ON "public"."retention_policies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view roles" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view shared documents" ON "public"."knowledge_docs" FOR SELECT USING ((("is_shared" = true) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can view shares for their archives" ON "public"."archive_shares" FOR SELECT USING ((("auth"."uid"() = "shared_by") OR ("auth"."uid"() = "shared_with")));



CREATE POLICY "Users can view shares for their docs or shared with them" ON "public"."document_shares" FOR SELECT USING ((("auth"."uid"() = "shared_by") OR ("auth"."uid"() = "shared_with_user") OR (EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "document_shares"."doc_id") AND ("d"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view shares for their projects or shared with them" ON "public"."project_shares" FOR SELECT USING ((("auth"."uid"() = "shared_by") OR ("auth"."uid"() = "shared_with_user") OR (EXISTS ( SELECT 1
   FROM "public"."ai_projects" "p"
  WHERE (("p"."id" = "project_shares"."project_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view suggestions for own sessions" ON "public"."ai_prompt_suggestions" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_sessions"
  WHERE (("ai_sessions"."id" = "ai_prompt_suggestions"."session_id") AND ("ai_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view tags on their docs" ON "public"."doc_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_docs" "d"
  WHERE (("d"."id" = "doc_tags"."doc_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view tags on their threads" ON "public"."voice_thread_tags" FOR SELECT USING ("public"."is_thread_participant"("thread_id", "auth"."uid"()));



CREATE POLICY "Users can view their conversations" ON "public"."pulse_conversations" FOR SELECT USING ((("user1_id" = "auth"."uid"()) OR ("user2_id" = "auth"."uid"())));



CREATE POLICY "Users can view their messages" ON "public"."pulse_messages" FOR SELECT USING ((("sender_id" = "auth"."uid"()) OR ("recipient_id" = "auth"."uid"())));



CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own API request logs" ON "public"."api_request_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own achievements" ON "public"."user_achievements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own activity or activity in shared resourc" ON "public"."activity_feed" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "actor_id") OR (EXISTS ( SELECT 1
   FROM "public"."document_shares" "ds"
  WHERE (("ds"."doc_id" = "activity_feed"."doc_id") AND ("ds"."shared_with_user" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_shares" "ps"
  WHERE (("ps"."project_id" = "activity_feed"."project_id") AND ("ps"."shared_with_user" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own bookmarks" ON "public"."voice_message_bookmarks" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own clipboard items" ON "public"."search_clipboard" FOR SELECT USING (((("auth"."uid"())::"text" = "user_id") OR (("auth"."jwt"() ->> 'email'::"text") = "user_id")));



CREATE POLICY "Users can view their own collections" ON "public"."document_collections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own contact engagement" ON "public"."analytics_contact_engagement" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own conversation health" ON "public"."conversation_health" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own conversation memory" ON "public"."conversation_memory" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own daily metrics" ON "public"."analytics_daily_metrics" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own favorites" ON "public"."doc_favorites" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own period summaries" ON "public"."analytics_period_summary" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own rate limits" ON "public"."api_rate_limits" FOR SELECT USING (("api_key_id" IN ( SELECT "api_keys"."id"
   FROM "public"."api_keys"
  WHERE ("api_keys"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own recent views" ON "public"."doc_recent_views" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own response times" ON "public"."analytics_response_times" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own statistics" ON "public"."user_message_statistics" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tags" ON "public"."document_tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own teams" ON "public"."user_teams" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view their own thread actions" ON "public"."thread_actions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own translations" ON "public"."message_translations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their sent invites" ON "public"."team_invites" FOR SELECT USING (("auth"."uid"() = "invited_by"));



CREATE POLICY "Users can view thinking logs for own sessions" ON "public"."ai_thinking_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."ai_messages"
     JOIN "public"."ai_sessions" ON (("ai_messages"."session_id" = "ai_sessions"."id")))
  WHERE (("ai_messages"."id" = "ai_thinking_logs"."message_id") AND ("ai_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view threads they participate in" ON "public"."voice_threads" FOR SELECT USING (("auth"."uid"() = ANY ("participants")));



COMMENT ON POLICY "Users can view threads they participate in" ON "public"."voice_threads" IS 'Users can only see threads where they are listed in the participants array';



ALTER TABLE "public"."activity_feed" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_logs_insert_policy" ON "public"."admin_activity_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "activity_logs_read_policy" ON "public"."admin_activity_logs" FOR SELECT USING (true);



ALTER TABLE "public"."admin_activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_settings_policy" ON "public"."admin_settings" USING (true) WITH CHECK (true);



CREATE POLICY "admins_manage_crm" ON "public"."crm_integrations" USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "auth"."users"
  WHERE (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text"))));



ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_prompt_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_thinking_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_contact_engagement" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_daily_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_period_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_response_times" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annotation_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_request_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."archive_collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."archive_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attention_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attention_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_senders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cached_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channels_policy" ON "public"."channels" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaching_keywords" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaching_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaching_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cohorts_policy" ON "public"."user_retention_cohorts" USING (true) WITH CHECK (true);



ALTER TABLE "public"."collection_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_deals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_sidepanels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_health_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_sentiment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decision_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_highlights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_recent_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."duplicate_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_daily_briefings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_follow_ups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_sync_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ephemeral_workspaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."extracted_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."focus_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "graphs_policy" ON "public"."conversation_graphs" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."in_app_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_field_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_prep_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_translations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outcome_blockers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outcome_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."predictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_blockers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_channel_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_context_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_nudges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_outcomes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_typing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quick_vox_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quick_vox_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quick_vox_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationship_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationship_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationship_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationship_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reserved_handles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."retention_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_clipboard" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."share_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smart_contact_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smart_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smart_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smart_suggestions_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snoozed_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sso_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sso_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sync_state_policy" ON "public"."message_sync_state" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_vox_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_matrix_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_contact_annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_message_statistics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_retention_cohorts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_access_own_retention" ON "public"."user_retention_cohorts" USING (true);



CREATE POLICY "users_create_crm_actions" ON "public"."crm_actions" FOR INSERT WITH CHECK (("auth"."uid"() = "triggered_by_user_id"));



CREATE POLICY "users_manage_own_sidepanels" ON "public"."crm_sidepanels";



CREATE POLICY "users_policy" ON "public"."users" USING (("auth"."uid"() = "id"));



CREATE POLICY "users_view_crm_companies" ON "public"."crm_companies" FOR SELECT USING (true);



CREATE POLICY "users_view_crm_contacts" ON "public"."crm_contacts" FOR SELECT USING (true);



CREATE POLICY "users_view_crm_deals" ON "public"."crm_deals" FOR SELECT USING (true);



CREATE POLICY "users_view_own_sidepanels" ON "public"."crm_sidepanels" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."vacation_responder" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vacation_responder_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_vox_ai_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_vox_bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_vox_conversation_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_vox_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_vox_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_vox_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_vox_read_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_message_bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_thread_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_thread_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_thread_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vox_drops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vox_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vox_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vox_team_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vox_workspaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_outcomes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_participants" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pulse_conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pulse_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."voice_message_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."voice_thread_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."voice_thread_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."voice_threads";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."acknowledge_alert"("p_alert_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."acknowledge_alert"("p_alert_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."acknowledge_alert"("p_alert_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_email_filters"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_email_filters"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_email_filters"() TO "service_role";



GRANT ALL ON FUNCTION "public"."archives_search_vector_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."archives_search_vector_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."archives_search_vector_update"() TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid", "p_granted_by" "uuid", "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."assign_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid", "p_granted_by" "uuid", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid", "p_granted_by" "uuid", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON TABLE "public"."customer_health" TO "anon";
GRANT ALL ON TABLE "public"."customer_health" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_health" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_customer_health"("p_customer_id" "text", "p_sentiment_factor" integer, "p_engagement_factor" integer, "p_responsiveness_factor" integer, "p_deal_progress_factor" integer, "p_task_completion_factor" integer, "p_last_interaction" timestamp with time zone, "p_interaction_count_30d" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_customer_health"("p_customer_id" "text", "p_sentiment_factor" integer, "p_engagement_factor" integer, "p_responsiveness_factor" integer, "p_deal_progress_factor" integer, "p_task_completion_factor" integer, "p_last_interaction" timestamp with time zone, "p_interaction_count_30d" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_customer_health"("p_customer_id" "text", "p_sentiment_factor" integer, "p_engagement_factor" integer, "p_responsiveness_factor" integer, "p_deal_progress_factor" integer, "p_task_completion_factor" integer, "p_last_interaction" timestamp with time zone, "p_interaction_count_30d" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_engagement_score"("p_total_messages" integer, "p_response_rate" numeric, "p_avg_response_time" numeric, "p_days_since_last" integer, "p_avg_sentiment" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_engagement_score"("p_total_messages" integer, "p_response_rate" numeric, "p_avg_response_time" numeric, "p_days_since_last" integer, "p_avg_sentiment" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_engagement_score"("p_total_messages" integer, "p_response_rate" numeric, "p_avg_response_time" numeric, "p_days_since_last" integer, "p_avg_sentiment" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_relationship_score"("p_response_rate" double precision, "p_avg_response_hours" double precision, "p_days_since_interaction" integer, "p_total_interactions" integer, "p_sentiment_avg" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_relationship_score"("p_response_rate" double precision, "p_avg_response_hours" double precision, "p_days_since_interaction" integer, "p_total_interactions" integer, "p_sentiment_avg" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_relationship_score"("p_response_rate" double precision, "p_avg_response_hours" double precision, "p_days_since_interaction" integer, "p_total_interactions" integer, "p_sentiment_avg" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_response_rate"("p_user_id" "uuid", "p_contact_identifier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_response_rate"("p_user_id" "uuid", "p_contact_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_response_rate"("p_user_id" "uuid", "p_contact_identifier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_decision_threshold"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_decision_threshold"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_decision_threshold"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_filter_match"("p_email" "record", "p_filter" "record") TO "anon";
GRANT ALL ON FUNCTION "public"."check_filter_match"("p_email" "record", "p_filter" "record") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_filter_match"("p_email" "record", "p_filter" "record") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_suggestions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_suggestions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_suggestions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_request_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_request_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_request_logs"() TO "service_role";



GRANT ALL ON TABLE "public"."integration_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."integration_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_sync_logs" TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_integration_sync"("p_sync_id" "uuid", "p_records_processed" integer, "p_records_succeeded" integer, "p_records_failed" integer, "p_status" "text", "p_error_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_integration_sync"("p_sync_id" "uuid", "p_records_processed" integer, "p_records_succeeded" integer, "p_records_failed" integer, "p_status" "text", "p_error_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_integration_sync"("p_sync_id" "uuid", "p_records_processed" integer, "p_records_succeeded" integer, "p_records_failed" integer, "p_status" "text", "p_error_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_custom_role"("p_tenant_id" "uuid", "p_name" "text", "p_display_name" "text", "p_description" "text", "p_permissions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_custom_role"("p_tenant_id" "uuid", "p_name" "text", "p_display_name" "text", "p_description" "text", "p_permissions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_custom_role"("p_tenant_id" "uuid", "p_name" "text", "p_display_name" "text", "p_description" "text", "p_permissions" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."customer_alerts" TO "anon";
GRANT ALL ON TABLE "public"."customer_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_alerts" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_customer_alert"("p_customer_id" "text", "p_alert_type" "text", "p_severity" "text", "p_message" "text", "p_suggested_action" "text", "p_context" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_customer_alert"("p_customer_id" "text", "p_alert_type" "text", "p_severity" "text", "p_message" "text", "p_suggested_action" "text", "p_context" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_customer_alert"("p_customer_id" "text", "p_alert_type" "text", "p_severity" "text", "p_message" "text", "p_suggested_action" "text", "p_context" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."webhooks" TO "anon";
GRANT ALL ON TABLE "public"."webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."webhooks" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_webhook"("p_name" "text", "p_url" "text", "p_events" "text"[], "p_filters" "jsonb", "p_custom_headers" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_webhook"("p_name" "text", "p_url" "text", "p_events" "text"[], "p_filters" "jsonb", "p_custom_headers" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_webhook"("p_name" "text", "p_url" "text", "p_events" "text"[], "p_filters" "jsonb", "p_custom_headers" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_follower_count"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_follower_count"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_follower_count"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_following_count"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_following_count"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_following_count"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."end_coaching_session"("p_session_id" "uuid", "p_talk_time_percentage" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."end_coaching_session"("p_session_id" "uuid", "p_talk_time_percentage" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_coaching_session"("p_session_id" "uuid", "p_talk_time_percentage" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."evaluate_all_customer_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."evaluate_all_customer_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."evaluate_all_customer_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."evaluate_customer_alerts"("p_customer_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."evaluate_customer_alerts"("p_customer_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."evaluate_customer_alerts"("p_customer_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_old_invites"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_invites"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_invites"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_api_key"("p_user_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_rate_limit" integer, "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_api_key"("p_user_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_rate_limit" integer, "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_api_key"("p_user_id" "uuid", "p_name" "text", "p_scopes" "text"[], "p_rate_limit" integer, "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_public_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_public_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_public_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_alert_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_alert_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_alert_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_alerts_by_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_alerts_by_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_alerts_by_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_analytics_dashboard"("p_user_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_analytics_dashboard"("p_user_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_analytics_dashboard"("p_user_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_audit_statistics"("p_tenant_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_audit_statistics"("p_tenant_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_audit_statistics"("p_tenant_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_avg_response_time"("p_user_id" "uuid", "p_contact_identifier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_avg_response_time"("p_user_id" "uuid", "p_contact_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_avg_response_time"("p_user_id" "uuid", "p_contact_identifier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_batch_thread_unread_counts"("p_thread_ids" "uuid"[], "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_batch_thread_unread_counts"("p_thread_ids" "uuid"[], "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_batch_thread_unread_counts"("p_thread_ids" "uuid"[], "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coaching_stats"("p_user_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_coaching_stats"("p_user_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coaching_stats"("p_user_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_communication_frequency"("p_total_interactions" integer, "p_first_interaction_at" timestamp with time zone, "p_last_interaction_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_communication_frequency"("p_total_interactions" integer, "p_first_interaction_at" timestamp with time zone, "p_last_interaction_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_communication_frequency"("p_total_interactions" integer, "p_first_interaction_at" timestamp with time zone, "p_last_interaction_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_communication_trends"("p_user_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_communication_trends"("p_user_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_communication_trends"("p_user_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_avg_sentiment"("p_customer_id" "text", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_avg_sentiment"("p_customer_id" "text", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_avg_sentiment"("p_customer_id" "text", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customers_needing_attention"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customers_needing_attention"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customers_needing_attention"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_doc_by_public_link"("link" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_doc_by_public_link"("link" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_doc_by_public_link"("link" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_doc_permissions"("check_user_id" "uuid", "check_doc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_doc_permissions"("check_user_id" "uuid", "check_doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_doc_permissions"("check_user_id" "uuid", "check_doc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_enriched_user_profile"("p_requesting_user_id" "uuid", "p_target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_enriched_user_profile"("p_requesting_user_id" "uuid", "p_target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_enriched_user_profile"("p_requesting_user_id" "uuid", "p_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_health_distribution"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_health_distribution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_health_distribution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_last_active_status"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_last_active_status"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_last_active_status"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_lead_grade"("score" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_lead_grade"("score" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_lead_grade"("score" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_message_metrics"("message_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_message_metrics"("message_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_message_metrics"("message_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_message_reaction_counts"("p_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_message_reaction_counts"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_message_reaction_counts"("p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_online_users_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_online_users_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_online_users_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("user_a" "uuid", "user_b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("user_a" "uuid", "user_b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("user_a" "uuid", "user_b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_dm_channel"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_dm_channel"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_dm_channel"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_email_thread"("p_thread_id" "text", "p_user_id" "uuid", "p_subject" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_email_thread"("p_thread_id" "text", "p_user_id" "uuid", "p_subject" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_email_thread"("p_thread_id" "text", "p_user_id" "uuid", "p_subject" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_relationship_profile"("p_user_id" "uuid", "p_contact_email" "text", "p_contact_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_relationship_profile"("p_user_id" "uuid", "p_contact_email" "text", "p_contact_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_relationship_profile"("p_user_id" "uuid", "p_contact_email" "text", "p_contact_name" "text") TO "service_role";



GRANT ALL ON TABLE "public"."thread_actions" TO "anon";
GRANT ALL ON TABLE "public"."thread_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_actions" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_thread_actions"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_thread_actions"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_thread_actions"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_video_vox_conversation"("p_participant_ids" "uuid"[], "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_video_vox_conversation"("p_participant_ids" "uuid"[], "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_video_vox_conversation"("p_participant_ids" "uuid"[], "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_retention_by_engagement"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_retention_by_engagement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_retention_by_engagement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_retention_by_message_exposure"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_retention_by_message_exposure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_retention_by_message_exposure"() TO "service_role";



GRANT ALL ON TABLE "public"."retention_policies" TO "anon";
GRANT ALL ON TABLE "public"."retention_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."retention_policies" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_retention_policy"("p_resource_type" "text", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_retention_policy"("p_resource_type" "text", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_retention_policy"("p_resource_type" "text", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_role_by_name"("p_role_name" "text", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_role_by_name"("p_role_name" "text", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_role_by_name"("p_role_name" "text", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_smart_collection_docs"("collection_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_smart_collection_docs"("collection_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_smart_collection_docs"("collection_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_thread_unread_count"("p_thread_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_thread_unread_count"("p_thread_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_thread_unread_count"("p_thread_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_webhook_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_webhook_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_webhook_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_webhooks_for_event"("p_event_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_webhooks_for_event"("p_event_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_webhooks_for_event"("p_event_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_vacation_responder"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_vacation_responder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_vacation_responder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."health_score_to_label"("score" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."health_score_to_label"("score" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."health_score_to_label"("score" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_follower_count"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_follower_count"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_follower_count"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_following_count"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_following_count"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_following_count"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_messages_clicked"("user_uuid" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_messages_clicked"("user_uuid" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_messages_clicked"("user_uuid" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_messages_clicked"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_messages_clicked"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_messages_clicked"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_messages_seen"("user_uuid" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_messages_seen"("user_uuid" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_messages_seen"("user_uuid" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_messages_seen"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_messages_seen"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_messages_seen"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_search_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_search_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_search_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_session_counter"("p_session_id" "uuid", "p_column_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_session_counter"("p_session_id" "uuid", "p_column_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_session_counter"("p_session_id" "uuid", "p_column_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_user_stat"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_user_stat"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_user_stat"("p_user_id" "uuid", "p_stat_name" "text", "p_increment" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_video_vox_unread"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_video_vox_unread"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_video_vox_unread"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_webhook_failures"("p_webhook_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_webhook_failures"("p_webhook_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_webhook_failures"("p_webhook_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_user_smart_lists"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_user_smart_lists"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_user_smart_lists"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."invalidate_sso_session"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invalidate_sso_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invalidate_sso_session"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."invalidate_user_sso_sessions"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invalidate_user_sso_sessions"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invalidate_user_sso_sessions"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_handle_available"("check_handle" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_handle_available"("check_handle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_handle_available"("check_handle" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_thread_participant"("thread_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_thread_participant"("thread_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_thread_participant"("thread_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_resource_id" "text", "p_details" "jsonb", "p_changes" "jsonb", "p_status" "text", "p_error_message" "text", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" "text", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_resource_id" "text", "p_details" "jsonb", "p_changes" "jsonb", "p_status" "text", "p_error_message" "text", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" "text", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_resource_id" "text", "p_details" "jsonb", "p_changes" "jsonb", "p_status" "text", "p_error_message" "text", "p_ip_address" "inet", "p_user_agent" "text", "p_request_id" "text", "p_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_integration_sync"("p_integration_id" "uuid", "p_sync_type" "text", "p_direction" "text", "p_entity_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_integration_sync"("p_integration_id" "uuid", "p_sync_type" "text", "p_direction" "text", "p_entity_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_integration_sync"("p_integration_id" "uuid", "p_sync_type" "text", "p_direction" "text", "p_entity_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_relationship_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_relationship_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_relationship_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_inactive_users"("p_timeout_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_inactive_users"("p_timeout_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_inactive_users"("p_timeout_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_thread_as_read"("p_thread_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_thread_as_read"("p_thread_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_thread_as_read"("p_thread_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_circular_label_nesting"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_circular_label_nesting"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_circular_label_nesting"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_deleted_relationships"("p_older_than_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_deleted_relationships"("p_older_than_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_deleted_relationships"("p_older_than_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."query_audit_logs"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."query_audit_logs"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."query_audit_logs"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_category" "text", "p_resource_type" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_all_engagement_scores"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_all_engagement_scores"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_all_engagement_scores"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_activity"("p_user_id" "uuid", "p_actor_id" "uuid", "p_action" character varying, "p_project_id" "uuid", "p_doc_id" "uuid", "p_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."record_activity"("p_user_id" "uuid", "p_actor_id" "uuid", "p_action" character varying, "p_project_id" "uuid", "p_doc_id" "uuid", "p_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_activity"("p_user_id" "uuid", "p_actor_id" "uuid", "p_action" character varying, "p_project_id" "uuid", "p_doc_id" "uuid", "p_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_role"("p_user_id" "uuid", "p_role_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_webhook_failures"("p_webhook_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_webhook_failures"("p_webhook_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_webhook_failures"("p_webhook_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_alert"("p_alert_id" "uuid", "p_user_id" "uuid", "p_resolution_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_alert"("p_alert_id" "uuid", "p_user_id" "uuid", "p_resolution_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_alert"("p_alert_id" "uuid", "p_user_id" "uuid", "p_resolution_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_relationship"("p_relationship_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_relationship"("p_relationship_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_relationship"("p_relationship_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_users"("search_query" "text", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_users"("search_query" "text", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_users"("search_query" "text", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_pulse_message"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_content" "text", "p_content_type" "text", "p_media_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_pulse_message"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_content" "text", "p_content_type" "text", "p_media_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_pulse_message"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_content" "text", "p_content_type" "text", "p_media_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sentiment_score_to_label"("score" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."sentiment_score_to_label"("score" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sentiment_score_to_label"("score" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_canonical_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_canonical_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_canonical_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_relationship"("p_relationship_id" "uuid", "p_deleted_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_relationship"("p_relationship_id" "uuid", "p_deleted_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_relationship"("p_relationship_id" "uuid", "p_deleted_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_voice_thread_participants"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_voice_thread_participants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_voice_thread_participants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_thread_archive"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_thread_archive"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_thread_archive"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_thread_mute"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_thread_mute"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_thread_mute"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_thread_pin"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_thread_pin"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_thread_pin"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_thread_star"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_thread_star"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_thread_star"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_blocked_senders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_blocked_senders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_blocked_senders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contact_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_nickname" "text", "p_custom_notes" "text", "p_custom_tags" "text"[], "p_custom_phone" "text", "p_custom_email" "text", "p_custom_birthday" "date", "p_custom_company" "text", "p_custom_role" "text", "p_custom_address" "text", "p_is_favorite" boolean, "p_is_blocked" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_contact_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_nickname" "text", "p_custom_notes" "text", "p_custom_tags" "text"[], "p_custom_phone" "text", "p_custom_email" "text", "p_custom_birthday" "date", "p_custom_company" "text", "p_custom_role" "text", "p_custom_address" "text", "p_is_favorite" boolean, "p_is_blocked" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contact_annotation"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_nickname" "text", "p_custom_notes" "text", "p_custom_tags" "text"[], "p_custom_phone" "text", "p_custom_email" "text", "p_custom_birthday" "date", "p_custom_company" "text", "p_custom_role" "text", "p_custom_address" "text", "p_is_favorite" boolean, "p_is_blocked" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contact_recency"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_contact_recency"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contact_recency"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_custom_label_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_custom_label_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_custom_label_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_metrics"("p_user_id" "uuid", "p_date" "date", "p_channel" "text", "p_is_sent" boolean, "p_sentiment_score" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_metrics"("p_user_id" "uuid", "p_date" "date", "p_channel" "text", "p_is_sent" boolean, "p_sentiment_score" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_metrics"("p_user_id" "uuid", "p_date" "date", "p_channel" "text", "p_is_sent" boolean, "p_sentiment_score" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_contact_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_contact_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_contact_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_thread_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_thread_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_thread_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_label_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_label_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_label_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_label_unread_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_label_unread_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_label_unread_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_rules_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_rules_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_rules_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_outcome_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_outcome_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_outcome_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_stats_from_interaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_stats_from_interaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_stats_from_interaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_saved_search_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_saved_search_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_saved_search_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_saved_searches_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_saved_searches_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_saved_searches_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_search_clipboard_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_search_clipboard_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_search_clipboard_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_search_history_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_search_history_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_search_history_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_presence"("p_user_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_presence"("p_user_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_presence"("p_user_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vacation_responder_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_vacation_responder_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vacation_responder_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_video_vox_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_video_vox_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_video_vox_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_video_vox_thread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_video_vox_thread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_video_vox_thread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_voice_thread_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_voice_thread_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_voice_thread_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_doc_access"("check_user_id" "uuid", "check_doc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_doc_access"("check_user_id" "uuid", "check_doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_doc_access"("check_user_id" "uuid", "check_doc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_permission"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_api_key"("p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_api_key"("p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_api_key"("p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."action_items" TO "anon";
GRANT ALL ON TABLE "public"."action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."action_items" TO "service_role";



GRANT ALL ON TABLE "public"."activity_feed" TO "anon";
GRANT ALL ON TABLE "public"."activity_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_feed" TO "service_role";



GRANT ALL ON TABLE "public"."admin_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_settings" TO "anon";
GRANT ALL ON TABLE "public"."admin_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_settings" TO "service_role";



GRANT ALL ON TABLE "public"."agent_execution_logs" TO "anon";
GRANT ALL ON TABLE "public"."agent_execution_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_execution_logs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_run_steps" TO "anon";
GRANT ALL ON TABLE "public"."agent_run_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_run_steps" TO "service_role";



GRANT ALL ON TABLE "public"."agent_runs" TO "anon";
GRANT ALL ON TABLE "public"."agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents" TO "anon";
GRANT ALL ON TABLE "public"."ai_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents" TO "service_role";



GRANT ALL ON TABLE "public"."ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_projects" TO "anon";
GRANT ALL ON TABLE "public"."ai_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_projects" TO "service_role";



GRANT ALL ON TABLE "public"."ai_prompt_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."ai_prompt_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_prompt_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ai_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_thinking_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_thinking_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_thinking_logs" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_contact_engagement" TO "anon";
GRANT ALL ON TABLE "public"."analytics_contact_engagement" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_contact_engagement" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_daily_metrics" TO "anon";
GRANT ALL ON TABLE "public"."analytics_daily_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_daily_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_period_summary" TO "anon";
GRANT ALL ON TABLE "public"."analytics_period_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_period_summary" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_response_times" TO "anon";
GRANT ALL ON TABLE "public"."analytics_response_times" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_response_times" TO "service_role";



GRANT ALL ON TABLE "public"."annotation_replies" TO "anon";
GRANT ALL ON TABLE "public"."annotation_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."annotation_replies" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."api_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."api_request_logs" TO "anon";
GRANT ALL ON TABLE "public"."api_request_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."api_request_logs" TO "service_role";



GRANT ALL ON TABLE "public"."archive_collections" TO "anon";
GRANT ALL ON TABLE "public"."archive_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."archive_collections" TO "service_role";



GRANT ALL ON TABLE "public"."archive_shares" TO "anon";
GRANT ALL ON TABLE "public"."archive_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."archive_shares" TO "service_role";



GRANT ALL ON TABLE "public"."archives" TO "anon";
GRANT ALL ON TABLE "public"."archives" TO "authenticated";
GRANT ALL ON TABLE "public"."archives" TO "service_role";



GRANT ALL ON TABLE "public"."attention_logs" TO "anon";
GRANT ALL ON TABLE "public"."attention_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."attention_logs" TO "service_role";



GRANT ALL ON TABLE "public"."attention_settings" TO "anon";
GRANT ALL ON TABLE "public"."attention_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."attention_settings" TO "service_role";



GRANT ALL ON TABLE "public"."automation_logs" TO "anon";
GRANT ALL ON TABLE "public"."automation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."automation_templates" TO "anon";
GRANT ALL ON TABLE "public"."automation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_templates" TO "service_role";



GRANT ALL ON TABLE "public"."automations" TO "anon";
GRANT ALL ON TABLE "public"."automations" TO "authenticated";
GRANT ALL ON TABLE "public"."automations" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_senders" TO "anon";
GRANT ALL ON TABLE "public"."blocked_senders" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_senders" TO "service_role";



GRANT ALL ON TABLE "public"."broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."cached_emails" TO "anon";
GRANT ALL ON TABLE "public"."cached_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."cached_emails" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."channel_members" TO "anon";
GRANT ALL ON TABLE "public"."channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."coaching_keywords" TO "anon";
GRANT ALL ON TABLE "public"."coaching_keywords" TO "authenticated";
GRANT ALL ON TABLE "public"."coaching_keywords" TO "service_role";



GRANT ALL ON TABLE "public"."coaching_prompts" TO "anon";
GRANT ALL ON TABLE "public"."coaching_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."coaching_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."coaching_sessions" TO "anon";
GRANT ALL ON TABLE "public"."coaching_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."coaching_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."collection_docs" TO "anon";
GRANT ALL ON TABLE "public"."collection_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_docs" TO "service_role";



GRANT ALL ON TABLE "public"."contact_interactions" TO "anon";
GRANT ALL ON TABLE "public"."contact_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_graphs" TO "anon";
GRANT ALL ON TABLE "public"."conversation_graphs" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_graphs" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_health" TO "anon";
GRANT ALL ON TABLE "public"."conversation_health" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_health" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_memory" TO "anon";
GRANT ALL ON TABLE "public"."conversation_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_memory" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_messages" TO "anon";
GRANT ALL ON TABLE "public"."conversation_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_messages" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."crm_actions" TO "anon";
GRANT ALL ON TABLE "public"."crm_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_actions" TO "service_role";



GRANT ALL ON TABLE "public"."crm_companies" TO "anon";
GRANT ALL ON TABLE "public"."crm_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_companies" TO "service_role";



GRANT ALL ON TABLE "public"."crm_contacts" TO "anon";
GRANT ALL ON TABLE "public"."crm_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."crm_deals" TO "anon";
GRANT ALL ON TABLE "public"."crm_deals" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_deals" TO "service_role";



GRANT ALL ON TABLE "public"."crm_integrations" TO "anon";
GRANT ALL ON TABLE "public"."crm_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."crm_sidepanels" TO "anon";
GRANT ALL ON TABLE "public"."crm_sidepanels" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_sidepanels" TO "service_role";



GRANT ALL ON TABLE "public"."crm_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."crm_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."crm_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."crm_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."custom_labels" TO "anon";
GRANT ALL ON TABLE "public"."custom_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_labels" TO "service_role";



GRANT ALL ON TABLE "public"."customer_health_history" TO "anon";
GRANT ALL ON TABLE "public"."customer_health_history" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_health_history" TO "service_role";



GRANT ALL ON TABLE "public"."customer_sentiment" TO "anon";
GRANT ALL ON TABLE "public"."customer_sentiment" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_sentiment" TO "service_role";



GRANT ALL ON TABLE "public"."decision_votes" TO "anon";
GRANT ALL ON TABLE "public"."decision_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."decision_votes" TO "service_role";



GRANT ALL ON TABLE "public"."decisions" TO "anon";
GRANT ALL ON TABLE "public"."decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."decisions" TO "service_role";



GRANT ALL ON TABLE "public"."doc_annotations" TO "anon";
GRANT ALL ON TABLE "public"."doc_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."doc_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."doc_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."doc_favorites" TO "anon";
GRANT ALL ON TABLE "public"."doc_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."doc_highlights" TO "anon";
GRANT ALL ON TABLE "public"."doc_highlights" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_highlights" TO "service_role";



GRANT ALL ON TABLE "public"."doc_recent_views" TO "anon";
GRANT ALL ON TABLE "public"."doc_recent_views" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_recent_views" TO "service_role";



GRANT ALL ON TABLE "public"."doc_tags" TO "anon";
GRANT ALL ON TABLE "public"."doc_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_tags" TO "service_role";



GRANT ALL ON TABLE "public"."document_collections" TO "anon";
GRANT ALL ON TABLE "public"."document_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."document_collections" TO "service_role";



GRANT ALL ON TABLE "public"."document_shares" TO "anon";
GRANT ALL ON TABLE "public"."document_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."document_shares" TO "service_role";



GRANT ALL ON TABLE "public"."document_tags" TO "anon";
GRANT ALL ON TABLE "public"."document_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."document_tags" TO "service_role";



GRANT ALL ON TABLE "public"."duplicate_contacts" TO "anon";
GRANT ALL ON TABLE "public"."duplicate_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."duplicate_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."email_contacts" TO "anon";
GRANT ALL ON TABLE "public"."email_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."email_daily_briefings" TO "anon";
GRANT ALL ON TABLE "public"."email_daily_briefings" TO "authenticated";
GRANT ALL ON TABLE "public"."email_daily_briefings" TO "service_role";



GRANT ALL ON TABLE "public"."email_follow_ups" TO "anon";
GRANT ALL ON TABLE "public"."email_follow_ups" TO "authenticated";
GRANT ALL ON TABLE "public"."email_follow_ups" TO "service_role";



GRANT ALL ON TABLE "public"."email_labels" TO "anon";
GRANT ALL ON TABLE "public"."email_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."email_labels" TO "service_role";



GRANT ALL ON TABLE "public"."email_sync_state" TO "anon";
GRANT ALL ON TABLE "public"."email_sync_state" TO "authenticated";
GRANT ALL ON TABLE "public"."email_sync_state" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."email_threads" TO "anon";
GRANT ALL ON TABLE "public"."email_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."email_threads" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."embeddings" TO "anon";
GRANT ALL ON TABLE "public"."embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."entomate_action_items" TO "anon";
GRANT ALL ON TABLE "public"."entomate_action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."entomate_action_items" TO "service_role";



GRANT ALL ON TABLE "public"."entomate_automation_logs" TO "anon";
GRANT ALL ON TABLE "public"."entomate_automation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."entomate_automation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."entomate_automations" TO "anon";
GRANT ALL ON TABLE "public"."entomate_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."entomate_automations" TO "service_role";



GRANT ALL ON TABLE "public"."entomate_meetings" TO "anon";
GRANT ALL ON TABLE "public"."entomate_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."entomate_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."entomate_project_tasks" TO "anon";
GRANT ALL ON TABLE "public"."entomate_project_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."entomate_project_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."entomate_projects" TO "anon";
GRANT ALL ON TABLE "public"."entomate_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."entomate_projects" TO "service_role";



GRANT ALL ON TABLE "public"."ephemeral_workspaces" TO "anon";
GRANT ALL ON TABLE "public"."ephemeral_workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."ephemeral_workspaces" TO "service_role";



GRANT ALL ON TABLE "public"."extracted_tasks" TO "anon";
GRANT ALL ON TABLE "public"."extracted_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."extracted_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."focus_sessions" TO "anon";
GRANT ALL ON TABLE "public"."focus_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."in_app_messages" TO "anon";
GRANT ALL ON TABLE "public"."in_app_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."in_app_messages" TO "service_role";



GRANT ALL ON TABLE "public"."integration_field_mappings" TO "anon";
GRANT ALL ON TABLE "public"."integration_field_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_field_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."integration_logs" TO "anon";
GRANT ALL ON TABLE "public"."integration_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_logs" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON TABLE "public"."key_results" TO "anon";
GRANT ALL ON TABLE "public"."key_results" TO "authenticated";
GRANT ALL ON TABLE "public"."key_results" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_docs" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_docs" TO "service_role";



GRANT ALL ON TABLE "public"."lead_scores" TO "anon";
GRANT ALL ON TABLE "public"."lead_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_scores" TO "service_role";



GRANT ALL ON TABLE "public"."logos_cases" TO "anon";
GRANT ALL ON TABLE "public"."logos_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_cases" TO "service_role";



GRANT ALL ON TABLE "public"."logos_contacts" TO "anon";
GRANT ALL ON TABLE "public"."logos_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."logos_notes" TO "anon";
GRANT ALL ON TABLE "public"."logos_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_notes" TO "service_role";



GRANT ALL ON TABLE "public"."logos_projects" TO "anon";
GRANT ALL ON TABLE "public"."logos_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_projects" TO "service_role";



GRANT ALL ON TABLE "public"."logos_pulse_activity" TO "anon";
GRANT ALL ON TABLE "public"."logos_pulse_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_pulse_activity" TO "service_role";



GRANT ALL ON TABLE "public"."logos_pulse_mappings" TO "anon";
GRANT ALL ON TABLE "public"."logos_pulse_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_pulse_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."logos_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."logos_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."logos_tasks" TO "anon";
GRANT ALL ON TABLE "public"."logos_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."logos_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_prep_cards" TO "anon";
GRANT ALL ON TABLE "public"."meeting_prep_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_prep_cards" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."message_channels" TO "anon";
GRANT ALL ON TABLE "public"."message_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."message_channels" TO "service_role";



GRANT ALL ON TABLE "public"."message_drafts" TO "anon";
GRANT ALL ON TABLE "public"."message_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."message_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."message_impact" TO "anon";
GRANT ALL ON TABLE "public"."message_impact" TO "authenticated";
GRANT ALL ON TABLE "public"."message_impact" TO "service_role";



GRANT ALL ON TABLE "public"."message_interactions" TO "anon";
GRANT ALL ON TABLE "public"."message_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."message_sync_state" TO "anon";
GRANT ALL ON TABLE "public"."message_sync_state" TO "authenticated";
GRANT ALL ON TABLE "public"."message_sync_state" TO "service_role";



GRANT ALL ON TABLE "public"."message_translations" TO "anon";
GRANT ALL ON TABLE "public"."message_translations" TO "authenticated";
GRANT ALL ON TABLE "public"."message_translations" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_rules" TO "anon";
GRANT ALL ON TABLE "public"."notification_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_rules" TO "service_role";



GRANT ALL ON TABLE "public"."outcome_blockers" TO "anon";
GRANT ALL ON TABLE "public"."outcome_blockers" TO "authenticated";
GRANT ALL ON TABLE "public"."outcome_blockers" TO "service_role";



GRANT ALL ON TABLE "public"."outcome_milestones" TO "anon";
GRANT ALL ON TABLE "public"."outcome_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."outcome_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."outcomes" TO "anon";
GRANT ALL ON TABLE "public"."outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."outcomes" TO "service_role";



GRANT ALL ON TABLE "public"."predictions" TO "anon";
GRANT ALL ON TABLE "public"."predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."predictions" TO "service_role";



GRANT ALL ON TABLE "public"."project_docs" TO "anon";
GRANT ALL ON TABLE "public"."project_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."project_docs" TO "service_role";



GRANT ALL ON TABLE "public"."project_shares" TO "anon";
GRANT ALL ON TABLE "public"."project_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."project_shares" TO "service_role";



GRANT ALL ON TABLE "public"."project_templates" TO "anon";
GRANT ALL ON TABLE "public"."project_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_templates" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_blockers" TO "anon";
GRANT ALL ON TABLE "public"."pulse_blockers" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_blockers" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_channel_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."pulse_channel_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_channel_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_channels" TO "anon";
GRANT ALL ON TABLE "public"."pulse_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_channels" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_context_summaries" TO "anon";
GRANT ALL ON TABLE "public"."pulse_context_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_context_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_conversations" TO "anon";
GRANT ALL ON TABLE "public"."pulse_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_decisions" TO "anon";
GRANT ALL ON TABLE "public"."pulse_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_files" TO "anon";
GRANT ALL ON TABLE "public"."pulse_files" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_files" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_follows" TO "anon";
GRANT ALL ON TABLE "public"."pulse_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_follows" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_messages" TO "anon";
GRANT ALL ON TABLE "public"."pulse_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_messages" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_notifications" TO "anon";
GRANT ALL ON TABLE "public"."pulse_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_nudges" TO "anon";
GRANT ALL ON TABLE "public"."pulse_nudges" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_nudges" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_outcomes" TO "anon";
GRANT ALL ON TABLE "public"."pulse_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_outcomes" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_tasks" TO "anon";
GRANT ALL ON TABLE "public"."pulse_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_typing" TO "anon";
GRANT ALL ON TABLE "public"."pulse_typing" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_typing" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_users" TO "anon";
GRANT ALL ON TABLE "public"."pulse_users" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_users" TO "service_role";



GRANT ALL ON TABLE "public"."quick_vox_favorites" TO "anon";
GRANT ALL ON TABLE "public"."quick_vox_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_vox_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."quick_vox_messages" TO "anon";
GRANT ALL ON TABLE "public"."quick_vox_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_vox_messages" TO "service_role";



GRANT ALL ON TABLE "public"."quick_vox_status" TO "anon";
GRANT ALL ON TABLE "public"."quick_vox_status" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_vox_status" TO "service_role";



GRANT ALL ON TABLE "public"."relationship_alerts" TO "anon";
GRANT ALL ON TABLE "public"."relationship_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."relationship_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."relationship_events" TO "anon";
GRANT ALL ON TABLE "public"."relationship_events" TO "authenticated";
GRANT ALL ON TABLE "public"."relationship_events" TO "service_role";



GRANT ALL ON TABLE "public"."relationship_milestones" TO "anon";
GRANT ALL ON TABLE "public"."relationship_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."relationship_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."relationship_profiles" TO "anon";
GRANT ALL ON TABLE "public"."relationship_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."relationship_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."relationships" TO "anon";
GRANT ALL ON TABLE "public"."relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."relationships" TO "service_role";



GRANT ALL ON TABLE "public"."reserved_handles" TO "anon";
GRANT ALL ON TABLE "public"."reserved_handles" TO "authenticated";
GRANT ALL ON TABLE "public"."reserved_handles" TO "service_role";



GRANT ALL ON TABLE "public"."saved_searches" TO "anon";
GRANT ALL ON TABLE "public"."saved_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_searches" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_emails" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_emails" TO "service_role";



GRANT ALL ON TABLE "public"."search_clipboard" TO "anon";
GRANT ALL ON TABLE "public"."search_clipboard" TO "authenticated";
GRANT ALL ON TABLE "public"."search_clipboard" TO "service_role";



GRANT ALL ON TABLE "public"."search_documents" TO "anon";
GRANT ALL ON TABLE "public"."search_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."search_documents" TO "service_role";



GRANT ALL ON TABLE "public"."search_history" TO "anon";
GRANT ALL ON TABLE "public"."search_history" TO "authenticated";
GRANT ALL ON TABLE "public"."search_history" TO "service_role";



GRANT ALL ON TABLE "public"."search_index" TO "anon";
GRANT ALL ON TABLE "public"."search_index" TO "authenticated";
GRANT ALL ON TABLE "public"."search_index" TO "service_role";



GRANT ALL ON TABLE "public"."session_docs" TO "anon";
GRANT ALL ON TABLE "public"."session_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."session_docs" TO "service_role";



GRANT ALL ON TABLE "public"."share_invites" TO "anon";
GRANT ALL ON TABLE "public"."share_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."share_invites" TO "service_role";



GRANT ALL ON TABLE "public"."slack_channels" TO "anon";
GRANT ALL ON TABLE "public"."slack_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."slack_channels" TO "service_role";



GRANT ALL ON TABLE "public"."smart_contact_groups" TO "anon";
GRANT ALL ON TABLE "public"."smart_contact_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_contact_groups" TO "service_role";



GRANT ALL ON TABLE "public"."smart_folders" TO "anon";
GRANT ALL ON TABLE "public"."smart_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_folders" TO "service_role";



GRANT ALL ON TABLE "public"."smart_groups" TO "anon";
GRANT ALL ON TABLE "public"."smart_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_groups" TO "service_role";



GRANT ALL ON TABLE "public"."smart_suggestions_cache" TO "anon";
GRANT ALL ON TABLE "public"."smart_suggestions_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_suggestions_cache" TO "service_role";



GRANT ALL ON TABLE "public"."sms_conversations" TO "anon";
GRANT ALL ON TABLE "public"."sms_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "anon";
GRANT ALL ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";



GRANT ALL ON TABLE "public"."snoozed_emails" TO "anon";
GRANT ALL ON TABLE "public"."snoozed_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."snoozed_emails" TO "service_role";



GRANT ALL ON TABLE "public"."sso_configs" TO "anon";
GRANT ALL ON TABLE "public"."sso_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."sso_configs" TO "service_role";



GRANT ALL ON TABLE "public"."sso_sessions" TO "anon";
GRANT ALL ON TABLE "public"."sso_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sso_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."task_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."task_updates" TO "anon";
GRANT ALL ON TABLE "public"."task_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."task_updates" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_invites" TO "anon";
GRANT ALL ON TABLE "public"."team_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."team_invites" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."team_vox_messages" TO "anon";
GRANT ALL ON TABLE "public"."team_vox_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."team_vox_messages" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."test_matrix_results" TO "anon";
GRANT ALL ON TABLE "public"."test_matrix_results" TO "authenticated";
GRANT ALL ON TABLE "public"."test_matrix_results" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON TABLE "public"."unified_messages" TO "anon";
GRANT ALL ON TABLE "public"."unified_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_messages" TO "service_role";



GRANT ALL ON TABLE "public"."voxer_recordings" TO "anon";
GRANT ALL ON TABLE "public"."voxer_recordings" TO "authenticated";
GRANT ALL ON TABLE "public"."voxer_recordings" TO "service_role";



GRANT ALL ON TABLE "public"."unified_search_view" TO "anon";
GRANT ALL ON TABLE "public"."unified_search_view" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_search_view" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_contact_annotations" TO "anon";
GRANT ALL ON TABLE "public"."user_contact_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_contact_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."user_message_statistics" TO "anon";
GRANT ALL ON TABLE "public"."user_message_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."user_message_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_retention_cohorts" TO "anon";
GRANT ALL ON TABLE "public"."user_retention_cohorts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_retention_cohorts" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_teams" TO "anon";
GRANT ALL ON TABLE "public"."user_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."user_teams" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vacation_responder" TO "anon";
GRANT ALL ON TABLE "public"."vacation_responder" TO "authenticated";
GRANT ALL ON TABLE "public"."vacation_responder" TO "service_role";



GRANT ALL ON TABLE "public"."vacation_responder_log" TO "anon";
GRANT ALL ON TABLE "public"."vacation_responder_log" TO "authenticated";
GRANT ALL ON TABLE "public"."vacation_responder_log" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_ai_queue" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_ai_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_ai_queue" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_conversations" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_messages" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_messages" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_conversation_list" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_conversation_list" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_conversation_list" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_conversation_members" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_conversation_members" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_messages_with_reactions" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_messages_with_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_messages_with_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_reactions" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."video_vox_read_receipts" TO "anon";
GRANT ALL ON TABLE "public"."video_vox_read_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."video_vox_read_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."voice_message_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."voice_message_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_message_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."voice_message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."voice_message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."voice_thread_messages" TO "anon";
GRANT ALL ON TABLE "public"."voice_thread_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_thread_messages" TO "service_role";



GRANT ALL ON TABLE "public"."voice_thread_messages_with_metadata" TO "anon";
GRANT ALL ON TABLE "public"."voice_thread_messages_with_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_thread_messages_with_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."voice_thread_participants" TO "anon";
GRANT ALL ON TABLE "public"."voice_thread_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_thread_participants" TO "service_role";



GRANT ALL ON TABLE "public"."voice_thread_tags" TO "anon";
GRANT ALL ON TABLE "public"."voice_thread_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_thread_tags" TO "service_role";



GRANT ALL ON TABLE "public"."voice_threads" TO "anon";
GRANT ALL ON TABLE "public"."voice_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_threads" TO "service_role";



GRANT ALL ON TABLE "public"."voice_threads_batch_stats" TO "anon";
GRANT ALL ON TABLE "public"."voice_threads_batch_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_threads_batch_stats" TO "service_role";



GRANT ALL ON TABLE "public"."voice_threads_with_metadata" TO "anon";
GRANT ALL ON TABLE "public"."voice_threads_with_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_threads_with_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."vox_drops" TO "anon";
GRANT ALL ON TABLE "public"."vox_drops" TO "authenticated";
GRANT ALL ON TABLE "public"."vox_drops" TO "service_role";



GRANT ALL ON TABLE "public"."vox_notes" TO "anon";
GRANT ALL ON TABLE "public"."vox_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."vox_notes" TO "service_role";



GRANT ALL ON TABLE "public"."vox_notifications" TO "anon";
GRANT ALL ON TABLE "public"."vox_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."vox_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."vox_team_channels" TO "anon";
GRANT ALL ON TABLE "public"."vox_team_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."vox_team_channels" TO "service_role";



GRANT ALL ON TABLE "public"."vox_workspaces" TO "anon";
GRANT ALL ON TABLE "public"."vox_workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."vox_workspaces" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."webhook_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_outcomes" TO "anon";
GRANT ALL ON TABLE "public"."workspace_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_outcomes" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_participants" TO "anon";
GRANT ALL ON TABLE "public"."workspace_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_participants" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_settings" TO "anon";
GRANT ALL ON TABLE "public"."workspace_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

alter table "public"."goals" drop constraint "goals_goal_type_check";

alter table "public"."goals" drop constraint "goals_status_check";

alter table "public"."voice_threads" drop constraint "voice_threads_status_check";

alter table "public"."goals" add constraint "goals_goal_type_check" CHECK (((goal_type)::text = ANY ((ARRAY['company'::character varying, 'team'::character varying, 'individual'::character varying])::text[]))) not valid;

alter table "public"."goals" validate constraint "goals_goal_type_check";

alter table "public"."goals" add constraint "goals_status_check" CHECK (((status)::text = ANY ((ARRAY['planning'::character varying, 'active'::character varying, 'completed'::character varying, 'abandoned'::character varying])::text[]))) not valid;

alter table "public"."goals" validate constraint "goals_status_check";

alter table "public"."voice_threads" add constraint "voice_threads_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'archived'::character varying, 'pinned'::character varying])::text[]))) not valid;

alter table "public"."voice_threads" validate constraint "voice_threads_status_check";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow authenticated uploads to voxer"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'voxer'::text));



  create policy "Allow public read access to voxer"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'voxer'::text));



  create policy "Allow users to delete own files in voxer"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'voxer'::text));



  create policy "Allow users to update files in voxer"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'voxer'::text))
with check ((bucket_id = 'voxer'::text));



