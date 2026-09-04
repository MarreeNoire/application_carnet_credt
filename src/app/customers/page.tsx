'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { CustomerCard } from '@/components/CustomerCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Fetch merchant ID from authenticated user
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
          .select('id')
          .eq('id', user.id)
          .single();
        if (merchantError) throw merchantError;
        setMerchantId(merchantData.id);
      } catch (err: any) {
        setError(err.message ?? 'Erreur lors de la récupération du marchand');
      }
    }
    loadMerchant();
  }, []);

  // Function to load customers
  const loadCustomers = async () => {
    if (!merchantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers(data);
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers for the merchant when merchantId changes
  useEffect(() => {
    loadCustomers();
  }, [merchantId]);

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (customer.phone_number && customer.phone_number.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) {
      setCustomerError('Le nom du client est requis');
      return;
    }
    setAddingCustomer(true);
    setCustomerError(null);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          merchant_id: merchantId,
          full_name: newCustomerName.trim(),
          phone_number: newCustomerPhone.trim() || null,
          credit_limit: 50000, // default
          balance: 0,
        });
      if (error) throw error;
      // Clear form and close dialog
      setNewCustomerName('');
      setNewCustomerPhone('');
      setDialogOpen(false);
      // Refetch to include the new customer
      await loadCustomers();
    } catch (err: any) {
      setCustomerError(err.message ?? 'Erreur lors de l\'ajout du client');
    } finally {
      setAddingCustomer(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <span className="text-sm">Chargement des clients...</span>
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
          <h1 className="text-2xl font-bold text-gray-900">Mes Clients</h1>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Search bar */}
          <div className="mb-6">
            <label htmlFor="customer-search" className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher un client
            </label>
            <Input
              id="customer-search"
              type="text"
              placeholder="Nom ou numéro de téléphone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Customers grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.length === 0 ? (
              <p className="col-span-full text-center text-gray-500">
                Aucun client trouvé. Ajoutez votre premier client !
              </p>
            ) : (
              filteredCustomers.map(customer => (
                <CustomerCard
                  key={customer.id}
                  id={customer.id}
                  full_name={customer.full_name}
                  phone_number={customer.phone_number}
                  balance={customer.balance}
                  credit_limit={customer.credit_limit}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger>
          <Button variant="outline" className="mt-6">
            + Nouveau client
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un nouveau client</DialogTitle>
            <DialogDescription>
              Entrez les informations du client à ajouter à votre carnet de crédit.
            </DialogDescription>
          </DialogHeader>
          <DialogContent>
            <form onSubmit={(e) => { e.preventDefault(); handleAddCustomer(); }} className="space-y-4">
              <div>
                <label htmlFor="new-customer-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom complet
                </label>
                <Input
                  id="new-customer-name"
                  type="text"
                  placeholder="Ex: Kouakou Assan"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="new-customer-phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de téléphone (optionnel)
                </label>
                <Input
                  id="new-customer-phone"
                  type="tel"
                  placeholder="+225 XX XX XX XX"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500">
                Le crédit initial est fixé à 50 000 FCFA par défaut.
              </p>
              {customerError && (
                <p className="text-sm text-red-600">{customerError}</p>
              )}
            </form>
          </DialogContent>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={addingCustomer}
              onClick={(e) => { e.preventDefault(); handleAddCustomer(); }}
            >
              {addingCustomer ? 'Ajout...' : 'Ajouter le client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}