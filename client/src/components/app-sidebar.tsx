import {
  BarChart3, Eye, Scan, Activity, Clock, Triangle, ArrowUpDown,
  Users, BookOpen, Star, Newspaper, MessageSquare, CalendarDays,
  Rocket, TrendingUp, ChevronDown, ChevronRight, Sparkles, Bell, Brain, Zap,
  FlaskConical, Waves, Compass, Calendar, Sliders, GraduationCap, ShieldCheck, Layers,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  testId: string;
  tag?: string;
}

interface MenuGroup {
  label: string;
  icon: any;
  collapsible?: boolean;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Trade Desk",
    icon: BarChart3,
    collapsible: true,
    items: [
      { title: "Order Block Radar", url: "/order-block",     icon: Layers,     testId: "nav-order-block",      tag: "SMC" },
      { title: "Scalp Radar",      url: "/apex",             icon: Zap,        testId: "nav-apex-ai",          tag: "HOT" },
      { title: "Option Apex F&O",  url: "/option-apex",      icon: Triangle,   testId: "nav-option-apex",      tag: "NEW" },
      { title: "Strategy Builder", url: "/strategy-builder", icon: Sliders,    testId: "nav-strategy-builder", tag: "PRO" },
      { title: "Smart Money Flow", url: "/insider-strategy", icon: Eye,        testId: "nav-insider-strategy" },
      { title: "Sector Pulse",     url: "/sector-scope",     icon: Scan,       testId: "nav-sector-scope"     },
      { title: "Swing Scanner",    url: "/swing-scanner",    icon: TrendingUp, testId: "nav-swing-spectrum"    },
      { title: "Chart Patterns",   url: "/chart-patterns",   icon: Activity,   testId: "nav-chart-patterns"   },
    ],
  },
  {
    label: "Macro & Derivatives",
    icon: Compass,
    collapsible: true,
    items: [
      { title: "Seasonality Pulse",url: "/seasonality",  icon: Calendar,    testId: "nav-seasonality",   tag: "HOT" },
      { title: "Option Clock",     url: "/option-clock", icon: Clock,       testId: "nav-option-clock"  },
      { title: "Index Movers",     url: "/index-mover",  icon: ArrowUpDown, testId: "nav-index-mover"   },
      { title: "FII / DII Flow",   url: "/fii-dii",      icon: Waves,       testId: "nav-fii-dii"       },
    ],
  },
];

const coreToolItems: MenuItem[] = [
  { title: "Signal Confluence",   url: "/ai-confluence",         icon: Brain,        testId: "nav-ai-confluence", tag: "PRO" },
  { title: "Video Academy",       url: "/academy",               icon: GraduationCap,testId: "nav-academy",       tag: "LMS" },
  { title: "Stock Analysis",      url: "/check-stock",           icon: FlaskConical, testId: "nav-check-stock"      },
  { title: "Smart Screener",      url: "/smart-screener",        icon: Sparkles,     testId: "nav-smart-screener"   },
  { title: "Watchlist",           url: "/watchlist",             icon: Star,         testId: "nav-watchlist"        },
  { title: "Events Calendar",     url: "/events-calendar",       icon: CalendarDays, testId: "nav-events-calendar"  },
  { title: "IPO Radar",           url: "/ipo-base",              icon: Rocket,       testId: "nav-ipo-base"         },
  { title: "Market News",         url: "/news",                  icon: Newspaper,    testId: "nav-news"             },
  { title: "Market Copilot",      url: "/ask-ai",                icon: MessageSquare,testId: "nav-ask-ai"           },
  { title: "Trading Journal",     url: "/trading-journal",       icon: BookOpen,     testId: "nav-trading-journal"  },
  { title: "Community Desk",      url: "/community",             icon: Users,        testId: "nav-community"        },
  { title: "Alerts & Config",     url: "/settings/notifications",icon: Bell,         testId: "nav-notification-settings" },
];

function NavItem({ item, location, indent = false }: { item: MenuItem; location: string; indent?: boolean }) {
  const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={`
          relative rounded-lg mx-1 transition-all duration-150 overflow-hidden
          ${indent ? "ml-3" : ""}
          ${
            isActive
              ? "text-primary font-semibold bg-primary/10 shadow-xs border border-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }
        `}
      >
        <Link href={item.url} data-testid={item.testId} className="flex items-center gap-2.5 py-1.5 px-2.5 w-full">
          {indent && <span className="w-1.5 h-px bg-border flex-shrink-0" />}
          <item.icon
            className={`w-4 h-4 relative z-10 flex-shrink-0 transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            }`}
          />
          <span className="text-[13px] relative z-10 leading-tight font-medium flex-1 truncate">
            {item.title}
          </span>
          {item.tag && (
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                item.tag === "HOT"
                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                  : "bg-primary/15 text-primary border border-primary/25"
              }`}
            >
              {item.tag}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function CollapsibleGroup({ group, location }: { group: MenuGroup; location: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasActiveChild = group.items.some(
    item => location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"))
  );

  return (
    <SidebarGroup className="py-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 w-full rounded-lg transition-all duration-150 group
          ${hasActiveChild ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
      >
        <group.icon className={`w-3.5 h-3.5 ${hasActiveChild ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[11px] uppercase tracking-wider font-bold font-mono flex-1 text-left">
          {group.label}
        </span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground/60 transition-transform" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground/60 transition-transform" />
        )}
      </button>

      {isOpen && (
        <SidebarGroupContent>
          <SidebarMenu className="space-y-0.5 mt-0.5 mb-1">
            {group.items.map(item => (
              <NavItem key={item.title} item={item} location={location} indent />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <Sidebar
      className="border-r border-border/60"
      style={{
        background: "hsl(var(--sidebar))",
      }}
    >
      {/* Brand header inside sidebar */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border/50">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold font-display text-sm flex-shrink-0 bg-primary/15 text-primary border border-primary/25 shadow-xs"
        >
          WW
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] font-bold font-display text-foreground leading-none tracking-tight">
            Wealthy Whales
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-mono tracking-wide">
              NSE · BSE Terminal
            </span>
          </div>
        </div>
      </div>

      <SidebarContent className="p-2 pt-2 flex flex-col no-scrollbar">
        {user?.isAdmin && (
          <>
            <div className="px-3 py-1">
              <span className="text-[10px] uppercase tracking-wider font-bold font-mono text-amber-500/90">
                Administration
              </span>
            </div>
            <SidebarGroup className="py-0 mb-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem
                    item={{
                      title: "Admin Console",
                      url: "/admin",
                      icon: ShieldCheck,
                      testId: "nav-admin-console",
                      tag: "ROOT",
                    }}
                    location={location}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <div className="mx-3 my-1.5 h-px bg-border/40" />
          </>
        )}

        {menuGroups.map(group => (
          <CollapsibleGroup key={group.label} group={group} location={location} />
        ))}

        <div className="mx-3 my-2 h-px bg-border/40" />

        <div className="px-3 py-1">
          <span className="text-[10px] uppercase tracking-wider font-bold font-mono text-muted-foreground/70">
            Analytics & Tools
          </span>
        </div>

        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {coreToolItems.map(item => (
                <NavItem key={item.title} item={item} location={location} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
