-- Track who closed a dispute (billing audit trail).
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS disputes_resolved_by_idx ON public.disputes (resolved_by);
CREATE INDEX IF NOT EXISTS status_events_entity_type_created_at_idx
  ON public.status_events (entity_type, created_at DESC);
