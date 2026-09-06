import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  Globe,
  Paperclip,
  Send,
  Monitor,
  Code as CodeIcon,
  RefreshCw,
  Zap,
  Briefcase,
  X,
  Home,
  Coffee,
  ArrowLeft,
  Image as ImageIcon,
  Eye,
  MousePointer2,
  Save,
  Pencil,
  Trash2,
  FolderOpen,
  Download,
  ChevronRight,
  ChevronLeft,
  Search,
  Terminal,
  FileText,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui';
import { springTransition } from '../lib/shared';
import { apiFetch, API_BASE } from '../lib/api';
import { GeneratedWebsite } from '../types';

// Fetch AI-generated questions from backend (Gemini 3.8 Flash)
async function fetchWizardQuestions(businessName: string, description: string): Promise<WizardQuestion[]> {
  try {
    const res = await apiFetch('/api/builder/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name: businessName, description: description }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.questions && Array.isArray(data.questions) && data.questions.length >= 3) {
        return data.questions.map((q: any) => ({
          question: q.question || 'Pytanie?',
          placeholder: q.placeholder || '',
          options: q.options || [],
          stateKey: q.stateKey || 'extras',
          multi: q.multi || false,
        }));
      }
    }
  } catch (e) {
    console.warn('[Wizard] Failed to fetch AI questions, using defaults');
  }
  return DEFAULT_WIZARD_QUESTIONS;
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
  { question: 'Jaki to biznes?', placeholder: 'np. Restauracja, Barber, Fryzjer...', options: ['Restauracja', 'Barber', 'Salon beauty', 'Siłownia', 'Warsztat', 'Kwiaciarnia', 'Prawnik', 'Korepetytor'], stateKey: 'niche' },
  { question: 'Jaki akcent kolorystyczny?', placeholder: 'np. #2563eb', options: ['Niebieski #2563eb', 'Ciemny/grafit #111827', 'Złoty #d97706', 'Zielony #059669', 'Fioletowy #7c3aed', 'Czerwony #dc2626', 'Różowy #ec4899'], stateKey: 'accent' },
  { question: 'Jaki styl strony?', placeholder: 'np. Nowoczesny, ciemny, minimalistyczny', options: ['Nowoczesny (serif + duże litery)', 'Ciemny (dark mode + neon)', 'Brutalistyczny (grube ramki)', 'Minimalistyczny (Inter + dużo białego)'], stateKey: 'layout' },
  { question: 'Które sekcje na stronie?', placeholder: '', options: ['Hero', 'Oferta', 'Cennik', 'Opinie', 'Kontakt', 'Galeria', 'O nas', 'FAQ'], stateKey: 'sections', multi: true },
];

// ============================================================================
// INLINE WIZARD (pojawia sie nad inputem, nie jako modal)
// ============================================================================
const InlineWizard = ({
  step, setStep, answers, setAnswers, onGenerate, onClose, questions,
}: {
  step: number; setStep: (s: number) => void;
  answers: Record<string, string | string[]>;
  setAnswers: (a: Record<string, string | string[]>) => void;
  onGenerate: () => void; onClose: () => void;
  questions: WizardQuestion[];
}) => {
  const current = questions[step];
  const total = questions.length;
  const isLast = step === total - 1;

  const handleNext = () => {
    if (isLast) onGenerate();
    else setStep(step + 1);
  };
  const handleAuto = () => {
    if (current.options) {
      if (current.multi) {
        const shuffled = [...current.options].sort(() => 0.5 - Math.random()).slice(0, 3);
        setAnswers({ ...answers, [current.stateKey]: shuffled });
      } else {
        const pick = current.options[Math.floor(Math.random() * current.options.length)];
        setAnswers({ ...answers, [current.stateKey]: pick });
      }
    }
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
      className="mx-3 mb-2 rounded-xl bg-[#1a1d23] border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-green-400" />
          <span className="text-[11px] font-semibold text-white/80">Agent ma pytania</span>
          <span className="text-[10px] text-white/30">{step + 1}/{total}</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 text-white/30 cursor-pointer border-none bg-transparent"><X size={10} /></button>
      </div>
      <div className="px-4 pb-1"><div className="flex gap-0.5">{DEFAULT_WIZARD_QUESTIONS.map((_, i) => <div key={i} className={`h-0.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-green-500' : 'bg-white/10'}`} />)}</div></div>
      <div className="px-4 py-3">
        <div className="text-sm font-semibold text-white mb-2">{current.question}</div>
        {current.options ? (
          <div className="flex flex-wrap gap-1.5">
            {current.options.map((opt) => {
              const sel = current.multi ? ((answers[current.stateKey] as string[]) || []).includes(opt) : answers[current.stateKey] === opt;
              return <button key={opt} onClick={() => toggleOption(opt)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer border ${sel ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}`}>{sel && <Check size={9} className="inline mr-0.5" />}{opt}</button>;
            })}
          </div>
        ) : (
          <input autoFocus value={(answers[current.stateKey] as string) || ''} onChange={(e) => setAnswers({ ...answers, [current.stateKey]: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleNext()} placeholder={current.placeholder}
            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-green-500/50" />
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06]">
        <div className="flex gap-1">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="px-2 py-1 rounded text-[10px] text-white/40 hover:text-white/70 cursor-pointer border-none bg-transparent"><ChevronLeft size={10} className="inline" /> Wstecz</button>}
          <button onClick={handleAuto} className="px-2 py-1 rounded text-[10px] text-white/40 hover:text-white/70 cursor-pointer border-none bg-transparent">Auto</button>
        </div>
        <button onClick={handleNext} className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-white text-black hover:bg-white/90 cursor-pointer border-none">
          {isLast ? 'Generuj' : 'Dalej'} {!isLast && <ChevronRight size={10} className="inline" />}
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// THINKING STATE (pokazuje co agent robi)
// ============================================================================
// AI Thinking Display
const AIThinkingDisplay = ({ thinking }: { thinking: any }) => {
  if (!thinking) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 py-2">
      {thinking.business_analysis && (
        <div className="px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
          <div className="text-[10px] font-semibold text-blue-400 mb-1 uppercase tracking-wider">Analiza biznesu</div>
          <div className="text-[11px] text-white/60 leading-relaxed">{thinking.business_analysis}</div>
        </div>
      )}
      {thinking.design_direction && (
        <div className="px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
          <div className="text-[10px] font-semibold text-purple-400 mb-1 uppercase tracking-wider">Kierunek designu</div>
          <div className="text-[11px] text-white/60 leading-relaxed">{thinking.design_direction}</div>
        </div>
      )}
      {thinking.content_plan && (
        <div className="px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/10">
          <div className="text-[10px] font-semibold text-green-400 mb-1 uppercase tracking-wider">Plan treści</div>
          <div className="text-[11px] text-white/60 leading-relaxed">{thinking.content_plan}</div>
        </div>
      )}
    </motion.div>
  );
};

const ThinkingState = ({ step }: { step: number }) => (
  <div className="space-y-2 py-3">
    {[].map((s: any, i: number) => {
      const isActive = i === step;
      const isDone = i < step;
      return (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15 }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
            isActive ? 'bg-white/5 text-white' : isDone ? 'text-white/40' : 'text-white/20'
          }`}
        >
          {isDone ? (
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
          ) : isActive ? (
            <Loader2 size={14} className={`${s.color} animate-spin shrink-0`} />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0" />
          )}
          <span className={isActive ? 'font-medium' : ''}>{s.label}</span>
        </motion.div>
      );
    })}
  </div>
);

// ============================================================================
// MAIN BUILDER VIEW
// ============================================================================
export const BuilderFullView = ({
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
  const [activeMode, setActiveMode] = useState<'preview' | 'code'>('preview');
  const [builderPrompt, setBuilderPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSite, setGeneratedSite] = useState<GeneratedWebsite | null>(null);
  const [genStep, setGenStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [builderMode, setBuilderMode] = useState<'normal' | 'ultra'>('normal');
  const [wizardQuestions, setWizardQuestions] = useState<WizardQuestion[]>(DEFAULT_WIZARD_QUESTIONS);
  const [selectedFile, setSelectedFile] = useState('main/frontend/index.html');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [leftW, setLeftW] = useState(400);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Wizard answers
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    niche: 'Restauracja',
    accent: 'Niebieski #2563eb',
    layout: 'Nowoczesny (serif + duże litery)',
    sections: ['Hero', 'Oferta', 'Cennik', 'Opinie', 'Kontakt'],
  });

  // Projects
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const cost = builderMode === 'ultra' ? 45 : 15;

  useEffect(() => {
    if (!isGenerating) return;
    const id = setInterval(() => setGenStep((s) => (s + 1) % 6), 2200);
    return () => clearInterval(id);
  }, [isGenerating]);

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

  const detectBusiness = (text: string): string => {
    const t = text.toLowerCase();
    if (t.includes('restaurac') || t.includes('kebab') || t.includes('kurczak') || t.includes('jedzenie') || t.includes('food') || t.includes('pizzeria') || t.includes('bistro')) return 'Restauracja';
    if (t.includes('barber') || t.includes('fryzjer') || t.includes('strzyż') || t.includes('salon fryzj')) return 'Barber';
    if (t.includes('beauty') || t.includes('salon urod') || t.includes('manicure') || t.includes('paznokci') || t.includes('spa')) return 'Salon beauty';
    if (t.includes('siłowni') || t.includes('fitness') || t.includes('gym')) return 'Siłownia';
    if (t.includes('warsztat') || t.includes('mechanik') || t.includes('napraw')) return 'Warsztat';
    if (t.includes('kwiaciarni') || t.includes('kwiat')) return 'Kwiaciarnia';
    return '';
  };

  const buildPrompt = () => {
    const sections = ((answers.sections as string[]) || []).join(', ');
    const niche = answers.niche || 'Restauracja';
    return `Branża: ${niche}. Styl: ${answers.layout || 'Nowoczesny'}. Akcent: ${answers.accent || '#2563eb'}. Sekcje: ${sections}. ${builderPrompt ? `Opis: ${builderPrompt}` : ''} Zbuduj nowoczesną stronę.`;
  };

  const handleGenerate = async () => {
    const p = buildPrompt();
    if (!p.trim()) return;
    if (credits < cost) {
      alert(`Brak kredytów! Potrzeba ${cost}, masz ${credits}.`);
      return;
    }
    setIsGenerating(true);
    setGenStep(0);
    const start = Date.now();
    const MIN_MS = 120000; // 2 minuty minimum na generowanie
    let fetchResult: any = null;
    let fetchError: any = null;
    try {
      const plan = (() => { try { return localStorage.getItem('sitemorph-plan') || 'Starter' } catch { return 'Starter' } })();
      const res = await apiFetch('/api/builder/generate', {
        method: 'POST',
        headers: { 'X-User-Plan': plan },
        timeoutMs: 480000,
        body: JSON.stringify({
          business_name: answers.niche || 'Firma',
          niche: answers.niche || 'Restauracja',
          description: p,
          style: String(answers.layout || 'Nowoczesny'),
          colors: String(answers.accent || '#2563eb'),
          sections: (answers.sections as string[]) || ['Hero', 'Oferta', 'Cennik', 'Kontakt'],
          extraPrompt: builderPrompt,
          accent_color: String(answers.accent || '#2563eb'),
          layout: String(answers.layout || 'Nowoczesny'),
          fonts: 'Inter',
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
        setGeneratedSite({
          title: meta.title || p.slice(0, 28),
          category: String(answers.niche),
          domain: `${(meta.title || 'strona').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.sitemorph.pl`,
          headline: meta.headline || p,
          subheadline: meta.subheadline || `Wygenerowane przez SiteMorph AI (${data.provider || 'AI'})`,
          ctaText: meta.ctaText || 'Skontaktuj się',
          files,
        });
        const first = Object.keys(files).find((f) => f.endsWith('index.html')) || Object.keys(files)[0];
        if (first) setSelectedFile(first);
        setCredits((c) => Math.max(0, c - cost));
      } else if (fetchError) {
        setGeneratedSite({
          title: p.slice(0, 25),
          category: String(answers.niche),
          domain: 'blad.sitemorph.pl',
          headline: p,
          subheadline: `Błąd: ${fetchError.message}`,
          ctaText: 'Skontaktuj się',
          files: {},
        });
      }
      setIsGenerating(false);
    }
  };

  const handleWizardComplete = (ans: Record<string, string | string[]>) => {
    setAnswers(ans);
    // Auto-generate after wizard
    setTimeout(() => {
      setBuilderPrompt((prev) => {
        const niche = ans.niche || '';
        return prev || `Strona dla ${niche}`;
      });
      handleGenerate();
    }, 400);
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

  const handleDownload = (type: 'html' | 'react') => {
    if (!generatedSite) return;
    const safeName = (generatedSite.title || 'strona').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '_');
    if (type === 'html') {
      const html = generatedSite.files['main/frontend/preview.html'] || '';
      if (!html) return;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${safeName}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } else {
      for (const [fname, content] of Object.entries(generatedSite.files)) {
        if (content) {
          const blob = new Blob([content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = fname.split('/').pop() || fname;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        }
      }
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
        className="h-screen flex flex-col overflow-hidden select-none bg-[#0a0a0a] text-white"
      >
        {/* Header */}
        <header className="h-12 border-b px-4 flex items-center justify-between shrink-0 bg-[#111111] border-white/[0.06]">
          <motion.button whileHover={{ x: -2 }} onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white font-semibold text-xs transition-colors cursor-pointer bg-transparent border-none">
            <ArrowLeft size={14} />
            <img src="/logo.svg" alt="SiteMorph" width="20" height="20" className="rounded-md" />
            Kreator
          </motion.button>
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/[0.06]">
            {(['preview', 'code'] as const).map((mode) => (
              <button key={mode} onClick={() => setActiveMode(mode)} className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border-none ${activeMode === mode ? 'text-white' : 'text-white/40 hover:text-white/60'}`}>
                {activeMode === mode && <motion.div layoutId="builderMode" transition={springTransition} className="absolute inset-0 bg-white/10 rounded-md" />}
                <span className="relative z-10 flex items-center gap-1.5">
                  {mode === 'preview' ? <Monitor size={12} /> : <CodeIcon size={12} />}
                  {mode === 'preview' ? 'Podgląd' : 'Kod'}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-medium">{credits} kr.</span>
            <Button variant="primary" size="sm" disabled={isGenerating || !generatedSite} onClick={async () => {
              if (!generatedSite) return;
              setPublishing(true); setPublishErr('');
              try {
                const html = generatedSite.files['main/frontend/preview.html'] || '';
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
          <div style={isDesktop ? { width: leftW } : undefined} className="border-b md:border-b-0 md:border-r h-[45vh] md:h-auto flex flex-col overflow-hidden shrink-0 bg-[#111111] border-white/[0.06]">
            {isGenerating ? (
              /* Thinking State */
              <div className="flex-1 p-5 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
                    <Sparkles size={14} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">SiteMorph Agent</div>
                    <div className="text-[10px] text-white/40">Pracuję nad Twoją stroną...</div>
                  </div>
                </div>
                <ThinkingState step={genStep} />
              </div>
            ) : generatedSite ? (
              /* After Generation — summary */
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Strona gotowa!</div>
                    <div className="text-[10px] text-white/40">{generatedSite.title}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button onClick={() => setIsEditMode((v) => { const nv = !v; try { const doc = previewRef.current?.contentDocument; if (doc) doc.body.contentEditable = nv ? 'true' : 'false'; } catch {} return nv; })} className={`w-full py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${isEditMode ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80'}`}>
                    <MousePointer2 size={12} className="inline mr-1.5" />
                    {isEditMode ? 'Wyłącz edycję' : 'Edytuj tekst'}
                  </button>
                  <button onClick={handleSaveProject} className="w-full py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 transition-colors cursor-pointer border-none">
                    <Save size={12} className="inline mr-1.5" />
                    {currentProjectId ? 'Zapisz zmiany' : 'Zapisz projekt'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('html')} className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-white/5 border border-white/10 text-white/60 hover:text-white/80 transition-colors cursor-pointer">
                      <Download size={11} className="inline mr-1" /> HTML
                    </button>
                    <button onClick={() => handleDownload('react')} className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-white/5 border border-white/10 text-white/60 hover:text-white/80 transition-colors cursor-pointer">
                      <Download size={11} className="inline mr-1" /> React
                    </button>
                  </div>
                  {saveMsg && <p className="text-[10px] text-green-400 text-center">{saveMsg}</p>}
                </div>

                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="text-[10px] text-white/30 font-semibold mb-2 uppercase tracking-wider">Projekty</div>
                  {savedProjects.length === 0 ? (
                    <p className="text-[10px] text-white/20">Brak zapisanych projektów</p>
                  ) : savedProjects.slice(0, 5).map((p) => (
                    <button key={p.id} onClick={() => {
                      const meta = p.content?.meta || {};
                      setGeneratedSite({ title: p.name, category: p.niche || '', domain: p.domain, headline: meta.headline || p.name, subheadline: meta.subheadline || '', ctaText: meta.ctaText || 'Kontakt', files: p.content?.files || {} });
                      setCurrentProjectId(p.id);
                    }} className="w-full text-left px-2 py-1.5 rounded-md text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer border-none bg-transparent truncate">
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
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
                      <svg fill="none" height="24" viewBox="0 0 48 48" width="24">
                        <path d="m6 24c11.4411 0 18-6.5589 18-18 0 11.4411 6.5589 18 18 18-11.4411 0-18 6.5589-18 18 0-11.4411-6.5589-18-18-18z" fill="url(#sm-grad)" fillRule="evenodd" />
                        <defs><linearGradient id="sm-grad" x1="24" x2="24" y1="6" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor="#22c55e" stopOpacity=".8" /><stop offset="1" stopColor="#3b82f6" stopOpacity=".5" /></linearGradient></defs>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white/80">Cześć! 👋</h2>
                      <h3 className="text-base font-semibold text-white">Opisz stronę, a ją zbuduję.</h3>
                    </div>
                  </div>

                  <p className="text-xs text-white/40 leading-relaxed">
                    Wklej dane firmy prosto z Google Maps albo opisz własnymi słowami. Zbuduję kompletną stronę z treściami, zdjęciami i formularzem kontaktowym.
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((qp) => (
                      <button key={qp.label} onClick={() => setBuilderPrompt(qp.prompt)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/5 border border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors cursor-pointer">
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
                  />
                )}

                {/* Chat Input — Border Beam */}
                <div className="p-3 border-t border-white/[0.06]">
                  <div>
                    <div className="relative rounded-xl bg-[#1a1d23] border border-white/[0.08] overflow-hidden">
                      <textarea
                        rows={3}
                        value={builderPrompt}
                        onChange={(e) => setBuilderPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setWizardStep(0); setShowWizard(true);
                          }
                        }}
                        placeholder="Opisz stronę, którą chcesz zbudować..."
                        className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-white/25 resize-none px-4 pt-4 pb-2 min-h-[80px]"
                      />
                      <div className="flex items-center justify-between px-3 pb-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-md hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors cursor-pointer border-none bg-transparent">
                            <Paperclip size={14} />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors cursor-pointer border-none bg-transparent">
                            <ImageIcon size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setBuilderMode(builderMode === 'normal' ? 'ultra' : 'normal')}
                            className={`px-2 py-0.5 rounded text-[9px] font-semibold cursor-pointer border transition-all ${builderMode === 'ultra' ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}>
                            {builderMode === 'ultra' ? 'ULTRA' : 'NORMAL'}
                          </button>
                          <span className="text-[10px] text-white/20 font-medium">{cost} kr.</span>
                          <button
                            onClick={() => { setWizardStep(0); setShowWizard(true); }}
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
            className={`hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center transition-colors ${isDraggingSplit ? 'bg-green-500/10' : 'hover:bg-white/5'}`}
          >
            <div className={`w-0.5 h-12 rounded-full transition-colors ${isDraggingSplit ? 'bg-green-500/40' : 'bg-white/10'}`} />
          </div>

          {/* Right Panel — Preview / Code */}
          <div className="flex-1 min-h-0 overflow-hidden flex bg-[#0a0a0a] p-2">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div key="loading" initial={{ opacity: 0, filter: 'blur(8px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center rounded-xl bg-[#111111] border border-white/[0.06]">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/10 grid place-items-center mb-3">
                    <Sparkles size={18} className="text-green-400" />
                  </motion.div>
                  <div className="text-xs font-medium text-white/60">'Tworzę stronę...'</div>
                </motion.div>
              ) : !generatedSite ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center rounded-xl bg-[#111111] border border-white/[0.06]">
                  <div className="text-center space-y-2 p-8">
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center mx-auto">
                      <Monitor size={24} className="text-white/20" />
                    </div>
                    <h3 className="text-sm font-semibold text-white/40">Podgląd strony</h3>
                    <p className="text-xs text-white/20 max-w-xs">Opisz stronę w panelu po lewej, aby wygenerować podgląd.</p>
                  </div>
                </motion.div>
              ) : activeMode === 'preview' ? (
                <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden bg-[#111111] border border-white/[0.06]">
                  <div className="h-8 border-b border-white/[0.06] flex items-center justify-between px-3 shrink-0">
                    <span className="text-[10px] text-white/40 font-medium truncate">{generatedSite.domain}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[9px] font-semibold">LIVE</span>
                    </div>
                  </div>
                  {(() => {
                    const previewHtml = generatedSite.files['main/frontend/preview.html'] || '';
                    const srcDoc = previewHtml || `<html><body style="background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter"><h1>${generatedSite.headline}</h1></body></html>`;
                    return (
                      <iframe ref={previewRef} title="Podgląd" className="flex-1 w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" srcDoc={srcDoc} />
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex rounded-xl overflow-hidden bg-[#111111] border border-white/[0.06]">
                  <div className="w-48 bg-[#0d0d0d] border-r border-white/[0.06] p-2 space-y-0.5 overflow-y-auto">
                    <span className="text-[9px] text-white/30 font-semibold block mb-1 uppercase tracking-wider">Pliki</span>
                    {Object.keys(generatedSite.files).map((fname) => (
                      <button key={fname} onClick={() => setSelectedFile(fname)} className={`w-full text-left px-2 py-1 rounded text-[10px] font-medium truncate border-none cursor-pointer ${selectedFile === fname ? 'bg-white/10 text-white' : 'bg-transparent text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                        {fname.split('/').pop()}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 p-3 overflow-y-auto bg-[#0a0a0a]">
                    <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words text-green-300/80">{generatedSite.files[selectedFile] || ''}</pre>
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
                className="fixed right-0 top-0 bottom-0 w-[340px] max-w-[90vw] z-[61] bg-[#111111] border-l border-white/[0.06] shadow-2xl flex flex-col">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className="text-sm font-semibold text-white">Opublikowano!</span>
                  </div>
                  <button onClick={() => setPublishedUrl(null)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 text-white/40 cursor-pointer border-none bg-transparent"><X size={14} /></button>
                </div>
                <div className="p-5 space-y-3 flex-1">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/[0.06]">
                    <input readOnly value={publishedUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 bg-transparent text-xs font-medium text-white outline-none min-w-0" />
                    <button onClick={() => navigator.clipboard?.writeText(publishedUrl)} className="px-2.5 py-1 rounded-md bg-white text-black text-[10px] font-semibold shrink-0 cursor-pointer border-none">Kopiuj</button>
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
