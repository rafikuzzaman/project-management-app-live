import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, User, MessageSquare, ListChecks, Timer } from "lucide-react";
import { format } from "date-fns";
import { TaskComments } from "./TaskComments";
import { TimeTracker } from "./TimeTracker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  project_id: string;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityStyles = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Complete",
};

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const queryClient = useQueryClient();

  const { data: assignee } = useQuery({
    queryKey: ["profile", task?.assignee_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", task!.assignee_id!).single();
      return data;
    },
    enabled: !!task?.assignee_id,
  });

  const { data: subTasks = [] } = useQuery({
    queryKey: ["sub-tasks", task?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_tasks")
        .select("*")
        .eq("task_id", task!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!task?.id,
  });

  const { data: commentCount = 0 } = useQuery({
    queryKey: ["comment-count", task?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("task_comments")
        .select("*", { count: "exact", head: true })
        .eq("task_id", task!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!task?.id,
  });

  const toggleSubTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("sub_tasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sub-tasks", task?.id] }),
  });

  if (!task) return null;

  const completedSubs = subTasks.filter((s: any) => s.completed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <DialogTitle className="text-lg font-bold text-foreground mb-2">{task.title}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${priorityStyles[task.priority]}`}>
                  {task.priority}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {statusLabels[task.status] || task.status}
                </Badge>
                {task.due_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.due_date), "dd MMM yyyy")}
                  </div>
                )}
                {task.assignee_id && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    {assignee?.full_name || "Assigned"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <Tabs defaultValue="comments" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-2 w-fit">
            <TabsTrigger value="details" className="gap-1.5 text-xs">
              <ListChecks className="h-3.5 w-3.5" /> বিবরণ
              {subTasks.length > 0 && (
                <span className="text-[10px] text-muted-foreground">({completedSubs}/{subTasks.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> কমেন্ট
              {commentCount > 0 && (
                <span className="text-[10px] text-muted-foreground">({commentCount})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="time" className="gap-1.5 text-xs">
              <Timer className="h-3.5 w-3.5" /> সময়
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-y-auto px-5 pb-5 mt-0">
            {task.description && (
              <div className="mt-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">বিবরণ</h4>
                <p className="text-sm text-foreground">{task.description}</p>
              </div>
            )}

            {subTasks.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  সাব-টাস্ক ({completedSubs}/{subTasks.length})
                </h4>
                <div className="space-y-2">
                  {subTasks.map((sub: any) => (
                    <label
                      key={sub.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={sub.completed}
                        onCheckedChange={(checked) =>
                          toggleSubTask.mutate({ id: sub.id, completed: !!checked })
                        }
                      />
                      <span className={`text-sm ${sub.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {sub.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!task.description && subTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">কোনো বিবরণ বা সাব-টাস্ক নেই।</p>
            )}
          </TabsContent>

          <TabsContent value="comments" className="flex-1 min-h-0 flex flex-col mt-0">
            <div className="flex-1 min-h-[300px] max-h-[400px] flex flex-col">
              <TaskComments taskId={task.id} projectId={task.project_id} />
            </div>
          </TabsContent>
          <TabsContent value="time" className="flex-1 overflow-y-auto mt-0">
            <TimeTracker taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
