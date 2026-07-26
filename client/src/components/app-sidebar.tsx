import {
  BarChart3, Eye, Scan, Activity, Clock, Triangle, ArrowUpDown,
  Users, BookOpen, Star, Search, Newspaper, MessageSquare, CalendarDays,
  Rocket, TrendingUp, ChevronDown, ChevronRight, Sparkles, Bell, Brain, Zap,
  FlaskConical, Waves,
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

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  testId: string;
  locked?: boolean;
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
      { title: "Scalp Radar ⚡",  url: "/apex",             icon: Zap,        testId: "nav-apex-ai"          },
      { title: "Smart Money",     url: "/insider-strategy", icon: Eye,        testId: "nav-insider-strategy" },
      { title: "Sector Pulse",    url: "/sector-scope",     icon: Scan,       testId: "nav-sector-scope"     },
      { title: "Swing Watch",     url: "/swing-scanner",    icon: TrendingUp, testId: "nav-swing-spectrum"    },
      { title: "Chart Patterns",  url: "/chart-patterns",   icon: Sparkles,   testId: "nav-chart-patterns"   },
    ],
  },
  {
    label: "Macro View",
    icon: Triangle,
    collapsible: true,
    items: [
      { title: "Option Clock",  url: "/option-clock",  icon: Clock,       testId: "nav-option-clock"  },
      { title: "Option Apex",   url: "/option-apex",   icon: Triangle,    testId: "nav-option-apex"   },
      { title: "Index Mover",   url: "/index-mover",   icon: ArrowUpDown, testId: "nav-index-mover"   },
    ],
  },
];

const standaloneItems: MenuItem[] = [
  { title: "Signal Engine 🧠",  url: "/hermes-fugu",           icon: Brain,        testId: "nav-hermes-fugu"      },
  { title: "Flow Tracker",       url: "/fii-dii",               icon: Waves,        testId: "nav-fii-dii"          },
  { title: "Watchlist",          url: "/watchlist",             icon: Star,         testId: "nav-watchlist"        },
  { title: "Stock Lab",          url: "/check-stock",           icon: FlaskConical, testId: "nav-check-stock"      },
  { title: "Filter Pro ✨",      url: "/smart-screener",        icon: Sparkles,     testId: "nav-smart-screener"   },
  { title: "Events Calendar",    url: "/events-calendar",       icon: CalendarDays, testId: "nav-events-calendar"  },
  { title: "IPO Radar",          url: "/ipo-base",              icon: Rocket,       testId: "nav-ipo-base"         },
  { title: "Market News",        url: "/news",                  icon: Newspaper,    testId: "nav-news"             },
  { title: "Ask AI",             url: "/ask-ai",                icon: MessageSquare,testId: "nav-ask-ai"           },
  { title: "Trade Journal",      url: "/trading-journal",       icon: BookOpen,     testId: "nav-trading-journal"  },
  { title: "Community",          url: "/community",             icon: Users,        testId: "nav-community"        },
  { title: "Alerts",             url: "/settings/notifications",icon: Bell,         testId: "nav-notification-settings" },
];

function NavItem({ item, location, indent = false }: { item: MenuItem; location: string; indent?: boolean }) {
  const isActive = location === item.url;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={`
          relative rounded-lg mx-1 transition-all duration-150 overflow-hidden
          ${indent ? "ml-3" : ""}
          ${isActive ? "text-white" : "text-white/40 hover:text-white/70"}
        `}
        style={
          isActive
            ? {
                background: "linear-gradient(90deg, hsl(260 84% 65% / 0.14) 0%, transparent 100%)",
                boxShadow: "inset 2px 0 0 hsl(260 84% 65%)",
              }
            : {}
        }
      >
        <Link href={item.url} data-testid={item.testId}>
          {indent && <span className="w-2.5 h-px bg-white/10 flex-shrink-0" />}
          <item.icon className={`w-4 h-4 relative z-10 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
          <span className="font-medium text-[13px] relative z-10 leading-tight">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function CollapsibleGroup({ group, location }: { group: MenuGroup; location: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasActiveChild = group.items.some(item => location === item.url);

  return (
    <SidebarGroup className="py-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 w-full rounded-lg transition-all duration-150 group
          ${hasActiveChild ? "text-white/60" : "text-white/30 hover:text-white/50"}`}
      >
        <group.icon className={`w-3.5 h-3.5 ${hasActiveChild ? "text-primary/60" : "text-white/20"}`} />
        <span className="text-[10px] uppercase tracking-widest font-bold font-mono flex-1 text-left">
          {group.label}
        </span>
        {isOpen
          ? <ChevronDown className="w-3 h-3 text-white/15 transition-transform" />
          : <ChevronRight className="w-3 h-3 text-white/15 transition-transform" />
        }
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

  return (
    <Sidebar
      className="border-r border-white/5"
      style={{
        background: "hsl(var(--sidebar))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {/* Brand header inside sidebar */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(260 84% 65% / 0.35), hsl(260 84% 65% / 0.15))", border: "1px solid hsl(260 84% 65% / 0.25)" }}
        >
          🐋
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold font-display text-white/85 leading-none tracking-tight">Wealthy Whales</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_1px_hsl(142,71%,50%,0.7)]" />
            <span className="text-[9px] text-white/30 font-mono tracking-wide">NSE · BSE Live</span>
          </div>
        </div>
      </div>

      <SidebarContent className="p-2 pt-2.5 flex flex-col">
        {menuGroups.map(group => (
          <CollapsibleGroup key={group.label} group={group} location={location} />
        ))}

        <div className="mx-3 my-2 h-px bg-white/5" />

        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {standaloneItems.map(item => (
                <NavItem key={item.title} item={item} location={location} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
