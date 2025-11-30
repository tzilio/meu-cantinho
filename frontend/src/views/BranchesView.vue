<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useBranchesStore, type Branch } from "@/stores/branchesStore";

const API_BASE = "http://localhost:3000";

/**
 * Space conforme o novo schema de spaces:
 * id, branch_id, name, description, capacity, price_per_hour, active, cover_url...
 */
type Space = {
  id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  capacity: number;
  price_per_hour: number;
  active?: boolean;
  cover_url?: string | null;
};

type SpaceForm = {
  name: string;
  description: string;
  capacity: number | null;
  price_per_hour: number | null;
  /**
   * Aqui passaremos a URL final da imagem,
   * que será enviada como cover_url pro backend.
   */
  image_url: string;
};

const defaultSpaceImage =
  "https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=800";

// --- STORE GLOBAL DE FILIAIS ---
const {
  branches,
  loadingBranches,
  loadBranches,
  addBranchLocally,
  removeBranchLocally,
} = useBranchesStore();

// --- estado local do componente ---
const savingBranch = ref(false);

const searchText = ref("");

const branchForm = ref({
  name: "",
  state: "",
  city: "",
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
  price_per_hour: null,
  image_url: "",
});

const uploadingSpaceImage = ref(false);
// key pra resetar o v-file-input (limpar arquivo selecionado)
const fileInputKey = ref(0);

const branchHeaders = [
  { title: "Nome", key: "name" },
  { title: "Cidade / UF", key: "cityState", sortable: false },
  { title: "Endereço", key: "address", sortable: false },
  { title: "Criada em", key: "created_at" },
  { title: "Ações", key: "actions", sortable: false },
];

const filteredBranches = computed(() => {
  const q = searchText.value.trim().toLowerCase();
  if (!q) return branches.value;
  return branches.value.filter((b) => {
    const name = b.name?.toLowerCase() ?? "";
    const city = b.city?.toLowerCase() ?? "";
    const state = b.state?.toLowerCase() ?? "";
    const addr = b.address?.toLowerCase() ?? "";
    return (
      name.includes(q) ||
      city.includes(q) ||
      state.includes(q) ||
      addr.includes(q)
    );
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

async function createBranch() {
  if (
    !branchForm.value.name.trim() ||
    !branchForm.value.city.trim() ||
    !branchForm.value.state.trim() ||
    !branchForm.value.address.trim()
  ) {
    return;
  }

  savingBranch.value = true;

  try {
    const payload = {
      name: branchForm.value.name.trim(),
      city: branchForm.value.city.trim(),
      state: branchForm.value.state.trim(),
      address: branchForm.value.address.trim(),
    };

    const res = await fetch(`${API_BASE}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        "createBranch failed:",
        res.status,
        res.statusText,
        text
      );
      throw new Error("failed to create branch");
    }

    // backend retorna a filial criada
    const created = (await res.json()) as Branch;
    addBranchLocally(created);

    branchForm.value = {
      name: "",
      city: "",
      state: "",
      address: "",
    };
  } catch (err) {
    console.error("createBranch failed:", err);
  } finally {
    savingBranch.value = false;
  }
}

async function deleteBranch(id: string) {
  const ok = window.confirm(
    "Tem certeza que deseja excluir esta filial? Essa ação não pode ser desfeita."
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/branches/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      console.error(
        "deleteBranch failed:",
        res.status,
        res.statusText,
        text
      );
      throw new Error("failed to delete branch");
    }

    removeBranchLocally(id);

    if (selectedBranchId.value === id) {
      selectedBranchId.value = null;
      spaces.value = [];
    }
  } catch (err) {
    console.error("deleteBranch failed:", err);
  }
}

function resetSpaceForm(spaceForEdit?: Space | null) {
  if (spaceForEdit) {
    editingSpaceId.value = spaceForEdit.id;
    spaceForm.value = {
      name: spaceForEdit.name ?? "",
      description: spaceForEdit.description ?? "",
      capacity: spaceForEdit.capacity ?? null,
      price_per_hour: spaceForEdit.price_per_hour ?? null,
      image_url: spaceForEdit.cover_url ?? "",
    };
  } else {
    editingSpaceId.value = null;
    spaceForm.value = {
      name: "",
      description: "",
      capacity: null,
      price_per_hour: null,
      image_url: "",
    };
  }
  // sempre que abre o diálogo, resetamos o file input
  fileInputKey.value++;
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
      `${API_BASE}/branches/${selectedBranchId.value}/spaces?only_active=false`
    );
    if (!res.ok) throw new Error("failed to load spaces");
    const data: Space[] = await res.json();
    spaces.value = data;
  } catch (err) {
    console.error("loadSpaces failed:", err);
    spaces.value = [];
  } finally {
    loadingSpaces.value = false;
  }
}

/**
 * Upload da foto de capa:
 * - recebe File ou File[]
 * - envia para POST /space-cover (multipart/form-data)
 * - backend retorna { url: "/uploads/space-covers/arquivo.jpg" }
 * - salvamos a URL completa em spaceForm.image_url
 */
async function handleSpaceImageSelected(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) return;

  uploadingSpaceImage.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/space-cover`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        "handleSpaceImageSelected failed:",
        res.status,
        res.statusText,
        text
      );
      throw new Error("upload_failed");
    }

    const data = (await res.json()) as { url: string };

    // salva URL completa (pra preview e pra mandar pro back)
    spaceForm.value.image_url = `${API_BASE}${data.url}`;
    console.log("Imagem subida, URL final:", spaceForm.value.image_url);
  } catch (err) {
    console.error("handleSpaceImageSelected failed:", err);
  } finally {
    uploadingSpaceImage.value = false;
  }
}

// limpar imagem já selecionada / enviada
function clearSpaceImage() {
  spaceForm.value.image_url = "";
  fileInputKey.value++; // força recriar o v-file-input
}

async function saveSpace() {
  if (!selectedBranchId.value) return;
  if (!spaceForm.value.name.trim()) return;

  if (
    spaceForm.value.capacity == null ||
    spaceForm.value.capacity <= 0
  ) {
    console.warn("Capacidade inválida");
    return;
  }
  if (
    spaceForm.value.price_per_hour == null ||
    spaceForm.value.price_per_hour < 0
  ) {
    console.warn("Preço por hora inválido");
    return;
  }

  savingSpace.value = true;
  try {
    const payload = {
      name: spaceForm.value.name.trim(),
      description: spaceForm.value.description.trim() || null,
      capacity: spaceForm.value.capacity,
      price_per_hour: spaceForm.value.price_per_hour,
      active: true,
      // enviamos a URL da imagem como cover_url para o back
      cover_url: spaceForm.value.image_url || null,
    };

    const isEditing = !!editingSpaceId.value;

    const url = isEditing
      ? `${API_BASE}/spaces/${editingSpaceId.value}` // PATCH /spaces/:spaceId
      : `${API_BASE}/branches/${selectedBranchId.value}/spaces`; // POST /branches/:branchId/spaces

    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        "saveSpace failed:",
        res.status,
        res.statusText,
        text
      );
      throw new Error("failed to save space");
    }

    await loadSpaces();
    spaceDialog.value = false;
  } catch (err) {
    console.error("saveSpace failed:", err);
  } finally {
    savingSpace.value = false;
  }
}

async function deleteSpace(id: string) {
  const ok = window.confirm(
    "Tem certeza que deseja excluir este espaço? Essa ação não pode ser desfeita."
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/spaces/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      console.error(
        "deleteSpace failed:",
        res.status,
        res.statusText,
        text
      );
      throw new Error("failed to delete space");
    }

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
              <v-row dense>
                <v-col cols="12">
                  <v-text-field
                    v-model="branchForm.name"
                    label="Nome da filial"
                    variant="outlined"
                    density="comfortable"
                    class="mb-2"
                    hide-details="auto"
                    required
                  />
                </v-col>
                <v-col cols="8">
                  <v-text-field
                    v-model="branchForm.city"
                    label="Cidade"
                    variant="outlined"
                    density="comfortable"
                    class="mb-2"
                    hide-details="auto"
                    required
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model="branchForm.state"
                    label="UF"
                    maxlength="2"
                    variant="outlined"
                    density="comfortable"
                    class="mb-2"
                    hide-details="auto"
                    required
                  />
                </v-col>
              </v-row>

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
              placeholder="Buscar por nome, cidade, UF ou endereço"
              prepend-inner-icon="mdi-magnify"
              hide-details
              style="max-width: 320px"
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
              <template #item.cityState="{ item }">
                <span>
                  {{ (item as Branch).city }} /
                  {{ (item as Branch).state }}
                </span>
              </template>

              <template #item.created_at="{ value }">
                <span>{{ formatDate(value) }}</span>
              </template>

              <template #item.actions="{ item }">
                <div class="d-flex justify-center ga-1">
                  <v-btn
                    size="small"
                    variant="outlined"
                    color="primary"
                    class="text-none"
                    @click.stop="selectBranch(item as Branch)"
                  >
                    Espaços
                  </v-btn>
                  <v-btn
                    size="small"
                    variant="text"
                    color="error"
                    icon="mdi-delete-outline"
                    @click.stop="deleteBranch((item as Branch).id)"
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
                Cadastre capacidade e preço por hora para cada espaço, além de
                uma foto de capa.
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
                    :src="space.cover_url || defaultSpaceImage"
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
                    <div v-if="space.price_per_hour != null">
                      Valor por hora
                      <strong>
                        R$ {{ formatMoney(space.price_per_hour) }}
                      </strong>
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
                  v-model.number="spaceForm.price_per_hour"
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="R$"
                  label="Preço por hora"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                />
              </v-col>
            </v-row>

            <!-- Upload da foto -->
            <v-file-input
              :key="fileInputKey"
              label="Upload da foto de capa"
              prepend-icon="mdi-image"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              class="mt-2 mb-2"
              accept="image/*"
              show-size
              :loading="uploadingSpaceImage"
              @update:model-value="handleSpaceImageSelected"
            />

            <!-- Preview + botão pra remover -->
            <v-img
              v-if="spaceForm.image_url"
              :src="spaceForm.image_url"
              height="150"
              cover
              class="mt-3 rounded-lg"
              style="position: relative"
            >
              <v-btn
                size="small"
                icon="mdi-close"
                color="error"
                variant="elevated"
                style="position: absolute; top: 4px; right: 4px; min-width: 0"
                @click.stop="clearSpaceImage"
              />
            </v-img>
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
