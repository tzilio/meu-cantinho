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
          append-inner-icon="search"
          @keyup.enter="fetchUsers"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-subtitle-1">Novo cliente</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="createUser">
              <v-text-field
                v-model="userForm.name"
                label="Nome"
                required
                variant="outlined"
              />
              <v-text-field
                v-model="userForm.email"
                label="E-mail"
                required
                variant="outlined"
              />
              <v-text-field
                v-model="userForm.phone"
                label="Telefone"
                variant="outlined"
              />
              <v-btn type="submit" color="primary" class="mt-2">
                Salvar
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <v-card class="mt-4" v-if="editUser">
          <v-card-title class="text-subtitle-1">
            Editar cliente
          </v-card-title>
          <v-card-text>
            <v-form @submit.prevent="updateUser">
              <v-text-field
                v-model="editUser.name"
                label="Nome"
                required
                variant="outlined"
              />
              <v-text-field
                v-model="editUser.email"
                label="E-mail"
                required
                variant="outlined"
              />
              <v-text-field
                v-model="editUser.phone"
                label="Telefone"
                variant="outlined"
              />
              <v-btn type="submit" color="primary" class="mt-2 mr-2">
                Atualizar
              </v-btn>
              <v-btn variant="text" @click="editUser = null">Cancelar</v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="text-subtitle-1 d-flex align-center">
            Clientes cadastrados
            <v-spacer />
            <v-btn icon="refresh" variant="text" @click="fetchUsers" />
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="users"
            density="compact"
            item-key="id"
          >
            <template #item.actions="{ item }">
              <v-btn
                icon="edit"
                size="small"
                variant="text"
                @click="startEdit(item.raw)"
              />
              <v-btn
                icon="delete"
                size="small"
                variant="text"
                color="error"
                @click="removeUser(item.raw)"
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
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { http } from '@/services/http';
import type { User } from '@/types';

const users = ref<User[]>([]);
const search = ref('');

const userForm = ref({
  name: '',
  email: '',
  phone: ''
});

const editUser = ref<User | null>(null);

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'E-mail', key: 'email' },
  { title: 'Telefone', key: 'phone' },
  { title: 'Ações', key: 'actions', sortable: false }
];

async function fetchUsers() {
  const params: Record<string, string> = {};
  if (search.value.trim()) params.q = search.value.trim();
  const { data } = await http.get<User[]>('/users', { params });
  users.value = data;
}

async function createUser() {
  if (!userForm.value.name.trim() || !userForm.value.email.trim()) return;

  await http.post('/users', {
    name: userForm.value.name.trim(),
    email: userForm.value.email.trim(),
    phone: userForm.value.phone || null
  });

  userForm.value = { name: '', email: '', phone: '' };
  await fetchUsers();
}

function startEdit(u: User) {
  editUser.value = { ...u };
}

async function updateUser() {
  if (!editUser.value) return;
  await http.patch(`/users/${editUser.value.id}`, {
    name: editUser.value.name,
    email: editUser.value.email,
    phone: editUser.value.phone
  });
  editUser.value = null;
  await fetchUsers();
}

async function removeUser(u: User) {
  if (!confirm(`Remover o cliente "${u.name}"?`)) return;
  await http.delete(`/users/${u.id}`);
  await fetchUsers();
}

onMounted(fetchUsers);
</script>
