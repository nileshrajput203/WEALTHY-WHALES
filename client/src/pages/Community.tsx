import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Community() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          Community Group
        </h1>
        <p className="text-muted-foreground">Connect with fellow traders and investors</p>
      </div>

      <Card>
        <CardContent className="pt-16 pb-16 text-center">
          <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Community Features Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Join discussions, share insights, and learn from experienced traders
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
