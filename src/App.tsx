import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  FileUp,
  ChevronDown,
  ShieldCheck,
  Search,
  Settings2,
  Zap,
  Globe,
  Database,
  Layers,
  Save,
  BarChart3,
  ListFilter,
  ChevronRight,
  Maximize2,
  Minimize2,
  Crown,
  AlertCircle,
  Languages
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Translation System
const translations = {
  en: {
    title: "AI Key Validator",
    proEdition: "Pro Edition",
    results: "Results",
    analytics: "Analytics",
    scanning: "Scanning",
    standby: "Standby",
    sourceDataset: "Source Dataset",
    selectFile: "SELECT DATA FILE",
    column: "Column",
    provider: "Provider",
    validationEngine: "Validation Engine",
    autoDetect: "Auto-Detect",
    quotaAudit: "Quota Audit",
    modelAccess: "Model Access",
    autoDetectDesc: "Automatically identifies the provider (OpenAI, Gemini, etc.) and analyzes the key format.",
    quotaAuditDesc: "Performs a deep scan of remaining credit, expiration dates, and usage limits.",
    modelAccessDesc: "Verifies access to flagship high-tier models like GPT-4o and Claude 3.5 Sonnet.",
    proxyNode: "Proxy Node (Optional)",
    proxyPlaceholder: "http://ip:port or user:pass@ip:port",
    startValidation: "Start Validation",
    stopScanning: "Stop Scanning",
    all: "All",
    valid: "Valid",
    flagship: "Flagship",
    failed: "Failed",
    expandAll: "Expand All",
    collapseAll: "Collapse All",
    saveSuccess: "Save Success CSV",
    detailedStatus: "Detailed Status",
    usageQuota: "Usage & Quota",
    authorizedModels: "Authorized Models",
    noModelData: "No model data available. Enable 'Model Access' audit.",
    engineStandby: "Engine Standby",
    efficiencyCore: "Efficiency Core",
    successRate: "Success Rate",
    nodeMetrics: "Node Metrics",
    flagshipDensity: "Flagship Density",
    validationLatency: "Validation Latency",
    engineIntegrity: "Engine Integrity",
    assetMatrix: "Asset Quality Matrix",
    assetMsg1: "System has verified ",
    assetMsg2: " high-tier flagship assets. Your API infrastructure is rated as ",
    elite: "ELITE",
    optimal: "OPTIMAL",
    active: "Active",
    flagshipTier: "Flagship Tier",
    keys: "KEYS",
    searchPlaceholder: "Search results...",
    information: "Information",
    providersBreakdown: "Providers & Domains Breakdown",
    domain: "Domain Focus"
  },
  ar: {
    title: "متحقق المفاتيح",
    proEdition: "نسخة المحترفين",
    results: "النتائج",
    analytics: "التحليلات",
    scanning: "جاري الفحص",
    standby: "خمول",
    sourceDataset: "مصدر البيانات",
    selectFile: "اختر ملف البيانات",
    column: "العمود",
    provider: "المزود",
    validationEngine: "محرك التحقق",
    autoDetect: "تعرف تلقائي",
    quotaAudit: "فحص الكوتا",
    modelAccess: "دخول النماذج",
    autoDetectDesc: "يتعرف تلقائياً على المزود (OpenAI, Gemini..) ويحلل صيغة المفتاح.",
    quotaAuditDesc: "فحص عميق للرصيد المتبقي، تواريخ الانتهاء، وحدود الاستهلاك.",
    modelAccessDesc: "يتحقق من النماذج الرائدة (Flagship) مثل GPT-4o و Claude 3.5 Sonnet.",
    proxyNode: "بروكسي (اختياري)",
    proxyPlaceholder: "http://ip:port أو user:pass@ip:port",
    startValidation: "بدء التحقق",
    stopScanning: "إيقاف الفحص",
    all: "الكل",
    valid: "صالح",
    flagship: "فلاجشيب",
    failed: "فاشل",
    expandAll: "توسيع الكل",
    collapseAll: "إغلاق الكل",
    saveSuccess: "حفظ كـ CSV",
    detailedStatus: "الحالة المفصلة",
    usageQuota: "الاستهلاك والكوتا",
    authorizedModels: "النماذج المتاحة",
    noModelData: "لا توجد بيانات نماذج. فعل فحص 'دخول النماذج'.",
    engineStandby: "المحرك في وضع الخمول",
    efficiencyCore: "نواة الكفاءة",
    successRate: "نسبة النجاح",
    nodeMetrics: "مقاييس العقد",
    flagshipDensity: "كثافة الفلاجشيب",
    validationLatency: "سرعة الاستجابة",
    engineIntegrity: "سلامة المحرك",
    assetMatrix: "مصفوفة جودة الأصول",
    assetMsg1: "قام النظام بتمحيص ",
    assetMsg2: " من أصول الفلاجشيب. بنية الـ API التابعة لك تصنف كـ ",
    elite: "نخبوية",
    optimal: "مثالية",
    active: "نشط",
    flagshipTier: "فئة فلاجشيب",
    keys: "مفتاح",
    searchPlaceholder: "بحث في النتائج...",
    information: "معلومات",
    providersBreakdown: "البروفايدرز والمجالات",
    domain: "مجال التخصص"
  }
};

interface FileData {
  headers: string[];
  rows: string[][];
  row_count: number;
  path: string;
}

interface TestResult {
  uid: string;
  key: string;
  provider: string;
  status: string;
  message: string;
  quota?: string;
  models?: string[];
  details?: string;
}

const PROVIDERS = [
  "OpenAI", "Anthropic", "Google Gemini", "DeepSeek", "Groq", "Mistral AI",
  "Cohere", "OpenRouter", "Fireworks AI", "Perplexity", "Cerebras",
  "Together AI", "xAI", "Hugging Face", "Replicate", "SambaNova", "AI21",
  "DeepInfra", "Nvidia NIM", "Moonshot", "Zhipu AI", "DashScope", "Cloudflare AI",
  "SiliconFlow", "Novita AI", "OctoAI", "Anyscale", "01.AI", "Baichuan AI", "MiniMax", "StepFun",
  "Fal AI", "Stability AI", "Runway", "Luma AI", "ElevenLabs", "Ideogram", "BFL", "Kling AI", "Haiper AI", "Midjourney API", "302.AI"
];

const PROVIDER_DOMAINS: Record<string, string> = {
  "OpenAI": "Text, Vision, Audio, Agents", "Anthropic": "Text, Vision, Coding", "Google Gemini": "Text, Vision, Audio, Video",
  "DeepSeek": "Text, Coding, Math", "Groq": "Fast Inference, Text, Audio", "Mistral AI": "Text, Coding",
  "Cohere": "Text, Embedding, RAG", "OpenRouter": "Aggregator (Omni)", "Fireworks AI": "Fast Inference, Text, Vision",
  "Perplexity": "Search, Text", "Cerebras": "Ultra-Fast Inference (Text)", "Together AI": "Inference, Fine-tuning",
  "xAI": "Text, Vision (Grok)", "Hugging Face": "Omni-Domain (Open Source)", "Replicate": "Image, Video, Audio, Text",
  "SambaNova": "Enterprise Inference", "AI21": "Text, Enterprise", "DeepInfra": "Inference, Audio, Vision",
  "Nvidia NIM": "Vision, Text, Biology, 3D", "Moonshot": "Text, Long-Context", "Zhipu AI": "Text, Vision (GLM)",
  "DashScope": "Text, Vision, Audio (Qwen)", "Cloudflare AI": "Edge Inference (Omni)", "SiliconFlow": "Inference (Asian Market)",
  "Novita AI": "Image, Video, Text", "OctoAI": "Image, Video, Text Inference", "Anyscale": "Text Inference",
  "01.AI": "Text, Vision (Yi)", "Baichuan AI": "Text, Healthcare", "MiniMax": "Text, Voice, Video",
  "StepFun": "Text, Multimodal", "Fal AI": "Fast Image/Video Gen", "Stability AI": "Image, Video, 3D",
  "Runway": "Video Generation", "Luma AI": "Video, 3D Generation", "ElevenLabs": "Audio, Voice Synthesis",
  "Ideogram": "Image Generation, Typography", "BFL": "Image Generation (Flux)", "Kling AI": "Video Generation",
  "Haiper AI": "Video Generation", "Midjourney API": "Premium Image Gen", "302.AI": "Aggregator (Omni)", "Unknown": "Unknown"
};

const FLAGSHIP_KEYWORDS = [
  "gpt-", "o1", "o3", "claude", "opus", "sonnet", "haiku", "gemini", "pro", "ultra", "flash", "lite",
  "v3", "v4", "r1", "deepseek", "thinking", "large", "small", "mini", "nano", "codestral", "command", "grok", "qwen", "glm", "kimi", "yi", "llama", "mistral", "mixtral",
  "flux", "sora", "kling", "gen-3", "luma", "veo", "midjourney", "sd", "stable-diffusion", "imagen", "dall-e", "runway",
  "whisper", "tts", "stt", "voice", "audio", "speech", "music", "suno", "eleven",
  "embed", "text-embedding", "search", "math", "code", "medical", "medlm", "biology", "alphafold", "agent", "robotics", "3d", "point-e"
];
const EXCLUDE_KEYWORDS: string[] = [];

console.log("%c LOGIC ENGINE VERSION: 24.0 LIMIT-BREAKER ENHANCED ", "background: #8b5cf6; color: white; font-weight: bold; padding: 4px; border-radius: 4px;");

const isFlagshipModel = (m: string) => {
  if (!m) return false;
  const lower = m.toLowerCase().trim();
  const isHigh = FLAGSHIP_KEYWORDS.some(k => lower.includes(k));
  const isLow = EXCLUDE_KEYWORDS.some(k => lower.includes(k));
  const result = isHigh && !isLow;
  if (isHigh) console.log(`[Categorization] Model: "${m}" | Final Decision: ${result ? 'FLAGSHIP' : 'EXCLUDED'}`);
  return result;
};

const isFlagship = (res: TestResult) => {
  if (res.status !== "Valid" || !res.models || res.models.length === 0) return false;
  return res.models.some(m => isFlagshipModel(m));
};

export default function App() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const t = translations[lang];

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const [fileData, setFileData] = useState<FileData | null>(null);
  const [filePath, setFilePath] = useState<string>("");
  const [stats, setStats] = useState({ total: 0, valid: 0, flagship: 0, failed: 0 });
  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0]);
  const fullResultsRef = useRef<TestResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [keyColumnIndex, setKeyColumnIndex] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "analytics">("list");
  const [activeTab, setActiveTab] = useState<"all" | "valid" | "flagship" | "failed">("all");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [options, setOptions] = useState({
    autoDetect: false,
    checkQuota: false,
    checkModels: false,
    proxy: ""
  });

  const listenersAttached = useRef(false);

  const unlistenRef = useRef<(() => void)[]>([]);
  const resultBuffer = useRef<TestResult[]>([]);
  const statsRef = useRef({ total: 0, valid: 0, flagship: 0, failed: 0 });

  useEffect(() => {
    let interval: any;

    if (listenersAttached.current) return;
    listenersAttached.current = true;

    const setup = async () => {
      const u1 = await listen<TestResult>("test-result", (event) => {
        const payload = event.payload;
        // Debug Log
        console.log("Validation Result:", payload);
        resultBuffer.current.push(payload);
      });

      const u2 = await listen("test-finished", () => {
        console.log("Validation Task Finished");
        setIsProcessing(false);
      });

      unlistenRef.current = [u1, u2];

      interval = setInterval(() => {
        try {
          if (resultBuffer.current.length > 0) {
            const batch = [...resultBuffer.current];
            resultBuffer.current = [];

            const processedBatch = batch.map(r => ({ ...r, uid: crypto.randomUUID() }));
            fullResultsRef.current = [...processedBatch, ...fullResultsRef.current];

            const newTotal = fullResultsRef.current.length;
            const v = fullResultsRef.current.filter(r => r.status === "Valid").length;
            const f = fullResultsRef.current.filter(r => isFlagship(r)).length;
            const x = newTotal - v;

            setStats({ total: newTotal, valid: v, flagship: f, failed: x });
          }
        } catch (e) { console.error("Error in update interval:", e); }
      }, 200);
    };

    setup().catch(console.error);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleFileOpen = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'Data', extensions: ['csv', 'xlsx', 'xls'] }]
      });

      if (selected && typeof selected === "string") {
        setFilePath(selected);
        const data = await invoke<FileData>("parse_file", { path: selected });
        console.log(`%c[FILE PARSER] Total rows detected: ${data.row_count}`, "background: #22c55e; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;");
        console.log(`[FILE PARSER] Headers: ${data.headers.join(', ')}`);
        setFileData(data);
        fullResultsRef.current = [];
        setStats({ total: 0, valid: 0, flagship: 0, failed: 0 });
        statsRef.current = { total: 0, valid: 0, flagship: 0, failed: 0 };
        const keyIdx = data.headers.findIndex(h => /key|token|api/i.test(h));
        setKeyColumnIndex(keyIdx !== -1 ? keyIdx : 0);
      }
    } catch (e) { console.error("File Open Error:", e); }
  };

  const handleSaveSmartCSV = async () => {
    console.log("Save CSV Request Triggered");
    const validResults = fullResultsRef.current.filter(r => r.status === "Valid");
    if (validResults.length === 0) {
      console.warn("No valid results to save!");
      return;
    }

    try {
      const path = await saveDialog({
        title: "Export Success Report",
        defaultPath: "valid_flagship_report.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }]
      });

      if (path) {
        console.log(`Saving CSV to: ${path}`);
        const header = "Key,Provider,Tier,Quota,Models\n";
        const rows = validResults.map(r => {
          const tier = isFlagship(r) ? "Flagship" : "Standard";
          const models = (r.models || []).join(" | ");
          return `"${r.key}","${r.provider}","${tier}","${r.quota || 'N/A'}","${models}"`;
        }).join("\n");

        await writeTextFile(path, header + rows);
        console.log("CSV Save Operation COMPLETED");
      } else {
        console.log("Save dialog CANCELLED by user");
      }
    } catch (err) {
      console.error("FATAL CSV SAVE ERROR:", err);
    }
  };

  const startTest = async () => {
    if (!fileData || keyColumnIndex === null) return;
    if (fileData.row_count === 0) return;
    fullResultsRef.current = [];
    setIsProcessing(true);
    setExpandedKeys(new Set());
    try {
      await invoke("start_validation", {
        path: fileData.path,
        keyColumnIndex: keyColumnIndex,
        provider: selectedProvider,
        options: {
          auto_detect: options.autoDetect,
          check_quota: options.checkQuota,
          check_models: options.checkModels,
          proxy: options.proxy.trim() || null
        }
      });
    } catch (err) { setIsProcessing(false); }
  };

  const stopTest = async () => {
    await invoke("stop_validation");
  };

  const toggleExpand = (id: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = (expand: boolean) => {
    if (expand) {
      setExpandedKeys(new Set(fullResultsRef.current.map(r => r.uid)));
    } else {
      setExpandedKeys(new Set());
    }
  };

  // Helper to get results for the current view
  const getVisibleResults = useMemo(() => {
    const q = searchQuery.toLowerCase();

    // Filter the FULL collection for accuracy
    return fullResultsRef.current.filter(r => {
      // Search matching
      const matchesSearch = !q || r.key.toLowerCase().includes(q) || r.message.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      // Tab matching
      if (activeTab === "all") return true;
      if (activeTab === "valid") return r.status === "Valid";
      if (activeTab === "flagship") return isFlagship(r);
      if (activeTab === "failed") return r.status !== "Valid";
      return true;
    });
  }, [stats, searchQuery, activeTab]);

  const VISUAL_LIMIT = 5000;
  const filteredResults = getVisibleResults.slice(0, VISUAL_LIMIT);

  const providerStats = useMemo(() => {
    const counts: Record<string, { total: number, valid: number }> = {};
    fullResultsRef.current.forEach(r => {
      if (!counts[r.provider]) counts[r.provider] = { total: 0, valid: 0 };
      counts[r.provider].total++;
      if (r.status === "Valid") counts[r.provider].valid++;
    });
    return Object.entries(counts).sort((a, b) => b[1].total - a[1].total);
  }, [stats]);

  return (
    <div className={cn("flex flex-col h-screen bg-[#09090b] text-zinc-100 overflow-hidden font-sans selection:bg-violet-500/30", lang === "ar" ? "font-arabic" : "")}>
      {/* NAVBAR */}
      <nav className="h-16 flex items-center px-6 border-b border-white/5 bg-zinc-950/40 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-violet-500" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-[11px] uppercase text-zinc-200">{lang === "ar" ? "APIScan Ai" : "APIScan Ai"}</span>
            <span className="text-[8px] font-medium text-zinc-500 uppercase tracking-widest leading-none">{t.proEdition}</span>
          </div>
        </div>

        <div className="ms-12 flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5">
          <button onClick={() => setView("list")} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center", view === "list" ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-300")}>
            <ListFilter className="w-3.5 h-3.5" /> {t.results}
          </button>
          <button onClick={() => setView("analytics")} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center", view === "analytics" ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-300")}>
            <BarChart3 className="w-3.5 h-3.5" /> {t.analytics}
          </button>
        </div>

        <div className="ms-auto flex items-center gap-4">
          <button onClick={() => setLang(l => l === "en" ? "ar" : "en")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
            <Languages className="w-3 h-3" /> {lang === "en" ? "AR" : "EN"}
          </button>
          {isProcessing ? <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-500 uppercase tracking-widest min-w-[100px] justify-center"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />{t.scanning}</div> : <div className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest min-w-[100px] justify-center">{t.standby}</div>}
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0 relative">
        <aside className="w-80 flex flex-col gap-6 shrink-0 h-full relative z-20">
          <div className="absolute inset-0 glass-panel-heavy glass-blur rounded-3xl -z-10" />
          <div className="flex flex-col gap-6 h-full p-6 overflow-y-auto custom-scroll">
            <div className="space-y-3 font-bold">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t.sourceDataset}</span>
              <button onClick={handleFileOpen} className="w-full rounded-2xl border border-white/5 bg-white/[0.01] hover:border-violet-500/30 transition-all p-5 flex flex-col items-center gap-3">
                <FileUp className="w-5 h-5 text-zinc-500" />
                <span className="text-[10px] text-zinc-400 truncate w-full">{filePath ? filePath.split('\\').pop() : t.selectFile}</span>
              </button>
            </div>

            {fileData && (
              <div className="space-y-6 animate-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pe-1 gap-1">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0"><ChevronDown className="w-3 h-3" /> {t.column}</span>
                      <span className="text-[8px] font-black text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full shrink-0">{fileData.row_count.toLocaleString()} {t.keys}</span>
                    </div>
                    <select value={keyColumnIndex || 0} onChange={e => setKeyColumnIndex(Number(e.target.value))} className="w-full h-10 bg-white/[0.02] border border-white/5 rounded-xl px-2 text-[10px] outline-none">
                      {fileData.headers.map((h, i) => <option key={i} value={i} className="bg-[#121217]">{h}</option>)}
                    </select>
                  </div>
                  {!options.autoDetect && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Globe className="w-3 h-3" /> {t.provider}</span>
                      <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} className="w-full h-10 bg-white/[0.02] border border-white/5 rounded-xl px-2 text-[10px] outline-none">
                        {PROVIDERS.map(p => <option key={p} value={p} className="bg-[#121217]">{p}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-3 h-3 text-violet-500" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t.validationEngine}</span>
                  </div>
                  <div className="space-y-2">
                    <OptionToggle icon={<Zap className="w-3 h-3" />} label={t.autoDetect} description={t.autoDetectDesc} t={t} checked={options.autoDetect} onChange={(v: boolean) => setOptions(o => ({ ...o, autoDetect: v }))} lang={lang} />
                    <OptionToggle icon={<Database className="w-3 h-3" />} label={t.quotaAudit} description={t.quotaAuditDesc} t={t} checked={options.checkQuota} onChange={(v: boolean) => setOptions(o => ({ ...o, checkQuota: v }))} lang={lang} />
                    <OptionToggle icon={<Layers className="w-3 h-3" />} label={t.modelAccess} description={t.modelAccessDesc} t={t} checked={options.checkModels} onChange={(v: boolean) => setOptions(o => ({ ...o, checkModels: v }))} lang={lang} />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">{t.proxyNode}</span>
                    <input type="text" placeholder={t.proxyPlaceholder} value={options.proxy} onChange={e => setOptions(o => ({ ...o, proxy: e.target.value }))} className="w-full h-11 bg-white/[0.02] border border-white/5 rounded-xl px-4 text-[10px] outline-none focus:border-violet-500/30 transition-all placeholder:text-zinc-700" />
                  </div>
                </div>
              </div>
            )}

            <button disabled={!fileData} onClick={isProcessing ? stopTest : startTest} className={cn("w-full h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all", isProcessing ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-violet-600 text-white")}>
              {isProcessing ? t.stopScanning : t.startValidation}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col glass-panel-heavy rounded-3xl overflow-hidden h-full z-10 border border-white/5">
          {view === "list" ? (
            <>
              <header className="h-20 px-6 border-b border-white/5 flex items-center justify-between bg-zinc-950/20 shrink-0">
                <div className="flex-1 relative max-w-xs">
                  <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600", lang === "ar" ? "right-4" : "left-4")} />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t.searchPlaceholder} className={cn("w-full bg-transparent py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:text-white transition-all placeholder:text-zinc-700", lang === "ar" ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left")} />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 border-white/5 pe-4 me-4 border-e">
                    <button onClick={() => expandAll(true)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-200" title={t.expandAll}><Maximize2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => expandAll(false)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-200" title={t.collapseAll}><Minimize2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={handleSaveSmartCSV} disabled={stats.total === 0} className="flex items-center gap-2 px-4 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest hover:bg-violet-600/20 transition-all disabled:opacity-20"><Save className="w-3.5 h-3.5" /> {t.saveSuccess}</button>
                </div>
              </header>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] mx-6 mt-6 shrink-0 overflow-x-auto no-scrollbar">
                <TabButton active={activeTab === "all"} label={t.all} count={stats.total} onClick={() => setActiveTab("all")} />
                <TabButton active={activeTab === "valid"} label={t.valid} count={stats.valid} onClick={() => setActiveTab("valid")} color="green" />
                <TabButton active={activeTab === "flagship"} label={t.flagship} count={stats.flagship} onClick={() => setActiveTab("flagship")} color="violet" icon={<Crown className="w-3 h-3" />} />
                <TabButton active={activeTab === "failed"} label={t.failed} count={stats.failed} onClick={() => setActiveTab("failed")} color="red" />
              </div>

              {getVisibleResults.length > VISUAL_LIMIT && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold text-center">
                  💡 {lang === "ar" ? `يتم عرض أول ${VISUAL_LIMIT} نتيجة فقط للحفاظ على سرعة البرنامج. (الإجمالي الحقيقي: ${getVisibleResults.length} مفتاح). لا تقلق ستيم حفظ جميع المفاتيح كاملة عند التصدير.` : `Showing the first ${VISUAL_LIMIT} results only to keep the app fast. (Real Total: ${getVisibleResults.length} keys). Don't worry, ALL keys will be exported.`}
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-3">
                {filteredResults.map((res) => {
                  const id = res.uid;
                  const expanded = expandedKeys.has(id);
                  const flagship = isFlagship(res);
                  return (
                    <motion.div key={id} className={cn("rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden transition-all hover:bg-white/[0.03]", flagship ? "border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.03)]" : "")}>
                      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(id)}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn("w-2 h-2 rounded-full", res.status === "Valid" ? (flagship ? "bg-violet-500 shadow-[0_0_8px_#8b5cf6]" : "bg-green-500") : "bg-red-500")} />
                          <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[240px] dir-ltr">{res.key}</span>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none">{res.provider}</span>
                            <span className="text-[7px] font-bold text-zinc-700 uppercase tracking-tighter leading-none">{PROVIDER_DOMAINS[res.provider] || "Omni-Domain"}</span>
                          </div>
                          {flagship && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[8px] font-black text-violet-400 uppercase tracking-tighter"><Crown className="w-2.5 h-2.5" /> {t.flagshipTier}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap", res.status === "Valid" ? "text-green-500 bg-green-500/5" : "text-red-500 bg-red-500/5")}>{res.status === "Valid" ? t.active : res.message}</span>
                          <ChevronRight className={cn("w-4 h-4 text-zinc-600 transition-transform", expanded ? "rotate-90 text-violet-500" : (lang === "ar" ? "rotate-180" : ""))} />
                        </div>
                      </div>
                      <AnimatePresence>
                        {expanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="border-t border-white/5 bg-zinc-950/40 p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <div>
                                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-2">{t.detailedStatus}</span>
                                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] text-zinc-400 leading-relaxed font-medium capitalize">{res.message}</div>
                                </div>
                                {res.quota && (
                                  <div>
                                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-2">{t.usageQuota}</span>
                                    <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10 text-[10px] text-violet-300 font-bold">{res.quota}</div>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-4">
                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-1">{t.authorizedModels}</span>

                                {res.models && res.models.length > 0 ? (() => {
                                  const flagshipList = res.models.filter(m => isFlagshipModel(m));
                                  const standardList = res.models.filter(m => !isFlagshipModel(m));
                                  const totalCount = res.models.length;

                                  return (
                                    <div className="space-y-4">
                                      {/* Total count badge */}
                                      <div className="flex items-center gap-2">
                                        <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                          <span className="text-[9px] font-black text-emerald-400">{totalCount} {lang === 'ar' ? 'موديل متاح' : 'models available'}</span>
                                        </div>
                                        {flagshipList.length > 0 && (
                                          <div className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                                            <span className="text-[9px] font-black text-violet-400">{flagshipList.length} {lang === 'ar' ? 'فلاجشيب' : 'flagship'}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Scrollable container for all models */}
                                      <div className="max-h-[300px] overflow-y-auto pr-1 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
                                        {flagshipList.length > 0 && (
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-2 sticky top-0 bg-zinc-950/90 backdrop-blur-sm py-1 z-10">
                                              <div className="h-[1px] flex-1 bg-violet-500/30" />
                                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-violet-500/30 bg-violet-500/10">
                                                <Crown className="w-2.5 h-2.5 text-violet-400" />
                                                <span className="text-[8px] font-black text-violet-300 uppercase tracking-tighter shrink-0">{t.flagshipTier} ({flagshipList.length})</span>
                                              </div>
                                              <div className="h-[1px] flex-1 bg-violet-500/30" />
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {flagshipList.map(m => (
                                                <div key={m} className="group relative">
                                                  <div className="absolute -inset-0.5 bg-violet-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-300" />
                                                  <span className="relative px-3 py-1.5 rounded-lg border bg-zinc-900/80 border-violet-500/40 text-violet-300 text-[10px] font-black uppercase tracking-tight shadow-lg flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" />
                                                    {m}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {standardList.length > 0 && (
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-2 sticky top-0 bg-zinc-950/90 backdrop-blur-sm py-1 z-10">
                                              <div className="h-[1px] flex-1 bg-zinc-700" />
                                              <span className="text-[7px] font-black text-zinc-500 uppercase tracking-tighter">{lang === 'ar' ? `موديلات إضافية (${standardList.length})` : `STANDARD MODELS (${standardList.length})`}</span>
                                              <div className="h-[1px] flex-1 bg-zinc-700" />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {standardList.map(m => (
                                                <span key={m} className="px-2 py-0.5 rounded-md border bg-white/[0.02] border-white/5 text-zinc-600 text-[8px] font-bold uppercase tracking-tight hover:text-zinc-400 hover:border-white/10 transition-colors">{m}</span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })() : <span className="text-[9px] text-zinc-700 italic">{t.noModelData}</span>}

                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
                {stats.total === 0 && <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4 py-32"><Zap className="w-16 h-16" /><span className="text-xs font-black uppercase tracking-[0.4em]">{t.engineStandby}</span></div>}
              </div>
            </>
          ) : (
            <div className="p-12 space-y-12 overflow-y-auto h-full custom-scroll">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-panel rounded-3xl p-8 flex flex-col items-center gap-6">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t.efficiencyCore}</span>
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/[0.03]" strokeWidth="3" />
                      {stats.total > 0 && <circle cx="18" cy="18" r="16" fill="none" className="stroke-violet-500" strokeWidth="3" strokeDasharray={`${((stats.valid + stats.flagship) / stats.total) * 100} 100`} strokeLinecap="round" />}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-mono font-black">{stats.total > 0 ? Math.round(((stats.valid + stats.flagship) / stats.total) * 100) : 0}%</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{t.successRate}</span>
                    </div>
                  </div>
                </div>
                <div className="glass-panel rounded-3xl p-8 space-y-8">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t.nodeMetrics}</span>
                  <MetricRow label={t.flagshipDensity} value={`${stats.total > 0 ? Math.round((stats.flagship / stats.total) * 100) : 0}%`} progress={stats.flagship / stats.total || 0} color="violet" />
                  <MetricRow label={t.validationLatency} value="Stable" progress={0.9} color="green" />
                  <MetricRow label={t.engineIntegrity} value="Hyper" progress={0.95} color="blue" />
                </div>
              </div>

              {providerStats.length > 0 && (
                <div className="glass-panel rounded-3xl p-8 space-y-6">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t.providersBreakdown}</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {providerStats.map(([providerName, pStats]) => (
                      <div key={providerName} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-zinc-200 uppercase tracking-wider">{providerName}</span>
                          <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">{pStats.valid} / {pStats.total} {t.valid}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="text-[9px] text-zinc-500 font-medium truncate" title={PROVIDER_DOMAINS[providerName] || "Omni"}>{PROVIDER_DOMAINS[providerName] || "Omni"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-10 rounded-3xl bg-gradient-to-br from-violet-600/10 to-transparent border border-violet-500/10 text-center space-y-4">
                <Crown className="w-10 h-10 text-violet-500/40 mx-auto" />
                <h3 className="text-lg font-black uppercase tracking-[0.2em]">{t.assetMatrix}</h3>
                <p className="text-[10px] text-zinc-500 font-medium max-w-sm mx-auto leading-relaxed">{t.assetMsg1}{stats.flagship}{t.assetMsg2}{stats.flagship > 0 ? t.elite : t.optimal}.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({ active, label, count, onClick, color = "default", icon }: any) {
  const colors = {
    default: active ? "bg-white/10 text-white" : "text-zinc-500",
    green: active ? "bg-green-500/20 text-green-400 border border-green-500/20" : "text-zinc-500",
    violet: active ? "bg-violet-500/20 text-violet-400 border border-violet-500/20" : "text-zinc-500",
    red: active ? "bg-red-500/20 text-red-400 border border-red-500/20" : "text-zinc-500"
  };
  return (
    <button onClick={onClick} className={cn("px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap shrink-0", colors[color as keyof typeof colors])}>
      {icon} {label} <span className="opacity-40 font-mono text-[9px]">{count}</span>
    </button>
  );
}

function MetricRow({ label, value, progress, color }: any) {
  const colors = { violet: "bg-violet-600", green: "bg-green-500", blue: "bg-blue-500" };
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-200">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} className={cn("h-full rounded-full", colors[color as keyof typeof colors])} />
      </div>
    </div>
  );
}

function OptionToggle({ icon, label, description, t, checked, onChange, lang }: any) {
  return (
    <label className="flex items-center justify-between group cursor-pointer p-2.5 rounded-xl hover:bg-white/[0.03] transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0", checked ? "bg-violet-500/10 text-violet-500" : "bg-white/[0.03] text-zinc-600")}>{icon}</div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("text-[9px] font-bold uppercase tracking-wider transition-colors truncate", checked ? "text-zinc-200" : "text-zinc-600")}>{label}</span>
          <div className="relative group/tip shrink-0">
            <AlertCircle className="w-2.5 h-2.5 text-zinc-700 hover:text-violet-400 transition-colors" />
            <div className={cn(
              "absolute top-1/2 -translate-y-1/2 w-48 p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-[9px] font-medium text-zinc-400 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-all z-[9999] shadow-2xl backdrop-blur-xl shrink-0",
              lang === "ar" ? "right-full mr-3" : "left-full ml-3"
            )}>
              <div className="text-violet-400 font-bold mb-1 uppercase tracking-tighter">{t.information}</div>
              {description}
            </div>
          </div>
        </div>
      </div>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-7 h-4 bg-zinc-800 rounded-full relative peer-checked:bg-violet-600 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-zinc-500 after:rounded-full after:transition-all peer-checked:after:translate-x-3 peer-checked:after:bg-white" />
    </label>
  );
}
