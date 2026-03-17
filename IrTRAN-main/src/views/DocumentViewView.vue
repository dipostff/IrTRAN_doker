<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import HeaderComponent from "../components/HeaderComponent.vue";
import { getDocumentTransportation, getDocumentStudent } from "@/helpers/API";
import { updateTitle } from "@/helpers/headerHelper";

const route = useRoute();
const router = useRouter();
const source = computed(() => route.params.source);
const id = computed(() => route.params.id);
const doc = ref(null);
const loading = ref(true);
const error = ref(null);
const typeLabel = ref("");

async function load() {
    loading.value = true;
    error.value = null;
    doc.value = null;
    try {
        if (source.value === "transportation") {
            doc.value = await getDocumentTransportation(id.value);
            typeLabel.value = "Заявка на грузоперевозку";
        } else {
            const row = await getDocumentStudent(id.value);
            doc.value = row.payload || {};
            typeLabel.value = row.document_type || "Документ";
        }
        updateTitle(`Просмотр: ${typeLabel.value} № ${doc.value?.id || id.value}`);
    } catch (e) {
        console.error(e);
        error.value = e.response?.data?.message || "Документ не найден или доступ запрещён.";
    } finally {
        loading.value = false;
    }
}

function back() {
    router.push({ name: "documents-list" });
}

const isTransportation = computed(() => source.value === "transportation");

const displayFields = computed(() => {
    const d = doc.value;
    if (!d) return [];
    if (isTransportation.value) {
        return [
            ["ID", d.id],
            ["Дата регистрации", d.registration_date],
            ["Период перевозки с", d.transportation_date_from],
            ["Период перевозки по", d.transportation_date_to],
            ["Статус", d.document_status != null ? "Подписан" : "Черновик"],
        ];
    }
    const exclude = ["id", "createdAt", "signed", "backendId"];
    return Object.entries(d)
        .filter(([k]) => !exclude.includes(k))
        .map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v]);
});

onMounted(load);
</script>

<template>
    <HeaderComponent :title="'Просмотр: ' + (typeLabel || 'Документ')" />
    <div class="document-view">
        <div class="toolbar mb-3">
            <button type="button" class="btn btn-custom" @click="back">← К списку документов</button>
        </div>
        <div v-if="loading" class="text-muted">Загрузка...</div>
        <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-else class="card">
            <div class="card-header" style="background-color: #7DA5F0; color: white;">
                <h5 class="mb-0">{{ typeLabel }} № {{ doc?.id || id }}</h5>
            </div>
            <div class="card-body">
                <table class="table table-sm table-bordered">
                    <tbody>
                        <tr v-for="([label, value]) in displayFields" :key="label">
                            <td class="field-label">{{ label }}</td>
                            <td>{{ value != null && value !== '' ? value : '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<style scoped>
.document-view {
    padding: 1rem 2rem;
    max-width: 900px;
    margin: 0 auto;
}
.btn-custom {
    background-color: #7da5f0;
    color: white;
}
.btn-custom:hover {
    background-color: #3e6cb4;
    color: white;
}
.field-label {
    width: 220px;
    font-weight: 500;
    background-color: #f8f9fa;
}
</style>
