import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function Chat() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team Chat</h1>
        <p className="text-muted-foreground text-sm mt-1">টিম মেম্বারদের সাথে রিয়েল-টাইম আলোচনা করুন।</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">চ্যাট শীঘ্রই আসছে</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            রিয়েল-টাইম মেসেজিং, @mention ফিচার এবং টাস্ক-ভিত্তিক আলোচনা সহ পূর্ণাঙ্গ চ্যাট সিস্টেম শীঘ্রই যুক্ত করা হবে।
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
