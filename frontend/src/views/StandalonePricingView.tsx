import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Coins,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cineParent, cineSoft, cineStagger } from '../lib/shared';
import { apiFetch } from '../lib/api';

export const StandalonePricingView = () => {

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto py-6 lg:py-10 px-6 lg:px-4 space-y-10 pb-24 text-[#111111] dark:text-white"
      style={{ perspective: 1600 }}
    >
      <motion.div variants={cineSoft} className="text-center space-y-3 relative">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[240px] morph-blob bg-gradient-to-tr from-lime-100 via-emerald-50 to-blue-50 dark:from-lime-500/10 dark:via-emerald-400/5 dark:to-blue-400/5 blur-3xl opacity-70" />
        <div className="relative text-emerald-500 dark:text-emerald-400 font-black text-xs tracking-[0.2em] uppercase">Cennik i Plany</div>
        <h2 className="relative text-5xl sm:text-6xl font-black tracking-tighter leading-[0.9]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
          Wybierz swój <span className="text-gradient-lime-soft font-story-script text-6xl sm:text-7xl px-1">Plan</span>
        </h2>
        <p className="relative text-sm font-bold max-w-xl mx-auto opacity-80 leading-relaxed">
          Odblokuj pełne możliwości AI. Twórz strony, szukaj klientów i zarabiaj bez limitów.
        </p>

        <p className="text-xs font-bold opacity-60">Płatność miesięczna - bez zobowiązań, anulujesz w każdej chwili</p>
      </motion.div>

      <motion.div
        variants={cineParent}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6 items-stretch"
        style={{ perspective: 1600 }}
      >
        {[
          { name: 'Starter', price: 50, credits: 100, features: ['100 kredytów AI / mies', 'Wyszukiwanie firm (5/mies)', 'Generowanie stron AI', 'Fakturowanie klientów'] },
          { name: 'Pro', price: 100, credits: 250, popular: true, features: ['250 kredytów AI / mies', 'Wyszukiwanie firm (25/mies)', 'Generowanie stron AI', 'Własne subdomeny'] },
          { name: 'Business', price: 199, credits: 500, features: ['500 kredytów AI / mies', 'Wyszukiwanie firm (100/mies)', 'Generowanie stron AI', 'Własne domeny'] },
          { name: 'Agencja', price: 500, credits: 1500, features: ['1500 kredytów AI / mies', 'Nielimitowane wyszukiwania', 'White-label (brak logo)', 'Wsparcie API'] }
        ].map((plan, idx) => {
          const finalPrice = plan.price;
          return (
            <motion.div
              custom={idx}
              variants={cineStagger}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              key={idx}
              className={`rounded-3xl p-7 lg:p-8 flex flex-col justify-between border transition-all relative shadow-xl ${
                plan.popular
                  ? 'border-blue-600 dark:border-white ring-2 ring-blue-600/20 dark:ring-white/20'
                  : 'bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#111111] text-white dark:bg-white dark:text-black text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                  Najpopularniejszy
                </div>
              )}

              <div>
                <h3 className="text-xl font-black mb-1" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{plan.name}</h3>

                <div className="flex items-baseline gap-1 my-4">
                  <span className="text-4xl font-black tracking-tighter">{finalPrice} zł</span>
                  <span className="text-sm font-bold opacity-60">/mies</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  <div className="p-3 rounded-xl text-center border bg-[#F7F6F3]/60 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-900">
                    <div className="text-base font-black text-emerald-500">{plan.credits}</div>
                    <div className="text-[10px] uppercase font-black opacity-60 tracking-wide">Kredytów</div>
                  </div>
                  <div className="p-3 rounded-xl text-center border bg-[#F7F6F3]/60 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-900">
                    <div className="text-base font-black text-emerald-500">{plan.name === 'Agencja' ? '∞' : plan.name === 'Business' ? '100' : plan.name === 'Pro' ? '25' : '5'}</div>
                    <div className="text-[10px] uppercase font-black opacity-60 tracking-wide">Projektów</div>
                  </div>
                </div>

                <ul className="space-y-3 text-sm">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 font-bold">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Button 
                variant={plan.popular ? 'primary' : 'outline'} 
                size="md" 
                onClick={() => { try { localStorage.setItem('sitemorph-plan', plan.name); } catch {} alert(`Zapisano pakiet ${plan.name} na tym urządzeniu. Płatności PayPal/BLIK/przelew obsłużysz w zakładce Finanse.`); }}
                className="w-full mt-6 font-black"
              >
                Wybierz {plan.name}
              </Button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Sklep kredytów - zakup pojedynczy bez pakietu */}
      <motion.div variants={cineSoft} className="rounded-3xl border p-6 lg:p-8 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800 space-y-4">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-emerald-500" />
          <h3 className="text-lg font-black">Dokup kredyty jednorazowo</h3>
          <span className="ml-auto text-[11px] font-bold opacity-60">bez pakietu - ważne 12 mies.</span>
        </div>
        <p className="text-xs font-bold opacity-70">Masz kredyty ≥5 = dostęp do Kreatora/Leadów/domen nawet bez pakietu. Poniżej 5 kredytów panel się blokuje.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { c: 50, price: 45 },
            { c: 100, price: 85 },
            { c: 250, price: 200 },
            { c: 500, price: 450 },
          ].map(p => (
            <div key={p.c} className="rounded-2xl border p-4 flex flex-col gap-3 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
              <div className="text-2xl font-black">{p.c} <span className="text-xs opacity-60">kredytów</span></div>
              <div className="text-sm font-black">{p.price} zł <span className="text-[10px] opacity-60">jednorazowo</span></div>
              <Button size="sm" onClick={async () => {
                const ok = confirm(`Kupić ${p.c} kredytów za ${p.price} zł? (demo - doda kredyty lokalnie)`);
                if (!ok) return;
                try { localStorage.setItem('sitemorph-credits-bought', String(p.c)); } catch {}
                try {
                  const r = await apiFetch('/api/credits/add', { method: 'POST', body: JSON.stringify({ credits: p.c }) });
                  if (r.ok) {
                    const d = await r.json();
                    try { localStorage.setItem('sitemorph-credits', String(d.credits)); } catch {}
                    alert(`Dodano ${p.c} kredytów. Stan: ${d.credits}`);
                    location.reload();
                    return;
                  }
                } catch {}
                // fallback lokalny
                try {
                  const cur = parseInt(localStorage.getItem('sitemorph-credits')||'0',10);
                  localStorage.setItem('sitemorph-credits', String(cur + p.c));
                } catch {}
                alert(`Dodano ${p.c} kredytów (lokalnie). Odśwież panel.`);
                location.reload();
              }} className="w-full">Kup {p.c}</Button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// 12. MODUŁ FINANSÓW
// ============================================================================
