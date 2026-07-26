import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Share2, Sparkles, TrendingUp, AlertTriangle, CheckCircle, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIResearchReportProps {
  symbol: string;
  companyName: string;
  reportText: string;
  isStreaming?: boolean;
}

export default function AIResearchReport({ symbol, companyName, reportText, isStreaming = false }: AIResearchReportProps) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Helper: Parse SWOT from markdown text into an object
  const parseSWOT = (text: string) => {
    const swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
    };

    let currentKey: keyof typeof swot | null = null;
    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().includes("strength")) {
        currentKey = "strengths";
        continue;
      } else if (trimmed.toLowerCase().includes("weakness")) {
        currentKey = "weaknesses";
        continue;
      } else if (trimmed.toLowerCase().includes("opportunit")) {
        currentKey = "opportunities";
        continue;
      } else if (trimmed.toLowerCase().includes("threat")) {
        currentKey = "threats";
        continue;
      }

      if (currentKey && trimmed.startsWith("-")) {
        swot[currentKey].push(trimmed.substring(1).trim());
      }
    }

    return swot;
  };

  // Helper: Split report by ## headings
  const parseReportSections = (text: string) => {
    const sections: { title: string; content: string; key: string }[] = [];
    const rawSections = text.split(/(?=## )/g);

    for (const sec of rawSections) {
      if (!sec.trim()) continue;
      const match = sec.match(/^## (.*)/m);
      const title = match ? match[1].trim() : "Details";
      const content = sec.replace(/^## (.*)/m, "").trim();
      const key = title.toLowerCase().replace(/[^a-z0-9]/g, "");
      sections.push({ title, content, key });
    }

    return sections;
  };

  const sections = parseReportSections(reportText);

  const handleShare = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied!",
      description: "Shareable report link copied to clipboard.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Custom table component for markdown tables
  const MarkdownTable = ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-white/5 bg-white/5 shadow-inner">
      <Table className="w-full text-xs sm:text-sm" {...props}>{children}</Table>
    </div>
  );

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Header card with share & print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/5 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">AI Research Analyst Report</h4>
            <p className="text-[11px] text-white/40">Powered by Gemini 2.5 Flash • Live Financial Data Feed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} className="h-8 text-xs font-semibold gap-1.5 cursor-pointer">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs font-semibold gap-1.5 cursor-pointer">
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {isStreaming && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs font-medium text-primary animate-pulse">
          <Sparkles className="h-4 w-4 animate-spin" />
          <span>Analyst is writing the report live...</span>
        </div>
      )}

      {/* Accordion list of sections */}
      <Accordion type="multiple" defaultValue={sections.map(s => s.key)} className="space-y-4">
        {sections.map((section) => {
          const isSwot = section.key.includes("swot");
          return (
            <AccordionItem
              key={section.key}
              value={section.key}
              className="border border-white/5 bg-black/30 rounded-xl overflow-hidden px-4 py-1"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <span className="text-base font-bold font-display text-white tracking-wide">
                  {section.title}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 text-white/80 leading-relaxed text-sm sm:text-base border-t border-white/5">
                {isSwot ? (
                  /* Render SWOT grid */
                  (() => {
                    const swot = parseSWOT(section.content);
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {/* Strengths */}
                        <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 backdrop-blur-sm">
                          <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                            <CheckCircle className="h-4 w-4" />
                            Strengths
                          </h5>
                          <ul className="space-y-2 list-none p-0 m-0">
                            {swot.strengths.map((item, idx) => (
                              <li key={idx} className="text-xs text-white/90 leading-relaxed flex items-start gap-2">
                                <span className="text-emerald-400 mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Weaknesses */}
                        <div className="p-4 rounded-xl border border-rose-500/10 bg-rose-500/5 backdrop-blur-sm">
                          <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 mb-3">
                            <AlertTriangle className="h-4 w-4" />
                            Weaknesses
                          </h5>
                          <ul className="space-y-2 list-none p-0 m-0">
                            {swot.weaknesses.map((item, idx) => (
                              <li key={idx} className="text-xs text-white/90 leading-relaxed flex items-start gap-2">
                                <span className="text-rose-400 mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Opportunities */}
                        <div className="p-4 rounded-xl border border-blue-500/10 bg-blue-500/5 backdrop-blur-sm">
                          <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">
                            <TrendingUp className="h-4 w-4" />
                            Opportunities
                          </h5>
                          <ul className="space-y-2 list-none p-0 m-0">
                            {swot.opportunities.map((item, idx) => (
                              <li key={idx} className="text-xs text-white/90 leading-relaxed flex items-start gap-2">
                                <span className="text-blue-400 mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Threats */}
                        <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 backdrop-blur-sm">
                          <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                            <AlertTriangle className="h-4 w-4" />
                            Threats
                          </h5>
                          <ul className="space-y-2 list-none p-0 m-0">
                            {swot.threats.map((item, idx) => (
                              <li key={idx} className="text-xs text-white/90 leading-relaxed flex items-start gap-2">
                                <span className="text-amber-400 mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* Standard Markdown rendering */
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: MarkdownTable,
                      thead: ({ children }) => <TableHeader className="bg-white/5 border-b border-white/10">{children}</TableHeader>,
                      tbody: ({ children }) => <TableBody>{children}</TableBody>,
                      tr: ({ children }) => <TableRow className="border-b border-white/5 hover:bg-white/5">{children}</TableRow>,
                      th: ({ children }) => <TableHead className="font-bold text-white/80 py-3.5 px-4">{children}</TableHead>,
                      td: ({ children }) => <TableCell className="py-3 px-4 font-medium text-white/90">{children}</TableCell>,
                      ul: ({ children }) => <ul className="list-disc pl-5 my-3 space-y-1.5 text-xs sm:text-sm text-white/70">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 my-3 space-y-1.5 text-xs sm:text-sm text-white/70">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      h3: ({ children }) => <h5 className="text-sm font-bold text-white mt-4 mb-2">{children}</h5>,
                      p: ({ children }) => <p className="text-xs sm:text-sm text-white/70 leading-relaxed my-2.5">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
