# Plan d'exécution — Application "Carnet de Crédit Numérique"
*(version corrigée)*

## Phase 0 : Prérequis et vérification de l'environnement
- Vérifier l'installation de Node.js (≥18) et npm/yarn/pnpm
- Confirmer la disponibilité d'un compte Supabase (URL et clé anon/service_role nécessaires en `.env.local`)
- **Configurer un provider SMS sur Supabase Auth** (Twilio, Vonage ou MessageBird) — l'authentification par OTP téléphone ne fonctionnera pas sans ça, et ce n'est pas gratuit. À faire *avant* la Phase 4, pas après.
- Initialiser le dépôt Git dans le répertoire de travail vide (greenfield mode)

## Phase 1 : Initialisation du projet Next.js
Créer le projet Next.js 14+ avec App Router et TypeScript :
```
npx create-next-app@latest appli_carnet_credit --ts --app --eslint --tailwind --src-dir --import-alias="@/*"
```

Installer les dépendances spécifiques :
```
npm i @supabase/supabase-js dexie lucide-react clsx tailwind-merge
npm i -D @types/node
```

Installer le support PWA (nécessaire pour que l'app shell se charge hors-ligne, pas seulement les données) :
```
npm i next-pwa
```

Initialiser shadcn/ui — **attention, le package a été renommé, ne pas utiliser `shadcn-ui`** :
```
npx shadcn@latest init
# Choix proposés :
# - Style : Default
# - Base color : Slate
# - Utiliser Tailwind CSS ? Oui
# - Modifier le fichier de configuration tailwind ? Oui
```

Configurer les variables d'environnement (`.env.local`) :
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # opérations admin côté serveur uniquement, jamais exposé au client
```

## Phase 2 : Migrations Supabase, schéma et sécurité (RLS)
Créer le répertoire `supabase/migrations/` et écrire la migration initiale (`20260904000001_initial_schema.sql`) contenant :
- Table `merchants`
- Table `customers` avec clé étrangère vers `merchants`
- Table `transactions` avec types ENUM et champ `sync_id`
- Fonction `check_credit_limit()` pour prévenir les crédits dépassant le plafond
- Trigger `update_customer_balance` après insertion sur `transactions`
- Trigger `prevent_customer_deletion_with_balance` avant suppression sur `customers`
- Trigger `prevent_old_transaction_modification` avant modification/suppression sur `transactions`

**Politiques RLS — à écrire dans cette même migration, pas en note à part :**
```sql
alter table merchants enable row level security;
alter table customers enable row level security;
alter table transactions enable row level security;

create policy "merchant_sees_own_profile" on merchants
  for all using (id = auth.uid());

create policy "merchant_sees_own_customers" on customers
  for all using (merchant_id = auth.uid());

create policy "merchant_sees_own_transactions" on transactions
  for all using (merchant_id = auth.uid());
```

Appliquer les migrations :
```
supabase db push  # nécessite supabase CLI et lien au projet
```

## Phase 3 : Architecture de l'application Next.js
Structure du répertoire `src/app` :
```
src/app/
├── layout.tsx
├── manifest.json
├── login/
│   └── page.tsx
├── dashboard/
│   └── page.tsx
├── customers/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
└── actions/
```

Configurer `next.config.js` pour le service worker PWA (avec `next-pwa`), afin que l'app shell (JS/CSS) soit mise en cache et disponible même sans réseau au démarrage — le manifest seul ne suffit pas.

Manifest PWA (`src/app/manifest.json`) :
```json
{
  "name": "Carnet de Crédit Numérique",
  "short_name": "Carnet Crédit",
  "description": "Application de gestion de crédit pour petits commerçants en Côte d'Ivoire",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0d9488",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Balises PWA dans `src/app/layout.tsx` :
```tsx
export const metadata = {
  title: 'Carnet de Crédit Numérique',
  description: 'Gestion hors-ligne de crédit client pour commerçants ivoiriens',
};
```
```html
<html lang="fr">
  <head>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0d9488" />
  </head>
  <body>{/* ... */}</body>
</html>
```

## Phase 4 : Authentification et création du profil marchand
Utilitaire Supabase client (`src/lib/supabase.ts`) :
```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Page de connexion (`src/app/login/page.tsx`) :
- Formulaire avec saisie du numéro de téléphone (format `+225XXXXXXXXX`)
- Envoi du code OTP via Supabase Auth (`signInWithOtp`)
- Vérification du code OTP
- Lors de la première connexion : création automatique du profil marchand dans `merchants` si absent

**Middleware d'authentification — obligatoire, pas optionnel.** Pour une application qui gère des soldes de crédit, s'appuyer uniquement sur `useSession` côté composant expose l'utilisateur à un flash de contenu protégé avant redirection. Créer `middleware.ts` à la racine pour protéger `/dashboard`, `/customers/*` dès cette phase.

## Phase 5 : Gestion du stockage hors-ligne avec Dexie.js
Base de données Dexie (`src/lib/dexie.ts`) — **noter la correction de la clé primaire** : comme les id sont générés côté client via `crypto.randomUUID()`, ne pas utiliser `++id` (auto-incrément), utiliser `id` simple :
```ts
import Dexie from 'dexie'

export class OfflineDB extends Dexie {
  merchants: Dexie.Table<Merchant, string>
  customers: Dexie.Table<Customer, string>
  transactions: Dexie.Table<Transaction, string>

  constructor() {
    super('OfflineDB')
    this.version(1).stores({
      merchants: 'id, phone_number, shop_name',
      customers: 'id, merchant_id, full_name, phone_number',
      transactions: 'id, merchant_id, customer_id, type, amount, sync_id'
    })
  }
}

export const offlineDB = new OfflineDB()
```

**Point d'architecture important :** toute la logique online/offline et tous les appels à Dexie doivent rester **côté client** (`'use client'`). Dexie repose sur IndexedDB, une API du navigateur qui n'existe pas côté serveur — elle ne doit jamais être appelée depuis une Server Action.

Service de synchronisation (`src/lib/syncService.ts`), exécuté côté client :
```ts
'use client'
import { offlineDB } from './dexie'
import { createTransactionOnServer } from '@/app/actions/transactionActions'

export async function pushLocalTransactions() {
  const pending = await offlineDB.transactions.toArray()
  for (const tx of pending) {
    try {
      await createTransactionOnServer(tx.merchant_id, tx)
      await offlineDB.transactions.delete(tx.id)
    } catch (e) {
      console.error('Échec de synchronisation pour', tx.id, e)
    }
  }
}
```

Écouteurs d'événements réseau dans le layout ou un composant racine :
```tsx
'use client'
useEffect(() => {
  const handleOnline = () => pushLocalTransactions()
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [])
```

## Phase 6 : Server Actions pour les opérations métier
Dossier `src/app/actions/` :
- `merchantActions.ts` : création du profil marchand
- `customerActions.ts` : CRUD clients (lecture, création)
- `transactionActions.ts`

**Correction d'architecture critique :** une Server Action (`'use server'`) s'exécute côté serveur (Node.js). Elle **ne peut pas** appeler `navigator.onLine` ni `offlineDB` (Dexie/IndexedDB) — ces API n'existent que dans le navigateur. La Server Action doit se limiter à l'appel Supabase pur. C'est le service côté client (Phase 5) qui décide s'il appelle la Server Action ou stocke localement.

```ts
// src/app/actions/transactionActions.ts — CÔTÉ SERVEUR UNIQUEMENT
'use server'
import { supabase } from '@/lib/supabase'

export async function createTransactionOnServer(
  merchantId: string,
  transaction: Omit<Transaction, 'id' | 'created_at' | 'sync_id'>
) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...transaction, merchant_id: merchantId })
    .select()
  if (error) throw error
  return data[0]
}
```

```ts
// src/lib/transactionClient.ts — CÔTÉ CLIENT, décide online/offline
'use client'
import { offlineDB } from '@/lib/dexie'
import { createTransactionOnServer } from '@/app/actions/transactionActions'

export async function createTransaction(
  merchantId: string,
  transaction: Omit<Transaction, 'id' | 'created_at' | 'sync_id'>
) {
  if (navigator.onLine) {
    return createTransactionOnServer(merchantId, transaction)
  } else {
    const localTx = {
      ...transaction,
      merchant_id: merchantId,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    }
    await offlineDB.transactions.add(localTx)
    return localTx // Retour optimiste pour l'UI
  }
}
```

- `getCustomers` : lecture depuis Supabase (en ligne) ou Dexie (en secours) — même principe, la bascule online/offline se fait côté client, pas dans la Server Action.
- `getTransactions` : idem.

## Phase 7 : Développement de l'interface utilisateur
Composants réutilisables shadcn/ui : `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `badge.tsx`.

**Écran de connexion** (`src/app/login/page.tsx`) : inputs/boutons shadcn/ui, gestion des états de chargement et d'erreur.

**Tableau de bord** (`src/app/dashboard/page.tsx`) :
- En-tête avec nom du magasin (profil marchand) et indicateur de connexion (`navigator.onLine`)
- Carte KPI "Crédits Dehors" : somme des soldes clients négatifs (rouge/orange)
- Carte KPI "Cash du jour" : total des transactions `VENTE_CASH` et `ACOMPTE` du jour (vert)
- FAB (Floating Action Button) centré en bas : ouvre un modal pour nouvelle transaction

**Liste des clients** (`src/app/customers/page.tsx`) :
- Barre de recherche en temps réel (filtre sur `full_name` et `phone_number`)
- Grille réactive de cartes clients (nom, numéro, solde)
- Badge d'alerte si `balance >= credit_limit * 0.8`
- Bouton "+" pour ajouter un client

**Fiche client détaillée** (`src/app/customers/[id]/page.tsx`) :
- En-tête avec nom du client et statut du plafond (vert/rouge)
- Timeline chronologique des transactions
- Bouton "Relancer sur WhatsApp" :
  ```
  https://wa.me/${customer.phone_number}?text=${encodeURIComponent(message)}
  ```
  Message : `Bonjour ${customer.full_name}, sauf erreur de ma part, ton solde chez ${merchant.shop_name} est de ${customer.balance} FCFA. Merci de passer régler dès que possible !`

## Phase 8 : Finalisation et tests
- Métriques KPI du tableau de bord via Server Actions (agrégation), gestion des états de chargement/erreur
- **Test hors-ligne** : désactiver le réseau, créer des transactions → vérifier stockage dans Dexie ; réactiver le réseau → vérifier la synchronisation automatique
- **Test PWA offline réel** : couper le réseau puis recharger complètement l'app (pas juste naviguer) pour vérifier que le service worker sert bien l'app shell
- Vérifier la prévention des doublons via `sync_id`
- Vérifier les règles métier en base : suppression d'un client avec solde > 0 doit échouer ; modification d'une transaction de +24h doit échouer ; le solde client se met à jour après ajout d'une transaction
- **Vérifier les politiques RLS** : un marchand A ne doit pas pouvoir lire/modifier les clients ou transactions d'un marchand B
- Optimiser pour mobile : `type="tel"` pour les numéros, zones tactiles ≥48px, police lisible sans zoom
- Déploiement : compte Vercel, lien du dépôt Git, variables d'environnement dans Vercel Dashboard, `vercel` (CLI)

## Notes importantes
- **Monnaie** : toutes les valeurs en FCFA entières (pas de décimales) → `INTEGER` en base, affichage sans virgule.
- **Gestion des erreurs** : messages utilisateur clairs en français.
- **Accessibilité** : attributs ARIA appropriés, contraste suffisant.
- **Performance** : pagination côté serveur si les listes deviennent longues.
- **Sécurité** : RLS activée dès la Phase 2 (voir ci-dessus), middleware d'auth obligatoire dès la Phase 4.
- **Séparation client/serveur** : règle à respecter dans tout le projet — `navigator`, `window`, IndexedDB/Dexie ne s'utilisent que dans du code `'use client'`, jamais dans une Server Action.
