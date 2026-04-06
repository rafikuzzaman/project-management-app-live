import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  projectId: string;
  children?: React.ReactNode;
}

export function CreateTaskDialog({ projectId, children }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [subTasks, setSubTasks] = useState<string[]>([]);
  const [newSubTask, setNewSubTask] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id, profiles:user_id(full_name)")
        .eq("project_id", projectId);
      if (error) throw error;
      return data;
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          title,
          description: description || null,
          priority: priority as any,
          project_id: projectId,
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (subTasks.length > 0) {
        const { error: subError } = await supabase.from("sub_tasks").insert(
          subTasks.map((st) => ({ task_id: task.id, title: st }))
        );
        if (subError) throw subError;
      }
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      setOpen(false);
      resetForm();
      toast({ title: "টাস্ক তৈরি হয়েছে!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssigneeId("");
    setDueDate("");
    setSubTasks([]);
    setNewSubTask("");
  };

  const addSubTask = () => {
    if (newSubTask.trim()) {
      setSubTasks([...subTasks, newSubTask.trim()]);
      setNewSubTask("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>নতুন টাস্ক তৈরি করুন</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTask.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>টাস্কের নাম</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="টাস্কের নাম লিখুন" required />
          </div>
          <div className="space-y-2">
            <Label>বিস্তারিত বর্ণনা</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="টাস্কের বিবরণ..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>প্রায়োরিটি</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ডেডলাইন</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>অ্যাসাইন করুন</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder="মেম্বার নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {members?.map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profiles?.full_name || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-tasks */}
          <div className="space-y-2">
            <Label>সাব-টাস্ক</Label>
            <div className="flex gap-2">
              <Input value={newSubTask} onChange={(e) => setNewSubTask(e.target.value)} placeholder="সাব-টাস্ক যোগ করুন" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubTask())} />
              <Button type="button" variant="outline" size="icon" onClick={addSubTask}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {subTasks.map((st, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded-lg px-3 py-2">
                <span className="flex-1">{st}</span>
                <button type="button" onClick={() => setSubTasks(subTasks.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? "তৈরি হচ্ছে..." : "টাস্ক তৈরি করুন"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
