import {
  BarChart3, Eye, Scan, Activity, Clock, Triangle, ArrowUpDown,
  Users, BookOpen, Star, Search, Newspaper, MessageSquare, CalendarDays,
  Rocket, TrendingUp, ChevronDown, ChevronRight, Sparkles,
} from "lucide-react";
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
import { useState } from "react";

/* ═══ Menu structure ═══ */
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
    label: "Stocks",
    icon: BarChart3,
    collapsible: true,
    items: [
      { title: "Market Pulse",      url: "/",                  icon: Activity,   testId: "nav-market-pulse"     },
      { title: "Insider Strategy",   url: "/insider-strategy",  icon: Eye,        testId: "nav-insider-strategy" },
      { title: "Sector Scope",      url: "/sector-scope",      icon: Scan,       testId: "nav-sector-scope"     },
      { title: "Swing Spectrum",    url: "/swing-scanner",     icon: TrendingUp, testId: "nav-swing-spectrum"    },
    ],
  },
  {
    label: "Index",
    icon: Triangle,
    collapsible: true,
    items: [
      { title: "Option Clock",  url: "/option-clock",  icon: Clock,        testId: "nav-option-clock"  },
      { title: "Option Apex",   url: "/option-apex",   icon: Triangle,     testId: "nav-option-apex"   },
      { title: "Index Mover",   url: "/index-mover",   icon: ArrowUpDown,  testId: "nav-index-mover"   },
    ],
  },
];

const standaloneItems: MenuItem[] = [
  { title: "FII / DII",        url: "/fii-dii",          icon: Users,        testId: "nav-fii-dii"          },
  { title: "Watchlist",         url: "/watchlist",        icon: Star,         testId: "nav-watchlist",       locked: false },
  { title: "Check Your Stock",  url: "/check-stock",      icon: Search,       testId: "nav-check-stock",     locked: false },
  { title: "Smart Screener ✨", url: "/smart-screener",     icon: Sparkles,     testId: "nav-smart-screener",   locked: false },
  { title: "Events Calendar",   url: "/events-calendar",  icon: CalendarDays, testId: "nav-events-calendar", locked: false },
  { title: "IPO Base",          url: "/ipo-base",         icon: Rocket,       testId: "nav-ipo-base",        locked: false },
  { title: "News",              url: "/news",             icon: Newspaper,    testId: "nav-news",            locked: false },
  { title: "Ask AI",            url: "/ask-ai",           icon: MessageSquare,testId: "nav-ask-ai",          locked: false },
  { title: "Trading Journal",   url: "/trading-journal",  icon: BookOpen,     testId: "nav-trading-journal", locked: false },
  { title: "Community",          url: "/community",        icon: Users,        testId: "nav-community",       locked: false },
];

/* ═══ NavItem renderer ═══ */
function NavItem({ item, location, indent = false }: { item: MenuItem; location: string; indent?: boolean }) {
  const isActive = location === item.url;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={`
          relative rounded-xl mx-1 transition-all duration-200 overflow-hidden
          ${indent ? "ml-4" : ""}
          ${isActive ? "text-white" : "text-white/45 hover:text-white/80"}
        `}
        style={
          isActive
            ? {
                background: "linear-gradient(90deg, hsl(260 84% 65% / 0.18) 0%, transparent 100%)",
                boxShadow: "inset 2px 0 0 hsl(260 84% 65%)",
              }
            : {}
        }
      >
        <Link href={item.url} data-testid={item.testId}>
          {isActive && (
            <span
              className="absolute left-2 w-6 h-6 rounded-md flex items-center justify-center"
              style={{
                background: "hsl(260 84% 65% / 0.15)",
                boxShadow: "0 0 8px 0 hsl(260 84% 65% / 0.3)",
              }}
            />
          )}
          {indent && <span className="w-3 h-px bg-white/10 mr-1 flex-shrink-0" />}
          <item.icon className={`w-4 h-4 relative z-10 ${isActive ? "text-primary" : ""}`} />
          <span className="font-medium text-sm relative z-10">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/* ═══ Collapsible Group ═══ */
function CollapsibleGroup({ group, location }: { group: MenuGroup; location: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasActiveChild = group.items.some(item => location === item.url);

  return (
    <SidebarGroup className="py-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 w-full rounded-lg transition-all duration-200 group
          ${hasActiveChild ? "text-white/70" : "text-white/35 hover:text-white/55"}`}
      >
        <group.icon className={`w-4 h-4 ${hasActiveChild ? "text-primary/70" : "text-white/25"}`} />
        <span className="text-[11px] uppercase tracking-widest font-bold font-mono flex-1 text-left">
          {group.label}
        </span>
        {isOpen
          ? <ChevronDown className="w-3 h-3 text-white/20 transition-transform" />
          : <ChevronRight className="w-3 h-3 text-white/20 transition-transform" />
        }
      </button>

      {isOpen && (
        <SidebarGroupContent>
          <SidebarMenu className="space-y-0.5 mt-0.5">
            {group.items.map(item => (
              <NavItem key={item.title} item={item} location={location} indent />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

/* ═══ Sidebar ═══ */
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
      <SidebarContent className="p-2 pt-3 flex flex-col">
        {/* ── Collapsible category groups ── */}
        {menuGroups.map(group => (
          <CollapsibleGroup key={group.label} group={group} location={location} />
        ))}

        {/* ── Divider ── */}
        <div className="mx-3 my-1.5 h-px bg-white/5" />

        {/* ── Standalone items ── */}
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {standaloneItems.map(item => (
                <NavItem key={item.title} item={item} location={location} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Wealthy Whale card ── */}
        <div className="mt-auto p-3 pb-4">
          <div
            className="relative rounded-2xl p-4 overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
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
