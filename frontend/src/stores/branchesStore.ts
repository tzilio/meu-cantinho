// src/stores/branchesStore.ts
import { ref } from "vue";

export type Branch = {
  id: string;
  name: string;
  state: string;
  city: string;
  address: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const API_BASE = "http://localhost:3000";

// estado global (compartilhado entre todas as rotas)
const branches = ref<Branch[]>([]);
const loadingBranches = ref(false);

async function loadBranches() {
  loadingBranches.value = true;
  try {
    const res = await fetch(`${API_BASE}/branches`);
    if (!res.ok) throw new Error("failed to load branches");
    branches.value = await res.json();
  } finally {
    loadingBranches.value = false;
  }
}

function addBranchLocally(branch: Branch) {
  branches.value.push(branch);
}

function removeBranchLocally(id: string) {
  branches.value = branches.value.filter((b) => b.id !== id);
}

export function useBranchesStore() {
  return {
    branches,
    loadingBranches,
    loadBranches,
    addBranchLocally,
    removeBranchLocally,
  };
}
