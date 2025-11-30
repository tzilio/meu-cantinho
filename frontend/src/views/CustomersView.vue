<template>
  <v-container>
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <h2>Clientes</h2>
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="search"
          label="Buscar por nome ou e-mail"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          @keyup.enter="fetchCustomers"
        />
      </v-col>
    </v-row>

    <v-row>
      <!-- Novo cliente -->
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-subtitle-1">Novo cliente</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="createCustomer">
              <v-text-field
                v-model="customerForm.name"
                label="Nome"
                required
                variant="outlined"
              />
              <v-text-field
                v-model="customerForm.email"
                label="E-mail"
                required
                variant="outlined"
              />
              <v-text-field
                v-model="customerForm.phone"
                label="Telefone"
                variant="outlined"
              />
              <v-text-field
                v-model="customerForm.password"
                label="Senha (para acesso do cliente)"
                type="password"
                required
                variant="outlined"
              />
              <v-btn type="submit" color="primary" class="mt-2">
                Salvar
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Lista de clientes -->
      <v-col cols="12" md="7">
        <v-card>
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
              <!-- aqui item já é um Customer -->
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                @click="startEdit(item as Customer)"
              />
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                @click="removeCustomer(item as Customer)"
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

    <!-- Diálogo de edição de cliente -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card v-if="editCustomer">
        <v-card-title class="text-subtitle-1">
          Editar cliente
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="updateCustomer">
            <v-text-field
              v-model="editCustomer.name"
              label="Nome"
              required
              variant="outlined"
            />
            <v-text-field
              v-model="editCustomer.email"
              label="E-mail"
              required
              variant="outlined"
            />
            <v-text-field
              v-model="editCustomer.phone"
              label="Telefone"
              variant="outlined"
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="closeEdit">
            Cancelar
          </v-btn>
          <v-btn color="primary" @click="updateCustomer">
            Salvar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { http } from '@/services/http';
import type { Customer } from '@/types';

const customers = ref<Customer[]>([]);
const search = ref('');

// form de novo cliente
const customerForm = ref({
  name: '',
  email: '',
  phone: '',
  password: ''
});

// cliente em edição
const editCustomer = ref<Customer | null>(null);
const editDialog = ref(false);

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'E-mail', key: 'email' },
  { title: 'Telefone', key: 'phone' },
  { title: 'Ações', key: 'actions', sortable: false }
];

async function fetchCustomers() {
  const params: Record<string, string> = {};

  // se seu back usa "q" em vez de "search", é só trocar aqui
  if (search.value.trim()) {
    params.search = search.value.trim();
    // ou: params.q = search.value.trim();
  }

  const { data } = await http.get<Customer[]>('/customers', { params });
  customers.value = data;
}

async function createCustomer() {
  if (
    !customerForm.value.name.trim() ||
    !customerForm.value.email.trim() ||
    !customerForm.value.password.trim()
  ) {
    return;
  }

  await http.post('/customers', {
    name: customerForm.value.name.trim(),
    email: customerForm.value.email.trim(),
    phone: customerForm.value.phone || null,
    // se o backend ainda não espera senha em /customers,
    // remova esse campo ou adapte para a rota de auth/registro
    password: customerForm.value.password
  });

  customerForm.value = { name: '', email: '', phone: '', password: '' };
  await fetchCustomers();
}

function startEdit(c: Customer) {
  editCustomer.value = { ...c }; // cópia, pra não mexer direto no array
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
