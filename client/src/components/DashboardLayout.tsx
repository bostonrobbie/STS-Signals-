import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TradeNotificationBanner } from "@/components/TradeNotificationBanner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Shield,
  Home,
  MessageSquare,
  CreditCard,
  Moon,
  Sun,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";

const baseMenuItems = [
  {
    icon: Home,
    label: "Home",
    path: "/",
    adminOnly: false,
  },
  {
    icon: LayoutDashboard,
    label: "Overview",
    path: "/overview",
    adminOnly: false,
  },
  {
    icon: CreditCard,
    label: "Billing",
    path: "/billing",
    adminOnly: false,
  },
  { icon: Shield, label: "Admin Dashboard", path: "/admin", adminOnly: true },
  {
    icon: MessageSquare,
    label: "Admin Messages",
    path: "/admin/messages",
    adminOnly: true,
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  const pathname = window.location.pathname;
  const isHomepage = pathname === "/";
  const isPricingPage = pathname === "/pricing" || pathname === "/billing";
  const isCheckoutPage = pathname.startsWith("/checkout");
  const isLegalPage = [
    "/terms",
    "/privacy",
    "/refund-policy",
    "/disclaimer",
    "/risk-disclosure",
  ].includes(pathname);

  // Allow unauthenticated users to see the landing page and legal pages
  // but redirect to checkout for other pages
  if (!user) {
    if (!isHomepage && !isLegalPage) {
      window.location.href = "/checkout";
      return <DashboardLayoutSkeleton />;
    }
  }

  // Redirect free users to pricing page (except for pricing/checkout/legal pages)
  if (
    user &&
    user.subscriptionTier === "free" &&
    !isHomepage &&
    !isPricingPage &&
    !isCheckoutPage &&
    !isLegalPage
  ) {
    window.location.href = "/pricing";
    return <DashboardLayoutSkeleton />;
  }

  // Render homepage and legal pages without sidebar for ALL users
  if (isHomepage || isLegalPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

// Theme toggle button component
function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();

  // Filter menu items based on user role and owner status
  // Only show admin pages to the owner account (OWNER_OPEN_ID from env)
  const ownerOpenId =
    import.meta.env.VITE_OWNER_OPEN_ID || import.meta.env.OWNER_OPEN_ID;
  // @ts-expect-error TS2339
  const isOwner = user?.openId === ownerOpenId;
  const isAdmin = user?.role === "admin" && isOwner;
  const visibleMenuItems = baseMenuItems.filter(
    item => !item.adminOnly || isAdmin
  );

  // Selection is now click-only (no hover expansion) for better UX
  const activeMenuItem = visibleMenuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 transition-[width] duration-300 ease-in-out"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <img
                      src="/logo.png"
                      alt="STS Futures"
                      className="h-6 w-6 shrink-0"
                    />
                    <span className="font-semibold tracking-tight truncate">
                      STS Futures
                    </span>
                  </div>
                  {isAdmin && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded">
                      Admin
                    </span>
                  )}
                </div>
              ) : (
                <img
                  src="/logo.png"
                  alt="STS"
                  className="h-6 w-6 shrink-0 ml-1"
                />
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        if ((item as any).external) {
                          window.location.href = item.path;
                        } else {
                          setLocation(item.path);
                        }
                      }}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-9 w-9 border shrink-0">
                      <AvatarFallback className="text-xs font-medium">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1.5">
                        {user?.email || "-"}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => {
                  window.location.href = getLoginUrl(location);
                }}
                className="w-full"
                variant="outline"
              >
                Sign in
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-12 sm:h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex flex-col gap-0.5 sm:gap-1">
                  <span className="tracking-tight text-foreground text-sm sm:text-base font-medium">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggleButton />
              <TradeNotificationBanner />
            </div>
          </div>
        )}
        {/* Desktop header with notification bell */}
        {!isMobile && (
          <div className="flex h-14 items-center justify-end px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <ThemeToggleButton />
              <TradeNotificationBanner />
            </div>
          </div>
        )}
        <main className="flex-1 p-2 sm:p-4 md:p-6 animate-fade-in overflow-x-hidden">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </SidebarInset>
    </>
  );
}
