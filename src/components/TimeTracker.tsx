import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Play, Square, Clock, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface TimeTrackerProps {
  taskId: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}ঘ ${m}মি`;
  return `${m}মি`;
}

export function TimeTracker({ taskId }: TimeTrackerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [showManual, setShowManual] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch time logs
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["time-logs", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data.map((l: any) => l.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const profileMap = new Map(profiles?.map((p: any) => [p.id, p.full_name]) || []);

      return data.map((l: any) => ({ ...l, user_name: profileMap.get(l.user_id) || "User" }));
    },
  });

  // Check for active timer (no ended_at)
  const activeLog = timeLogs.find((l: any) => !l.ended_at && l.user_id === user?.id);

  // Update elapsed time for active timer
  useEffect(() => {
    if (activeLog) {
      const updateElapsed = () => {
        const startTime = new Date(activeLog.started_at).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - startTime) / 1000));
      };
      updateElapsed();
      intervalRef.current = setInterval(updateElapsed, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [activeLog?.id]);

  // Start timer
  const startTimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("time_logs").insert({
        task_id: taskId,
        user_id: user!.id,
        started_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
      toast.success("টাইমার শুরু হয়েছে!");
    },
    onError: () => toast.error("টাইমার শুরু করতে সমস্যা হয়েছে।"),
  });

  // Stop timer
  const stopTimer = useMutation({
    mutationFn: async () => {
      if (!activeLog) return;
      const startTime = new Date(activeLog.started_at).getTime();
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const { error } = await supabase
        .from("time_logs")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq("id", activeLog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
      toast.success("টাইমার বন্ধ হয়েছে!");
    },
  });

  // Add manual entry
  const addManual = useMutation({
    mutationFn: async () => {
      const h = parseInt(manualHours) || 0;
      const m = parseInt(manualMinutes) || 0;
      const totalSeconds = h * 3600 + m * 60;
      if (totalSeconds <= 0) throw new Error("Invalid duration");

      const now = new Date();
      const startedAt = new Date(now.getTime() - totalSeconds * 1000);

      const { error } = await supabase.from("time_logs").insert({
        task_id: taskId,
        user_id: user!.id,
        started_at: startedAt.toISOString(),
        ended_at: now.toISOString(),
        duration_seconds: totalSeconds,
        description: manualDesc || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
      setManualHours("");
      setManualMinutes("");
      setManualDesc("");
      setShowManual(false);
      toast.success("সময় লগ করা হয়েছে!");
    },
    onError: () => toast.error("সময় লগ করতে সমস্যা হয়েছে।"),
  });

  // Delete log
  const deleteLog = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from("time_logs").delete().eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
    },
  });

  const totalSeconds = timeLogs
    .filter((l: any) => l.duration_seconds > 0)
    .reduce((sum: number, l: any) => sum + l.duration_seconds, 0);

  return (
    <div className="space-y-4 p-4">
      {/* Timer Control */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">
            {activeLog ? "টাইমার চলছে..." : "টাইমার"}
          </p>
          <p className={`text-2xl font-mono font-bold ${activeLog ? "text-primary" : "text-foreground"}`}>
            {activeLog ? formatDuration(elapsed) : "00:00:00"}
          </p>
        </div>
        {activeLog ? (
          <Button
            onClick={() => stopTimer.mutate()}
            disabled={stopTimer.isPending}
            variant="destructive"
            size="lg"
            className="gap-2 rounded-xl"
          >
            <Square className="h-4 w-4" />
            বন্ধ করুন
          </Button>
        ) : (
          <Button
            onClick={() => startTimer.mutate()}
            disabled={startTimer.isPending}
            size="lg"
            className="gap-2 rounded-xl"
          >
            <Play className="h-4 w-4" />
            শুরু করুন
          </Button>
        )}
      </div>

      {/* Manual entry toggle */}
      <div>
        {!showManual ? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShowManual(true)}>
            <Plus className="h-3 w-3" /> ম্যানুয়ালি সময় যোগ করুন
          </Button>
        ) : (
          <div className="p-3 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  className="w-16 h-8 text-center text-sm"
                />
                <span className="text-xs text-muted-foreground">ঘণ্টা</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  className="w-16 h-8 text-center text-sm"
                />
                <span className="text-xs text-muted-foreground">মিনিট</span>
              </div>
            </div>
            <Input
              placeholder="বিবরণ (ঐচ্ছিক)"
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addManual.mutate()} disabled={addManual.isPending}>
                যোগ করুন
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowManual(false)}>বাতিল</Button>
            </div>
          </div>
        )}
      </div>

      {/* Total time */}
      <div className="flex items-center gap-2 px-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          মোট সময়: {formatHoursMinutes(totalSeconds)}
        </span>
        <span className="text-xs text-muted-foreground">({timeLogs.filter((l: any) => l.duration_seconds > 0).length}টি এন্ট্রি)</span>
      </div>

      {/* Time logs list */}
      <div className="space-y-1">
        {timeLogs
          .filter((l: any) => l.duration_seconds > 0)
          .map((log: any) => (
            <div
              key={log.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                  {log.user_name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{log.user_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(log.started_at), "dd MMM, HH:mm")}
                  </span>
                </div>
                {log.description && (
                  <p className="text-[11px] text-muted-foreground truncate">{log.description}</p>
                )}
              </div>
              <span className="text-xs font-mono font-medium text-foreground">
                {formatHoursMinutes(log.duration_seconds)}
              </span>
              {log.user_id === user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteLog.mutate(log.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
