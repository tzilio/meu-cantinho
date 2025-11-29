export interface Branch {
  id: string;
  name: string;
  address: string;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

export interface Space {
  id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  capacity?: number | null;
  price_per_day?: number;
  pricePerDay?: number;
  [key: string]: any;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  created_at?: string | null;
  [key: string]: any;
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | string;

export interface Reservation {
  id: string;
  space_id: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  startDateTime?: string;
  endDateTime?: string;
  status: ReservationStatus;
  total_price?: number;
  deposit_min?: number;
  [key: string]: any;
}

export type PaymentStatus = 'PENDING' | 'PAID' | string;

export interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  purpose?: string | null;
  gateway_reference?: string | null;
  paid_at?: string | null;
  [key: string]: any;
}
