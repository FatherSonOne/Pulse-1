-- Allow senders to enqueue + update AI processing rows for their own messages
-- ============================================================================
-- The AI queue table only had a SELECT policy. The client-side enqueue path
-- (queueAIProcessing → INSERT into video_vox_ai_queue) was 403'ing, and the
-- subsequent UPDATEs (status='processing'/'complete'/'failed') would have
-- failed the same way. Mirror the SELECT policy logic — sender_id must match
-- auth.uid() via the parent video_vox_messages row.

CREATE POLICY "Senders can enqueue AI for own messages"
  ON public.video_vox_ai_queue FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.video_vox_messages m
      WHERE m.id = video_vox_ai_queue.message_id
        AND m.sender_id = auth.uid()
    )
  );

CREATE POLICY "Senders can update AI queue for own messages"
  ON public.video_vox_ai_queue FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.video_vox_messages m
      WHERE m.id = video_vox_ai_queue.message_id
        AND m.sender_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.video_vox_messages m
      WHERE m.id = video_vox_ai_queue.message_id
        AND m.sender_id = auth.uid()
    )
  );
