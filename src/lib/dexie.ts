import Dexie, { Table } from 'dexie'

export interface Merchant {
  id: string
  phone_number: string
  shop_name: string
  created_at: string
}

export interface Customer {
  id: string
  merchant_id: string
  full_name: string
  phone_number: string | null
  credit_limit: number
  balance: number
  created_at: string
}

export interface Transaction {
  id: string
  merchant_id: string
  customer_id: string | null
  type: 'CREDIT' | 'ACOMPTE' | 'DEPENSE' | 'VENTE_CASH'
  amount: number
  description: string | null
  sync_id: string | null
  created_at: string
}

export class OfflineDB extends Dexie {
  merchants!: Table<Merchant, string>
  customers!: Table<Customer, string>
  transactions!: Table<Transaction, string>

  constructor() {
    super('OfflineDB')
    this.version(1).stores({
      merchants: '++id, phone_number, shop_name',
      customers: '++id, merchant_id, full_name, phone_number',
      transactions: '++id, merchant_id, customer_id, type, amount, sync_id'
    })
  }
}

export const offlineDB = new OfflineDB()