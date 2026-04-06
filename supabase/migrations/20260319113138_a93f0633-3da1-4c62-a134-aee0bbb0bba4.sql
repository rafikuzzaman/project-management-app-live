
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view task_dependencies"
ON public.task_dependencies FOR SELECT TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can create task_dependencies"
ON public.task_dependencies FOR INSERT TO authenticated
WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can delete task_dependencies"
ON public.task_dependencies FOR DELETE TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));
