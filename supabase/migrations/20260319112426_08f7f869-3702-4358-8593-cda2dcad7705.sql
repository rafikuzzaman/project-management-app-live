
-- Drop the recursive SELECT policy on project_members
DROP POLICY IF EXISTS "Members can view project_members" ON public.project_members;

-- Create a security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- Recreate SELECT policy using the security definer function
CREATE POLICY "Members can view project_members"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_project_member(auth.uid(), project_id)
);

-- Also fix the projects SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
CREATE POLICY "Members can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_project_member(auth.uid(), id)
);

-- Fix tasks policies
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
CREATE POLICY "Members can view tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
CREATE POLICY "Members can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  public.is_project_member(auth.uid(), project_id)
);

DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
CREATE POLICY "Members can create tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_project_member(auth.uid(), project_id)
  AND created_by = auth.uid()
);

-- Fix sub_tasks policies
DROP POLICY IF EXISTS "Members can view sub_tasks" ON public.sub_tasks;
DROP POLICY IF EXISTS "Members can create sub_tasks" ON public.sub_tasks;
DROP POLICY IF EXISTS "Members can update sub_tasks" ON public.sub_tasks;
DROP POLICY IF EXISTS "Members can delete sub_tasks" ON public.sub_tasks;

CREATE POLICY "Members can view sub_tasks"
ON public.sub_tasks FOR SELECT TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can create sub_tasks"
ON public.sub_tasks FOR INSERT TO authenticated
WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can update sub_tasks"
ON public.sub_tasks FOR UPDATE TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can delete sub_tasks"
ON public.sub_tasks FOR DELETE TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

-- Fix tags policies
DROP POLICY IF EXISTS "Members can view tags" ON public.tags;
DROP POLICY IF EXISTS "Members can create tags" ON public.tags;

CREATE POLICY "Members can view tags"
ON public.tags FOR SELECT TO authenticated
USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can create tags"
ON public.tags FOR INSERT TO authenticated
WITH CHECK (public.is_project_member(auth.uid(), project_id));

-- Fix task_tags policies
DROP POLICY IF EXISTS "Members can view task_tags" ON public.task_tags;
DROP POLICY IF EXISTS "Members can manage task_tags" ON public.task_tags;
DROP POLICY IF EXISTS "Members can delete task_tags" ON public.task_tags;

CREATE POLICY "Members can view task_tags"
ON public.task_tags FOR SELECT TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can manage task_tags"
ON public.task_tags FOR INSERT TO authenticated
WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

CREATE POLICY "Members can delete task_tags"
ON public.task_tags FOR DELETE TO authenticated
USING (task_id IN (SELECT id FROM public.tasks WHERE public.is_project_member(auth.uid(), project_id)));

-- Fix project_members INSERT policy
DROP POLICY IF EXISTS "Project creators can manage members" ON public.project_members;
CREATE POLICY "Project creators can manage members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid()))
  OR (user_id = auth.uid())
);
