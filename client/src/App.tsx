import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { StockSearchBar } from "@/components/StockSearchBar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { ViewModeProvider } from "@/hooks/useViewMode";
import ViewModeToggle from "@/components/ViewModeToggle";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import CheckStock from "@/pages/CheckStock";
import SwingScanner from "@/pages/SwingScanner";
import IpoBase from "@/pages/IpoBase";
import News from "@/pages/News";
import AskAI from "@/pages/AskAI";
import Community from "@/pages/Community";
import TechnicalDetail from "@/pages/TechnicalDetail";
import FundamentalDetail from "@/pages/FundamentalDetail";
import AdminPanel from "@/pages/AdminPanel";
import Watchlist from "@/pages/Watchlist";
import EventsCalendar from "@/pages/EventsCalendar";
import TradingJournal from "@/pages/TradingJournal";
import InsiderStrategy from "@/pages/InsiderStrategy";
import SectorScope from "@/pages/SectorScope";
import OptionClock from "@/pages/OptionClock";
import OptionApex from "@/pages/OptionApex";
import IndexMover from "@/pages/IndexMover";
import FiiDii from "@/pages/FiiDii";
import SmartScreener from "@/pages/SmartScreener";
import ResearchReport from "@/pages/ResearchReport";
import ChartPatterns from "@/pages/ChartPatterns";
import NotificationSettings from "@/pages/NotificationSettings";
import HermesAI from "@/pages/HermesAI";
import FuguAI from "@/pages/FuguAI";
import HermesFuguAI from "@/pages/HermesFuguAI";
import AIConfluence from "@/pages/AIConfluence";
import ApexAI from "@/pages/ApexAI";




function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="hover-elevate rounded-full flex"
      data-testid="button-theme-toggle"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Landing page when not authenticated */}
      {!isAuthenticated && !isLoading && (
        <Route path="/" component={Landing} />
      )}
      {/* Home page when authenticated */}
      {isAuthenticated && (
        <Route path="/" component={Home} />
      )}
      {/* Public routes - accessible even when not authenticated */}
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/community" component={Community} />
      <Route path="/swing-scanner" component={SwingScanner} />
      <Route path="/ipo-base" component={IpoBase} />
      <Route path="/check-stock" component={CheckStock} />
      <Route path="/stock/:symbol" component={CheckStock} />
      <Route path="/stock/:symbol/technicals" component={TechnicalDetail} />
      <Route path="/stock/:symbol/fundamentals" component={FundamentalDetail} />
      <Route path="/news" component={News} />
      <Route path="/ask-ai" component={AskAI} />
      <Route path="/events-calendar" component={EventsCalendar} />
      <Route path="/trading-journal" component={TradingJournal} />
      <Route path="/admin" component={AdminPanel} />
      
      {/* 6 New Features */}
      <Route path="/insider-strategy" component={InsiderStrategy} />
      <Route path="/sector-scope" component={SectorScope} />
      <Route path="/option-clock" component={OptionClock} />
      <Route path="/option-apex" component={OptionApex} />
      <Route path="/index-mover" component={IndexMover} />
      <Route path="/fii-dii" component={FiiDii} />
      
      {/* Smart Screener + AI Research Reports */}
      <Route path="/smart-screener" component={SmartScreener} />
      <Route path="/stock/:symbol/report" component={ResearchReport} />
      <Route path="/chart-patterns" component={ChartPatterns} />
      <Route path="/settings/notifications" component={NotificationSettings} />
      <Route path="/hermes" component={HermesAI} />
      <Route path="/fugu" component={FuguAI} />
      <Route path="/hermes-fugu" component={HermesFuguAI} />
      <Route path="/ai-confluence" component={AIConfluence} />
      <Route path="/apex" component={ApexAI} />

      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  const style = {
    "--sidebar-width": "280px",
    "--sidebar-width-icon": "4rem",
  };

  // Show landing page without sidebar for home route when not authenticated
  if (!isAuthenticated && !isLoading && location === "/") {
    return (
      <>
        <Router />
        <Toaster />
      </>
    );
  }

  // Show full app with sidebar for authenticated users or public routes
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground selection:bg-primary/30">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
          <MarqueeTicker />
          <header
            className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 sticky top-0 z-50 min-w-0"
            style={{
              background: "hsl(var(--background) / 0.90)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="lg:hidden" />
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-base font-bold font-display text-foreground/80 leading-none tracking-tight">Wealthy Whales</span>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_1px_rgba(34,197,94,0.6)]" />
                  <span className="text-[9px] text-emerald-400 font-mono tracking-wide leading-none">Live</span>
                </div>
              </div>
            </div>
            <div className="flex-1 max-w-xl mx-1.5 sm:mx-3 min-w-0">
              <StockSearchBar />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ViewModeToggle />
              <ThemeToggle />
              {isAuthenticated ? (
                <>
                  {/* Desktop: text button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = "/api/logout"}
                    data-testid="button-logout"
                    className="hidden sm:flex h-8 px-3 text-xs text-foreground/40 hover:text-foreground/70"
                  >
                    Sign out
                  </Button>
                  {/* Mobile: icon button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.location.href = "/api/logout"}
                    className="flex sm:hidden h-8 w-8 text-foreground/40"
                    title="Sign out"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = "/api/auth/google"}
                    data-testid="button-login"
                    className="hidden sm:flex h-8 px-3 text-xs text-foreground/40 hover:text-foreground/70"
                  >
                    Sign in
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.location.href = "/api/auth/google"}
                    className="flex sm:hidden h-8 w-8 text-primary/70"
                    title="Sign in"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  </Button>
                </>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent p-4 sm:p-6 min-w-0">
            <div className="max-w-7xl mx-auto w-full">
              <Router />
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ViewModeProvider>
            <AppContent />
          </ViewModeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
