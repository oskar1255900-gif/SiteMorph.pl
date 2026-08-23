import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Plus,
  X,
  Receipt,
} from 'lucide-react';
import { Button } from '../components/ui';
import { containerVariants, itemVariants, springTransition } from '../lib/shared';
import { Invoice } from '../types';

export const FinanceSection = () => {
  const [isProfileSet, setIsProfileSet] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [userName, setUserName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const handleCompleteSetup = () => {
    if (!businessName.trim() || !businessEmail.trim()) {
      alert('Proszę wypełnić wymagane pola (Nazwa firmy, Email).');
      return;
    }
    setIsProfileSet(true);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail || !newAmount) return;

    const newInv: Invoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      clientName: newClientName,
      clientEmail: newClientEmail,
      amount: parseFloat(newAmount),
      status: 'Oczekująca',
      date: new Date().toLocaleDateString('pl-PL')
    };

    setInvoices([newInv, ...invoices]);
    setShowCreateModal(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewAmount('');
  };

  const totalRevenue = invoices
    .filter((i) => i.status === 'Opłacona')
    .reduce((sum, curr) => sum + curr.amount, 0);

  const outstanding = invoices
    .filter((i) => i.status === 'Oczekująca')
    .reduce((sum, curr) => sum + curr.amount, 0);

  const inputClasses = "w-full rounded-xl px-3.5 py-2 text-xs font-bold outline-none border text-blue-600 dark:text-white placeholder:text-blue-400 dark:placeholder:text-neutral-500 bg-blue-50/40 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800";

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto py-8 px-6 space-y-6 pb-24 text-blue-600 dark:text-white"
    >
      <div className="flex items-center justify-between border-b border-blue-100 dark:border-neutral-900 pb-3">
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
                <span className={`flex items-center gap-2 ${setupStep >= step.n ? 'text-emerald-400 font-black' : 'opacity-70'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                    setupStep >= step.n ? 'bg-blue-600 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-blue-100 dark:bg-neutral-900 text-blue-600 dark:text-white'
                  }`}>{step.n}</span>
                  {step.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <motion.div 
            layout
            className="p-6 rounded-3xl border text-left space-y-4 shadow-xl bg-white dark:bg-black border-blue-100 dark:border-neutral-900"
          >
            {setupStep === 1 && (
              <div className="space-y-3">
                <h4 className="font-black text-sm">Krok 1: Wprowadź dane firmy</h4>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Nazwa firmy / Studia *</label>
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="np. Studio Projektowe" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Imię i nazwisko właściciela *</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="np. Jan Kowalski" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Email firmowy do faktur *</label>
                  <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="jan@studio.pl" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Telefon (opcjonalnie)</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+48 500 000 000" className={inputClasses} />
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-4">
                <h4 className="font-black text-sm">Krok 2: Domyślne metody rozliczeń</h4>
                <p className="text-xs font-bold opacity-80">Zaznacz metody płatności dla klientów.</p>
                {['Przelew bankowy', 'BLIK / Przelew na telefon', 'Stripe / Karty płatnicze'].map((method, i) => (
                  <label key={i} className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer border-blue-100 dark:border-neutral-800 bg-blue-50/40 dark:bg-neutral-950">
                    <span className="text-xs font-black">{method}</span>
                    <input type="checkbox" defaultChecked={i < 2} className="w-4 h-4 accent-blue-600 dark:accent-white" />
                  </label>
                ))}
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-3 text-xs">
                <h4 className="font-black text-sm">Krok 3: Podsumowanie danych</h4>
                {[
                  ['Nazwa firmy', businessName || '—'],
                  ['Właściciel', userName || '—'],
                  ['Email', businessEmail || '—'],
                  ['Metody rozliczeń', 'Przelew bankowy, BLIK']
                ].map(([label, value], i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-blue-100 dark:border-neutral-900 last:border-none">
                    <span className="font-bold opacity-75">{label}:</span>
                    <span className="font-black">{value}</span>
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
                    setSetupStep(setupStep + 1);
                  }}
                >
                  Dalej →
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleCompleteSetup} className="font-black shadow-md">
                  Załóż firmę i przejdź do finansów ✓
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-6 pt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'Łączny przychód', value: `${totalRevenue} zł`, color: 'text-emerald-400' },
              { title: 'Oczekujące wpłaty', value: `${outstanding} zł`, color: 'text-amber-500' },
              { title: 'Wystawione faktury', value: invoices.length, color: 'text-blue-600 dark:text-white' },
              { title: 'Opłacone faktury', value: invoices.filter((i) => i.status === 'Opłacona').length, color: 'text-blue-600 dark:text-white' }
            ].map((stat, i) => (
              <motion.div 
                whileHover={{ y: -3 }}
                key={i} 
                className="p-4 rounded-2xl border shadow-lg bg-white dark:bg-black border-blue-100 dark:border-neutral-900"
              >
                <span className="text-[10px] font-black uppercase tracking-wider block mb-1 opacity-70">{stat.title}</span>
                <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
              </motion.div>
            ))}
          </div>

          <div className="p-6 rounded-3xl border shadow-xl space-y-4 bg-white dark:bg-black border-blue-100 dark:border-neutral-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black">Rejestr faktur</span>
              <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} className="gap-1 text-xs font-black">
                <Plus size={14} /> Stwórz nową fakturę
              </Button>
            </div>

            {invoices.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border shadow-sm bg-blue-50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800">
                  <Receipt size={24} />
                </div>
                <h4 className="text-xs font-black">Brak wystawionych faktur</h4>
                <p className="text-xs font-bold opacity-80">Kliknij przycisk powyżej, aby wystawić pierwszą fakturę dla klienta.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-blue-100 dark:border-neutral-900 font-black">
                      <th className="py-2.5">Klient</th>
                      <th className="py-2.5">Email</th>
                      <th className="py-2.5">Kwota</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 dark:divide-neutral-900 font-bold">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-blue-50/50 dark:hover:bg-neutral-900/40">
                        <td className="py-3 font-black">{inv.clientName}</td>
                        <td className="py-3 font-mono">{inv.clientEmail}</td>
                        <td className="py-3 font-black text-emerald-400">{inv.amount} zł</td>
                        <td className="py-3">
                          <span
                            onClick={() => {
                              setInvoices(invoices.map((i) =>
                                i.id === inv.id
                                  ? { ...i, status: i.status === 'Opłacona' ? 'Oczekująca' : 'Opłacona' }
                                  : i
                              ));
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black cursor-pointer select-none shadow-sm ${
                              inv.status === 'Opłacona'
                                ? 'bg-lime-50 text-lime-700 dark:bg-neutral-900 dark:text-lime-300 border border-lime-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-neutral-900 dark:text-amber-300 border border-amber-400'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono">{inv.date}</td>
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
              className="w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-4 relative text-left bg-white dark:bg-black border-blue-200 dark:border-neutral-800 text-blue-600 dark:text-white"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Kwota (PLN) *</label>
                    <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="4500" required className={inputClasses} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-blue-100 dark:border-neutral-900">
                  <span className="font-black text-sm">Suma: {newAmount || '0'} zł</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                      Anuluj
                    </Button>
                    <Button variant="primary" size="sm" type="submit" className="gap-1 text-xs font-black shadow-md">
                      <Send size={12} /> Wyślij fakturę
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

// ============================================================================
// 13. WIDOK: AKADEMIA
// ============================================================================
