"use client";

import React, { useState, useEffect } from "react";
import { Layout, Menu, theme, ConfigProvider, Dropdown, Avatar, Button, Drawer } from "antd";
import {
  ClockCircleOutlined,
  DashboardOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  BarChartOutlined,
  MenuOutlined,
  CaretDownOutlined,
  PieChartOutlined,
} from "@ant-design/icons";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { canAccessAnalytics, canAccessDashboard, canAccessPersonalDashboard, canAccessReports, canAccessTeam, canAccessTimesheet, getFirstName, getNameInitials, getProfileDisplayTitle, getTokenRole, isAuthenticated, logoutAndRedirectToLogin, UserRole } from "@/lib/auth";
import { isAdminPortalHost } from "@/lib/host";
import { apiFetch } from "@/lib/api";

import { Grid } from "antd";
const { useBreakpoint } = Grid;

const { Header, Content, Footer, Sider } = Layout;

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [avatarInitials, setAvatarInitials] = useState("U");
  const [firstName, setFirstName] = useState("User");
  const [jobTitle, setJobTitle] = useState("");
  const [alsoManager, setAlsoManager] = useState(false);
  const [isAdminDomain, setIsAdminDomain] = useState(false);
  const router = useRouter();
  const rawPathname = usePathname();
  // trailingSlash: true (static export) means usePathname() always returns e.g. "/login/",
  // so normalize before comparing against route strings like "/login".
  const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, "") : rawPathname;
  const screens = useBreakpoint();
  const isMobile = screens.md === false;

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    setMounted(true);
    setRole(getTokenRole());
    setIsAdminDomain(isAdminPortalHost());
  }, [pathname]);

  useEffect(() => {
    if (!mounted || pathname === "/login") return;

    // Initial check
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    // Active monitoring
    const interval = setInterval(() => {
      if (!isAuthenticated()) {
        clearInterval(interval);
        logoutAndRedirectToLogin();
      }
    }, 2000); // Check every 2 seconds for snappier redirect during testing

    return () => clearInterval(interval);
  }, [mounted, pathname, router]);

  useEffect(() => {
    if (pathname === "/login") return;

    const loadProfileInitials = async () => {
      try {
        const data = await apiFetch<{ profile: { name: string; jobTitle: string; alsoManager?: boolean } }>("/api/profile/me");
        setAvatarInitials(getNameInitials(data.profile.name));
        setFirstName(getFirstName(data.profile.name));
        setJobTitle(data.profile.jobTitle);
        setAlsoManager(Boolean(data.profile.alsoManager));
      } catch {
        setAvatarInitials("U");
        setFirstName("User");
        setJobTitle("");
        setAlsoManager(false);
      }
    };

    void loadProfileInitials();
  }, [pathname]);

  const isLoginPage = pathname === "/login";

  if (!mounted) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated()) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  const menuItems = [
    ...(canAccessTimesheet(role)
      ? [{
        key: "/timesheet",
        icon: <ClockCircleOutlined />,
        label: <Link href="/timesheet" onClick={() => setMobileMenuOpen(false)}>Timesheet</Link>,
      }]
      : []),
    ...(canAccessPersonalDashboard(role)
      ? [{
        key: "/my-dashboard",
        icon: <DashboardOutlined />,
        label: <Link href="/my-dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>,
      }]
      : []),
    ...(canAccessDashboard(role)
      ? [{
        key: "/dashboard",
        icon: <DashboardOutlined />,
        label: <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>,
      }]
      : []),
    ...(canAccessTeam(role)
      ? [{
        key: "/my-team",
        icon: <TeamOutlined />,
        label: <Link href="/my-team" onClick={() => setMobileMenuOpen(false)}>My Team</Link>,
      }]
      : []),
    ...(canAccessReports(role)
      ? [{
        key: "/reports",
        icon: <BarChartOutlined />,
        label: <Link href="/reports" onClick={() => setMobileMenuOpen(false)}>Reports</Link>,
      }]
      : []),
    ...(canAccessAnalytics(role)
      ? [{
        key: "/analytics",
        icon: <PieChartOutlined />,
        label: <Link href="/analytics" onClick={() => setMobileMenuOpen(false)}>Analytics</Link>,
      }]
      : []),
  ];

  const profileMenuItems = [
    {
      key: "profile",
      label: "My Profile",
      icon: <UserOutlined />,
      onClick: () => router.push("/profile"),
    },
    {
      key: "logout",
      label: "Logout",
      icon: <LogoutOutlined />,
      onClick: () => logoutAndRedirectToLogin(),
      danger: true,
    },
  ];

  const SidebarContent = (
    <>
      <div className="h-16 flex items-center justify-center m-2">
        {(!isMobile && collapsed) ? (
          <div className="font-bold text-xl text-[#424E60] tracking-widest my-2">CG</div>
        ) : (
          <img
            src="/assets/Casagrand-Logo1.png"
            alt="Casagrand Logo"
            className="max-w-full h-10 object-contain"
          />
        )}
      </div>
      {/* {role && (
        <div className="px-4 pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 line-clamp-2">
          {getProfileDisplayTitle(jobTitle, role, alsoManager)}
        </div>
      )} */}
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
      />
    </>
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#F5A623',
        },
      }}
    >
      <Layout style={{ minHeight: "100vh" }}>
        {!isMobile && (
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
            theme="light"
            className="shadow-sm border-r border-gray-100 hidden md:block"
            width={200}
            collapsedWidth={80}
            style={{
              overflow: "auto",
              height: "100vh",
              position: "fixed",
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 100,
            }}
          >
            {SidebarContent}
          </Sider>
        )}

        <Drawer
          placement="left"
          onClose={() => setMobileMenuOpen(false)}
          open={isMobile && mobileMenuOpen}
          styles={{ body: { padding: 0 } }}
          className="md:hidden"
        >
          {SidebarContent}
        </Drawer>

        <Layout
          style={{
            minWidth: 0,
            overflowX: "hidden",
            marginLeft: isMobile ? 0 : collapsed ? 80 : 200,
            transition: "margin-left 0.2s",
          }}
        >
          <Header style={{ padding: 0, background: colorBgContainer }} className="shadow-sm flex items-center justify-between md:justify-end px-4 md:px-6 z-10 sticky top-0 border-b border-gray-100 dark:border-zinc-800">
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuOpen(true)}
                className="text-lg"
              />
            )}
            <div className="flex items-center">
              <Dropdown menu={{ items: profileMenuItems }} placement="bottomRight" trigger={["click"]}>
                <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
                  <Avatar className="!bg-[#fbb33b] text-white font-bold shrink-0 !text-xs" size={32}>
                    {avatarInitials}
                  </Avatar>
                  <div className="hidden sm:block text-left leading-tight min-w-0">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {firstName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {getProfileDisplayTitle(jobTitle, role, alsoManager)}
                    </div>
                  </div>
                  <CaretDownOutlined className="hidden sm:block text-[10px] text-gray-400 shrink-0" />
                </div>
              </Dropdown>
            </div>
          </Header>
          <Content className="m-0 sm:m-3 md:m-6 min-w-0">
            <div
              style={{
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
                overflowX: "hidden"
              }}
              className="p-3 sm:p-4 md:p-6 min-h-[360px]"
            >
              {children}
            </div>
          </Content>
          <Footer style={{ textAlign: "center", color: "gray" }}>
            Casagrand HR Portal ©2026
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};
