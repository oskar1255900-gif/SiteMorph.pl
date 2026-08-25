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
} from 'lucide-react';
import { Button } from '../components/ui';
import { springTransition } from '../lib/shared';
import { apiFetch, API_BASE } from '../lib/api';
import { GeneratedWebsite } from '../types';

export const PREVIEW_FALLBACK_HTML = `<!doctype html><html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>SiteMorph Preview</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white text-neutral-900"><div class="max-w-6xl mx-auto px-6 py-16 text-center"><h1 class="text-4xl font-black">Podglad dziala</h1><p class="mt-3 text-neutral-600">Vite + React + Tailwind — wygenerowane przez SiteMorph + Laguna S 2.1</p></div></body></html>`;

// ============================================================================
// 3. STYLE GLOBALNE (INSTRUMENT SERIF ITALIC + SF PRO)
// ============================================================================
export const BuilderFullView = ({
  initialPrompt = '',
  onBack,
  credits,
  setCredits
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
  const GEN_MSGS = ['Analizuję prompt…', 'Generuję sekcje…', 'Dobieram paletę i grafiki…', 'Składam podgląd na żywo…'];

  useEffect(() => {
    if (!isGenerating) return;
    const id = setInterval(() => setGenStep((s) => (s + 1) % GEN_MSGS.length), 360);
    return () => clearInterval(id);
  }, [isGenerating]);

  useEffect(() => {
    if (initialPrompt) {
      handleGenerate(initialPrompt);
    }
  }, []);

  const [q1, setQ1] = useState('Restauracja');
  const [q2, setQ2] = useState('Nowoczesny, minimalistyczny');
  const [q3, setQ3] = useState('Limonkowy #a3e635 + czarny + biały');
  const [q4, setQ4] = useState<string[]>(['Hero', 'Oferta', 'Cennik', 'Kontakt']);
  const [selectedFile, setSelectedFile] = useState('main/frontend/index.html');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState('');

  // --- Zapisywanie projektów na koncie (backend /api/projects) ---
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const loadProjects = async () => {
    try {
      const res = await apiFetch('/api/projects/');
      if (res.ok) setSavedProjects((await res.json()) || []);
    } catch { /* brak sesji — pomijamy */ }
  };
  useEffect(() => { loadProjects(); }, []);

  const handleSaveProject = async () => {
    if (!generatedSite) return;
    setSaveMsg('');
    try {
      if (currentProjectId) {
        const res = await apiFetch(`/api/projects/${currentProjectId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: generatedSite.title }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Błąd ${res.status}`);
        setSaveMsg('Zapisano zmiany w projekcie');
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
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Błąd ${res.status}`);
        const saved = await res.json();
        setCurrentProjectId(saved.id);
        setSaveMsg('Projekt zapisany na koncie ✓');
      }
      await loadProjects();
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e: any) {
      setSaveMsg(e.message || 'Zapis wymaga zalogowania');
    }
  };

  const commitTitle = async () => {
    setEditingTitle(false);
    const name = titleDraft.trim();
    if (!name || !generatedSite || name === generatedSite.title) return;
    setGeneratedSite({ ...generatedSite, title: name });
    if (currentProjectId) {
      try {
        await apiFetch(`/api/projects/${currentProjectId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
        await loadProjects();
      } catch { /* ok */ }
    }
  };

  const handleRenameProject = async (id: number) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name) return;
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      await loadProjects();
    } catch { /* ok */ }
  };

  const handleLoadProject = (p: any) => {
    const meta = p.content?.meta || {};
    setGeneratedSite({
      title: p.name,
      category: p.niche || '',
      domain: p.domain,
      headline: meta.headline || p.name,
      subheadline: meta.subheadline || '',
      ctaText: meta.ctaText || 'Kontakt',
      files: p.content?.files || {},
    });
    setCurrentProjectId(p.id);
    setSelectedFile('main/frontend/index.html');
  };

  const handleDeleteProject = async (id: number) => {
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (currentProjectId === id) setCurrentProjectId(null);
      await loadProjects();
    } catch { /* ok */ }
  };

  const toggleQ4 = (v: string) => setQ4((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [isProMode, setIsProMode] = useState(false);
  const cost = isProMode ? 15 : 10;

  // Przesuwalna granica miedzy panelem promptu a podgladem
  const splitRef = useRef<HTMLDivElement>(null);
  const [leftW, setLeftW] = useState(340);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [isEditMode, setIsEditMode] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
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
      setLeftW(Math.min(Math.max(e.clientX - rect.left, 260), Math.floor(rect.width * 0.65)));
    };
    const up = () => setIsDraggingSplit(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isDraggingSplit]);

  const WIZARD_DATA: Array<{ title: string; options: string[]; multi?: boolean }> = [
    { title: 'Jaki klimat ma mieć strona?', options: ['Ciepła, rustykalna piekarnia (beże, brązy, drewno)', 'Elegancka bistro / bistro-żydowska tradycja (ciemna, szlachetna)', 'Nowoczesna, minimalistyczna', 'Inne — wpiszę w prompt'] },
    { title: 'Jaki to biznes?', options: ['Restauracja', 'Barber', 'Salon beauty', 'Siłownia', 'Warsztat', 'Kwiaciarnia', 'Inne'] },
    { title: 'Jakie kolory lubisz?', options: ['Limonkowy + czarny', 'Niebieski + biały', 'Beż + brąz', 'Czarny + złoty', 'Fiolet + róż', 'Dowolne — AI dobierze'] },
    { title: 'Które sekcje dodać?', options: ['Hero', 'Oferta', 'Cennik', 'Galeria', 'Opinie', 'Kontakt', 'Rezerwacja', 'FAQ'], multi: true },
  ];

  const buildPrompt = (override?: string) => {
    const extra = override || builderPrompt;
    const sections = q4.join(', ');
    return `Branża: ${q1}. Styl: ${q2}. Kolory: ${q3}. Sekcje: ${sections}. ${extra ? `Dodatkowy opis: ${extra}.` : ''} Tryb: ${isProMode ? 'PRO premium z animacjami' : 'standard'} — Zbuduj premium stronę Vite+React+Tailwind.`;
  };

  const starterIdeas = [
    { title: 'Luksusowa agencja nieruchomości', icon: Home },
    { title: 'Nowoczesny landing page dla SaaS', icon: Zap },
    { title: 'Restauracja z menu i rezerwacją', icon: Coffee },
    { title: 'Portfolio agencji kreatywnej', icon: Briefcase }
  ];

  const handleGenerate = async (promptText?: string) => {
    const p = buildPrompt(promptText);
    if (!p.trim()) return;
    if (credits < cost) {
      alert(`Brak kredytów! Potrzeba ${cost}, masz ${credits}. Sprawdź dostępne plany w sekcji Cennik.`);
      return;
    }
    setIsGenerating(true);
    setGenStep(0);
    setSelectedFile('src/App.tsx');
    setShowWizard(false);
    try {
      const plan = (() => { try { return localStorage.getItem('sitemorph-plan') || 'Starter' } catch { return 'Starter' } })();
      const res = await apiFetch('/api/builder/generate', {
        method: 'POST',
        headers: { 'X-User-Plan': plan },
        // Vercel Hobby 10s → frontend 9s (Laguna 8s + fallback instant)
        timeoutMs: 9000,
        body: JSON.stringify({
          business_name: q1,
          niche: q1,
          description: p,
          style: q2,
          colors: q3,
          sections: q4,
          extraPrompt: promptText || builderPrompt,
        }),
      } as any);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.warning || `Błąd generowania: HTTP ${res.status}`);
      }
      const data = await res.json();
      const files: Record<string, string> = data.files || {};
      const meta = data.meta || {};
      setGeneratedSite({
        title: meta.title || p.slice(0, 28),
        category: q1,
        domain: `${q1.toLowerCase().replace(/\s+/g, '')}.sitemorph.pl`,
        headline: meta.headline || p,
        subheadline: meta.subheadline || `Wygenerowane przez SiteMorph AI (${data.provider || 'AI'})`,
        ctaText: meta.ctaText || 'Skontaktuj się',
        files,
      });
      const first = Object.keys(files).find(f => f.endsWith('index.html')) || Object.keys(files)[0];
      if (first) setSelectedFile(first);
      setCredits((c) => Math.max(0, c - cost));
      if (data.warning) {
        console.warn('[Builder] Warning:', data.warning);
      }
    } catch (e: any) {
      console.error('[Builder] Generation error:', e);
      const msg = e.message || 'Błąd generowania — sprawdź konsolę';
      setGeneratedSite({
        title: p.slice(0, 25),
        category: q1,
        domain: 'mojastrona.sitemorph.pl',
        headline: p,
        subheadline: `Błąd: ${msg}`,
        ctaText: 'Skontaktuj się',
        files: {
          'src/App.tsx': `export default function App(){return <div className="p-8"><h1>${p}</h1><p style="color:red">${msg}</p></div>}`,
        },
      });
      setCredits((c) => Math.max(0, c - cost));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWizardNext = () => {
    if (wizardStep < WIZARD_DATA.length - 1) {
      setWizardStep((s) => s + 1);
    } else {
      handleGenerate();
    }
  };

  const handleWizardAuto = () => {
    const opts = WIZARD_DATA[wizardStep].options;
    if (WIZARD_DATA[wizardStep].multi) {
      const shuffled = [...opts].sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 2));
      shuffled.forEach((o) => {
        if (wizardStep === 3) toggleQ4(o);
      });
      if (wizardStep === 3 && q4.length === 0) setQ4(['Hero', 'Kontakt']);
    } else {
      const pick = opts[Math.floor(Math.random() * opts.length)];
      if (wizardStep === 0) setQ2(pick);
      if (wizardStep === 1) setQ1(pick);
      if (wizardStep === 2) setQ3(pick);
    }
    // auto next
    setTimeout(() => handleWizardNext(), 280);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen flex flex-col overflow-hidden select-none bg-white dark:bg-black text-blue-600 dark:text-white"
    >
      <header className="h-14 border-b px-4 flex items-center justify-between shrink-0 bg-white dark:bg-black border-blue-200 dark:border-neutral-900 text-blue-600 dark:text-white">
        <motion.button 
          whileHover={{ x: -2 }}
          onClick={onBack} 
          className="flex items-center gap-2 text-blue-600 dark:text-white hover:text-emerald-400 font-black text-sm transition-colors cursor-pointer bg-transparent border-none"
        >
          <ArrowLeft size={16} />
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="SiteMorph" width="24" height="24" className="rounded-lg shadow-sm" />
            Kreator SiteMorph
          </div>
        </motion.button>

        <div className="flex items-center gap-1 bg-blue-50 dark:bg-neutral-900 p-1 rounded-xl border border-blue-200 dark:border-neutral-800">
          {(['preview', 'code'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`relative flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer border-none ${
                activeMode === mode ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white'
              }`}
            >
              {activeMode === mode && (
                <motion.div
                  layoutId="builderModePill"
                  transition={springTransition}
                  className="absolute inset-0 bg-blue-600 dark:bg-white rounded-lg shadow-sm"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {mode === 'preview' ? <Monitor size={14} /> : <CodeIcon size={14} />}
                {mode === 'preview' ? 'Podgląd' : 'Kod'}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black text-blue-600 dark:text-white bg-blue-50 dark:bg-neutral-900 px-2.5 py-1 rounded-md border border-blue-200 dark:border-neutral-800 flex items-center gap-1.5">
            <RefreshCw size={12} className={isGenerating ? 'animate-spin text-emerald-400' : ''} /> Autozapis
          </div>
          <Button
            variant="primary" size="sm"
            disabled={isGenerating || !generatedSite || publishing}
            onClick={async () => {
              if (!generatedSite) return;
              setPublishing(true); setPublishErr('');
              try {
                const html = generatedSite.files['main/frontend/preview.html'] || generatedSite.files['main/frontend/index.html'] || generatedSite.files['index.html'] || '';
                const res = await apiFetch('/api/publish', {
                  method: 'POST',
                  body: JSON.stringify({ html, title: generatedSite.title }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || `Błąd ${res.status}`);
                const apiOrigin = API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`;
                const full = `${apiOrigin}${data.url}`;
                setPublishedUrl(full);
                navigator.clipboard?.writeText(full).catch(()=>{});
              } catch (e: any) {
                setPublishErr(e.message || 'Błąd publikacji');
              } finally { setPublishing(false) }
            }}
            className="font-black"
          >
            {publishing ? 'Publikuję…' : 'Opublikuj'}
          </Button>
        </div>
      </header>

      <div ref={splitRef} className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div
          style={isDesktop ? { width: leftW } : undefined}
          className="border-b md:border-b-0 md:border-r h-[46vh] md:h-auto flex flex-col overflow-hidden shrink-0 bg-white dark:bg-black border-blue-100 dark:border-neutral-900 text-blue-600 dark:text-white"
        >
          <div className="flex-1 p-4 overflow-y-auto no-scrollbar space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-white flex items-center justify-center mx-auto mb-3 border border-blue-200 dark:border-neutral-800 shadow-sm">
                <Globe size={24} />
              </div>
              <h3 className="font-black text-sm">Zbuduj swoją stronę</h3>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Kompletny serwis z treściami, grafikami i formularzem kontaktowym.
              </p>
            </div>

            <div className="rounded-lg border p-3 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/20">
              <p className="text-[11px] font-bold leading-relaxed opacity-80">
                Wklej dane firmy prosto z Google Maps (nazwa, adres, telefon, opinie) albo opisz własnymi słowami —
                <span className="font-black"> Gemini Flash </span>
                zbuduje kompletną stronę i nigdy nie będzie pytać o szczegóły.
              </p>
            </div>
          </div>

          <div className="p-3 border-t bg-blue-50/30 dark:bg-black border-blue-100 dark:border-neutral-900">
            <div className="rounded-lg border p-3 shadow-md bg-white dark:bg-neutral-950 border-blue-200 dark:border-neutral-800">
              <textarea
                rows={5}
                value={builderPrompt}
                onChange={(e) => setBuilderPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // Masz opis? Generuj OD RAZU bez żadnych pytań.
                    if (builderPrompt.trim()) handleGenerate();
                    else { setWizardStep(0); setShowWizard(true); }
                  }
                }}
                placeholder="Wklej dane z Google Maps albo opisz firmę (Enter = generuj)..."
                className="w-full bg-transparent border-none outline-none text-xs font-semibold leading-relaxed placeholder:text-blue-400 dark:placeholder:text-neutral-500 resize-y text-blue-600 dark:text-white min-h-[90px]"
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex gap-2">
                  <motion.button whileHover={{ scale: 1.1 }} className="hover:text-emerald-400 cursor-pointer bg-transparent border-none text-inherit"><Paperclip size={14} /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} className="hover:text-emerald-400 cursor-pointer bg-transparent border-none text-inherit"><CodeIcon size={14} /></motion.button>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (builderPrompt.trim()) handleGenerate();
                    else { setWizardStep(0); setShowWizard(true); }
                  }}
                  className="w-7 h-7 bg-blue-600 text-white dark:bg-white dark:text-black rounded-lg flex items-center justify-center cursor-pointer border-none font-black shadow-md"
                  title={builderPrompt.trim() ? `Generuj — ${cost} kredytów` : 'Otwórz kreator pytań'}
                >
                  <Send size={12} />
                </motion.button>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-100 dark:border-neutral-800 gap-1.5">
                <span className="text-[10px] font-black opacity-60">{credits} kr.</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setBuilderPrompt(p => p + (p ? ' ' : '') + ` Dodaj galerię 6 prawdziwych zdjęć z Unsplash dla branży ${q1} (https://source.unsplash.com/800x600/?${encodeURIComponent(q1)})`)} className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:brightness-95 flex items-center gap-1">
                    <ImageIcon size={10} /> Zdjęcia
                  </button>
                  <button onClick={() => setIsProMode(!isProMode)} className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer border ${isProMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent opacity-60 hover:opacity-100 border-blue-200 dark:border-neutral-700'}`}>
                    PRO · {cost} kr
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          onMouseDown={(e) => { e.preventDefault(); setIsDraggingSplit(true); }}
          className={`hidden md:flex w-[9px] shrink-0 cursor-col-resize items-center justify-center transition-colors ${isDraggingSplit ? 'bg-blue-100 dark:bg-neutral-900' : 'hover:bg-blue-50 dark:hover:bg-neutral-900/60'}`}
          title="Przeciągnij, aby zmienić szerokość panelu"
        >
          <div className={`w-[3px] h-14 rounded-lg transition-colors ${isDraggingSplit ? 'bg-blue-500' : 'bg-blue-200 dark:bg-neutral-800'}`} />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex bg-blue-50/20 dark:bg-black">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
                className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 relative overflow-hidden"
              >
                <div className="pointer-events-none absolute w-[360px] h-[360px] bg-gradient-to-tr from-lime-200 via-emerald-100 to-lime-200 dark:from-lime-500/15 dark:via-emerald-400/10 dark:to-lime-400/15 blur-3xl morph-blob opacity-70" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                  className="w-12 h-12 rounded-2xl bg-blue-600 dark:bg-white text-white dark:text-black grid place-items-center shadow-lg"
                >
                  <Sparkles size={22} />
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={genStep}
                    initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                    transition={{ duration: 0.22 }}
                    className="text-xs font-black tracking-wide"
                  >
                    {GEN_MSGS[genStep]}
                  </motion.div>
                </AnimatePresence>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ scale: genStep === i ? 1.6 : 1, opacity: genStep === i ? 1 : 0.3 }}
                      className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-white"
                    />
                  ))}
                </div>
              </motion.div>
            ) : !generatedSite ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex items-center justify-center p-6"
              >
                <div className="text-center space-y-2 p-12 rounded-3xl border shadow-xl bg-white dark:bg-neutral-950 border-blue-200 dark:border-neutral-900">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border bg-blue-50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800">
                    <Monitor size={28} />
                  </div>
                  <h3 className="text-base font-black">Brak podglądu</h3>
                  <p className="text-xs font-bold max-w-xs opacity-80">Wpisz instrukcję w panelu po lewej, aby wygenerować pierwszy podgląd na żywo.</p>
                </div>
              </motion.div>
            ) : activeMode === 'preview' ? (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={springTransition}
                className="flex-1 flex min-h-0 overflow-hidden bg-white dark:bg-black"
              >
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="h-9 border-b border-blue-100 dark:border-neutral-900 flex items-center justify-between px-3 bg-blue-50/40 dark:bg-neutral-950 text-[11px] font-bold shrink-0 gap-2">
                    <span className="flex items-center gap-2 truncate"><Globe size={12} className="shrink-0" /> {generatedSite.domain} — Podgląd</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { const on = !isEditMode; setIsEditMode(on); try { const doc = previewRef.current?.contentDocument; if (doc) doc.body.contentEditable = on ? 'true' : 'false'; } catch {} }} className={`px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center gap-1 ${isEditMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 hover:bg-blue-50'}`}>
                        <MousePointer2 size={11} /> {isEditMode ? 'Edycja: ON' : 'Kliknij by edytować'}
                      </button>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black hidden sm:inline">LIVE</span>
                    </div>
                  </div>
                  {(() => {
                    const viteShell = generatedSite.files['main/frontend/index.html'] || '';
                    const isViteShell = viteShell.includes('src/main.tsx');
                    const previewHtml = generatedSite.files['main/frontend/preview.html'] || (isViteShell ? '' : viteShell) || generatedSite.files['index.html'] || '';
                    const srcDoc = previewHtml || `<!doctype html><html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${generatedSite.title}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white text-neutral-900"><div class="max-w-6xl mx-auto px-6 py-16 text-center"><h1 class="text-4xl font-black">${generatedSite.headline}</h1><p class="mt-3 text-neutral-600">${generatedSite.subheadline}</p><a href="#" class="inline-block mt-6 bg-black text-white px-6 py-3 rounded-full font-black">${generatedSite.ctaText}</a></div></body></html>`;
                    return (
                      <iframe
                        ref={previewRef}
                        title="Podgląd"
                        className="flex-1 w-full border-0 bg-white"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        srcDoc={srcDoc}
                      />
                    );
                  })()}
                </div>
                <div className="hidden lg:flex w-64 border-l bg-white dark:bg-neutral-950 flex-col shrink-0 overflow-hidden">
                  <div className="p-4 border-b border-blue-100 dark:border-neutral-800 space-y-1">
                    <div className="text-[11px] font-black tracking-wider uppercase opacity-60">Podgląd</div>
                    {editingTitle ? (
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                        className="w-full text-xs font-bold bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800 rounded-lg px-2 py-1 outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => { setTitleDraft(generatedSite.title); setEditingTitle(true); }}
                        title="Kliknij, aby zmienić nazwę"
                        className="text-xs font-bold truncate hover:text-emerald-500 cursor-pointer bg-transparent border-none text-inherit w-full text-left flex items-center gap-1.5"
                      >
                        {generatedSite.title} <Pencil size={10} className="opacity-50 shrink-0" />
                      </button>
                    )}
                    <div className="flex items-center gap-2 text-[11px]"><Eye size={12} className="opacity-60"/> 2 online</div>
                  </div>
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    <div className="text-[10px] font-black opacity-60">Dostosuj, co tylko chcesz</div>
                    <p className="text-xs leading-relaxed opacity-80">Kliknij tekst w podglądzie (tryb edycji) lub poproś AI: „zmień nagłówek na…”, „dodaj zdjęcie”.</p>
                    <button onClick={() => setIsEditMode(v => { const nv=!v; try{const d=previewRef.current?.contentDocument; if(d) d.body.contentEditable=nv?'true':'false';}catch{} return nv; })} className={`w-full py-2 rounded-xl text-xs font-black border ${isEditMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 hover:bg-blue-50'}`}>{isEditMode ? 'Wyłącz edycję' : 'Włącz edycję tekstu'}</button>
                    <div className="pt-3 border-t border-blue-100 dark:border-neutral-800 space-y-2">
                      <div className="text-[10px] font-black opacity-60">Link do podglądu</div>
                      <div className="text-[11px] font-mono truncate bg-blue-50 dark:bg-neutral-900 p-2 rounded-lg border border-blue-100 dark:border-neutral-800">{generatedSite.domain}</div>
                      <button onClick={handleSaveProject} className="w-full py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black text-xs font-black flex items-center justify-center gap-1.5"><Save size={12}/> {currentProjectId ? 'Zapisz zmiany' : 'Zapisz projekt'}</button>
                      {saveMsg && <p className="text-[10px] font-black text-emerald-500">{saveMsg}</p>}
                    </div>
                    <div className="pt-3 border-t border-blue-100 dark:border-neutral-800 space-y-2">
                      <div className="text-[10px] font-black opacity-60 flex items-center gap-1"><FolderOpen size={11}/> Twoje projekty</div>
                      {savedProjects.length === 0 ? (
                        <p className="text-[10px] font-bold opacity-60">Brak zapisanych projektów.</p>
                      ) : savedProjects.map((p) => (
                        <div key={p.id} className="rounded-lg border border-blue-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 space-y-1">
                          {renamingId === p.id ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={() => handleRenameProject(p.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                              className="w-full text-[11px] font-bold bg-blue-50 dark:bg-neutral-950 border border-blue-200 dark:border-neutral-800 rounded px-1.5 py-0.5 outline-none"
                            />
                          ) : (
                            <button onClick={() => { setRenameDraft(p.name); setRenamingId(p.id); }} className="w-full text-left text-[11px] font-black truncate hover:text-emerald-500 flex items-center gap-1 cursor-pointer bg-transparent border-none text-inherit">
                              {p.name} <Pencil size={9} className="opacity-40 shrink-0" />
                            </button>
                          )}
                          <div className="flex gap-1">
                            <button onClick={() => handleLoadProject(p)} className="flex-1 py-1 rounded-md text-[10px] font-black bg-blue-50 dark:bg-neutral-950 border border-blue-100 dark:border-neutral-800 hover:bg-blue-100 cursor-pointer">Wczytaj</button>
                            <button onClick={() => handleDeleteProject(p.id)} className="px-2 py-1 rounded-md text-[10px] font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-neutral-950 border border-transparent hover:border-rose-200 cursor-pointer bg-transparent"><Trash2 size={11} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="code"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex font-mono text-xs overflow-hidden"
              >
                <div className="w-56 bg-blue-50 dark:bg-neutral-950 border-r border-blue-200 dark:border-neutral-900 p-3 space-y-1 overflow-y-auto no-scrollbar">
                  <span className="text-[9px] font-black block mb-2 opacity-70 uppercase tracking-wider">Drzewo plikow — Vite</span>
                  {Object.keys(generatedSite.files).map((fname) => (
                    <button
                      key={fname}
                      onClick={() => setSelectedFile(fname)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold truncate border ${selectedFile === fname ? 'bg-blue-600 text-white dark:bg-white dark:text-black border-transparent shadow-sm' : 'bg-white dark:bg-neutral-900 border-blue-100 dark:border-neutral-800 hover:border-blue-300'}`}
                    >
                      {fname}
                    </button>
                  ))}
                </div>
                <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-white dark:bg-black flex flex-col">
                  <div className="flex items-center justify-between mb-2 text-[10px] font-black opacity-60 shrink-0">
                    <span className="truncate">{selectedFile}</span>
                    <button onClick={() => navigator.clipboard.writeText(generatedSite.files[selectedFile] || '')} className="px-2 py-1 rounded-full border bg-blue-50 dark:bg-neutral-900 border-blue-100 dark:border-neutral-800 cursor-pointer">Kopiuj</button>
                  </div>
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words bg-neutral-950 text-lime-300 p-4 rounded-xl overflow-x-auto flex-1">{generatedSite.files[selectedFile] || ''}</pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Panel boczny publikacji — wysuwa się z prawej */}
      <AnimatePresence>
        {publishedUrl && (
          <>
            <motion.div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPublishedUrl(null)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring' as const, stiffness: 380, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 w-[380px] max-w-[92vw] z-[61] bg-white dark:bg-neutral-950 border-l border-blue-100 dark:border-neutral-800 shadow-2xl flex flex-col">
              <div className="p-6 border-b border-blue-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 grid place-items-center"><CheckCircle2 size={18} /></div>
                  <div><h3 className="font-black text-sm">Opublikowano!</h3><p className="text-[11px] font-semibold opacity-60">Link działa na serio</p></div>
                </div>
                <button onClick={() => setPublishedUrl(null)} className="w-8 h-8 rounded-lg grid place-items-center hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                <p className="text-xs font-semibold opacity-70 text-center">Wyślij klientowi — otworzy na telefonie i zobaczy stronę.</p>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">
                  <input readOnly value={publishedUrl} onFocus={(e)=>e.currentTarget.select()} className="flex-1 bg-transparent text-[12px] font-bold outline-none min-w-0" />
                  <button onClick={() => navigator.clipboard?.writeText(publishedUrl)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white dark:bg-white dark:text-black text-[11px] font-black shrink-0">Kopiuj</button>
                </div>
                {publishErr && <p className="text-xs font-bold text-rose-600">{publishErr}</p>}
                <a href={publishedUrl} target="_blank" rel="noreferrer" className="block"><Button variant="primary" size="md" className="w-full">Otwórz stronę</Button></a>
                <div className="pt-4 border-t border-blue-100 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between text-xs"><span className="opacity-60">Status</span><span className="font-black text-emerald-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> Live</span></div>
                  <div className="flex items-center justify-between text-xs"><span className="opacity-60">Aktualnie na stronie</span><span className="font-black">—</span></div>
                  <button onClick={handleSaveProject} className="w-full py-2 rounded-xl border text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-900">{currentProjectId ? 'Zapisz zmiany w projekcie' : 'Zapisz projekt na koncie'}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Wizard 4 pytań — tylko gdy prompt jest pusty */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWizard(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 8, opacity: 0 }}
              transition={{ type: 'spring' as const, stiffness: 320, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                <div className="flex items-center gap-2 text-white font-black text-sm"><Sparkles size={14} className="text-emerald-400" /> Agent ma pytania</div>
                <button onClick={() => setShowWizard(false)} className="text-neutral-400 hover:text-white cursor-pointer bg-transparent border-none"><X size={14} /></button>
              </div>
              <div className="p-5 space-y-3">
                <h3 className="font-black text-white text-sm">{WIZARD_DATA[wizardStep].title}</h3>
                <div className="space-y-2">
                  {WIZARD_DATA[wizardStep].options.map((opt) => {
                    const isChecked = wizardStep === 0 ? q2 === opt : wizardStep === 1 ? q1 === opt : wizardStep === 2 ? q3 === opt : q4.includes(opt);
                    return (
                      <label key={opt} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${isChecked ? 'bg-white text-black border-white' : 'bg-neutral-800 text-white border-neutral-700 hover:border-neutral-600'}`}>
                        <input
                          type={WIZARD_DATA[wizardStep].multi ? 'checkbox' : 'radio'}
                          checked={isChecked}
                          onChange={() => {
                            if (wizardStep === 0) setQ2(opt);
                            else if (wizardStep === 1) setQ1(opt);
                            else if (wizardStep === 2) setQ3(opt);
                            else toggleQ4(opt);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-xs font-bold leading-tight">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800 bg-neutral-950">
                <span className="text-[11px] font-bold text-neutral-400">Pytanie {wizardStep + 1} z 4 · koszt {cost} kr.</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleWizardAuto} className="bg-neutral-800 text-white hover:bg-neutral-700">Auto</Button>
                  <Button variant="primary" size="sm" onClick={handleWizardNext} className="font-black">{wizardStep === 3 ? 'Generuj' : 'Dalej'}</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
