-- =====================================================================
-- One-off RLS isolation test for `places` and `entity_places`.
--
-- Tracking: issue #35 (Stream A1).
--
-- This is NOT a migration. It's a self-contained transactional test:
--   BEGIN; ... ROLLBACK; — leaves zero residue in the database.
--   Run as service_role (or any role that can SET LOCAL ROLE).
--
-- What it verifies (each assertion below RAISES on leak):
--   1. Personal place owned by user1 is invisible to user2 (SELECT).
--   2. Personal place cannot be UPDATEd by user2.
--   3. Personal place cannot be DELETEd by user2.
--   4. Personal place cannot be re-INSERTed by user2 with user1's owner_user_id.
--   5. Workspace place in workspace1 is invisible to user2 (in workspace2).
--   6. Workspace place cannot be UPDATEd by user2 (different workspace).
--   7. Workspace place cannot be DELETEd by user2 (different workspace).
--   8. entity_places attached to user1's personal place is invisible to user2.
--   9. entity_places attached to user1's workspace place is invisible to user2.
--  10. entity_places cannot be INSERTed by user2 against a place they can't see.
--  11. entity_places cannot be DELETEd by user2 against a place they can't see.
--  12. Sanity: as user1, the same SELECTs DO return rows (control case).
--
-- Run via psql or Supabase MCP execute_sql. Output: raises NOTICE for
-- each test pass; RAISES EXCEPTION on failure (rolling the transaction back).
-- =====================================================================

BEGIN;

-- Two synthetic users (UUIDv4 literals). Insert into auth.users with
-- the minimum columns Supabase requires. Encrypted_password is empty
-- (not used by RLS).
DO $$
DECLARE
  uid_user1 UUID := '00000000-0000-0000-0000-000000000a01';
  uid_user2 UUID := '00000000-0000-0000-0000-000000000a02';
BEGIN
  -- Clean up if a prior aborted run left rows (defensive; ROLLBACK should prevent this)
  DELETE FROM auth.users WHERE id IN (uid_user1, uid_user2);

  INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (uid_user1, '00000000-0000-0000-0000-000000000000'::uuid,
     'rls-test-user1@pulse.test', 'authenticated', 'authenticated',
     '', NOW(), NOW(), NOW()),
    (uid_user2, '00000000-0000-0000-0000-000000000000'::uuid,
     'rls-test-user2@pulse.test', 'authenticated', 'authenticated',
     '', NOW(), NOW(), NOW());
END $$;

-- Two workspaces with two members.
INSERT INTO public.workspaces (id, owner_id, name, slug, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000b01'::uuid,
   '00000000-0000-0000-0000-000000000a01'::uuid,
   'RLS-test-ws-user1', 'rls-test-ws-user1-' || extract(epoch from now())::bigint,
   NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000b02'::uuid,
   '00000000-0000-0000-0000-000000000a02'::uuid,
   'RLS-test-ws-user2', 'rls-test-ws-user2-' || extract(epoch from now())::bigint,
   NOW(), NOW());

INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000b01'::uuid, '00000000-0000-0000-0000-000000000a01'::uuid, 'owner'),
  ('00000000-0000-0000-0000-000000000b02'::uuid, '00000000-0000-0000-0000-000000000a02'::uuid, 'owner');

-- Seed test data (as service_role, bypassing RLS).
INSERT INTO public.places (id, owner_user_id, workspace_id, lat, lng, address, name, type)
VALUES
  -- Personal place: owned by user1, no workspace
  ('00000000-0000-0000-0000-000000000c01'::uuid,
   '00000000-0000-0000-0000-000000000a01', NULL,
   40.7128, -74.0060, '123 Test Personal St', 'User1 Home (personal)', 'home'),
  -- Workspace place: owned by user1, in workspace1
  ('00000000-0000-0000-0000-000000000c02'::uuid,
   '00000000-0000-0000-0000-000000000a01',
   '00000000-0000-0000-0000-000000000b01'::uuid,
   34.0522, -118.2437, '456 Test WS Ave', 'WS1 Site', 'site');

INSERT INTO public.entity_places (entity_type, entity_id, place_id, role)
VALUES
  ('contact', 'rls-test-contact-personal',
   '00000000-0000-0000-0000-000000000c01'::uuid, 'home'),
  ('contact', 'rls-test-contact-workspace',
   '00000000-0000-0000-0000-000000000c02'::uuid, 'site');

-- =====================================================================
-- SIMULATE user2 — attempt to leak across boundary
-- =====================================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a02', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000a02","role":"authenticated"}', true);

DO $$
DECLARE
  visible_count INT;
BEGIN
  -- TEST 1: user2 cannot SELECT user1's personal place
  SELECT COUNT(*) INTO visible_count FROM public.places
    WHERE id = '00000000-0000-0000-0000-000000000c01'::uuid;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T1]: user2 sees user1''s personal place (count=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T1]: personal place hidden from non-owner';

  -- TEST 5: user2 cannot SELECT user1's workspace place (workspace they don't belong to)
  SELECT COUNT(*) INTO visible_count FROM public.places
    WHERE id = '00000000-0000-0000-0000-000000000c02'::uuid;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T5]: user2 sees user1''s workspace place (count=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T5]: workspace place hidden from non-member';

  -- TEST 8: user2 cannot SELECT entity_places linked to user1's personal place
  SELECT COUNT(*) INTO visible_count FROM public.entity_places
    WHERE place_id = '00000000-0000-0000-0000-000000000c01'::uuid;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T8]: user2 sees entity_places for user1''s personal place (count=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T8]: entity_places (personal) hidden from non-owner';

  -- TEST 9: user2 cannot SELECT entity_places linked to user1's workspace place
  SELECT COUNT(*) INTO visible_count FROM public.entity_places
    WHERE place_id = '00000000-0000-0000-0000-000000000c02'::uuid;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T9]: user2 sees entity_places for user1''s workspace place (count=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T9]: entity_places (workspace) hidden from non-member';

  -- TEST 2: user2 UPDATE on user1's personal place — should affect 0 rows
  UPDATE public.places SET name = 'HIJACKED'
    WHERE id = '00000000-0000-0000-0000-000000000c01'::uuid;
  GET DIAGNOSTICS visible_count = ROW_COUNT;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T2]: user2 UPDATEd user1''s personal place (rows=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T2]: UPDATE on personal place from non-owner is no-op';

  -- TEST 6: user2 UPDATE on user1's workspace place — should affect 0 rows
  UPDATE public.places SET name = 'HIJACKED'
    WHERE id = '00000000-0000-0000-0000-000000000c02'::uuid;
  GET DIAGNOSTICS visible_count = ROW_COUNT;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T6]: user2 UPDATEd user1''s workspace place (rows=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T6]: UPDATE on workspace place from non-member is no-op';

  -- TEST 3: user2 DELETE on user1's personal place — should affect 0 rows
  DELETE FROM public.places WHERE id = '00000000-0000-0000-0000-000000000c01'::uuid;
  GET DIAGNOSTICS visible_count = ROW_COUNT;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T3]: user2 DELETEd user1''s personal place (rows=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T3]: DELETE on personal place from non-owner is no-op';

  -- TEST 7: user2 DELETE on user1's workspace place — should affect 0 rows
  DELETE FROM public.places WHERE id = '00000000-0000-0000-0000-000000000c02'::uuid;
  GET DIAGNOSTICS visible_count = ROW_COUNT;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'LEAK[T7]: user2 DELETEd user1''s workspace place (rows=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T7]: DELETE on workspace place from non-member is no-op';
END $$;

-- TEST 4: user2 INSERT a personal place claiming user1 as owner — must fail.
-- Important: only catch insufficient_privilege (42501). A WHEN OTHERS handler
-- would also swallow our own LEAK exception, hiding a real leak.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.places (owner_user_id, workspace_id, lat, lng, type)
    VALUES ('00000000-0000-0000-0000-000000000a01', NULL, 1, 1, 'custom');
    RAISE EXCEPTION 'LEAK[T4]: user2 INSERTed a place claiming user1 as owner';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS[T4]: INSERT spoofing user1 as owner blocked by RLS (42501)';
  END;
END $$;

-- TEST 10: user2 INSERT entity_places against a place they can't see — must fail.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.entity_places (entity_type, entity_id, place_id, role)
    VALUES ('contact', 'rls-test-spoof', '00000000-0000-0000-0000-000000000c01'::uuid, 'primary');
    RAISE EXCEPTION 'LEAK[T10]: user2 INSERTed entity_places against an invisible place';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS[T10]: entity_places INSERT against hidden place blocked (42501)';
  END;
END $$;

-- TEST 11: user2 DELETE entity_places against a place they can't see — should affect 0 rows
DO $$
DECLARE
  affected INT;
BEGIN
  DELETE FROM public.entity_places
    WHERE place_id = '00000000-0000-0000-0000-000000000c01'::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'LEAK[T11]: user2 DELETEd entity_places for hidden personal place (rows=%)', affected;
  END IF;
  RAISE NOTICE 'PASS[T11]: entity_places DELETE for hidden personal place is no-op';

  DELETE FROM public.entity_places
    WHERE place_id = '00000000-0000-0000-0000-000000000c02'::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'LEAK[T11b]: user2 DELETEd entity_places for hidden workspace place (rows=%)', affected;
  END IF;
  RAISE NOTICE 'PASS[T11b]: entity_places DELETE for hidden workspace place is no-op';
END $$;

-- =====================================================================
-- SIMULATE user1 — control case (should see own data)
-- =====================================================================

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a01', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000a01","role":"authenticated"}', true);

DO $$
DECLARE
  visible_count INT;
BEGIN
  -- TEST 12a: user1 sees their personal place
  SELECT COUNT(*) INTO visible_count FROM public.places
    WHERE id = '00000000-0000-0000-0000-000000000c01'::uuid;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'BROKEN[T12a]: user1 cannot see own personal place (count=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T12a]: user1 sees own personal place';

  -- TEST 12b: user1 sees their workspace place
  SELECT COUNT(*) INTO visible_count FROM public.places
    WHERE id = '00000000-0000-0000-0000-000000000c02'::uuid;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'BROKEN[T12b]: user1 cannot see own workspace place (count=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T12b]: user1 sees own workspace place';

  -- TEST 12c: user1 sees entity_places linked to their places
  SELECT COUNT(*) INTO visible_count FROM public.entity_places
    WHERE place_id IN (
      '00000000-0000-0000-0000-000000000c01'::uuid,
      '00000000-0000-0000-0000-000000000c02'::uuid
    );
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'BROKEN[T12c]: user1 cannot see own entity_places (count=%)', visible_count;
  END IF;
  RAISE NOTICE 'PASS[T12c]: user1 sees own entity_places (both)';
END $$;

RESET ROLE;

-- All assertions passed — print summary then ROLLBACK to leave no trace.
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'ALL RLS ISOLATION TESTS PASSED.';
  RAISE NOTICE 'Rolling back to leave no residue.';
  RAISE NOTICE '===========================================';
END $$;

ROLLBACK;

-- =====================================================================
-- Belt-and-braces cleanup. If the runner auto-commits between
-- statements (some HTTP-based SQL runners do), the BEGIN/ROLLBACK
-- envelope above will be a no-op. This block runs in its own
-- transaction with fixed test UUIDs, deleting only the test rows
-- regardless of what the envelope did.
-- =====================================================================

DELETE FROM public.entity_places
  WHERE place_id IN (
    '00000000-0000-0000-0000-000000000c01'::uuid,
    '00000000-0000-0000-0000-000000000c02'::uuid
  );
DELETE FROM public.places
  WHERE id IN (
    '00000000-0000-0000-0000-000000000c01'::uuid,
    '00000000-0000-0000-0000-000000000c02'::uuid
  );
DELETE FROM public.workspace_members
  WHERE workspace_id IN (
    '00000000-0000-0000-0000-000000000b01'::uuid,
    '00000000-0000-0000-0000-000000000b02'::uuid
  );
DELETE FROM public.workspaces
  WHERE id IN (
    '00000000-0000-0000-0000-000000000b01'::uuid,
    '00000000-0000-0000-0000-000000000b02'::uuid
  );
DELETE FROM auth.users
  WHERE id IN (
    '00000000-0000-0000-0000-000000000a01'::uuid,
    '00000000-0000-0000-0000-000000000a02'::uuid
  );
