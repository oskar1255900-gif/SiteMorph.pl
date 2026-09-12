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
      className="mx-auto max-w-6xl space-y-10 px-5 py-8 pb-24 text-[var(--sm-text)] lg:px-4 lg:py-12"
    >
      <motion.div variants={cineSoft} className="space-y-3">
        <h1 className="sm-h1">Cennik i plany</h1>
        <p className="max-w-xl text-[16px] leading-[1.55] text-[var(--sm-text-2)]">
          Odblokuj pełne możliwości AI — twórz strony, szukaj klientów i rozliczaj się bez prowizji.
        </p>
        <p className="text-[14px] text-[var(--sm-text-3)]">Płatność miesięczna, bez zobowiązań. Anulujesz w każdej chwili.</p>
      </motion.div>

      <motion.div
        variants={cineParent}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4 lg:gap-6"
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
              className={`relative flex flex-col justify-between rounded-[14px] border p-6 transition-colors lg:p-7 ${
                plan.popular
                  ? 'border-[var(--sm-accent)] bg-[var(--sm-surface)]'
                  : 'border-[var(--sm-border)] bg-[var(--sm-surface)]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[var(--sm-accent)] bg-[var(--sm-surface)] px-3 py-1 text-[13px] font-medium text-[var(--sm-accent)] whitespace-nowrap">
                  Najpopularniejszy
                </div>
              )}

              <div>
                <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{plan.name}</h3>

                <div className="my-4 flex items-baseline gap-1">
                  <span className="text-[34px] font-semibold leading-none tracking-[-0.03em]">{finalPrice} zł</span>
                  <span className="text-[15px] text-[var(--sm-text-2)]">/mies</span>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-2.5">
                  <div className="sm-card-quiet p-3 text-center">
                    <div className="text-[18px] font-semibold">{plan.credits}</div>
                    <div className="mt-0.5 text-[13px] text-[var(--sm-text-3)]">Kredytów</div>
                  </div>
                  <div className="sm-card-quiet p-3 text-center">
                    <div className="text-[18px] font-semibold">{plan.name === 'Agencja' ? '∞' : plan.name === 'Business' ? '100' : plan.name === 'Pro' ? '25' : '5'}</div>
                    <div className="mt-0.5 text-[13px] text-[var(--sm-text-3)]">Projektów</div>
                  </div>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px] text-[var(--sm-text-2)]">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--sm-accent)]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                variant={plan.popular ? 'primary' : 'outline'}
                size="md"
                onClick={() => { try { localStorage.setItem('sitemorph-plan', plan.name); } catch {} alert(`Zapisano pakiet ${plan.name} na tym urządzeniu. Płatności PayPal/BLIK/przelew obsłużysz w zakładce Finanse.`); }}
                className="mt-6 w-full"
              >
                Wybierz {plan.name}
              </Button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Sklep kredytów - zakup pojedynczy bez pakietu */}
      <motion.div variants={cineSoft} className="sm-card space-y-4 p-6 lg:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Coins size={19} className="text-[var(--sm-accent)]" />
          <h3 className="text-[19px] font-semibold tracking-[-0.02em]">Dokup kredyty jednorazowo</h3>
          <span className="ml-auto text-[14px] text-[var(--sm-text-3)]">bez pakietu · ważne 12 miesięcy</span>
        </div>
        <p className="text-[15px] leading-[1.55] text-[var(--sm-text-2)]">
          Z kredytami ≥ 5 masz dostęp do kreatora, Lead Findera i domen nawet bez pakietu.
          Poniżej 5 kredytów panel się blokuje.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { c: 50, price: 45 },
            { c: 100, price: 85 },
            { c: 250, price: 200 },
            { c: 500, price: 450 },
          ].map(p => (
            <div key={p.c} className="sm-card-quiet flex flex-col gap-3 p-4">
              <div className="text-[24px] font-semibold leading-none">{p.c} <span className="text-[14px] text-[var(--sm-text-2)]">kredytów</span></div>
              <div className="text-[16px] font-medium">{p.price} zł <span className="text-[14px] text-[var(--sm-text-3)]">jednorazowo</span></div>
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
