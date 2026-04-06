import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createProject = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ name, description: description || null, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast({ title: "প্রজেক্ট তৈরি হয়েছে!" });
      navigate(`/projects/${data.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> নতুন প্রজেক্ট
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>নতুন প্রজেক্ট তৈরি করুন</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createProject.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>প্রজেক্টের নাম</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="প্রজেক্টের নাম" required />
          </div>
          <div className="space-y-2">
            <Label>বিবরণ</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="প্রজেক্টের বিবরণ..." rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
