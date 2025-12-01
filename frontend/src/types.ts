// src/types.ts

// ===================================
// Branch (filial)
// ===================================
export interface Branch {
  id: string;
  name: string;
  address: string | null;

  // Campos extras que existem no schema, mas ainda não são usados em todas as telas
  state?: string | null;
  city?: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: any;
}

// ===================================
// Space (espaço)
// schema: spaces
// ===================================
export interface Space {
  id: string;
  branch_id: string;

  name: string;
  description?: string | null;

  // no banco/controlador: capacity INT NOT NULL
  capacity: number;

  // no banco/controlador: price_per_hour NUMERIC(10,2)
  price_per_hour: number;

  // no banco/controlador: active BOOLEAN
  active?: boolean;

  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: any;
}

// ===================================
// User
// schema: customer
// ===================================
export type UserRole = 'CUSTOMER' | 'ADMIN' | 'MANAGER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;

  role: UserRole;

  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: any;
}

// ===================================
// Reservation
// schema: reservations
// ===================================
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface Reservation {
  id: string;
  space_id: string;
  branch_id: string;
  customer_id: string;

  // no banco: DATE + TIME separados
  date: string;        // 'YYYY-MM-DD'
  start_time: string;  // 'HH:mm:ss' (ou 'HH:mm')
  end_time: string;    // idem

  status: ReservationStatus;

  total_amount: number;
  deposit_pct: number;

  notes?: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  // Campos opcionais que podem vir em endpoints com JOIN (lista agregada, etc.)
  space_name?: string;
  branch_name?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;

  [key: string]: any;
}

// ===================================
// Payment
// schema/controlador: payments
// (versão nova: reservation_id/amount/method/...)
// ===================================

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'CANCELLED'
  | 'REFUNDED'
  | string;

export type PaymentMethod = 'Pix' | 'Cartão' | 'DInheiro' | 'Boleto' | string;

export type PaymentPurpose = 'Depósito' | 'Saldo' | string;

export interface Payment {
  id: string;

  // no back novo: payments.reservation_id (FK de reservations.id)
  reservation_id: string;

  // valor do pagamento (não é mais gross/fee/net separados)
  amount: number;

  // PIX, CARD, CASH, BOLETO...
  method: PaymentMethod;

  // PENDING, PAID, CANCELLED, REFUNDED...
  status: PaymentStatus;

  // DEPOSIT (sinal), BALANCE (saldo)...
  purpose: PaymentPurpose;

  // código no provedor (opcional)
  external_ref: string | null;

  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  // Campos agregados por JOIN (controller de payments já pode devolver isso)
  reservation_date?: string;        // YYYY-MM-DD
  reservation_start_time?: string;  // HH:mm:ss
  reservation_end_time?: string;    // HH:mm:ss
  reservation_status?: ReservationStatus;

  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string | null;

  [key: string]: any;
}
