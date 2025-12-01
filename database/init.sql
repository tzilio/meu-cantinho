-- ===========================================
-- Seu Cantinho - init.sql 
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
  cover_url            TEXT,
  active               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_spaces_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_spaces_capacity CHECK (capacity > 0),
  CONSTRAINT chk_spaces_price CHECK (price_per_hour >= 0)
);

-- Índice otimizado
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
-- ===========================================
CREATE TABLE reservations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id             UUID NOT NULL,
  branch_id            UUID NOT NULL,
  customer_id          UUID NOT NULL,

  check_in_date        DATE NOT NULL,
  check_out_date       DATE NOT NULL,

  start_time           TIME NOT NULL,
  end_time             TIME NOT NULL,

  -- novo: número de adultos
  adults_count         INT  NOT NULL,

  status               TEXT NOT NULL DEFAULT 'PENDING',
  total_amount         NUMERIC(10,2) NOT NULL,
  deposit_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
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

  CONSTRAINT chk_reservations_dates
    CHECK (check_out_date >= check_in_date),

  CONSTRAINT chk_reservations_amount
    CHECK (total_amount >= 0),

  CONSTRAINT chk_reservations_adults
    CHECK (adults_count > 0)
);

-- Índices ajustados para o novo modelo (SEM date único)
CREATE INDEX idx_reservations_space_checkin
  ON reservations (space_id, check_in_date, start_time);

CREATE INDEX idx_reservations_space_checkout
  ON reservations (space_id, check_out_date, end_time);

CREATE INDEX idx_reservations_branch_checkin
  ON reservations (branch_id, check_in_date);

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
