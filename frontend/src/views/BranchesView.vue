<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  created_at?: string | null;
};

type Space = {
  id: string;
  name: string;
  description?: string | null;
  capacity?: number | null;
  daily_price?: number | null;
  image_url?: string | null;
};

type SpaceForm = {
  name: string;
  description: string;
  capacity: number | null;
  daily_price: number | null;
  image_url: string;
};

const defaultSpaceImage =
  "https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=800";

const branches = ref<Branch[]>([]);
const loadingBranches = ref(false);
const savingBranch = ref(false);

const searchText = ref("");

const branchForm = ref({
  name: "",
  address: "",
});

const selectedBranchId = ref<string | null>(null);

const spaces = ref<Space[]>([]);
const loadingSpaces = ref(false);

const spaceDialog = ref(false);
const savingSpace = ref(false);
const editingSpaceId = ref<string | null>(null);

const spaceForm = ref<SpaceForm>({
  name: "",
  description: "",
  capacity: null,
  daily_price: null,
  image_url: "",
});

const branchHeaders = [
  { title: "Nome", key: "name" },
  { title: "Endereço", key: "address", sortable: false },
  { title: "Criada em", key: "created_at" },
  { title: "Ações", key: "actions", sortable: false },
];

const filteredBranches = computed(() => {
  const q = searchText.value.trim().toLowerCase();
  if (!q) return branches.value;
  return branches.value.filter((b) => {
    const name = b.name?.toLowerCase() ?? "";
    const addr = b.address?.toLowerCase() ?? "";
    return name.includes(q) || addr.includes(q);
  });
});

const selectedBranch = computed(() =>
  branches.value.find((b) => b.id === selectedBranchId.value) ?? null
);

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatMoney(value?: number | null): string {
  if (value == null) return "0,00";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function loadBranches() {
  loadingBranches.value = true;
  try {
    const res = await fetch(`${API_BASE}/branches`);
    if (!res.ok) throw new Error("failed to load branches");
    branches.value = await res.json();
  } catch (err) {
    console.error("loadBranches failed:", err);
    branches.value = [];
  } finally {
    loadingBranches.value = false;
  }
}

async function createBranch() {
  if (!branchForm.value.name.trim() || !branchForm.value.address.trim()) {
    return;
  }
  savingBranch.value = true;
  try {
    const res = await fetch(`${API_BASE}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: branchForm.value.name.trim(),
        address: branchForm.value.address.trim(),
      }),
    });
    if (!res.ok) throw new Error("failed to create branch");
    const created: Branch = await res.json();
    branches.value = [created, ...branches.value];
    branchForm.value.name = "";
    branchForm.value.address = "";
  } catch (err) {
    console.error("createBranch failed:", err);
  } finally {
    savingBranch.value = false;
  }
}

async function deleteBranch(id: string) {
  try {
    await fetch(`${API_BASE}/branches/${id}`, { method: "DELETE" });
    branches.value = branches.value.filter((b) => b.id !== id);
    if (selectedBranchId.value === id) {
      selectedBranchId.value = null;
      spaces.value = [];
    }
  } catch (err) {
    console.error("deleteBranch failed:", err);
  }
}

function resetSpaceForm(branchForEdit?: Space | null) {
  if (branchForEdit) {
    editingSpaceId.value = branchForEdit.id;
    spaceForm.value = {
      name: branchForEdit.name ?? "",
      description: branchForEdit.description ?? "",
      capacity: branchForEdit.capacity ?? null,
      daily_price: branchForEdit.daily_price ?? null,
      image_url: branchForEdit.image_url ?? "",
    };
  } else {
    editingSpaceId.value = null;
    spaceForm.value = {
      name: "",
      description: "",
      capacity: null,
      daily_price: null,
      image_url: "",
    };
  }
}

function openSpaceDialog() {
  resetSpaceForm(null);
  spaceDialog.value = true;
}

function editSpace(space: Space) {
  resetSpaceForm(space);
  spaceDialog.value = true;
}

async function loadSpaces() {
  if (!selectedBranchId.value) {
    spaces.value = [];
    return;
  }
  loadingSpaces.value = true;
  try {
    const res = await fetch(
      `${API_BASE}/branches/${selectedBranchId.value}/spaces`
    );
    if (!res.ok) throw new Error("failed to load spaces");
    spaces.value = await res.json();
  } catch (err) {
    console.error("loadSpaces failed:", err);
    spaces.value = [];
  } finally {
    loadingSpaces.value = false;
  }
}

async function saveSpace() {
  if (!selectedBranchId.value) return;
  if (!spaceForm.value.name.trim()) return;

  savingSpace.value = true;
  try {
    const payload = {
      name: spaceForm.value.name.trim(),
      description: spaceForm.value.description.trim(),
      capacity: spaceForm.value.capacity,
      daily_price: spaceForm.value.daily_price,
      image_url: spaceForm.value.image_url.trim() || null,
      branch_id: selectedBranchId.value,
    };

    const isEditing = !!editingSpaceId.value;
    const url = isEditing
      ? `${API_BASE}/spaces/${editingSpaceId.value}`
      : `${API_BASE}/spaces`;
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("failed to save space");

    await loadSpaces();
    spaceDialog.value = false;
  } catch (err) {
    console.error("saveSpace failed:", err);
  } finally {
    savingSpace.value = false;
  }
}

async function deleteSpace(id: string) {
  try {
    await fetch(`${API_BASE}/spaces/${id}`, { method: "DELETE" });
    spaces.value = spaces.value.filter((s) => s.id !== id);
  } catch (err) {
    console.error("deleteSpace failed:", err);
  }
}

function selectBranch(branch: Branch) {
  selectedBranchId.value = branch.id;
  loadSpaces();
}

onMounted(() => {
  loadBranches();
});
</script>

<template>
  <v-container class="py-8" fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-6">
          <div>
            <h1 class="text-h4 font-weight-medium mb-1">Filiais & Espaços</h1>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Cadastre filiais e gerencie os espaços com fotos, capacidade e
              preço para reserva.
            </p>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row align="start" dense>
      <!-- Formulário de nova filial -->
      <v-col cols="12" md="4">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium">
            Nova filial
          </v-card-title>
          <v-card-text>
            <v-form @submit.prevent="createBranch">
              <v-text-field
                v-model="branchForm.name"
                label="Nome"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                required
              />
              <v-textarea
                v-model="branchForm.address"
                label="Endereço completo"
                variant="outlined"
                density="comfortable"
                rows="3"
                auto-grow
                hide-details="auto"
                class="mb-4"
                required
              />
              <v-btn
                type="submit"
                color="primary"
                block
                :loading="savingBranch"
                class="text-none"
              >
                Salvar filial
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Lista de filiais + espaços -->
      <v-col cols="12" md="8">
        <v-card elevation="2" class="mb-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-subtitle-1 font-weight-medium">
              Filiais cadastradas
            </span>

            <v-text-field
              v-model="searchText"
              density="compact"
              variant="outlined"
              placeholder="Buscar por nome ou endereço"
              prepend-inner-icon="mdi-magnify"
              hide-details
              style="max-width: 280px"
            />
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-0">
            <v-data-table
              :headers="branchHeaders"
              :items="filteredBranches"
              :loading="loadingBranches"
              item-key="id"
              density="compact"
              hover
            >
              <template #item.created_at="{ value }">
                <span>{{ formatDate(value) }}</span>
              </template>

              <template #item.actions="{ item }">
                <div class="d-flex ga-1">
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    class="text-none"
                    @click.stop="selectBranch(item.raw as Branch)"
                  >
                    Espaços
                  </v-btn>
                  <v-btn
                    size="small"
                    variant="text"
                    color="error"
                    icon="mdi-delete-outline"
                    @click.stop="deleteBranch((item.raw as Branch).id)"
                  />
                </div>
              </template>

              <template #no-data>
                <div class="text-center text-medium-emphasis py-6">
                  Nenhuma filial cadastrada ainda.
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>

        <!-- Espaços da filial selecionada -->
        <v-card v-if="selectedBranch" elevation="2">
          <v-card-title class="d-flex align-center justify-space-between">
            <div>
              <div class="text-subtitle-1 font-weight-medium">
                Espaços da filial {{ selectedBranch.name }}
              </div>
              <div class="text-caption text-medium-emphasis">
                Cadastre foto, capacidade e valor de diária para cada espaço.
              </div>
            </div>

            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              class="text-none"
              @click="openSpaceDialog"
            >
              Novo espaço
            </v-btn>
          </v-card-title>

          <v-divider />

          <v-card-text>
            <v-row v-if="spaces.length" dense>
              <v-col
                v-for="space in spaces"
                :key="space.id"
                cols="12"
                sm="6"
                md="4"
              >
                <v-card class="h-100">
                  <v-img
                    :src="space.image_url || defaultSpaceImage"
                    height="150"
                    cover
                  >
                    <template #error>
                      <div
                        class="d-flex align-center justify-center fill-height bg-grey-lighten-2"
                      >
                        <span class="text-caption text-medium-emphasis">
                          Sem imagem
                        </span>
                      </div>
                    </template>
                  </v-img>

                  <v-card-title class="text-subtitle-2">
                    {{ space.name }}
                  </v-card-title>
                  <v-card-subtitle class="text-caption">
                    Capacidade:
                    {{ space.capacity ?? "—" }} pessoas
                  </v-card-subtitle>

                  <v-card-text class="pt-1">
                    <div v-if="space.daily_price != null">
                      Diária a partir de
                      <strong>R$ {{ formatMoney(space.daily_price) }}</strong>
                    </div>
                    <div
                      v-if="space.description"
                      class="text-caption text-medium-emphasis mt-1"
                    >
                      {{ space.description }}
                    </div>
                  </v-card-text>

                  <v-card-actions>
                    <v-btn
                      size="small"
                      variant="text"
                      color="primary"
                      class="text-none"
                      @click="editSpace(space)"
                    >
                      Editar
                    </v-btn>
                    <v-spacer />
                    <v-btn
                      size="small"
                      variant="text"
                      color="error"
                      icon="mdi-delete-outline"
                      @click="deleteSpace(space.id)"
                    />
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>

            <div
              v-else-if="!loadingSpaces"
              class="text-center text-medium-emphasis py-6"
            >
              Nenhum espaço cadastrado para esta filial.
            </div>

            <div
              v-else
              class="text-center text-medium-emphasis py-4"
            >
              Carregando espaços...
            </div>
          </v-card-text>
        </v-card>

        <v-alert
          v-else
          type="info"
          variant="tonal"
          class="mt-4"
        >
          Selecione uma filial na tabela acima para visualizar e cadastrar
          espaços.
        </v-alert>
      </v-col>
    </v-row>

    <!-- Diálogo de cadastro/edição de espaço -->
    <v-dialog v-model="spaceDialog" max-width="520">
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-medium">
          {{ editingSpaceId ? "Editar espaço" : "Novo espaço" }}
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveSpace">
            <v-text-field
              v-model="spaceForm.name"
              label="Nome do espaço"
              variant="outlined"
              density="comfortable"
              class="mb-3"
              hide-details="auto"
              required
            />
            <v-textarea
              v-model="spaceForm.description"
              label="Descrição"
              variant="outlined"
              density="comfortable"
              rows="2"
              auto-grow
              hide-details="auto"
              class="mb-3"
            />
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model.number="spaceForm.capacity"
                  type="number"
                  min="0"
                  label="Capacidade (pessoas)"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model.number="spaceForm.daily_price"
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="R$"
                  label="Valor da diária"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="spaceForm.image_url"
              label="URL da foto"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              class="mt-2"
              hint="Cole um link de imagem (JPG, PNG...)"
              persistent-hint
            />
            <v-img
              v-if="spaceForm.image_url"
              :src="spaceForm.image_url"
              height="150"
              cover
              class="mt-3 rounded-lg"
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="spaceDialog = false">
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            class="text-none"
            :loading="savingSpace"
            @click="saveSpace"
          >
            {{ editingSpaceId ? "Salvar alterações" : "Cadastrar" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
