import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { compileReactProject, warmPreviewCompiler, sourceHash, COMPILER_VERSION } from '../lib/previewCompiler';
import {
  Sparkles,
  CheckCircle2,
  Send,
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Code as CodeIcon,
  Zap,
  Briefcase,
  X,
  Home,
  Coffee,
  ArrowLeft,
  Image as ImageIcon,
  Save,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui';
import { springTransition } from '../lib/shared';
import { apiFetch, API_BASE } from '../lib/api';
import { GeneratedWebsite } from '../types';
import { ThinkingSteps } from './ThinkingSteps';

// Legacy wizard scaffolding — the wizard never opened in the redesigned
// UI (the prompt is typed directly). Kept as dead code only so we do not
// duplicate the questions endpoint logic here.



// ============================================================================
// LIVE REACT PREVIEW — REAL GENERATED REACT, COMPILED IN THE BROWSER
// No Sandpack, no CodeSandbox Nodebox, no AI-generated preview.html.
// ============================================================================

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

const MODE_OPTIONS: { value: 'normal' | 'ultra' | 'ultra+'; label: string; hint: string }[] = [
  { value: 'normal', label: 'S1', hint: 'S1 — ten sam model i jedno żądanie, 15 kredytów' },
  { value: 'ultra', label: 'S1+', hint: 'S1+ — ten sam model i jedno żądanie, 45 kredytów' },
  { value: 'ultra+', label: 'S1 Pro', hint: 'S1 Pro — ten sam model i jedno żądanie, 150 kredytów' },
];

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
  const [activeMode, setActiveMode] = useState<'preview' | 'code'>('preview');
  const [builderPrompt, setBuilderPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<'generate' | 'parse' | 'validate' | 'compile' | 'mount' | 'done'>('generate');
  const [generationErr, setGenerationErr] = useState('');
  const [generatedSite, setGeneratedSite] = useState<GeneratedWebsite | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [builderMode, setBuilderMode] = useState<'normal' | 'ultra' | 'ultra+'>('normal');
  const [selectedFile, setSelectedFile] = useState('main/frontend/index.html');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState('');
  const [compiledPreviewHtml, setCompiledPreviewHtml] = useState('');
  const [previewBuildErr, setPreviewBuildErr] = useState('');
  const [previewBuilding, setPreviewBuilding] = useState(false);
  const [previewRuntimeErr, setPreviewRuntimeErr] = useState('');
  const [generatorWarnings, setGeneratorWarnings] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const buildIdRef = useRef('');
  const operationRef = useRef(0);
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadedAssets, setUploadedAssets] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const pendingGeneration = useRef<{ previous: GeneratedWebsite | null; previousId: number | null; cost: number; started: number } | null>(null);
  useEffect(() => { warmPreviewCompiler().catch(() => {}); }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (data?.__sm !== 'sitemorph' || data.buildId !== buildIdRef.current || !data.m) return;
      const m = data.m;
      if (m.t === 'mounted' && m.ok) {
        setPreviewReady(true);
        setThinkingPhase('done');
        const pending = pendingGeneration.current;
        if (pending) {
          setCredits(c => Math.max(0, c - pending.cost));
          setGeneratedSite(site => site ? { ...site, metadata: { ...site.metadata,
            timings: { ...site.metadata?.timings, client_total_ms: Math.round(performance.now() - pending.started) } } } : site);
          pendingGeneration.current = null;
        }
      } else if (m.t === 'runtime-error' || (m.t === 'mounted' && !m.ok)) {
        const message = m.message || 'Nie udało się uruchomić strony.';
        const pending = pendingGeneration.current;
        pendingGeneration.current = null;
        if (pending?.previous?.artifact) {
          setGeneratedSite(pending.previous);
          setCurrentProjectId(pending.previousId);
          setCompiledPreviewHtml(pending.previous.artifact.html);
          setPreviewEpoch(value => value + 1);
          buildIdRef.current = pending.previous.artifact.buildId;
          setPreviewRuntimeErr('');
          setGenerationErr(message + ' Zachowano poprzednią stronę.');
          setPreviewReady(true);
        } else {
          setPreviewReady(false);
          setPreviewRuntimeErr(message);
        }
      } else if (m.t === 'overflow') {
        setGeneratorWarnings(w => [...w, 'Podgląd wychodzi poza szerokość okna. Sprawdź układ przed publikacją.'].slice(-6));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setCredits]);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  // Panel roboczy 320–360 px; preview zawsze dostaje resztę szerokości.
  const [leftW, setLeftW] = useState(340);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  // Realna kontrola kadru podglądu — zmienia szerokość ramki, nic więcej.
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const deviceWidth = device === 'mobile' ? 390 : device === 'tablet' ? 834 : 0;
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
      setLeftW(Math.min(Math.max(e.clientX - rect.left, 320), Math.max(320, Math.min(360, Math.floor(rect.width * 0.45)))));
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

  const generatingRef = useRef(false);

  const uploadImages = async (selection: FileList | null) => {
    if (!selection?.length || uploading || isGenerating) return;
    setUploading(true);
    setGenerationErr('');
    try {
      // One file per upload avoids an oversized multipart body on hosted APIs.
      for (const file of Array.from(selection).slice(0, Math.max(0, 8 - uploadedAssets.length))) {
        if (file.size > 4_000_000) throw new Error('Zdjęcie jest za duże. Wybierz plik do 4 MB.');
        const body = new FormData(); body.append('files', file);
        const response = await apiFetch('/api/builder/upload', { method: 'POST', body });
        const data = await response.json();
        if (!response.ok || !data.urls?.[0]) throw new Error(data.detail || 'Nie udało się dodać zdjęcia.');
        const asset = { url: data.urls[0], name: file.name };
        setUploadedAssets(previous => [...previous, asset].slice(0, 8));
      }
    } catch (error: any) { setGenerationErr(error.message || 'Nie udało się dodać zdjęcia.'); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const generateWithAnswers = async (ans: Record<string, string | string[]>, promptOverride?: string) => {
    const originalPrompt = (promptOverride || builderPrompt || '').trim();
    if (!originalPrompt || uploading || generatingRef.current || pendingGeneration.current || previewBuilding || publishing || savingRef.current) return;
    if (credits < cost) {
      setGenerationErr(`Brakuje kredytów. Potrzeba ${cost}, masz ${credits}. Doładuj kredyty w cenniku.`);
      return;
    }
    generatingRef.current = true;
    const operation = ++operationRef.current;
    const started = performance.now();
    setGenerationErr('');
    setIsGenerating(true);
    setSaveMsg('');
    setPublishErr('');
    setThinkingPhase('generate');
    setPublishedUrl(null);
    try {
      const res = await apiFetch('/api/builder/generate', {
        method: 'POST', timeoutMs: 480000,
        body: JSON.stringify({
          business_name: '', niche: cleanAutoValue(ans.niche),
          description: originalPrompt, extraPrompt: originalPrompt,
          style: [cleanAutoValue(ans.layout), cleanAutoValue(ans.tone)].filter(Boolean).join(', '),
          colors: cleanAutoValue(ans.theme),
          sections: Array.isArray(ans.sections) ? ans.sections : [],
          accent_color: cleanAutoValue(ans.accent), layout: cleanAutoValue(ans.layout),
          fonts: cleanAutoValue(ans.fonts), photo_style: cleanAutoValue(ans.photos),
          image_urls: uploadedAssets.map(a => a.url), image_details: uploadedAssets,
          answers: ans, mode: builderMode,
        }),
      });
      const data = await res.json().catch(() => ({ detail: `Niepoprawna odpowiedź serwera (HTTP ${res.status})` }));
      if (!res.ok) {
        const raw = typeof data.detail === 'string' ? data.detail.trim() : '';
        // Backend rozróżnia kategorie błędów (niedostępny dostawca, przekroczony
        // czas, niepoprawna odpowiedź AI, nieudany podgląd) i zwraca gotowy
        // komunikat. Pokazujemy go wprost; ucinamy wyłącznie teksty techniczne,
        // które nie mówią użytkownikowi, co zrobić dalej.
        const technical = !raw || /traceback|pydantic|openrouter|normaliz|validation error|\.py\b/i.test(raw);
        throw new Error(technical
          ? `Nie udało się wygenerować strony (HTTP ${res.status}). Spróbuj ponownie.`
          : raw);
      }
      setThinkingPhase('compile');
      const files: Record<string, string> = data.files || {};
      const artifact = await compileReactProject(files, API_BASE || window.location.origin);
      if (operation !== operationRef.current) return;
      const meta = data.meta || {};
      const title = meta.title || meta.projectName || 'Nowa strona';
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 40) || 'strona';
      pendingGeneration.current = { previous: previewReady ? generatedSite : null, previousId: currentProjectId, cost, started };
      const { files: _files, ...metadata } = data;
      setGeneratedSite({
        title, category: data.business_brief?.business?.category || '', domain: `${slug}-${crypto.randomUUID().slice(0, 8)}.sitemorph.pl`,
        headline: meta.headline || title, subheadline: meta.subheadline || '',
        ctaText: meta.ctaText || 'Kontakt', files, artifact,
        metadata: { ...metadata, originalPrompt, preferences: ans },
      });
      setCurrentProjectId(null);
      setActiveMode('preview');
      setSelectedFile('main/frontend/src/App.tsx');
      setPreviewReady(false);
      setPreviewBuildErr('');
      setPreviewRuntimeErr('');
      setGeneratorWarnings(Array.isArray(data.generator_warnings) ? data.generator_warnings : []);
      buildIdRef.current = artifact.buildId;
      setCompiledPreviewHtml(artifact.html);
      setPreviewEpoch(value => value + 1);
      setThinkingPhase('mount');
    } catch (error: any) {
      setGenerationErr(error.message || 'Nie udało się wygenerować strony.');
    } finally {
      setIsGenerating(false);
      generatingRef.current = false;
    }
  };

  const openProject = async (project: any) => {
    if (generatingRef.current || pendingGeneration.current || publishing || savingRef.current) return;
    const operation = ++operationRef.current;
    setPreviewBuilding(true);
    setGenerationErr('');
    try {
      const files = project.content?.files || {};
      const saved = project.content?.artifact;
      const artifact = saved?.compilerVersion === COMPILER_VERSION && saved?.sourceHash === await sourceHash(files)
        ? saved : await compileReactProject(files, API_BASE || window.location.origin);
      if (operation !== operationRef.current) return;
      const meta = project.content?.meta || {};
      setGeneratedSite({ title: project.name, category: project.niche || '', domain: project.domain,
        headline: meta.headline || project.name, subheadline: meta.subheadline || '', ctaText: meta.ctaText || 'Kontakt',
        files, artifact, metadata: project.content?.metadata || {} });
      setCurrentProjectId(project.id);
      setPublishedUrl(null);
      buildIdRef.current = artifact.buildId;
      setCompiledPreviewHtml(artifact.html);
      setPreviewEpoch(value => value + 1);
      setPreviewRuntimeErr('');
      setPreviewBuildErr('');
      setPreviewReady(false);
      setActiveMode('preview');
    } catch (error: any) {
      if (operation === operationRef.current) setGenerationErr(error.message || 'Nie udało się otworzyć projektu.');
    } finally {
      if (operation === operationRef.current) setPreviewBuilding(false);
    }
  };

  const handleWizardComplete = (ans: Record<string, string | string[]>) => {
    setAnswers(ans);
    setShowWizard(false);

    // The original raw prompt is passed unchanged.
    // Empty/auto wizard values do not become fake design instructions.
    setTimeout(() => generateWithAnswers(ans, builderPrompt), 300);
  };

  const persistProject = async (): Promise<number> => {
    if (!generatedSite?.artifact || !previewReady || previewRuntimeErr) throw new Error('Poczekaj, aż strona się załaduje.');
    if (savingRef.current) throw new Error('Trwa już zapis projektu.');
    savingRef.current = true;
    setIsSaving(true);
    try {
      const content = { files: generatedSite.files, metadata: generatedSite.metadata,
        artifact: generatedSite.artifact,
        meta: { ...(generatedSite.metadata?.meta || {}), title: generatedSite.title,
          headline: generatedSite.headline, subheadline: generatedSite.subheadline, ctaText: generatedSite.ctaText } };
      const res = await apiFetch(currentProjectId ? `/api/projects/${currentProjectId}` : '/api/projects/', {
        method: currentProjectId ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: generatedSite.title, domain: generatedSite.domain, niche: generatedSite.category, content }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(typeof saved.detail === 'string' ? saved.detail : `Błąd zapisu (HTTP ${res.status})`);
      setCurrentProjectId(saved.id);
      await loadProjects();
      return saved.id;
    } finally { savingRef.current = false; setIsSaving(false); }
  };

  const handleSaveProject = async () => {
    try { await persistProject(); setSaveMsg('Zapisano projekt wraz z podglądem'); }
    catch (error: any) { setSaveMsg(error.message || 'Nie udało się zapisać projektu.'); }
  };

  // Tryby mają nazwy prezentacyjne (S1 / S1+ / S1 Pro); do API nadal idą
  // dotychczasowe wartości. Wszystkie tryby używają tego samego modelu i
  // dokładnie jednego żądania — dlatego opis mówi tylko o koszcie.
  const quickPrompts = [
    { icon: Coffee, label: 'Restauracja', prompt: 'Restauracja z menu i galerią zdjęć' },
    { icon: Briefcase, label: 'Startup', prompt: 'Nowoczesna strona dla startupu z cennikiem' },
    { icon: Home, label: 'Nieruchomości', prompt: 'Agencja nieruchomości z ofertami mieszkań' },
    { icon: Zap, label: 'Usługi', prompt: 'Firma usługowa z cennikiem i kontaktem' },
  ];

  /** Pole opisu jest jednym komponentem dla obu stanów panelu — przed i po
   *  wygenerowaniu strony — więc zostaje dokładnie tam, gdzie użytkownik
   *  wpisał tekst, także po błędzie. */
  const promptPanel = (
    <div className="shrink-0 p-3">
      <div className="rounded-[16px] p-2.5" style={{ background: 'var(--sm-surface)' }}>
        <label htmlFor="builder-prompt" className="sr-only">Opis strony</label>
        <textarea
          id="builder-prompt"
          value={builderPrompt}
          onChange={(e) => setBuilderPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (builderPrompt.trim() && !generatedSite) generateWithAnswers(answers, builderPrompt);
            }
          }}
          rows={3}
          placeholder="Np. strona dla kawiarni w Łodzi z menu i kontaktem…"
          className="w-full resize-none border-none bg-transparent px-1.5 pt-1.5 text-[14px] leading-[1.5] outline-none placeholder:text-[var(--sm-text-quiet)]"
          style={{ maxHeight: 176, overflowY: 'auto', minHeight: 68, color: 'var(--sm-text)' }}
        />
        <div className="mt-1 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Dodaj własne zdjęcia"
              title="Dodaj własne zdjęcia"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || isGenerating || uploadedAssets.length >= 8}
              className="sm-icon-btn shrink-0 disabled:opacity-40"
              style={{ color: 'var(--sm-text-quiet)', width: 44, height: 44, minWidth: 44, minHeight: 44 }}
            >
              <ImageIcon size={17} />
            </button>
            {uploadedAssets.length > 0 ? (
              <span className="truncate text-[12px]" style={{ color: 'var(--sm-text-quiet)' }}>{uploadedAssets.length} zdjęć</span>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden whitespace-nowrap text-[12px] font-medium sm:inline" style={{ color: 'var(--sm-text-quiet)' }}>{cost} kr.</span>
            <button
              onClick={() => { if (builderPrompt.trim()) generateWithAnswers(answers, builderPrompt); }}
              disabled={!builderPrompt.trim() || isGenerating || previewBuilding}
              aria-label={generatedSite ? 'Zbuduj nową stronę' : 'Zbuduj stronę'}
              title={generatedSite ? 'Zbuduj nową stronę' : 'Zbuduj stronę'}
              className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[10px] border-none transition-all hover:brightness-110 active:scale-95 disabled:cursor-default disabled:opacity-30"
              style={{ background: 'var(--sm-accent)' }}
            >
              <Send size={17} color="#fff" />
            </button>
          </div>
        </div>
        {/* Tryby SiteMorph: nazwy prezentacyjne, te same wartości w API. */}
        <div className="mt-2 flex items-center gap-0.5 rounded-[10px] p-0.5" style={{ background: 'var(--sm-surface-hover)' }} role="group" aria-label="Tryb generowania">
          {MODE_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setBuilderMode(option.value)}
              aria-pressed={builderMode === option.value}
              title={option.hint}
              className={`relative min-h-[44px] flex-1 cursor-pointer rounded-[8px] border-none text-[12.5px] font-semibold transition-colors ${builderMode === option.value ? 'text-[var(--sm-text)]' : 'text-[var(--sm-text-quiet)] hover:text-[var(--sm-text-secondary)]'}`}
            >
              {builderMode === option.value && <motion.span layoutId="builderQualityMode" transition={springTransition} className="absolute inset-0 rounded-[8px]" style={{ background: 'var(--sm-surface-elevated)' }} />}
              <span className="relative z-10">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={event => uploadImages(event.target.files)} />
      
      {/* Inline questionnaire appears above input when showWizard is true */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col overflow-hidden select-none h-[100dvh] bg-[var(--sm-bg)] text-[var(--sm-text)]"
      >
        {/* Header — 56 px, jedna hierarchia: projekt, widok, akcje */}
        <header className="h-14 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 bg-[var(--sm-sidebar)]">
          <div className="flex min-w-0 items-center gap-1.5">
            <button onClick={onBack} className="sm-icon-btn shrink-0" aria-label="Wróć do panelu" title="Wróć do panelu">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold leading-tight">{generatedSite?.title || 'Nowy projekt'}</div>
              <div className="hidden truncate text-[12px] leading-tight sm:block" style={{ color: 'var(--sm-text-quiet)' }}>
                {isGenerating ? 'Tworzę stronę…' : generatedSite && previewReady ? 'Strona gotowa' : 'Szkic w Kreatorze'}
              </div>
            </div>
          </div>

          {isDesktop ? (
            <div className="flex items-center gap-0.5 rounded-[10px] p-0.5" style={{ background: 'var(--sm-surface)' }}>
              {(['preview', 'code'] as const).map((mode) => (
                <button key={mode} onClick={() => setActiveMode(mode)} aria-pressed={activeMode === mode} className={`relative flex min-h-[44px] items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors cursor-pointer border-none ${activeMode === mode ? 'text-[var(--sm-text)]' : 'text-[var(--sm-text-quiet)] hover:text-[var(--sm-text-secondary)]'}`}>
                  {activeMode === mode && <motion.span layoutId="builderMode" transition={springTransition} className="absolute inset-0 rounded-[8px]" style={{ background: 'var(--sm-surface-hover)' }} />}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {mode === 'preview' ? <Monitor size={15} /> : <CodeIcon size={15} />}
                    {mode === 'preview' ? 'Podgląd' : 'Kod'}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <span className="hidden text-[13px] font-medium sm:inline" style={{ color: 'var(--sm-text-quiet)' }}>{credits} kr.</span>
            <Button variant="primary" size="sm" disabled={isSaving || publishing || isGenerating || previewBuilding || !previewReady || Boolean(previewRuntimeErr) || !generatedSite || !compiledPreviewHtml} onClick={async () => {
              if (!generatedSite) return;
              setPublishing(true); setPublishErr('');
              try {
                const artifact = generatedSite.artifact;
                if (!artifact || !previewReady) throw new Error('Poczekaj, aż podgląd się załaduje.');
                const projectId = await persistProject();
                const res = await apiFetch('/api/publish', { method: 'POST', body: JSON.stringify({
                  project_id: projectId, source_hash: artifact.sourceHash, build_id: artifact.buildId,
                }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || `Błąd ${res.status}`);
                setPublishedUrl(new URL(data.url, API_BASE || window.location.origin).href);
              } catch (e: any) { setPublishErr(e.message); } finally { setPublishing(false) }
            }} className="font-medium text-[14px]">
              {publishing ? '...' : 'Opublikuj'}
            </Button>
          </div>
        </header>

        {generationErr && generatedSite && (
          <div role="alert" className="flex shrink-0 flex-wrap items-center gap-3 px-4 py-2 text-[13px] font-medium" style={{ background: 'color-mix(in srgb, var(--sm-warning) 12%, transparent)', color: 'var(--sm-warning)' }}>
            <AlertTriangle size={15} className="shrink-0" />
            <span className="min-w-0 flex-1">{generationErr}</span>
            <button
              type="button"
              onClick={() => generateWithAnswers(answers, builderPrompt)}
              disabled={!builderPrompt.trim() || isGenerating || previewBuilding || publishing}
              className="min-h-[44px] cursor-pointer rounded-[8px] border-none px-3 text-[13px] font-semibold disabled:opacity-50"
              style={{ background: 'var(--sm-warning)', color: '#fff' }}
            >
              Spróbuj ponownie
            </button>
          </div>
        )}
        {publishErr && <div role="alert" className="shrink-0 px-4 py-2 text-[13px] font-medium" style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--sm-danger)' }}>{publishErr}</div>}
        {/* Mobile: edytor i podgląd to dwa widoki, nie dwie ściśnięte kolumny. */}
        {!isDesktop ? (
          <div className="flex shrink-0 items-center gap-0.5 p-0.5 mx-3 mt-2 rounded-[10px]" style={{ background: 'var(--sm-surface)' }} role="group" aria-label="Widok Kreatora">
            {(['editor', 'preview'] as const).map((pane) => (
              <button
                key={pane}
                type="button"
                onClick={() => setMobilePane(pane)}
                aria-pressed={mobilePane === pane}
                className={`relative min-h-[44px] flex-1 cursor-pointer rounded-[8px] border-none text-[13px] font-medium transition-colors ${mobilePane === pane ? 'text-[var(--sm-text)]' : 'text-[var(--sm-text-quiet)]'}`}
              >
                {mobilePane === pane && <motion.span layoutId="builderMobilePane" transition={springTransition} className="absolute inset-0 rounded-[8px]" style={{ background: 'var(--sm-surface-hover)' }} />}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {pane === 'editor' ? <Sparkles size={14} /> : <Monitor size={14} />}
                  {pane === 'editor' ? 'Opis i ustawienia' : 'Podgląd'}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Main */}
        <div ref={splitRef} className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Panel — Prompt + ustawienia */}
          <div
            style={isDesktop ? { width: leftW } : undefined}
            className={`min-h-0 flex-col overflow-hidden shrink-0 bg-[var(--sm-sidebar)] ${mobilePane === 'editor' ? 'flex flex-1' : 'hidden'} ${isDesktop ? 'md:flex' : ''}`}
          >
            {isGenerating ? (
              <ThinkingSteps mode={builderMode} phase={thinkingPhase} theme={theme} />
            ) : generatedSite ? (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: previewRuntimeErr ? 'color-mix(in srgb, var(--sm-warning) 14%, transparent)' : 'color-mix(in srgb, var(--sm-success) 12%, transparent)' }}>
                      {previewRuntimeErr
                        ? <AlertTriangle size={16} style={{ color: 'var(--sm-warning)' }} />
                        : <CheckCircle2 size={16} style={{ color: 'var(--sm-success)' }} />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold">
                        {previewRuntimeErr ? 'Podgląd wymaga poprawki' : previewReady ? 'Strona jest gotowa' : 'Przygotowuję podgląd…'}
                      </div>
                      <div className="truncate text-[12.5px]" style={{ color: 'var(--sm-text-quiet)' }}>{generatedSite.title}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <button onClick={handleSaveProject} disabled={isSaving || publishing || !previewReady} className="min-h-[44px] w-full cursor-pointer rounded-[10px] border-none text-[13px] font-medium transition-colors disabled:opacity-40" style={{ background: 'var(--sm-surface-hover)', color: 'var(--sm-text)' }}>
                      <Save size={15} className="mr-2 inline" />
                      {currentProjectId ? 'Zapisz zmiany' : 'Zapisz projekt'}
                    </button>
                    {saveMsg && <p className="text-center text-[12.5px]" style={{ color: 'var(--sm-success)' }}>{saveMsg}</p>}
                  </div>

                  {generatorWarnings.length > 0 && (
                    <div className="space-y-1 rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--sm-warning) 10%, transparent)' }}>
                      <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--sm-warning)' }}>
                        <AlertTriangle size={15} /> Uwagi do uzupełnienia
                      </div>
                      {generatorWarnings.map((w, i) => (
                        <p key={i} className="text-[12.5px] leading-[1.55]" style={{ color: 'var(--sm-text-secondary)' }}>{w}</p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--sm-text-quiet)' }}>Projekty</p>
                    {savedProjects.length === 0 ? (
                      <p className="px-1 text-[12.5px]" style={{ color: 'var(--sm-text-quiet)' }}>Brak zapisanych projektów</p>
                    ) : savedProjects.slice(0, 4).map((p) => (
                      <button key={p.id} onClick={() => openProject(p)} className="block w-full min-h-[44px] cursor-pointer truncate rounded-[10px] border-none px-2.5 text-left text-[13px] transition-colors hover:bg-[var(--sm-surface-hover)]" style={{ color: 'var(--sm-text-secondary)' }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                {promptPanel}
              </div>
            ) : (
              /* Empty State — wejście do pracy */
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {savedProjects.length > 0 && (
                    <div className="space-y-1">
                      <p className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--sm-text-quiet)' }}>Ostatnie projekty</p>
                      {savedProjects.slice(0, 4).map(project => (
                        <button key={project.id} disabled={previewBuilding} onClick={() => openProject(project)} className="block w-full min-h-[44px] cursor-pointer truncate rounded-[10px] border-none px-2.5 text-left text-[13px] transition-colors hover:bg-[var(--sm-surface-hover)] disabled:opacity-40" style={{ color: 'var(--sm-text-secondary)' }}>{project.name}</button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-start gap-3 pt-1">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: 'var(--sm-accent-muted)' }}>
                      <Sparkles size={17} style={{ color: 'var(--sm-accent)' }} />
                    </span>
                    <div className="min-w-0">
                      <h1 className="text-[17px] font-semibold leading-snug">Co chcesz stworzyć?</h1>
                      <p className="mt-1 text-[13px] leading-[1.55]" style={{ color: 'var(--sm-text-secondary)' }}>
                        Opisz firmę i stronę, której potrzebujesz.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((qp) => (
                      <button key={qp.label} onClick={() => setBuilderPrompt(qp.prompt)} className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[9px] border-none px-3 text-[13px] font-medium transition-colors bg-[var(--sm-surface)] hover:bg-[var(--sm-surface-hover)]" style={{ color: 'var(--sm-text-secondary)' }}>
                        <qp.icon size={14} style={{ color: 'var(--sm-text-quiet)' }} />
                        {qp.label}
                      </button>
                    ))}
                  </div>

                  {uploadedAssets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {uploadedAssets.map(asset => (
                        <button key={asset.url} disabled={isGenerating} onClick={() => setUploadedAssets(list => list.filter(a => a.url !== asset.url))} title="Usuń zdjęcie z kolejnej generacji" className="min-h-[44px] max-w-full cursor-pointer truncate rounded-[8px] border-none px-2.5 text-[12px]" style={{ background: 'var(--sm-surface-hover)', color: 'var(--sm-text-secondary)' }}>
                          {asset.name} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {promptPanel}
              </div>
            )}
          </div>

          {/* Split Handle — tylko desktop, kontrastowa krawędź zamiast ramki */}
          <div
            onMouseDown={(e) => { e.preventDefault(); setIsDraggingSplit(true); }}
            className={`hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors ${isDraggingSplit ? 'bg-[var(--sm-accent-muted)]' : 'hover:bg-[var(--sm-surface-hover)]'}`}
            title="Przeciągnij, aby zmienić szerokość"
          >
            <div className="h-8 w-0.5 rounded-full" style={{ background: 'var(--sm-border-subtle)' }} />
          </div>

          {/* Right Panel — Preview / Code */}
          <div className={`flex-1 min-h-0 overflow-hidden ${mobilePane === 'preview' ? 'flex' : 'hidden'} ${isDesktop ? 'md:flex' : ''} bg-[var(--sm-bg)]`}>
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-sm">
                    <ThinkingSteps mode={builderMode} phase={thinkingPhase} theme={theme} />
                  </div>
                </motion.div>
              ) : !generatedSite ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center">
                  <div role={generationErr ? 'alert' : undefined} className="max-w-md space-y-2 px-8 text-center">
                    {generationErr
                      ? <X size={26} className="mx-auto" style={{ color: 'var(--sm-danger)' }} strokeWidth={1.75} />
                      : <Monitor size={26} className="mx-auto" style={{ color: 'var(--sm-text-quiet)' }} strokeWidth={1.75} />}
                    <h2 className="text-[15px] font-semibold" style={{ color: generationErr ? 'var(--sm-danger)' : 'var(--sm-text)' }}>
                      {generationErr ? 'Nie udało się wygenerować strony' : 'Tutaj zobaczysz swoją stronę'}
                    </h2>
                    <p className="text-[13px] leading-[1.6]" style={{ color: 'var(--sm-text-secondary)' }}>
                      {generationErr || 'Opisz firmę po lewej stronie i wybierz „Zbuduj stronę”.'}
                    </p>
                    {generationErr && (
                      <button
                        type="button"
                        onClick={() => generateWithAnswers(answers, builderPrompt)}
                        disabled={!builderPrompt.trim() || isGenerating || previewBuilding || publishing}
                        className="mt-1 min-h-[44px] rounded-[10px] border-none bg-[var(--sm-accent)] px-4 text-[13px] font-semibold text-[var(--sm-accent-ink)] transition-colors hover:bg-[var(--sm-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Spróbuj ponownie
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : activeMode === 'preview' ? (
                <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="flex-1 flex flex-col min-h-0">
                  <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-3" style={{ background: 'var(--sm-sidebar)' }}>
                    <span data-testid="preview-status" className="min-w-0 truncate text-[12.5px] font-medium" style={{ color: 'var(--sm-text-secondary)' }}>
                      {previewBuilding ? 'Kompiluję podgląd…' : previewReady ? 'Podgląd gotowy' : 'Uruchamiam podgląd…'}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="hidden items-center gap-0.5 rounded-[9px] p-0.5 sm:flex" style={{ background: 'var(--sm-surface)' }} role="group" aria-label="Szerokość podglądu">
                        {([['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Telefon']] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setDevice(value)}
                            aria-pressed={device === value}
                            aria-label={label}
                            title={label}
                            className={`relative min-h-[44px] cursor-pointer rounded-[7px] border-none px-2.5 text-[12px] font-medium transition-colors ${device === value ? 'text-[var(--sm-text)]' : 'text-[var(--sm-text-quiet)]'}`}
                          >
                            {device === value && <motion.span layoutId="builderDevice" transition={springTransition} className="absolute inset-0 rounded-[7px]" style={{ background: 'var(--sm-surface-hover)' }} />}
                            <span className="relative z-10">{value === 'desktop' ? <Monitor size={14} /> : value === 'tablet' ? <Tablet size={14} /> : <Smartphone size={14} />}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPreviewReady(false); setPreviewEpoch(value => value + 1); }}
                        className="sm-icon-btn"
                        style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
                        aria-label="Odśwież podgląd"
                        title="Odśwież podgląd"
                        disabled={!compiledPreviewHtml}
                      >
                        <RefreshCw size={15} />
                      </button>
                    </div>
                  </div>
                  {previewBuilding ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="h-6 w-6 rounded-full" style={{ border: '2px solid var(--sm-surface-hover)', borderTopColor: 'var(--sm-accent)' }} />
                      <span className="text-[13px] font-medium" style={{ color: 'var(--sm-text-secondary)' }}>Kompiluję prawdziwy projekt React…</span>
                    </div>
                  ) : previewBuildErr ? (
                    <div className="flex flex-1 items-center justify-center p-6">
                      <div className="max-w-lg text-center">
                        <X size={26} className="mx-auto mb-2" style={{ color: 'var(--sm-danger)' }} strokeWidth={1.75} />
                        <h2 className="mb-1.5 text-[14px] font-semibold">Nie udało się przygotować podglądu</h2>
                        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: 'var(--sm-text-secondary)' }}>{previewBuildErr}</p>
                        <p className="mt-2 text-[12.5px]" style={{ color: 'var(--sm-text-quiet)' }}>Kod strony dostępny jest w widoku „Kod”.</p>
                      </div>
                    </div>
                  ) : compiledPreviewHtml ? (
                    previewRuntimeErr ? (
                      <div className="flex flex-1 items-center justify-center p-6">
                        <div className="max-w-lg text-center">
                          <AlertTriangle size={26} className="mx-auto mb-2" style={{ color: 'var(--sm-warning)' }} strokeWidth={1.75} />
                          <h2 className="mb-1.5 text-[14px] font-semibold">Nie udało się uruchomić strony w podglądzie</h2>
                          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: 'var(--sm-text-secondary)' }}>{previewRuntimeErr}</p>
                          <p className="mt-2 text-[12.5px]" style={{ color: 'var(--sm-text-quiet)' }}>Kod strony dostępny jest w widoku „Kod”.</p>
                        </div>
                      </div>
                    ) : (
                    <div className="flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-3">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.995 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="mx-auto h-full overflow-hidden rounded-[10px] bg-white"
                        style={{ width: deviceWidth ? Math.min(deviceWidth, 1200) : '100%', maxWidth: '100%', boxShadow: 'var(--sm-shadow)' }}
                      >
                        <iframe
                          key={`${generatedSite.artifact?.buildId || 'site'}:${previewEpoch}`}
                          ref={iframeRef}
                          title={`Podgląd ${generatedSite.title}`}
                          className="h-full w-full border-0 bg-white"
                          sandbox="allow-scripts allow-popups allow-forms allow-modals"
                          srcDoc={compiledPreviewHtml}
                        />
                      </motion.div>
                    </div>
                    )
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-[13px]" style={{ color: 'var(--sm-text-quiet)' }}>
                      Brak skompilowanego podglądu.
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex rounded-[16px] overflow-hidden" style={{ background: 'var(--sm-surface)' }}>
                  <div className="w-56 p-3 space-y-0.5 overflow-y-auto" style={{ background: 'var(--sm-surface)' }}>
                    <span className="mb-2 block px-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sm-text-quiet)' }}>Pliki</span>
                    {Object.keys(generatedSite.files).map((fname) => (
                      <button key={fname} onClick={() => setSelectedFile(fname)} className={`w-full min-h-[44px] truncate rounded-[8px] border-none px-3 py-2 text-left text-[14px] font-medium cursor-pointer transition-colors ${selectedFile === fname ? 'bg-[var(--sm-surface-hover)] text-[var(--sm-text)]' : 'bg-transparent text-[var(--sm-text-secondary)] hover:bg-[var(--sm-surface-hover)] hover:text-[var(--sm-text)]'}`}>
                        {fname.split('/').pop()}
                      </button>
                    ))}
                  </div>
                  <div className={`flex-1 p-3 overflow-y-auto ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                    <pre className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: theme === 'dark' ? 'var(--sm-text-secondary)' : 'var(--sm-text-secondary)' }}>{generatedSite.files[selectedFile] || ''}</pre>
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
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}                  className="fixed right-0 top-0 bottom-0 w-[340px] max-w-[90vw] z-[61] shadow-2xl flex flex-col" style={{ background: 'var(--sm-bg)' }}>
                <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--sm-border-subtle)' }}>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Opublikowano!</span>
                  </div>
                  <button aria-label="Zamknij publikację" onClick={() => setPublishedUrl(null)} className="w-11 h-11 rounded-[10px] flex items-center justify-center hover:bg-white/10 text-white/40 cursor-pointer border-none bg-transparent"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3 flex-1">
                  <div className="flex items-center gap-2 p-3 rounded-[10px]" style={{ background: 'var(--sm-surface)' }}>
                    <input readOnly value={publishedUrl} onFocus={(e) => e.currentTarget.select()} className={`flex-1 bg-transparent text-xs font-medium outline-none min-w-0 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
                    <button onClick={() => navigator.clipboard?.writeText(publishedUrl)} className="px-3 min-h-[44px] rounded-[8px] text-[13px] font-medium shrink-0 cursor-pointer border-none" style={{ background: 'var(--sm-accent)', color: 'white' }}>Kopiuj</button>
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
