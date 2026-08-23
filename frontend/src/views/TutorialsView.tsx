import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  GraduationCap,
  X,
  Clock,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cineParent, cineSoft, cineStagger } from '../lib/shared';

export const ACADEMY_GUIDES: Array<{ title: string; category: string; level: string; time: string; excerpt: string; content: Array<{ h: string; p: string }> }> = [
  {
    title: 'Jak zdobyć pierwszego klienta w 7 dni',
    category: 'Sprzedaż',
    level: 'Początkujący',
    time: '9 min',
    excerpt: 'Gotowy plan outreach: od wyboru niszy po pierwszą fakturę.',
    content: [
      { h: '1. Wybierz wąską niszę', p: 'Zamiast pisać do wszystkich, skup się na 1 branży w 1 mieście. Przykład: „gabinet stomatologiczny w Poznaniu” lub „warsztat samochodowy w Gdańsku”. W Lead Finderze ustaw kraj Polska → miasto Poznań → branża Gabinet stomatologiczny. Otrzymasz 20–40 rekordów, z których połowa nie ma strony — to Twoja ciepła lista.' },
      { h: '2. Przygotuj darmowy mockup', p: 'W Kreatorze AI wpisz: „Stwórz nowoczesną stronę dla gabinetu Dentika w Poznaniu, jasna kolorystyka, sekcja cennik i rezerwacja online”. Wygeneruj, popraw nagłówek i skopiuj link podglądu (Podgląd na żywo). Masz dowód zamiast obietnicy.' },
      { h: '3. Wiadomość, która działa', p: 'Temat: Szybka propozycja dla Dentika – darmowy projekt strony\nCześć Anna,\nPrzygotowałem darmowy projekt strony dla Was — zobacz: dentika.sitemorph.pl/podglad-91x\nStrona jest gotowa do uruchomienia w 1 dzień, z rezerwacją online i mapą. Jeśli chcesz, wdrożę ją na Waszej domenie za 1 900 zł netto — płatność dopiero po akceptacji.\nPozdrawiam, Jan — Morph Studio\nWyślij 10 takich maili dziennie. Śledź otwarcia w Lead Finderze.' },
      { h: '4. Follow-up i zamknięcie', p: 'Dzień 3: „Cześć Anna, podbijam — projekt wygaśnie za 2 dni, mam wolny termin w piątek na wdrożenie.” Dzień 7: telefon. Zamknięcie: wyślij fakturę z modułu Finanse (Szablon: Projekt i wdrożenie strony 1 450 zł + copywriting 380 zł). 0% prowizji — całość trafia na Twoje konto. Po 3 klientów masz proces, który możesz powtarzać.' }
    ]
  },
  {
    title: 'Kreator AI: od promptu do publikacji w 5 minut',
    category: 'Kreator',
    level: 'Początkujący',
    time: '7 min',
    excerpt: 'Prompt → edycja → podgląd → publikacja. Dokładny flow krok po kroku.',
    content: [
      { h: 'Krok 1: Napisz prompt', p: 'W Pulpicie wpisz jedno zdanie: „Stwórz stronę dla barbera Złoty Grzebień w Warszawie, ciemny motyw, sekcje: usługi, cennik, rezerwacja, opinie, Instagram”. Unikaj ogólników typu „ładna strona” — AI potrzebuje branży, miasta i stylu.' },
      { h: 'Krok 2: Edytuj sekcje', p: 'Kliknij sekcję → wpisz „rozjaśnij tło” lub „dodaj sekcję z opiniami 4.9 ★”. Każda edycja to 2–5 kredytów i pojawia się w podglądzie na żywo. Użyj starterów (Nieruchomości, SaaS, Restauracja) jeśli brakuje Ci pomysłu.' },
      { h: 'Krok 3: Podgląd i akceptacja', p: 'Skopiuj link podglądu i wyślij klientowi. Klient otwiera na telefonie — widzi zmiany na żywo bez logowania. Gdy zaakceptuje, kliknij Opublikuj. Strona ląduje na *.sitemorph.io lub Twojej domenie (Business).' },
      { h: 'Krok 4: Publikacja', p: 'W Kreatorze → Opublikuj → wybierz domenę. SSL i hosting w cenie. Czas generowania 2–3 min, edycje 9–14 s. Historia wersji bez limitu — wrócisz do dowolnej wersji.' }
    ]
  },
  {
    title: 'Cennik, który sprzedaje: 1 500 – 12 000 zł',
    category: 'Biznes',
    level: 'Średniozaawansowany',
    time: '11 min',
    excerpt: 'Jak wyceniać bez zaniżania i jak sprzedawać pakiety.',
    content: [
      { h: 'Widełki realne', p: 'Polska 2024/2025: wizytówka AI: 800–1 900 zł, strona firmowa 5–7 podstron: 2 500–4 500 zł, landing + copywriting SEO: 4 000–7 000 zł, white-label dla agencji: 8 000–12 000 zł. Poniżej 800 zł psujesz rynek i marżę.' },
      { h: 'Pakiety', p: 'Pakiet Start: strona + podgląd + 1 poprawka — 1 900 zł. Pakiet Growth: Start + Lead Finder (20 leadów) + 3 poprawki + domena — 3 900 zł. Pakiet Premium: Growth + 12 miesięcy utrzymania — 7 900 zł. Klient wybiera środek — efekt kotwicy.' },
      { h: 'Upsell bez wciskania', p: 'Po akceptacji dodaj: „Chcesz rezerwację online? +400 zł, wdrożę w 1 dzień.” lub „Teksty SEO na bloga — 5 artykułów 380 zł”. Wystawiasz drugą fakturę w Finanse → Nowa faktura → status Oczekująca.' },
      { h: 'Negocjacje', p: 'Gdy klient mówi „za drogo”: nie obniżaj stawki, zmniejsz zakres. „OK, zrobimy 3 podstrony zamiast 6 za 1 450 zł”. Zawsze zostaw furtkę do dokupienia reszty później.' }
    ]
  },
  {
    title: 'Domena i publikacja bez bólu',
    category: 'Techniczne',
    level: 'Wszyscy',
    time: '6 min',
    excerpt: 'Podłącz własną domenę, SSL i przekierowania w 10 minut.',
    content: [
      { h: 'Opcja A: subdomena SiteMorph', p: 'Najprostsza: twojklient.sitemorph.io — działa od razu po kliknięciu Opublikuj. Dobre na pokaz i test. Możesz zmienić później na własną domenę bez utraty treści.' },
      { h: 'Opcja B: własna domena (zalecane)', p: 'Kup domenę (np. OVH, Aftermarket) → w Kreatorze → Opublikuj → Własna domena → wpisz np. zlotygrzebien.pl → skopiuj rekordy DNS (CNAME → cname.sitemorph.io, TXT do weryfikacji) → wklej u rejestratora. Propagacja 5–60 min.' },
      { h: 'SSL i przekierowania', p: 'Certyfikat Let’s Encrypt wystawia się automatycznie. Wymuś HTTPS w panelu Kreatora. Ustaw przekierowanie www → bez www (lub odwrotnie) jednym przełącznikiem. Test: wpisz https://twojadomena.pl — kłódka musi być zielona.' },
      { h: 'Checklista przed wysyłką do klienta', p: '1) favicon i tytuł SEO, 2) formularz kontaktowy test (wyślij próbkę), 3) RODO i cookies (wygeneruj w stopce), 4) podgląd na telefonie (link działa?), 5) faktura gotowa w Finanse. Dopiero wtedy wyślij link klientowi.' }
    ]
  }
];

// ============================================================================
// 6. WIDOK: EKRAN GŁÓWNY (LANDING SCROLLABLE)
// ============================================================================
export const TutorialsView = () => {
  const [activeGuide, setActiveGuide] = useState<number | null>(null);

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto py-8 px-6 pb-16 text-blue-600 dark:text-white"
      style={{ perspective: 1600 }}
    >
      <motion.div variants={cineSoft} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-blue-100 dark:bg-neutral-900 text-blue-600 dark:text-white border border-blue-200 dark:border-neutral-800">
          <GraduationCap size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Akademia SiteMorph</h1>
          <p className="text-xs font-bold opacity-80">Poradniki tekstowe — czytaj, kopiuj szablony, wdrażaj od razu.</p>
        </div>
      </motion.div>

      <motion.div variants={cineParent} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ perspective: 1600 }}>
        {ACADEMY_GUIDES.map((g, i) => (
          <motion.div
            key={g.title}
            custom={i}
            variants={cineStagger}
            whileHover={{ y: -8, scale: 1.02, rotateX: 6 }}
            onClick={() => setActiveGuide(i)}
            className="rounded-2xl p-6 border shadow-xl transition-all flex flex-col justify-between cursor-pointer bg-white dark:bg-black border-blue-100 dark:border-neutral-900 hover:border-blue-300 dark:hover:border-neutral-700 hover:shadow-2xl"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800">{g.category}</span>
                <span className="text-[10px] font-black flex items-center gap-1"><Clock size={12} /> {g.time}</span>
              </div>
              <h3 className="text-base font-black mb-1 leading-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{g.title}</h3>
              <p className="text-xs font-bold opacity-70 leading-relaxed">{g.excerpt}</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-blue-100 dark:border-neutral-900 mt-4">
              <span className="text-[11px] font-bold opacity-80">Poziom: {g.level}</span>
              <span className="text-xs font-black flex items-center gap-1 text-emerald-500">Czytaj poradnik <ArrowRight size={14} /></span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {activeGuide !== null && (
          <motion.div
            className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveGuide(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 18, opacity: 0, rotateX: -10, filter: 'blur(12px)' }}
              animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0, filter: 'blur(0px)' }}
              exit={{ scale: 0.96, y: 12, opacity: 0, filter: 'blur(10px)' }}
              transition={{ type: 'spring' as const, stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-3xl bg-white dark:bg-neutral-950 border border-blue-100 dark:border-neutral-800 shadow-2xl flex flex-col"
              style={{ perspective: 1200 }}
            >
              <div className="pointer-events-none absolute -top-24 -right-24 w-[340px] h-[340px] bg-gradient-to-tr from-lime-200 via-emerald-200 to-lime-100 opacity-25 blur-2xl legal-blob" />
              <div className="relative flex items-center justify-between p-6 border-b border-blue-100 dark:border-neutral-900 bg-white/85 dark:bg-neutral-950/85 backdrop-blur sticky top-0">
                <div className="pr-4">
                  <div className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 w-fit">{ACADEMY_GUIDES[activeGuide].category} · {ACADEMY_GUIDES[activeGuide].time}</div>
                  <h3 className="text-lg font-black tracking-tight mt-1.5 leading-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{ACADEMY_GUIDES[activeGuide].title}</h3>
                </div>
                <motion.button whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: 0.92 }} onClick={() => setActiveGuide(null)} className="w-8 h-8 rounded-full grid place-items-center bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 cursor-pointer shrink-0">
                  <X size={14} />
                </motion.button>
              </div>
              <div className="relative overflow-y-auto p-6 space-y-6 no-scrollbar text-left" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
                {ACADEMY_GUIDES[activeGuide].content.map((s) => (
                  <div key={s.h} className="space-y-2">
                    <h4 className="text-sm font-black tracking-tight">{s.h}</h4>
                    <p className="text-xs font-medium leading-relaxed opacity-85 whitespace-pre-wrap">{s.p}</p>
                  </div>
                ))}
                <div className="pt-4 flex justify-end border-t border-blue-100 dark:border-neutral-900">
                  <Button variant="primary" size="sm" onClick={() => setActiveGuide(null)}>Zamknij</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};


// Cookie banner — tylko pierwszy raz
