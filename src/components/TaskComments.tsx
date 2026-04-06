import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  mentions: string[];
  created_at: string;
  profile?: { full_name: string | null };
}

export function TaskComments({ taskId, projectId }: TaskCommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
      return data.map((c: any) => ({
        ...c,
        profile: profileMap.get(c.user_id),
      })) as Comment[];
    },
  });

  // Fetch project members for @mention
  const { data: members = [] } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);
      if (error) throw error;

      const userIds = data.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      return profiles || [];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  // Post comment
  const postComment = useMutation({
    mutationFn: async () => {
      // Extract @mentions
      const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s|$)/g;
      const mentionNames = [...input.matchAll(mentionRegex)].map((m) => m[1].trim());
      const mentionIds = members
        .filter((m: any) => mentionNames.some((name) => m.full_name?.toLowerCase().includes(name.toLowerCase())))
        .map((m: any) => m.id);

      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        user_id: user!.id,
        content: input.trim(),
        mentions: mentionIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);

    // Check if user is typing @mention
    const textBeforeCursor = value.substring(0, pos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionSearch(atMatch[1]);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (memberName: string) => {
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const newText = textBeforeCursor.substring(0, atIndex) + `@${memberName} ` + textAfterCursor;
    setInput(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMembers = members.filter((m: any) =>
    !mentionSearch || m.full_name?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) postComment.mutate();
    }
  };

  // Render content with highlighted mentions
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">কোনো কমেন্ট নেই। প্রথম কমেন্ট করুন!</p>
        ) : (
          comments.map((comment) => {
            const isMe = comment.user_id === user?.id;
            return (
              <div key={comment.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {comment.profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${isMe ? "items-end" : ""}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {comment.profile?.full_name || "User"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className={`text-sm px-3 py-2 rounded-xl ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {renderContent(comment.content)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="relative border-t border-border p-3">
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
            {filteredMembers.map((m: any) => (
              <button
                key={m.id}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                onClick={() => insertMention(m.full_name || "User")}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                    {m.full_name?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground">{m.full_name || "User"}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="কমেন্ট লিখুন... (@mention করতে @ টাইপ করুন)"
            className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            onClick={() => input.trim() && postComment.mutate()}
            disabled={!input.trim() || postComment.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
