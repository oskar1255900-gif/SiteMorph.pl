import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as esbuild from 'esbuild-wasm';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import {
  Sparkles,
  CheckCircle2,
  Globe,
  Paperclip,
  Send,
  Monitor,
  Code as CodeIcon,

  Zap,
  Briefcase,
  X,
  Home,
  Coffee,
  ArrowLeft,
  Image as ImageIcon,

  Save,









  Check,

} from 'lucide-react';
import { Button } from '../components/ui';
import { springTransition } from '../lib/shared';
import { apiFetch, API_BASE } from '../lib/api';
import { GeneratedWebsite } from '../types';
import { ThinkingSteps } from './ThinkingSteps';

// Fetch AI-generated questions from backend (DeepSeek V4 Pro)
async function fetchWizardQuestions(businessName: string, description: string, fullPrompt: string): Promise<{questions: WizardQuestion[], detectedNiche?: string}> {
  try {
    const res = await apiFetch('/api/builder/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name: businessName, description: description, full_prompt: fullPrompt }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions)) {
        const mapped = data.questions.map((q: any) => ({
          question: q.question || 'Pytanie?',
          placeholder: q.placeholder || '',
          options: q.options || [],
          stateKey: q.stateKey || 'extras',
          multi: q.multi || false,
        }));
        return { questions: mapped.slice(0, 6), detectedNiche: data.detected_niche };
      }
    }
  } catch (e) {
    console.warn('[Wizard] Failed to fetch AI questions, using defaults');
  }
  return { questions: DEFAULT_WIZARD_QUESTIONS };
}

// ============================================================================
// BORDER BEAM CSS (animowany gradient naokolo karty)
// ============================================================================


// Thinking steps removed — generation is silent

// ============================================================================
// WIZARD QUESTIONNAIRE DATA
// ============================================================================
interface WizardQuestion {
  question: string;
  placeholder: string;
  options?: string[];
  stateKey: string;
  multi?: boolean;
}

const DEFAULT_WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    question: 'Czy chcesz wskazać konkretny styl?',
    placeholder: '',
    options: ['Dobierz automatycznie', 'Minimalistyczny', 'Editorial', 'Ciepły i przytulny', 'Odważny i energiczny'],
    stateKey: 'layout',
  },
  {
    question: 'Które sekcje są dla Ciebie najważniejsze?',
    placeholder: '',
    options: ['Menu', 'Oferta', 'Cennik', 'Galeria', 'Opinie', 'O nas', 'Kontakt', 'FAQ'],
    stateKey: 'sections',
    multi: true,
  },
];

// ============================================================================
// INLINE WIZARD (pojawia sie nad inputem, nie jako modal)
// ============================================================================
const InlineWizard = ({
  step, setStep, answers, setAnswers, onGenerate, onClose, questions, loading, theme,
}: {
  step: number; setStep: (s: number) => void;
  answers: Record<string, string | string[]>;
  setAnswers: (a: Record<string, string | string[]>) => void;
  onGenerate: () => void; onClose: () => void;
  questions: WizardQuestion[];
  loading: boolean;
  theme: 'light' | 'dark';
}) => {
  const dk = theme === 'dark';
  // Theme colors
  const bgColor = dk ? '#111111' : '#ffffff';
  const borderColor = dk ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
  const textPrimary = dk ? '#ffffff' : '#111827';
  const textSecondary = dk ? 'rgba(255,255,255,0.7)' : '#374151';
  const textMuted = dk ? 'rgba(255,255,255,0.4)' : '#9ca3af';
  const hoverBg = dk ? 'rgba(255,255,255,0.06)' : '#f3f4f6';
  const optionBorder = dk ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
  const accentBlue = '#2563eb';
  const accentGreen = '#10b981';

  const current = questions[step];
  // Show the loading state even while the question list is still empty (Design Agent is generating it).
  if (!current && !loading) return null;
  const total = questions.length;
  const isLast = step === total - 1;

  const handleNext = () => {
    if (isLast) onGenerate();
    else setStep(step + 1);
  };
  const handleAuto = () => {
    // "Auto" means: do not force a visual decision. Let Brand Strategist + Art Director infer it.
    setAnswers({
      ...answers,
      [current.stateKey]: current.multi ? [] : '',
    });
    setTimeout(handleNext, 200);
  };
  const toggleOption = (opt: string) => {
    if (current.multi) {
      const arr = (answers[current.stateKey] as string[]) || [];
      setAnswers({ ...answers, [current.stateKey]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] });
    } else {
      setAnswers({ ...answers, [current.stateKey]: opt });
      setTimeout(handleNext, 300);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
      className="mx-3 mb-2 rounded-2xl overflow-hidden"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${dk ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: dk ? 'rgba(16,185,129,0.15)' : '#ecfdf5' }}>
            <Sparkles size={12} className={dk ? 'text-emerald-400' : 'text-emerald-600'} />
          </div>
          <span className="text-xs font-semibold" style={{ color: textSecondary }}>Agent ma pytania</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent" style={{ color: textMuted }}><X size={12} /></button>
      </div>
      {loading ? (
        <div className="px-4 py-8 flex flex-col items-center gap-3">
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 rounded-full border-2 animate-spin" style={{ borderColor: accentGreen + '30', borderTopColor: accentGreen }} />
            <Sparkles size={10} className="absolute inset-0 m-auto" style={{ color: accentGreen }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: textSecondary }}>Design Agent generuje formularz…</span>
          <span className="text-[10px] text-center leading-relaxed" style={{ color: textMuted }}>
            Analizuję Twój prompt i układam pytania dopasowane do tego biznesu. To potrwa chwilę.
          </span>
        </div>
      ) : (
      <div>
      <div className="px-4 pt-3">
        <div className="flex gap-1">{questions.map((_: any, i: number) => <div key={i} className="h-[2px] flex-1 rounded-full transition-all" style={{ background: i <= step ? accentGreen : dk ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }} />)}</div>
      </div>
      <div className="px-4 pt-3 pb-3">
        <h3 className="text-base font-bold mb-4" style={{ color: textPrimary }}>{current.question}</h3>
        <div className="space-y-2">
          {current.options?.map((opt) => {
            const isSelected = current.multi
              ? Array.isArray(answers[current.stateKey]) && (answers[current.stateKey] as string[]).includes(opt)
              : answers[current.stateKey] === opt;
            return (
              <label key={opt} onClick={() => toggleOption(opt)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all"
                style={{
                  background: isSelected ? (dk ? 'rgba(255,255,255,0.06)' : '#eff6ff') : 'transparent',
                  border: `1px solid ${isSelected ? (dk ? 'rgba(255,255,255,0.12)' : '#bfdbfe') : optionBorder}`,
                  color: isSelected ? textPrimary : textMuted,
                }}>
                <div className="w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-all"
                  style={{
                    border: `2px solid ${isSelected ? accentBlue : (dk ? 'rgba(255,255,255,0.2)' : '#d1d5db')}`,
                    background: isSelected ? (dk ? 'rgba(16,185,129,0.2)' : '#dbeafe') : 'transparent',
                  }}>
                  {isSelected && <Check size={10} className={dk ? 'text-emerald-400' : 'text-blue-600'} />}
                </div>
                {(() => {
                  const hexMatch = opt.match(/#[0-9a-fA-F]{6}/);
                  if (hexMatch && current.stateKey === 'accent') {
                    const label = opt.replace(/#[0-9a-fA-F]{6}/, '').trim();
                    return (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-md shrink-0 border border-white/10" style={{ background: hexMatch[0] }} />
                        {label}
                      </span>
                    );
                  }
                  return opt;
                })()}
              </label>
            );
          })}
          {!current.options?.length && (              <input autoFocus value={(answers[current.stateKey] as string) || ''} onChange={(e) => setAnswers({ ...answers, [current.stateKey]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()} placeholder={current.placeholder}
              className="w-full px-3 py-2.5 rounded-lg text-[11px] outline-none"
              style={{ background: dk ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${dk ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, color: dk ? '#fff' : '#111827' }} />
          )}
        </div>
      </div>
      </div>
      )}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: `1px solid ${dk ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
        <div className="flex items-center gap-1">
          <button disabled={step === 0} onClick={() => setStep(step - 1)} className="text-[10px] cursor-pointer border-none bg-transparent disabled:opacity-30" style={{ color: textMuted }}>&lt; {step + 1} / {total} &gt;</button>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAuto} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
            style={{ background: 'transparent', border: `1px solid ${dk ? 'rgba(255,255,255,0.1)' : '#d1d5db'}`, color: textMuted }}>Auto-odpowiedz</button>
          <button onClick={handleNext} className="px-4 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer border-none"
            style={{ background: dk ? '#fff' : accentBlue, color: dk ? '#000' : '#fff' }}>
            {isLast ? 'Generuj' : 'Dalej'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// THINKING STATE (pokazuje co agent robi)
// ============================================================================


// ============================================================================
// LIVE REACT PREVIEW — REAL GENERATED REACT, COMPILED IN THE BROWSER
// No Sandpack, no CodeSandbox Nodebox, no AI-generated preview.html.
// ============================================================================

let esbuildInitPromise: Promise<void> | null = null;

function ensureEsbuildReady(): Promise<void> {
  if (!esbuildInitPromise) {
    esbuildInitPromise = esbuild.initialize({
      wasmURL: esbuildWasmUrl,
      worker: true,
    }).catch((err) => {
      esbuildInitPromise = null;
      throw err;
    });
  }
  return esbuildInitPromise;
}

function normalizeVirtualPath(input: string): string {
  const raw = input.replace(/\\/g, '/');
  const parts: string[] = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return '/' + parts.join('/');
}

function dirnameVirtual(path: string): string {
  const normalized = normalizeVirtualPath(path);
  const i = normalized.lastIndexOf('/');
  return i <= 0 ? '/' : normalized.slice(0, i);
}

function projectToVirtualFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [fullPath, content] of Object.entries(files || {})) {
    if (!fullPath.startsWith('main/frontend/')) continue;
    const rel = fullPath.slice('main/frontend/'.length);
    if (!rel || rel.toLowerCase().endsWith('preview.html')) continue;
    out[normalizeVirtualPath('/' + rel)] = content;
  }
  return out;
}

const LOCAL_EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '.css', '.json'];
const LOCAL_INDEXES = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

function resolveVirtualImport(
  specifier: string,
  importer: string,
  files: Record<string, string>,
): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = '/src/' + specifier.slice(2);
  } else if (specifier.startsWith('/')) {
    base = specifier;
  } else {
    base = dirnameVirtual(importer || '/') + '/' + specifier;
  }

  base = normalizeVirtualPath(base);
  for (const ext of LOCAL_EXTENSIONS) {
    const candidate = normalizeVirtualPath(base + ext);
    if (Object.prototype.hasOwnProperty.call(files, candidate)) return candidate;
  }
  for (const suffix of LOCAL_INDEXES) {
    const candidate = normalizeVirtualPath(base + suffix);
    if (Object.prototype.hasOwnProperty.call(files, candidate)) return candidate;
  }
  return null;
}

function loaderFor(path: string): esbuild.Loader {
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.jsx')) return 'jsx';
  if (path.endsWith('.js')) return 'js';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  return 'tsx';
}

const IMPORT_MAP = {
  imports: {
    react: 'https://esm.sh/react@18.2.0',
    'react/jsx-runtime': 'https://esm.sh/react@18.2.0/jsx-runtime',
    'react/jsx-dev-runtime': 'https://esm.sh/react@18.2.0/jsx-dev-runtime',
    'react-dom': 'https://esm.sh/react-dom@18.2.0?external=react',
    'react-dom/client': 'https://esm.sh/react-dom@18.2.0/client?external=react',
    'framer-motion': 'https://esm.sh/framer-motion@13.1.1?external=react,react-dom',
    'lucide-react': 'https://esm.sh/lucide-react@0.344.0?external=react',
    clsx: 'https://esm.sh/clsx@2.1.1',
  },
};

function safeInlineScript(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

function safeInlineStyle(code: string): string {
  return code.replace(/<\/style/gi, '<\\/style');
}

async function compileReactProjectToHtml(files: Record<string, string>): Promise<string> {
  await ensureEsbuildReady();
  const virtualFiles = projectToVirtualFiles(files);
  const entry = '/src/main.tsx';
  if (!virtualFiles[entry]) throw new Error('Brak main/frontend/src/main.tsx');
  if (!virtualFiles['/src/App.tsx']) throw new Error('Brak main/frontend/src/App.tsx');

  const plugin: esbuild.Plugin = {
    name: 'sitemorph-virtual-project',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const spec = args.path;

        if (/^https?:\/\//i.test(spec)) return { path: spec, external: true };

        const isLocal =
          args.kind === 'entry-point' ||
          spec.startsWith('.') ||
          spec.startsWith('/') ||
          spec.startsWith('@/');

        if (!isLocal) return { path: spec, external: true };

        const resolved = args.kind === 'entry-point'
          ? resolveVirtualImport(spec, '/', virtualFiles)
          : resolveVirtualImport(spec, args.importer || '/', virtualFiles);

        if (!resolved) {
          return {
            errors: [{ text: `Nie znaleziono lokalnego importu "${spec}" z ${args.importer || 'entry'}` }],
          };
        }

        // CSS: mark as external — we inject it directly into <style> to avoid
        // esbuild-wasm's 'cannot import CSS without output path' error.
        if (resolved.endsWith('.css')) {
          return { path: resolved, external: true };
        }

        return { path: resolved, namespace: 'sitemorph' };
      });

      build.onLoad({ filter: /.*/, namespace: 'sitemorph' }, (args) => {
        const contents = virtualFiles[args.path];
        if (contents == null) {
          return { errors: [{ text: `Brak pliku ${args.path}` }] };
        }
        return {
          contents,
          loader: loaderFor(args.path),
          resolveDir: dirnameVirtual(args.path),
        };
      });
    },
  };

  // Collect all CSS from the project and inject as <style>.
  // This bypasses esbuild-wasm's CSS bundling which needs an output path.
  const allProjectCss = Object.entries(virtualFiles)
    .filter(([k]) => k.endsWith('.css'))
    .map(([, v]) => v)
    .join('\n');

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    target: ['es2020'],
    jsx: 'automatic',
    platform: 'browser',
    plugins: [plugin],
    logLevel: 'silent',
    sourcemap: false,
    minify: false,
    // CSS is handled as external by the plugin — injected as <style> below.
  });

  const js = result.outputFiles?.find((f) => f.path.endsWith('.js'))?.text || '';
  if (!js.trim()) throw new Error('esbuild nie zwrócił bundla JavaScript');

  const css = allProjectCss;

  const importMap = JSON.stringify(IMPORT_MAP).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script type="importmap">${importMap}<\/script>
  <style>html,body,#root{margin:0;min-height:100%;width:100%;}${safeInlineStyle(css)}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${safeInlineScript(js)}<\/script>
</body>
</html>`;
}

function cleanAutoValue(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const low = text.toLowerCase();
  if (
    low === 'auto' ||
    low === 'automatycznie' ||
    low === 'dobierz automatycznie' ||
    low === 'zdecyduj za mnie' ||
    low === 'bez preferencji'
  ) {
    return '';
  }
  return text;
}

// ============================================================================
// MAIN BUILDER VIEW
// ============================================================================
export const BuilderFullView = ({
  theme = 'dark',
  initialPrompt = '',
  onBack,
  credits,
  setCredits,
}: {
  theme: 'light' | 'dark';
  initialPrompt?: string;
  onBack: () => void;
  credits: number;
  setCredits: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const dk = theme === 'dark';
  const [activeMode, setActiveMode] = useState<'preview' | 'code'>('preview');
  const [builderPrompt, setBuilderPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationErr, setGenerationErr] = useState('');
  const [generatedSite, setGeneratedSite] = useState<GeneratedWebsite | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [builderMode, setBuilderMode] = useState<'normal' | 'ultra' | 'ultra+'>('normal');
  const [wizardQuestions, setWizardQuestions] = useState<WizardQuestion[]>(DEFAULT_WIZARD_QUESTIONS);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState('main/frontend/index.html');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState('');
  const [compiledPreviewHtml, setCompiledPreviewHtml] = useState('');
  const [previewBuildErr, setPreviewBuildErr] = useState('');
  const [previewBuilding, setPreviewBuilding] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [leftW, setLeftW] = useState(400);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  // Wizard answers
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    sections: [],
  });

  // Projects
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const cost = builderMode === 'ultra+' ? 150 : builderMode === 'ultra' ? 45 : 15;


  useEffect(() => {
    if (initialPrompt) setBuilderPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setIsDesktop(mq.matches);
    fn();
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);

  useEffect(() => {
    if (!isDraggingSplit) return;
    const move = (e: MouseEvent) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      setLeftW(Math.min(Math.max(e.clientX - rect.left, 320), Math.floor(rect.width * 0.55)));
    };
    const up = () => setIsDraggingSplit(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isDraggingSplit]);

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    try {
      const res = await apiFetch('/api/projects/');
      if (res.ok) setSavedProjects((await res.json()) || []);
    } catch {}
  };

  const generateWithAnswers = async (ans: Record<string, string | string[]>, promptOverride?: string) => {
    const originalPrompt = (promptOverride || builderPrompt || '').trim();
    if (!originalPrompt) return;

    const selectedSections = Array.isArray(ans.sections) ? (ans.sections as string[]) : [];
    const niche = cleanAutoValue(ans.niche);
    const layout = cleanAutoValue(ans.layout);
    const themePreference = cleanAutoValue(ans.theme);
    const tone = cleanAutoValue(ans.tone);
    const photoStyle = cleanAutoValue(ans.photos);
    const accent = cleanAutoValue(ans.accent);
    const fonts = cleanAutoValue(ans.fonts);

    if (credits < cost) {
      alert(`Brak kredytów! Potrzeba ${cost}, masz ${credits}.`);
      return;
    }

    setGenerationErr('');
    setGeneratedSite(null);
    setCompiledPreviewHtml('');
    setPreviewBuildErr('');
    setPreviewBuilding(false);
    setIsGenerating(true);
    const start = Date.now();
    const MIN_MS = 3000;
    let fetchResult: any = null;
    let fetchError: any = null;

    try {
      const plan = (() => {
        try { return localStorage.getItem('sitemorph-plan') || 'Starter'; }
        catch { return 'Starter'; }
      })();

      const res = await apiFetch('/api/builder/generate', {
        method: 'POST',
        headers: { 'X-User-Plan': plan },
        timeoutMs: 480000,
        body: JSON.stringify({
          // Do not fake a business name. DeepSeek extracts it from the raw prompt.
          business_name: '',
          niche,

          // Raw user prompt stays intact and is the factual source of truth.
          description: originalPrompt,
          extraPrompt: originalPrompt,

          // Only explicit wizard choices are sent. Empty means "infer intelligently".
          style: [layout, tone].filter(Boolean).join(', '),
          colors: themePreference,
          sections: selectedSections,
          accent_color: accent,
          layout,
          fonts,
          photo_style: photoStyle,
          answers: ans,

          // Backend currently keeps these modes for pricing/refinement compatibility,
          // but every AI stage uses DeepSeek V4 Pro.
          mode: builderMode,
        }),
      } as any);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.warning || `Błąd: HTTP ${res.status}`);
      }

      fetchResult = await res.json();
    } catch (e: any) {
      fetchError = e;
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < MIN_MS) await new Promise((r) => setTimeout(r, MIN_MS - elapsed));

      if (fetchResult && !fetchError) {
        const data = fetchResult;
        const files: Record<string, string> = data.files || {};
        const meta = data.meta || {};
        const parsedBusiness = data.business_brief?.business || {};
        const parsedNiche = parsedBusiness.subcategory || parsedBusiness.category || meta.category || niche || 'Firma';
        const hasReact = Boolean(files['main/frontend/src/App.tsx'] && files['main/frontend/src/main.tsx']);

        if (!hasReact) {
          setGenerationErr(data.warning || 'DeepSeek nie zwrócił kompletnego projektu React (App.tsx + main.tsx).');
          setGeneratedSite(null);
          setIsGenerating(false);
          return;
        }

        // Compile the REAL generated React project in-browser. No preview.html is generated or stored.
        setPreviewBuilding(true);
        setPreviewBuildErr('');
        try {
          const html = await compileReactProjectToHtml(files);
          setCompiledPreviewHtml(html);
        } catch (previewError: any) {
          setCompiledPreviewHtml('');
          setPreviewBuildErr(previewError?.message || 'Nie udało się skompilować projektu React.');
        } finally {
          setPreviewBuilding(false);
        }

        setGeneratedSite({
          title: meta.title || parsedBusiness.name || originalPrompt.slice(0, 28),
          category: parsedNiche,
          domain: `${(meta.title || parsedBusiness.name || 'strona')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '')}.sitemorph.pl`,
          headline: meta.headline || parsedBusiness.name || originalPrompt,
          subheadline: meta.subheadline || `Wygenerowane przez SiteMorph AI (${data.provider || 'DeepSeek V4 Pro'})`,
          ctaText: meta.ctaText || 'Skontaktuj się',
          files,
        });


        const first =
          Object.keys(files).find((f) => f.endsWith('/src/App.tsx')) ||
          Object.keys(files).find((f) => f.endsWith('/src/index.css')) ||
          Object.keys(files).find((f) => f.endsWith('index.html')) ||
          Object.keys(files)[0];

        if (first) setSelectedFile(first);
        setCredits((c) => Math.max(0, c - cost));
      } else if (fetchError) {
        setGeneratedSite(null);
        setGenerationErr(fetchError?.message || 'Nie udało się wygenerować strony.');
      }

      setIsGenerating(false);
    }
  };

  const handleWizardComplete = (ans: Record<string, string | string[]>) => {
    setAnswers(ans);
    setShowWizard(false);

    // The original raw prompt is passed unchanged.
    // Empty/auto wizard values do not become fake design instructions.
    setTimeout(() => generateWithAnswers(ans, builderPrompt), 300);
  };

  const handleSaveProject = async () => {
    if (!generatedSite) return;
    setSaveMsg('');
    try {
      if (currentProjectId) {
        await apiFetch(`/api/projects/${currentProjectId}`, { method: 'PATCH', body: JSON.stringify({ name: generatedSite.title }) });
        setSaveMsg('Zapisano ✓');
      } else {
        const res = await apiFetch('/api/projects/', {
          method: 'POST',
          body: JSON.stringify({
            name: generatedSite.title,
            domain: generatedSite.domain,
            niche: generatedSite.category,
            content: { files: generatedSite.files, meta: { title: generatedSite.title, headline: generatedSite.headline, subheadline: generatedSite.subheadline, ctaText: generatedSite.ctaText } },
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          setCurrentProjectId(saved.id);
          setSaveMsg('Zapisano na koncie ✓');
        }
      }
      await loadProjects();
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e: any) {
      setSaveMsg(e.message || 'Wymaga zalogowania');
    }
  };




  // Quick prompts for badges
  const quickPrompts = [
    { icon: Coffee, label: 'Restauracja', prompt: 'Restauracja z menu, galerią zdjęć i rezerwacją online' },
    { icon: Briefcase, label: 'Landing page', prompt: 'Nowoczesny landing page dla startupu SaaS z sekcją cen' },
    { icon: Home, label: 'Nieruchomości', prompt: 'Agencja nieruchomości z ofertami mieszkań i domów' },
    { icon: Zap, label: 'Usługi', prompt: 'Firma usługowa z cennikiem i formularzem kontaktowym' },
  ];

  return (
    <>
      
      {/* Inline questionnaire appears above input when showWizard is true */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`h-screen flex flex-col overflow-hidden select-none ${theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8f9fa] text-[#111827]'}`}
      >
        {/* Header */}
        <header className={`h-12 border-b px-4 flex items-center justify-between shrink-0 ${theme === 'dark' ? 'bg-[#111111] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
          <motion.button whileHover={{ x: -2 }} onClick={onBack} className={`flex items-center gap-2 font-semibold text-xs transition-colors cursor-pointer bg-transparent border-none ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
            <ArrowLeft size={14} />
            <img src="/logo.svg" alt="SiteMorph" width="20" height="20" className="rounded-md" />
            Kreator
          </motion.button>
          <div className={`flex items-center gap-1 p-0.5 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/[0.06]' : 'bg-gray-100 border-gray-200'}`}>
            {(['preview', 'code'] as const).map((mode) => (
              <button key={mode} onClick={() => setActiveMode(mode)} className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border-none ${activeMode === mode ? (theme === 'dark' ? 'text-white' : 'text-gray-900') : (theme === 'dark' ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600')}`}>
                {activeMode === mode && <motion.div layoutId="builderMode" transition={springTransition} className={`absolute inset-0 rounded-md ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />}
                <span className="relative z-10 flex items-center gap-1.5">
                  {mode === 'preview' ? <Monitor size={12} /> : <CodeIcon size={12} />}
                  {mode === 'preview' ? 'Podgląd' : 'Kod'}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>{credits} kr.</span>
            <Button variant="primary" size="sm" disabled={isGenerating || !generatedSite || !compiledPreviewHtml} onClick={async () => {
              if (!generatedSite) return;
              setPublishing(true); setPublishErr('');
              try {
                // Publish exactly the same browser-compiled React build shown in the preview.
                const html = compiledPreviewHtml;
                if (!html) throw new Error('Podgląd React nie został jeszcze skompilowany.');
                const res = await apiFetch('/api/publish', { method: 'POST', body: JSON.stringify({ html, title: generatedSite.title }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || `Błąd ${res.status}`);
                const apiOrigin = API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`;
                setPublishedUrl(`${apiOrigin}${data.url}`);
              } catch (e: any) { setPublishErr(e.message); } finally { setPublishing(false) }
            }} className="font-semibold text-[11px]">
              {publishing ? '...' : 'Opublikuj'}
            </Button>
          </div>
        </header>

        {/* Main */}
        <div ref={splitRef} className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel — Agent Chat */}
          <div style={isDesktop ? { width: leftW } : undefined} className={`border-b md:border-b-0 md:border-r h-[45vh] md:h-auto flex flex-col overflow-hidden shrink-0 ${theme === 'dark' ? 'bg-[#111111] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
            {isGenerating ? (
              <ThinkingSteps mode={builderMode} />
            ) : generatedSite ? (
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-green-400" />
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Strona gotowa!</div>
                    <div className={`text-[10px] ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{generatedSite.title}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button onClick={handleSaveProject} className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border-none ${theme === 'dark' ? 'bg-white text-black hover:bg-white/90' : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'}`}>
                    <Save size={12} className="inline mr-1.5" />
                    {currentProjectId ? 'Zapisz zmiany' : 'Zapisz projekt'}
                  </button>

                  {saveMsg && <p className={`text-[10px] text-center ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{saveMsg}</p>}
                </div>

                <div className="pt-3 border-t border-white/[0.06]">
                  <div className={`text-[10px] font-semibold mb-2 uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>Projekty</div>
                  {savedProjects.length === 0 ? (
                    <p className={`text-[10px] ${theme === 'dark' ? 'text-white/20' : 'text-gray-300'}`}>Brak zapisanych projektów</p>
                  ) : savedProjects.slice(0, 5).map((p) => (
                    <button key={p.id} onClick={() => {
                      const meta = p.content?.meta || {};
                      setGeneratedSite({ title: p.name, category: p.niche || '', domain: p.domain, headline: meta.headline || p.name, subheadline: meta.subheadline || '', ctaText: meta.ctaText || 'Kontakt', files: p.content?.files || {} });
                      setCurrentProjectId(p.id);
                    }} className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer border-none bg-transparent truncate ${theme === 'dark' ? 'text-white/50 hover:text-white/80 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Empty State — Agent Chat */
              <div className="flex-1 flex flex-col">
                <div className="flex-1 p-5 overflow-y-auto space-y-5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-green-500/20 to-blue-500/20 border-white/10' : 'bg-gradient-to-br from-green-50 to-blue-50 border-green-200'}`}>
                      <svg fill="none" height="24" viewBox="0 0 48 48" width="24">
                        <path d="m6 24c11.4411 0 18-6.5589 18-18 0 11.4411 6.5589 18 18 18-11.4411 0-18 6.5589-18 18 0-11.4411-6.5589-18-18-18z" fill="url(#sm-grad)" fillRule="evenodd" />
                        <defs><linearGradient id="sm-grad" x1="24" x2="24" y1="6" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor="#22c55e" stopOpacity=".8" /><stop offset="1" stopColor="#3b82f6" stopOpacity=".5" /></linearGradient></defs>
                      </svg>
                    </div>
                    <div>
                      <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/80' : 'text-gray-600'}`}>Cześć! 👋</h2>
                      <h3 className={`text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Opisz stronę, a ją zbuduję.</h3>
                    </div>
                  </div>

                  <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
                    Wklej dane firmy prosto z Google Maps albo opisz własnymi słowami. Zbuduję kompletną stronę z treściami, zdjęciami i formularzem kontaktowym.
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((qp) => (
                      <button key={qp.label} onClick={() => setBuilderPrompt(qp.prompt)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${theme === 'dark' ? 'bg-white/5 border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                        <qp.icon size={11} className="text-white/40" />
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inline Questionnaire — nad inputem */}
                {showWizard && (
                  <InlineWizard
                    step={wizardStep}
                    setStep={setWizardStep}
                    answers={answers}
                    setAnswers={setAnswers}
                    onGenerate={() => { setShowWizard(false); handleWizardComplete(answers); }}
                    onClose={() => setShowWizard(false)}
                    questions={wizardQuestions}
                    loading={wizardLoading}
                    theme={theme}
                  />
                )}

                {/* Chat Input — Border Beam */}
                <div className="p-3 border-t border-white/[0.06]">
                  <div>
                    <div className={`relative rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-[#1a1d23] border border-white/[0.08]' : 'bg-gray-50 border border-gray-200'}`}>
                      <textarea
                        rows={3}
                        value={builderPrompt}
                        onChange={(e) => setBuilderPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            generateWithAnswers(answers, builderPrompt);
                          }
                        }}
                        placeholder="Opisz stronę, którą chcesz zbudować..."
                        className={`w-full bg-transparent border-none outline-none text-sm resize-none px-4 pt-3 pb-2 min-h-[60px] ${theme === 'dark' ? 'text-white placeholder:text-white/25' : 'text-gray-900 placeholder:text-gray-400'}`}
                      />
                      <div className="flex items-center justify-between px-3 pb-3">
                        <div className="flex items-center gap-1">
                          <button className={`p-1.5 rounded-md transition-colors cursor-pointer border-none bg-transparent ${theme === 'dark' ? 'hover:bg-white/5 text-white/30 hover:text-white/60' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}>
                            <Paperclip size={14} />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors cursor-pointer border-none bg-transparent">
                            <ImageIcon size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex gap-0.5 p-0.5 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                            {(['normal', 'ultra'] as const).map(m => (
                              <button key={m} onClick={() => setBuilderMode(m)}
                                className={`px-2 py-1 rounded-md text-[9px] font-bold cursor-pointer border-none transition-all ${builderMode === m ? (m === 'ultra' ? 'bg-purple-500/20 text-purple-300' : (theme === 'dark' ? 'bg-white/10 text-white' : 'bg-[#2563eb] text-white')) : (theme === 'dark' ? 'text-white/30 hover:text-white/50 bg-transparent' : 'text-gray-400 hover:text-gray-600 bg-transparent')}`}>
                                {m === 'normal' ? 'S1' : 'Ultra'}
                              </button>
                            ))}
                          </div>
                          <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-white/20' : 'text-gray-400'}`}>{cost} kr.</span>
                          <button
                            onClick={() => {
                              if (!builderPrompt.trim()) return;
                              generateWithAnswers(answers, builderPrompt);
                            }}
                            disabled={!builderPrompt.trim()}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center cursor-pointer border-none disabled:opacity-30 disabled:cursor-default transition-all hover:brightness-110 active:scale-95"
                          >
                            <Send size={14} className="text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Split Handle */}
          <div
            onMouseDown={(e) => { e.preventDefault(); setIsDraggingSplit(true); }}
            className={`hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center transition-colors ${isDraggingSplit ? 'bg-green-500/10' : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100')}`}
          >
            <div className={`w-0.5 h-12 rounded-full transition-colors ${isDraggingSplit ? 'bg-green-500/40' : (theme === 'dark' ? 'bg-white/10' : 'bg-gray-300')}`} />
          </div>

          {/* Right Panel — Preview / Code */}
          <div className={`flex-1 min-h-0 overflow-hidden flex p-2 ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#f8f9fa]'}`}>
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div key="loading" initial={{ opacity: 0, filter: 'blur(8px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0 }} className={`flex-1 flex flex-col items-center justify-center rounded-xl border ${theme === 'dark' ? 'bg-[#111111] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/10 grid place-items-center mb-3">
                    <Sparkles size={18} className="text-green-400" />
                  </motion.div>
                  <div className="text-xs font-medium text-white/60">Generuję stronę...</div>
                </motion.div>
              ) : !generatedSite ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex-1 flex items-center justify-center rounded-xl border ${theme === 'dark' ? 'bg-[#111111] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <div className="text-center space-y-2 p-8 max-w-lg">
                    <div className={`w-14 h-14 rounded-xl border flex items-center justify-center mx-auto ${generationErr ? 'bg-red-500/10 border-red-500/20' : (theme === 'dark' ? 'bg-white/5 border-white/[0.06]' : 'bg-gray-50 border-gray-200')}`}>
                      {generationErr ? <X size={24} className="text-red-400" /> : <Monitor size={24} className={theme === 'dark' ? 'text-white/20' : 'text-gray-300'} />}
                    </div>
                    <h3 className={`text-sm font-semibold ${generationErr ? 'text-red-400' : (theme === 'dark' ? 'text-white/40' : 'text-gray-400')}`}>
                      {generationErr ? 'Nie udało się uruchomić projektu' : 'Podgląd strony'}
                    </h3>
                    <p className={`text-xs ${generationErr ? (theme === 'dark' ? 'text-white/50' : 'text-gray-500') : (theme === 'dark' ? 'text-white/20' : 'text-gray-300')}`}>
                      {generationErr || 'Opisz stronę w panelu po lewej, aby wygenerować podgląd.'}
                    </p>
                  </div>
                </motion.div>
              ) : activeMode === 'preview' ? (
                <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden border ${theme === 'dark' ? 'bg-[#111111] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <div className={`h-8 border-b flex items-center justify-between px-3 shrink-0 ${theme === 'dark' ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                    <span className={`text-[10px] font-medium truncate ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{generatedSite.domain}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[9px] font-semibold">LIVE</span>
                    </div>
                  </div>
                  {previewBuilding ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-white text-gray-700 gap-3">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="w-7 h-7 rounded-full border-2 border-gray-200 border-t-gray-700" />
                      <span className="text-xs font-medium">Kompiluję prawdziwy projekt React…</span>
                    </div>
                  ) : previewBuildErr ? (
                    <div className="flex-1 flex items-center justify-center p-8 bg-[#111111]">
                      <div className="max-w-lg text-center">
                        <X size={28} className="mx-auto mb-3 text-red-400" />
                        <h3 className="text-sm font-semibold text-white mb-2">Błąd kompilacji React</h3>
                        <p className="text-xs leading-relaxed text-white/50 whitespace-pre-wrap">{previewBuildErr}</p>
                        <p className="text-[10px] text-white/30 mt-3">Kod DeepSeeka nadal jest dostępny w zakładce „Kod”.</p>
                      </div>
                    </div>
                  ) : compiledPreviewHtml ? (
                    <iframe
                      key={generatedSite.domain}
                      title={`Podgląd ${generatedSite.title}`}
                      className="flex-1 w-full border-0 bg-white"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                      srcDoc={compiledPreviewHtml}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-[#111111] text-white/40 text-xs">
                      Brak skompilowanego podglądu.
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex-1 flex rounded-xl overflow-hidden border ${theme === 'dark' ? 'bg-[#111111] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <div className={`w-48 border-r p-2 space-y-0.5 overflow-y-auto ${theme === 'dark' ? 'bg-[#0d0d0d] border-white/[0.06]' : 'bg-gray-50 border-gray-200'}`}>
                    <span className={`text-[9px] font-semibold block mb-1 uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>Pliki</span>
                    {Object.keys(generatedSite.files).map((fname) => (
                      <button key={fname} onClick={() => setSelectedFile(fname)} className={`w-full text-left px-2 py-1 rounded text-[10px] font-medium truncate border-none cursor-pointer ${selectedFile === fname ? (theme === 'dark' ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600') : (theme === 'dark' ? 'bg-transparent text-white/40 hover:text-white/60 hover:bg-white/5' : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100')}`}>
                        {fname.split('/').pop()}
                      </button>
                    ))}
                  </div>
                  <div className={`flex-1 p-3 overflow-y-auto ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                    <pre className={`text-[10px] leading-relaxed whitespace-pre-wrap break-words ${theme === 'dark' ? 'text-green-300/80' : 'text-green-800/80'}`}>{generatedSite.files[selectedFile] || ''}</pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Published URL Modal */}
        <AnimatePresence>
          {publishedUrl && (
            <>
              <motion.div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPublishedUrl(null)} />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className={`fixed right-0 top-0 bottom-0 w-[340px] max-w-[90vw] z-[61] shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-[#111111] border-l border-white/[0.06]' : 'bg-white border-l border-gray-200'}`}>
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Opublikowano!</span>
                  </div>
                  <button onClick={() => setPublishedUrl(null)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 text-white/40 cursor-pointer border-none bg-transparent"><X size={14} /></button>
                </div>
                <div className="p-5 space-y-3 flex-1">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/[0.06]">
                    <input readOnly value={publishedUrl} onFocus={(e) => e.currentTarget.select()} className={`flex-1 bg-transparent text-xs font-medium outline-none min-w-0 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
                    <button onClick={() => navigator.clipboard?.writeText(publishedUrl)} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold shrink-0 cursor-pointer border-none ${theme === 'dark' ? 'bg-white text-black' : 'bg-[#2563eb] text-white'}`}>Kopiuj</button>
                  </div>
                  {publishErr && <p className="text-xs text-red-400">{publishErr}</p>}
                  <a href={publishedUrl} target="_blank" rel="noreferrer" className="block"><Button variant="primary" size="sm" className="w-full">Otwórz stronę</Button></a>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};
