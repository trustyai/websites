-- =====================================================================
-- Niumabox · 付款水单  06-payment-proofs.sql   (Supabase SQL Editor 跑)
-- ---------------------------------------------------------------------
-- 目标:业务员在客户卡上传付款水单(图片/PDF)→ 入库 → 邮件通知团队财务。
-- 依赖:已跑过 05-finance-role.sql(fn_finance_of / team_read_* 策略)。
-- 文件本体存阿里云 OSS(bucket niumabox / oss-cn-shenzhen);本表只存元数据与 URL。
-- 重复跑安全。
-- =====================================================================

-- 0) 表
create table if not exists public.payment_proofs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade, -- 上传人
  owner_id    uuid not null references auth.users(id) on delete cascade, -- 客户归属业务员(团队可见性锚点)
  customer_id uuid references public.customers(id) on delete set null,
  document_id uuid,                          -- 可选关联单据(不强制 FK,避免历史单据删了卡死)
  amount      numeric(14, 2),
  currency    text default 'USD',
  note        text,
  file_name   text not null,
  file_url    text not null,
  file_key    text not null,                 -- OSS object key
  file_mime   text,
  file_size   int,
  created_at  timestamptz not null default now()
);

create index if not exists payment_proofs_owner_idx    on public.payment_proofs (owner_id, created_at desc);
create index if not exists payment_proofs_customer_idx on public.payment_proofs (customer_id, created_at desc);
create index if not exists payment_proofs_user_idx     on public.payment_proofs (user_id, created_at desc);

-- 1) RLS
alter table public.payment_proofs enable row level security;

drop policy if exists payment_proofs_select on public.payment_proofs;
create policy payment_proofs_select on public.payment_proofs
  for select using (
    user_id  = auth.uid()
    or owner_id = auth.uid()
    or public.fn_owner_of(owner_id)
    or public.fn_finance_of(owner_id)
  );

drop policy if exists payment_proofs_insert on public.payment_proofs;
create policy payment_proofs_insert on public.payment_proofs
  for insert with check (
    user_id = auth.uid()
    and (
      owner_id = auth.uid()
      or public.fn_owner_of(owner_id)
      or public.fn_finance_of(owner_id)
    )
  );

drop policy if exists payment_proofs_delete on public.payment_proofs;
create policy payment_proofs_delete on public.payment_proofs
  for delete using (
    user_id = auth.uid()
    or owner_id = auth.uid()
    or public.fn_owner_of(owner_id)
  );

-- 不允许改元数据(防篡改金额/链接);要改就删了重传
drop policy if exists payment_proofs_update on public.payment_proofs;
create policy payment_proofs_update on public.payment_proofs
  for update using (false);

-- 2) 新水单 → 邮件通知团队财务(pg_net;与询盘通知同构)
--    ⚠️ 把下面 YOUR_FINANCE_WEBHOOK_SECRET 换成 .env 里 FINANCE_WEBHOOK_SECRET 同一串
create or replace function public.notify_new_payment_proof()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform net.http_post(
    url := 'https://api.niumabox.com/api/finance/notify-proof',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'YOUR_FINANCE_WEBHOOK_SECRET'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'payment_proofs',
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
exception when others then
  -- 通知失败不阻断上传入库
  raise warning 'notify_new_payment_proof failed: %', SQLERRM;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_payment_proof on public.payment_proofs;
create trigger trg_notify_payment_proof
  after insert on public.payment_proofs
  for each row execute function public.notify_new_payment_proof();

-- 验证(可选):
-- select * from public.payment_proofs limit 1;
