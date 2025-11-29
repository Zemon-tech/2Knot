import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response as AIResponse } from '@/components/ai-elements/response';
import { Shimmer } from '@/components/ai-elements/shimmer';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputLeftAddon,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionAddAttachments,
  PromptInputActionToggleWebSearch,
  PromptInputActiveModeWebsearch,
  PromptInputCommand,
  PromptInputCommandList,
  PromptInputCommandGroup,
  PromptInputCommandItem,
  PromptInputCommandEmpty,
  PromptInputCommandSeparator,
  PromptInputMicButton,
} from '@/components/ai-elements/prompt-input';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, CopyIcon, PanelLeftIcon, MoreVertical, Settings, PaperclipIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorEmpty,
  ModelSelectorLogo,
} from '@/components/ai-elements/model-selector';
import { useNavigate, useParams } from 'react-router-dom';
import { Actions, Action } from '@/components/ai-elements/actions';
import { Task, TaskContent, TaskItem, TaskTrigger } from '@/components/ai-elements/task';
import { useSidebar } from '@/components/ui/sidebar';
import CreateAgentDialog from '@/components/agents/CreateAgentDialog';

// Remove model-internal tool code blocks like ```tool_code ... ``` while preserving normal code
function sanitizeAssistantText(input: string): string {
  if (!input) return input;
  // Remove any fenced code blocks whose language tag is tool_code (case-insensitive)
  // This handles partial/incomplete fences by applying on the whole buffer each tick
  return input.replace(/```\s*tool_code[\s\S]*?```/gi, '').replace(/\n{3,}/g, '\n\n');
}

type WebSource = { id: number; title: string; link: string; source?: string; favicon?: string; date?: string; snippet?: string };
type Attachment = { url: string; mediaType?: string; filename?: string };
type Message = { _id?: string; role: 'user' | 'assistant'; content: string; attachments?: Attachment[]; sources?: WebSource[]; webSummary?: string };
type Agent = { _id: string; name: string; slug: string; description?: string; systemPrompt: string };

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [phase, setPhase] = useState<'planning' | 'searching' | 'fetching' | 'summarizing' | 'answering' | 'complete' | null>(null);
  const assistantBuffer = useRef('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [provider, setProvider] = useState<'gemini' | 'openrouter' | 'groq'>('gemini');
  const [openModelDialog, setOpenModelDialog] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<{ id: string; name?: string }[]>([]);
  const [groqModels, setGroqModels] = useState<{ id: string; name?: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>('openrouter/auto');
  const [webSearch, setWebSearch] = useState<boolean>(false);
  const [openSources, setOpenSources] = useState(false);
  const [selectedSources, setSelectedSources] = useState<WebSource[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [openCreateAgent, setOpenCreateAgent] = useState(false);
  const composerContainerRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState<number>(0);
  const topTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focusedComposer, setFocusedComposer] = useState<'top' | 'bottom' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const displayName = (user?.name || user?.email || 'there').split(' ')[0].split('@')[0];
  const salutation = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // React to URL path `/c/:id`; if none, pick first and navigate
  useEffect(() => {
    const id = routeId || null;
    if (id && id !== activeId) {
      selectConversation(id);
    } else if (!id) {
      (async () => {
        try {
          const { conversations } = await api.conversations.list();
          if (conversations[0]?._id) {
            const first = conversations[0]._id as string;
            navigate(`/c/${first}`, { replace: true });
            await selectConversation(first);
          } else {
            setActiveId(null);
            setMessages([]);
          }
        } catch {}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Load saved provider on mount and persist changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aiProvider') as 'gemini' | 'openrouter' | 'groq' | null;
      if (saved === 'gemini' || saved === 'openrouter' || saved === 'groq') setProvider(saved);
      const savedModel = localStorage.getItem('openrouterModel');
      if (savedModel) setSelectedOpenRouterModel(savedModel);
      const ws = localStorage.getItem('webSearch');
      if (ws === '1') setWebSearch(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    if (isRecording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm' : 'audio/mp4';
    const mr = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: mime });
        const b64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve(String(fr.result));
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        const { text } = await api.ai.voiceSTT({ audioBase64: b64, mimeType: mime });
        if (text && text.trim()) await onSend(text.trim());
      } catch {}
    };
    mr.start(200);
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  }

  async function stopRecording() {
    if (!isRecording) return;
    const mr = mediaRecorderRef.current;
    setIsRecording(false);
    try { mr?.stop(); } catch {}
    try { mr?.stream.getTracks().forEach((t) => t.stop()); } catch {}
  }

  async function speakText(text: string) {
    if (!text) return;
    try {
      const { audioBase64 } = await api.ai.voiceTTS({ text });
      const audio = new Audio(audioBase64);
      await audio.play();
    } catch {}
  }

  // Load user agents on mount
  useEffect(() => {
    (async () => {
      try {
        const { agents } = await api.agents.list();
        setAgents(agents as Agent[]);
      } catch {
        setAgents([]);
      }
    })();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('aiProvider', provider);
    } catch {}
  }, [provider]);
  useEffect(() => {
    try {
      if (selectedOpenRouterModel) localStorage.setItem('openrouterModel', selectedOpenRouterModel);
    } catch {}
  }, [selectedOpenRouterModel]);
  useEffect(() => {
    try {
      localStorage.setItem('webSearch', webSearch ? '1' : '0');
    } catch {}
  }, [webSearch]);

  useEffect(() => {
    if (openModelDialog) {
      (async () => {
        try {
          setModelsLoading(true);
          // OpenRouter free models via backend proxy
          try {
            const { models } = await api.ai.modelsOpenRouter();
            setOpenRouterModels(models);
          } catch {
            setOpenRouterModels([]);
          }
          // Groq models via backend proxy
          try {
            const { models } = await api.ai.modelsGroq();
            setGroqModels(models);
          } catch {
            setGroqModels([]);
          }
        } finally {
          setModelsLoading(false);
        }
      })();
    }
  }, [openModelDialog]);

  async function selectConversation(id: string) {
    setActiveId(id);
    const { conversation, messages } = await api.conversations.messages(id, 1, 200);
    setMessages(messages as any);
    const convAgentId = (conversation as any)?.agentId as string | undefined;
    if (convAgentId) {
      const found = agents.find((a) => a._id === convAgentId);
      setActiveAgent(found || null);
    } else {
      setActiveAgent(null);
    }
  }

  async function onSend(userText: string, files?: Attachment[]) {
    if (!userText.trim() || streaming) return;
    setMessages((m) => [...m, { role: 'user', content: userText, attachments: files && files.length ? files : undefined }]);
    setStreaming(true);
    setPhase(null);
    assistantBuffer.current = '';
    setAutoScroll(true);
    let convId = activeId || undefined;
    try {
      // If image attachments provided, call image analysis endpoint and then reload conversation
      const imageFiles = (files || []).filter((f) => (f.mediaType || '').startsWith('image/'));
      if (imageFiles.length > 0) {
        try {
          const { text, conversationId: newId } = await api.ai.analyzeImage({ prompt: userText, images: imageFiles, conversationId: activeId || undefined });
          const cid = newId || activeId || undefined;
          if (cid) {
            await selectConversation(cid);
            if (!activeId && cid) navigate(`/c/${cid}`, { replace: true });
            // Generate/update concise title and refresh sidebar list (mirror streaming behavior)
            try {
              await api.ai.title(cid, provider);
              window.dispatchEvent(new CustomEvent('conversations:refresh'));
            } catch {}
          } else {
            setMessages((m) => [...m, { role: 'assistant', content: text }]);
          }
        } finally {
          setStreaming(false);
          setTimeout(() => setPhase(null), 500);
        }
        return;
      }
      let finalConvId: string | undefined = convId;
      // Build locale-aware web options
      const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';
      const [hlPart, glPart] = lang.split('-');
      const hl = (hlPart || 'en').toLowerCase();
      const gl = (glPart || 'US').toLowerCase();
      await api.ai.stream(
        { conversationId: convId, message: userText, attachments: files, provider, webSearch, web: webSearch ? { hl, gl } : undefined, agentId: activeAgent?._id },
        {
          onDelta: (delta: string) => {
            assistantBuffer.current += delta;
            const sanitized = sanitizeAssistantText(assistantBuffer.current);
            setMessages((m) => {
              const last = m[m.length - 1];
              if (last && last.role === 'assistant') {
                return [...m.slice(0, -1), { ...last, content: sanitized }];
              }
              return [...m, { role: 'assistant', content: sanitized }];
            });
          },
          onStatus: (p) => {
            setPhase(p);
          },
          onSources: (sources) => {
            setMessages((m) => {
              const last = m[m.length - 1];
              if (last && last.role === 'assistant') {
                return [...m.slice(0, -1), { ...last, sources }];
              }
              return [...m, { role: 'assistant', content: '', sources }];
            });
          },
          onWebSummary: (summary) => {
            setMessages((m) => {
              const last = m[m.length - 1];
              if (last && last.role === 'assistant') {
                return [...m.slice(0, -1), { ...last, webSummary: summary }];
              }
              return [...m, { role: 'assistant', content: '', webSummary: summary }];
            });
          },
          onDone: ({ conversationId }) => {
            if (conversationId) finalConvId = conversationId;
            setPhase('complete');
          },
        }
      );

      // Ensure we have the conversation id for newly created chats
      if (!finalConvId && activeId) finalConvId = activeId;

      // Generate/update concise title and refresh sidebar list
      if (finalConvId) {
        try {
          await api.ai.title(finalConvId, provider);
          window.dispatchEvent(new CustomEvent('conversations:refresh'));
        } catch {}
      }

      if (!activeId && finalConvId) {
        setActiveId(finalConvId);
        navigate(`/c/${finalConvId}`, { replace: true });
      }
    } catch (e) {
      // noop
    } finally {
      setStreaming(false);
      setTimeout(() => setPhase(null), 500);
    }
  }

  useEffect(() => {
    const checkPosition = () => {
      const isAtTop = window.scrollY <= 8;
      setAtTop(isAtTop);
      const doc = document.documentElement;
      const isAtBottom = window.innerHeight + window.scrollY >= (doc.scrollHeight - 8);
      setAtBottom(isAtBottom);
    };
    const handleWheel = (e: WheelEvent) => {
      // If the user scrolls upward, disable autoscroll until they click "Get to latest"
      if (e.deltaY < 0) setAutoScroll(false);
    };
    window.addEventListener('scroll', checkPosition, { passive: true });
    window.addEventListener('resize', checkPosition, { passive: true } as any);
    window.addEventListener('wheel', handleWheel, { passive: true });
    checkPosition();
    return () => {
      window.removeEventListener('scroll', checkPosition);
      window.removeEventListener('resize', checkPosition as any);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Track bottom composer height so we can offset the "Get to latest" pill above it
  useEffect(() => {
    const el = composerContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.ceil(entry.contentRect.height);
        setComposerHeight(h);
      }
    });
    ro.observe(el);
    // Initialize immediately
    setComposerHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [composerContainerRef.current]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streaming, autoScroll]);

  // Use IntersectionObserver to more reliably detect when we're at the very bottom
  // of the page (i.e., when the invisible bottomRef is visible). This is more robust
  // than comparing window scroll coordinates, especially when the prompt input grows
  // or sticky elements affect layout.
  useEffect(() => {
    const target = bottomRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const atBottomNow = entry.isIntersecting;
        // When the anchor comes into view, we can safely re-enable autoscroll.
        if (atBottomNow) setAutoScroll(true);
      },
      {
        root: null,
        threshold: 0,
        // Account for sticky composer height so the anchor only intersects
        // when near the real bottom of the scrollable document.
        rootMargin: '0px 0px -160px 0px',
      }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Chat no longer manages the sidebar list; creation/selection is handled in layout.

  function NavHeader() {
    const { toggleSidebar, state, isMobile } = useSidebar();
    return (
      <header className="sticky top-0 z-20 h-12 border-b px-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          {(isMobile || state === 'collapsed') && (
            <button
              aria-label="Toggle sidebar"
              className="group inline-flex items-center"
              onClick={toggleSidebar}
            >
              <img src="/logo.svg" alt="Quild AI" className="h-6 w-auto dark:invert block group-hover:hidden" />
              <PanelLeftIcon className="size-4 hidden group-hover:block" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Menu" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="justify-between cursor-pointer"
                onClick={() => setOpenModelDialog(true)}
              >
                <span className="truncate">
                  {provider === 'openrouter' ? selectedOpenRouterModel : provider === 'groq' ? 'Groq' : 'Gemini'}
                </span>
                <span className="ml-2 inline-flex items-center justify-center h-7 w-7">
                  <Settings className="size-4" />
                </span>
              </DropdownMenuItem>
              {null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    );
  }

  return (
    <>
      <CreateAgentDialog
        open={openCreateAgent}
        onOpenChange={setOpenCreateAgent}
        onCreated={(agent) => {
          setAgents((prev) => [...prev, agent as Agent]);
          setActiveAgent(agent as Agent);
          // Also insert @agent.slug at caret where @ was typed most recently
          try {
            const ta = (focusedComposer === 'bottom'
              ? (document.querySelector('textarea[data-composer="bottom"]') as HTMLTextAreaElement | null)
              : (document.querySelector('textarea[data-composer="top"]') as HTMLTextAreaElement | null))
              || (document.querySelector('textarea[data-composer]') as HTMLTextAreaElement | null);
            if (ta) {
              const pos = ta.selectionStart ?? ta.value.length;
              const uptoCaret = ta.value.slice(0, pos);
              const lastBreak = Math.max(uptoCaret.lastIndexOf(' '), uptoCaret.lastIndexOf('\n'), uptoCaret.lastIndexOf('\t'));
              const startIdx = lastBreak + 1;
              const token = uptoCaret.slice(startIdx);
              const before = ta.value.slice(0, startIdx);
              const after = ta.value.slice(pos);
              const insert = `@${(agent as Agent).slug} `;
              if (token.startsWith('@')) {
                ta.value = before + insert + after;
              } else {
                ta.value = ta.value.slice(0, pos) + insert + after;
              }
              const newCaret = (before + insert).length;
              ta.setSelectionRange(newCaret, newCaret);
              const evt = new Event('input', { bubbles: true });
              ta.dispatchEvent(evt);
            }
          } catch {}
        }}
        createAgent={api.agents.create}
      />
      <ModelSelector open={openModelDialog} onOpenChange={setOpenModelDialog}>
        <ModelSelectorContent title="Select Model" className="sm:max-w-xl">
          <ModelSelectorInput placeholder="Search models…" />
          <ModelSelectorList>
            {modelsLoading && (
              <div className="p-3 text-sm text-muted-foreground">Loading models…</div>
            )}
            {!modelsLoading && (
              <>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                <ModelSelectorGroup heading="Gemini (Direct)">
                  <ModelSelectorItem
                    value="gemini-2.0-flash"
                    onSelect={() => {
                      setProvider('gemini');
                      setOpenModelDialog(false);
                    }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <ModelSelectorLogo provider={"google" as any} className="size-4" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">Gemini 2.0 Flash</span>
                        <span className="text-xs text-muted-foreground truncate">gemini-2.0-flash</span>
                      </div>
                    </div>
                  </ModelSelectorItem>
                </ModelSelectorGroup>
                <ModelSelectorGroup heading="OpenRouter (Free)">
                  {openRouterModels.map((m) => (
                    <ModelSelectorItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => {
                        setSelectedOpenRouterModel(m.id);
                        setProvider('openrouter');
                        setOpenModelDialog(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        {(() => {
                          const provider = (m.id.split('/')[0] || 'openrouter') as any;
                          return <ModelSelectorLogo provider={provider} className="size-4" />;
                        })()}
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{m.name || m.id}</span>
                          <span className="text-xs text-muted-foreground truncate">{m.id}</span>
                        </div>
                      </div>
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
                <ModelSelectorGroup heading="Groq">
                  {groqModels.map((m) => (
                    <ModelSelectorItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => {
                        setProvider('groq');
                        setOpenModelDialog(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <ModelSelectorLogo provider={"groq" as any} className="size-4" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{m.name || m.id}</span>
                          <span className="text-xs text-muted-foreground truncate">{m.id}</span>
                        </div>
                      </div>
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
              </>
            )}
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
      <NavHeader />
      <div className="flex-1 overflow-visible">
          {messages.length === 0 ? (
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(80vh-3rem)] flex flex-col items-center justify-center text-center gap-6">
              <div className="text-muted-foreground text-2xl sm:text-3xl">{salutation}, {displayName}</div>
              <div className="text-3xl sm:text-4xl font-semibold tracking-tight">What's on the agenda today?</div>
              <div className="w-full max-w-4xl">
                <PromptInput
                  onSubmit={async ({ text, files }) => {
                    if (!text) return;
                    const atts = (files || []).map((f) => ({ url: f.url, mediaType: (f as any).mediaType, filename: (f as any).filename }));
                    await onSend(text, atts.length ? atts : undefined);
                  }}
                  groupClassName={`${(webSearch || !!activeAgent) ? '!rounded-md has-[>textarea[data-multiline=true]]:!rounded-md' : 'rounded-3xl'} bg-card px-3 py-2 border border-input shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-input`}
                >
                  <PromptInputLeftAddon>
                    <PromptInputActionMenu>
                      <PromptInputActionMenuTrigger>
                        <PlusIcon className="size-4" />
                      </PromptInputActionMenuTrigger>
                      <PromptInputActionMenuContent>
                        <PromptInputActionAddAttachments />
                        <PromptInputActionToggleWebSearch
                          checked={webSearch}
                          onCheckedChange={setWebSearch}
                        />
                        <PromptInputActionMenuItem>Create image</PromptInputActionMenuItem>
                        <PromptInputActionMenuItem>Thinking</PromptInputActionMenuItem>
                        <PromptInputActionMenuItem>Deep research</PromptInputActionMenuItem>
                        <PromptInputActionMenuItem>Study and learn</PromptInputActionMenuItem>
                      </PromptInputActionMenuContent>
                    </PromptInputActionMenu>
                    <PromptInputMicButton
                      recording={isRecording}
                      onClick={() => (isRecording ? stopRecording() : startRecording())}
                    />
                    {webSearch && (
                      <PromptInputActiveModeWebsearch
                        active={webSearch}
                        onClick={() => setWebSearch(false)}
                      />
                    )}
                    {activeAgent && (
                      <PromptInputActiveModeWebsearch
                        active={true}
                        label={`Agent: ${activeAgent.name}`}
                        onClick={() => setActiveAgent(null)}
                        className="mt-1"
                      />
                    )}
                  </PromptInputLeftAddon>
                  <PromptInputTextarea
                    placeholder=""
                    suggestions={[
                      'Ask how to structure an essay',
                      'Ask for social media captions',
                      'Summarize this document',
                      'Brainstorm feature ideas',
                    ]}
                    suggestionInterval={3000}
                    className="py-2"
                    forceMultilineLayout={webSearch || !!activeAgent}
                    onMentionQueryChange={(q) => setMentionQuery(q)}
                    data-composer="top"
                    ref={topTextareaRef as any}
                    onFocus={() => setFocusedComposer('top')}
                    onMentionRemoved={(slug) => {
                      if (activeAgent?.slug === slug) setActiveAgent(null);
                    }}
                  />
                  <PromptInputFooter>
                    <div />
                    <PromptInputSubmit status={streaming ? 'streaming' : undefined} />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-6">
              {messages.map((m, idx) => (
                m.role === 'assistant' ? (
                  <div key={idx} className="w-full">
                    {/* Optional web findings summary */}
                    {m.webSummary && (
                      <div className="mb-3">
                        <Task defaultOpen={false}>
                          <TaskTrigger title="Research summary" />
                          <TaskContent>
                            <TaskItem>
                              <AIResponse>{m.webSummary}</AIResponse>
                            </TaskItem>
                          </TaskContent>
                        </Task>
                      </div>
                    )}
                    {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {m.attachments.map((a, i) => {
                          const isImage = (a.mediaType || '').startsWith('image/') && a.url;
                          const isVideo = (a.mediaType || '').startsWith('video/') && a.url;
                          if (isImage) {
                            return (
                              <img key={i} src={a.url} alt={a.filename || 'attachment'} className="h-28 w-28 object-cover rounded-xl border" />
                            );
                          }
                          if (isVideo) {
                            return (
                              <video key={i} src={a.url} controls className="h-28 w-40 rounded-xl border object-cover" />
                            );
                          }
                          return (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-28 w-28 rounded-xl border bg-muted text-muted-foreground">
                              <PaperclipIcon className="size-5" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                    <Message from="assistant">
                      <MessageContent variant="flat">
                        <AIResponse className="prose dark:prose-invert max-w-none">
                          {m.content}
                        </AIResponse>
                      </MessageContent>
                    </Message>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        {Array.isArray(m.sources) && m.sources.length > 0 && (
                          <button
                            type="button"
                            className="flex items-center gap-2 px-2 py-1 rounded-full bg-secondary border border-border hover:bg-secondary/80"
                            onClick={() => {
                              setSelectedSources(m.sources || []);
                              setOpenSources(true);
                            }}
                          >
                            <span className="text-xs text-muted-foreground">Sources</span>
                            <div className="flex items-center -space-x-1">
                              {(() => {
                                const unique: WebSource[] = [];
                                const seenDomains = new Set<string>();
                                for (const s of m.sources!) {
                                  try {
                                    const host = new URL(s.link).hostname;
                                    if (seenDomains.has(host)) continue;
                                    seenDomains.add(host);
                                    unique.push(s);
                                  } catch { continue; }
                                }
                                return unique.slice(0, 4).map((s) => (
                                  <span
                                    key={s.id}
                                    title={s.source || s.title}
                                    className="inline-flex h-5 w-5 rounded-full overflow-hidden ring-1 ring-border bg-muted"
                                  >
                                    <img
                                      src={(s.favicon && s.favicon.length > 0) ? s.favicon : (() => { try { const host = new URL(s.link).hostname; return `https://icons.duckduckgo.com/ip3/${host}.ico`; } catch { return ''; } })()}
                                      alt={s.source || 'source'}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </span>
                                ));
                              })()}
                            </div>
                          </button>
                        )}
                      </div>
                      <Actions className="mt-0">
                        <Action
                          tooltip="Copy"
                          label="Copy"
                          onClick={() => navigator.clipboard?.writeText(m.content)}
                        >
                          <CopyIcon className="size-4" />
                        </Action>
                        <Action
                          tooltip="Speak"
                          label="Speak"
                          onClick={() => speakText(m.content)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                            <path d="M3 10v4a1 1 0 0 0 1 1h3l4 3V6l-4 3H4a1 1 0 0 0-1 1zm13.54-3.46a1 1 0 1 0-1.41 1.41A5 5 0 0 1 17 12a5 5 0 0 1-1.87 3.85 1 1 0 1 0 1.33 1.49A7 7 0 0 0 19 12a7 7 0 0 0-2.46-5.46z" />
                          </svg>
                        </Action>
                      </Actions>
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="w-full">
                    {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2 justify-end">
                        {m.attachments.map((a, i) => {
                          const isImage = (a.mediaType || '').startsWith('image/') && a.url;
                          const isVideo = (a.mediaType || '').startsWith('video/') && a.url;
                          if (isImage) {
                            return (
                              <img key={i} src={a.url} alt={a.filename || 'attachment'} className="h-28 w-28 object-cover rounded-xl border" />
                            );
                          }
                          if (isVideo) {
                            return (
                              <video key={i} src={a.url} controls className="h-28 w-40 rounded-xl border object-cover" />
                            );
                          }
                          return (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-28 w-28 rounded-xl border bg-muted text-muted-foreground">
                              <PaperclipIcon className="size-5" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                    <Message from={m.role}>
                      <MessageContent>{m.content}</MessageContent>
                    </Message>
                  </div>
                )
              ))}
              {streaming && (
                <div className="w-full">
                  <Shimmer className="text-base">
                    {(() => {
                      switch (phase) {
                        case 'planning':
                          return 'Planning searches…';
                        case 'searching':
                          return 'Searching the web…';
                        case 'fetching':
                          return 'Fetching articles…';
                        case 'summarizing':
                          return 'Summarizing findings…';
                        case 'answering':
                          return assistantBuffer.current ? 'Answering…' : 'Preparing answer…';
                        default:
                          return assistantBuffer.current ? 'Answering…' : 'Thinking…';
                      }
                    })()}
                  </Shimmer>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
      </div>
      {((!streaming && !atBottom) || (streaming && atTop)) && (
        <div className="sticky z-30" style={{ bottom: Math.max(24, composerHeight + 32) }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <button
              aria-label="Get to latest"
              className="px-3 py-1.5 rounded-full bg-background/30 hover:bg-background/40 border border-border/60 shadow-md backdrop-blur-md text-foreground text-xs font-medium"
              onClick={() => {
                setAutoScroll(true);
                window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
              }}
            >
              Get to latest
            </button>
          </div>
        </div>
      )}
      {messages.length > 0 && (
        <div className="sticky bottom-0 z-20 pointer-events-none">
          <div ref={composerContainerRef} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 pointer-events-auto relative">
              {null}
              <PromptInput
                onSubmit={async ({ text, files }) => {
                  if (!text) return;
                  const atts = (files || []).map((f) => ({ url: f.url, mediaType: (f as any).mediaType, filename: (f as any).filename }));
                  await onSend(text, atts.length ? atts : undefined);
                }}
                groupClassName={`${(webSearch || !!activeAgent) ? 'rounded-md' : 'rounded-3xl'} bg-card px-3 py-2 border border-input shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-input`}
              >
                <PromptInputLeftAddon>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger>
                      <PlusIcon className="size-4" />
                    </PromptInputActionMenuTrigger>
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                      <PromptInputActionToggleWebSearch
                        checked={webSearch}
                        onCheckedChange={setWebSearch}
                      />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  {webSearch && (
                    <PromptInputActiveModeWebsearch
                      active={webSearch}
                      onClick={() => setWebSearch(false)}
                    />
                  )}
                  {activeAgent && (
                    <PromptInputActiveModeWebsearch
                      active={true}
                      label={`Agent: ${activeAgent.name}`}
                      onClick={() => setActiveAgent(null)}
                      className="mt-1"
                    />
                  )}
                </PromptInputLeftAddon>
                <PromptInputTextarea
                  placeholder="Send a message"
                  suggestions={[]}
                  className="py-2"
                  forceMultilineLayout={webSearch || !!activeAgent}
                  onMentionQueryChange={(q) => setMentionQuery(q)}
                  data-composer="bottom"
                  ref={bottomTextareaRef as any}
                  onFocus={() => setFocusedComposer('bottom')}
                  onMentionRemoved={(slug) => {
                    if (activeAgent?.slug === slug) setActiveAgent(null);
                  }}
                />
                <PromptInputFooter>
                  <div />
                  <PromptInputSubmit status={streaming ? 'streaming' : undefined} />
                </PromptInputFooter>
              </PromptInput>
              {mentionQuery !== null && (
                <div className="absolute bottom-16 left-0 right-0 max-w-xs">
                  <PromptInputCommand className="border bg-popover text-popover-foreground rounded-lg shadow-md">
                    <PromptInputCommandList>
                      <PromptInputCommandEmpty>No agents found.</PromptInputCommandEmpty>
                      <PromptInputCommandGroup heading="Agents">
                        {agents
                          .filter((a) => {
                            const q = mentionQuery.toLowerCase();
                            return (
                              a.name.toLowerCase().includes(q) ||
                              a.slug.toLowerCase().includes(q)
                            );
                          })
                          .map((agent) => (
                            <PromptInputCommandItem
                              key={agent._id}
                              onSelect={() => {
                                setActiveAgent(agent);
                                // Insert @agent.slug at caret in the focused textarea, replacing the current @token
                                let ta = (focusedComposer === 'bottom' ? bottomTextareaRef.current : topTextareaRef.current);
                                if (!ta) {
                                  ta = (focusedComposer === 'bottom'
                                    ? (document.querySelector('textarea[data-composer="bottom"]') as HTMLTextAreaElement | null)
                                    : (document.querySelector('textarea[data-composer="top"]') as HTMLTextAreaElement | null))
                                    || (document.querySelector('textarea[data-composer]') as HTMLTextAreaElement | null);
                                }
                                try {
                                  if (ta) {
                                    const pos = ta.selectionStart ?? ta.value.length;
                                    const uptoCaret = ta.value.slice(0, pos);
                                    const lastBreak = Math.max(uptoCaret.lastIndexOf(' '), uptoCaret.lastIndexOf('\n'), uptoCaret.lastIndexOf('\t'));
                                    const startIdx = lastBreak + 1;
                                    const token = uptoCaret.slice(startIdx);
                                    let before = ta.value.slice(0, startIdx);
                                    const after = ta.value.slice(pos);
                                    const insert = `@${agent.slug} `;
                                    if (token.startsWith('@')) {
                                      // replace token from startIdx..pos
                                      ta.value = before + insert + after;
                                    } else {
                                      ta.value = ta.value.slice(0, pos) + insert + after;
                                    }
                                    const newCaret = (before + insert).length;
                                    ta.setSelectionRange(newCaret, newCaret);
                                    // dispatch input event so autosize/onMention update
                                    const evt = new Event('input', { bubbles: true });
                                    ta.dispatchEvent(evt);
                                  }
                                } catch {}
                                setMentionQuery(null);
                              }}
                            >
                              <span className="font-medium">{agent.name}</span>
                              {agent.description && (
                                <span className="ml-2 text-xs text-muted-foreground truncate">
                                  {agent.description}
                                </span>
                              )}
                            </PromptInputCommandItem>
                          ))}
                      </PromptInputCommandGroup>
                      <PromptInputCommandSeparator />
                      <PromptInputCommandItem
                        onSelect={() => {
                          setOpenCreateAgent(true);
                          setMentionQuery(null);
                        }}
                      >
                        Create new agent…
                      </PromptInputCommandItem>
                    </PromptInputCommandList>
                  </PromptInputCommand>
                </div>
              )}
            </div>
          </div>
        )}
      {/* Sources Sheet */}
      <Sheet open={openSources} onOpenChange={setOpenSources}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Sources</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3">
            {Array.isArray(selectedSources) && selectedSources.length > 0 ? (
              selectedSources.map((s) => {
                let host = '';
                try { host = new URL(s.link).hostname; } catch {}
                const favicon = (s.favicon && s.favicon.length > 0) ? s.favicon : (host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '');
                return (
                  <a
                    key={s.id}
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 rounded-md border p-3 hover:bg-accent"
                  >
                    <span className="inline-flex h-6 w-6 rounded-sm overflow-hidden ring-1 ring-border bg-muted mt-0.5">
                      <img
                        src={favicon}
                        alt={s.source || 'source'}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-sm truncate">{s.title || s.source || s.link}</span>
                      <span className="block text-muted-foreground text-xs truncate">{host}</span>
                      {s.snippet && (
                        <span className="block text-muted-foreground text-xs line-clamp-2 mt-1">{s.snippet}</span>
                      )}
                    </span>
                  </a>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">No sources available.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}


