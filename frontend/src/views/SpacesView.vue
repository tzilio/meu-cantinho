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
      <!-- Formulário de novo espaço -->
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
                @update:model-value="onBranchSelectedInForm"
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
                min="1"
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="spaceForm.pricePerHour"
                label="Preço por hora (R$)"
                type="number"
                step="0.01"
                min="0"
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

      <!-- Tabela de espaços -->
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
              {{ branchName(item.branch_id) }}
            </template>

            <template #item.price_per_hour="{ item }">
              R$ {{ formatMoney(item.price_per_hour) }}
            </template>

            <template #item.active="{ item }">
              <v-chip
                size="small"
                :color="item.active ? 'success' : 'grey'"
                variant="tonal"
              >
                {{ item.active ? 'Ativo' : 'Inativo' }}
              </v-chip>
            </template>

            <template #no-data>
              <v-alert type="info" border="start" variant="tonal">
                <div v-if="!filter.branchId">
                  Selecione uma filial para listar os espaços.
                </div>
                <div v-else>
                  Nenhum espaço encontrado para esta filial.
                </div>
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
  pricePerHour: null as number | null,
  description: ''
});

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Filial', key: 'branch' },
  { title: 'Capacidade', key: 'capacity' },
  { title: 'Preço/hora', key: 'price_per_hour' },
  { title: 'Ativo', key: 'active' }
];

const branchOptions = ref<Branch[]>([]);

function branchName(id: string): string {
  const b = branches.value.find((br) => br.id === id);
  return b ? b.name : '-';
}

function formatMoney(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '0,00';
  return Number(value).toFixed(2).replace('.', ',');
}

async function fetchBranches() {
  const { data } = await http.get<Branch[]>('/branches');
  branches.value = data;
  branchOptions.value = data;
}

/**
 * Carrega espaços da filial selecionada no filtro.
 */
async function fetchSpaces() {
  try {
    if (!filter.value.branchId) {
      spaces.value = [];
      return;
    }

    const { data } = await http.get<Space[]>(
      `/branches/${filter.value.branchId}/spaces`,
      {
        params: { only_active: 'false' }
      }
    );
    spaces.value = data;
  } catch (err) {
    console.error('fetchSpaces', err);
  }
}

/**
 * Quando selecionar a filial no formulário, já sincroniza com o filtro
 * e recarrega a lista de espaços.
 */
function onBranchSelectedInForm(branchId: string | null) {
  spaceForm.value.branchId = branchId ?? '';
  if (branchId) {
    filter.value.branchId = branchId;
    fetchSpaces();
  }
}

async function createSpace() {
  const form = spaceForm.value;

  if (!form.branchId || !form.name.trim()) return;

  // validação mínima pra não quebrar constraint no banco
  if (!form.capacity || form.capacity <= 0) return;
  if (form.pricePerHour == null || form.pricePerHour < 0) return;

  const usedBranchId = form.branchId;

  try {
    await http.post(
      `/branches/${usedBranchId}/spaces`,
      {
        name: form.name.trim(),
        description: form.description || null,
        capacity: form.capacity,
        price_per_hour: form.pricePerHour,
        // active: true // se quiser enviar explicitamente
      }
    );

    // reseta o form
    spaceForm.value = {
      branchId: '',
      name: '',
      capacity: null,
      pricePerHour: null,
      description: ''
    };

    // garante que o filtro está na mesma filial usada no POST
    if (!filter.value.branchId) {
      filter.value.branchId = usedBranchId;
    }

    await fetchSpaces();
  } catch (err) {
    console.error('createSpace', err);
  }
}

onMounted(async () => {
  await fetchBranches();
  // não chama fetchSpaces aqui sem branch selecionada
});
</script>
