import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HermesAI from "./HermesAI";
import FuguAI from "./FuguAI";
import { Brain, Activity } from "lucide-react";

export default function HermesFuguAI() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
            Signal Confluence Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quantitative multi-factor verification: HERMES (Swing structure & regime) and FUGU (Pattern & fundamental scoring).
          </p>
        </div>
      </div>

      <Tabs defaultValue="hermes" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/60 border border-border p-1 rounded-xl">
          <TabsTrigger
            value="hermes"
            className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary flex items-center gap-2 font-mono text-xs font-bold"
          >
            <Brain className="w-4 h-4" />
            HERMES Model
          </TabsTrigger>
          <TabsTrigger
            value="fugu"
            className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500 dark:data-[state=active]:text-emerald-400 flex items-center gap-2 font-mono text-xs font-bold"
          >
            <Activity className="w-4 h-4" />
            FUGU Score
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hermes" className="mt-6 border-none p-0 outline-none">
          <HermesAI hideHeader={true} />
        </TabsContent>
        <TabsContent value="fugu" className="mt-6 border-none p-0 outline-none">
          <FuguAI hideHeader={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
