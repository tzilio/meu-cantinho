<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Branch = { id: string; name: string };
type Space = { id: string; name: string; branch_id: string };
type Reservation = {
  id: string;
  space_name: string;
  branch_name: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  start_at: string;
  end_at: string;
  status: string;
};

const branches = ref<Branch[]>([]);
const spaces = ref<Space[]>([]);
const reservations = ref<Reservation[]>([]);

const loadingReservations = ref(false);
const savingReservation = ref(false);

const formBranchId = ref<string | null>(null);
const formSpaceId = ref<string | null>(null);
const formCustomerName = ref("");
const formEmail = ref("");
const formPhone = ref("");
const formStartAt = ref("");
const formEndAt = ref("");

const filterStartDate = ref("");
const filterEndDate = ref("");

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function statusColor(status: string): string {
  switch (status) {
    case "CONFIRMED":
    case "PAID":
      return "success";
    case "CANCELLED":
      return "error";
    default:
      return "warning";
  }
}

const filteredSpaces = computed(() => {
  if (!formBranchId.value) return [];
  return spaces.value.filter((s) => s.branch_id === formBranchId.value);
});

async function loadBranchesAndSpaces() {
  try {
    const [bRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/branches`),
      fetch(`${API_BASE}/spaces`),
    ]);
    if (bRes.ok) branches.value = await bRes.json();
    if (sRes.ok) spaces.value = await sRes.json();
  } catch (err) {
    console.error("loadBranchesAndSpaces failed:", err);
  }
}

async function loadReservations() {
  loadingReservations.value = true;
  try {
    const params = new URLSearchParams();
    if (filterStartDate.value) params.set("from", filterStartDate.value);
    if (filterEndDate.value) params.set("to", filterEndDate.value);

    const url = params.toString()
      ? `${API_BASE}/reservations?${params.toString()}`
      : `${API_BASE}/reservations`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("failed to load reservations");
    reservations.value = await res.json();
  } catch (err) {
    console.error("loadReservations failed:", err);
    reservations.value = [];
  } finally {
    loadingReservations.value = false;
  }
}

async function createReservation() {
  if (!formBranchId.value || !formSpaceId.value) return;
  if (!formCustomerName.value.trim()) return;
  if (!formStartAt.value || !formEndAt.value) return;

  savingReservation.value = true;
  try {
    const payload = {
      branch_id: formBranchId.value,
      space_id: formSpaceId.value,
      customer_name: formCustomerName.value.trim(),
      email: formEmail.value.trim() || null,
      phone: formPhone.value.trim() || null,
      start_at: formStartAt.value,
      end_at: formEndAt.value,
    };

    const res = await fetch(`${API_BASE}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("failed to create reservation");
    await loadReservations();

    formCustomerName.value = "";
    formEmail.value = "";
    formPhone.value = "";
    formStartAt.value = "";
    formEndAt.value = "";
    formSpaceId.value = null;
  } catch (err) {
    console.error("createReservation failed:", err);
  } finally {
    savingReservation.value = false;
  }
}

onMounted(async () => {
  await loadBranchesAndSpaces();
  await loadReservations();
});
</script>

<template>
  <v-container class="py-8" fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-6">
          <div>
            <h1 class="text-h4 font-weight-medium mb-1">
              Reservas & Pagamentos
            </h1>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Cadastre novas reservas e visualize as reservas existentes no
              período.
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
                :items="filteredSpaces"
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

              <v-text-field
                v-model="formCustomerName"
                label="Nome do cliente"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                required
              />

              <v-text-field
                v-model="formEmail"
                label="E-mail"
                type="email"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
              />

              <v-text-field
                v-model="formPhone"
                label="Telefone"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
              />

              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="formStartAt"
                    label="Início"
                    type="datetime-local"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="formEndAt"
                    label="Fim"
                    type="datetime-local"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
              </v-row>

              <v-btn
                type="submit"
                color="primary"
                block
                class="mt-4 text-none"
                :loading="savingReservation"
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
              Reservas no período
            </div>
            <div class="d-flex ga-2">
              <v-text-field
                v-model="filterStartDate"
                type="date"
                label="Início"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 150px"
              />
              <v-text-field
                v-model="filterEndDate"
                type="date"
                label="Fim"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 150px"
              />
              <v-btn
                color="primary"
                variant="tonal"
                size="small"
                class="text-none"
                @click="loadReservations"
              >
                Atualizar
              </v-btn>
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
                { title: 'Espaço', key: 'space_name' },
                { title: 'Filial', key: 'branch_name' },
                { title: 'Cliente', key: 'customer_name' },
                { title: 'Início', key: 'start_at' },
                { title: 'Fim', key: 'end_at' },
                { title: 'Status', key: 'status' },
              ]"
            >
              <template #item.start_at="{ value }">
                {{ formatDateTime(value) }}
              </template>
              <template #item.end_at="{ value }">
                {{ formatDateTime(value) }}
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
                  Nenhuma reserva encontrada para o período.
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
