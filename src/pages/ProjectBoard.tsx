import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KanbanBoard } from "@/components/KanbanBoard";
import { GanttChart } from "@/components/GanttChart";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, LayoutGrid, List, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { format } from "date-fns";

export default function ProjectBoard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeView, setActiveView] = useState("board");
  const [selectedListTask, setSelectedListTask] = useState<any>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  if (projectLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-80" />
          ))}
        </div>
      </div>
    );
  }

  const statusIcon = (status: string) => {
    const colors: Record<string, string> = {
      todo: "bg-muted-foreground/40",
      in_progress: "bg-primary",
      review: "bg-warning",
      done: "bg-success",
    };
    return <div className={`h-2 w-2 rounded-full ${colors[status] || "bg-muted-foreground"}`} />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">{project?.name || "Project"}</h1>
          <CreateTaskDialog projectId={projectId!} />
        </div>

        <div className="flex items-center gap-4">
          <Tabs value={activeView} onValueChange={setActiveView} className="w-auto">
            <TabsList className="h-9">
              <TabsTrigger value="list" className="gap-1.5 text-xs">
                <List className="h-3.5 w-3.5" /> List
              </TabsTrigger>
              <TabsTrigger value="board" className="gap-1.5 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {activeView !== "timeline" && (
            <>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search tasks..." className="pl-9 h-9" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-background">
        {tasksLoading ? (
          <div className="flex gap-4 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-80 space-y-3">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        ) : activeView === "board" ? (
          <KanbanBoard tasks={tasks as any} projectId={projectId!} />
        ) : activeView === "timeline" ? (
          <GanttChart tasks={tasks as any} projectId={projectId!} />
        ) : (
          /* List View */
          <div className="max-w-4xl mx-auto p-6">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">কোনো টাস্ক নেই।</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                  <span>টাস্ক</span>
                  <span>স্ট্যাটাস</span>
                  <span>প্রায়োরিটি</span>
                  <span>ডেডলাইন</span>
                </div>
                {tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors items-center"
                    onClick={() => setSelectedListTask(task)}
                  >
                    <div className="flex items-center gap-2">
                      {statusIcon(task.status)}
                      <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] w-fit">
                      {task.status === "todo" ? "To Do" : task.status === "in_progress" ? "চলমান" : task.status === "review" ? "রিভিউ" : "সম্পন্ন"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] w-fit">{task.priority}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {task.due_date ? format(new Date(task.due_date), "dd MMM") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <TaskDetailDialog
              task={selectedListTask}
              open={!!selectedListTask}
              onOpenChange={(open) => !open && setSelectedListTask(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
