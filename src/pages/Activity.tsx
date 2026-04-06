import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { CheckCircle2, Plus, Edit, ArrowRight, Clock } from "lucide-react";

type ActivityItem = {
  id: string;
  type: "created" | "updated" | "completed";
  title: string;
  project_name: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
};

export default function Activity() {
  const { user } = useAuth();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["activity-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name)")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const getIcon = (status: string) => {
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "in_progress") return <ArrowRight className="h-4 w-4 text-primary" />;
    if (status === "review") return <Clock className="h-4 w-4 text-warning" />;
    return <Plus className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      todo: "To Do",
      in_progress: "চলমান",
      review: "রিভিউ",
      done: "সম্পন্ন",
    };
    return labels[status] || status;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Feed</h1>
        <p className="text-muted-foreground text-sm mt-1">প্রজেক্টের সকল সাম্প্রতিক কার্যক্রম দেখুন।</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">সাম্প্রতিক কার্যক্রম</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">কোনো কার্যক্রম নেই।</p>
          ) : (
            <div className="space-y-1">
              {tasks.map((task: any) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <div className="mt-1 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {getIcon(task.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <span className="font-semibold">{task.title}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{getStatusLabel(task.status)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
                      {(task as any).projects?.name && (
                        <span className="text-xs text-muted-foreground">{(task as any).projects.name}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
