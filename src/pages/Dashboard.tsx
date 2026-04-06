import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { FolderKanban, ListTodo, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*, projects(name)").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const todoCount = tasks.filter((t: any) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t: any) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t: any) => t.status === "done").length;
  const overdueTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done");

  const stats = [
    { label: "মোট প্রজেক্ট", value: projects.length, icon: FolderKanban, color: "text-primary" },
    { label: "To Do", value: todoCount, icon: ListTodo, color: "text-muted-foreground" },
    { label: "চলমান", value: inProgressCount, icon: Clock, color: "text-info" },
    { label: "সম্পন্ন", value: doneCount, icon: CheckCircle2, color: "text-success" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">স্বাগতম! আপনার প্রজেক্টের সামগ্রিক অবস্থা দেখুন।</p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue warning */}
      {overdueTasks.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-foreground font-medium">{overdueTasks.length}টি টাস্কের ডেডলাইন পেরিয়ে গেছে!</span>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Projects */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">আপনার প্রজেক্টসমূহ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">কোনো প্রজেক্ট নেই। নতুন প্রজেক্ট তৈরি করুন!</p>
            ) : (
              projects.slice(0, 5).map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy")}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">সাম্প্রতিক টাস্কসমূহ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">কোনো টাস্ক নেই।</p>
            ) : (
              tasks.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <div className={`h-2 w-2 rounded-full ${t.status === "done" ? "bg-success" : t.status === "in_progress" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{(t as any).projects?.name}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
