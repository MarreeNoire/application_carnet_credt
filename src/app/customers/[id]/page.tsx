'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [customer, setCustomer] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState<string>('');

  // Fetch merchant ID and name from authenticated user
  useEffect(() => {
    async function loadMerchant() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }
        const { data: merchantData, error: merchantError } = await supabase
          .from('merchants')
          .select('id, shop_name')
          .eq('id', user.id)
          .single();

        if (merchantError) throw merchantError;
        setMerchantId(merchantData.id);
        setMerchantName(merchantData.shop_name);
      } catch (err: any) {
        setError(err.message ?? 'Erreur lors de la récupération du marchand');
      }
    }
    loadMerchant();
  }, []);

  // Fetch customer and transactions
  useEffect(() => {
    if (!merchantId) return;
    async function loadCustomerData() {
      try {
        setLoading(true);
        // Fetch customer
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', params.id)
          .eq('merchant_id', merchantId)
          .single();

        if (customerError) throw customerError;
        setCustomer(customerData);

        // Fetch transactions for this customer
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('customer_id', params.id)
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false });

        if (transactionsError) throw transactionsError;
        setTransactions(transactionsData);
      } catch (err: any) {
        setError(err.message ?? 'Erreur lors du chargement des données du client');
      } finally {
        setLoading(false);
      }
    }
    loadCustomerData();
  }, [merchantId, params.id]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <span className="text-sm">Chargement des données...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <p className="text-red-600 text-center">{error}</p>
        <p className="mt-2 text-sm text-gray-500">
          <a href="/customers" className="underline">Retour à la liste</a>
        </p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <p className="text-red-600 text-center">Client non trouvé</p>
        <p className="mt-2 text-sm text-gray-500">
          <a href="/customers" className="underline">Retour à la liste</a>
        </p>
      </div>
    );
  }

  // Format transaction type for display
  const formatType = (type: string) => {
    switch (type) {
      case 'CREDIT': return 'Crédit';
      case 'ACOMPTE': return 'Acompte';
      case 'DEPENSE': return 'Dépense';
      case 'VENTE_CASH': return 'Vente cash';
      default: return type;
    }
  };

  // Get WhatsApp link
  const getWhatsAppLink = (): string | undefined => {
    if (!customer.phone_number) return undefined;
    const cleaned = customer.phone_number.replace(/\s/g, '').replace(/^\+225/, '');
    const message = encodeURIComponent(
      `Bonjour ${customer.full_name}, sauf erreur de ma part, ton solde chez ${merchantName} est de ${customer.balance} FCFA. Merci de passer régler dès que possible !`
    );
    return `https://wa.me/225${cleaned}?text=${message}`;
  };

  // Compute status class for the balance indicator
  const statusClass = `h-2.5 w-2.5 rounded-full ${customer.balance >= customer.credit_limit ? 'bg-red-500' : customer.balance >= customer.credit_limit * 0.8 ? 'bg-orange-500' : 'bg-green-500'}`;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {customer.full_name}
            </h1>
            <div className="flex items-center space-x-3 text-sm">
              <div className={statusClass} />
              <span className="ml-1">
                {customer.balance >= customer.credit_limit
                  ? 'Limite dépassée'
                  : customer.balance >= customer.credit_limit * 0.8
                  ? 'Proche de la limite'
                  : 'Solde OK'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Customer summary */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Solde actuel</h3>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {customer.balance.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Crédit autorisé</h3>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {customer.credit_limit.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            </div>
          </div>

          {/* Transaction timeline */}
          <div className="test">
            test
          </div>

          {/* WhatsApp button */}
          {customer.phone_number ? (
            <div className="mt-8">
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Relancer sur WhatsApp
              </a>
            </div>
          ) : (
            <p className="mt-8 text-center text-gray-500">
              Numéro de téléphone non disponible pour ce client.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}