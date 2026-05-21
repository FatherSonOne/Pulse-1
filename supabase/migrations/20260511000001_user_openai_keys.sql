-- Migration: 20260511000001_user_openai_keys.sql
-- Summit Phase 1 — Bring-your-own OpenAI API key storage.
--
-- Each user may store one personal OpenAI key. The plaintext lives in
-- Supabase Vault (encrypted at rest); only a metadata row in
-- public.user_openai_keys references the secret by uuid. The browser
-- never reads vault.* directly — it calls SECURITY DEFINER RPCs that
-- gate access on auth.uid().
--
-- ⚠️ Vault must be enabled on the project. Confirmed in use by
-- 20260503000007_cron_secret_via_vault.sql.
--
-- Threat model:
--   - The vault secret is per-user; even a service-role read of the
--     metadata table does not yield plaintext.
--   - read_user_openai_key() is SECURITY DEFINER but checks auth.uid()
--     and returns NULL when no row exists for the caller.
--   - DELETE on the metadata row leaves the vault secret dangling but
--     unreferenced. A separate sweep job can prune orphans by joining
--     vault.secrets.name LIKE 'openai_key_%' against this table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_openai_keys (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_secret_id    uuid NOT NULL,
  key_hint           text NOT NULL,
  last_validated_at  timestamptz,
  last_validation_ok boolean,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.user_openai_keys_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_openai_keys_updated_at ON public.user_openai_keys;
CREATE TRIGGER user_openai_keys_updated_at
  BEFORE UPDATE ON public.user_openai_keys
  FOR EACH ROW EXECUTE FUNCTION public.user_openai_keys_set_updated_at();

ALTER TABLE public.user_openai_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_openai_keys_select ON public.user_openai_keys
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_openai_keys_insert ON public.user_openai_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY user_openai_keys_update ON public.user_openai_keys
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY user_openai_keys_delete ON public.user_openai_keys
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_openai_keys TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER RPCs
-- The plaintext key only crosses the wire on read_user_openai_key().
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_user_openai_key(p_key text, p_hint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_existing  uuid;
  v_secret_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR length(p_key) < 20 THEN
    RAISE EXCEPTION 'invalid_key' USING ERRCODE = '22023';
  END IF;
  IF p_hint IS NULL OR length(p_hint) < 4 OR length(p_hint) > 32 THEN
    RAISE EXCEPTION 'invalid_hint' USING ERRCODE = '22023';
  END IF;

  SELECT vault_secret_id INTO v_existing
  FROM public.user_openai_keys
  WHERE user_id = v_uid;

  IF v_existing IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing, p_key);
    UPDATE public.user_openai_keys
       SET key_hint = p_hint,
           last_validated_at = now(),
           last_validation_ok = true,
           updated_at = now()
     WHERE user_id = v_uid;
  ELSE
    v_secret_id := vault.create_secret(
      p_key,
      'openai_key_' || v_uid::text,
      'BYO OpenAI key for user ' || v_uid::text
    );
    INSERT INTO public.user_openai_keys
      (user_id, vault_secret_id, key_hint, last_validated_at, last_validation_ok)
    VALUES
      (v_uid, v_secret_id, p_hint, now(), true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_user_openai_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_secret_id uuid;
  v_key       text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT vault_secret_id INTO v_secret_id
  FROM public.user_openai_keys
  WHERE user_id = v_uid;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id
  LIMIT 1;

  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_openai_key()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_secret_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT vault_secret_id INTO v_secret_id
  FROM public.user_openai_keys
  WHERE user_id = v_uid;

  DELETE FROM public.user_openai_keys WHERE user_id = v_uid;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_user_openai_key(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_user_openai_key()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_openai_key()       FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_user_openai_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_user_openai_key()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_openai_key()         TO authenticated;

COMMENT ON TABLE public.user_openai_keys IS
  'BYO OpenAI key metadata. Encrypted key lives in vault.secrets; this table holds the reference and UI hint. Personal to the user, not shared across a workspace.';

COMMIT;
