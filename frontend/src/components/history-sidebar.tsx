'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { authGet } from '@/lib/simple-api-client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Plus, LogOut, Sparkles, Lock, FileText } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type HistoryItem = {
  id: string;
  type: string;
  oneLineDescription: string;
  verdict: string;
  trustScore: number;
  createdAt: string;
};

const VERDICT_COLORS: Record<string, string> = {
  True: 'bg-emerald-500',
  False: 'bg-red-500',
  Misleading: 'bg-amber-500',
  Unverified: 'bg-gray-400',
  unknown: 'bg-gray-400',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function groupByDate(items: HistoryItem[]): { label: string; items: HistoryItem[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: Record<string, HistoryItem[]> = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] };

  for (const item of items) {
    const t = new Date(item.createdAt).getTime();
    if (t >= today) groups['Today'].push(item);
    else if (t >= yesterday) groups['Yesterday'].push(item);
    else if (t >= weekAgo) groups['This Week'].push(item);
    else groups['Earlier'].push(item);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function HistorySidebar({ onNewChat }: { onNewChat: () => void }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await authGet<{ history: HistoryItem[] }>('/api/user/history', { limit: '50' });
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [isAuthenticated]);

  // Fetch when authenticated and sidebar is first used
  useEffect(() => {
    if (isAuthenticated && !hasFetched) {
      fetchHistory();
    }
  }, [isAuthenticated, hasFetched, fetchHistory]);

  // Refetch when auth state changes (e.g. login)
  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    } else {
      setHistory([]);
      setHasFetched(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleNewChat = () => {
    onNewChat();
    if (isMobile) setOpenMobile(false);
  };

  const grouped = groupByDate(history);

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/50 backdrop-blur-sm">
      <SidebarHeader className="border-b border-border/50 bg-gradient-to-b from-sidebar-accent/5 to-transparent">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleNewChat} 
              tooltip="New Chat"
              className="group relative overflow-hidden transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-purple-500/10 hover:to-pink-500/10 hover:shadow-md"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500" />
              <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
              <span className="font-medium">New Chat</span>
              <Sparkles className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="bg-gradient-to-r from-transparent via-border to-transparent" />

      <SidebarContent className="px-2">
        {!isAuthenticated ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="text-sm text-sidebar-foreground/60 text-center py-8 px-4 space-y-2">
                <Lock className="h-8 w-8 text-sidebar-foreground/30 mx-auto" />
                <p>Sign in to save and view your analysis history</p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : loading && !hasFetched ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {[...Array(5)].map((_, i) => (
                  <SidebarMenuItem key={i} className="animate-in fade-in-0 slide-in-from-left-2" style={{ animationDelay: `${i * 50}ms` }}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : history.length === 0 && hasFetched ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="text-sm text-sidebar-foreground/60 text-center py-8 px-4 space-y-2">
                <FileText className="h-8 w-8 text-sidebar-foreground/30 mx-auto" />
                <p>No analysis history yet</p>
                <p className="text-xs">Start a conversation to see your history here</p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          grouped.map((group, groupIndex) => (
            <SidebarGroup key={group.label} className="animate-in fade-in-0 slide-in-from-left-2" style={{ animationDelay: `${groupIndex * 100}ms` }}>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item, itemIndex) => {
                    const animationDelay = `${(groupIndex * 100) + (itemIndex * 30)}ms`;
                    return (
                      <SidebarMenuItem 
                        key={item.id}
                        className="animate-in fade-in-0 slide-in-from-left-1"
                        style={{ animationDelay }}
                      >
                        <SidebarMenuButton
                          tooltip={item.oneLineDescription || 'Analysis'}
                          className="group relative overflow-hidden transition-all duration-200 hover:bg-sidebar-accent/50 hover:shadow-sm"
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${VERDICT_COLORS[item.verdict] || 'bg-gray-400'} transition-transform duration-200 group-hover:scale-110 shadow-sm`}
                          />
                          <span className="truncate text-sm">{item.oneLineDescription || 'Analysis'}</span>
                          <span className="ml-auto text-[10px] text-sidebar-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {relativeTime(item.createdAt)}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      {isAuthenticated && user && (
        <SidebarFooter className="border-t border-border/50 bg-gradient-to-t from-sidebar-accent/5 to-transparent">
          <SidebarSeparator className="bg-gradient-to-r from-transparent via-border to-transparent mb-2" />
          <div className="group flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-300 hover:bg-sidebar-accent/30 mx-2">
            <Avatar className="h-8 w-8 ring-2 ring-sidebar-accent/20 transition-all duration-300 group-hover:ring-sidebar-accent/40 group-hover:scale-105">
              <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-sidebar-accent-foreground font-semibold">
                {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate transition-colors duration-200 group-hover:text-sidebar-accent-foreground">
                {user.displayName}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-500/10 hover:text-red-500"
              onClick={logout}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
