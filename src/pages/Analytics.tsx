import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from "recharts";
import { TrendingUp, CheckCircle2, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import { format, subDays, isAfter } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  todo: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  review: "hsl(var(--warning))",
  done: "hsl(var(--success))",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "hsl(var(--muted-foreground))",
  medium: "hsl(var(--warning))",
  high: "hsl(var(--destructive))",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "চলমান",
  review: "রিভিউ",
  done: "সম্পন্ন",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export default function Analytics() {
  const [selectedProject, setSelectedProject] = useState<string>("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["analytics-tasks", selectedProject],
    queryFn: async () => {
      let query = supabase.from("tasks").select("*, projects(name)").order("created_at", { ascending: true });
      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Status distribution for Pie chart
  const statusData = ["todo", "in_progress", "review", "done"].map((status) => ({
    name: STATUS_LABELS[status],
    value: tasks.filter((t: any) => t.status === status).length,
    color: STATUS_COLORS[status],
  })).filter(d => d.value > 0);

  // Priority distribution for Bar chart
  const priorityData = ["low", "medium", "high"].map((priority) => ({
    name: PRIORITY_LABELS[priority],
    count: tasks.filter((t: any) => t.priority === priority).length,
    fill: PRIORITY_COLORS[priority],
  }));

  // Per-project task counts for Bar chart
  const projectTaskData = projects.map((p: any) => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + "…" : p.name,
    total: tasks.filter((t: any) => t.project_id === p.id).length,
    done: tasks.filter((t: any) => t.project_id === p.id && t.status === "done").length,
  })).filter(d => d.total > 0);

  // Tasks created over last 14 days for Area chart
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayLabel = format(date, "dd MMM");
    const created = tasks.filter((t: any) => format(new Date(t.created_at), "yyyy-MM-dd") === dateStr).length;
    const completed = tasks.filter(
      (t: any) => t.status === "done" && format(new Date(t.updated_at), "yyyy-MM-dd") === dateStr
    ).length;
    return { day: dayLabel, তৈরি: created, সম্পন্ন: completed };
  });

  // Stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t: any) => t.status === "done").length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter(
    (t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
  ).length;
  const inProgressTasks = tasks.filter((t: any) => t.status === "in_progress").length;

  const stats = [
    { label: "মোট টাস্ক", value: totalTasks, icon: BarChart3, color: "text-primary" },
    { label: "সম্পন্ন হার", value: `${completionRate}%`, icon: TrendingUp, color: "text-success" },
    { label: "চলমান", value: inProgressTasks, icon: Clock, color: "text-primary" },
    { label: "মেয়াদোত্তীর্ণ", value: overdueTasks, icon: AlertTriangle, color: "text-destructive" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs font-medium text-foreground">{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} className="text-xs text-muted-foreground">
              {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">অ্যানালিটিক্স</h1>
          <p className="text-muted-foreground text-sm mt-1">প্রজেক্টের প্রগ্রেস রিপোর্ট ও পরিসংখ্যান।</p>
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="প্রজেক্ট নির্বাচন" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল প্রজেক্ট</SelectItem>
            {projects.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
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

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Task Status Pie Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">টাস্কের স্ট্যাটাস বিতরণ</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">ডেটা নেই।</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Priority Bar Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">প্রায়োরিটি অনুযায়ী টাস্ক</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="টাস্ক" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Activity Trend Area Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">গত ১৪ দিনের কার্যক্রম</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={last14Days}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  iconType="circle"
                  iconSize={8}
                />
                <Area type="monotone" dataKey="তৈরি" stroke="hsl(var(--primary))" fill="url(#colorCreated)" strokeWidth={2} />
                <Area type="monotone" dataKey="সম্পন্ন" stroke="hsl(var(--success))" fill="url(#colorCompleted)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Per-project Bar Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">প্রজেক্ট অনুযায়ী টাস্ক</CardTitle>
          </CardHeader>
          <CardContent>
            {projectTaskData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">ডেটা নেই।</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={projectTaskData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="total" name="মোট" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="done" name="সম্পন্ন" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
