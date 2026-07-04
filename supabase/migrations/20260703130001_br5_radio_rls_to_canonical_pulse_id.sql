-- BR5 Option 1, Phase 2: rewrite Radio ownership RLS from `= auth.uid()`
-- (Regime A) to `= current_pulse_user_id()` (Regime B canonical id).
--
-- Two redundant policy families exist per table (a legacy "Users can..." set and
-- the "_own_" set); BOTH are rewritten so no ownership predicate is left keyed on
-- auth.uid(). Verified post-apply: 0 auth.uid() ownership predicates remain, 18
-- now reference the helper, and the ownership snapshot (pulse_channels.owner_id /
-- broadcasts.author_id) is byte-identical — no channel or broadcast changed owner.
--
-- Why this is safe with zero data migration: the only ownership rows that exist
-- belong to the 2 "clean" users, for whom current_pulse_user_id() == auth.uid().
-- The rewrite purely widens the predicate to also admit divergent users writing
-- their canonical pulse id (Phase 3 makes the client do so).
--
-- See docs/deep-dives/HANDOFF-BR5-identity-regime-map-2026-07-03.md (Option 1, §8).

-- ---- pulse_channels ----
ALTER POLICY "Channel owners can delete"       ON public.pulse_channels USING (owner_id = public.current_pulse_user_id());
ALTER POLICY "Channel owners can update"       ON public.pulse_channels USING (owner_id = public.current_pulse_user_id());
ALTER POLICY "Users can create own channels"   ON public.pulse_channels WITH CHECK (owner_id = public.current_pulse_user_id());
ALTER POLICY pulse_channels_owner_delete       ON public.pulse_channels USING (owner_id = public.current_pulse_user_id());
ALTER POLICY pulse_channels_owner_update       ON public.pulse_channels USING (owner_id = public.current_pulse_user_id()) WITH CHECK (owner_id = public.current_pulse_user_id());
ALTER POLICY pulse_channels_owner_insert       ON public.pulse_channels WITH CHECK (owner_id = public.current_pulse_user_id());

-- ---- broadcasts ----
ALTER POLICY "Authors can delete own broadcasts" ON public.broadcasts USING (author_id = public.current_pulse_user_id());
ALTER POLICY "Authors can update own broadcasts" ON public.broadcasts USING (author_id = public.current_pulse_user_id());
ALTER POLICY "Users can create own broadcasts"   ON public.broadcasts WITH CHECK (author_id = public.current_pulse_user_id());
ALTER POLICY broadcasts_author_delete            ON public.broadcasts USING (author_id = public.current_pulse_user_id());
ALTER POLICY broadcasts_author_update            ON public.broadcasts USING (author_id = public.current_pulse_user_id()) WITH CHECK (author_id = public.current_pulse_user_id());
ALTER POLICY broadcasts_author_insert            ON public.broadcasts WITH CHECK (author_id = public.current_pulse_user_id());

-- ---- pulse_channel_subscriptions ----
ALTER POLICY "Users can manage own subscriptions" ON public.pulse_channel_subscriptions WITH CHECK (subscriber_id = public.current_pulse_user_id());
ALTER POLICY "Users can remove own subscriptions" ON public.pulse_channel_subscriptions USING (subscriber_id = public.current_pulse_user_id());
ALTER POLICY pulse_channel_subscriptions_own_insert ON public.pulse_channel_subscriptions WITH CHECK (subscriber_id = public.current_pulse_user_id());
ALTER POLICY pulse_channel_subscriptions_own_update ON public.pulse_channel_subscriptions USING (subscriber_id = public.current_pulse_user_id()) WITH CHECK (subscriber_id = public.current_pulse_user_id());
ALTER POLICY pulse_channel_subscriptions_own_delete ON public.pulse_channel_subscriptions USING (
  subscriber_id = public.current_pulse_user_id()
  OR EXISTS (SELECT 1 FROM public.pulse_channels c WHERE c.id = pulse_channel_subscriptions.channel_id AND c.owner_id = public.current_pulse_user_id())
);
ALTER POLICY pulse_channel_subscriptions_own_select ON public.pulse_channel_subscriptions USING (
  subscriber_id = public.current_pulse_user_id()
  OR EXISTS (SELECT 1 FROM public.pulse_channels c WHERE c.id = pulse_channel_subscriptions.channel_id AND c.owner_id = public.current_pulse_user_id())
);
