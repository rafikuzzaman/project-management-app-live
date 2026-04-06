
CREATE TABLE public.time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view time_logs"
ON public.time_logs FOR SELECT TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Users can create own time_logs"
ON public.time_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id))
);

CREATE POLICY "Users can update own time_logs"
ON public.time_logs FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own time_logs"
ON public.time_logs FOR DELETE TO authenticated
USING (user_id = auth.uid());
