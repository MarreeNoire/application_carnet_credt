-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table merchants
create table merchants (
    id uuid primary key default gen_random_uuid(),
    phone_number varchar unique not null,
    shop_name varchar not null,
    created_at timestamp default now()
);

-- Table customers
create table customers (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references merchants(id) on delete cascade,
    full_name varchar not null,
    phone_number varchar,
    credit_limit integer default 50000,
    balance integer default 0,
    created_at timestamp default now()
);

-- Transaction type enum
create type transaction_type as enum ('CREDIT', 'ACOMPTE', 'DEPENSE', 'VENTE_CASH');

-- Table transactions
create table transactions (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references merchants(id) on delete cascade,
    customer_id uuid references customers(id) on delete set null,
    type transaction_type not null,
    amount integer not null check (amount > 0),
    description text,
    sync_id varchar unique,
    created_at timestamp default now()
);

-- Function to update customer balance after transaction insert
create or replace function update_customer_balance()
returns trigger as $$
begin
    if tg_op = 'INSERT' then
        if new.type = 'CREDIT' then
            update customers
            set balance = balance + new.amount
            where id = new.customer_id;
        elsif new.type = 'ACOMPTE' then
            update customers
            set balance = balance - new.amount
            where id = new.customer_id;
        end if;
        return new;
    end if;
    return null; -- should not reach here
end;
$$ language plpgsql;

-- Trigger to update balance after insert on transactions
create trigger update_customer_balance_after_insert
after insert on transactions
for each row execute function update_customer_balance();

-- Function to check credit limit before inserting a credit
create or replace function check_credit_limit()
returns trigger as $$
begin
    if new.type = 'CREDIT' then
        perform 1 from customers where id = new.customer_id;
        if not found then
            raise exception 'Customer not found';
        end if;
        -- Check if new credit would exceed limit
        if (select balance from customers where id = new.customer_id) + new.amount >
           (select credit_limit from customers where id = new.customer_id) then
            raise exception 'Credit would exceed customer limit';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

-- Trigger to check credit limit before insert on transactions
create trigger check_credit_limit_before_insert
before insert on transactions
for each row execute function check_credit_limit();

-- Trigger to prevent deletion of customer with balance > 0
create or replace function prevent_customer_deletion_with_balance()
returns trigger as $$
begin
    if old.balance > 0 then
        raise exception 'Cannot delete customer with non-zero balance';
    end if;
    return old;
end;
$$ language plpgsql;

create trigger prevent_customer_deletion_with_balance_trigger
before delete on customers
for each row execute function prevent_customer_deletion_with_balance();

-- Trigger to prevent modification/deletion of transactions older than 24 hours
create or replace function prevent_old_transaction_modification()
returns trigger as $$
begin
    if (select now() - interval '24 hours') > old.created_at then
        raise exception 'Cannot modify or delete transaction older than 24 hours';
    end if;
    return new; -- for update, return new; for delete, we still return old? Actually we return null? For before trigger, returning null skips the operation. We want to abort, so raise exception.
end;
$$ language plpgsql;

create trigger prevent_old_transaction_modification_trigger
before update or delete on transactions
for each row execute function prevent_old_transaction_modification();