-- ============================================================
-- SOCLE — Module Devis — Schéma Supabase (Postgres)
-- Exécutable tel quel. RLS en commentaire, prêtes à activer.
-- ============================================================
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ─── ENTREPRISE (1 ligne par user) ───
create table if not exists public.entreprise (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  raison_sociale  text not null default '',
  forme_juridique text not null default '',          -- SASU, EURL, EI, micro…
  siren           text not null default '',
  siret           text not null default '',
  tva_intracom    text not null default '',
  capital         numeric(12,2),
  adresse         text not null default '',
  code_postal     text not null default '',
  ville           text not null default '',
  email           text not null default '',
  telephone       text not null default '',
  site_web        text not null default '',
  assurance_compagnie text not null default '',
  assurance_police    text not null default '',
  assurance_zone      text not null default '',
  validite_jours  integer not null default 30
                    check (validite_jours > 0 and validite_jours <= 365),
  acompte_pct     numeric(5,2) not null default 30
                    check (acompte_pct >= 0 and acompte_pct <= 100),
  marge_pct       numeric(5,2) not null default 30
                    check (marge_pct >= 0),            -- pas de plafond
  taux_horaire    numeric(10,2) not null default 0,
  iban            text not null default '',
  cgv             text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

-- ─── CLIENTS (carnet d'adresses) ───
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null default 'particulier'
                 check (type in ('particulier','professionnel')),
  nom          text not null default '',            -- nom ou raison sociale
  prenom       text not null default '',            -- perso. devis particuliers
  contact      text not null default '',            -- interlocuteur (si pro)
  email        text not null default '',
  telephone    text not null default '',
  adresse      text not null default '',
  code_postal  text not null default '',
  ville        text not null default '',
  siren        text not null default '',            -- si professionnel
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── DEVIS ───
create table if not exists public.devis (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  numero          text not null,                    -- DEV-2026-001
  client_id       uuid references public.clients(id) on delete set null,
  client_snapshot jsonb not null default '{}'::jsonb,  -- copie figée à l'émission
  titre           text not null default '',
  statut          text not null default 'brouillon'
                    check (statut in ('brouillon','envoye','signe','refuse','expire')),
  date_creation   date not null default current_date,
  date_validite   date,
  chantier_adresse     text not null default '',
  chantier_code_postal text not null default '',
  chantier_ville       text not null default '',
  lots            jsonb not null default '[]'::jsonb,   -- Lot[] (avec lignes[] ; chaque ligne : nature 'normal'|'option', prix mat + prix pose par unité, coûts internes par unité)
  acompte_pct     numeric(5,2) not null default 30
                    check (acompte_pct >= 0 and acompte_pct <= 100),
  lettre_intro    text not null default '',
  notes_internes  text not null default '',          -- privé artisan, jamais affiché
  detail_mat_pose boolean not null default false,    -- toggle d'affichage client (aperçu/PDF)
  remise_mode     text not null default 'aucune'
                    check (remise_mode in ('aucune','pourcent','euros')),
  remise_valeur   numeric(12,2) not null default 0
                    check (remise_valeur >= 0),
  total_ht        numeric(12,2) not null default 0,   -- dénormalisés (liste/tri)
  total_tva       numeric(12,2) not null default 0,
  total_ttc       numeric(12,2) not null default 0,
  marge_ht        numeric(12,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, numero)
);

-- ─── INDEXES ───
create index if not exists idx_clients_user  on public.clients (user_id);
create index if not exists idx_devis_user    on public.devis (user_id);
create index if not exists idx_devis_statut  on public.devis (user_id, statut);
create index if not exists idx_devis_client  on public.devis (client_id);
create index if not exists idx_devis_created on public.devis (user_id, created_at desc);

-- ─── updated_at auto ───
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_entreprise_updated before update on public.entreprise
  for each row execute function public.set_updated_at();
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();
create trigger trg_devis_updated before update on public.devis
  for each row execute function public.set_updated_at();

-- ============================================================
-- NUMÉROTATION (côté serveur, à activer lors du passage Supabase)
-- Compteur par (user, année) qui n'est JAMAIS décrémenté : la
-- suppression d'un brouillon laisse un "trou", pas de réutilisation.
-- ============================================================
-- create table if not exists public.devis_sequence (
--   user_id uuid not null references auth.users(id) on delete cascade,
--   annee   integer not null,
--   dernier integer not null default 0,
--   primary key (user_id, annee)
-- );
-- alter table public.devis_sequence enable row level security;

-- ============================================================
-- RLS — décommenter une fois l'auth câblée
-- ============================================================
-- alter table public.entreprise enable row level security;
-- alter table public.clients   enable row level security;
-- alter table public.devis     enable row level security;
--
-- create policy "entreprise_owner" on public.entreprise
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "clients_owner" on public.clients
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "devis_owner" on public.devis
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
