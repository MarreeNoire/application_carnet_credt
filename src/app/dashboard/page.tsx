'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { createTransaction } from '@/app/actions/transactionActions';
import { saveTransactionLocally } from '@/lib/syncService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';


export default function DashboardPage() {
  const [merchant, setMerchant] = useState<{ id: string; shop_name: string } | null>(null);
  const [stats, setStats] = useState<{ creditDehors: number; cashDuJour: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [customers, setCustomers] = useState<Array<any>>([]);
  const [customersLoading, setCustomersLoading] = useState(true);

  // Transaction form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'CREDIT' | 'ACOMPTE' | 'DEPENSE' | 'VENTE_CASH'>('CREDIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    const updateOnlineStatus = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Fetch merchant and stats on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // No user, redirect to login
          window.location.href = '/login';
          return;
        }

        // Get merchant profile
        const { data: merchantData, error: merchantError } = await supabase
          .from('merchants')
          .select('id, shop_name')
          .eq('id', user.id)
          .single();

        if (merchantError) throw merchantError;
        setMerchant(merchantData);

        // Fetch stats via helper functions
        const creditDehors = await getCreditDehors(user.id);
        const cashDuJour = await getCashDuJour(user.id);
        setStats({ creditDehors, cashDuJour });

        // Fetch customers for the merchant
        setCustomersLoading(true);
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, full_name')
          .eq('merchant_id', user.id)
          .order('full_name');

        if (customersError) throw customersError;
        setCustomers(customersData);
      } catch (err: any) {
        setError(err.message ?? 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
        setCustomersLoading(false);
      }
    }

    loadData();
  }, []);

  // Helper to compute total credit dehors (sum of positive balances)
  async function getCreditDehors(merchantId: string): Promise<number> {
    const { data, error } = await supabase
      .from('customers')
      .select('balance')
      .eq('merchant_id', merchantId)
      .gt('balance', 0);

    if (error) throw error;
    const sum = data.reduce((acc, row) => acc + (row.balance ?? 0), 0);
    return sum;
  }

  // Helper to compute cash du jour (sum of VENTE_CASH and ACOMPTE today)
  async function getCashDuJour(merchantId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('merchant_id', merchantId)
      .in('type', ['VENTE_CASH', 'ACOMPTE'])
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    if (error) throw error;
    const sum = data.reduce((acc, row) => acc + (row.amount ?? 0), 0);
    return sum;
  }

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement> | React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    try {
      if (!merchant) throw new Error('Marchand non trouvé');

      const amountNum = parseInt(amount, 10);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Veuillez entrer un montant valide supérieur à zéro');
      }

      // Determine customer_id based on transaction type
      let customerId: string | null = null;
      if (transactionType === 'CREDIT' || transactionType === 'ACOMPTE') {
        if (!selectedCustomerId) {
          throw new Error('Veuillez sélectionner un client pour cette opération');
        }
        customerId = selectedCustomerId;
      }
      // For DEPENSE and VENTE_CASH, customerId remains null

      const baseTx = {
        merchant_id: merchant.id,
        customer_id: customerId,
        type: transactionType,
        amount: amountNum,
        description: description.trim() || null,
      };

      if (navigator.onLine) {
        // Online: call server action
        await createTransaction(merchant.id, baseTx);
      } else {
        // Offline: save locally with sync_id = null
        await saveTransactionLocally({ ...baseTx, sync_id: null });
      }

      // Reset form
      setAmount('');
      setDescription('');
      setSelectedCustomerId(null);
      setDialogOpen(false);
      setSubmitSuccess('Transaction enregistrée avec succès !');

      // Refresh stats (will reflect online changes immediately; offline changes will appear after sync)
      const newCreditDehors = await getCreditDehors(merchant.id);
      const newCashDuJour = await getCashDuJour(merchant.id);
      setStats({ creditDehors: newCreditDehors, cashDuJour: newCashDuJour });
    } catch (err: any) {
      setSubmitError(err.message ?? 'Erreur lors de l\'enregistrement de la transaction');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <span className="text-sm">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <p className="text-red-600 text-center">{error}</p>
        <p className="mt-2 text-sm text-gray-500">
          <a href="/login" className="underline">Réessayer</a>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {merchant?.shop_name}
            </h1>
            <div className="flex items-center space-x-3 text-sm">
              <div className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="ml-1">{online ? 'En ligne' : 'Hors-ligne'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* KPI Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Crédits Dehors */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Crédits Dehors</h3>
                  <p className="mt-1 text-2xl font-bold text-red-600">
                    {stats?.creditDehors?.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              </div>
            </div>

            {/* Cash du jour */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Cash du jour</h3>
                  <p className="mt-1 text-2xl font-bold text-green-600">
                    {stats?.cashDuJour?.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Action Button */}
          <div className="fixed bottom-0 inset-x-0 mb-6 flex justify-center pb-4">
            <DialogTrigger>
              <button
                className="relative h-12 w-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
                aria-label="Nouvelle transaction"
              >
                {/* Plus icon from lucide-react */}
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0l6-6-6-6M6 12h6" />
                </svg>
              </button>
            </DialogTrigger>
          </div>
        </div>
      </main>

      {/* Transaction Creation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle transaction</DialogTitle>
            <DialogDescription>
              Enregistrez rapidement un crédit, un acompte, une dépense ou une vente cash.
            </DialogDescription>
          </DialogHeader>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="transaction-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Type de transaction
                </label>
                <Select
                  onValueChange={(value) => { if (value !== null) setTransactionType(value); }}
                  value={transactionType}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT">Crédit</SelectItem>
                    <SelectItem value="ACOMPTE">Acompte</SelectItem>
                    <SelectItem value="DEPENSE">Dépense</SelectItem>
                    <SelectItem value="VENTE_CASH">Vente cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer selection (only for credit and acompte) */}
              {(transactionType === 'CREDIT' || transactionType === 'ACOMPTE') && (
                <>
                  <div>
                    <label htmlFor="customer-select" className="block text-sm font-medium text-gray-700 mb-2">
                      Client
                    </label>
                    <Select
                      onValueChange={(value) => { if (value !== null) setSelectedCustomerId(value); }}
                      value={selectedCustomerId}
                      disabled={customersLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {customersLoading ? (
                          <SelectItem disabled>Chargement des clients...</SelectItem>
                        ) : customers.length === 0 ? (
                          <SelectItem disabled>Aucun client disponible</SelectItem>
                        ) : (
                          customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.full_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (FCFA)
                </label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Entrez une description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              {submitSuccess && (
                <p className="text-sm text-green-600">{submitSuccess}</p>
              )}
            </form>
          </DialogContent>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}