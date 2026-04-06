
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members table
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- RLS: users can see projects they are members of
CREATE POLICY "Members can view projects" ON public.projects FOR SELECT TO authenticated
  USING (id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project creators can update" ON public.projects FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Members can view project_members" ON public.project_members FOR SELECT TO authenticated
  USING (project_id IN (SELECT project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()));

CREATE POLICY "Project creators can manage members" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE created_by = auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Project creators can remove members" ON public.project_members FOR DELETE TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE created_by = auth.uid()));

-- Tasks table
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tasks" ON public.tasks FOR SELECT TO authenticated
  USING (project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can create tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Members can update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

CREATE POLICY "Task creators can delete" ON public.tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Sub-tasks table
CREATE TABLE public.sub_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sub_tasks" ON public.sub_tasks FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can create sub_tasks" ON public.sub_tasks FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can update sub_tasks" ON public.sub_tasks FOR UPDATE TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can delete sub_tasks" ON public.sub_tasks FOR DELETE TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#f97316',
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  UNIQUE(name, project_id)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_tags (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tags" ON public.tags FOR SELECT TO authenticated
  USING (project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can create tags" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can view task_tags" ON public.task_tags FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can manage task_tags" ON public.task_tags FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can delete task_tags" ON public.task_tags FOR DELETE TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())));

-- Auto-add creator as project member
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();
