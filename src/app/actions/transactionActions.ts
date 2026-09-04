'use server';

import { supabase } from '@/lib/supabase';
import { Transaction } from '@/lib/dexie';

/**
 * Create a new transaction in Supabase (online only).
 * This server action assumes the client is online.
 * For offline support, the client should save locally and sync later.
 */
export async function createTransaction(
  merchantId: string,
  transaction: Omit<Transaction, 'id' | 'created_at' | 'sync_id'> & {
    customer_id: string | null; // can be null for cash expenses or cash sales?
  }
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Non authentifié');
  }

  // Verify that the merchantId matches the authenticated user's merchant
  const { data: merchantData, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('id', merchantId)
    .single();

  if (merchantError || !merchantData) {
    throw new Error('Marchand non autorisé');
  }

  // Online: insert directly into Supabase
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      merchant_id: merchantId,
      customer_id: transaction.customer_id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      sync_id: crypto.randomUUID(), // generate a sync ID for offline tracking (though not needed online)
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}