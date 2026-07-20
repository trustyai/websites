-- =====================================================================
-- Niumabox · 团队财务角色  05-finance-role.sql   (Supabase SQL Editor 跑)
-- ---------------------------------------------------------------------
-- 目标:team_members.role='finance' 的成员,可【只读】查看其所在团队
--       全体业务员的单据(documents)与客户(customers),方便做账。
-- 不改 fn_owner_of(老板逻辑保持原样);新增并列的 fn_finance_of()。
-- 写权限不变:改单据仍只限本人(documents_all_own / customers_all_own)。
-- 重复跑安全。
-- =====================================================================

-- 0) 我(当前登录用户)是不是 uid 这个人所在团队的【财务】?
--    与 fn_owner_of 同构:存在一个团队,该团队里 uid 是成员,且我是该团队 role='finance' 的在册成员。
create or replace function public.fn_finance_of(target uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from team_members me
    join team_members tgt on tgt.team_id = me.team_id
    where me.member_id = auth.uid()
      and me.role = 'finance'
      and me.status = 'active'
      and tgt.member_id = target
  );
$$;

-- 1) documents:重建团队只读策略,把 finance 并入(保留原 owner / assigned_to 条件)
drop policy if exists team_read_documents on public.documents;
create policy team_read_documents on public.documents
  for select
  using (
    user_id = auth.uid()
    or public.fn_owner_of(user_id)
    or assigned_to = auth.uid()
    or public.fn_finance_of(user_id)
  );

-- 2) customers:重建团队只读策略,把 finance 并入(保留原 owner 条件)
drop policy if exists team_read_customers on public.customers;
create policy team_read_customers on public.customers
  for select
  using (
    user_id = auth.uid()
    or public.fn_owner_of(user_id)
    or public.fn_finance_of(user_id)
  );

-- 3) 老板设/取消某成员为财务的安全函数(前端调用;只有团队 owner 能改本队成员)
create or replace function public.team_set_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare v_team uuid;
begin
  if p_role not in ('member','finance') then
    raise exception 'INVALID_ROLE';
  end if;
  -- 找到该成员所在团队,并校验调用者是该团队 owner
  select t.id into v_team
  from teams t
  join team_members m on m.team_id = t.id
  where m.member_id = p_member_id and t.owner_id = auth.uid()
  limit 1;
  if v_team is null then
    raise exception 'NOT_TEAM_OWNER';
  end if;
  update team_members
     set role = p_role
   where team_id = v_team and member_id = p_member_id;
end $$;

revoke all on function public.team_set_member_role(uuid, text) from public, anon;
grant execute on function public.team_set_member_role(uuid, text) to authenticated;

-- 验证(可选):
-- select public.fn_finance_of('某业务员uuid');
