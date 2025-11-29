<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>Seu Cantinho</v-app-bar-title>

      <v-spacer />

      <v-btn variant="text" to="/branches" router>Filiais</v-btn>
      <v-btn variant="text" to="/reservations" router>Reservas & Pagamentos</v-btn>
    </v-app-bar>

    <v-main>
      <v-container class="py-6">
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>
