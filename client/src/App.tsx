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
      className="hover-elevate rounded-full hidden sm:flex"
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
        {/* Glow effect backgrounds */}
        <div className="absolute inset-0 z-[-1] overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
        </div>
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
          <MarqueeTicker />
          <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 sticky top-0 z-50 min-w-0"
            style={{
              background: "hsl(var(--background) / 0.85)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 1px 0 0 rgba(255,255,255,0.04), 0 4px 24px 0 rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="lg:hidden" />
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 bg-gradient-to-br from-primary to-violet-600 rounded-lg flex items-center justify-center shadow-[0_0_12px_0_hsl(260,84%,65%,0.4)]">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <div className="hidden sm:flex flex-col">
                  <h2 className="text-base font-bold font-display bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent leading-none">
                    GenAI-Stock
                  </h2>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_1px_hsl(142,71%,50%,0.8)]" />
                    <span className="text-[10px] text-white/35 font-mono">Live</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 max-w-2xl mx-2 sm:mx-4 min-w-0">
              <StockSearchBar />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ViewModeToggle />
              <ThemeToggle />
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = "/api/logout"}
                  data-testid="button-logout"
                  className="hidden sm:flex"
                >
                  Logout
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = "/api/auth/google"}
                  data-testid="button-login"
                  className="hidden sm:flex"
                >
                  Login with Google
                </Button>
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
