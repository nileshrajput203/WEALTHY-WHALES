import { Users, TrendingUp, Rocket, Search, Newspaper, MessageSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

const menuItems = [
  { title: "Community Group",   url: "/community",     icon: Users,         testId: "nav-community" },
  { title: "Swing Scanner",     url: "/swing-scanner", icon: TrendingUp,    testId: "nav-swing-scanner" },
  { title: "IPO Base",          url: "/ipo-base",      icon: Rocket,        testId: "nav-ipo-base" },
  { title: "Check Your Stock",  url: "/check-stock",   icon: Search,        testId: "nav-check-stock" },
  { title: "News",              url: "/news",           icon: Newspaper,     testId: "nav-news" },
  { title: "Ask AI",            url: "/ask-ai",         icon: MessageSquare, testId: "nav-ask-ai" },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar
      className="border-r border-white/5"
      style={{
        background: "hsl(var(--sidebar))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      <SidebarContent className="p-2 pt-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-white/25 px-3 mb-3 font-mono">
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`
                        relative rounded-xl mx-1 transition-all duration-200 overflow-hidden
                        ${isActive
                          ? "text-white"
                          : "text-white/45 hover:text-white/80"
                        }
                      `}
                      style={
                        isActive
                          ? {
                              background:
                                "linear-gradient(90deg, hsl(260 84% 65% / 0.18) 0%, transparent 100%)",
                              boxShadow: "inset 2px 0 0 hsl(260 84% 65%)",
                            }
                          : {}
                      }
                    >
                      <Link href={item.url} data-testid={item.testId}>
                        {/* Active icon glow */}
                        {isActive && (
                          <span
                            className="absolute left-2 w-6 h-6 rounded-md flex items-center justify-center"
                            style={{
                              background: "hsl(260 84% 65% / 0.15)",
                              boxShadow: "0 0 8px 0 hsl(260 84% 65% / 0.3)",
                            }}
                          />
                        )}
                        <item.icon
                          className={`w-4 h-4 relative z-10 ${isActive ? "text-primary" : ""}`}
                        />
                        <span className="font-medium text-sm relative z-10">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Wealthy Whale card */}
        <div className="mt-auto p-3 pb-4">
          <div
            className="relative rounded-2xl p-4 overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Premium gradient border top */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, hsl(260 84% 65% / 0.5), hsl(142 71% 50% / 0.3), transparent)",
              }}
            />
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                style={{
                  background: "linear-gradient(135deg, hsl(260 84% 65% / 0.3), hsl(142 71% 50% / 0.2))",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                🐋
              </div>
              <span className="text-xs font-semibold text-white/70">Made by Wealthy Whale</span>
            </div>
            <p className="text-[10px] text-white/30 leading-relaxed font-mono">
              Professional stock analysis platform for Indian markets.
            </p>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
