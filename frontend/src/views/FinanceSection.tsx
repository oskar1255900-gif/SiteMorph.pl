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
  const [newItemName, setNewItemName] = useState('Strona internetowa — projekt i wdrożenie');
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
    } catch { /* offline — zostajemy w trybie lokalnym */ }
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
    } catch { /* zapis lokalny wystarczy do demo */ }
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

  const inputClasses = "w-full rounded-xl px-3.5 py-2 text-xs font-bold outline-none border text-[#111111] dark:text-white placeholder:text-blue-400 dark:placeholder:text-neutral-500 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800";

  const enabledMethods = [
    usePrzelew && 'przelew',
    useBlik && 'blik',
    usePaypal && 'paypal',
  ].filter(Boolean) as string[];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto py-8 px-6 space-y-6 pb-24 text-[#111111] dark:text-white"
    >
      <div className="flex items-center justify-between border-b border-[#EAEAEA] dark:border-neutral-900 pb-3">
        <div>
          <h2 className="text-xl font-black">Finanse i Księgowość</h2>
          <p className="text-xs font-bold opacity-80">
            {isProfileSet ? `Firma: ${businessName}` : 'Rejestracja profilu płatniczego i firmy'}
          </p>
        </div>
        {isProfileSet && (
          <Button variant="outline" size="sm" onClick={() => setIsProfileSet(false)}>
            Edytuj dane firmy
          </Button>
        )}
      </div>

      {!isProfileSet ? (
        <motion.div variants={itemVariants} className="max-w-xl mx-auto space-y-6 pt-4 text-center">
          <div>
            <h3 className="text-2xl font-black">Załóż profil firmy</h3>
            <p className="text-xs font-bold mt-1 opacity-80">Wprowadź dane swojej działalności, aby wystawiać faktury.</p>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs font-bold py-2">
            {[
              { n: 1, label: 'Dane firmy' },
              { n: 2, label: 'Metody płatności' },
              { n: 3, label: 'Potwierdzenie' }
            ].map((step, idx) => (
              <React.Fragment key={step.n}>
                {idx > 0 && <span className="w-8 h-px bg-blue-200 dark:bg-neutral-800" />}
                <span className={`flex items-center gap-2 ${setupStep >= step.n ? 'text-emerald-500 font-black' : 'opacity-70'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                    setupStep >= step.n ? 'bg-lime-400 text-neutral-900 shadow-sm' : 'bg-blue-100 dark:bg-neutral-900 text-[#111111] dark:text-white'
                  }`}>{step.n}</span>
                  {step.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <motion.div
            layout
            className="p-6 rounded-3xl border text-left space-y-4 shadow-xl bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900"
          >
            {setupStep === 1 && (
              <div className="space-y-3">
                <h4 className="font-black text-sm">Krok 1: Wprowadź dane firmy</h4>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Nazwa firmy *</label>
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="np. Studio Projektowe" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Imię i nazwisko właściciela</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="np. Jan Kowalski" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Email firmowy do faktur *</label>
                  <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="jan@studio.pl" className={inputClasses} />
                  <p className="text-[10px] font-bold opacity-60 mt-1">Ten adres pojawi się na fakturach jako wystawca — odpowiedzi klientów trafią prosto do Ciebie.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Adres firmy</label>
                    <input type="text" value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} placeholder="ul. Prosta 1, 00-001 Warszawa" className={inputClasses} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">NIP (opcjonalnie)</label>
                    <input type="text" value={sellerNip} onChange={(e) => setSellerNip(e.target.value)} placeholder="0000000000" className={inputClasses} />
                  </div>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-4">
                <h4 className="font-black text-sm">Krok 2: Metody rozliczeń</h4>
                <p className="text-xs font-bold opacity-80">Zaznacz, jak klienci mogą Ci płacić, i uzupełnij dane dla zaznaczonych metod.</p>

                <label className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer border-[#EAEAEA] dark:border-neutral-800 bg-[#F7F6F3]/40 dark:bg-neutral-950">
                  <span className="text-xs font-black">Przelew bankowy (IBAN)</span>
                  <input type="checkbox" className="sm-check" checked={usePrzelew} onChange={(e) => setUsePrzelew(e.target.checked)} />
                </label>
                {usePrzelew && (
                  <div>
                    <input type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="PL00 0000 0000 0000 0000 0000 0000" className={inputClasses} />
                    <p className="text-[10px] font-bold opacity-60 mt-1">Numer IBAN jest bezpieczny — służy wyłącznie do odbierania przelewów i nie daje nikomu dostępu do Twojego konta.</p>
                  </div>
                )}

                <label className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer border-[#EAEAEA] dark:border-neutral-800 bg-[#F7F6F3]/40 dark:bg-neutral-950">
                  <span className="text-xs font-black">BLIK na telefon</span>
                  <input type="checkbox" className="sm-check" checked={useBlik} onChange={(e) => setUseBlik(e.target.checked)} />
                </label>
                {useBlik && (
                  <input type="tel" value={blikPhone} onChange={(e) => setBlikPhone(e.target.value)} placeholder="+48 500 000 000" className={inputClasses} />
                )}

                <label className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer border-[#EAEAEA] dark:border-neutral-800 bg-[#F7F6F3]/40 dark:bg-neutral-950">
                  <span className="text-xs font-black">PayPal</span>
                  <input type="checkbox" className="sm-check" checked={usePaypal} onChange={(e) => setUsePaypal(e.target.checked)} />
                </label>
                {usePaypal && (
                  <input type="url" value={paypalLink} onChange={(e) => setPaypalLink(e.target.value)} placeholder="https://paypal.me/twojafirma" className={inputClasses} />
                )}
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-3 text-xs">
                <h4 className="font-black text-sm">Krok 3: Podsumowanie danych</h4>
                {[
                  ['Nazwa firmy', businessName || '—'],
                  ['Właściciel', userName || '—'],
                  ['Email wystawcy', businessEmail || '—'],
                  ['IBAN', usePrzelew ? (iban || '—') : 'wyłączony'],
                  ['BLIK', useBlik ? (blikPhone || '—') : 'wyłączony'],
                  ['PayPal', usePaypal ? (paypalLink || '—') : 'wyłączony'],
                ].map(([label, value], i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-[#EAEAEA] dark:border-neutral-900 last:border-none">
                    <span className="font-bold opacity-75">{label}:</span>
                    <span className="font-black truncate max-w-[60%]">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 gap-2">
              {setupStep > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setSetupStep(setupStep - 1)}>
                  Wstecz
                </Button>
              )}
              {setupStep < 3 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (setupStep === 1 && (!businessName.trim() || !businessEmail.trim())) {
                      alert('Wypełnij wymagane pola (Nazwa firmy i Email)');
                      return;
                    }
                    if (setupStep === 2) {
                      if (usePrzelew && !iban.trim()) { alert('Podaj numer IBAN albo odznacz przelew'); return; }
                      if (useBlik && !blikPhone.trim()) { alert('Podaj numer telefonu do BLIK albo odznacz BLIK'); return; }
                      if (usePaypal && !paypalLink.trim()) { alert('Podaj link PayPal albo odznacz PayPal'); return; }
                      if (!usePrzelew && !useBlik && !usePaypal) { alert('Zaznacz przynajmniej jedną metodę płatności'); return; }
                    }
                    setSetupStep(setupStep + 1);
                  }}
                >
                  Dalej →
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleCompleteSetup} className="font-black shadow-md">
                  Zapisz profil firmy ✓
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-6 pt-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { title: 'Łączna wartość faktur', value: `${totalRevenue.toFixed(2)} zł`, color: 'text-emerald-500' },
              { title: 'Wystawione faktury', value: invoices.length, color: 'text-[#111111] dark:text-white' },
              { title: 'Wysłane e-mailem', value: invoices.filter((i) => i.sent_to).length, color: 'text-[#111111] dark:text-white' }
            ].map((stat, i) => (
              <motion.div
                whileHover={{ y: -3 }}
                key={i}
                className="p-4 rounded-2xl border shadow-lg bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900"
              >
                <span className="text-[10px] font-black uppercase tracking-wider block mb-1 opacity-70">{stat.title}</span>
                <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
              </motion.div>
            ))}
          </div>

          <div className="p-6 rounded-3xl border shadow-xl space-y-4 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black">Rejestr faktur</span>
              <Button variant="primary" size="sm" onClick={() => { setShowCreateModal(true); setNewMethod(enabledMethods[0] || 'przelew'); }} className="gap-1 text-xs font-black">
                <Plus size={14} /> Stwórz nową fakturę
              </Button>
            </div>

            {invoices.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border shadow-sm bg-[#F7F6F3] dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">
                  <Receipt size={24} />
                </div>
                <h4 className="text-xs font-black">Brak wystawionych faktur</h4>
                <p className="text-xs font-bold opacity-80">Kliknij przycisk powyżej, aby wystawić pierwszą fakturę dla klienta.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#EAEAEA] dark:border-neutral-900 font-black">
                      <th className="py-2.5">Numer</th>
                      <th className="py-2.5">Klient</th>
                      <th className="py-2.5">Kwota</th>
                      <th className="py-2.5">Płatność</th>
                      <th className="py-2.5">Wysyłka</th>
                      <th className="py-2.5 text-right">Podgląd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 dark:divide-neutral-900 font-bold">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#F7F6F3]/50 dark:hover:bg-neutral-900/40">
                        <td className="py-3 font-black font-mono">{inv.number}</td>
                        <td className="py-3">{inv.buyer}</td>
                        <td className="py-3 font-black text-emerald-500">{(inv.total || 0).toFixed(2)} zł</td>
                        <td className="py-3">{METHOD_LABEL[inv.payment_method] || inv.payment_method}</td>
                        <td className="py-3">
                          {inv.sent_to
                            ? <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-lime-50 text-lime-700 dark:bg-neutral-900 dark:text-lime-300 border border-lime-400">Wysłana</span>
                            : <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-neutral-900 dark:text-amber-300 border border-amber-400">Oczekująca</span>}
                        </td>
                        <td className="py-3 text-right">
                          <a
                            href="#"
                            onClick={async (e) => {
                              e.preventDefault();
                              const res = await apiFetch(`/api/invoices/${inv.id}/html`);
                              if (res.ok) {
                                const html = await res.text();
                                const w = window.open('', '_blank');
                                if (w) w.document.write(html);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-500 hover:underline"
                          >
                            Otwórz <ExternalLink size={10} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* MODAL TWORZENIA FAKTURY */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={springTransition}
              className="w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-4 relative text-left bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800 text-[#111111] dark:text-white max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <motion.button
                whileHover={{ scale: 1.15 }}
                onClick={() => setShowCreateModal(false)}
                className="absolute right-4 top-4 p-1 rounded-full cursor-pointer bg-transparent border-none text-inherit"
              >
                <X size={16} />
              </motion.button>

              <h3 className="font-black text-base">Nowa faktura</h3>

              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Nazwa klienta *</label>
                    <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Jan Kowalski" required className={inputClasses} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Email klienta *</label>
                    <input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="jan@firma.pl" required className={inputClasses} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Nazwa usługi</label>
                  <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className={inputClasses} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Kwota brutto (PLN) *</label>
                    <input type="number" min="1" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="4500" required className={inputClasses} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Metoda płatności</label>
                    <select value={newMethod} onChange={(e) => setNewMethod(e.target.value)} className={inputClasses + ' cursor-pointer'}>
                      {(enabledMethods.length ? enabledMethods : ['przelew']).map((m) => (
                        <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newMethod === 'przelew' && (
                  <p className="text-[10px] font-bold opacity-60">Na fakturze pojawi się Twój numer IBAN: <span className="font-black">{iban || '—'}</span>. Numer IBAN jest bezpieczny — służy wyłącznie do przelewu.</p>
                )}
                {newMethod === 'blik' && (
                  <p className="text-[10px] font-bold opacity-60">BLIK na telefon: <span className="font-black">{blikPhone || '—'}</span></p>
                )}
                {newMethod === 'paypal' && (
                  <p className="text-[10px] font-bold opacity-60">Link PayPal: <span className="font-black">{paypalLink || '—'}</span></p>
                )}

                {formErr && <p className="text-xs font-black text-rose-500">{formErr}</p>}
                {formMsg && <p className="text-xs font-black text-emerald-500">{formMsg}</p>}

                <div className="flex items-center justify-between pt-4 border-t border-[#EAEAEA] dark:border-neutral-900">
                  <span className="font-black text-sm">Suma: {newAmount || '0'} zł</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                      Anuluj
                    </Button>
                    <Button variant="primary" size="sm" type="submit" disabled={sending} className="gap-1 text-xs font-black shadow-md">
                      {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Wystaw i wyślij
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
