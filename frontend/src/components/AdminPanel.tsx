import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Globe,
  Search,
  Settings,
  X,
  Wallet,
} from 'lucide-react';
import { Button, Badge } from '../components/ui';
import { apiFetch } from '../lib/api';

export const ADMIN_STATS = [
  { label: 'Użytkownicy', value: '1 284', delta: '+62 / 24h', icon: LayoutDashboard },
  { label: 'Strony wygenerowane', value: '3 912', delta: '+148 / tydzień', icon: Globe },
  { label: 'MRR', value: '24 700 zł', delta: '+8.4% m/m', icon: Wallet },
  { label: 'Leady znalezione', value: '18 340', delta: '+940 / tydzień', icon: Search }
];

export const ADMIN_USERS = [
  { name: 'anna.studio', plan: 'Pro', pages: 11, spent: '396 zł', joined: '14.06.2026' },
  { name: 'warsztat.karo', plan: 'Business', pages: 27, spent: '597 zł', joined: '03.03.2026' },
  { name: 'fitform.pl', plan: 'Pro', pages: 9, spent: '297 zł', joined: '22.05.2026' },
  { name: 'kwiaty.iwona', plan: 'Starter', pages: 3, spent: '147 zł', joined: '19.07.2026' }
];

export const ADMIN_SERVICES = [
  { name: 'API Gateway', status: 'Operational', latency: '84 ms' },
  { name: 'Baza danych (Postgres)', status: 'Operational', latency: '12 ms' },
  { name: 'Silnik AI', status: 'Operational', latency: '2.1 s / strona' },
  { name: 'Kolejka generowania', status: 'Operational', latency: '0 zadań' },
  { name: 'Fakturowanie (Stripe)', status: 'Degraded', latency: '310 ms' }
];

export const AdminPanel = ({ onClose, credits, setCredits }: { onClose: () => void; credits: number; setCredits: React.Dispatch<React.SetStateAction<number>> }) => {
  const [liveStats, setLiveStats] = useState([
    { label: 'Użytkownicy', value: '0', delta: '-', icon: LayoutDashboard },
    { label: 'Strony wygenerowane', value: '0', delta: '-', icon: Globe },
    { label: 'MRR', value: '0 zł', delta: '-', icon: Wallet },
    { label: 'Leady znalezione', value: '0', delta: '-', icon: Search },
  ]);
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [creditUser, setCreditUser] = useState('');
  const [creditAmount, setCreditAmount] = useState('25');
  const [creditMsg, setCreditMsg] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [planUser, setPlanUser] = useState('');
  const [planKey, setPlanKey] = useState('pro');
  const [planMsg, setPlanMsg] = useState('');

  useEffect(() => {
    const adminHash = sessionStorage.getItem('sitemorph-admin-hash') || '';
    apiFetch('/api/admin/stats', { headers: { 'X-Admin-Hash': adminHash } })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setLiveStats([
          { label: 'Użytkownicy', value: String(d.users ?? 0), delta: '-', icon: LayoutDashboard },
          { label: 'Strony wygenerowane', value: String(d.pages ?? 0), delta: '-', icon: Globe },
          { label: 'MRR', value: String(d.mrr ?? '0 zł'), delta: '-', icon: Wallet },
          { label: 'Leady znalezione', value: String(d.leads ?? 0), delta: '-', icon: Search },
        ]);
      })
      .catch((e) => {
        console.error('[AdminPanel] Stats error:', e);
        setLiveStats([
          { label: 'Użytkownicy', value: 'Błąd', delta: e.message, icon: LayoutDashboard },
          { label: 'Strony wygenerowane', value: 'Błąd', delta: '-', icon: Globe },
          { label: 'MRR', value: 'Błąd', delta: '-', icon: Wallet },
          { label: 'Leady znalezione', value: 'Błąd', delta: '-', icon: Search },
        ]);
      });
    // Load users
    apiFetch('/api/admin/users', { headers: { 'X-Admin-Hash': adminHash } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setLiveUsers(d.users || []))
      .catch(() => {});
    // Load plans
    apiFetch('/api/admin/plans', { headers: { 'X-Admin-Hash': adminHash } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setPlans(Object.values(d.plans || {})))
      .catch(() => {});
  }, []);

  const handleSetPlan = async () => {
    if (!planUser.trim()) return;
    setPlanMsg('');
    try {
      const adminHash = sessionStorage.getItem('sitemorph-admin-hash') || '';
      const res = await apiFetch('/api/admin/user/plan', {
        method: 'POST',
        headers: { 'X-Admin-Hash': adminHash, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: planUser, plan: planKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      setPlanMsg(`Ustawiono plan ${planKey} dla ${planUser}`);
      setTimeout(() => setPlanMsg(''), 3000);
      // Refresh users
      const adminHash2 = sessionStorage.getItem('sitemorph-admin-hash') || '';
      apiFetch('/api/admin/users', { headers: { 'X-Admin-Hash': adminHash2 } })
        .then(async (r) => r.json())
        .then((d) => setLiveUsers(d.users || []));
    } catch (e: any) {
      setPlanMsg(e.message || 'Błąd ustawiania planu');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, filter: 'blur(12px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.97, filter: 'blur(12px)' }}
      transition={{ type: 'spring' as const, stiffness: 220, damping: 22 }}
      className="fixed inset-0 z-[95] overflow-y-auto bg-[var(--sm-bg)] text-[var(--sm-text)] no-scrollbar"
    >
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="mb-7 flex items-center justify-between pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--sm-surface-hover)]"><Settings size={20} /></div>
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Panel administratora</h1>
              <p className="text-[14px] text-[var(--sm-text-secondary)]">Dane o stronie w jednym miejscu</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}><X size={14} /> Zamknij panel</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {liveStats.map((s) => (
            <motion.div key={s.label} whileHover={{ y: -1 }} className="rounded-[16px] bg-[var(--sm-surface)] p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--sm-text-quiet)]">{s.label}</span>
                <s.icon size={16} className="text-[var(--sm-text-quiet)]" />
              </div>
              <div className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em]">{s.value}</div>
              <div className="mt-2 text-[14px] font-medium text-[var(--sm-success)]">{s.delta}</div>
            </motion.div>
          ))}
        </div>

        <div className="mb-6 rounded-[16px] bg-[var(--sm-surface)] p-5">
          <h3 className="mb-3 text-[16px] font-semibold">Zarządzanie kredytami</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={creditUser} onChange={(e) => setCreditUser(e.target.value)} placeholder="Nazwa użytkownika" className="min-h-[44px] rounded-[12px] border-none bg-[var(--sm-control-bg)] px-3 py-2 text-[14px] text-[var(--sm-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sm-accent)]" />
            <select value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="min-h-[44px] cursor-pointer rounded-[12px] border-none bg-[var(--sm-control-bg)] px-3 py-2 text-[14px] text-[var(--sm-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sm-accent)]">
              <option value="10">+10 kredytów</option>
              <option value="25">+25 kredytów</option>
              <option value="50">+50 kredytów</option>
              <option value="100">+100 kredytów</option>
              <option value="500">+500 kredytów</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const amt = parseInt(creditAmount, 10) || 0;
                if (creditUser.trim()) {
                  setCredits((c) => c + amt);
                }
                setCreditMsg(`Dodano ${amt} kredytów dla ${creditUser || '(brak nazwy)'} (demo)`);
                setTimeout(() => setCreditMsg(''), 3000);
              }}
              className="font-semibold"
            >
              Dodaj kredyty
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[14px]">
            <span className="opacity-70">Twoje kredyty: {credits}</span>
            {creditMsg && <span className="text-[var(--sm-success)]">· {creditMsg}</span>}
          </div>
          <p className="mt-1 text-[14px] text-[var(--sm-text-secondary)]">Dodaj kredyty dowolnemu użytkownikowi (demo).</p>
        </div>

        {/* Plan Management */}
        <div className="mb-6 rounded-[16px] bg-[var(--sm-surface)] p-5">
          <h3 className="mb-3 text-[16px] font-semibold">Zarządzanie planami użytkowników</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <input value={planUser} onChange={(e) => setPlanUser(e.target.value)} placeholder="User ID (email lub ID)" className="min-h-[44px] rounded-[12px] border-none bg-[var(--sm-control-bg)] px-3 py-2 text-[14px] text-[var(--sm-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sm-accent)]" />
            <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} className="min-h-[44px] cursor-pointer rounded-[12px] border-none bg-[var(--sm-control-bg)] px-3 py-2 text-[14px] text-[var(--sm-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sm-accent)]">
              {(plans.length ? plans : [{name:'Starter',credits:10,price:49},{name:'Pro',credits:50,price:99},{name:'Business',credits:200,price:199},{name:'Agencja',credits:500,price:499}]).map((p: any) => (
                <option key={(p.name||p).toLowerCase()} value={(p.name||p).toLowerCase()}>
                  {p.name} ({p.credits} kr/mies, {p.price} zł)
                </option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={handleSetPlan} className="font-semibold">
              Ustaw plan
            </Button>
          </div>
          {planMsg && <p className="mt-3 text-[14px] text-[var(--sm-success)]">{planMsg}</p>}
          <div className="mt-4 space-y-2">
            {(plans.length ? plans : [{name:'Starter',credits:10,price:49,features:['Builder podstawowy']},{name:'Pro',credits:50,price:99,features:['Galeria','Animacje']},{name:'Business',credits:200,price:199,features:['Team','FAQ']},{name:'Agencja',credits:500,price:499,features:['CMS','Multi-language']}]).map((p: any) => (
              <div key={p.name} className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--sm-text-secondary)]">
                <span className="rounded-[6px] bg-[var(--sm-surface-hover)] px-2 py-0.5 font-medium text-[var(--sm-text)]">{p.name}</span>
                <span className="text-[var(--sm-text-secondary)]">{p.credits} kr/mies</span>
                <span className="text-[var(--sm-text-secondary)]">{p.price} zł/mies</span>
                <span className="opacity-50">{(p.features||[]).join(', ')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="overflow-hidden rounded-[16px] bg-[var(--sm-surface)] lg:col-span-2">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-sm font-semibold">Ostatni użytkownicy</h3>
              <Badge type="blue">{liveUsers.length} kont</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[14px]">
                <thead className="bg-[var(--sm-surface-hover)]">
                  <tr className="font-semibold">
                    <th className="px-4 py-2.5">Użytkownik</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Stron</th><th className="px-4 py-2.5">Wydane</th><th className="px-4 py-2.5">Dołączył</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--sm-border-subtle)]">
                  {liveUsers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--sm-text-secondary)]">Brak danych - na razie 0 użytkowników</td></tr>
                  ) : liveUsers.map((u) => (
                    <tr key={u.user_id || u.name} className="hover:bg-[var(--sm-surface-hover)]">
                      <td className="px-4 py-3 font-semibold truncate max-w-[180px]">{u.user_id || u.name}</td><td className="px-4 py-3">{u.plan}</td><td className="px-4 py-3">{u.credits ?? u.pages ?? 0}</td><td className="px-4 py-3 text-[var(--sm-success)]">{u.spent}</td><td className="px-4 py-3 opacity-70">{u.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[16px] bg-[var(--sm-surface)] p-5">
              <h3 className="mb-3 text-[16px] font-semibold">Status usług</h3>
              <div className="space-y-2.5">
                {ADMIN_SERVICES.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between text-[14px]">
                    <div>
                      <div className="font-semibold leading-none">{svc.name}</div>
                      <div className="text-[13px] text-[var(--sm-text-quiet)]">{svc.latency}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${svc.status === 'Operational' ? 'bg-[rgba(22,163,74,0.12)] text-[var(--sm-success)]' : 'bg-[rgba(217,119,6,0.12)] text-[var(--sm-warning)]'}`}>{svc.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] bg-[var(--sm-surface)] p-5">
              <h3 className="mb-2 text-[16px] font-semibold">Informacje o stronie</h3>
              <div className="space-y-2 text-[14px]">
                <div className="flex justify-between"><span className="text-[var(--sm-text-secondary)]">Wersja</span><span>SiteMorph 2.4.1</span></div>
                <div className="flex justify-between"><span className="text-[var(--sm-text-secondary)]">Build</span><span>2026.08.22</span></div>
                <div className="flex justify-between"><span className="text-[var(--sm-text-secondary)]">Środowisko</span><span>production</span></div>
                <div className="flex justify-between"><span className="text-[var(--sm-text-secondary)]">Uptime</span><span>99.97% / 30 dni</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[14px] p-4 text-[14px] leading-[1.6] text-[var(--sm-text-secondary)]" style={{ background: 'rgba(217,119,6,0.08)' }}>
          <span className="font-semibold">Uwaga:</span> to jest panel demo w przeglądarce. Prawdziwa weryfikacja hasła powinna odbywać się na backendzie (<code className="rounded-[6px] bg-[var(--sm-surface-hover)] px-1.5 py-0.5">POST /api/admin/verify</code>). Tutaj porównujemy jedynie SHA-256 hasha, więc hasło w jawnej postaci nie występuje w kodzie frontendu.
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// 14. WIDOK: POMOC
// ============================================================================
