import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, X, RefreshCw, Copy, ExternalLink, Link2, AlertCircle } from 'lucide-react';
import { Button, Badge } from '../components/ui';
import { apiFetch } from '../lib/api';
import { cineParent, cineSoft, itemVariants } from '../lib/shared';

type PageRow = {
  id: string;
  title: string;
  url: string;
  custom_domain: string | null;
  domain_verified: boolean;
};

type DnsRecord = { type: string; name: string; value: string; desc: string };
type DnsInfo = { target_cname?: string; target_ip?: string; records: DnsRecord[]; note?: string };

const CopyBtn = ({ value }: { value: string }) => (
  <button
    onClick={() => navigator.clipboard?.writeText(value)}
    className="shrink-0 p-1 rounded-md hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 border border-transparent hover:border-[#EAEAEA] dark:hover:border-neutral-800 cursor-pointer bg-transparent"
    title="Kopiuj"
  >
    <Copy size={12} />
  </button>
);

export const DomainsView = ({ theme }: { theme: 'light' | 'dark' }) => {
  const [plan] = useState(() => {
    try { return (localStorage.getItem('sitemorph-plan') || 'starter').toLowerCase(); } catch { return 'starter'; }
  });
  const planOk = ['pro', 'business', 'agencja', 'premium'].includes(plan);
  const planHeader = { 'X-User-Plan': plan };
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [err, setErr] = useState('');
  const [pageId, setPageId] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [dnsInfo, setDnsInfo] = useState<DnsInfo | null>(null);
  const [attachedDomain, setAttachedDomain] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await apiFetch('/api/domains/mine');
      if (res.status === 401) { setNeedLogin(true); setPages([]); return; }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Błąd ${res.status}`);
      }
      const data = await res.json();
      setNeedLogin(false);
      setPages(data.pages || []);
      if (!pageId && data.pages?.length) setPageId(data.pages[0].id);
    } catch (e: any) {
      console.error('[DomainsView] Load error:', e);
      setErr(e.message || 'Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const handleAttach = async () => {
    const domain = domainInput.trim();
    if (!domain || !pageId) return;
    setAttaching(true);
    setErr('');
    try {
      const res = await apiFetch('/api/domains', {
        method: 'POST',
        headers: planHeader,
        body: JSON.stringify({ page_id: pageId, domain }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Błąd ${res.status}`);
      }
      const data = await res.json();
      setDnsInfo(data.dns);
      setAttachedDomain(data.domain);
      setVerifyMsg('');
      await load();
    } catch (e: any) {
      console.error('[DomainsView] Attach error:', e);
      setErr(e.message || 'Nie udało się podpiąć domeny');
    } finally {
      setAttaching(false);
    }
  };

  const handleVerify = async (pid: string) => {
    setVerifyingId(pid);
    setVerifyMsg('');
    try {
      const res = await apiFetch(`/api/domains/${pid}/verify`, { method: 'POST', headers: planHeader });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Błąd ${res.status}`);
      }
      const data = await res.json();
      setVerifyMsg(data.message);
      await load();
    } catch (e: any) {
      console.error('[DomainsView] Verify error:', e);
      setVerifyMsg(e.message || 'Błąd weryfikacji');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDetach = async (pid: string) => {
    setVerifyingId(pid);
    try {
      await apiFetch(`/api/domains/${pid}`, { method: 'DELETE' });
      if (attachedDomain && pages.find((p) => p.id === pid)?.custom_domain === attachedDomain) {
        setDnsInfo(null);
        setAttachedDomain(null);
      }
      await load();
    } catch {
      /* cicho */
    } finally {
      setVerifyingId(null);
    }
  };

  const apiOrigin = window.location.protocol + '//' + window.location.host;

  return (
    <motion.div
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto py-8 px-6 pb-16 text-[#111111] dark:text-white"
      style={{ perspective: 1200 }}
    >
      <motion.div variants={cineSoft} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-blue-100 dark:bg-neutral-900 text-[#111111] dark:text-white border border-[#EAEAEA] dark:border-neutral-800">
          <Globe size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Własne domeny</h1>
          <p className="text-xs font-bold opacity-80">Podłącz domenę swojej firmy i publikuj strony bez linku demo.</p>
        </div>
      </motion.div>

      {needLogin ? (
        <motion.div variants={itemVariants} className="rounded-2xl border p-6 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 text-center space-y-2">
          <p className="text-sm font-black">Zaloguj się, aby zarządzać domenami</p>
          <p className="text-xs font-bold opacity-70">Domeny są przypisane do Twojego konta SiteMorph.</p>
        </motion.div>
      ) : loading ? (
        <div className="py-16 text-center text-xs font-black opacity-60">Ładowanie…</div>
      ) : (
        <>
          {/* Podpinanie nowej domeny */}
          <motion.div variants={itemVariants} className="rounded-2xl border p-5 mb-6 bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
            <h3 className="text-sm font-black mb-3">Podłącz domenę</h3>
            {!planOk ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-xs font-bold space-y-1">
                <p className="font-black">Własne domeny są dostępne w pakietach od 100 zł/mies (Pro, Business, Agencja).</p>
                <p className="opacity-70">Twój obecny plan: <span className="font-black uppercase">{plan}</span>. Ulepsz plan w zakładce „Cennik & Plany”, aby podpiąć domenę swojej firmy.</p>
              </div>
            ) : pages.length === 0 ? (
              <p className="text-xs font-bold opacity-70">Najpierw opublikuj stronę w Kreatorze AI - potem wróć tutaj i podepnij pod nią swoją domenę.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
                <select
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-xs font-bold outline-none bg-[#F7F6F3]/40 dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800 cursor-pointer max-w-full truncate"
                >
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAttach(); }}
                  placeholder="twojafirma.pl"
                  className="px-3 py-2 rounded-xl border text-xs font-bold outline-none bg-[#F7F6F3]/40 dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800 placeholder:text-blue-400 dark:placeholder:text-neutral-500"
                />
                <Button variant="primary" size="sm" onClick={handleAttach} disabled={attaching || !domainInput.trim()} className="font-black whitespace-nowrap">
                  <Link2 size={14} /> {attaching ? 'Podpinam…' : 'Podłącz'}
                </Button>
              </div>
            )}
            {err && <p className="text-xs font-black text-rose-600 dark:text-rose-400 mt-3">{err}</p>}
          </motion.div>

          {/* Instrukcja DNS po podpięciu */}
          <AnimatePresence>
            {dnsInfo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border p-5 mb-6 bg-emerald-50/60 dark:bg-neutral-950 border-emerald-200 dark:border-neutral-800"
              >
                <h3 className="text-sm font-black mb-1">Krok 2 - ustaw rekordy DNS u rejestratora</h3>
                <p className="text-xs font-bold opacity-70 mb-4">
                  Wejdź w panel zarządzania DNS tam, gdzie kupiłeś domenę <span className="font-black">{attachedDomain}</span> i dodaj wpisy:
                </p>
                <div className="space-y-3">
                  {(dnsInfo.records || []).map((r, i) => (
                    <div key={i} className="rounded-xl border p-3 bg-white dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 mb-1.5">
                        <Badge type="lime">{r.type}</Badge> {r.desc}
                      </div>
                      <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center text-xs font-bold">
                        <span className="opacity-60">Nazwa:</span>
                        <span className="flex items-center gap-1.5 min-w-0"><code className="truncate px-1.5 py-0.5 rounded bg-[#F7F6F3] dark:bg-neutral-950 border border-[#EAEAEA] dark:border-neutral-800">{r.name}</code><CopyBtn value={r.name} /></span>
                        <span className="opacity-60 hidden sm:block">Wartość:</span>
                        <span className="col-span-2 sm:col-span-1 flex items-center gap-1.5 min-w-0">
                          <code className="truncate px-1.5 py-0.5 rounded bg-[#F7F6F3] dark:bg-neutral-950 border border-[#EAEAEA] dark:border-neutral-800">{r.value}</code><CopyBtn value={r.value} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-bold opacity-60 mt-3 flex items-start gap-1.5">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {dnsInfo.note}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista stron */}
          <motion.div variants={itemVariants} className="rounded-2xl border bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 overflow-hidden">
            <div className="p-4 border-b border-[#EAEAEA] dark:border-neutral-900 flex items-center justify-between">
              <h3 className="text-sm font-black">Twoje strony</h3>
              <button onClick={() => load()} className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-1 cursor-pointer bg-transparent border-none">
                <RefreshCw size={11} /> Odśwież
              </button>
            </div>
            <div className="divide-y divide-blue-50 dark:divide-neutral-900">
              {pages.length === 0 ? (
                <div className="p-10 text-center text-xs font-bold opacity-60">Brak opublikowanych stron</div>
              ) : (
                pages.map((p) => (
                  <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black truncate">{p.title}</div>
                      <a href={`${apiOrigin}/p/${p.id}`} target="_blank" rel="noreferrer" className="text-[11px] font-bold opacity-60 hover:text-emerald-500 inline-flex items-center gap-1 mt-0.5">
                        {apiOrigin}/p/{p.id} <ExternalLink size={10} />
                      </a>
                      {p.custom_domain && (
                        <div className="text-xs font-black mt-1 flex items-center gap-2">
                          <Globe size={12} />
                          {p.custom_domain}
                          {p.domain_verified
                            ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400"><Check size={11} /> AKTYWNA</span>
                            : <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">OCZEKUJE NA DNS</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {p.custom_domain && !p.domain_verified && (
                        <Button variant="outline" size="sm" onClick={() => handleVerify(p.id)} disabled={verifyingId === p.id}>
                          <RefreshCw size={12} className={verifyingId === p.id ? 'animate-spin' : ''} /> Sprawdź teraz
                        </Button>
                      )}
                      {p.custom_domain && (
                        <button onClick={() => handleDetach(p.id)} title="Odepnij domenę" className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-neutral-900 text-rose-500 cursor-pointer bg-transparent border-none">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {verifyMsg && (
            <p className="text-xs font-black mt-4 text-[#111111] dark:text-white opacity-80">{verifyMsg}</p>
          )}

          <div className="mt-8 rounded-2xl border p-4 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 text-xs font-bold leading-relaxed opacity-80">
            <span className="font-black">Jak to działa?</span> Kupujesz domenę gdziekolwiek (np. OVH, home.pl, Namecheap), wpisujesz u nich dwa rekordy DNS z tabelki powyżej, klikasz „Sprawdź teraz” - i gotowe. Strona działa na Twojej domenie, hosting pozostaje po naszej stronie.
          </div>
        </>
      )}
    </motion.div>
  );
};

