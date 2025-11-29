<template>
  <v-container>
    <v-row class="mb-4" align="center">
      <v-col cols="12" md="6">
        <h2>Espaços</h2>
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="filter.branchId"
          :items="branchOptions"
          label="Filtrar por filial"
          density="compact"
          variant="outlined"
          item-title="name"
          item-value="id"
          clearable
          @update:model-value="fetchSpaces"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-subtitle-1">Novo espaço</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="createSpace">
              <v-select
                v-model="spaceForm.branchId"
                :items="branchOptions"
                label="Filial"
                item-title="name"
                item-value="id"
                required
                density="comfortable"
                variant="outlined"
              />
              <v-text-field
                v-model="spaceForm.name"
                label="Nome do espaço"
                required
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="spaceForm.capacity"
                label="Capacidade (pessoas)"
                type="number"
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="spaceForm.pricePerDay"
                label="Preço por dia (R$)"
                type="number"
                step="0.01"
                variant="outlined"
                density="comfortable"
              />
              <v-textarea
                v-model="spaceForm.description"
                label="Descrição"
                rows="2"
                variant="outlined"
                density="comfortable"
              />
              <v-btn type="submit" color="primary" class="mt-2">
                Salvar
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="text-subtitle-1 d-flex align-center">
            Espaços cadastrados
            <v-spacer />
            <v-btn icon="refresh" variant="text" @click="fetchSpaces" />
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="spaces"
            density="compact"
            item-key="id"
          >
            <template #item.branch="{ item }">
              {{ branchName(item.raw.branch_id) }}
            </template>
            <template #item.price="{ item }">
              R$ {{ formatMoney(item.raw.pricePerDay ?? item.raw.price_per_day) }}
            </template>
            <template #no-data>
              <v-alert type="info" border="start" variant="tonal">
                Nenhum espaço encontrado.
              </v-alert>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { http } from '@/services/http';
import type { Branch, Space } from '@/types';

const branches = ref<Branch[]>([]);
const spaces = ref<Space[]>([]);

const filter = ref<{ branchId: string | null }>({ branchId: null });

const spaceForm = ref({
  branchId: '',
  name: '',
  capacity: null as number | null,
  pricePerDay: null as number | null,
  description: ''
});

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Filial', key: 'branch' },
  { title: 'Capacidade', key: 'capacity' },
  { title: 'Preço/dia', key: 'price' }
];

const branchOptions = ref<Branch[]>([]);

function branchName(id: string): string {
  const b = branches.value.find((br) => br.id === id);
  return b ? b.name : '-';
}

function formatMoney(value?: number): string {
  if (value == null || Number.isNaN(Number(value))) return '0,00';
  return Number(value).toFixed(2).replace('.', ',');
}

async function fetchBranches() {
  const { data } = await http.get<Branch[]>('/branches');
  branches.value = data;
  branchOptions.value = data;
}

async function fetchSpaces() {
  try {
    const params: Record<string, string> = {};
    if (filter.value.branchId) params.branchId = filter.value.branchId;
    const { data } = await http.get<Space[]>('/spaces', { params });
    spaces.value = data;
  } catch (err) {
    console.error('fetchSpaces', err);
  }
}

async function createSpace() {
  if (!spaceForm.value.branchId || !spaceForm.value.name.trim()) return;

  try {
    await http.post('/spaces', {
      branchId: spaceForm.value.branchId,
      name: spaceForm.value.name.trim(),
      capacity: spaceForm.value.capacity,
      pricePerDay: spaceForm.value.pricePerDay,
      description: spaceForm.value.description || null
    });
    spaceForm.value = {
      branchId: '',
      name: '',
      capacity: null,
      pricePerDay: null,
      description: ''
    };
    await fetchSpaces();
  } catch (err) {
    console.error('createSpace', err);
  }
}

onMounted(async () => {
  await fetchBranches();
  await fetchSpaces();
});
</script>
