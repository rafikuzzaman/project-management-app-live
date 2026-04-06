import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, SlidersHorizontal, CheckCircle2, Clock, Circle, Eye } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["all-tasks-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredTasks = tasks.filter((t: any) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusIcon = (status: string) => {
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "in_progress") return <Clock className="h-4 w-4 text-primary" />;
    if (status === "review") return <Eye className="h-4 w-4 text-warning" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  const priorityColor = (p: string) => {
    if (p === "high") return "text-destructive border-destructive/30";
    if (p === "medium") return "text-warning border-warning/30";
    return "text-muted-foreground border-border";
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">আপনার সকল প্রজেক্টের টাস্কসমূহ এক জায়গায় দেখুন।</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="টাস্ক খুঁজুন..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList>
            <TabsTrigger value="all">সব</TabsTrigger>
            <TabsTrigger value="todo">To Do</TabsTrigger>
            <TabsTrigger value="in_progress">চলমান</TabsTrigger>
            <TabsTrigger value="review">রিভিউ</TabsTrigger>
            <TabsTrigger value="done">সম্পন্ন</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Task List */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">কোনো টাস্ক পাওয়া যায়নি।</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredTasks.map((task: any) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                  {statusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{(task as any).projects?.name}</p>
                  </div>
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(task.due_date), "dd MMM")}
                    </span>
                  )}
                  <Badge variant="outline" className={`text-[10px] ${priorityColor(task.priority)}`}>
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
