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
          density="comfortable"
          prepend-inner-icon="mdi-magnify"
          hide-details="auto"
          class="mb-3"
          :loading="loadingPaymentById"
          @keyup.enter="loadPaymentById"
        />
      </v-col>
    </v-row>

    <v-row align="start">
      <!-- COLUNA ESQUERDA: NOVO PAGAMENTO -->
      <v-col cols="12" md="4">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium">
            Novo pagamento
          </v-card-title>

          <v-card-text>
            <v-form @submit.prevent="registerPayment">
              <!-- FILIAL -->
              <v-select
                v-model="selectedBranchId"
                :items="branches"
                item-title="name"
                item-value="id"
                label="Filial"
                placeholder="Selecione a filial"
                density="comfortable"
                clearable
                class="mb-3"
              />

              <!-- ESPAÇO -->
              <v-select
                v-model="selectedSpaceId"
                :items="spacesForSelectedBranch"
                item-title="name"
                item-value="id"
                label="Espaço"
                placeholder="Escolha o espaço"
                :disabled="!selectedBranchId"
                density="comfortable"
                clearable
                class="mb-3"
              />

              <!-- CLIENTE -->
              <v-select
                v-model="selectedCustomerId"
                :items="customers"
                item-title="name"
                item-value="id"
                label="Cliente"
                placeholder="Selecione o cliente"
                density="comfortable"
                clearable
                class="mb-3"
              />

              <!-- RESERVA -->
              <v-select
                v-model="selectedReservationId"
                :items="reservationOptions"
                item-title="label"
                item-value="id"
                label="Reserva"
                placeholder="Selecione a reserva"
                :disabled="!selectedSpaceId"
                density="comfortable"
                clearable
                class="mb-3"
              />

              <!-- RESUMO DA RESERVA -->
              <div
                v-if="reservationSummary"
                class="text-caption text-medium-emphasis mb-1"
              >
                <div><strong>Data:</strong> {{ reservationSummary.date }}</div>
                <div><strong>Horário:</strong> {{ reservationSummary.time }}</div>
                <div><strong>Total:</strong> {{ reservationSummary.total }}</div>
                <div><strong>Status:</strong> {{ reservationSummary.status }}</div>
                <div><strong>Cliente:</strong> {{ reservationSummary.customer }}</div>
              </div>

              <!-- AVISO DE RESERVA QUITADA -->
              <div
                v-if="reservationSummary && remainingAmount === 0"
                class="text-caption text-success mb-3"
              >
                Reserva já está totalmente paga. Nenhum valor restante.
              </div>

              <!-- MODO DE PAGAMENTO -->
              <v-btn-toggle
                v-model="paymentMode"
                class="mb-2"
                mandatory
                divided
                density="comfortable"
              >
                <v-btn value="FULL" class="text-none" size="small">
                  À vista (quitar)
                </v-btn>
                <v-btn value="INSTALLMENTS" class="text-none" size="small">
                  Parcelado
                </v-btn>
              </v-btn-toggle>

              <!-- VALOR -->
              <v-text-field
                v-model.number="paymentAmount"
                label="Valor do pagamento (R$)"
                :placeholder="paymentMode === 'FULL' ? 'Valor total / saldo' : '0,00'"
                type="number"
                min="0"
                step="0.01"
                prefix="R$"
                density="comfortable"
                class="mb-3"
                :disabled="paymentMode === 'FULL'"
                :hint="
                  selectedReservationId
                    ? `Saldo restante: R$ ${formatMoney(remainingAmount)}`
                    : ''
                "
                persistent-hint
                :error="amountExceedsRemaining"
                :error-messages="amountExceedsRemaining ? amountErrorMessage : ''"
              />

              <!-- MÉTODO -->
              <v-select
                v-model="paymentMethod"
                :items="paymentMethodOptions"
                label="Meio de pagamento"
                placeholder="Selecione o método"
                density="comfortable"
                clearable
                class="mb-3"
              />

              <!-- FINALIDADE -->
              <v-select
                v-model="paymentPurpose"
                :items="paymentPurposeOptions"
                label="Finalidade"
                placeholder="Selecione a finalidade"
                density="comfortable"
                clearable
                class="mb-3"
              />

              <!-- CÓDIGO NO PROVEDOR -->
              <v-text-field
                v-model="paymentExternalRef"
                label="Código do provedor (opcional)"
                placeholder="Ex: 18e9acx72"
                type="text"
                density="comfortable"
                class="mb-4"
                clearable
              />

              <v-btn
                type="submit"
                color="primary"
                block
                class="text-none"
                :loading="savingPayment"
                :disabled="!formIsValid"
              >
                Registrar pagamento
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- COLUNA DIREITA: DETALHES E LISTAGEM -->
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
                <p>
                  <strong>Reserva:</strong>
                  {{ shortId(selectedPayment.reservation_id) }}
                </p>
                <p>
                  <strong>Cliente:</strong>
                  {{ selectedPayment.customer_name || '—' }}
                </p>
                <p>
                  <strong>Filial / Espaço:</strong>
                  {{ selectedPayment.branch_name || '—' }}
                  <span v-if="selectedPayment.space_name">
                    — {{ selectedPayment.space_name }}
                  </span>
                </p>
                <p>
                  <strong>Valor:</strong>
                  R$ {{ formatMoney(selectedPayment.amount) }}
                </p>
              </v-col>

              <v-col cols="12" md="6">
                <p><strong>Status:</strong> {{ selectedPayment.status }}</p>
                <p><strong>Método:</strong> {{ selectedPayment.method }}</p>
                <p><strong>Finalidade:</strong> {{ selectedPayment.purpose }}</p>
                <p>
                  <strong>Cod. Provedor:</strong>
                  {{ selectedPayment.external_ref || '-' }}
                </p>
                <p>
                  <strong>Pago em:</strong>
                  {{ formatDateTime(selectedPayment.paid_at) }}
                </p>
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
              Nenhum pagamento selecionado. Busque um ID ou selecione um
              pagamento na tabela.
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- LISTAGEM -->
        <v-card class="mt-4" elevation="2">
          <v-card-title class="text-subtitle-1">
            Pagamentos
          </v-card-title>

          <v-card-text>
            <!-- Filtros -->
            <v-row class="mb-3" dense>
              <v-col cols="12" md="4">
                <v-select
                  v-model="filterStatus"
                  :items="statusFilterOptions"
                  label="Status"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  class="mb-3"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="filterMethod"
                  :items="methodFilterOptions"
                  label="Meio"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  class="mb-3"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="filterCustomerId"
                  :items="customers"
                  item-title="name"
                  item-value="id"
                  label="Cliente"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  clearable
                  class="mb-3"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="filterDateFrom"
                  type="date"
                  label="Data inicial"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  class="mb-3"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="filterDateTo"
                  type="date"
                  label="Data final"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  class="mb-3"
                />
              </v-col>

              <v-col
                cols="12"
                md="4"
                class="d-flex align-center justify-end"
              >
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

            <!-- Tabela -->
            <v-data-table
              :items="payments"
              :loading="loadingPayments"
              density="compact"
              item-key="id"
              :headers="paymentTableHeaders"
              @click:row="onClickPaymentRow"
            >
              <template #item.check_in_date="{ value }">
                {{ formatDateFromIso(value) }}
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
                  Nenhum pagamento encontrado.
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue';
import { http } from '@/services/http';
import type { Branch, Space, Customer, Reservation, Payment } from '@/types';

/* ======= VALIDAÇÕES ======= */
const rules = {
  required: (v: any) => !!v || 'Campo obrigatório',
  positive: (v: number) => v > 0 || 'Informe um valor maior que zero',
};

/* ======= STATE ======= */
const branches = ref<Branch[]>([]);
const spaces = ref<Space[]>([]);
const customers = ref<Customer[]>([]);
const reservations = ref<Reservation[]>([]);

const loadingSpaces = ref(false);

const selectedBranchId = ref<string | null>(null);
const selectedSpaceId = ref<string | null>(null);
const selectedCustomerId = ref<string | null>(null);
const selectedReservationId = ref<string | null>(null);

const paymentAmount = ref<number | null>(null);
const paymentMethod = ref('PIX');
const paymentPurpose = ref('DEPOSIT');
const paymentExternalRef = ref('');

/* modo de pagamento: à vista x parcelado */
const paymentMode = ref<'FULL' | 'INSTALLMENTS'>('FULL');

const savingPayment = ref(false);

const searchPaymentId = ref('');
const selectedPayment = ref<Payment | null>(null);
const loadingPaymentById = ref(false);
const confirmingPayment = ref(false);
const deletingPayment = ref(false);

const payments = ref<Payment[]>([]);
const loadingPayments = ref(false);

/* ====== FILTROS ====== */
const filterStatus = ref('');
const filterMethod = ref('');
const filterCustomerId = ref<string | null>(null);
const filterDateFrom = ref('');
const filterDateTo = ref('');

/* ====== OPTIONS ====== */
const paymentMethodOptions = ['PIX', 'CARD', 'CASH', 'BOLETO'];
const paymentPurposeOptions = ['DEPOSIT', 'BALANCE'];

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

/* ====== TABELA ====== */
const paymentTableHeaders = [
  { title: 'Data entrada', key: 'check_in_date' },
  { title: 'Cliente', key: 'customer_name' },
  { title: 'Filial', key: 'branch_name' },
  { title: 'Espaço', key: 'space_name' },
  { title: 'Valor (R$)', key: 'amount' },
  { title: 'Método', key: 'method' },
  { title: 'Status', key: 'status' },
];

/* ======= COMPUTED ======= */
const spacesForSelectedBranch = computed(() =>
  selectedBranchId.value
    ? spaces.value.filter((s) => s.branch_id === selectedBranchId.value)
    : [],
);

/* Helpers de data/hora/dinheiro */
function formatDate(date: string) {
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

function formatDateFromIso(value: string | null | undefined) {
  if (!value) return '—';
  const [dateOnly] = value.split('T');
  return formatDate(dateOnly);
}

function formatTime(value?: string | null): string {
  return value ? value.slice(0, 5) : '—';
}

function formatMoney(value?: number | null): string {
  return (value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function statusColor(s: string) {
  switch (s) {
    case 'PAID':
      return 'success';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'error';
    default:
      return 'warning';
  }
}

/* RESERVA SELECIONADA */
const selectedReservation = computed(
  () => reservations.value.find((r) => r.id === selectedReservationId.value) || null,
);

/* Saldo restante da reserva (total - soma de pagamentos PENDING + PAID) */
const remainingAmount = computed(() => {
  const resv = selectedReservation.value;
  if (!resv) return 0;

  const total = Number((resv as any).total_amount ?? 0);

  const committed = payments.value
    .filter(
      (p: any) =>
        p.reservation_id === resv.id &&
        (p.status === 'PENDING' || p.status === 'PAID'),
    )
    .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);

  const remaining = total - committed;
  return remaining > 0 ? remaining : 0;
});

/* Valor do pagamento (parcelado) maior que o saldo? */
const amountExceedsRemaining = computed(() => {
  if (paymentMode.value !== 'INSTALLMENTS') return false;
  if (!selectedReservationId.value) return false;
  if (!paymentAmount.value) return false;
  return paymentAmount.value > remainingAmount.value;
});

/* Mensagem de erro pro campo de valor */
const amountErrorMessage = computed(() => {
  if (!amountExceedsRemaining.value) return '';
  return (
    `O valor informado (R$ ${formatMoney(paymentAmount.value || 0)}) ` +
    `ultrapassa o saldo restante da reserva (R$ ${formatMoney(remainingAmount.value)}).`
  );
});

/* RESERVAS PARA O SELECT */
const reservationOptions = computed(() =>
  reservations.value.map((r) => {
    const customer = customers.value.find((c) => c.id === r.customer_id);
    const clienteNome = customer ? customer.name : 'Cliente';

    const dateRange =
      r.check_in_date === r.check_out_date
        ? formatDateFromIso(r.check_in_date)
        : `${formatDateFromIso(r.check_in_date)} → ${formatDateFromIso(
            r.check_out_date,
          )}`;

    return {
      id: r.id,
      label:
        `${dateRange} • ` +
        `${formatTime(r.start_time)} • ` +
        `${clienteNome} • ` +
        `Total R$ ${formatMoney(Number((r as any).total_amount ?? 0))}`,
    };
  }),
);

/* RESUMO DA RESERVA SELECIONADA */
const reservationSummary = computed(() => {
  if (!selectedReservationId.value) return null;
  const r = reservations.value.find((x) => x.id === selectedReservationId.value);
  if (!r) return null;

  const customer = customers.value.find((c) => c.id === r.customer_id);
  const clienteNome = customer ? customer.name : 'Cliente';

  const dateRange =
    r.check_in_date === r.check_out_date
      ? formatDateFromIso(r.check_in_date)
      : `${formatDateFromIso(r.check_in_date)} → ${formatDateFromIso(
          r.check_out_date,
        )}`;

  return {
    date: dateRange,
    time: formatTime(r.start_time),
    total: `R$ ${formatMoney(Number((r as any).total_amount ?? 0))}`,
    status: r.status,
    customer: clienteNome,
  };
});

/* Verifica se formulário é válido */
const formIsValid = computed(() => {
  if (
    !selectedBranchId.value ||
    !selectedSpaceId.value ||
    !selectedCustomerId.value ||
    !selectedReservationId.value
  ) {
    return false;
  }

  if (paymentMode.value === 'FULL') {
    // à vista: só precisa ter reserva selecionada e saldo > 0
    return remainingAmount.value > 0;
  }

  // parcelado: valor informado > 0 e não ultrapassar o saldo
  return (
    !!paymentAmount.value &&
    paymentAmount.value > 0 &&
    !amountExceedsRemaining.value
  );
});

/* ======= API ======= */
async function loadBranches() {
  const { data } = await http.get('/branches');
  branches.value = data;
}

async function loadCustomers() {
  const { data } = await http.get('/customers');
  customers.value = data;
}

async function loadSpacesForBranch(branchId: string) {
  loadingSpaces.value = true;
  const { data } = await http.get(`/branches/${branchId}/spaces`, {
    params: { only_active: true },
  });
  spaces.value = data;
  loadingSpaces.value = false;
}

async function loadReservationsForSpace(spaceId: string) {
  const { data } = await http.get(`/spaces/${spaceId}/reservations`);
  reservations.value = data;
}

async function loadPayments() {
  loadingPayments.value = true;

  const params: Record<string, string> = {};

  if (selectedBranchId.value) params.branch_id = selectedBranchId.value;
  if (selectedSpaceId.value) params.space_id = selectedSpaceId.value;
  if (filterCustomerId.value) params.customer_id = filterCustomerId.value;
  if (filterStatus.value) params.status = filterStatus.value;
  if (filterMethod.value) params.method = filterMethod.value;
  if (filterDateFrom.value) params.from_date = filterDateFrom.value;
  if (filterDateTo.value) params.to_date = filterDateTo.value;

  const { data } = await http.get('/payments', { params });
  payments.value = data;

  loadingPayments.value = false;
}

async function registerPayment() {
  // para modo FULL, força o valor a ser o saldo restante
  if (paymentMode.value === 'FULL') {
    paymentAmount.value = remainingAmount.value || null;
  }

  if (!formIsValid.value) return;

  savingPayment.value = true;
  try {
    const payload = {
      amount: paymentAmount.value,
      method: paymentMethod.value,
      purpose: paymentPurpose.value,
      external_ref: paymentExternalRef.value.trim() || undefined,
    };

    const { data } = await http.post(
      `/reservations/${selectedReservationId.value}/payments`,
      payload,
    );

    selectedPayment.value = data;
    searchPaymentId.value = data.id;

    paymentAmount.value = null;
    paymentExternalRef.value = '';
    selectedReservationId.value = null;

    await loadPayments();
  } finally {
    savingPayment.value = false;
  }
}

async function loadPaymentById() {
  if (!searchPaymentId.value.trim()) return;

  loadingPaymentById.value = true;
  try {
    const { data } = await http.get(`/payments/${searchPaymentId.value.trim()}`);
    selectedPayment.value = data;
  } finally {
    loadingPaymentById.value = false;
  }
}

async function reloadSelectedPayment() {
  if (!selectedPayment.value) return;
  loadingPaymentById.value = true;

  try {
    const { data } = await http.get(`/payments/${selectedPayment.value.id}`);
    selectedPayment.value = data;
  } finally {
    loadingPaymentById.value = false;
  }
}

async function confirmSelectedPayment() {
  if (!selectedPayment.value) return;

  confirmingPayment.value = true;
  try {
    const { data } = await http.post(
      `/payments/${selectedPayment.value.id}/confirm`,
      {
        external_ref: selectedPayment.value.external_ref || null,
      },
    );

    selectedPayment.value = data;
    await loadPayments();
  } finally {
    confirmingPayment.value = false;
  }
}

async function deleteSelectedPayment() {
  if (!selectedPayment.value) return;
  if (!confirm('Deseja realmente excluir este pagamento?')) return;

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
  selectedPayment.value = row?.item?.raw ?? row?.item;
}

/* ======= WATCHERS ======= */
watch(selectedBranchId, async (newVal) => {
  spaces.value = [];
  reservations.value = [];
  selectedSpaceId.value = null;
  selectedReservationId.value = null;

  if (newVal) await loadSpacesForBranch(newVal);
  await loadPayments();
});

watch(selectedSpaceId, async (newVal) => {
  reservations.value = [];
  selectedReservationId.value = null;

  if (newVal) await loadReservationsForSpace(newVal);
  await loadPayments();
});

watch(selectedCustomerId, async (newVal) => {
  filterCustomerId.value = newVal;
  await loadPayments();
});

/* Quando muda reserva, modo ou lista de pagamentos, ajusta valor no modo FULL */
watch(
  [selectedReservationId, paymentMode, payments],
  () => {
    if (paymentMode.value === 'FULL' && selectedReservationId.value) {
      const val = remainingAmount.value;
      paymentAmount.value = val > 0 ? val : null;
    }
  },
);

/* ======= INIT ======= */
onMounted(async () => {
  await Promise.all([loadBranches(), loadCustomers()]);
  await loadPayments();
});
</script>
