-- =====================================================
-- ECOSYSTEM BRIDGE: Drop vestigial chat_messages → ephemeral_workspaces FK
-- The FK pinned chat_messages to time-bounded ephemeral_workspaces, but
-- bot messages (added in 20260326000003) target persistent workspaces.
-- message_channels (the parent of chat_messages via channel_id) has no
-- workspace FK either — dropping this aligns the two tables.
-- Created: 2026-05-04
-- =====================================================

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_workspace_id_fkey;
