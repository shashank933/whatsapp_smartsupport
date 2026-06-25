import React, { useState, useEffect, useRef } from "react";
import {
  Send, Bot, Sparkles, Plus, Trash, Check, Settings, Phone,
  AlertCircle, Terminal, Search, X, MessageSquare, RefreshCw,
  BookOpen, Cpu, CheckSquare, LogIn, Eye, EyeOff, Lock, LogOut,
  LayoutDashboard, CalendarDays, Users, Clock
} from "lucide-react";
import {
  WhatsAppConfig, BusinessProfile, FAQItem, ChatThread,
  ChatMessage, CannedResponse, WebhookLog, Contact
} from "./types";

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setTimeout(() => {
      if (username === "admin" && password === "admin123") {
        onLogin();
      } else {
        setError("Invalid username or password. Please try again.");
      }
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 mb-4 shadow-lg shadow-cyan-500/20">
            <span className="text-3xl">🦷</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bright Smile</h1>
          <p className="text-xs text-slate-400 mt-1">WhatsApp AI Agent Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-slate-200">Agent Login</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Sign in to access the dashboard</p>
          </div>
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><Lock className="w-3.5 h-3.5" /></span>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" autoFocus
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><Lock className="w-3.5 h-3.5" /></span>
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-semibold rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/10">
            {isLoading ? <><LoaderIcon className="w-4 h-4 animate-spin" /><span>Signing in...</span></> : <><LogIn className="w-4 h-4" /><span>Sign In</span></>}
          </button>
          <p className="text-center text-[10px] text-slate-600">Bright Smile Dental Clinic · Salmiya, Kuwait</p>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'faqs' | 'settings' | 'simulator' | 'logs'>('simulator');

  const [llmProvider, setLlmProvider] = useState<string>("gemini");
  const [isLlmSaving, setIsLlmSaving] = useState(false);

  const [profile, setProfile] = useState<BusinessProfile>({
    name: "Bright Smile Dental Clinic", industry: "Dental Care", replyTone: "supportive",
    systemContext: "Bright Smile Dental Clinic is a trusted dental practice in Salmiya, Kuwait. We are open Saturday to Thursday, 9 AM to 9 PM. Closed Friday. Services: Check-up 15 KWD, Cleaning 25 KWD, Whitening 80 KWD, Filling from 30 KWD. We NEVER give medical or clinical advice — patients must see a dentist in person. For emergencies, direct to hospital ER and flag for human follow-up. Reply in Arabic or English depending on the patient's language.",
    autoReplyEnabled: true, minConfidence: 0.70
  });

  const [waConfig, setWaConfig] = useState<WhatsAppConfig>({ phoneNumberId: "", businessAccountId: "", accessToken: "", verifyToken: "bright_smile_verify_secure_token" });
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadStatusFilter, setThreadStatusFilter] = useState<'active' | 'resolved'>('active');
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [showDashboard, setShowDashboard] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [threadSearch, setThreadSearch] = useState("");
  const [composeText, setComposeText] = useState("");
  const [faqQuestion, setFaqQuestion] = useState(""); const [faqAnswer, setFaqAnswer] = useState(""); const [faqKeywords, setFaqKeywords] = useState("");
  const [cannedShortcut, setCannedShortcut] = useState(""); const [cannedText, setCannedText] = useState("");
  const [simPhone, setSimPhone] = useState("+965 5551-2345"); const [simName, setSimName] = useState("Fatima Al-Ali");
  const [simMessage, setSimMessage] = useState("Hi, my name is Fatima. I'd like to book a check-up for Sunday at 10 AM.");
  const [isSimulatingMessage, setIsSimulatingMessage] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false); const [isSending, setIsSending] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false); const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [testSheetContent, setTestSheetContent] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  useEffect(() => { selectedThreadIdRef.current = selectedThreadId; }, [selectedThreadId]);

  useEffect(() => {
    fetchProfile(); fetchWhatsAppConfig(); fetchFAQs(); fetchCannedResponses(); fetchThreads(); fetchLogs(); fetchLlmProvider(); fetchBaseUrl();
    fetchDocForSystemContext(); fetchTestSheet();

    const evtSource = new EventSource("/api/events");
    evtSource.addEventListener("refresh", () => {
      fetchThreads(true);
      fetchLogs();
      const currentThread = selectedThreadIdRef.current;
      if (currentThread) fetchMessages(currentThread);
    });
    evtSource.onerror = () => {};

    const pollInterval = setInterval(() => {
      fetchThreads(true);
      fetchLogs();
      const currentThread = selectedThreadIdRef.current;
      if (currentThread) fetchMessages(currentThread);
    }, 30000);

    return () => {
      evtSource.close();
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => { if (selectedThreadId) fetchMessages(selectedThreadId); else setMessages([]); }, [selectedThreadId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const triggerNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ type, text }); setTimeout(() => setActionNotice(null), 3500);
  };

  const fetchProfile = async () => { try { const res = await fetch("/api/profile"); if (res.ok) setProfile(await res.json()); } catch (e) { console.error(e); } };
  const fetchWhatsAppConfig = async () => { try { const res = await fetch("/api/whatsapp-config"); if (res.ok) setWaConfig(await res.json()); } catch (e) { console.error(e); } };
  const fetchFAQs = async () => { try { const res = await fetch("/api/faqs"); if (res.ok) setFaqs(await res.json()); } catch (e) { console.error(e); } };
  const fetchCannedResponses = async () => { try { const res = await fetch("/api/canned-responses"); if (res.ok) setCannedResponses(await res.json()); } catch (e) { console.error(e); } };
  const fetchAppointments = async () => { try { const res = await fetch("/api/appointments"); if (res.ok) setAppointments(await res.json()); } catch (e) { console.error(e); } };
  const fetchContacts = async () => { try { const res = await fetch("/api/contacts"); if (res.ok) setContacts(await res.json()); } catch (e) { console.error(e); } };
  const fetchThreads = async (isBackground = false) => { try { const res = await fetch("/api/threads"); if (res.ok) { const data = await res.json() as ChatThread[]; setThreads(data); const currentId = selectedThreadIdRef.current; if (!currentId && data.length > 0 && !isBackground) setSelectedThreadId(data[0].id); } } catch (e) { console.error(e); } };
  const fetchMessages = async (threadId: string) => { setIsLoadingMessages(true); try { const res = await fetch(`/api/threads/${threadId}/messages`); if (res.ok) setMessages(await res.json()); } catch (e) { console.error(e); } finally { setIsLoadingMessages(false); } };
  const fetchLogs = async () => { try { const res = await fetch("/api/webhook-logs"); if (res.ok) setWebhookLogs(await res.json()); } catch (e) { console.error(e); } };
  const fetchLlmProvider = async () => { try { const res = await fetch("/api/llm-provider"); if (res.ok) { const data = await res.json(); setLlmProvider(data.provider); } } catch (e) { console.error(e); } };
  const fetchBaseUrl = async () => { try { const res = await fetch("/api/app-url"); if (res.ok) { const data = await res.json(); setBaseUrl(data.url); } } catch (e) { console.error(e); } };
  const fetchDocForSystemContext = async () => { try { const res = await fetch("/api/docs/prompt-behavior-rules.md"); if (res.ok) { const doc = await res.text(); if (doc) setProfile((p) => ({ ...p, systemContext: doc })); } } catch (e) { console.error(e); } };
  const fetchTestSheet = async () => { try { const res = await fetch("/api/docs/test-sheet.md"); if (res.ok) setTestSheetContent(await res.text()); } catch (e) { console.error(e); } };
  const saveTestSheet = async () => { try { const res = await fetch("/api/docs/test-sheet.md", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: testSheetContent }) }); if (res.ok) triggerNotification("Test sheet saved!"); else triggerNotification("Failed to save test sheet.", "error"); } catch (e) { triggerNotification("Error saving test sheet.", "error"); } };

  const saveProfileHandler = async () => {
    setIsProfileSaving(true);
    try { const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }); if (res.ok) triggerNotification("Business AI Profile updated!"); else triggerNotification("Failed to update profile.", "error"); } catch (e) { triggerNotification("Error updating profile.", "error"); } finally { setIsProfileSaving(false); }
  };

  const saveWhatsAppConfigHandler = async () => {
    setIsConfigSaving(true);
    try { const res = await fetch("/api/whatsapp-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(waConfig) }); if (res.ok) triggerNotification("Meta settings active!"); else triggerNotification("Failed to update Meta settings.", "error"); } catch (e) { triggerNotification("Error updating config.", "error"); } finally { setIsConfigSaving(false); }
  };

  const saveLlmProvider = async () => {
    setIsLlmSaving(true);
    try { const res = await fetch("/api/llm-provider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: llmProvider }) }); if (res.ok) triggerNotification("LLM provider updated!"); else triggerNotification("Failed to update LLM provider.", "error"); } catch (e) { triggerNotification("Error updating LLM provider.", "error"); } finally { setIsLlmSaving(false); }
  };

  const addFAQHandler = async (e: React.FormEvent) => {
    e.preventDefault(); if (!faqQuestion || !faqAnswer) return;
    try { const kwArray = faqKeywords.split(",").map(k => k.trim()).filter(k => k.length > 0); const res = await fetch("/api/faqs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: faqQuestion, answer: faqAnswer, keywords: kwArray }) }); if (res.ok) { setFaqQuestion(""); setFaqAnswer(""); setFaqKeywords(""); fetchFAQs(); triggerNotification("FAQ created!"); } } catch (e) { console.error(e); }
  };

  const deleteFAQHandler = async (id: string) => { try { await fetch(`/api/faqs/${id}`, { method: "DELETE" }); fetchFAQs(); triggerNotification("FAQ deleted."); } catch (e) { console.error(e); } };
  const addCannedHandler = async (e: React.FormEvent) => { e.preventDefault(); if (!cannedShortcut || !cannedText) return; try { const res = await fetch("/api/canned-responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shortcut: cannedShortcut, text: cannedText }) }); if (res.ok) { setCannedShortcut(""); setCannedText(""); fetchCannedResponses(); triggerNotification("Shortcut created!"); } } catch (e) { console.error(e); } };
  const deleteCannedHandler = async (id: string) => { try { await fetch(`/api/canned-responses/${id}`, { method: "DELETE" }); fetchCannedResponses(); triggerNotification("Shortcut deleted."); } catch (e) { console.error(e); } };

  const toggleThreadAutoReply = async (threadId: string, currentVal: boolean) => { try { const res = await fetch(`/api/threads/${threadId}/auto-reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !currentVal }) }); if (res.ok) { fetchThreads(true); triggerNotification(`Auto-responder ${!currentVal ? "enabled" : "suspended"}.`); } } catch (e) { console.error(e); } };
  const changeThreadStatus = async (threadId: string, status: 'open' | 'pending' | 'resolved') => { try { const res = await fetch(`/api/threads/${threadId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); if (res.ok) { fetchThreads(true); triggerNotification(`Thread marked as ${status}.`); } } catch (e) { console.error(e); } };

  const toggleThreadSelection = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThreadIds(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId); else next.add(threadId);
      return next;
    });
  };
  const selectAllThreads = () => {
    if (selectedThreadIds.size === filteredThreads.length) {
      setSelectedThreadIds(new Set());
    } else {
      setSelectedThreadIds(new Set(filteredThreads.map(t => t.id)));
    }
  };
  const bulkResolve = async () => {
    const ids = Array.from(selectedThreadIds);
    try { const res = await fetch("/api/threads/bulk/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadIds: ids, status: "resolved" }) }); if (res.ok) { setSelectedThreadIds(new Set()); fetchThreads(true); triggerNotification(`${ids.length} threads resolved.`); } } catch (e) { triggerNotification("Bulk resolve failed.", "error"); }
  };
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedThreadIds.size} threads? This cannot be undone.`)) return;
    const ids = Array.from(selectedThreadIds);
    try { const res = await fetch("/api/threads/bulk/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadIds: ids }) }); if (res.ok) { setSelectedThreadIds(new Set()); setSelectedThreadId(null); setMessages([]); fetchThreads(true); triggerNotification(`${ids.length} threads deleted.`); } } catch (e) { triggerNotification("Bulk delete failed.", "error"); }
  };

  const handleSendManualMessage = async (e: React.FormEvent) => { e.preventDefault(); if (!selectedThreadId || !composeText.trim()) return; setIsSending(true); try { const res = await fetch(`/api/threads/${selectedThreadId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: composeText }) }); if (res.ok) { setComposeText(""); fetchMessages(selectedThreadId); fetchThreads(true); triggerNotification("Response dispatched."); } } catch (e) { console.error(e); } finally { setIsSending(false); } };

  const triggerAIDraftGeneration = async () => { if (!selectedThreadId) return; setIsDrafting(true); try { const res = await fetch(`/api/threads/${selectedThreadId}/draft`, { method: "POST" }); if (res.ok) { const data = await res.json(); setComposeText(data.draftText); triggerNotification("AI draft loaded!"); } else triggerNotification("Unable to generate AI response.", "error"); } catch (e) { triggerNotification("Server communication failure.", "error"); } finally { setIsDrafting(false); } };

  const handleSimulateInbound = async (e: React.FormEvent) => { e.preventDefault(); if (!simPhone || !simName || !simMessage.trim()) return; setIsSimulatingMessage(true); try { const res = await fetch("/api/simulate-incoming", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerPhone: simPhone, customerName: simName, messageText: simMessage }) }); if (res.ok) { const data = await res.json(); setSelectedThreadId(data.thread.id); fetchThreads(true); fetchMessages(data.thread.id); fetchLogs(); setSimMessage(""); triggerNotification(data.triggeredAutoReply ? "Simulated! AI Auto-Responded." : "Simulated! Draft saved for review."); } } catch (e) { triggerNotification("Simulation failure.", "error"); } finally { setIsSimulatingMessage(false); } };

  const filteredThreads = threads.filter(t => {
    const isStatusMatch = threadStatusFilter === 'active' ? (t.status === 'open' || t.status === 'pending') : t.status === 'resolved';
    const isSearchMatch = t.customerName.toLowerCase().includes(threadSearch.toLowerCase()) || t.customerPhone.includes(threadSearch) || t.lastMessageText.toLowerCase().includes(threadSearch.toLowerCase());
    return isStatusMatch && isSearchMatch;
  });
  const selectedThread = threads.find(t => t.id === selectedThreadId);

  const loadSimulatorPreset = (type: string) => {
    if (type === 'booking') { setSimPhone("+965 5551-2345"); setSimName("Fatima Al-Ali"); setSimMessage("Hi, my name is Fatima. I'd like to book a check-up for Sunday at 10 AM."); }
    else if (type === 'arabic') { setSimPhone("+965 9988-7766"); setSimName("Mohammed Al-Rashed"); setSimMessage("السلام عليكم، كم سعر تبييض الأسنان؟"); }
    else if (type === 'arabicBooking') { setSimPhone("+965 5551-9876"); setSimName("Fatima"); setSimMessage("مرحباً، اسمي فاطمة. أود حجز موعد للفحص يوم الأحد الساعة العاشرة صباحاً"); }
    else if (type === 'medical') { setSimPhone("+965 6677-8899"); setSimName("Noor Al-Sabah"); setSimMessage("I have pain in my gums since 2 weeks, do you think I need antibiotics?"); }
    else if (type === 'emergency') { setSimPhone("+965 5123-4567"); setSimName("Karim Hassan"); setSimMessage("Help! My tooth just broke and I am bleeding a lot, it hurts so bad."); }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 font-sans text-slate-100 overflow-hidden">
      {/* TOP NAV BAR */}
      <div className="h-11 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-500 text-slate-950 p-1 rounded-md flex items-center justify-center font-bold"><Phone className="w-3.5 h-3.5" /></div>
            <span className="font-semibold text-sm tracking-tight text-white">🦷 Bright Smile</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">WhatsApp AI Agent Portal</span>
          <button
            onClick={() => { setShowDashboard(!showDashboard); if (!showDashboard) { fetchAppointments(); fetchContacts(); } }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded transition ${showDashboard ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <LayoutDashboard className="w-3 h-3" />
            <span>Dashboard</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)} onBlur={saveLlmProvider} className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500">
            <option value="gemini">Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="rule">Rule-Based</option>
          </select>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition">
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {!showDashboard ? (<>
      {/* MAIN 3-COLUMN LAYOUT */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL: CHAT LIST */}
      <div className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-500 text-slate-950 p-1.5 rounded-lg flex items-center justify-center font-bold"><Phone className="w-4 h-4" /></div>
            <div><h1 className="font-semibold text-sm tracking-tight text-white m-0">🦷 Bright Smile</h1><span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>ACTIVE</span></div>
          </div>
          <button onClick={() => { fetchThreads(); fetchLogs(); triggerNotification("Dashboard refreshed."); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="relative"><span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500"><Search className="w-3.5 h-3.5" /></span><input type="text" placeholder="Search patient or number..." value={threadSearch} onChange={(e) => setThreadSearch(e.target.value)} className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" /></div>
          <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
            <button onClick={() => setThreadStatusFilter('active')} className={`py-1 text-[11px] font-medium rounded transition ${threadStatusFilter === 'active' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Active ({threads.filter(t => t.status === 'open' || t.status === 'pending').length})</button>
            <button onClick={() => setThreadStatusFilter('resolved')} className={`py-1 text-[11px] font-medium rounded transition ${threadStatusFilter === 'resolved' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Resolved ({threads.filter(t => t.status === 'resolved').length})</button>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
            <input type="checkbox" checked={selectedThreadIds.size > 0 && selectedThreadIds.size === filteredThreads.length} onChange={selectAllThreads} className="w-3 h-3 accent-cyan-500 rounded" />
            Select All ({filteredThreads.length})
          </label>
        </div>
        {selectedThreadIds.size > 0 && (
          <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <span className="text-[10px] text-amber-400 font-medium">{selectedThreadIds.size} selected</span>
            <button onClick={bulkResolve} className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition">Resolve</button>
            <button onClick={bulkDelete} className="px-2.5 py-1 text-[10px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded transition">Delete</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900">
          {filteredThreads.length === 0 ? (<div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2"><MessageSquare className="w-8 h-8 text-slate-700 stroke-1" /><span>No conversations</span></div>) : (
            filteredThreads.map(t => {
              const isActive = selectedThreadId === t.id;
              return (<div key={t.id} onClick={() => setSelectedThreadId(t.id)} className={`p-3.5 cursor-pointer transition flex gap-2 hover:bg-slate-900 ${isActive ? "bg-slate-900 border-l-2 border-cyan-500" : ""}`}>
                <input type="checkbox" checked={selectedThreadIds.has(t.id)} onClick={(e) => toggleThreadSelection(t.id, e)} onChange={() => {}} className="w-3 h-3 mt-1 accent-cyan-500 rounded shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1 min-w-0"><div className="flex justify-between items-start"><div className="font-semibold text-xs text-slate-200 truncate max-w-[110px]">{t.customerName}</div><span className="text-[10px] text-slate-500 font-mono">{formatTime(t.lastMessageTime)}</span></div><div className="text-[10px] text-slate-400 font-mono flex items-center justify-between"><span>{t.customerPhone}</span>{t.status === 'pending' ? <span className="px-1 text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">PENDING</span> : t.status === 'open' ? <span className="px-1 text-[8px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">OPEN</span> : <span className="px-1 text-[8px] bg-slate-800 text-slate-400 rounded">RESOLVED</span>}</div><div className="text-xs text-slate-400 line-clamp-1 break-all">{t.lastMessageText}</div><div className="flex justify-between items-center mt-1"><span className={`text-[9px] font-semibold px-1 rounded flex items-center gap-0.5 ${t.autoReplyActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}><Bot className="w-2.5 h-2.5" />{t.autoReplyActive ? 'AI Bot On' : 'Agent Only'}</span>{t.unreadCount! > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500" />}</div></div></div>);
            })
          )}
        </div>
        <div className="p-3 bg-slate-950 border-t border-slate-900 text-[10px] text-slate-500 flex items-center justify-between"><span className="truncate">Bright Smile Dental — Salmiya, Kuwait</span><span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 uppercase font-mono">v1.0</span></div>
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 bg-slate-900 flex flex-col h-full min-w-0">
        {selectedThread ? (<>
          <div className="p-4 bg-slate-950/75 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center border border-cyan-500/30 text-white font-medium text-xs">{selectedThread.customerName.charAt(0)}</div><div><div className="flex items-center gap-2"><h2 className="font-semibold text-sm text-white m-0">{selectedThread.customerName}</h2><span className="text-xs text-slate-400 font-mono">({selectedThread.customerPhone})</span></div><div className="flex items-center gap-2 mt-0.5 text-[10px]"><span className="text-slate-500">Status:</span><select value={selectedThread.status} onChange={(e) => changeThreadStatus(selectedThread.id, e.target.value as any)} className="bg-slate-900 border border-slate-800 rounded text-slate-300 px-1 py-0.5 text-[10px] focus:outline-none"><option value="open">🟢 Open</option><option value="pending">🟡 Pending</option><option value="resolved">⚪ Resolved</option></select></div></div></div>
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"><div className="text-right"><div className="text-[10px] font-semibold text-white">Auto-Reply</div><div className="text-[9px] text-slate-400 font-mono">{selectedThread.autoReplyActive ? "AI listening" : "Human mode"}</div></div><button onClick={() => toggleThreadAutoReply(selectedThread.id, selectedThread.autoReplyActive)} className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${selectedThread.autoReplyActive ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-lg transform transition-transform duration-200 ${selectedThread.autoReplyActive ? 'translate-x-4' : 'translate-x-0'}`} /></button></div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/40">
            {isLoadingMessages ? (<div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-slate-500"><RefreshCw className="w-5 h-5 animate-spin text-cyan-500" /><span>Loading messages...</span></div>) : messages.length === 0 ? (<div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-full"><Bot className="w-12 h-12 text-slate-700 mb-2 animate-bounce" /><p className="font-semibold text-slate-400">Empty Chat Room</p><p className="max-w-xs mt-1 text-slate-500">Use the Simulator tab to send a test message.</p></div>) : (
              messages.map((m) => {
                const isAgent = m.sender === 'agent';
                if (m.sender === 'system') return (<div key={m.id} className="flex justify-center text-[10px] text-slate-500 font-mono"><span className="bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-800">{m.content}</span></div>);
                return (<div key={m.id} className={`flex flex-col max-w-[75%] ${isAgent ? "ml-auto items-end" : "mr-auto items-start"}`}><div className="flex items-center gap-1 mb-0.5 text-[9px] text-slate-500 font-mono">{isAgent ? (<>{m.isAutoReplied ? (<span className="text-emerald-400 flex items-center gap-0.5"><Bot className="w-2.5 h-2.5" /> AI AUTO REPLY</span>) : (<span>HUMAN AGENT</span>)}<span>• {formatTime(m.timestamp)}</span></>) : (<><span>{selectedThread.customerName}</span><span>• {formatTime(m.timestamp)}</span></>)}</div><div className={`p-3 rounded-xl text-xs break-words ${isAgent ? m.isAutoReplied ? "bg-slate-950 text-slate-200 rounded-tr-none border border-emerald-500/20" : "bg-cyan-600 text-white rounded-tr-none" : "bg-slate-850 text-slate-100 rounded-tl-none border border-slate-800"}`}>{m.content}</div>{isAgent && m.isAutoReplied && m.aiConfidence !== undefined && (<div className="mt-1 bg-slate-950/75 p-2 rounded-lg border border-slate-800 max-w-[280px] text-[10px] text-slate-400"><div className="flex justify-between items-center border-b border-slate-800 pb-0.5 text-[8.5px] font-mono text-slate-500"><span className="flex items-center gap-0.5 text-emerald-400"><Cpu className="w-2.5 h-2.5" /> TELEMETRY</span><span>CONFIDENCE: {Math.round(m.aiConfidence * 100)}%</span></div><p className="italic text-slate-300 leading-tight mt-1">"{m.aiExplanation}"</p></div>)}{!isAgent && m.draftResponse && (<div className="mt-2 w-full bg-slate-950 border border-cyan-900/50 p-3 rounded-lg flex flex-col gap-2"><div className="flex items-center justify-between text-[9px] font-semibold text-cyan-400 font-mono"><span className="flex items-center gap-1"><Sparkles className="w-3 h-3 animate-pulse" /> AI SUGGESTED REPLY</span><span className="px-1 py-0.5 bg-slate-800 text-slate-400 rounded">Score: {Math.round((m.aiConfidence || 0) * 100)}%</span></div><p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">{m.draftResponse}</p><div className="flex items-center justify-between text-[10px] text-slate-500"><span className="italic truncate max-w-[200px]" title={m.aiExplanation}>💡 {m.aiExplanation}</span><button onClick={() => { setComposeText(m.draftResponse || ""); triggerNotification("Draft loaded."); }} className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 text-white font-medium text-[10px] rounded flex items-center gap-1 transition"><Check className="w-3 h-3" /> Apply</button></div></div>)}</div>);
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
            {cannedResponses.length > 0 && (<div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-[10px] text-slate-400 no-scrollbar"><span className="text-slate-500 whitespace-nowrap">⚡ Shortcuts:</span>{cannedResponses.map(c => (<button key={c.id} onClick={() => { setComposeText(c.text); triggerNotification("Canned text inserted"); }} className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded transition whitespace-nowrap">{c.shortcut}</button>))}</div>)}
            <form onSubmit={handleSendManualMessage} className="flex gap-2">
              <button type="button" disabled={isDrafting} onClick={triggerAIDraftGeneration} className="px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 rounded-lg flex items-center justify-center gap-1.5 text-xs transition min-w-[90px] disabled:opacity-50">{isDrafting ? <><LoaderIcon className="w-3.5 h-3.5 animate-spin" /><span>...</span></> : <><Sparkles className="w-3.5 h-3.5" /><span>AI Draft</span></>}</button>
              <input type="text" placeholder="Reply manually..." value={composeText} onChange={(e) => setComposeText(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 rounded-lg text-xs px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              <button type="submit" disabled={isSending || !composeText.trim()} className="px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center justify-center text-xs font-semibold gap-1.5 transition disabled:opacity-50">{isSending ? <LoaderIcon className="w-3.5 h-3.5 animate-spin" /> : <><span>Send</span><Send className="w-3.5 h-3.5" /></>}</button>
            </form>
          </div>
        </>) : (<div className="flex-1 flex flex-col items-center justify-center text-center p-8"><Bot className="w-16 h-16 text-cyan-500 stroke-1 mb-4" /><h2 className="text-lg font-bold text-white">Bright Smile Dental — WhatsApp Agent</h2><p className="text-xs text-slate-400 max-w-sm mt-1">Select a patient thread from the left panel, or use the Simulator tab to send a test message.</p></div>)}
      </div>

      {/* RIGHT PANEL */}
      <div className="w-[360px] border-l border-slate-800 bg-slate-950 flex flex-col h-full shrink-0">
        <div className="grid grid-cols-4 bg-slate-950 border-b border-slate-800 p-1">
          <button onClick={() => setActiveTab('simulator')} className={`py-2 text-[10px] font-semibold rounded transition flex flex-col items-center gap-0.5 ${activeTab === 'simulator' ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-white"}`}><Cpu className="w-3.5 h-3.5" />Simulator</button>
          <button onClick={() => setActiveTab('faqs')} className={`py-2 text-[10px] font-semibold rounded transition flex flex-col items-center gap-0.5 ${activeTab === 'faqs' ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-white"}`}><BookOpen className="w-3.5 h-3.5" />KB/FAQs</button>
          <button onClick={() => setActiveTab('settings')} className={`py-2 text-[10px] font-semibold rounded transition flex flex-col items-center gap-0.5 ${activeTab === 'settings' ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-white"}`}><Settings className="w-3.5 h-3.5" />Meta API</button>
          <button onClick={() => setActiveTab('logs')} className={`py-2 text-[10px] font-semibold rounded transition flex flex-col items-center gap-0.5 ${activeTab === 'logs' ? "bg-slate-900 text-cyan-400" : "text-slate-400 hover:text-white"}`}><Terminal className="w-3.5 h-3.5" />Logs</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'simulator' && (
            <div className="space-y-4">
              <div><h3 className="text-xs font-bold text-white tracking-wider uppercase mb-1">🦷 Patient Simulator</h3><p className="text-[11px] text-slate-400 leading-relaxed">Simulate incoming WhatsApp messages from patients. Test the AI agent's responses for bookings, Arabic queries, medical advice refusal, and emergencies.</p></div>
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800"><span className="text-[10px] font-semibold text-slate-400 block mb-1">🦷 Test Scenarios:</span><div className="grid grid-cols-2 gap-1.5"><button type="button" onClick={() => loadSimulatorPreset('booking')} className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-200 transition text-left leading-tight">📋 Normal Booking</button><button type="button" onClick={() => loadSimulatorPreset('arabic')} className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-200 transition text-left leading-tight">🇰🇼 Arabic Inquiry</button><button type="button" onClick={() => loadSimulatorPreset('arabicBooking')} className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-200 transition text-left leading-tight">👩🏽 Arabic Booking</button><button type="button" onClick={() => loadSimulatorPreset('medical')} className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-200 transition text-left leading-tight">🩺 Medical Advice</button><button type="button" onClick={() => loadSimulatorPreset('emergency')} className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-[10px] text-slate-200 transition text-left leading-tight">🚨 Emergency</button></div></div>
              <form onSubmit={handleSimulateInbound} className="space-y-3 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="grid grid-cols-2 gap-2"><div><label className="text-[9px] text-slate-400 font-mono uppercase block mb-1">Patient Name</label><input type="text" value={simName} onChange={(e) => setSimName(e.target.value)} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white" required /></div><div><label className="text-[9px] text-slate-400 font-mono uppercase block mb-1">Phone No</label><input type="text" value={simPhone} onChange={(e) => setSimPhone(e.target.value)} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono" required /></div></div>
                <div><label className="text-[9px] text-slate-400 font-mono uppercase block mb-1">Message Text</label><textarea rows={3} value={simMessage} onChange={(e) => setSimMessage(e.target.value)} className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded text-white placeholder-slate-600 focus:outline-none" required /></div>
                <button type="submit" disabled={isSimulatingMessage || !simMessage.trim()} className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded transition flex items-center justify-center gap-1.5 disabled:opacity-50">{isSimulatingMessage ? <><LoaderIcon className="w-3.5 h-3.5 animate-spin" /><span>Sending...</span></> : <><Send className="w-3.5 h-3.5" /><span>Dispatch Incoming WhatsApp</span></>}</button>
              </form>
            </div>
          )}
          {activeTab === 'faqs' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-3"><h4 className="text-[11px] font-bold text-white tracking-widest uppercase flex items-center gap-1 border-b border-slate-800 pb-1"><Cpu className="w-3.5 h-3.5" /> System Prompt</h4><div className="space-y-2.5 text-xs text-slate-300"><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Company Name</label><input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white" /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Tone</label><select value={profile.replyTone} onChange={(e) => setProfile({ ...profile, replyTone: e.target.value as any })} className="w-full text-xs px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"><option value="supportive">❤️ Supportive</option><option value="professional">💼 Professional</option><option value="friendly">😊 Friendly</option><option value="casual">🤙 Casual</option></select></div><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Threshold</label><select value={profile.minConfidence} onChange={(e) => setProfile({ ...profile, minConfidence: parseFloat(e.target.value) })} className="w-full text-xs px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"><option value="0.5">50%</option><option value="0.7">70%</option><option value="0.8">80%</option><option value="0.9">90%</option></select></div></div><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Business Description</label><textarea rows={3} value={profile.systemContext} onChange={(e) => setProfile({ ...profile, systemContext: e.target.value })} className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded text-white leading-relaxed" /></div><div className="flex items-center gap-2 pt-1 border-t border-slate-800"><input type="checkbox" id="enable_auto_reply_global" checked={profile.autoReplyEnabled} onChange={(e) => setProfile({ ...profile, autoReplyEnabled: e.target.checked })} className="rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-0" /><label htmlFor="enable_auto_reply_global" className="text-[10px] text-slate-400 select-none">Enable AI Auto-Replies globally</label></div><button type="button" onClick={saveProfileHandler} disabled={isProfileSaving} className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-xs transition">{isProfileSaving ? "Saving..." : "Update AI Guidelines"}</button></div></div>
              <div className="space-y-3"><h4 className="text-[11px] font-bold text-white tracking-widest uppercase">FAQ Fact Sheets ({faqs.length})</h4>
                <form onSubmit={addFAQHandler} className="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-2 text-xs"><div className="text-[10px] font-semibold text-slate-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5 text-cyan-400" /> New FAQ</div><div><input type="text" placeholder="Question" value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200" required /></div><div><textarea rows={2} placeholder="Answer" value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded text-slate-200" required /></div><div><input type="text" placeholder="Keywords (comma separated)" value={faqKeywords} onChange={(e) => setFaqKeywords(e.target.value)} className="w-full text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 font-mono" /></div><button type="submit" className="w-full py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded text-xs transition">Add FAQ</button></form>
                <div className="space-y-2">{faqs.map(f => (<div key={f.id} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs flex flex-col gap-1 relative group"><button onClick={() => deleteFAQHandler(f.id)} className="absolute right-2 top-2 p-1 bg-slate-950 md:opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 rounded transition"><Trash className="w-3 h-3" /></button><div className="font-bold text-slate-200 text-xs pr-6">❓ {f.question}</div><div className="text-slate-400 leading-relaxed text-[11px]">{f.answer}</div>{f.keywords && f.keywords.length > 0 && (<div className="flex flex-wrap gap-1 mt-1">{f.keywords.map((kw, i) => (<span key={i} className="text-[9px] bg-slate-950 text-slate-500 rounded font-mono px-1 py-0.5 border border-slate-800">#{kw}</span>))}</div>)}</div>))}</div>
              </div>
              <div className="space-y-3"><h4 className="text-[11px] font-bold text-white tracking-widest uppercase">Canned Shortcuts (⚡)</h4><form onSubmit={addCannedHandler} className="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-2 text-xs"><div className="grid grid-cols-2 gap-2"><input type="text" placeholder="Shortcut (/welcome)" value={cannedShortcut} onChange={(e) => setCannedShortcut(e.target.value)} className="w-full text-xs px-2 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-cyan-400" required /><button type="submit" className="py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs font-semibold">Save</button></div><div><input type="text" placeholder="Full response text..." value={cannedText} onChange={(e) => setCannedText(e.target.value)} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-300" required /></div></form><div className="divide-y divide-slate-800 bg-slate-900 rounded-lg border border-slate-800">{cannedResponses.map(c => (<div key={c.id} className="p-2 flex items-center justify-between text-xs hover:bg-slate-800/40"><div><span className="font-mono text-cyan-400 font-bold">{c.shortcut}: </span><span className="text-[10px] text-slate-400 break-all">{c.text}</span></div><button onClick={() => deleteCannedHandler(c.id)} className="text-slate-500 hover:text-slate-300 p-1"><X className="w-3 h-3" /></button></div>))}</div></div>
            </div>
          )}
          {activeTab === 'settings' && (<div className="space-y-4"><div><h3 className="text-xs font-bold text-white tracking-wider uppercase mb-1">WhatsApp Cloud API</h3><p className="text-[11px] text-slate-400 leading-relaxed">Connect live Meta WhatsApp credentials.</p></div><div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs"><span className="text-[10px] font-bold text-emerald-400 font-mono block">WEBHOOK URL:</span><div className="p-2 bg-slate-900 text-[10px] font-mono break-all select-all rounded border border-slate-800 text-slate-300">{(baseUrl || window.location.origin) + "/api/whatsapp/webhook"}</div></div><form onSubmit={(e) => { e.preventDefault(); saveWhatsAppConfigHandler(); }} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-3"><h4 className="text-[11px] font-bold text-white tracking-wider uppercase border-b border-slate-800 pb-1">API CREDENTIALS</h4><div className="space-y-3 text-xs text-slate-300"><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Phone Number ID</label><input type="text" value={waConfig.phoneNumberId} onChange={(e) => setWaConfig({ ...waConfig, phoneNumberId: e.target.value })} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white" /></div><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Business Account ID</label><input type="text" value={waConfig.businessAccountId} onChange={(e) => setWaConfig({ ...waConfig, businessAccountId: e.target.value })} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-white" /></div><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Verify Token</label><input type="text" value={waConfig.verifyToken} onChange={(e) => setWaConfig({ ...waConfig, verifyToken: e.target.value })} className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-orange-300 font-mono" /></div><div><label className="text-[9px] text-slate-400 font-mono block mb-1">Access Token</label><textarea rows={3} value={waConfig.accessToken} onChange={(e) => setWaConfig({ ...waConfig, accessToken: e.target.value })} className="w-full text-[10px] p-2 bg-slate-950 border border-slate-800 rounded text-slate-400 font-mono break-all" /></div><button type="submit" disabled={isConfigSaving} className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-xs transition">{isConfigSaving ? "Linking..." : "Link Meta Cloud"}</button></div></form>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
              <h4 className="text-[11px] font-bold text-white tracking-wider uppercase border-b border-slate-800 pb-1 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Test Sheet (test-sheet.md)</h4>
              <p className="text-[10px] text-slate-400">Test scenarios for the AI agent. Saved to <span className="text-cyan-400 font-mono">docs/test-sheet.md</span> on disk.</p>
              <textarea rows={8} value={testSheetContent} onChange={(e) => setTestSheetContent(e.target.value)} className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded text-white leading-relaxed font-mono" placeholder="Test cases..." />
              <button onClick={saveTestSheet} className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded transition">Save Test Sheet</button>
            </div>
          </div>)}
          {activeTab === 'logs' && (<div className="space-y-4"><div className="flex justify-between items-center bg-slate-900/40 p-2 rounded border border-slate-800"><div><h3 className="text-xs font-bold text-white tracking-wider uppercase">Webhook Logs</h3><span className="text-[10px] text-slate-400 font-mono">Poll: 6s</span></div><button onClick={() => { fetchLogs(); triggerNotification("Logs synced."); }} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded transition">Sync</button></div>{webhookLogs.length === 0 ? (<div className="p-8 text-center text-slate-600 text-[11px] font-mono">No events logged.</div>) : (<div className="space-y-2">{webhookLogs.map(l => (<div key={l.id} className="p-2.5 bg-slate-950/80 rounded border border-slate-800 space-y-1.5 text-[10.5px]"><div className="flex justify-between items-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-mono leading-none ${l.direction === 'inbound' ? 'bg-indigo-500/15 text-indigo-400' : l.direction === 'outbound' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{l.direction.toUpperCase()}</span><span className="text-[9px] text-slate-500 font-mono">{formatTime(l.timestamp)}</span></div><div className="font-bold text-slate-300">{l.type}</div><div className="text-slate-400 leading-normal">{l.summary}</div></div>))}</div>)}</div>)}
          </div>
       </div>
      </div>
      {/* closes main 3-col layout */}
      </>) : (
        <DashboardView threads={threads} appointments={appointments} contacts={contacts} onRefresh={() => { fetchThreads(true); fetchAppointments(); fetchContacts(); }} onClose={() => setShowDashboard(false)} />
      )}
      {actionNotice && (<div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-2xl border transition-all flex items-center gap-2 max-w-sm ${actionNotice.type === 'success' ? 'bg-slate-900 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-rose-400 border-rose-500/30'}`}>{actionNotice.type === 'success' ? <CheckSquare className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span className="text-xs font-medium">{actionNotice.text}</span></div>)}
    </div>
  );
}

function DashboardView({ threads, appointments, contacts, onRefresh, onClose }: { threads: ChatThread[]; appointments: any[]; contacts: any[]; onRefresh: () => void; onClose: () => void }) {
  const [enquiryFilter, setEnquiryFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const activeThreads = threads.filter(t => t.status === 'open' || t.status === 'pending');
  const resolvedThreads = threads.filter(t => t.status === 'resolved');

  const handleRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };
  const todayDate = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const filteredEnquiries = threads.filter(t => {
    if (enquiryFilter === 'all') return true;
    return t.status === enquiryFilter;
  });

  const tabBtn = (value: typeof enquiryFilter, label: string, count: number) => (
    <button
      onClick={() => setEnquiryFilter(value)}
      className={`py-1 px-2.5 text-[10px] font-medium rounded transition ${enquiryFilter === value ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
    >{label} ({count})</button>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-6 space-y-6 bg-slate-900/50">
      <div className="shrink-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Dashboard</h1>
          <p className="text-xs text-slate-400">{todayDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing} className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition flex items-center gap-1 disabled:opacity-50">
            {refreshing ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Refresh
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded transition">Back to Chats</button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400 text-[10px]"><MessageSquare className="w-3.5 h-3.5" />Total Threads</div>
          <div className="text-2xl font-bold text-white">{threads.length}</div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-cyan-400 text-[10px]"><Clock className="w-3.5 h-3.5" />Active</div>
          <div className="text-2xl font-bold text-cyan-400">{activeThreads.length}</div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400 text-[10px]"><Check className="w-3.5 h-3.5" />Resolved</div>
          <div className="text-2xl font-bold text-slate-300">{resolvedThreads.length}</div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-emerald-400 text-[10px]"><CalendarDays className="w-3.5 h-3.5" />Appointments</div>
          <div className="text-2xl font-bold text-emerald-400">{appointments.length}</div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-amber-400 text-[10px]"><Users className="w-3.5 h-3.5" />Contacts</div>
          <div className="text-2xl font-bold text-amber-400">{contacts.length}</div>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col overflow-y-auto">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-emerald-400" />Appointments</h2>
          <div className="space-y-2">
            {appointments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No appointments booked yet.</p>
            ) : (
              appointments.map((a: any) => (
                <div key={a.id} className={`flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border ${a.status === 'cancelled' ? 'border-rose-500/20 opacity-60' : 'border-slate-800'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">{a.customerName}</span>
                      {a.status === 'cancelled' && <span className="text-[9px] px-1 py-0.5 bg-rose-500/10 text-rose-400 rounded">CANCELLED</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{a.customerPhone}</div>
                    <div className="text-[10px] text-slate-500">{a.serviceType}</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-xs font-semibold text-emerald-400">{a.preferredDay}</div>
                    <div className="text-[10px] text-slate-400">{a.preferredTime}</div>
                    {a.status === 'confirmed' && (
                      <div className="flex gap-1 mt-1">
                        <button onClick={async (e) => { e.stopPropagation(); await fetch(`/api/appointments/${a.id}/cancel`, { method: 'POST' }); onRefresh(); }} className="text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded transition">Cancel</button>
                        <button onClick={async (e) => { e.stopPropagation(); if (confirm('Delete this appointment?')) { await fetch(`/api/appointments/${a.id}`, { method: 'DELETE' }); onRefresh(); } }} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded transition">Delete</button>
                      </div>
                    )}
                    {a.status === 'cancelled' && (
                      <div className="flex gap-1 mt-1 justify-end">
                        <button onClick={async (e) => { e.stopPropagation(); if (confirm('Delete this appointment?')) { await fetch(`/api/appointments/${a.id}`, { method: 'DELETE' }); onRefresh(); } }} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded transition">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col overflow-y-auto">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-cyan-400" />Enquiries</h2>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 mb-3">
            {tabBtn('all', 'All', threads.length)}
            {tabBtn('open', 'Open', threads.filter(t => t.status === 'open').length)}
            {tabBtn('pending', 'Pending', threads.filter(t => t.status === 'pending').length)}
            {tabBtn('resolved', 'Resolved', resolvedThreads.length)}
          </div>
          <div className="space-y-2">
            {filteredEnquiries.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No {enquiryFilter === 'all' ? 'enquiries' : enquiryFilter} enquiries.</p>
            ) : (
              filteredEnquiries.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{t.customerName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{t.lastMessageText}</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${t.status === 'open' ? 'bg-cyan-500/10 text-cyan-400' : t.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>{t.status.toUpperCase()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col overflow-y-auto">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" />Contacts</h2>
          <div className="space-y-2">
            {contacts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No contacts yet. Contacts are auto-created when customers message.</p>
            ) : (
              contacts.slice(0, 12).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">{c.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{c.phone}</div>
                  </div>
                  <div className="text-[10px] text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  return isLoggedIn ? <Dashboard onLogout={() => setIsLoggedIn(false)} /> : <LoginPage onLogin={() => setIsLoggedIn(true)} />;
}

function LoaderIcon({ className }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
}