<!-- src/views/ReservationsView.vue -->
<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";

const API_BASE = "http://localhost:3000";

/**
 * Tipagens alinhadas com o back
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
  date: string;        // YYYY-MM-DD
  start_time: string;  // HH:MM:SS
  end_time: string;    // HH:MM:SS
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  total_amount: number;
  deposit_pct: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
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

const formBranchId = ref<string | null>(null);
const formSpaceId = ref<string | null>(null);
const formCustomerId = ref<string | null>(null);
const formDate = ref("");
const formStartTime = ref("");
const formEndTime = ref("");
const formTotalAmount = ref<number | null>(null);
const formDepositPct = ref<number | null>(null);
const formNotes = ref("");

const filterDate = ref("");

/**
 * Helpers
 */
function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
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
    case "CONFIRMED":
      return "success";
    case "CANCELLED":
      return "error";
    case "PENDING":
    default:
      return "warning";
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
  try {
    const res = await fetch(`${API_BASE}/branches`);
    if (!res.ok) throw new Error("failed to load branches");
    branches.value = await res.json();
  } catch (err) {
    console.error("loadBranches failed:", err);
    branches.value = [];
  }
}

async function loadCustomers() {
  try {
    const res = await fetch(`${API_BASE}/customers`);
    if (!res.ok) throw new Error("failed to load customers");
    customers.value = await res.json();
  } catch (err) {
    console.error("loadCustomers failed:", err);
    customers.value = [];
  }
}

async function loadSpacesForBranch(branchId: string) {
  loadingSpaces.value = true;
  try {
    const res = await fetch(
      `${API_BASE}/branches/${branchId}/spaces?only_active=true`
    );
    if (!res.ok) throw new Error("failed to load spaces");
    spaces.value = await res.json();
  } catch (err) {
    console.error("loadSpacesForBranch failed:", err);
    spaces.value = [];
  } finally {
    loadingSpaces.value = false;
  }
}

async function loadReservations() {
  if (!formSpaceId.value) {
    reservations.value = [];
    return;
  }

  loadingReservations.value = true;
  try {
    const params = new URLSearchParams();
    if (filterDate.value) params.set("date", filterDate.value);

    const res = await fetch(
      `${API_BASE}/spaces/${formSpaceId.value}/reservations${
        params.toString() ? `?${params.toString()}` : ""
      }`
    );
    if (!res.ok) throw new Error("failed to load reservations");
    reservations.value = await res.json();
  } catch (err) {
    console.error("loadReservations failed:", err);
    reservations.value = [];
  } finally {
    loadingReservations.value = false;
  }
}

/**
 * Criação de reserva
 */
async function createReservation() {
  if (!formBranchId.value || !formSpaceId.value || !formCustomerId.value) return;
  if (!formDate.value || !formStartTime.value || !formEndTime.value) return;
  if (formTotalAmount.value == null || isNaN(formTotalAmount.value)) return;

  savingReservation.value = true;
  try {
    const payload = {
      customer_id: formCustomerId.value,
      date: formDate.value,
      start_time: formStartTime.value,
      end_time: formEndTime.value,
      total_amount: formTotalAmount.value,
      deposit_pct:
        formDepositPct.value != null ? formDepositPct.value : undefined,
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

    if (!res.ok) throw new Error("failed to create reservation");

    await loadReservations();

    formDate.value = "";
    formStartTime.value = "";
    formEndTime.value = "";
    formTotalAmount.value = null;
    formDepositPct.value = null;
    formNotes.value = "";
  } catch (err) {
    console.error("createReservation failed:", err);
  } finally {
    savingReservation.value = false;
  }
}

/**
 * Reações
 */
watch(formBranchId, async (newBranchId) => {
  spaces.value = [];
  formSpaceId.value = null;
  reservations.value = [];

  if (newBranchId) {
    await loadSpacesForBranch(newBranchId);
  }
});

watch(formSpaceId, async () => {
  filterDate.value = "";
  await loadReservations();
});

watch(filterDate, async () => {
  await loadReservations();
});

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
        <div class="d-flex align-center justify-space-between mb-6">
          <div>
            <h1 class="text-h4 font-weight-medium mb-1">
              Reservas
            </h1>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Cadastre novas reservas vinculadas a clientes e visualize as
              reservas de cada espaço.
            </p>
          </div>
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
              <v-select
                v-model="formBranchId"
                :items="branches"
                item-title="name"
                item-value="id"
                label="Filial"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                clearable
                required
              />

              <v-select
                v-model="formSpaceId"
                :items="spacesForSelectedBranch"
                :loading="loadingSpaces"
                item-title="name"
                item-value="id"
                label="Espaço"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                clearable
                :disabled="!formBranchId"
                required
              />

              <v-select
                v-model="formCustomerId"
                :items="customers"
                item-title="name"
                item-value="id"
                label="Cliente"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                clearable
                required
              />

              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="formDate"
                    label="Data"
                    type="date"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    required
                  />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field
                    v-model="formStartTime"
                    label="Início"
                    type="time"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    required
                  />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field
                    v-model="formEndTime"
                    label="Fim"
                    type="time"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    required
                  />
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="formTotalAmount"
                    label="Valor total (R$)"
                    type="number"
                    min="0"
                    step="0.01"
                    prefix="R$"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    required
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="formDepositPct"
                    label="% sinal (opcional)"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    suffix="%"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
              </v-row>

              <v-textarea
                v-model="formNotes"
                label="Observações"
                variant="outlined"
                density="comfortable"
                rows="2"
                auto-grow
                hide-details="auto"
                class="mb-2"
              />

              <v-btn
                type="submit"
                color="primary"
                block
                class="mt-2 text-none"
                :loading="savingReservation"
                :disabled="!formSpaceId || !formCustomerId"
              >
                Reservar
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- LISTA DE RESERVAS -->
      <v-col cols="12" md="7">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="text-subtitle-1 font-weight-medium">
              Reservas do espaço selecionado
            </div>
            <div class="d-flex ga-2">
              <v-text-field
                v-model="filterDate"
                type="date"
                label="Data"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 160px"
                :disabled="!formSpaceId"
              />
            </div>
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-0">
            <v-data-table
              :items="reservations"
              :loading="loadingReservations"
              item-key="id"
              density="compact"
              :headers="[
                { title: 'Data', key: 'date' },
                { title: 'Início', key: 'start_time' },
                { title: 'Fim', key: 'end_time' },
                { title: 'Cliente', key: 'customer_id' },
                { title: 'Total (R$)', key: 'total_amount' },
                { title: 'Status', key: 'status' },
              ]"
            >
              <template #item.date="{ value }">
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
                    Selecione um espaço para visualizar as reservas.
                  </div>
                  <div v-else>
                    Nenhuma reserva encontrada para o filtro atual.
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
