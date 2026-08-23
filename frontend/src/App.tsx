import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { springTransition } from './lib/shared';
import { GlobalStyles, Button } from './components/ui';
import { SplashScreen } from './components/SplashScreen';
import { PublicLandingView } from './views/PublicLandingView';
import { DashboardSidebar } from './components/DashboardSidebar';
import { MobileNav } from './components/MobileNav';
import { DashboardMainView } from './views/DashboardMainView';
import { BuilderFullView } from './views/BuilderFullView';
import { LeadFinderView } from './views/LeadFinderView';
import { StandalonePricingView } from './views/StandalonePricingView';
import { FinanceSection } from './views/FinanceSection';
import { TutorialsView } from './views/TutorialsView';
import { CookieBanner } from './components/CookieBanner';
import { HelpView } from './views/HelpView';
import { DomainsView } from './views/DomainsView';
import { AuthModal } from './components/AuthModal';
import { GlobalNavbar } from './components/GlobalNavbar';
import { FloatingChat } from './components/FloatingChat';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('sitemorph-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [prefilledPrompt, setPrefilledPrompt] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [credits, setCredits] = useState(() => {
    try { return parseInt(localStorage.getItem('sitemorph-credits') || '25', 10); } catch { return 25; }
  });
  const [session, setSession] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sitemorph-theme', theme);
    } catch {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem('sitemorph-credits', String(credits)); } catch {}
  }, [credits]);

  const handleEnterApp = (tab = 'dashboard') => {
    setActiveTab(tab);
    setCurrentView('app');
  };

  const handleLaunchBuilderWithPrompt = (prompt: string) => {
    setPrefilledPrompt(prompt);
    setActiveTab('builder');
    setCurrentView('app');
  };

  if (!showSplash && currentView === 'app' && activeTab === 'builder') {
    return (
      <>
        <GlobalStyles />
        <CookieBanner />
        <BuilderFullView
          theme={theme}
          initialPrompt={prefilledPrompt}
          onBack={() => setActiveTab('dashboard')}
          credits={credits}
          setCredits={setCredits}
        />
        <CookieBanner />
        <FloatingChat chatOpen={chatOpen} setChatOpen={setChatOpen} />
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      {!showSplash && !(currentView === 'app' && activeTab === 'builder') && (
        <GlobalNavbar
          theme={theme} setTheme={setTheme} session={session}
          onShowAuth={() => setShowAuth(true)}
          onLogout={async () => { await supabase.auth.signOut(); setSession(null); }}
          onEnterApp={handleEnterApp} setActiveTab={setActiveTab}
          currentView={currentView} setCurrentView={setCurrentView}
        />
      )}
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" onComplete={() => setShowSplash(false)} theme={theme} />
        ) : currentView === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PublicLandingView
              onEnterApp={handleEnterApp}
              theme={theme}
              setTheme={setTheme}
              session={session}
              onShowAuth={() => setShowAuth(true)}
              onLogout={async () => { await supabase.auth.signOut(); setSession(null) }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="app-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen flex bg-white dark:bg-black text-blue-600 dark:text-white transition-colors"
          >
            <MobileNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onExit={() => setCurrentView('landing')}
              theme={theme}
              setTheme={setTheme}
              credits={credits}
            />
            <DashboardSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onExit={() => setCurrentView('landing')}
              theme={theme}
              setTheme={setTheme}
              credits={credits}
            />

            <main className="flex-1 h-screen overflow-y-auto no-scrollbar relative z-10 pt-14 lg:pt-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={springTransition}
                  className="h-full"
                >
                  {activeTab === 'dashboard' && (
                    <DashboardMainView
                      setActiveTab={setActiveTab}
                      theme={theme}
                      onLaunchBuilderWithPrompt={handleLaunchBuilderWithPrompt}
                    />
                  )}
                  {activeTab === 'leadfinder' && (
                    <LeadFinderView
                      theme={theme}
                      onGenerateSiteForLead={(lead, opts) => {
                        const extra: string[] = [];
                        const anyLead = lead as any;
                        const ind = (lead as any).industry || (lead as any).category || 'usługi';
                        const cityName = (lead as any).city || (lead as any).location || '';
                        const countryName = (lead as any).country || '';
                        if (anyLead.address && anyLead.address !== '—') extra.push(`Adres: ${anyLead.address}.`);
                        if (lead.phone && lead.phone !== '—' && (lead.phone as string).trim() !== '') extra.push(`Telefon: ${lead.phone}.`);
                        if (anyLead.openingHours) extra.push(`Godziny otwarcia: ${anyLead.openingHours}.`);
                        if (anyLead.rating) extra.push(`Ocena Google: ${anyLead.rating} (${anyLead.userRatingsTotal} opinii).`);
                        if (anyLead.website) extra.push(`Strona: ${anyLead.website}.`);
                        const loc = [cityName, countryName].filter(Boolean).join(', ');
                        const base = `Stwórz premium stronę Vite+React+Tailwind dla firmy "${lead.name}" (${ind}) w ${loc || 'Polska'}. ${extra.join(' ')} Zadbaj o sekcje: Hero, Oferta, Cennik, Galeria, Opinie, Kontakt z mapą. Branża: ${ind}. Kolory: limonkowy #bef264 + neutralny. Styl: nowoczesny, premium, impeccable.`;
                        const withImages = opts?.withImages ? ' Użyj zdjęć AI wygenerowanych oraz znajdź podobne w przeglądarce i wstaw je do galerii.' : '';
                        handleLaunchBuilderWithPrompt(base + withImages);
                      }}
                    />
                  )}
                  {activeTab === 'pricing' && <StandalonePricingView />}
                  {activeTab === 'finance' && <FinanceSection />}
                  {activeTab === 'tutorials' && <TutorialsView />}
                  {activeTab === 'help' && <HelpView credits={credits} setCredits={setCredits} />}
                  {['domains', 'settings'].includes(activeTab) && (
                    activeTab === 'domains'
                      ? <DomainsView theme={theme} />
                      : (
                        <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
                          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-lg bg-blue-600 text-white dark:bg-white dark:text-black font-black">
                            <Sparkles size={32} />
                          </div>
                          <h2 className="text-2xl font-black capitalize">Ustawienia</h2>
                          <p className="text-xs font-bold max-w-sm mx-auto opacity-80">
                            Wdrożenie w toku. Kliknij przycisk poniżej, aby wrócić do pulpitu.
                          </p>
                          <Button variant="primary" size="sm" onClick={() => setActiveTab('dashboard')} className="shadow-md font-black">
                            Wróć do Pulpitu
                          </Button>
                        </div>
                      )
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            <CookieBanner />
        <FloatingChat chatOpen={chatOpen} setChatOpen={setChatOpen} />
          </motion.div>
        )}
      </AnimatePresence>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
    </>
  );
}

// ============================================================================
// 16. PŁYWAJĄCY CZAT
// ============================================================================
