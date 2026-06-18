import { useViewMode } from "@/hooks/useViewMode";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 bg-muted border border-border rounded-full p-0.5 shadow-inner">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("pro")}
            className={cn(
              "h-7 px-3 rounded-full text-[11px] font-bold gap-1 transition-all duration-300",
              viewMode === "pro"
                ? "bg-gradient-to-r from-primary to-violet-600 text-white shadow-md shadow-primary/20 scale-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className={cn("h-3 w-3", viewMode === "pro" && "animate-pulse")} />
            <span>PRO</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("simple")}
            className={cn(
              "h-7 px-3 rounded-full text-[11px] font-bold gap-1 transition-all duration-300",
              viewMode === "simple"
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 scale-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="h-3 w-3" />
            <span>SIMPLE</span>
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent className="bg-popover border border-border text-popover-foreground">
        <p className="text-xs font-medium">
          {viewMode === "pro"
            ? "Showing advanced analytical details, radial breakdowns, and detailed charts."
            : "Showing simplified traffic-light verdicts, summary tags, and key takeaways."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
