<!-- src/views/ReservationsView.vue -->
<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";

const API_BASE = "http://localhost:3000";

/**
 * Tipagens alinhadas com o back atualizado
 */
type Branch = {
  id: string;
  name: string;
  state: string;
  city: string;
  address: string;
};

type Space = {
  id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  capacity: number;
  price_per_hour: number;
  active: boolean;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type Reservation = {
  id: string;
  space_id: string;
  branch_id: string;
  customer_id: string;

  check_in_date: string;
  check_out_date: string;
  start_time: string;
  end_time: string;

  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  total_amount: number;
  deposit_pct: number;
  notes?: string | null;
};

/**
 * Estado reativo
 */
const branches = ref<Branch[]>([]);
const spaces = ref<Space[]>([]);
const customers = ref<Customer[]>([]);
const reservations = ref<Reservation[]>([]);

const loadingReservations = ref(false);
const savingReservation = ref(false);
const loadingSpaces = ref(false);

/** Campos do formulário */
const formBranchId = ref<string | null>(null);
const formSpaceId = ref<string | null>(null);
const formCustomerId = ref<string | null>(null);

const formCheckInDate = ref("");
const formCheckOutDate = ref("");
const formStartTime = ref("");
const formEndTime = ref("");

const formDepositPct = ref<number | null>(null);
const formNotes = ref("");

/** Filtro (filtra por check-in) */
const filterDate = ref("");

/**
 * Validações
 */
const rules = {
  required: (v: any) => !!v || "Campo obrigatório",
  percent: (v: number) =>
    (v >= 0 && v <= 100) || "Use um valor entre 0 e 100",
  timeOrder: () =>
    !formStartTime.value ||
    !formEndTime.value ||
    new Date(`2000-01-01T${formEndTime.value}`) >
      new Date(`2000-01-01T${formStartTime.value}`) ||
    "Fim deve ser maior que início",
  dateOrder: () =>
    !formCheckInDate.value ||
    !formCheckOutDate.value ||
    formCheckOutDate.value >= formCheckInDate.value ||
    "Saída deve ser no mesmo dia ou após a entrada",
};

/**
 * Helpers
 */
 function formatDate(value?: string | null): string {
  if (!value) return "—";
  const clean = value.slice(0, 10); // AAAA-mm-dd
  const [y, m, d] = clean.split("-");
  return `${d}/${m}/${y}`;
}


function formatTime(value?: string | null): string {
  return value ? value.slice(0, 5) : "—";
}

function formatMoney(value?: number | null): string {
  if (value == null) return "0,00";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusColor(status: Reservation["status"]): string {
  switch (status) {
    case "CONFIRMED": return "success";
    case "CANCELLED": return "error";
    default: return "warning";
  }
}

const spacesForSelectedBranch = computed(() => {
  if (!formBranchId.value) return [];
  return spaces.value.filter((s) => s.branch_id === formBranchId.value);
});

function customerName(customerId: string): string {
  const c = customers.value.find((u) => u.id === customerId);
  return c ? c.name : customerId;
}

/**
 * Carregamento de dados
 */
async function loadBranches() {
  const res = await fetch(`${API_BASE}/branches`);
  branches.value = res.ok ? await res.json() : [];
}

async function loadCustomers() {
  const res = await fetch(`${API_BASE}/customers`);
  customers.value = res.ok ? await res.json() : [];
}

async function loadSpacesForBranch(branchId: string) {
  loadingSpaces.value = true;
  const res = await fetch(
    `${API_BASE}/branches/${branchId}/spaces?only_active=true`
  );
  spaces.value = res.ok ? await res.json() : [];
  loadingSpaces.value = false;
}

async function loadReservations() {
  if (!formSpaceId.value) {
    reservations.value = [];
    return;
  }

  loadingReservations.value = true;

  const params = new URLSearchParams();
  if (filterDate.value) params.set("check_in_date", filterDate.value);

  const res = await fetch(
    `${API_BASE}/spaces/${formSpaceId.value}/reservations${
      params.toString() ? `?${params}` : ""
    }`
  );

  reservations.value = res.ok ? await res.json() : [];
  loadingReservations.value = false;
}

/**
 * Criar reserva
 */
async function createReservation() {
  if (!formBranchId.value || !formSpaceId.value || !formCustomerId.value)
    return;

  // valida datas
  if (formCheckOutDate.value < formCheckInDate.value) {
    alert("Data de saída deve ser após a entrada.");
    return;
  }

  // valida horário total
  const start = new Date(`${formCheckInDate.value}T${formStartTime.value}`);
  const end = new Date(`${formCheckOutDate.value}T${formEndTime.value}`);
  if (end <= start) {
    alert("Horário final deve ser maior que o inicial.");
    return;
  }

  savingReservation.value = true;

  try {
    const payload = {
      customer_id: formCustomerId.value,
      check_in_date: formCheckInDate.value,
      check_out_date: formCheckOutDate.value,
      start_time: formStartTime.value,
      end_time: formEndTime.value,
      deposit_pct: formDepositPct.value ?? undefined,
      notes: formNotes.value.trim() || undefined,
    };

    const res = await fetch(
      `${API_BASE}/spaces/${formSpaceId.value}/reservations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) throw new Error(await res.text());

    await loadReservations();

    // limpa form
    formCheckInDate.value = "";
    formCheckOutDate.value = "";
    formStartTime.value = "";
    formEndTime.value = "";
    formDepositPct.value = null;
    formNotes.value = "";

  } catch (err) {
    console.error(err);
    alert("Erro ao criar reserva");
  }

  savingReservation.value = false;
}

/**
 * Reações
 */
watch(formBranchId, async (newVal) => {
  spaces.value = [];
  formSpaceId.value = null;
  reservations.value = [];
  if (newVal) await loadSpacesForBranch(newVal);
});

watch(formSpaceId, async () => {
  filterDate.value = "";
  await loadReservations();
});

watch(filterDate, loadReservations);

/**
 * Init
 */
onMounted(async () => {
  await Promise.all([loadBranches(), loadCustomers()]);
});
</script>

<template>
  <v-container class="py-8" fluid>

    <v-row>
      <v-col cols="12">
        <div class="mb-6">
          <h1 class="text-h4 font-weight-medium mb-1">Reservas</h1>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Cadastre novas reservas e visualize as existentes.
          </p>
        </div>
      </v-col>
    </v-row>

    <v-row align="start" dense>
      <!-- NOVA RESERVA -->
      <v-col cols="12" md="5">
        <v-card elevation="2">

          <v-card-title class="text-subtitle-1 font-weight-medium">
            Nova reserva
          </v-card-title>

          <v-card-text>
            <v-form @submit.prevent="createReservation">

              <!-- FILIAL -->
              <v-select
                v-model="formBranchId"
                :items="branches"
                item-title="name"
                item-value="id"
                label="Filial"
                density="comfortable"
                :rules="[rules.required]"
                clearable
                class="mb-3"
              />

              <!-- ESPAÇO -->
              <v-select
                v-model="formSpaceId"
                :items="spacesForSelectedBranch"
                item-title="name"
                item-value="id"
                label="Espaço"
                :loading="loadingSpaces"
                :disabled="!formBranchId"
                density="comfortable"
                :rules="[rules.required]"
                clearable
                class="mb-3"
              />

              <!-- CLIENTE -->
              <v-select
                v-model="formCustomerId"
                :items="customers"
                item-title="name"
                item-value="id"
                label="Cliente"
                density="comfortable"
                :rules="[rules.required]"
                clearable
                class="mb-3"
              />

              <!-- DATAS -->
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="formCheckInDate"
                    type="date"
                    label="Entrada"
                    density="comfortable"
                    :rules="[rules.required]"
                  />
                </v-col>

                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="formCheckOutDate"
                    type="date"
                    label="Saída"
                    density="comfortable"
                    :rules="[rules.required, rules.dateOrder]"
                  />
                </v-col>
              </v-row>

              <!-- HORÁRIOS -->
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="formStartTime"
                    type="time"
                    label="Hora início"
                    density="comfortable"
                    :rules="[rules.required]"
                  />
                </v-col>

                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="formEndTime"
                    type="time"
                    label="Hora fim"
                    density="comfortable"
                    :rules="[rules.required, rules.timeOrder]"
                  />
                </v-col>
              </v-row>

              <!-- DEPÓSITO -->
              <v-text-field
                v-model.number="formDepositPct"
                label="% de sinal"
                type="number"
                min="0"
                max="100"
                suffix="%"
                density="comfortable"
                class="mb-3"
                :rules="[rules.percent]"
              />

              <v-textarea
                v-model="formNotes"
                label="Observações"
                rows="2"
                auto-grow
                density="comfortable"
                class="mb-3"
              />

              <v-btn
                type="submit"
                block
                color="primary"
                :loading="savingReservation"
                :disabled="!formSpaceId || !formCustomerId"
              >
                Reservar
              </v-btn>

            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- LISTA -->
      <v-col cols="12" md="7">
        <v-card elevation="2">

          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-subtitle-1 font-weight-medium">
              Reservas cadastradas
            </span>

            <v-text-field
              v-model="filterDate"
              type="date"
              label="Filtrar por entrada"
              density="compact"
              hide-details
              style="max-width: 160px"
              :disabled="!formSpaceId"
            />
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-0">

            <v-data-table
              :items="reservations"
              :loading="loadingReservations"
              item-key="id"
              density="compact"
              :headers="[
                { title: 'Entrada', key: 'check_in_date' },
                { title: 'Saída', key: 'check_out_date' },
                { title: 'Início', key: 'start_time' },
                { title: 'Fim', key: 'end_time' },
                { title: 'Cliente', key: 'customer_id' },
                { title: 'Total (R$)', key: 'total_amount' },
                { title: 'Status', key: 'status' },
              ]"
            >
              <template #item.check_in_date="{ value }">
                {{ formatDate(value) }}
              </template>

              <template #item.check_out_date="{ value }">
                {{ formatDate(value) }}
              </template>

              <template #item.start_time="{ value }">
                {{ formatTime(value) }}
              </template>

              <template #item.end_time="{ value }">
                {{ formatTime(value) }}
              </template>

              <template #item.customer_id="{ value }">
                {{ customerName(value) }}
              </template>

              <template #item.total_amount="{ value }">
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
                  <div v-if="!formSpaceId">
                    Selecione um espaço primeiro.
                  </div>
                  <div v-else>
                    Nenhuma reserva encontrada.
                  </div>
                </div>
              </template>
            </v-data-table>

          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

  </v-container>
</template>
