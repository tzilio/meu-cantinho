<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>Seu Cantinho</v-app-bar-title>

      <v-spacer />

      <!-- Filiais + Espaços -->
      <v-btn variant="text" to="/branches" router>
        Filiais & Espaços
      </v-btn>

      <!-- Reservas -->
      <v-btn variant="text" to="/reservations" router>
        Reservas
      </v-btn>

      <!-- Pagamentos -->
      <v-btn variant="text" to="/payments" router>
        Pagamentos
      </v-btn>

      <!-- Usuários / Clientes -->
      <v-btn variant="text" to="/customers" router>
        Clientes
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container class="py-6">
        <!-- Mantém estado das views ao trocar de aba -->
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
</script>
