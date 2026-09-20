alter table public.account_holders enable row level security;

alter table public.pending_chat_actions enable row level security;

alter table public.related_people enable row level security;

alter table public.call_appointments enable row level security;

alter table public.promises_to_pay enable row level security;

alter table public.transactions enable row level security;

alter table public.notification_attempts enable row level security;


create policy "Users can view their own account holder"
on public.account_holders
for select
to authenticated
using (
  user_id = auth.uid()
);


create policy "Users can update their own account holder"
on public.account_holders
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


create policy "Users can manage their own pending chat actions"
on public.pending_chat_actions
for all
to authenticated
using (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = pending_chat_actions.account_holder_id
      and account_holders.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = pending_chat_actions.account_holder_id
      and account_holders.user_id = auth.uid()
  )
);


create policy "Users can manage their own related people"
on public.related_people
for all
to authenticated
using (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = related_people.account_holder_id
      and account_holders.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = related_people.account_holder_id
      and account_holders.user_id = auth.uid()
  )
);


create policy "Users can manage their own call appointments"
on public.call_appointments
for all
to authenticated
using (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = call_appointments.account_holder_id
      and account_holders.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = call_appointments.account_holder_id
      and account_holders.user_id = auth.uid()
  )
);


create policy "Users can manage their own promises to pay"
on public.promises_to_pay
for all
to authenticated
using (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = promises_to_pay.account_holder_id
      and account_holders.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = promises_to_pay.account_holder_id
      and account_holders.user_id = auth.uid()
  )
);


create policy "Users can manage their own transactions"
on public.transactions
for all
to authenticated
using (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = transactions.account_holder_id
      and account_holders.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = transactions.account_holder_id
      and account_holders.user_id = auth.uid()
  )
);


create policy "Users can manage their own notification attempts"
on public.notification_attempts
for all
to authenticated
using (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = notification_attempts.account_holder_id
      and account_holders.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.account_holders
    where account_holders.id = notification_attempts.account_holder_id
      and account_holders.user_id = auth.uid()
  )
);


revoke execute
on function public.process_mock_payment(text, integer, text)
from public;


grant execute
on function public.process_mock_payment(text, integer, text)
to authenticated;


grant execute
on function public.process_mock_payment(text, integer, text)
to service_role;
