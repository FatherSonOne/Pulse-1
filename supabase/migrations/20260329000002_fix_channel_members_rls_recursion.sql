-- ============================================================
-- MIGRATION: 20260329000002_fix_channel_members_rls_recursion.sql
-- PURPOSE:   Fix infinite recursion in channel_members RLS policy.
--
--            The existing SELECT policy queries channel_members from
--            within a policy ON channel_members.  Postgres evaluates
--            RLS before executing the query, causing infinite recursion
--            → HTTP 500 ("infinite recursion detected in policy").
--
--            Additionally, no INSERT/UPDATE/DELETE policies exist,
--            so all writes are silently blocked with RLS enabled.
--
--            Fix: expose a SECURITY DEFINER helper that queries the
--            table as the owner (bypassing RLS), and replace the
--            recursive policy.  Add INSERT/UPDATE/DELETE policies.
--
-- DATE:      2026-03-29
-- DEPENDS:   20260119062007_remote_schema.sql
-- SAFE:      Idempotent via CREATE OR REPLACE / DROP IF EXISTS
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: SECURITY DEFINER helper — bypasses RLS, no recursion
-- ============================================================

CREATE OR REPLACE FUNCTION public.cm_is_channel_member(ch_id UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE  channel_id = ch_id
          AND  user_id    = uid
    );
$$;

CREATE OR REPLACE FUNCTION public.cm_is_channel_admin(ch_id UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE  channel_id = ch_id
          AND  user_id    = uid
          AND  role       = 'admin'
    );
$$;

-- ============================================================
-- SECTION 2: Drop the recursive policy and add correct ones
-- ============================================================

DROP POLICY IF EXISTS "Users can view channel members" ON public.channel_members;
DROP POLICY IF EXISTS channel_members_select ON public.channel_members;
DROP POLICY IF EXISTS channel_members_insert ON public.channel_members;
DROP POLICY IF EXISTS channel_members_update ON public.channel_members;
DROP POLICY IF EXISTS channel_members_delete ON public.channel_members;

-- Members can see other members of channels they belong to;
-- also allow viewing members of public channels
CREATE POLICY channel_members_select ON public.channel_members
    FOR SELECT USING (
        public.cm_is_channel_member(channel_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.message_channels mc
            WHERE mc.id = channel_id AND mc.is_public = true
        )
    );

-- Authenticated users can join public channels;
-- channel admins or channel creators can add others;
-- users can add themselves to any channel they created
CREATE POLICY channel_members_insert ON public.channel_members
    FOR INSERT WITH CHECK (
        -- You can add yourself to a public channel
        (
            user_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.message_channels mc
                WHERE mc.id = channel_id AND mc.is_public = true
            )
        )
        -- Channel admin can add anyone
        OR public.cm_is_channel_admin(channel_id, auth.uid())
        -- Channel creator can add anyone
        OR EXISTS (
            SELECT 1 FROM public.message_channels mc
            WHERE mc.id = channel_id AND mc.created_by = auth.uid()
        )
    );

-- Only admins can update member roles
CREATE POLICY channel_members_update ON public.channel_members
    FOR UPDATE USING (
        public.cm_is_channel_admin(channel_id, auth.uid())
    );

-- Admins can remove anyone; members can remove themselves (leave)
CREATE POLICY channel_members_delete ON public.channel_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR public.cm_is_channel_admin(channel_id, auth.uid())
    );

-- ============================================================
-- SECTION 3: Fix message_channels SELECT policy that also
--            references channel_members (not recursive itself,
--            but use the helper for consistency)
-- ============================================================

DROP POLICY IF EXISTS "Users can view channels they're members of" ON public.message_channels;
DROP POLICY IF EXISTS message_channels_select ON public.message_channels;
DROP POLICY IF EXISTS message_channels_insert ON public.message_channels;
DROP POLICY IF EXISTS message_channels_update ON public.message_channels;
DROP POLICY IF EXISTS message_channels_delete ON public.message_channels;

CREATE POLICY message_channels_select ON public.message_channels
    FOR SELECT USING (
        is_public = true
        OR public.cm_is_channel_member(id, auth.uid())
        OR created_by = auth.uid()
    );

-- Any authenticated user can create a channel
CREATE POLICY message_channels_insert ON public.message_channels
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- Channel creator or admin can update
CREATE POLICY message_channels_update ON public.message_channels
    FOR UPDATE USING (
        created_by = auth.uid()
        OR public.cm_is_channel_admin(id, auth.uid())
    );

-- Channel creator or admin can delete
CREATE POLICY message_channels_delete ON public.message_channels
    FOR DELETE USING (
        created_by = auth.uid()
        OR public.cm_is_channel_admin(id, auth.uid())
    );

-- ============================================================
-- SECTION 4: Fix ecosystem_bot_channels — allow authenticated
--            users (workspace admins setting up bots) to insert
-- ============================================================

DROP POLICY IF EXISTS "authenticated_insert_bot_channels" ON public.ecosystem_bot_channels;
DROP POLICY IF EXISTS "authenticated_update_bot_channels" ON public.ecosystem_bot_channels;

CREATE POLICY authenticated_insert_bot_channels ON public.ecosystem_bot_channels
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY authenticated_update_bot_channels ON public.ecosystem_bot_channels
    FOR UPDATE TO authenticated
    USING (true);

COMMIT;
