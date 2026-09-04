import { offlineDB } from './dexie'
import { supabase } from './supabase'
import { Transaction } from './dexie'

/**
 * Save a transaction to local IndexedDB when offline
 */
export async function saveTransactionLocally(transaction: Omit<Transaction, 'id' | 'created_at'>) {
  const localTx = {
    ...transaction,
    id: crypto.randomUUID(), // temporary ID
    created_at: new Date().toISOString(),
    sync_id: null
  }
  await offlineDB.transactions.add(localTx)
  return localTx
}

/**
 * Push all unsynced local transactions to Supabase when online
 * Returns number of transactions pushed
 */
export async function pushLocalTransactions(): Promise<number> {
  // Get all transactions and filter those with sync_id === null
  const allTx = await offlineDB.transactions.toArray()
  const unsynced = allTx.filter(tx => tx.sync_id === null)

  if (unsynced.length === 0) return 0

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('User not authenticated')
  }

  const merchantId = (await supabase.from('merchants').select('id').eq('phone_number', session.user?.email ?? '').single()).data?.id
  if (!merchantId) {
    throw new Error('Merchant profile not found')
  }

  let pushed = 0
  for (const tx of unsynced) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          merchant_id: merchantId,
          customer_id: tx.customer_id,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          sync_id: tx.sync_id ?? crypto.randomUUID() // generate sync_id if not present
        })
        .select()
        .single()

      if (error) throw error
      // Mark as synced by updating sync_id (already set) and maybe update local ID? We'll just delete local entry and keep Supabase ID.
      await offlineDB.transactions.delete(tx.id)
      pushed++
    } catch (err) {
      console.error('Failed to push transaction', tx, err)
      // Optionally, you could implement retry logic
    }
  }

  return pushed
}

/**
 * Listen for online events and trigger sync
 */
export function setupOnlineListener() {
  if (typeof window !== 'undefined') {
    const handleOnline = async () => {
      try {
        const count = await pushLocalTransactions()
        if (count > 0) {
          console.log(`Synced ${count} transactions from local storage`)
          // Optionally dispatch an event or update state
        }
      } catch (error) {
        console.error('Error syncing local transactions', error)
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }
  return () => {}
}