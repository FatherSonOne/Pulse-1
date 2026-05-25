-- Relay demo seed — full conversations for Direct / Channel / Broadcast / Notes.
-- Idempotent-ish: every row uses a 5eed-prefixed UUID, so re-running after the
-- cleanup at the bottom is safe. Real, playable audio is reused from existing
-- public objects in the `relay` storage bucket (waveforms are per-id, so rows
-- still look distinct). Owner = Frankie Messana (feedaa8d…). Run via the
-- Supabase MCP / SQL editor against project ucaeuszgoihoyrvhewxk (pulse-chat).
--
-- IDs in play:
--   me (Frankie)        feedaa8d-1f48-4ad1-b757-11c7b79b7510
--   Frank Messana       0bea47c3-d86e-41d1-a173-5eb26229e642   (DM contact + channel member)
--   Lauren Brickner     e6eb6cfb-054f-4a33-a080-94fdbf012e8b   (channel member)
--   Magan Luzzi Messana 4d9937f8-f756-4d62-a7c2-0fdc9ab8c1f2
--   personal workspace  c54f5267-ee71-47d7-a3fc-d1e6b5c9fcc2   (Direct + Notes)
--   Franks workspace    32381fe6-56dc-4d89-ba39-aecd0756e966   (Channel)
--   #General channel    d9b1bae4-05f7-427f-8511-3d1cfdaf5df8
--   Test bcast channel  d240b3b6-768c-42ea-b250-a5c2aafc05b0

-- ── DIRECT (voxer_recordings) ────────────────────────────────────────────────
-- ClassicMode loads all of MY recordings (user_id = me), groups by contact_id
-- into threads, and reads is_outgoing for me/them. search_vector is generated.
insert into voxer_recordings
  (id, user_id, title, audio_url, duration, transcript, recorded_at, created_at,
   contact_id, contact_name, is_outgoing, played, starred, tags, notes, analysis, workspace_id)
select
  v.id::uuid,
  'feedaa8d-1f48-4ad1-b757-11c7b79b7510'::uuid,
  null,
  'https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/' || v.audio,
  v.dur,
  v.transcript,
  v.ts::timestamptz,
  v.ts::timestamptz,
  v.contact::uuid,
  null,
  v.outgoing,
  true,
  v.starred,
  '{}'::text[],
  '[]'::jsonb,
  null,
  'c54f5267-ee71-47d7-a3fc-d1e6b5c9fcc2'::uuid
from (values
  -- Frank Messana thread (0bea47c3) — multi-day for Today/Yesterday/Last week grouping
  ('5eed0001-0000-4000-8000-000000000001','0bea47c3-d86e-41d1-a173-5eb26229e642',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/0bea47c3-d86e-41d1-a173-5eb26229e642/1778777478806.webm',11,'Hey Frankie, did you get a chance to look at the Q2 numbers I sent over? I''d love to sync before the board call.',false,'2026-04-28 14:05:00+00'),
  ('5eed0001-0000-4000-8000-000000000002','0bea47c3-d86e-41d1-a173-5eb26229e642',true ,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778464185042.webm',9 ,'Yeah, going through them now. The margin on the new SKU looks better than we modeled. Let''s talk Monday.',false,'2026-04-28 14:40:00+00'),
  ('5eed0001-0000-4000-8000-000000000003','0bea47c3-d86e-41d1-a173-5eb26229e642',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/9af4fe07-4d0e-4e58-ba2c-252e8a7b682d/1778300157319.webm',12,'Monday works. Can you loop Lauren in on the vendor contract? She''s got the context on the Paesanos account.',false,'2026-05-12 10:15:00+00'),
  ('5eed0001-0000-4000-8000-000000000004','0bea47c3-d86e-41d1-a173-5eb26229e642',true ,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778300121599.webm',8 ,'Done — added her to the thread. I''ll have the redline back to you by Wednesday.',false,'2026-05-12 10:31:00+00'),
  ('5eed0001-0000-4000-8000-000000000005','0bea47c3-d86e-41d1-a173-5eb26229e642',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778299884196.webm',10,'Redline looks clean. One thing: push the renewal date to October so it doesn''t collide with the audit.',true ,'2026-05-20 16:20:00+00'),
  ('5eed0001-0000-4000-8000-000000000006','0bea47c3-d86e-41d1-a173-5eb26229e642',true ,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/0bea47c3-d86e-41d1-a173-5eb26229e642/1778777478806.webm',9 ,'Good catch. Moved it to October 15th. Sending the final over for signature today.',false,'2026-05-21 09:12:00+00'),
  ('5eed0001-0000-4000-8000-000000000007','0bea47c3-d86e-41d1-a173-5eb26229e642',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778464185042.webm',7 ,'Signed and sent it back. Appreciate you turning that around so fast.',false,'2026-05-24 11:43:00+00'),
  ('5eed0001-0000-4000-8000-000000000008','0bea47c3-d86e-41d1-a173-5eb26229e642',true ,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/9af4fe07-4d0e-4e58-ba2c-252e8a7b682d/1778300157319.webm',6 ,'Anytime. Quick heads up — I''m moving our standup to 9:30 starting Monday.',false,'2026-05-24 11:50:00+00'),
  ('5eed0001-0000-4000-8000-000000000009','0bea47c3-d86e-41d1-a173-5eb26229e642',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778300121599.webm',7 ,'Works for me. Are we still doing the zoo fundraiser next month?',false,'2026-05-25 08:19:00+00'),
  ('5eed0001-0000-4000-8000-000000000010','0bea47c3-d86e-41d1-a173-5eb26229e642',true ,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778299884196.webm',6 ,'We are — I''ll send the details over. Talk later.',false,'2026-05-25 09:24:00+00'),
  -- Lauren Brickner thread (e6eb6cfb)
  ('5eed0001-0000-4000-8000-000000000011','e6eb6cfb-054f-4a33-a080-94fdbf012e8b',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/0bea47c3-d86e-41d1-a173-5eb26229e642/1778777478806.webm',9 ,'Frankie, the Paesanos catering order is confirmed for the 12th. Sending the invoice now.',true ,'2026-05-24 13:02:00+00'),
  ('5eed0001-0000-4000-8000-000000000012','e6eb6cfb-054f-4a33-a080-94fdbf012e8b',true ,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778464185042.webm',7 ,'Perfect, thanks Lauren. Can you cc Frank so he''s got the paper trail?',false,'2026-05-24 13:10:00+00'),
  ('5eed0001-0000-4000-8000-000000000013','e6eb6cfb-054f-4a33-a080-94fdbf012e8b',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/9af4fe07-4d0e-4e58-ba2c-252e8a7b682d/1778300157319.webm',9 ,'Done. Also flagged a date conflict with the tasting, so I moved it to the 14th.',false,'2026-05-25 10:05:00+00'),
  -- Magan Luzzi Messana thread (4d9937f8)
  ('5eed0001-0000-4000-8000-000000000014','4d9937f8-f756-4d62-a7c2-0fdc9ab8c1f2',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778300121599.webm',4 ,'Did you book the flights yet?',false,'2026-05-23 19:30:00+00'),
  ('5eed0001-0000-4000-8000-000000000015','4d9937f8-f756-4d62-a7c2-0fdc9ab8c1f2',true ,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778299884196.webm',5 ,'Booking tonight. Aisle or window?',false,'2026-05-23 20:05:00+00'),
  ('5eed0001-0000-4000-8000-000000000016','4d9937f8-f756-4d62-a7c2-0fdc9ab8c1f2',false,'quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/0bea47c3-d86e-41d1-a173-5eb26229e642/1778777478806.webm',4 ,'Window, obviously.',false,'2026-05-25 07:50:00+00')
) as v(id, contact, outgoing, audio, dur, transcript, starred, ts);

-- ── CHANNEL (team_vox_messages) — #General in the Franks workspace ───────────
insert into team_vox_messages
  (id, channel_id, workspace_id, sender_id, sender_name, audio_url, duration, transcript, message_type, action_items, mentions, reactions, created_at)
values
  ('5eed0002-0000-4000-8000-000000000001','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','feedaa8d-1f48-4ad1-b757-11c7b79b7510','Frankie Messana','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/team_vox/32381fe6-56dc-4d89-ba39-aecd0756e966/d9b1bae4-05f7-427f-8511-3d1cfdaf5df8/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1779651822461.webm',14,'Morning team — we''re shipping the Voice Studio redesign today. Every Relay section is rebuilt on the new studio cards. Big week.','announcement','{}'::text[],'{}'::uuid[],'{}'::jsonb,'2026-05-25 08:30:00+00'),
  ('5eed0002-0000-4000-8000-000000000002','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','0bea47c3-d86e-41d1-a173-5eb26229e642','Frank Messana','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/0bea47c3-d86e-41d1-a173-5eb26229e642/1778777478806.webm',8,'@frankie this looks incredible. The flat cards read so much faster than the old bubbles.','normal','{}'::text[],'{feedaa8d-1f48-4ad1-b757-11c7b79b7510}'::uuid[],'{}'::jsonb,'2026-05-25 09:02:00+00'),
  ('5eed0002-0000-4000-8000-000000000003','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','e6eb6cfb-054f-4a33-a080-94fdbf012e8b','Lauren Brickner (Office.Paesanos)','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778464185042.webm',11,'Standup: closed the Paesanos catering order, the invoice is out, and I''m chasing the tasting date.','standup','{"Send Paesanos invoice","Confirm tasting date"}'::text[],'{}'::uuid[],'{}'::jsonb,'2026-05-25 09:30:00+00'),
  ('5eed0002-0000-4000-8000-000000000004','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','feedaa8d-1f48-4ad1-b757-11c7b79b7510','Frankie Messana','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/team_vox/32381fe6-56dc-4d89-ba39-aecd0756e966/d9b1bae4-05f7-427f-8511-3d1cfdaf5df8/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1779651822461.webm',6,'Nice work Lauren. I''ll handle the broadcast announcement this afternoon.','normal','{}'::text[],'{}'::uuid[],'{}'::jsonb,'2026-05-25 09:45:00+00'),
  ('5eed0002-0000-4000-8000-000000000005','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','0bea47c3-d86e-41d1-a173-5eb26229e642','Frank Messana','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/9af4fe07-4d0e-4e58-ba2c-252e8a7b682d/1778300157319.webm',12,'Standup: finished the vendor redline, pushed the renewal to October, just waiting on signature.','standup','{"Push renewal to October","Chase signature"}'::text[],'{}'::uuid[],'{}'::jsonb,'2026-05-24 09:31:00+00'),
  ('5eed0002-0000-4000-8000-000000000006','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','e6eb6cfb-054f-4a33-a080-94fdbf012e8b','Lauren Brickner (Office.Paesanos)','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778300121599.webm',6,'@frank got the signed contract — filing it now.','normal','{}'::text[],'{0bea47c3-d86e-41d1-a173-5eb26229e642}'::uuid[],'{}'::jsonb,'2026-05-24 14:20:00+00'),
  ('5eed0002-0000-4000-8000-000000000007','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','feedaa8d-1f48-4ad1-b757-11c7b79b7510','Frankie Messana','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/team_vox/32381fe6-56dc-4d89-ba39-aecd0756e966/d9b1bae4-05f7-427f-8511-3d1cfdaf5df8/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1779651822461.webm',5,'Reminder: standup moves to 9:30 starting Monday.','normal','{}'::text[],'{}'::uuid[],'{}'::jsonb,'2026-05-24 16:00:00+00'),
  ('5eed0002-0000-4000-8000-000000000008','d9b1bae4-05f7-427f-8511-3d1cfdaf5df8','32381fe6-56dc-4d89-ba39-aecd0756e966','0bea47c3-d86e-41d1-a173-5eb26229e642','Frank Messana','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/quick_vox/feedaa8d-1f48-4ad1-b757-11c7b79b7510/106aa77b-1abf-4636-ae82-4f53e218832d/1778299884196.webm',5,'Anyone have the deck from last week''s sync?','normal','{}'::text[],'{}'::uuid[],'{}'::jsonb,'2026-05-23 11:15:00+00');

update vox_team_channels set last_message_at='2026-05-25 09:45:00+00'
where id='d9b1bae4-05f7-427f-8511-3d1cfdaf5df8';

-- ── BROADCAST (broadcasts) — episodes in the Test channel ────────────────────
insert into broadcasts
  (id, channel_id, author_id, author_name, title, description, audio_url, duration, transcript, listen_count, reaction_counts, is_live, published_at, scheduled_for, tags, episode_number, created_at)
values
  ('5eed0003-0000-4000-8000-000000000001','d240b3b6-768c-42ea-b250-a5c2aafc05b0','feedaa8d-1f48-4ad1-b757-11c7b79b7510','Frankie Messana','Weekly Roundup — Redesign Ships',null,'https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/broadcasts/d240b3b6-768c-42ea-b250-a5c2aafc05b0/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778729776151.webm',48,'Big one this week: the Voice Studio redesign is live across every Relay section. Flat studio cards, one shared waveform, coral reserved for what''s actually playing. Next up — real audio peaks and a pass on Live rooms.',142,'{}'::jsonb,false,'2026-05-25 12:30:00+00',null,'{}'::text[],4,'2026-05-25 12:30:00+00'),
  ('5eed0003-0000-4000-8000-000000000002','d240b3b6-768c-42ea-b250-a5c2aafc05b0','feedaa8d-1f48-4ad1-b757-11c7b79b7510','Frankie Messana','Behind the Voice Studio',null,'https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/broadcasts/d240b3b6-768c-42ea-b250-a5c2aafc05b0/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1777338160234.webm',75,'How the inbox became the reference surface and why every other section followed: the masthead, the studio card, and the shared transport that keeps playing as you move between sources.',98,'{}'::jsonb,false,'2026-05-22 17:00:00+00',null,'{}'::text[],3,'2026-05-22 17:00:00+00'),
  ('5eed0003-0000-4000-8000-000000000003','d240b3b6-768c-42ea-b250-a5c2aafc05b0','feedaa8d-1f48-4ad1-b757-11c7b79b7510','Frankie Messana','Coral as Signal',null,'https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/broadcasts/d240b3b6-768c-42ea-b250-a5c2aafc05b0/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778729776151.webm',52,'A short one on the design system rule that did the most work: coral only marks the now-playing source, the record state, and AI output. Everything else stays quiet.',76,'{}'::jsonb,false,'2026-05-18 15:10:00+00',null,'{}'::text[],2,'2026-05-18 15:10:00+00'),
  ('5eed0003-0000-4000-8000-000000000004','d240b3b6-768c-42ea-b250-a5c2aafc05b0','feedaa8d-1f48-4ad1-b757-11c7b79b7510','Frankie Messana','Why We Rebuilt Relay',null,'https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/broadcasts/d240b3b6-768c-42ea-b250-a5c2aafc05b0/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1777338160234.webm',63,'The origin story: chat bubbles made a voice app feel like a text app. Voice Memos and pro audio tools were the right reference, not messaging. So we rebuilt around the waveform.',120,'{}'::jsonb,false,'2026-05-12 14:00:00+00',null,'{}'::text[],1,'2026-05-12 14:00:00+00');

update pulse_channels set last_broadcast_at='2026-05-25 12:30:00+00'
where id='d240b3b6-768c-42ea-b250-a5c2aafc05b0';

-- ── NOTES (vox_notes) ────────────────────────────────────────────────────────
insert into vox_notes
  (id, user_id, audio_url, duration, transcript, title, summary, tags, linked_items, is_favorite, created_at, updated_at, workspace_id)
values
  ('5eed0004-0000-4000-8000-000000000001','feedaa8d-1f48-4ad1-b757-11c7b79b7510','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/vox_notes/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1779643555232.webm',38,'Pull the Q2 margin numbers and the vendor renewal timeline before the 10am board call. Frank wants the SKU breakdown front and center.','Board call prep','Q2 margins + vendor renewal timeline for the board call; lead with the SKU breakdown.','{"work","board"}'::text[],'[]'::jsonb,true ,'2026-05-25 07:10:00+00','2026-05-25 07:10:00+00','c54f5267-ee71-47d7-a3fc-d1e6b5c9fcc2'),
  ('5eed0004-0000-4000-8000-000000000002','feedaa8d-1f48-4ad1-b757-11c7b79b7510','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/vox_notes/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778729804104.webm',22,'She mentioned wanting the window seat for the trip — maybe surprise her with the lounge passes too. Book before prices jump.','Gift idea for Magan','Surprise Magan with lounge passes for the trip; book before prices rise.','{"personal"}'::text[],'[]'::jsonb,false,'2026-05-24 21:40:00+00','2026-05-24 21:40:00+00','c54f5267-ee71-47d7-a3fc-d1e6b5c9fcc2'),
  ('5eed0004-0000-4000-8000-000000000003','feedaa8d-1f48-4ad1-b757-11c7b79b7510','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/vox_notes/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1779643555232.webm',29,'Catering confirmed for the 12th, tasting moved to the 14th. Cc Frank on the invoice and double-check the headcount with Lauren.','Paesanos follow-ups','Catering 12th, tasting 14th; cc Frank on invoice, confirm headcount with Lauren.','{"paesanos","todo"}'::text[],'[]'::jsonb,false,'2026-05-23 18:25:00+00','2026-05-23 18:25:00+00','c54f5267-ee71-47d7-a3fc-d1e6b5c9fcc2'),
  ('5eed0004-0000-4000-8000-000000000004','feedaa8d-1f48-4ad1-b757-11c7b79b7510','https://ucaeuszgoihoyrvhewxk.supabase.co/storage/v1/object/public/relay/vox_notes/feedaa8d-1f48-4ad1-b757-11c7b79b7510/1778729804104.webm',31,'The flat studio cards read so much faster than the bubbles did. Coral-as-signal really tightened the whole surface. Worth writing up as a pattern.','Redesign retro thoughts','Flat cards beat bubbles; coral-as-signal tightened the surface — write it up.','{"design","relay"}'::text[],'[]'::jsonb,true ,'2026-05-21 13:05:00+00','2026-05-21 13:05:00+00','c54f5267-ee71-47d7-a3fc-d1e6b5c9fcc2');

-- ── CLEANUP (run to remove all of the above; not executed by the seed) ───────
-- delete from voxer_recordings  where id::text like '5eed%';
-- delete from team_vox_messages where id::text like '5eed%';
-- delete from broadcasts        where id::text like '5eed%';
-- delete from vox_notes         where id::text like '5eed%';
