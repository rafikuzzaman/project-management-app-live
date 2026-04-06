
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  mentions uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view task comments"
ON public.task_comments FOR SELECT TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can create task comments"
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id))
);

CREATE POLICY "Users can delete own comments"
ON public.task_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Enable realtime for task_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
