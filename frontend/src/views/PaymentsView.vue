<template>
  <v-container>
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <h2>Pagamentos</h2>
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="searchPaymentId"
          label="Buscar pagamento por ID"
          variant="outlined"
          density="compact"
          append-inner-icon="search"
          @keyup.enter="loadPayment"
        />
      </v-col>
    </v-row>

    <v-row>
      <!-- Criar pagamento -->
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="text-subtitle-1">Novo pagamento</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="createPayment">
              <v-text-field
                v-model="paymentForm.reservationId"
                label="ID da reserva"
                required
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="paymentForm.amount"
                label="Valor (R$)"
                type="number"
                step="0.01"
                required
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model="paymentForm.method"
                label="Forma de pagamento"
                placeholder="PIX, Cartão, Boleto..."
                required
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model="paymentForm.purpose"
                label="Finalidade"
                placeholder="SINAL, SALDO, RESERVATION_DEPOSIT..."
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model="paymentForm.gateway_reference"
                label="Referência do gateway (opcional)"
                variant="outlined"
                density="comfortable"
              />
              <v-btn type="submit" color="primary" class="mt-2">
                Registrar pagamento
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Detalhe do pagamento -->
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title class="text-subtitle-1 d-flex align-center">
            Detalhes do pagamento
            <v-spacer />
            <v-btn
              v-if="selectedPayment"
              icon="refresh"
              variant="text"
              @click="reloadSelected"
            />
          </v-card-title>

          <v-card-text v-if="selectedPayment">
            <v-row>
              <v-col cols="12" md="6">
                <p><strong>ID:</strong> {{ selectedPayment.id }}</p>
                <p>
                  <strong>Reserva:</strong>
                  {{ selectedPayment.reservation_id }}
                </p>
                <p>
                  <strong>Valor:</strong>
                  R$
                  {{ selectedPayment.amount.toFixed(2).replace('.', ',') }}
                </p>
                <p><strong>Método:</strong> {{ selectedPayment.method }}</p>
              </v-col>
              <v-col cols="12" md="6">
                <p><strong>Status:</strong> {{ selectedPayment.status }}</p>
                <p>
                  <strong>Finalidade:</strong>
                  {{ selectedPayment.purpose || '-' }}
                </p>
                <p>
                  <strong>Gateway ref:</strong>
                  {{ selectedPayment.gateway_reference || '-' }}
                </p>
                <p>
                  <strong>Pago em:</strong>
                  {{ formatDateTime(selectedPayment.paid_at) }}
                </p>
              </v-col>
            </v-row>

            <v-divider class="my-3" />

            <v-row>
              <v-col cols="12" md="6">
                <v-btn
                  color="success"
                  :disabled="selectedPayment.status === 'PAID'"
                  @click="confirmSelected"
                >
                  Confirmar pagamento
                </v-btn>
              </v-col>
              <v-col cols="12" md="6" class="text-md-right">
                <v-btn
                  color="error"
                  variant="outlined"
                  @click="deleteSelected"
                >
                  Excluir (se não pago)
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-text v-else>
            <v-alert type="info" border="start" variant="tonal">
              Nenhum pagamento selecionado. Busque por um ID ou crie um novo.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { http } from '@/services/http';
import type { Payment } from '@/types';

const paymentForm = ref({
  reservationId: '',
  amount: null as number | null,
  method: '',
  purpose: '',
  gateway_reference: ''
});

const searchPaymentId = ref('');
const selectedPayment = ref<Payment | null>(null);

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

async function createPayment() {
  if (
    !paymentForm.value.reservationId.trim() ||
    paymentForm.value.amount == null ||
    !paymentForm.value.method.trim()
  ) {
    return;
  }

  const payload = {
    amount: paymentForm.value.amount,
    method: paymentForm.value.method.trim(),
    purpose: paymentForm.value.purpose || undefined,
    gateway_reference: paymentForm.value.gateway_reference || undefined
  };

  const { data } = await http.post<Payment>(
    `/reservations/${paymentForm.value.reservationId}/payments`,
    payload
  );

  selectedPayment.value = data;
  searchPaymentId.value = data.id;

  paymentForm.value = {
    reservationId: '',
    amount: null,
    method: '',
    purpose: '',
    gateway_reference: ''
  };
}

async function loadPayment() {
  if (!searchPaymentId.value.trim()) return;
  const { data } = await http.get<Payment>(
    `/payments/${searchPaymentId.value.trim()}`
  );
  selectedPayment.value = data;
}

async function reloadSelected() {
  if (!selectedPayment.value) return;
  const { data } = await http.get<Payment>(
    `/payments/${selectedPayment.value.id}`
  );
  selectedPayment.value = data;
}

async function confirmSelected() {
  if (!selectedPayment.value) return;

  const { data } = await http.post<Payment>(
    `/payments/${selectedPayment.value.id}/confirm`,
    {
      gateway_reference: selectedPayment.value.gateway_reference || null
    }
  );

  selectedPayment.value = data;
}

async function deleteSelected() {
  if (!selectedPayment.value) return;
  if (!confirm('Deseja excluir este pagamento?')) return;

  await http.delete(`/payments/${selectedPayment.value.id}`);
  selectedPayment.value = null;
  searchPaymentId.value = '';
}
</script>
