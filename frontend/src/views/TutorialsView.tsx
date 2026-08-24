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
    title: 'Jak zdobyÄ‡ pierwszego klienta w 7 dni',
    category: 'SprzedaĹĽ',
    level: 'PoczÄ…tkujÄ…cy',
    time: '9 min',
    excerpt: 'Gotowy plan outreach: od wyboru niszy po pierwszÄ… fakturÄ™.',
    content: [
      { h: '1. Wybierz wÄ…skÄ… niszÄ™', p: 'Zamiast pisaÄ‡ do wszystkich, skup siÄ™ na 1 branĹĽy w 1 mieĹ›cie. PrzykĹ‚ad: â€žgabinet stomatologiczny w Poznaniuâ€ť lub â€žwarsztat samochodowy w GdaĹ„skuâ€ť. W Lead Finderze ustaw kraj Polska â†’ miasto PoznaĹ„ â†’ branĹĽa Gabinet stomatologiczny. Otrzymasz 20â€“40 rekordĂłw, z ktĂłrych poĹ‚owa nie ma strony â€” to Twoja ciepĹ‚a lista.' },
      { h: '2. Przygotuj darmowy mockup', p: 'W Kreatorze AI wpisz: â€žStwĂłrz nowoczesnÄ… stronÄ™ dla gabinetu Dentika w Poznaniu, jasna kolorystyka, sekcja cennik i rezerwacja onlineâ€ť. Wygeneruj, popraw nagĹ‚Ăłwek i skopiuj link podglÄ…du (PodglÄ…d na ĹĽywo). Masz dowĂłd zamiast obietnicy.' },
      { h: '3. WiadomoĹ›Ä‡, ktĂłra dziaĹ‚a', p: 'Temat: Szybka propozycja dla Dentika â€“ darmowy projekt strony\nCzeĹ›Ä‡ Anna,\nPrzygotowaĹ‚em darmowy projekt strony dla Was â€” zobacz: dentika.sitemorph.pl/podglad-91x\nStrona jest gotowa do uruchomienia w 1 dzieĹ„, z rezerwacjÄ… online i mapÄ…. JeĹ›li chcesz, wdroĹĽÄ™ jÄ… na Waszej domenie za 1 900 zĹ‚ netto â€” pĹ‚atnoĹ›Ä‡ dopiero po akceptacji.\nPozdrawiam, Jan â€” Morph Studio\nWyĹ›lij 10 takich maili dziennie. ĹšledĹş otwarcia w Lead Finderze.' },
      { h: '4. Follow-up i zamkniÄ™cie', p: 'DzieĹ„ 3: â€žCzeĹ›Ä‡ Anna, podbijam â€” projekt wygaĹ›nie za 2 dni, mam wolny termin w piÄ…tek na wdroĹĽenie.â€ť DzieĹ„ 7: telefon. ZamkniÄ™cie: wyĹ›lij fakturÄ™ z moduĹ‚u Finanse (Szablon: Projekt i wdroĹĽenie strony 1 450 zĹ‚ + copywriting 380 zĹ‚). 0% prowizji â€” caĹ‚oĹ›Ä‡ trafia na Twoje konto. Po 3 klientĂłw masz proces, ktĂłry moĹĽesz powtarzaÄ‡.' }
    ]
  },
  {
    title: 'Kreator AI: od promptu do publikacji w 5 minut',
    category: 'Kreator',
    level: 'PoczÄ…tkujÄ…cy',
    time: '7 min',
    excerpt: 'Prompt â†’ edycja â†’ podglÄ…d â†’ publikacja. DokĹ‚adny flow krok po kroku.',
    content: [
      { h: 'Krok 1: Napisz prompt', p: 'W Pulpicie wpisz jedno zdanie: â€žStwĂłrz stronÄ™ dla barbera ZĹ‚oty GrzebieĹ„ w Warszawie, ciemny motyw, sekcje: usĹ‚ugi, cennik, rezerwacja, opinie, Instagramâ€ť. Unikaj ogĂłlnikĂłw typu â€žĹ‚adna stronaâ€ť â€” AI potrzebuje branĹĽy, miasta i stylu.' },
      { h: 'Krok 2: Edytuj sekcje', p: 'Kliknij sekcjÄ™ â†’ wpisz â€žrozjaĹ›nij tĹ‚oâ€ť lub â€ždodaj sekcjÄ™ z opiniami 4.9 â…â€ť. KaĹĽda edycja to 2â€“5 kredytĂłw i pojawia siÄ™ w podglÄ…dzie na ĹĽywo. UĹĽyj starterĂłw (NieruchomoĹ›ci, SaaS, Restauracja) jeĹ›li brakuje Ci pomysĹ‚u.' },
      { h: 'Krok 3: PodglÄ…d i akceptacja', p: 'Skopiuj link podglÄ…du i wyĹ›lij klientowi. Klient otwiera na telefonie â€” widzi zmiany na ĹĽywo bez logowania. Gdy zaakceptuje, kliknij Opublikuj. Strona lÄ…duje na *.sitemorph.pl lub Twojej domenie (Business).' },
      { h: 'Krok 4: Publikacja', p: 'W Kreatorze â†’ Opublikuj â†’ wybierz domenÄ™. SSL i hosting w cenie. Czas generowania 2â€“3 min, edycje 9â€“14 s. Historia wersji bez limitu â€” wrĂłcisz do dowolnej wersji.' }
    ]
  },
  {
    title: 'Cennik, ktĂłry sprzedaje: 1 500 â€“ 12 000 zĹ‚',
    category: 'Biznes',
    level: 'Ĺšredniozaawansowany',
    time: '11 min',
    excerpt: 'Jak wyceniaÄ‡ bez zaniĹĽania i jak sprzedawaÄ‡ pakiety.',
    content: [
      { h: 'WideĹ‚ki realne', p: 'Polska 2024/2025: wizytĂłwka AI: 800â€“1 900 zĹ‚, strona firmowa 5â€“7 podstron: 2 500â€“4 500 zĹ‚, landing + copywriting SEO: 4 000â€“7 000 zĹ‚, white-label dla agencji: 8 000â€“12 000 zĹ‚. PoniĹĽej 800 zĹ‚ psujesz rynek i marĹĽÄ™.' },
      { h: 'Pakiety', p: 'Pakiet Start: strona + podglÄ…d + 1 poprawka â€” 1 900 zĹ‚. Pakiet Growth: Start + Lead Finder (20 leadĂłw) + 3 poprawki + domena â€” 3 900 zĹ‚. Pakiet Premium: Growth + 12 miesiÄ™cy utrzymania â€” 7 900 zĹ‚. Klient wybiera Ĺ›rodek â€” efekt kotwicy.' },
      { h: 'Upsell bez wciskania', p: 'Po akceptacji dodaj: â€žChcesz rezerwacjÄ™ online? +400 zĹ‚, wdroĹĽÄ™ w 1 dzieĹ„.â€ť lub â€žTeksty SEO na bloga â€” 5 artykuĹ‚Ăłw 380 zĹ‚â€ť. Wystawiasz drugÄ… fakturÄ™ w Finanse â†’ Nowa faktura â†’ status OczekujÄ…ca.' },
      { h: 'Negocjacje', p: 'Gdy klient mĂłwi â€žza drogoâ€ť: nie obniĹĽaj stawki, zmniejsz zakres. â€žOK, zrobimy 3 podstrony zamiast 6 za 1 450 zĹ‚â€ť. Zawsze zostaw furtkÄ™ do dokupienia reszty pĂłĹşniej.' }
    ]
  },
  {
    title: 'Domena i publikacja bez bĂłlu',
    category: 'Techniczne',
    level: 'Wszyscy',
    time: '6 min',
    excerpt: 'PodĹ‚Ä…cz wĹ‚asnÄ… domenÄ™, SSL i przekierowania w 10 minut.',
    content: [
      { h: 'Opcja A: subdomena SiteMorph', p: 'Najprostsza: twojklient.sitemorph.pl â€” dziaĹ‚a od razu po klikniÄ™ciu Opublikuj. Dobre na pokaz i test. MoĹĽesz zmieniÄ‡ pĂłĹşniej na wĹ‚asnÄ… domenÄ™ bez utraty treĹ›ci.' },
      { h: 'Opcja B: wĹ‚asna domena (zalecane)', p: 'Kup domenÄ™ (np. OVH, Aftermarket) â†’ w Kreatorze â†’ Opublikuj â†’ WĹ‚asna domena â†’ wpisz np. zlotygrzebien.pl â†’ skopiuj rekordy DNS (CNAME â†’ cname.sitemorph.pl, TXT do weryfikacji) â†’ wklej u rejestratora. Propagacja 5â€“60 min.' },
      { h: 'SSL i przekierowania', p: 'Certyfikat Letâ€™s Encrypt wystawia siÄ™ automatycznie. WymuĹ› HTTPS w panelu Kreatora. Ustaw przekierowanie www â†’ bez www (lub odwrotnie) jednym przeĹ‚Ä…cznikiem. Test: wpisz https://twojadomena.pl â€” kĹ‚Ăłdka musi byÄ‡ zielona.' },
      { h: 'Checklista przed wysyĹ‚kÄ… do klienta', p: '1) favicon i tytuĹ‚ SEO, 2) formularz kontaktowy test (wyĹ›lij prĂłbkÄ™), 3) RODO i cookies (wygeneruj w stopce), 4) podglÄ…d na telefonie (link dziaĹ‚a?), 5) faktura gotowa w Finanse. Dopiero wtedy wyĹ›lij link klientowi.' }
    ]
  }
];

// ============================================================================
// 6. WIDOK: EKRAN GĹĂ“WNY (LANDING SCROLLABLE)
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
          <p className="text-xs font-bold opacity-80">Poradniki tekstowe â€” czytaj, kopiuj szablony, wdraĹĽaj od razu.</p>
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
                  <div className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 w-fit">{ACADEMY_GUIDES[activeGuide].category} Â· {ACADEMY_GUIDES[activeGuide].time}</div>
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


// Cookie banner â€” tylko pierwszy raz

