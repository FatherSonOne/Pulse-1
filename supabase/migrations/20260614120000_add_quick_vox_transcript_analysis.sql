-- S0-1 (relay-launch-readiness 2026-06-14): make Relay "Direct" actually deliver
-- by moving it onto the real 2-party quick_vox_messages engine.
--
-- ClassicMode (Direct) historically wrote to voxer_recordings — a single-user,
-- RLS-scoped personal log with no recipient path, so "sent" voxes never reached
-- the other person. We rewire Direct onto quick_vox_messages (uuid sender/
-- recipient, delivered_at/played_at, realtime, notifications).
--
-- quick_vox_messages is intentionally thin (audio + status only). ClassicMode
-- additionally shows a per-message transcript and feeds it to the AI surface
-- (summarize / meeting notes / chapters / smart replies) and tracks reply
-- threading in an `analysis` blob. These two ADDITIVE columns preserve those
-- features on the delivering store. Both are written BY THE SENDER at insert
-- time (ClassicMode transcribes during the send preview), and read by both
-- parties — which fits the existing RLS exactly (SELECT: sender OR recipient;
-- INSERT/UPDATE/DELETE: sender only). No RLS change required; new columns
-- inherit the table's policies.
--
-- Per-viewer flags (starred/bookmarked) are deliberately NOT added here: they
-- are personal to each viewer, but quick_vox_messages is a shared 2-party row
-- with sender-only UPDATE, so a recipient could never persist them. Those stay
-- as local UI state until a per-viewer model lands.

ALTER TABLE public.quick_vox_messages
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS analysis jsonb;

COMMENT ON COLUMN public.quick_vox_messages.transcript IS
  'Sender-authored transcript of the voice message (set at send time by ClassicMode/Relay Direct). Read by both parties for display + AI summary.';
COMMENT ON COLUMN public.quick_vox_messages.analysis IS
  'Optional sender-authored metadata blob (e.g. reply_to_id for thread replies, AI analysis). jsonb, nullable.';
