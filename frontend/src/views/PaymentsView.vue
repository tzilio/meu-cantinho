<template>
  <v-container class="py-8" fluid>
    <!-- Cabeçalho + busca por ID -->
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <div class="d-flex flex-column">
          <h2 class="text-h5 font-weight-medium mb-1">Pagamentos</h2>
          <span class="text-body-2 text-medium-emphasis">
            Registre e visualize pagamentos vinculados a reservas (clientes, filiais e espaços).
          </span>
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model="searchPaymentId"
          label="Buscar pagamento por ID"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-magnify"
          hide-details
          :loading="loadingPaymentById"
          @keyup.enter="loadPaymentById"
        />
      </v-col>
    </v-row>

    <v-row align="start">
      <!-- Coluna esquerda: novo pagamento -->
      <v-col cols="12" md="4">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium">
            Novo pagamento
          </v-card-title>

          <v-card-text>
            <v-form @submit.prevent="registerPayment">
              <v-select
                v-model="selectedBranchId"
                :items="branches"
                item-title="name"
                item-value="id"
                label="Filial"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                clearable
              />

              <v-select
                v-model="selectedSpaceId"
                :items="spacesForSelectedBranch"
                item-title="name"
                item-value="id"
                label="Espaço"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                :disabled="!selectedBranchId"
                clearable
              />

              <v-select
                v-model="selectedCustomerId"
                :items="customers"
                item-title="name"
                item-value="id"
                label="Cliente"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                clearable
              />

              <v-select
                v-model="selectedReservationId"
                :items="reservationOptions"
                item-title="label"
                item-value="id"
                label="Reserva"
                variant="outlined"
                density="comfortable"
                class="mb-2"
                hide-details="auto"
                :disabled="!selectedSpaceId"
                clearable
              />

              <!-- Info da reserva escolhida -->
              <div v-if="reservationSummary" class="text-caption text-medium-emphasis mb-4">
                <div><strong>Data:</strong> {{ reservationSummary.date }}</div>
                <div><strong>Horário:</strong> {{ reservationSummary.time }}</div>
                <div><strong>Total da reserva:</strong> {{ reservationSummary.total }}</div>
                <div><strong>Status:</strong> {{ reservationSummary.status }}</div>
              </div>

              <v-text-field
                v-model.number="paymentAmount"
                label="Valor do pagamento (R$)"
                type="number"
                min="0"
                step="0.01"
                prefix="R$"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-3"
              />

              <v-select
                v-model="paymentMethod"
                :items="paymentMethodOptions"
                label="Meio de pagamento"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-3"
              />

              <v-select
                v-model="paymentPurpose"
                :items="paymentPurposeOptions"
                label="Finalidade"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-3"
              />

              <v-text-field
                v-model="paymentExternalRef"
                label="Código no provedor (opcional)"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-4"
              />

              <v-btn
                type="submit"
                color="primary"
                class="text-none"
                block
                :loading="savingPayment"
                :disabled="!selectedReservationId || !paymentAmount || paymentAmount <= 0"
              >
                Registrar pagamento
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Coluna direita: detalhes e listagem -->
      <v-col cols="12" md="8">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1 d-flex align-center">
            Detalhes do pagamento
            <v-spacer />
            <v-btn
              v-if="selectedPayment"
              icon="mdi-refresh"
              variant="text"
              :loading="loadingPaymentById"
              @click="reloadSelectedPayment"
            />
          </v-card-title>

          <v-card-text v-if="selectedPayment">
            <v-row>
              <v-col cols="12" md="6">
                <p><strong>ID:</strong> {{ selectedPayment.id }}</p>
                <p><strong>Reserva:</strong> {{ shortId(selectedPayment.reservation_id) }}</p>
                <p><strong>Cliente:</strong> {{ selectedPayment.customer_name || '—' }}</p>
                <p>
                  <strong>Filial / Espaço:</strong>
                  {{ selectedPayment.branch_name || '—' }}
                  <span v-if="selectedPayment.space_name"> — {{ selectedPayment.space_name }}</span>
                </p>
                <p><strong>Valor:</strong> R$ {{ formatMoney(selectedPayment.amount) }}</p>
              </v-col>

              <v-col cols="12" md="6">
                <p><strong>Status:</strong> {{ selectedPayment.status }}</p>
                <p><strong>Método:</strong> {{ selectedPayment.method }}</p>
                <p><strong>Finalidade:</strong> {{ selectedPayment.purpose }}</p>
                <p><strong>Código provedor:</strong> {{ selectedPayment.external_ref || '-' }}</p>
                <p><strong>Pago em:</strong> {{ formatDateTime(selectedPayment.paid_at) }}</p>
              </v-col>
            </v-row>

            <v-divider class="my-3" />

            <v-row>
              <v-col cols="12" md="6">
                <v-btn
                  color="success"
                  class="text-none"
                  :disabled="selectedPayment.status === 'PAID'"
                  :loading="confirmingPayment"
                  @click="confirmSelectedPayment"
                >
                  Confirmar pagamento
                </v-btn>
              </v-col>

              <v-col cols="12" md="6" class="d-flex justify-end align-center">
                <v-btn
                  color="error"
                  variant="outlined"
                  class="text-none"
                  :loading="deletingPayment"
                  @click="deleteSelectedPayment"
                >
                  Excluir (se não pago)
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-text v-else>
            <v-alert type="info" border="start" variant="tonal">
              Nenhum pagamento selecionado. Busque por um ID ou clique em um
              pagamento na tabela abaixo.
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Listagem de pagamentos -->
        <v-card class="mt-4" elevation="2">
          <v-card-title class="text-subtitle-1 d-flex align-center">
            Pagamentos
          </v-card-title>

          <v-card-text>
            <v-row class="mb-2" dense>
              <v-col cols="12" md="4">
                <v-select
                  v-model="filterStatus"
                  :items="statusFilterOptions"
                  label="Status"
                  density="compact"
                  variant="outlined"
                  hide-details="auto"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="filterMethod"
                  :items="methodFilterOptions"
                  label="Meio de pagamento"
                  density="compact"
                  variant="outlined"
                  hide-details="auto"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="filterCustomerId"
                  :items="customers"
                  item-title="name"
                  item-value="id"
                  label="Cliente"
                  density="compact"
                  variant="outlined"
                  hide-details="auto"
                  clearable
                />
              </v-col>
            </v-row>

            <v-row class="mb-2" dense>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="filterDateFrom"
                  type="date"
                  label="Data inicial"
                  density="compact"
                  variant="outlined"
                  hide-details="auto"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="filterDateTo"
                  type="date"
                  label="Data final"
                  density="compact"
                  variant="outlined"
                  hide-details="auto"
                />
              </v-col>

              <v-col cols="12" md="4" class="d-flex align-center justify-end">
                <v-btn
                  color="primary"
                  variant="tonal"
                  class="text-none"
                  :loading="loadingPayments"
                  @click="loadPayments"
                >
                  Aplicar filtros
                </v-btn>
              </v-col>
            </v-row>

            <v-data-table
              :items="payments"
              :loading="loadingPayments"
              density="compact"
              item-key="id"
              :headers="paymentTableHeaders"
              @click:row="onClickPaymentRow"
            >
              <template #item.date="{ value }">
                {{ formatDateFromIsoDate(value) }}
              </template>

              <template #item.time="{ item }">
                {{ formatTimeRange(item.start_time, item.end_time) }}
              </template>

              <template #item.amount="{ value }">
                R$ {{ formatMoney(value) }}
              </template>

              <template #item.status="{ value }">
                <v-chip
                  size="small"
                  :color="statusColor(value)"
                  variant="tonal"
                  class="text-uppercase"
                >
                  {{ value }}
                </v-chip>
              </template>

              <template #no-data>
                <div class="text-center text-medium-emphasis py-6">
                  Nenhum pagamento encontrado para os filtros atuais.
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { http } from '@/services/http';
import type { Branch, Space, Customer, Reservation, Payment } from '@/types';

type PaymentMethod = 'PIX' | 'CARD' | 'CASH' | 'BOLETO';
type PaymentPurpose = 'DEPOSIT' | 'BALANCE';

const branches = ref<Branch[]>([]);
const spaces = ref<Space[]>([]);
const customers = ref<Customer[]>([]);
const reservations = ref<Reservation[]>([]);

const selectedBranchId = ref<string | null>(null);
const selectedSpaceId = ref<string | null>(null);
const selectedCustomerId = ref<string | null>(null);
const selectedReservationId = ref<string | null>(null);

const paymentAmount = ref<number | null>(null);
const paymentMethod = ref<PaymentMethod>('PIX');
const paymentPurpose = ref<PaymentPurpose>('DEPOSIT');
const paymentExternalRef = ref('');

const savingPayment = ref(false);

const searchPaymentId = ref('');
const selectedPayment = ref<Payment | null>(null);
const loadingPaymentById = ref(false);
const confirmingPayment = ref(false);
const deletingPayment = ref(false);

const payments = ref<Payment[]>([]);
const loadingPayments = ref(false);

const filterStatus = ref<string>('');
const filterMethod = ref<string>('');
const filterCustomerId = ref<string | null>(null);
const filterDateFrom = ref('');
const filterDateTo = ref('');

const paymentMethodOptions: PaymentMethod[] = ['PIX', 'CARD', 'CASH', 'BOLETO'];
const paymentPurposeOptions: PaymentPurpose[] = ['DEPOSIT', 'BALANCE'];

const statusFilterOptions = [
  { title: 'Todos', value: '' },
  { title: 'Pendente', value: 'PENDING' },
  { title: 'Pago', value: 'PAID' },
  { title: 'Cancelado', value: 'CANCELLED' },
  { title: 'Estornado', value: 'REFUNDED' },
];

const methodFilterOptions = [
  { title: 'Todos', value: '' },
  { title: 'PIX', value: 'PIX' },
  { title: 'Cartão', value: 'CARD' },
  { title: 'Dinheiro', value: 'CASH' },
  { title: 'Boleto', value: 'BOLETO' },
];

const paymentTableHeaders = [
  { title: 'Data', key: 'date' },
  { title: 'Horário', key: 'time' },
  { title: 'Cliente', key: 'customer_name' },
  { title: 'Filial', key: 'branch_name' },
  { title: 'Espaço', key: 'space_name' },
  { title: 'Valor (R$)', key: 'amount' },
  { title: 'Método', key: 'method' },
  { title: 'Status', key: 'status' },
];

const spacesForSelectedBranch = computed(() =>
  selectedBranchId.value
    ? spaces.value.filter((s) => s.branch_id === selectedBranchId.value)
    : []
);

const reservationOptions = computed(() =>
  reservations.value.map((r) => ({
    id: r.id,
    label:
      `${formatDate(r.date)} • ` +
      `${formatTime(r.start_time)} - ${formatTime(r.end_time)} • ` +
      (r.customer_name ? `${r.customer_name} • ` : '') +
      `Total R$ ${formatMoney(Number(r.total_amount ?? 0))} • ` +
      `ID ${shortId(r.id)}`,
  }))
);

const reservationSummary = computed(() => {
  if (!selectedReservationId.value) return null;
  const r = reservations.value.find((res) => res.id === selectedReservationId.value);
  if (!r) return null;
  return {
    date: formatDate(r.date),
    time: formatTime(r.start_time) + ' - ' + formatTime(r.end_time),
    total: 'R$ ' + formatMoney(Number(r.total_amount ?? 0)),
    status: r.status,
  };
});

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateFromIsoDate(value?: string | null): string {
  if (!value) return '—';
  const [datePart] = value.split('T');
  return formatDate(datePart);
}

function formatTime(value?: string | null): string {
  if (!value) return '—';
  return value.slice(0, 5);
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatMoney(value?: number | null): string {
  if (value == null) return '0,00';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleString('pt-BR');
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function statusColor(status: string): string {
  switch (status) {
    case 'PAID': return 'success';
    case 'CANCELLED':
    case 'REFUNDED': return 'error';
    case 'PENDING':
    default: return 'warning';
  }
}

async function loadBranches() {
  const { data } = await http.get<Branch[]>('/branches');
  branches.value = data;
}

async function loadCustomers() {
  const { data } = await http.get<Customer[]>('/customers');
  customers.value = data;
}

async function loadSpacesForBranch(branchId: string) {
  const { data } = await http.get<Space[]>(
    `/branches/${branchId}/spaces`,
    { params: { only_active: true } }
  );
  spaces.value = data;
}

async function loadReservationsForSpace(spaceId: string) {
  const { data } = await http.get<Reservation[]>(
    `/spaces/${spaceId}/reservations`
  );
  reservations.value = data;
}

async function loadPayments() {
  loadingPayments.value = true;
  try {
    const params: Record<string, string> = {};

    if (selectedBranchId.value) params.branch_id = selectedBranchId.value;
    if (selectedSpaceId.value) params.space_id = selectedSpaceId.value;
    if (filterCustomerId.value) params.customer_id = filterCustomerId.value;
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterMethod.value) params.method = filterMethod.value;
    if (filterDateFrom.value) params.date_from = filterDateFrom.value;
    if (filterDateTo.value) params.date_to = filterDateTo.value;

    const { data } = await http.get<Payment[]>('/payments', { params });
    payments.value = data;
  } finally {
    loadingPayments.value = false;
  }
}

async function registerPayment() {
  if (!selectedReservationId.value) return;
  if (!paymentAmount.value || paymentAmount.value <= 0) return;

  savingPayment.value = true;
  try {
    const payload = {
      amount: paymentAmount.value,
      method: paymentMethod.value,
      purpose: paymentPurpose.value,
      external_ref: paymentExternalRef.value || undefined,
    };

    const { data } = await http.post<Payment>(
      `/reservations/${selectedReservationId.value}/payments`,
      payload
    );

    selectedPayment.value = data;
    searchPaymentId.value = data.id;

    paymentAmount.value = null;
    paymentExternalRef.value = '';
    paymentMethod.value = 'PIX';
    paymentPurpose.value = 'DEPOSIT';

    await loadPayments();
  } finally {
    savingPayment.value = false;
  }
}

async function loadPaymentById() {
  if (!searchPaymentId.value.trim()) return;

  loadingPaymentById.value = true;
  try {
    const { data } = await http.get<Payment>(
      `/payments/${searchPaymentId.value.trim()}`
    );
    selectedPayment.value = data;
  } finally {
    loadingPaymentById.value = false;
  }
}

async function reloadSelectedPayment() {
  if (!selectedPayment.value) return;

  loadingPaymentById.value = true;
  try {
    const { data } = await http.get<Payment>(
      `/payments/${selectedPayment.value.id}`
    );
    selectedPayment.value = data;
  } finally {
    loadingPaymentById.value = false;
  }
}

async function confirmSelectedPayment() {
  if (!selectedPayment.value) return;

  confirmingPayment.value = true;
  try {
    const { data } = await http.post<Payment>(
      `/payments/${selectedPayment.value.id}/confirm`,
      {
        external_ref: selectedPayment.value.external_ref || null,
      }
    );
    selectedPayment.value = data;
    await loadPayments();
  } finally {
    confirmingPayment.value = false;
  }
}

async function deleteSelectedPayment() {
  if (!selectedPayment.value) return;
  if (!confirm('Deseja excluir este pagamento?')) return;

  deletingPayment.value = true;
  try {
    await http.delete(`/payments/${selectedPayment.value.id}`);
    selectedPayment.value = null;
    searchPaymentId.value = '';
    await loadPayments();
  } finally {
    deletingPayment.value = false;
  }
}

function onClickPaymentRow(_: unknown, row: any) {
  selectedPayment.value = (row?.item?.raw ?? row?.item) as Payment;
}

watch(selectedBranchId, async (newVal) => {
  spaces.value = [];
  reservations.value = [];
  selectedSpaceId.value = null;
  selectedReservationId.value = null;

  if (newVal) {
    await loadSpacesForBranch(newVal);
  }
  await loadPayments();
});

watch(selectedSpaceId, async (newVal) => {
  reservations.value = [];
  selectedReservationId.value = null;

  if (newVal) {
    await loadReservationsForSpace(newVal);
  }
  await loadPayments();
});

watch(selectedCustomerId, async () => {
  filterCustomerId.value = selectedCustomerId.value;
  await loadPayments();
});

onMounted(async () => {
  await Promise.all([loadBranches(), loadCustomers()]);
  await loadPayments();
});
</script>
