-- ===========================================
-- Seu Cantinho - init.sql (versão customers, sem space_photos)
-- Branches + Spaces + Customers + Reservations + Payments
-- ===========================================

-- Extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- BRANCHES (filiais)
-- ===========================================
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  state       TEXT        NOT NULL,
  city        TEXT        NOT NULL,
  address     TEXT        NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ===========================================
-- SPACES (espaços) — pertencem a uma Branch
-- ===========================================
CREATE TABLE spaces (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id            UUID        NOT NULL,
  name                 TEXT        NOT NULL,
  description          TEXT,
  capacity             INT         NOT NULL,
  price_per_hour       NUMERIC(10,2) NOT NULL,
  cover_url            TEXT,                    -- URL única da foto de capa
  active               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_spaces_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_spaces_capacity CHECK (capacity > 0),
  CONSTRAINT chk_spaces_price CHECK (price_per_hour >= 0)
);

-- Índice para buscas por filial + ativo
CREATE INDEX idx_spaces_branch_active
  ON spaces (branch_id, active);

-- ===========================================
-- CUSTOMERS (clientes)
-- ===========================================
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL UNIQUE,
  phone          TEXT,
  created_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers (email);

-- ===========================================
-- RESERVATIONS (reservas)
-- vinculam um Space, uma Branch e um Customer
-- ===========================================
CREATE TABLE reservations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id             UUID NOT NULL,
  branch_id            UUID NOT NULL,
  customer_id          UUID NOT NULL,

  date                 DATE NOT NULL,
  start_time           TIME NOT NULL,
  end_time             TIME NOT NULL,

  status               TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | CONFIRMED | CANCELLED
  total_amount         NUMERIC(10,2) NOT NULL,
  deposit_pct          NUMERIC(5,2)  NOT NULL DEFAULT 0,
  notes                TEXT,

  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_reservations_space
    FOREIGN KEY (space_id) REFERENCES spaces(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_reservations_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id),

  CONSTRAINT fk_reservations_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id),

  CONSTRAINT chk_reservations_time CHECK (end_time > start_time),
  CONSTRAINT chk_reservations_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
  CONSTRAINT chk_reservations_amount CHECK (total_amount >= 0),
  CONSTRAINT chk_reservations_deposit CHECK (deposit_pct >= 0 AND deposit_pct <= 100)
);

-- Evita double booking simples
CREATE UNIQUE INDEX uq_reservations_slot
  ON reservations (space_id, date, start_time, end_time);

CREATE INDEX idx_reservations_space_date
  ON reservations (space_id, date);

CREATE INDEX idx_reservations_branch_date
  ON reservations (branch_id, date);

CREATE INDEX idx_reservations_customer
  ON reservations (customer_id);

-- ===========================================
-- PAYMENTS (múltiplos pagamentos por reserva)
-- ===========================================
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  UUID NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  method          TEXT NOT NULL,     -- PIX | CARD | CASH | BOLETO
  status          TEXT NOT NULL,     -- PENDING | PAID | CANCELLED | REFUNDED
  purpose         TEXT NOT NULL,     -- DEPOSIT | BALANCE
  paid_at         TIMESTAMP,
  external_ref    TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_payments_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_payments_amount CHECK (amount >= 0),
  CONSTRAINT chk_payments_method CHECK (method IN ('PIX', 'CARD', 'CASH', 'BOLETO')),
  CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED')),
  CONSTRAINT chk_payments_purpose CHECK (purpose IN ('DEPOSIT', 'BALANCE'))
);

CREATE INDEX idx_payments_status_method
  ON payments (status, method);
