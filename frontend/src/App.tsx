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
import { SettingsView } from './views/SettingsView';
import { AuthModal } from './components/AuthModal';
import { GlobalNavbar } from './components/GlobalNavbar';
import { FloatingChat } from './components/FloatingChat';
import { apiFetch } from './lib/api';

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
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Pobierz kredyty z backendu po zalogowaniu
  useEffect(() => {
    if (session && !session.user?.user_metadata?.credits_synced) {
      apiFetch('/api/credits')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && typeof d.credits === 'number') {
            setCredits(d.credits);
            localStorage.setItem('sitemorph-credits', String(d.credits));
            supabase.auth.updateUser({ data: { credits_synced: true } }).catch(() => {});
          }
        })
        .catch(() => {
          // fallback do localStorage
        });
    }
  }, [session]);

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

  // Nowi użytkownicy dostają 15 kredytów przy pierwszej rejestracji
  useEffect(() => {
    if (session && !session.user?.user_metadata?.credits_granted) {
      const granted = localStorage.getItem('sitemorph-credits-granted');
      if (!granted) {
        setCredits(15);
        localStorage.setItem('sitemorph-credits-granted', 'true');
        localStorage.setItem('sitemorph-credits', '15');
        supabase.auth.updateUser({ data: { credits_granted: true } }).catch(() => {});
      }
    }
  }, [session]);

  const getPlan = () => {
    try { return (localStorage.getItem('sitemorph-plan') || '').toLowerCase(); } catch { return ''; }
  };
  const hasPackage = () => {
    const p = getPlan();
    return ['starter','pro','business','agencja','premium'].includes(p);
  };
  const canAccessGated = () => {
    if (hasPackage()) return true;
    return credits >= 5;
  };
  // Miasta: prawdziwe dane z GeoNames (PL/GB/US dump, import: display_name/lat/lon/importance)
  const handleEnterApp = (tab = 'dashboard') => {
    if (!session) {
      setShowAuth(true);
      return;
    }
    const gated = ['dashboard','leadfinder','finance','domains','settings','tutorials','help','builder'];
    if (gated.includes(tab) && !canAccessGated()) {
      alert('Brak dostępu — kup pakiet lub kredyty (min. 5 kredytów). Przejdź do Cennika.');
      setActiveTab('pricing');
      setCurrentView('app');
      return;
    }
    setActiveTab(tab);
    setCurrentView('app');
  };

  const handleLaunchBuilderWithPrompt = (prompt: string) => {
    if (!session) {
      setShowAuth(true);
      return;
    }
    if (!canAccessGated()) {
      alert('Brak dostępu — kup pakiet lub kredyty (min. 5 kredytów).');
      setActiveTab('pricing');
      setCurrentView('app');
      return;
    }
    setPrefilledPrompt(prompt);
    setActiveTab('builder');
    setCurrentView('app');
  };

  // Chronione trasy - jeśli nie zalogowany i próbuje wejść w app, pokazuj landing
  const isProtectedTab = ['dashboard', 'leadfinder', 'finance', 'domains', 'settings', 'tutorials', 'help'].includes(activeTab);
  const shouldShowApp = currentView === 'app' && (!isProtectedTab || session);

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

  // Blokada bez pakietu/kredytów (<5) — przekieruj na cennik
  if (!showSplash && currentView === 'app' && isProtectedTab && session && !canAccessGated() && activeTab !== 'pricing') {
    setActiveTab('pricing');
  }
  // Jeśli próbuje wejść w chronioną kartę bez logowania - pokaż landing z auth modal
  if (!showSplash && currentView === 'app' && isProtectedTab && !session) {
    setCurrentView('landing');
    setShowAuth(true);
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
        ) : shouldShowApp ? (
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
              session={session}
            />
            <DashboardSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onExit={() => setCurrentView('landing')}
              theme={theme}
              setTheme={setTheme}
              credits={credits}
              session={session}
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
                        const base = `Stwórz premium stronę Vite+React+Tailwind dla firmy "${lead.name}" (${ind}) w ${loc || 'Polska'}. ${extra.join(' ')} Zadbaj o sekcje dobrane do branży (nie sztywno Hero/Oferta/Cennik — AI ma dobrać sekcje pod branżę na podstawie danych). Branża: ${ind}.`;
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
                      : <SettingsView />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            <CookieBanner />
        <FloatingChat chatOpen={chatOpen} setChatOpen={setChatOpen} />
          </motion.div>
        ) : currentView === 'app' ? (
          // Fallback - jeśli jakoś trafił w app bez sesji
          <motion.div
            key="app-fallback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex items-center justify-center bg-white dark:bg-black"
          >
            <div className="text-center p-8">
              <p className="font-black text-lg">Zaloguj się, aby kontynuować</p>
              <Button variant="primary" onClick={() => setShowAuth(true)} className="mt-4">Zaloguj się</Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
    </>
  );
}

// ============================================================================
// 16. PŁYWAJĄCY CZAT
// ============================================================================
