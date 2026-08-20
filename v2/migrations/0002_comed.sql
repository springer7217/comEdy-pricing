create table if not exists comed_prices (
  recorded_at timestamptz primary key,
  price numeric(10, 4) not null,
  source text not null default 'comed'
);

create index if not exists comed_prices_recorded_idx
  on comed_prices (recorded_at desc);

create table if not exists comed_bills (
  id serial primary key,
  service_start date not null unique,
  service_end date not null,
  days integer not null,
  total_kwh integer not null,
  supply_amount numeric(10, 2) not null,
  delivery_amount numeric(10, 2) not null,
  taxes_fees numeric(10, 2) not null,
  total_due numeric(10, 2) not null,
  supply_rate numeric(12, 6) not null,
  effective_rate numeric(10, 4) not null,
  market_avg numeric(10, 4) not null,
  market_vs_paid_diff numeric(10, 4) not null,
  season text not null,
  credits_applied boolean not null default false
);
