create table productos (
  id text primary key,
  nombre text not null,
  precio integer not null check (precio >= 0),
  categoria text not null,
  descripcion text,
  imagen text,
  stock integer not null default 0 check (stock >= 0),
  disponible boolean not null default true,
  imagen_transparente boolean not null default false
);

create table pedidos (
  id bigint generated always as identity primary key,
  nombre_cliente text not null,
  direccion text not null,
  telefono text not null,
  productos jsonb not null,
  total integer not null check (total >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'entregado')),
  creado_en timestamptz not null default now()
);

alter table productos enable row level security;
alter table pedidos enable row level security;

create policy "Cualquiera puede leer productos"
  on productos for select
  using (true);

create policy "Cualquiera puede crear un pedido"
  on pedidos for insert
  with check (true);
