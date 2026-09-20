import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Plus,
  X,
  Receipt,
  ExternalLink,
  Loader2,
  TrendingUp,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '../components/ui';
import { containerVariants, itemVariants, springTransition } from '../lib/shared';
import { apiFetch } from '../lib/api';

type InvRow = {
  id: number;
  number: string;
  buyer: string | null;
  total: number;
  payment_method: string;
  sent_to: string | null;
  created_at: number | null;
  status?: string;
};

const METHOD_LABEL: Record<string, string> = {
  przelew: 'Przelew bankowy',
  blik: 'BLIK',
  paypal: 'PayPal',
};

const MONTHS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

export const FinanceSection = () => {
  const [isProfileSet, setIsProfileSet] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [userName, setUserName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [sellerNip, setSellerNip] = useState('');

  const [usePrzelew, setUsePrzelew] = useState(true);
  const [useBlik, setUseBlik] = useState(true);
  const [usePaypal, setUsePaypal] = useState(false);
  const [iban, setIban] = useState('');
  const [blikPhone, setBlikPhone] = useState('');
  const [paypalLink, setPaypalLink] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoices, setInvoices] = useState<InvRow[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newItemName, setNewItemName] = useState('Strona internetowa - projekt i wdrożenie');
  const [newAmount, setNewAmount] = useState('');
  const [newMethod, setNewMethod] = useState('przelew');
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formErr, setFormErr] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (!res.ok) return;
      const { settings } = await res.json();
      if (settings?.seller_name || settings?.seller_email) {
        setBusinessName(settings.seller_name || '');
        setBusinessEmail(settings.seller_email || '');
        setSellerAddress(settings.seller_address || '');
        setSellerNip(settings.seller_nip || '');
        setIban(settings.iban || '');
        setBlikPhone(settings.blik_phone || '');
        setPaypalLink(settings.paypal_link || '');
        setUsePrzelew(Boolean(settings.iban));
        setUseBlik(Boolean(settings.blik_phone));
        setUsePaypal(Boolean(settings.paypal_link));
        setIsProfileSet(true);
      }
    } catch { /* offline */ }
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await apiFetch('/api/invoices');
      if (!res.ok) return;
      const data = await res.json();
      setInvoices((data.invoices || []).map((i: any) => ({ ...i, status: i.sent_to ? 'Wysłana' : 'Oczekująca' })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSettings(); loadInvoices(); }, [loadSettings, loadInvoices]);

  const handleCompleteSetup = async () => {
    if (!businessName.trim() || !businessEmail.trim()) {
      alert('Proszę wypełnić wymagane pola (Nazwa firmy, Email).');
      return;
    }
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            seller_name: businessName,
            seller_email: businessEmail,
            seller_address: sellerAddress,
            seller_nip: sellerNip,
            display_name: userName,
            iban,
            blik_phone: blikPhone,
            paypal_link: paypalLink,
          },
        }),
      });
    } catch { /* offline */ }
    setIsProfileSet(true);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail || !newAmount) return;
    setSending(true);
    setFormErr('');
    setFormMsg('');
    const gross = parseFloat(newAmount);
    const net = Math.round((gross / 1.23) * 100) / 100;
    try {
      const res = await apiFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          buyer: { name: newClientName, email: newClientEmail },
          items: [{ name: newItemName || 'Usługa', qty: 1, unit_price: net, vat: 23 }],
          payment_method: newMethod,
          paypal_link: paypalLink || undefined,
          blik_phone: blikPhone || undefined,
          iban: iban || undefined,
          send: true,
          send_to: newClientEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Błąd ${res.status}`);
      setFormMsg(
        `Faktura ${data.invoice.number} utworzona.` +
        (data.email_sent
          ? ` Wysłana e-mailem do ${data.sent_to || newClientEmail} (${data.email_note}).`
          : ` ${data.email_note || ''}`)
      );
      await loadInvoices();
      setTimeout(() => {
        setShowCreateModal(false);
        setNewClientName(''); setNewClientEmail(''); setNewAmount(''); setFormMsg('');
      }, 1600);
    } catch (err: any) {
      setFormErr(err.message || 'Nie udało się wystawić faktury');
    } finally {
      setSending(false);
    }
  };

  const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const paidCount = invoices.filter(i => i.sent_to).length;
  const pendingCount = invoices.filter(i => !i.sent_to).length;

  const inputClasses = "sm-input text-[15px]";

  const enabledMethods = [
    usePrzelew && 'przelew',
    useBlik && 'blik',
    usePaypal && 'paypal',
  ].filter(Boolean) as string[];

  // Monthly data for chart
  const monthlyData = React.useMemo(() => {
    const now = new Date();
    return MONTHS.map((m, i) => {
      const monthInvoices = invoices.filter(inv => {
        if (!inv.created_at) return false;
        const d = new Date(inv.created_at);
        return d.getMonth() === i && d.getFullYear() === now.getFullYear();
      });
      return { month: m, total: monthInvoices.reduce((s, inv) => s + (inv.total || 0), 0) };
    });
  }, [invoices]);
  const maxMonthly = Math.max(1, ...monthlyData.map(d => d.total));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1100px] mx-auto py-10 px-6 space-y-8 pb-24 text-[var(--sm-text)]"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="sm-h1">Płatności</h1>
          <p className="text-[14.5px] mt-1" style={{ color: 'var(--sm-text-secondary)' }}>
            {isProfileSet ? businessName : 'Rejestracja profilu płatniczego i firmy'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isProfileSet && (
            <Button variant="ghost" size="md" onClick={() => setIsProfileSet(false)}>
              Edytuj profil
            </Button>
          )}
          <Button variant="primary" size="md" onClick={() => { setShowCreateModal(true); setNewMethod(enabledMethods[0] || 'przelew'); }}>
            <Plus size={18} /> Nowa faktura
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Łącznie wystawionych', value: `${totalRevenue.toFixed(2)} zł`, icon: TrendingUp },
          { label: 'Opłacone', value: `${paidCount}`, icon: FileText },
          { label: 'Oczekujące', value: `${pendingCount}`, icon: LinkIcon },
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -2 }}
            className="rounded-[14px] p-6 relative overflow-hidden"
            style={{ background: 'var(--sm-surface)' }}
          >
            <span className="text-[13.5px] font-medium" style={{ color: 'var(--sm-text-secondary)' }}>
              {stat.label}
            </span>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-[29px] font-semibold leading-none tracking-tight">
                {stat.value}
              </span>
              <stat.icon size={20} style={{ color: 'var(--sm-text-quiet)' }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="rounded-[14px] p-6 sm:p-8" style={{ background: 'var(--sm-surface)' }}>
        <div className="mb-6">
          <h3 className="text-[18px] font-semibold">Płatności miesięcznie</h3>
          <p className="text-[13.5px] mt-1" style={{ color: 'var(--sm-text-secondary)' }}>Kwoty w zł</p>
        </div>
        <div className="relative">
          {/* Y axis */}
          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[13px] font-medium" style={{ color: 'var(--sm-text-quiet)', width: '30px' }}>
            <span>{Math.ceil(maxMonthly)}</span>
            <span>{Math.ceil(maxMonthly / 2)}</span>
            <span>0</span>
          </div>
          {/* Chart area */}
          <div className="ml-8">
            {/* Grid lines */}
            <div className="relative h-[180px] flex items-end gap-0">
              {/* Horizontal grid lines */}
              {[0, 0.5, 1].map((pct) => (
                <div key={pct} className="absolute left-0 right-0" style={{ bottom: `${pct * 100}%`, height: '1px', background: 'var(--sm-border-subtle)' }} />
              ))}
              {/* Bars */}
              {monthlyData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative z-10">
                  <div
                    className="w-full max-w-[40px] rounded-t-[4px] transition-all duration-300"
                    style={{
                      height: d.total > 0 ? `${Math.max(8, (d.total / maxMonthly) * 100)}%` : '2px',
                      background: d.total > 0 ? 'var(--sm-accent)' : 'var(--sm-surface-hover)',
                      minHeight: '2px',
                    }}
                  />
                </div>
              ))}
            </div>
            {/* X axis labels */}
            <div className="flex gap-0 mt-2" style={{ borderTop: '1px solid var(--sm-border-subtle)' }}>
              {MONTHS.map((m) => (
                <div key={m} className="flex-1 text-center py-2 text-[13px] font-medium" style={{ color: 'var(--sm-text-quiet)' }}>
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History section */}
      <div className="rounded-[14px] p-6 sm:p-8" style={{ background: 'var(--sm-surface)' }}>
        <div className="mb-6">
          <h3 className="text-[18px] font-semibold">Historia faktur</h3>
          <p className="text-[13.5px] mt-1" style={{ color: 'var(--sm-text-secondary)' }}>Kto, za co i na jaką kwotę</p>
        </div>

        {invoices.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto" style={{ background: 'var(--sm-surface-hover)' }}>
              <Receipt size={28} style={{ color: 'var(--sm-text-quiet)' }} />
            </div>
            <h4 className="text-[16.5px] font-semibold">Brak faktur</h4>
            <p className="text-[13.5px] max-w-md mx-auto" style={{ color: 'var(--sm-text-secondary)' }}>
              Wyślij klientowi pierwszą fakturę z własnym numerem IBAN lub BLIK.
            </p>
            <Button variant="primary" size="lg" onClick={() => { setShowCreateModal(true); setNewMethod(enabledMethods[0] || 'przelew'); }}>
              <Plus size={16} /> Nowa faktura
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="font-medium" style={{ color: 'var(--sm-text-quiet)', borderBottom: '1px solid var(--sm-border-subtle)' }}>
                  <th className="py-3">Numer</th>
                  <th className="py-3">Klient</th>
                  <th className="py-3">Kwota</th>
                  <th className="py-3">Płatność</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right">Podgląd</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--sm-border-subtle)' }}>
                    <td className="py-4 font-mono">{inv.number}</td>
                    <td className="py-4">{inv.buyer}</td>
                    <td className="py-4 font-semibold" style={{ color: 'var(--sm-success)' }}>{(inv.total || 0).toFixed(2)} zł</td>
                    <td className="py-4">{METHOD_LABEL[inv.payment_method] || inv.payment_method}</td>
                    <td className="py-4">
                      {inv.sent_to
                        ? <span className="rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--sm-success)' }}>Wysłana</span>
                        : <span className="rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: 'rgba(217,119,6,0.08)', color: 'var(--sm-warning)' }}>Oczekująca</span>}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={async () => {
                          const res = await apiFetch(`/api/invoices/${inv.id}/html`);
                          if (res.ok) {
                            const html = await res.text();
                            const w = window.open('', '_blank');
                            if (w) w.document.write(html);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-[13px] font-medium cursor-pointer border-none bg-transparent hover:underline"
                        style={{ color: 'var(--sm-accent)' }}
                      >
                        Otwórz <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL TWORZENIA FAKTURY */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={springTransition}
              className="w-full max-w-lg rounded-[16px] p-8 space-y-5 relative text-left max-h-[90vh] overflow-y-auto no-scrollbar"
              style={{ background: 'var(--sm-bg)', color: 'var(--sm-text)' }}
            >
              <motion.button
                whileHover={{ scale: 1.15 }}
                onClick={() => setShowCreateModal(false)}
                className="absolute right-5 top-5 p-2 rounded-full cursor-pointer bg-transparent border-none"
                style={{ color: 'var(--sm-text-quiet)' }}
              >
                <X size={18} />
              </motion.button>

              <h3 className="text-[19px] font-semibold">Nowa faktura</h3>

              <form onSubmit={handleCreateInvoice} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="sm-label">Nazwa klienta *</label>
                    <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Jan Kowalski" required className={inputClasses} />
                  </div>
                  <div>
                    <label className="sm-label">Email klienta *</label>
                    <input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="jan@firma.pl" required className={inputClasses} />
                  </div>
                </div>

                <div>
                  <label className="sm-label">Nazwa usługi</label>
                  <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className={inputClasses} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="sm-label">Kwota brutto (PLN) *</label>
                    <input type="number" min="1" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="4500" required className={inputClasses} />
                  </div>
                  <div>
                    <label className="sm-label">Metoda płatności</label>
                    <select value={newMethod} onChange={(e) => setNewMethod(e.target.value)} className={inputClasses + ' cursor-pointer'}>
                      {(enabledMethods.length ? enabledMethods : ['przelew']).map((m) => (
                        <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newMethod === 'przelew' && (
                  <p className="sm-hint">Na fakturze pojawi się Twój numer IBAN: <span className="font-semibold">{iban || '-'}</span>.</p>
                )}
                {newMethod === 'blik' && (
                  <p className="sm-hint">BLIK na telefon: <span className="font-semibold">{blikPhone || '-'}</span></p>
                )}
                {newMethod === 'paypal' && (
                  <p className="sm-hint">Link PayPal: <span className="font-semibold">{paypalLink || '-'}</span></p>
                )}

                {formErr && <p className="text-[14px] font-medium" style={{ color: 'var(--sm-danger)' }}>{formErr}</p>}
                {formMsg && <p className="text-[14px] font-medium" style={{ color: 'var(--sm-success)' }}>{formMsg}</p>}

                <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--sm-border-subtle)' }}>
                  <span className="font-semibold text-[16px]">Suma: {newAmount || '0'} zł</span>
                  <div className="flex gap-3">
                    <Button variant="ghost" size="md" type="button" onClick={() => setShowCreateModal(false)}>
                      Anuluj
                    </Button>
                    <Button variant="primary" size="md" type="submit" disabled={sending} className="gap-1.5">
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Wystaw i wyślij
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
