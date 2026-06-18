import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HermesAI from "./HermesAI";
import FuguAI from "./FuguAI";
import { Brain, Activity } from "lucide-react";

export default function HermesFuguAI() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
            Legacy AI Engines
          </h1>
          <p className="text-white/40 mt-1">
            HERMES AI & FUGU SCORE historical tracking systems.
          </p>
        </div>
      </div>

      <Tabs defaultValue="hermes" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-black/40 border border-white/10 p-1 rounded-xl">
          <TabsTrigger value="hermes" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary flex items-center gap-2">
            <Brain className="w-4 h-4" />
            HERMES AI
          </TabsTrigger>
          <TabsTrigger value="fugu" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            FUGU SCORE
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
