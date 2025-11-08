import { SidebarProvider, Sidebar, SidebarHeader, SidebarFooter, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarRail, SidebarUserButton, useSidebar, SidebarGroupLabel, SidebarMenuActionsMenu } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home as HomeIcon, PlusIcon, ChevronRight, PanelLeft, BookOpen, FolderPlus } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { api } from '@/api/client';

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <span>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Card({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-card text-card-foreground rounded-lg overflow-hidden border border-border w-64">
      <div className="h-32 bg-gradient-to-br from-muted to-muted-foreground/20" />
      <div className="p-3 space-y-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle ? (
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  type Conversation = { _id: string; title: string };
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatsOpen, setChatsOpen] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const { conversations } = await api.conversations.list();
        setConversations(conversations as any);
      } catch {}
    })();
  }, []);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="h-12 items-center">
          <div className="flex items-center gap-2 px-2 h-12">
            <img src="/logo.svg" alt="Quild AI" className="h-6 w-auto dark:invert" />
          </div>
          <div className="flex items-center justify-between gap-2 h-12">
            <SidebarTrigger hideWhenExpanded={false} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive>
                    <Link to="/home">
                      <HomeIcon />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={async () => {
                    const res = await api.conversations.create('New Chat');
                    setConversations((c) => [res.conversation, ...c]);
                    navigate('/');
                  }}>
                    <PlusIcon />
                    <span>New chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <BookOpen />
                    <span>Library</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <FolderPlus />
                    <span>Projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between cursor-pointer select-none" asChild>
              <button onClick={() => setChatsOpen((v) => !v)}>
                <div className="flex items-center gap-2">
                  <span>Chats</span>
                </div>
              </button>
            </SidebarGroupLabel>
            {chatsOpen && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {conversations.map((c) => (
                    <SidebarMenuItem key={c._id}>
                      <SidebarMenuButton
                        onClick={() => {
                          if (editingId) return;
                          navigate('/');
                        }}
                      >
                        {editingId === c._id ? (
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={async () => {
                              const t = editValue.trim();
                              setEditingId(null);
                              if (!t) return;
                              try {
                                const res = await api.conversations.rename(c._id, t);
                                setConversations((cs) => cs.map((x) => (x._id === c._id ? res.conversation : x)));
                              } catch {}
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.currentTarget as HTMLInputElement).blur();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            className="bg-transparent outline-none border-0 focus:ring-0 w-full truncate"
                          />
                        ) : (
                          <span>{c.title}</span>
                        )}
                      </SidebarMenuButton>
                      <SidebarMenuActionsMenu
                        onRename={() => {
                          const current = conversations.find((x) => x._id === c._id)?.title || '';
                          setEditingId(c._id);
                          setEditValue(current);
                        }}
                        onDelete={async () => {
                          await api.conversations.remove(c._id);
                          setConversations((cs) => cs.filter((x) => x._id !== c._id));
                        }}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUserButton email={user?.email || 'user@example.com'} name={user?.name} onLogout={logout} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Floating top-left logo/trigger (no nav bar) */}
        <TopLeftLogoTrigger />
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-10">
          <div className="text-2xl font-semibold text-center mb-2">{greeting}</div>
          <Section title="Recently visited" action={<Link to="#" className="text-xs text-muted-foreground inline-flex items-center gap-1">See all <ChevronRight className="size-3" /></Link>}>
            <Carousel className="w-full" wheelGestures>
              <CarouselContent className="-ml-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <CarouselItem key={i} className="pl-2 basis-auto">
                    <Card title={`SAAS Demo ${i + 1}`} subtitle={`Nov ${i + 1}`} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </Section>

          <Section title="Learn" action={<Link to="#" className="text-xs text-muted-foreground inline-flex items-center gap-1">See all <ChevronRight className="size-3" /></Link>}>
            <Carousel className="w-full" wheelGestures>
              <CarouselContent className="-ml-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <CarouselItem key={i} className="pl-2 basis-auto">
                    <Card title={["The ultimate guide","Customize & style","Getting started","Using AI effectively"][i % 4]} subtitle={`${5 + (i % 5)}m read`} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </Section>

          <Section title="Featured templates" action={<Link to="#" className="text-xs text-muted-foreground inline-flex items-center gap-1">See all <ChevronRight className="size-3" /></Link>}>
            <Carousel className="w-full" wheelGestures>
              <CarouselContent className="-ml-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <CarouselItem key={i} className="pl-2 basis-auto">
                    <Card title={["Life Wiki","Journal","To-do List","Simple Budget"][i % 4]} subtitle="By Quild" />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </Section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function TopLeftLogoTrigger() {
  const { toggleSidebar, state } = useSidebar();
  // Hide when sidebar is expanded (logo already visible in sidebar)
  if (state === 'expanded') return null;
  return (
    <div className="sticky top-0 z-20 h-12 pl-3 flex items-center">
      <button
        aria-label="Toggle sidebar"
        className="group inline-flex items-center"
        onClick={toggleSidebar}
      >
        <img src="/logo.svg" alt="Quild AI" className="h-6 w-auto dark:invert block group-hover:hidden" />
        <PanelLeft className="size-4 hidden group-hover:block" />
      </button>
    </div>
  );
}
