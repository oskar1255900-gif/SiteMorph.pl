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
  { name: 'oskar1255900', plan: 'Starter', pages: 2, spent: '49 zł', joined: '02.08.2026' },
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
    { label: 'Użytkownicy', value: '0', delta: '—', icon: LayoutDashboard },
    { label: 'Strony wygenerowane', value: '0', delta: '—', icon: Globe },
    { label: 'MRR', value: '0 zł', delta: '—', icon: Wallet },
    { label: 'Leady znalezione', value: '0', delta: '—', icon: Search },
  ]);
  const [liveUsers, setLiveUsers] = useState<typeof ADMIN_USERS>([]);
  const [creditUser, setCreditUser] = useState('oskar1255900');
  const [creditAmount, setCreditAmount] = useState('25');
  const [creditMsg, setCreditMsg] = useState('');

  useEffect(() => {
    const adminHash = sessionStorage.getItem('sitemorph-admin-hash') || '';
    apiFetch('/api/admin/stats', { headers: { 'X-Admin-Hash': adminHash } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setLiveStats([
          { label: 'Użytkownicy', value: String(d.users ?? 0), delta: '—', icon: LayoutDashboard },
          { label: 'Strony wygenerowane', value: String(d.pages ?? 0), delta: '—', icon: Globe },
          { label: 'MRR', value: String(d.mrr ?? '0 zł'), delta: '—', icon: Wallet },
          { label: 'Leady znalezione', value: String(d.leads ?? 0), delta: '—', icon: Search },
        ]);
      })
      .catch(() => {});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, filter: 'blur(12px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.97, filter: 'blur(12px)' }}
      transition={{ type: 'spring' as const, stiffness: 220, damping: 22 }}
      className="fixed inset-0 z-[95] bg-white dark:bg-black text-blue-600 dark:text-white overflow-y-auto no-scrollbar"
    >
      {/* morph blobs */}
      <div className="pointer-events-none fixed -top-32 -right-32 w-[520px] h-[520px] bg-gradient-to-tr from-lime-200 via-emerald-100 to-lime-100 dark:from-lime-500/15 dark:via-emerald-400/10 dark:to-lime-400/15 blur-3xl morph-blob" />
      <div className="pointer-events-none fixed -bottom-32 -left-32 w-[460px] h-[460px] bg-gradient-to-tr from-blue-100 via-sky-100 to-lime-100 dark:from-blue-500/10 dark:via-sky-400/5 dark:to-lime-400/10 blur-3xl morph-blob" style={{ animationDelay: '1.2s' }} />

      <div className="relative max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between border-b border-blue-100 dark:border-neutral-900 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-white text-white dark:text-black grid place-items-center font-black"><Settings size={18} /></div>
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Panel administratora</h1>
              <p className="text-[11px] font-bold opacity-60">Tylko dla administratora · wszystkie dane o stronie w jednym miejscu</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}><X size={14} /> Zamknij panel</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {liveStats.map((s) => (
            <motion.div key={s.label} whileHover={{ y: -4, scale: 1.02 }} className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{s.label}</span>
                <s.icon size={14} className="opacity-60" />
              </div>
              <div className="text-2xl font-black mt-1" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{s.value}</div>
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">{s.delta}</div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 mb-6">
          <h3 className="text-sm font-black mb-3">Zarządzanie kredytami</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={creditUser} onChange={(e) => setCreditUser(e.target.value)} placeholder="Nazwa użytkownika" className="px-3 py-2 rounded-xl border text-xs font-bold bg-blue-50/40 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 outline-none" />
            <select value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="px-3 py-2 rounded-xl border text-xs font-black bg-blue-50/40 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 cursor-pointer">
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
                if (creditUser.trim().toLowerCase() === 'oskar1255900') {
                  setCredits((c) => c + amt);
                }
                setCreditMsg(`Dodano ${amt} kredytów dla ${creditUser} ${creditUser.toLowerCase() !== 'oskar1255900' ? '(demo)' : ''}`);
                setTimeout(() => setCreditMsg(''), 3000);
              }}
              className="font-black"
            >
              Dodaj kredyty
            </Button>
          </div>
          <div className="text-xs font-bold mt-3 flex items-center gap-2">
            <span className="opacity-70">Twoje kredyty: {credits}</span>
            {creditMsg && <span className="text-emerald-600 dark:text-emerald-400">· {creditMsg}</span>}
          </div>
          <p className="text-[10px] font-bold opacity-60 mt-1">Wszystko w panelu administratora — dodaj sobie lub komuś innemu. Przykład: wpisz „oskar1255900” aby doładować swoje konto.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 overflow-hidden">
            <div className="p-4 border-b border-blue-100 dark:border-neutral-900 flex items-center justify-between">
              <h3 className="text-sm font-black">Ostatni użytkownicy</h3>
              <Badge type="lime">{liveUsers.length} kont</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-blue-50/60 dark:bg-neutral-900">
                  <tr className="font-black">
                    <th className="px-4 py-2.5">Użytkownik</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Stron</th><th className="px-4 py-2.5">Wydane</th><th className="px-4 py-2.5">Dołączył</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 dark:divide-neutral-900">
                  {liveUsers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center font-bold opacity-60">Brak danych — na razie 0 użytkowników</td></tr>
                  ) : liveUsers.map((u) => (
                    <tr key={u.name} className="font-bold hover:bg-blue-50/40 dark:hover:bg-neutral-900/40">
                      <td className="px-4 py-3 font-black">{u.name}</td><td className="px-4 py-3">{u.plan}</td><td className="px-4 py-3">{u.pages}</td><td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{u.spent}</td><td className="px-4 py-3 opacity-70">{u.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
              <h3 className="text-sm font-black mb-3">Status usług</h3>
              <div className="space-y-2.5">
                {ADMIN_SERVICES.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black leading-none">{svc.name}</div>
                      <div className="text-[10px] font-bold opacity-60">{svc.latency}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black ${svc.status === 'Operational' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>{svc.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
              <h3 className="text-sm font-black mb-2">Informacje o stronie</h3>
              <div className="space-y-2 text-xs font-bold">
                <div className="flex justify-between"><span className="opacity-60">Wersja</span><span>SiteMorph 2.4.1</span></div>
                <div className="flex justify-between"><span className="opacity-60">Build</span><span>2026.08.22</span></div>
                <div className="flex justify-between"><span className="opacity-60">Środowisko</span><span>production</span></div>
                <div className="flex justify-between"><span className="opacity-60">Uptime</span><span>99.97% / 30 dni</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-xs font-bold leading-relaxed">
          <span className="font-black">Uwaga:</span> to jest panel demo w przeglądarce. Prawdziwa weryfikacja hasła powinna odbywać się na backendzie (<code className="px-1 py-0.5 rounded bg-white dark:bg-black border">POST /api/admin/verify</code>). Tutaj porównujemy jedynie SHA-256 hasha, więc hasło w jawnej postaci nie występuje w kodzie frontendu.
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// 14. WIDOK: POMOC
// ============================================================================
