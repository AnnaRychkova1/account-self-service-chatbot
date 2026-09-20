alter table public.account_holders
add column if not exists user_id uuid;

alter table public.account_holders
add constraint account_holders_user_id_fkey
foreign key (user_id)
references auth.users(id)
on delete restrict;

create unique index if not exists account_holders_user_id_unique
on public.account_holders(user_id);