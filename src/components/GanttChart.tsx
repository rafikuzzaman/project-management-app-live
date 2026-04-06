import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Link2, Plus } from "lucide-react";
import { format, addDays, differenceInDays, startOfDay, max, min, isWeekend, subDays } from "date-fns";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  assignee_id: string | null;
  project_id: string;
}

interface Dependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

interface GanttChartProps {
  tasks: Task[];
  projectId: string;
}

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-muted-foreground/40",
  in_progress: "bg-primary",
  review: "bg-warning",
  done: "bg-success",
};

const STATUS_BG: Record<string, string> = {
  todo: "bg-muted-foreground/10",
  in_progress: "bg-primary/10",
  review: "bg-warning/10",
  done: "bg-success/10",
};

const CELL_WIDTH = 40;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 60;
const TASK_BAR_HEIGHT = 24;
const LABEL_WIDTH = 260;

export function GanttChart({ tasks, projectId }: GanttChartProps) {
  const queryClient = useQueryClient();
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [addingDep, setAddingDep] = useState<string | null>(null);

  const { data: dependencies = [] } = useQuery({
    queryKey: ["task-dependencies", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .in("task_id", tasks.map((t) => t.id));
      if (error) throw error;
      return data as Dependency[];
    },
    enabled: tasks.length > 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["project-profiles", projectId],
    queryFn: async () => {
      const assigneeIds = [...new Set(tasks.filter((t) => t.assignee_id).map((t) => t.assignee_id!))];
      if (assigneeIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", assigneeIds);
      return data || [];
    },
  });

  const addDependency = useMutation({
    mutationFn: async ({ taskId, dependsOn }: { taskId: string; dependsOn: string }) => {
      const { error } = await supabase.from("task_dependencies").insert({
        task_id: taskId,
        depends_on_task_id: dependsOn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", projectId] });
      toast.success("ডিপেন্ডেন্সি যোগ হয়েছে!");
      setAddingDep(null);
    },
    onError: () => toast.error("ডিপেন্ডেন্সি যোগ করতে সমস্যা হয়েছে।"),
  });

  const removeDependency = useMutation({
    mutationFn: async (depId: string) => {
      const { error } = await supabase.from("task_dependencies").delete().eq("id", depId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", projectId] });
      toast.success("ডিপেন্ডেন্সি মুছে ফেলা হয়েছে!");
    },
  });

  // Calculate date range (4 weeks view)
  const today = startOfDay(new Date());
  const viewStart = addDays(today, offsetWeeks * 7 - 7);
  const totalDays = 35;
  const viewEnd = addDays(viewStart, totalDays);
  const days = Array.from({ length: totalDays }, (_, i) => addDays(viewStart, i));

  // Group days by week
  const weeks = useMemo(() => {
    const w: { start: Date; days: Date[] }[] = [];
    let current: Date[] = [];
    days.forEach((day, i) => {
      current.push(day);
      if (current.length === 7 || i === days.length - 1) {
        w.push({ start: current[0], days: [...current] });
        current = [];
      }
    });
    return w;
  }, [offsetWeeks]);

  const getTaskStart = (task: Task) => startOfDay(new Date(task.created_at));
  const getTaskEnd = (task: Task) => task.due_date ? startOfDay(new Date(task.due_date)) : addDays(getTaskStart(task), 3);

  const getBarPosition = (task: Task) => {
    const start = getTaskStart(task);
    const end = getTaskEnd(task);
    const startOffset = differenceInDays(start, viewStart);
    const duration = Math.max(differenceInDays(end, start), 1);
    return {
      left: Math.max(startOffset, 0) * CELL_WIDTH,
      width: Math.max(Math.min(startOffset + duration, totalDays) - Math.max(startOffset, 0), 0.5) * CELL_WIDTH,
      isVisible: startOffset + duration > 0 && startOffset < totalDays,
    };
  };

  const profileMap = new Map(profiles.map((p: any) => [p.id, p.full_name]));

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aStart = getTaskStart(a);
      const bStart = getTaskStart(b);
      return aStart.getTime() - bStart.getTime();
    });
  }, [tasks]);

  // Today line position
  const todayOffset = differenceInDays(today, viewStart);
  const showTodayLine = todayOffset >= 0 && todayOffset < totalDays;

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card shrink-0">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffsetWeeks((w) => w - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOffsetWeeks(0)}>
          আজ
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffsetWeeks((w) => w + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {format(viewStart, "dd MMM")} — {format(viewEnd, "dd MMM yyyy")}
        </span>

        {addingDep && (
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Link2 className="h-3 w-3 mr-1" /> ডিপেন্ডেন্সি যোগ করতে একটি টাস্কে ক্লিক করুন
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setAddingDep(null)}>বাতিল</Button>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-w-max">
          {/* Task labels */}
          <div className="shrink-0 border-r border-border bg-card z-10 sticky left-0">
            {/* Header spacer */}
            <div className="h-[60px] border-b border-border px-3 flex items-end pb-2">
              <span className="text-xs font-medium text-muted-foreground">টাস্ক</span>
            </div>
            {/* Task rows */}
            {sortedTasks.map((task) => {
              const taskDeps = dependencies.filter((d) => d.task_id === task.id);
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 px-3 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${
                    addingDep === task.id ? "bg-primary/5" : ""
                  }`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => {
                    if (addingDep && addingDep !== task.id) {
                      addDependency.mutate({ taskId: addingDep, dependsOn: task.id });
                    }
                  }}
                >
                  <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[task.status]}`} />
                  <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{task.title}</span>
                  {taskDeps.length > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                      <Link2 className="h-2.5 w-2.5 mr-0.5" />{taskDeps.length}
                    </Badge>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-auto shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingDep(task.id);
                        }}
                      >
                        <Link2 className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                  </Popover>
                </div>
              );
            })}
          </div>

          {/* Timeline grid */}
          <div className="flex-1 relative">
            {/* Header with dates */}
            <div className="sticky top-0 z-10 bg-card border-b border-border" style={{ height: HEADER_HEIGHT }}>
              {/* Week labels */}
              <div className="flex">
                {weeks.map((week, wi) => (
                  <div
                    key={wi}
                    className="border-r border-border/50 text-center"
                    style={{ width: week.days.length * CELL_WIDTH }}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {format(week.start, "MMM yyyy")}
                    </span>
                  </div>
                ))}
              </div>
              {/* Day labels */}
              <div className="flex">
                {days.map((day, i) => {
                  const isToday = differenceInDays(day, today) === 0;
                  const weekend = isWeekend(day);
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center border-r border-border/30 ${
                        isToday ? "bg-primary/10" : weekend ? "bg-muted/30" : ""
                      }`}
                      style={{ width: CELL_WIDTH, height: 36 }}
                    >
                      <span className={`text-[9px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {format(day, "EEE")}
                      </span>
                      <span className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "d")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task bars */}
            <div className="relative">
              {/* Grid lines */}
              {days.map((day, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 border-r border-border/20 ${
                    isWeekend(day) ? "bg-muted/20" : ""
                  }`}
                  style={{ left: i * CELL_WIDTH, width: CELL_WIDTH, height: sortedTasks.length * ROW_HEIGHT }}
                />
              ))}

              {/* Today line */}
              {showTodayLine && (
                <div
                  className="absolute top-0 w-0.5 bg-primary z-20"
                  style={{
                    left: todayOffset * CELL_WIDTH + CELL_WIDTH / 2,
                    height: sortedTasks.length * ROW_HEIGHT,
                  }}
                />
              )}

              {/* Dependency lines */}
              {dependencies.map((dep) => {
                const fromTask = sortedTasks.find((t) => t.id === dep.depends_on_task_id);
                const toTask = sortedTasks.find((t) => t.id === dep.task_id);
                if (!fromTask || !toTask) return null;

                const fromPos = getBarPosition(fromTask);
                const toPos = getBarPosition(toTask);
                const fromIndex = sortedTasks.indexOf(fromTask);
                const toIndex = sortedTasks.indexOf(toTask);

                if (!fromPos.isVisible && !toPos.isVisible) return null;

                const x1 = fromPos.left + fromPos.width;
                const y1 = fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = toPos.left;
                const y2 = toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                const midX = x1 + 15;

                return (
                  <svg
                    key={dep.id}
                    className="absolute top-0 left-0 pointer-events-none z-10"
                    style={{ width: totalDays * CELL_WIDTH, height: sortedTasks.length * ROW_HEIGHT }}
                  >
                    <path
                      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                      opacity="0.5"
                    />
                    <circle cx={x2} cy={y2} r="3" fill="hsl(var(--primary))" opacity="0.6" />
                  </svg>
                );
              })}

              {/* Task bars */}
              {sortedTasks.map((task, index) => {
                const pos = getBarPosition(task);
                const assigneeName = task.assignee_id ? profileMap.get(task.assignee_id) : null;

                return (
                  <div
                    key={task.id}
                    className="relative border-b border-border/20"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {pos.isVisible && pos.width > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute top-[10px] rounded-md ${STATUS_COLORS[task.status]} cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2 overflow-hidden`}
                            style={{
                              left: pos.left,
                              width: Math.max(pos.width, 8),
                              height: TASK_BAR_HEIGHT,
                            }}
                            onClick={() => {
                              if (addingDep && addingDep !== task.id) {
                                addDependency.mutate({ taskId: addingDep, dependsOn: task.id });
                              } else if (!addingDep) {
                                setAddingDep(task.id);
                              }
                            }}
                          >
                            {pos.width > 50 && (
                              <span className="text-[10px] font-medium text-white truncate">
                                {task.title}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-muted-foreground">
                            {format(getTaskStart(task), "dd MMM")} → {format(getTaskEnd(task), "dd MMM")}
                          </p>
                          {assigneeName && <p className="text-muted-foreground">👤 {assigneeName}</p>}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {sortedTasks.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">কোনো টাস্ক নেই। টাস্ক তৈরি করুন টাইমলাইন দেখতে।</p>
          </div>
        )}
      </div>
    </div>
  );
}
