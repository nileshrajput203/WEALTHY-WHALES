import { Users, TrendingUp, Rocket, Search, Newspaper, MessageSquare, BarChart3 } from "lucide-react";
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
  {
    title: "Community Group",
    url: "/community",
    icon: Users,
    testId: "nav-community",
  },
  {
    title: "Swing Scanner",
    url: "/swing-scanner",
    icon: TrendingUp,
    testId: "nav-swing-scanner",
  },
  {
    title: "IPO Base",
    url: "/ipo-base",
    icon: Rocket,
    testId: "nav-ipo-base",
  },
  {
    title: "Check Your Stock",
    url: "/check-stock",
    icon: Search,
    testId: "nav-check-stock",
  },
  {
    title: "News",
    url: "/news",
    icon: Newspaper,
    testId: "nav-news",
  },
  {
    title: "Ask AI",
    url: "/ask-ai",
    icon: MessageSquare,
    testId: "nav-ask-ai",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={isActive ? "bg-sidebar-accent" : ""}>
                      <Link href={item.url} data-testid={item.testId}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
