import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2 } from 'lucide-react';
import { Button } from '../components/ui';
import { cineParent, cineSoft, itemVariants } from '../lib/shared';
import { apiFetch } from '../lib/api';

const FIELDS: Array<{ key: string; label: string; placeholder: string; hint?: string; type?: string }> = [
  { key: 'display_name', label: 'Wyświetlana nazwa', placeholder: 'np. Oskar' },
  { key: 'seller_name', label: 'Nazwa firmy (na fakturach)', placeholder: 'np. Studio Projektowe' },
  { key: 'seller_email', label: 'Email wystawcy faktur', placeholder: 'jan@studio.pl', hint: 'Pojawi się na fakturach jako nadawca — odpowiedzi klientów trafią do Ciebie.' },
  { key: 'seller_address', label: 'Adres firmy', placeholder: 'ul. Prosta 1, 00-001 Warszawa' },
  { key: 'seller_nip', label: 'NIP', placeholder: '0000000000' },
  { key: 'iban', label: 'Numer IBAN (przelewy)', placeholder: 'PL00 0000 0000 0000 0000 0000 0000', hint: 'Numer IBAN jest bezpieczny — służy wyłącznie do odbierania przelewów i nie daje nikomu dostępu do konta.' },
  { key: 'blik_phone', label: 'Telefon BLIK', placeholder: '+48 500 000 000' },
  { key: 'paypal_link', label: 'Link PayPal', placeholder: 'https://paypal.me/twojafirma' },
];

export const SettingsView = () => {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/settings');
        if (res.status === 401) { setNeedLogin(true); return; }
        if (res.ok) setData(await res.json().then((d) => d.settings || {}));
      } catch { /* offline */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      const res = await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ data }) });
      if (res.status === 401) { setNeedLogin(true); return; }
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Błąd ${res.status}`);
      setMsg('Zapisano ustawienia ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e.message || 'Nie udało się zapisać');
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = "w-full rounded-xl px-3.5 py-2 text-xs font-bold outline-none border text-blue-600 dark:text-white placeholder:text-blue-400 dark:placeholder:text-neutral-500 bg-blue-50/40 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800";

  return (
    <motion.div
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto py-8 px-6 pb-16 text-blue-600 dark:text-white"
      style={{ perspective: 1200 }}
    >
      <motion.div variants={cineSoft} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-blue-100 dark:bg-neutral-900 text-blue-600 dark:text-white border border-blue-200 dark:border-neutral-800">
          <Settings size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Ustawienia</h1>
          <p className="text-xs font-bold opacity-80">Twoje dane firmy, płatności i faktury w jednym miejscu.</p>
        </div>
      </motion.div>

      {needLogin ? (
        <motion.div variants={itemVariants} className="rounded-2xl border p-6 bg-blue-50/40 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800 text-center space-y-2">
          <p className="text-sm font-black">Zaloguj się, aby zarządzać ustawieniami</p>
          <p className="text-xs font-bold opacity-70">Ustawienia są przypisane do Twojego konta SiteMorph.</p>
        </motion.div>
      ) : loading ? (
        <div className="py-16 text-center text-xs font-black opacity-60">Ładowanie…</div>
      ) : (
        <motion.div variants={itemVariants} className="rounded-2xl border p-6 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.hint ? 'sm:col-span-2' : ''}>
                <label className="text-[10px] font-black block mb-1 uppercase opacity-75">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={data[f.key] || ''}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className={inputClasses}
                />
                {f.hint && <p className="text-[10px] font-bold opacity-60 mt-1">{f.hint}</p>}
              </div>
            ))}
          </div>
          {err && <p className="text-xs font-black text-rose-500">{err}</p>}
          {msg && <p className="text-xs font-black text-emerald-500">{msg}</p>}
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} className="font-black gap-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Zapisz ustawienia
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
