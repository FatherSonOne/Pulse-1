-- Allow authenticated users to insert/update ecosystem_config from the Settings UI
-- Previously only service_role could write, causing 403 on upsert from the client.

CREATE POLICY "authenticated_insert_ecosystem_config"
  ON ecosystem_config FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_ecosystem_config"
  ON ecosystem_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
