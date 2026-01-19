alter table "public"."goals" drop constraint "goals_goal_type_check";

alter table "public"."goals" drop constraint "goals_status_check";

alter table "public"."voice_threads" drop constraint "voice_threads_status_check";

alter table "public"."goals" add constraint "goals_goal_type_check" CHECK (((goal_type)::text = ANY ((ARRAY['company'::character varying, 'team'::character varying, 'individual'::character varying])::text[]))) not valid;

alter table "public"."goals" validate constraint "goals_goal_type_check";

alter table "public"."goals" add constraint "goals_status_check" CHECK (((status)::text = ANY ((ARRAY['planning'::character varying, 'active'::character varying, 'completed'::character varying, 'abandoned'::character varying])::text[]))) not valid;

alter table "public"."goals" validate constraint "goals_status_check";

alter table "public"."voice_threads" add constraint "voice_threads_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'archived'::character varying, 'pinned'::character varying])::text[]))) not valid;

alter table "public"."voice_threads" validate constraint "voice_threads_status_check";


