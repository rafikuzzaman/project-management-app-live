import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assignee_id: string | null;
}

const priorityStyles = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const { data: assignee } = useQuery({
    queryKey: ["profile", task.assignee_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", task.assignee_id!).single();
      return data;
    },
    enabled: !!task.assignee_id,
  });

  const { data: commentCount = 0 } = useQuery({
    queryKey: ["comment-count", task.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("task_comments")
        .select("*", { count: "exact", head: true })
        .eq("task_id", task.id);
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <Card
      className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-border/50 bg-card"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-full ${priorityStyles[task.priority]}`}>
            {task.priority}
          </Badge>
        </div>

        <h4 className="text-sm font-semibold text-foreground leading-tight">{task.title}</h4>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        {task.due_date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(task.due_date), "dd MMM")}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex -space-x-1.5">
            {task.assignee_id && (
              <Avatar className="h-6 w-6 border-2 border-card">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {assignee?.full_name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>{commentCount}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
