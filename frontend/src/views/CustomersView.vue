<template>
  <v-container class="py-8" fluid>

    <!-- CABEÇALHO -->
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <h1 class="text-h4 font-weight-medium mb-1">Clientes</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Cadastre novos clientes e gerencie os existentes.
        </p>
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model="search"
          label="Buscar por nome ou e-mail"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          class="mb-3"
          @keyup.enter="fetchCustomers"
        />
      </v-col>
    </v-row>

    <v-row align="start" dense>
      <!-- NOVO CLIENTE -->
      <v-col cols="12" md="5">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium">
            Novo cliente
          </v-card-title>

          <v-card-text>
            <v-form @submit.prevent="createCustomer">

              <v-text-field
                v-model="customerForm.name"
                label="Nome"
                density="comfortable"
                :rules="[rules.required]"
                clearable
                class="mb-3"
              />

              <v-text-field
                v-model="customerForm.email"
                label="E-mail"
                density="comfortable"
                :rules="[rules.required, rules.email]"
                clearable
                class="mb-3"
              />

              <v-text-field
                v-model="customerForm.phone"
                label="Telefone"
                density="comfortable"
                clearable
                :rules="[rules.phone]"
                class="mb-3"
                @input="onPhoneInputNew"
              />

              <v-text-field
                v-model="customerForm.password"
                :type="showPassword ? 'text' : 'password'"
                label="Senha de acesso"
                density="comfortable"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="toggleShowPassword"
                :rules="[rules.required]"
                clearable
                class="mb-4"
              />

              <v-btn
                type="submit"
                block
                color="primary"
                class="text-none"
              >
                Salvar
              </v-btn>

            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- LISTA -->
      <v-col cols="12" md="7">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1 d-flex align-center">
            Clientes cadastrados
            <v-spacer />
            <v-btn icon="mdi-refresh" variant="text" @click="fetchCustomers" />
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="customers"
            density="compact"
            item-key="id"
          >
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                @click="startEdit(item)"
              />
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                @click="removeCustomer(item)"
              />
            </template>

            <template #no-data>
              <v-alert type="info" border="start" variant="tonal">
                Nenhum cliente encontrado.
              </v-alert>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- DIÁLOGO DE EDIÇÃO -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card v-if="editCustomer">
        <v-card-title class="text-subtitle-1 font-weight-medium">
          Editar cliente
        </v-card-title>

        <v-card-text>
          <v-form @submit.prevent="updateCustomer">

            <v-text-field
              v-model="editCustomer.name"
              label="Nome"
              density="comfortable"
              :rules="[rules.required]"
              clearable
              class="mb-3"
            />

            <v-text-field
              v-model="editCustomer.email"
              label="E-mail"
              density="comfortable"
              :rules="[rules.required, rules.email]"
              clearable
              class="mb-3"
            />

            <v-text-field
              v-model="editCustomer.phone"
              label="Telefone"
              density="comfortable"
              clearable
              class="mb-3"
              :rules="[rules.phone]"
              @input="onPhoneInputEdit"
            />

          </v-form>
        </v-card-text>

        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="closeEdit">Cancelar</v-btn>
          <v-btn color="primary" class="text-none" @click="updateCustomer">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { http } from '@/services/http';
import type { Customer } from '@/types';

const customers = ref<Customer[]>([]);
const search = ref('');

const customerForm = ref({
  name: '',
  email: '',
  phone: '',
  password: ''
});

const editCustomer = ref<Customer | null>(null);
const editDialog = ref(false);

const showPassword = ref(false);

/* -------------------- VALIDACOES -------------------- */
const rules = {
  required: (v: any) => !!v || 'Campo obrigatório',
  email: (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'E-mail inválido',
  phone: (v: string) =>
    !v || v.replace(/\D/g, '').length >= 10 || 'Telefone incompleto'
};

/* -------------------- MÁSCARA DE TELEFONE -------------------- */
function phoneMask(v: string): string {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  if (v.length <= 2) return `(${v}`;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
}

function onPhoneInputNew() {
  customerForm.value.phone = phoneMask(customerForm.value.phone);
}

function onPhoneInputEdit() {
  if (!editCustomer.value) return;
  editCustomer.value.phone = phoneMask(editCustomer.value.phone);
}

/* -------------------- MOSTRAR/OCULTAR SENHA -------------------- */
function toggleShowPassword() {
  showPassword.value = !showPassword.value;
}

/* -------------------- TABELA -------------------- */
const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'E-mail', key: 'email' },
  { title: 'Telefone', key: 'phone' },
  { title: 'Ações', key: 'actions', sortable: false }
];

/* -------------------- API -------------------- */
async function fetchCustomers() {
  const params: Record<string, string> = {};
  if (search.value.trim()) params.search = search.value.trim();
  const { data } = await http.get<Customer[]>('/customers', { params });
  customers.value = data;
}

async function createCustomer() {
  if (
    !customerForm.value.name.trim() ||
    !customerForm.value.email.trim() ||
    !customerForm.value.password.trim()
  ) return;

  await http.post('/customers', {
    name: customerForm.value.name.trim(),
    email: customerForm.value.email.trim(),
    phone: customerForm.value.phone || null,
    password: customerForm.value.password
  });

  customerForm.value = { name: '', email: '', phone: '', password: '' };
  await fetchCustomers();
}

function startEdit(c: Customer) {
  editCustomer.value = { ...c };
  editDialog.value = true;
}

function closeEdit() {
  editDialog.value = false;
  editCustomer.value = null;
}

async function updateCustomer() {
  if (!editCustomer.value) return;

  await http.patch(`/customers/${editCustomer.value.id}`, {
    name: editCustomer.value.name,
    email: editCustomer.value.email,
    phone: editCustomer.value.phone
  });

  closeEdit();
  await fetchCustomers();
}

async function removeCustomer(c: Customer) {
  if (!confirm(`Remover o cliente "${c.name}"?`)) return;
  await http.delete(`/customers/${c.id}`);
  await fetchCustomers();
}

onMounted(fetchCustomers);
</script>
