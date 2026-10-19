import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Plus,
  LogOut,
  User,
  Menu,
  X,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Terminal,
  Database,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Trash2,
  Sparkles,
  Moon,
  Sun
} from 'lucide-react';
import { normalizeChatResponse } from '../api/client';

const EXAMPLE_PROMPTS = [
  'Find datasets about road accidents in Maharashtra.',
  'Analyze trends in Indian road accidents.',
  'What government datasets are available about education?',
];

export default function ChatInterface({ user, apiClient, onLogout, darkMode, onToggleDarkMode }) {
  // Multi-thread local state so students can organize sessions cleanly
  const [conversations, setConversations] = useState(() => [
    {
      id: 'default-thread',
      title: 'New Data Analysis Session',
      updatedAt: new Date().toISOString(),
      messages: [],
    },
  ]);
  const [activeId, setActiveId] = useState('default-thread');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedTools, setExpandedTools] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages?.length, isSending]);

  // Auto-resize composer textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleNewChat = () => {
    if (isSending) return;
    const newThread = {
      id: `thread-${Date.now()}`,
      title: 'New Data Analysis Session',
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setConversations((prev) => [newThread, ...prev]);
    setActiveId(newThread.id);
    setInput('');
    setSidebarOpen(false);
  };

  const handleDeleteThread = (threadId, e) => {
    e.stopPropagation();
    if (isSending) return;
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== threadId);
      if (remaining.length === 0) {
        const fallback = {
          id: `thread-${Date.now()}`,
          title: 'New Data Analysis Session',
          updatedAt: new Date().toISOString(),
          messages: [],
        };
        setActiveId(fallback.id);
        return [fallback];
      }
      if (threadId === activeId) {
        setActiveId(remaining[0].id);
      }
      return remaining;
    });
  };

  const sendMessage = async (rawText, retryMessageId = null) => {
    const trimmed = rawText.trim();
    if (!trimmed || isSending) return;

    const targetThreadId = activeConversation.id;
    const userMsgId = retryMessageId || `msg-${Date.now()}`;

    if (!retryMessageId) {
      const userMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== targetThreadId) return conv;
          const isFirst = conv.messages.length === 0;
          return {
            ...conv,
            title: isFirst ? trimmed.slice(0, 42) + (trimmed.length > 42 ? '...' : '') : conv.title,
            updatedAt: new Date().toISOString(),
            messages: [...conv.messages, userMessage],
          };
        })
      );
      setInput('');
    } else {
      // Clear error state on the failed message before retrying
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === targetThreadId
            ? {
                ...conv,
                messages: conv.messages.filter((m) => m.id !== retryMessageId),
              }
            : conv
        )
      );
    }

    setIsSending(true);
    try {
      const data = await apiClient.sendChatMessage(trimmed);
      const { text, toolsUsed } = normalizeChatResponse(data);

      const assistantMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: text,
        toolsUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === targetThreadId
            ? {
                ...conv,
                updatedAt: new Date().toISOString(),
                messages: [...conv.messages, assistantMessage],
              }
            : conv
        )
      );
    } catch (err) {
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        isError: true,
        failedPrompt: trimmed,
        content: err.message || 'Failed to receive a response from the server.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === targetThreadId
            ? {
                ...conv,
                messages: [...conv.messages, errorMessage],
              }
            : conv
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  const toggleToolAccordion = (msgId) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Collapsible Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top New Chat Action */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isSending}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recent Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Recent Conversations
          </div>
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversation.id;
            return (
              <div
                key={conv.id}
                onClick={() => {
                  setActiveId(conv.id);
                  setSidebarOpen(false);
                }}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs cursor-pointer transition ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-75" />
                  <span className="truncate">{conv.title}</span>
                </div>
                {conversations.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteThread(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition"
                    title="Remove conversation from view"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* User Profile & Logout Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                  {user?.email || 'Authenticated Student'}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Verified Session
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Conversation Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Header */}
        <header className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h1 className="text-sm font-semibold truncate">
                {activeConversation.title}
              </h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-medium">
              Gemma (llama.cpp) + MCP Tools
            </span>
          </div>
        </header>

        {/* Scrollable Message Stream */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {activeConversation.messages.length === 0 ? (
              /* Welcome Screen with Example Prompts */
              <div className="py-12 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    University Government Dataset Assistant
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Ask questions about official Indian government datasets, regional trends, and public records. Queries are processed via the university backend using Gemma and Model Context Protocol (MCP) tools.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2 text-left">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isSending}
                      onClick={() => sendMessage(prompt)}
                      className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-2xs hover:shadow-sm transition flex flex-col justify-between gap-3"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-relaxed">
                        &ldquo;{prompt}&rdquo;
                      </span>
                      <span className="text-[11px] text-slate-400 group-hover:text-indigo-500 flex items-center gap-1">
                        Ask assistant &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                        : msg.isError
                        ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xs'
                    }`}
                  >
                    {/* Optional Expandable MCP Tool Usage Section */}
                    {msg.role === 'assistant' && Array.isArray(msg.toolsUsed) && msg.toolsUsed.length > 0 && (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={() => toggleToolAccordion(msg.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            MCP Tools Used ({msg.toolsUsed.length})
                          </span>
                          {expandedTools[msg.id] ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {expandedTools[msg.id] && (
                          <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1 overflow-x-auto">
                            {msg.toolsUsed.map((tool, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-indigo-500 select-none">&bull;</span>
                                <span className="break-all">
                                  {typeof tool === 'string' ? tool : JSON.stringify(tool)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                    {/* Message Footer Actions (Copy / Retry / Timestamp) */}
                    <div
                      className={`mt-2.5 pt-2 border-t flex items-center justify-between gap-4 text-[11px] ${
                        msg.role === 'user'
                          ? 'border-indigo-500/40 text-indigo-100'
                          : msg.isError
                          ? 'border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400'
                          : 'border-slate-100 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>

                      {msg.role === 'assistant' && !msg.isError && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy response</span>
                            </>
                          )}
                        </button>
                      )}

                      {msg.isError && msg.failedPrompt && (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => sendMessage(msg.failedPrompt, msg.id)}
                          className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-300 hover:underline disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry request</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Loading / Typing Indicator */}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-2xs flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <RefreshCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  <span>Querying government datasets &amp; generating response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Bottom Message Composer */}
        <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition">
              <textarea
                ref={textareaRef}
                rows={1}
                disabled={isSending}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about government datasets (e.g., road accidents in Maharashtra)..."
                className="flex-1 max-h-40 px-2.5 py-1.5 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none disabled:opacity-60"
              />
              <button
                type="button"
                disabled={isSending || !input.trim()}
                onClick={() => sendMessage(input)}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:pointer-events-none transition shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Press Enter to send, Shift + Enter for a new line</span>
              <span>Responses come directly from the university backend</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
