alter table public.transactions
add column if not exists request_id text;

create unique index if not exists transactions_account_request_id_unique
on public.transactions (account_holder_id, request_id)
where request_id is not null;

create or replace function public.process_mock_payment(
  p_account_id text,
  p_amount_cents integer,
  p_request_id text
)
returns table (
  transaction_id uuid,
  new_balance_cents integer,
  duplicate boolean
)
language plpgsql
as $$
declare
  v_account_holder public.account_holders%rowtype;
  v_existing_transaction_id uuid;
  v_existing_amount_cents integer;
  v_transaction_id uuid;
  v_new_balance_cents integer;
  v_payment_date date;
begin
  if p_account_id is null or btrim(p_account_id) = '' then
    raise exception 'Account ID is required.';
  end if;

  if p_request_id is null or btrim(p_request_id) = '' then
    raise exception 'Payment request ID is required.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Please provide a valid payment amount.';
  end if;

  select *
  into v_account_holder
  from public.account_holders
  where account_id = btrim(p_account_id)
  for update;

  if not found then
    raise exception 'Account "%" was not found.', btrim(p_account_id);
  end if;

  select
    t.id,
    t.amount_cents
  into
    v_existing_transaction_id,
    v_existing_amount_cents
  from public.transactions t
  where t.account_holder_id = v_account_holder.id
    and t.request_id = btrim(p_request_id);

  if found then
    if v_existing_amount_cents <> p_amount_cents then
      raise exception 'Payment request ID has already been used with a different amount.';
    end if;

    return query
    select
      v_existing_transaction_id,
      v_account_holder.balance_cents,
      true;

    return;
  end if;

  if p_amount_cents > v_account_holder.balance_cents then
    raise exception 'Payment amount cannot exceed the current balance.';
  end if;

  v_payment_date := (now() at time zone 'Europe/Dublin')::date;
  v_new_balance_cents := v_account_holder.balance_cents - p_amount_cents;

  insert into public.transactions (
    account_holder_id,
    type,
    status,
    amount_cents,
    currency,
    description,
    transaction_date,
    request_id
  )
  values (
    v_account_holder.id,
    'payment',
    'completed',
    p_amount_cents,
    v_account_holder.currency,
    'Mocked payment using saved payment details',
    v_payment_date,
    btrim(p_request_id)
  )
  returning id
  into v_transaction_id;

  update public.account_holders
  set
    balance_cents = v_new_balance_cents,
    last_payment_date = v_payment_date,
    last_payment_amount_cents = p_amount_cents,
    updated_at = now()
  where id = v_account_holder.id;

  return query
  select
    v_transaction_id,
    v_new_balance_cents,
    false;
end;
$$;