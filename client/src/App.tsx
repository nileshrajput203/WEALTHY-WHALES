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
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import CheckStock from "@/pages/CheckStock";
import SwingScanner from "@/pages/SwingScanner";
import IpoBase from "@/pages/IpoBase";
import News from "@/pages/News";
import AskAI from "@/pages/AskAI";
import Community from "@/pages/Community";

function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsDark(!isDark)}
      className="hover-elevate"
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
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
      <Route path="/community" component={Community} />
      <Route path="/swing-scanner" component={SwingScanner} />
      <Route path="/ipo-base" component={IpoBase} />
      <Route path="/check-stock" component={CheckStock} />
      <Route path="/stock/:symbol" component={CheckStock} />
      <Route path="/news" component={News} />
      <Route path="/ask-ai" component={AskAI} />
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
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <MarqueeTicker />
          <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-background sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h2 className="text-xl font-bold text-primary">StockIQ</h2>
            </div>
            <div className="flex-1 max-w-2xl mx-4">
              <StockSearchBar />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  onClick={() => window.location.href = "/api/logout"}
                  data-testid="button-logout"
                >
                  Logout
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => window.location.href = "/api/login"}
                  data-testid="button-login"
                >
                  Login
                </Button>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <div className="max-w-7xl mx-auto">
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
