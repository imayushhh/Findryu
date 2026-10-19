-- FindrYU schema, part 1 of 6.
-- Paste the files in this folder into the Supabase SQL Editor in numeric order.
-- Each file runs once.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.user_role as enum ('user', 'staff', 'admin');

create type public.location_kind as enum (
  'central',
  'library',
  'security',
  'yu_card_office'
);

create type public.special_handling as enum ('none', 'yu_card', 'passport');

create type public.item_status as enum (
  'reported',
  'received',
  'in_transit',
  'collected',
  'contested',
  'archived'
);

create type public.archived_outcome as enum ('donated', 'disposed');

create type public.transfer_reason as enum (
  'routine',
  'yu_card_office',
  'security_services',
  'after_hours_pickup'
);

create type public.lost_report_status as enum ('active', 'cancelled', 'matched');

create type public.claim_status as enum (
  'pending',
  'on_hold',
  'approved',
  'rejected',
  'collected'
);

create type public.pickup_request as enum ('desk', 'security_services');
