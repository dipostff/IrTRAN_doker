<script setup>
import { ref, onMounted, computed } from "vue";
import { isAppAdmin } from "@/helpers/keycloak";
import { getBugReports, getBugReport, createBugReport, updateBugReport } from "@/helpers/API";

const activeTab = ref("report");
const tickets = ref([]);
const loading = ref(false);
const error = ref(null);
const form = ref({
    reporter_name: "",
    module_name: "",
    description: "",
    devtools_error: "",
});
const submitError = ref(null);
const submitSuccess = ref(null);

const moduleOptions = [
    "Заявка на грузоперевозку",
    "Накладная",
    "Акты (ГУ-23, ГУ-22)",
    "Памятка приемосдатчика",
    "Ведомости подачи и уборки",
    "Накопительная ведомость",
    "Загрузка и выгрузка документов",
    "Режим теста",
    "Справочник",
    "Сценарии",
    "Другое",
];

const statusLabels = {
    "отправлено": "Отправлено",
    "на рассмотрении": "На рассмотрении",
    "работаем над ошибкой": "Работаем над ошибкой",
    "ошибка исправлена": "Ошибка исправлена",
};

const statusOptions = [
    { value: "отправлено", label: "Отправлено" },
    { value: "на рассмотрении", label: "На рассмотрении" },
    { value: "работаем над ошибкой", label: "Работаем над ошибкой" },
    { value: "ошибка исправлена", label: "Ошибка исправлена" },
];

const isAdmin = computed(() => isAppAdmin());

const adminDetail = ref(null);
const adminDetailVisible = ref(false);
const adminEdit = ref({ status: "", admin_response: "" });
const adminSaving = ref(false);
const adminSaveError = ref(null);

async function loadTickets() {
    loading.value = true;
    error.value = null;
    try {
        tickets.value = await getBugReports();
    } catch (e) {
        console.error(e);
        error.value = "Не удалось загрузить тикеты.";
    } finally {
        loading.value = false;
    }
}

async function submitReport() {
    submitError.value = null;
    submitSuccess.value = null;
    const { reporter_name, module_name, description, devtools_error } = form.value;
    if (!reporter_name || !reporter_name.trim()) {
        submitError.value = "Укажите имя того, кто нашёл ошибку.";
        return;
    }
    if (!module_name || !module_name.trim()) {
        submitError.value = "Укажите название модуля.";
        return;
    }
    const devtoolsText = devtools_error != null && String(devtools_error).trim() !== ""
        ? String(devtools_error).trim()
        : "ошибки в DevTools нет";
    try {
        await createBugReport({
            reporter_name: reporter_name.trim(),
            module_name: module_name.trim(),
            description: description ? description.trim() : null,
            devtools_error: devtoolsText,
        });
        submitSuccess.value = "Сообщение об ошибке отправлено.";
        form.value = { reporter_name: "", module_name: "", description: "", devtools_error: "" };
        setTimeout(() => { submitSuccess.value = null; }, 4000);
        await loadTickets();
    } catch (e) {
        submitError.value = e.response?.data?.message || "Не удалось отправить.";
    }
}

function formatDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleString("ru-RU");
}

function openAdminDetail(ticket) {
    if (!isAdmin.value) return;
    adminDetail.value = ticket;
    adminEdit.value = { status: ticket.status, admin_response: ticket.admin_response || "" };
    adminSaveError.value = null;
    adminDetailVisible.value = true;
}

function closeAdminDetail() {
    adminDetailVisible.value = false;
    adminDetail.value = null;
}

async function saveAdminTicket() {
    if (!adminDetail.value) return;
    adminSaving.value = true;
    adminSaveError.value = null;
    try {
        await updateBugReport(adminDetail.value.id, {
            status: adminEdit.value.status,
            admin_response: adminEdit.value.admin_response,
        });
        await loadTickets();
        adminDetail.value = { ...adminDetail.value, ...adminEdit.value };
        closeAdminDetail();
    } catch (e) {
        adminSaveError.value = e.response?.data?.message || "Не удалось сохранить.";
    } finally {
        adminSaving.value = false;
    }
}

onMounted(loadTickets);
</script>

<template>
    <div class="report-error-page">
        <ul class="nav nav-tabs mb-3">
            <li class="nav-item">
                <button
                    class="nav-link"
                    :class="{ active: activeTab === 'report' }"
                    type="button"
                    @click="activeTab = 'report'"
                >
                    Сообщить об ошибке
                </button>
            </li>
            <li class="nav-item" v-if="isAdmin">
                <button
                    class="nav-link"
                    :class="{ active: activeTab === 'messages' }"
                    type="button"
                    @click="activeTab = 'messages'; loadTickets()"
                >
                    Сообщения об ошибках
                </button>
            </li>
        </ul>

        <!-- Секция: Сообщить об ошибке -->
        <div v-show="activeTab === 'report'" class="section">
            <div class="card mb-4">
                <div class="card-header" style="background-color: #7DA5F0; color: white;">
                    <h5 class="mb-0">Новое сообщение об ошибке</h5>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <label class="form-label">Имя того, кто нашёл ошибку <span class="text-danger">*</span></label>
                        <input v-model="form.reporter_name" type="text" class="form-control" placeholder="ФИО или псевдоним" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Название модуля, где обнаружена ошибка <span class="text-danger">*</span></label>
                        <select v-model="form.module_name" class="form-select">
                            <option value="">— Выберите модуль —</option>
                            <option v-for="m in moduleOptions" :key="m" :value="m">{{ m }}</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Описание ошибки</label>
                        <textarea v-model="form.description" class="form-control" rows="3" placeholder="Опишите, что произошло"></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Ошибка из DevTools <span class="text-danger">*</span></label>
                        <textarea v-model="form.devtools_error" class="form-control font-monospace small" rows="4" placeholder="Скопируйте текст ошибки из консоли браузера (F12). Если ошибки в DevTools нет — оставьте пустым или напишите: ошибки в DevTools нет"></textarea>
                        <small class="text-muted">Если ошибки в DevTools нет — оставьте пустым или введите: ошибки в DevTools нет</small>
                    </div>
                    <div v-if="submitError" class="alert alert-danger py-2">{{ submitError }}</div>
                    <div v-if="submitSuccess" class="alert alert-success py-2">{{ submitSuccess }}</div>
                    <button type="button" class="btn btn-primary" @click="submitReport">Отправить</button>
                </div>
            </div>

            <h6 class="mb-2">Ваши сообщения об ошибках</h6>
            <div v-if="loading" class="text-muted">Загрузка...</div>
            <div v-else-if="error" class="alert alert-warning">{{ error }}</div>
            <div v-else-if="tickets.length === 0" class="text-muted">Пока нет отправленных сообщений.</div>
            <div v-else class="table-responsive">
                <table class="table table-bordered table-hover">
                    <thead style="background-color: #e9ecef;">
                        <tr>
                            <th>Дата и время</th>
                            <th>Модуль</th>
                            <th>Статус</th>
                            <th>Ответ админа</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="t in tickets" :key="t.id">
                            <td>{{ formatDate(t.created_at) }}</td>
                            <td>{{ t.module_name }}</td>
                            <td>{{ statusLabels[t.status] || t.status }}</td>
                            <td>{{ t.admin_response || '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Секция: Сообщения об ошибках (только админ) -->
        <div v-show="activeTab === 'messages' && isAdmin" class="section">
            <div v-if="loading" class="text-muted">Загрузка...</div>
            <div v-else-if="error" class="alert alert-warning">{{ error }}</div>
            <div v-else class="table-responsive">
                <table class="table table-bordered table-hover">
                    <thead style="background-color: #7DA5F0; color: white;">
                        <tr>
                            <th>ID</th>
                            <th>Дата и время</th>
                            <th>Кто сообщил</th>
                            <th>Модуль</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="t in tickets" :key="t.id" class="clickable" @click="openAdminDetail(t)">
                            <td>{{ t.id }}</td>
                            <td>{{ formatDate(t.created_at) }}</td>
                            <td>{{ t.reporter_name }}</td>
                            <td>{{ t.module_name }}</td>
                            <td>{{ statusLabels[t.status] || t.status }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Модальное окно детального просмотра и редактирования (админ) -->
        <div v-if="adminDetailVisible && adminDetail" class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header" style="background-color: #7DA5F0; color: white;">
                        <h5 class="modal-title">Тикет #{{ adminDetail.id }}</h5>
                        <button type="button" class="btn-close btn-close-white" aria-label="Закрыть" @click="closeAdminDetail"></button>
                    </div>
                    <div class="modal-body">
                        <dl class="row mb-2">
                            <dt class="col-sm-3">Дата и время</dt>
                            <dd class="col-sm-9">{{ formatDate(adminDetail.created_at) }}</dd>
                            <dt class="col-sm-3">Кто сообщил</dt>
                            <dd class="col-sm-9">{{ adminDetail.reporter_name }}</dd>
                            <dt class="col-sm-3">Модуль</dt>
                            <dd class="col-sm-9">{{ adminDetail.module_name }}</dd>
                            <dt class="col-sm-3">Описание ошибки</dt>
                            <dd class="col-sm-9">{{ adminDetail.description || '—' }}</dd>
                            <dt class="col-sm-3">Ошибка из DevTools</dt>
                            <dd class="col-sm-9"><pre class="mb-0 small bg-light p-2 rounded">{{ adminDetail.devtools_error || '—' }}</pre></dd>
                        </dl>
                        <hr />
                        <div class="mb-3">
                            <label class="form-label fw-bold">Статус</label>
                            <select v-model="adminEdit.status" class="form-select">
                                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">Ответ админа</label>
                            <textarea v-model="adminEdit.admin_response" class="form-control" rows="4" placeholder="Ответ пользователю"></textarea>
                        </div>
                        <div v-if="adminSaveError" class="alert alert-danger py-2">{{ adminSaveError }}</div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="closeAdminDetail">Закрыть</button>
                        <button type="button" class="btn btn-primary" :disabled="adminSaving" @click="saveAdminTicket">
                            {{ adminSaving ? 'Сохранение...' : 'Сохранить' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.report-error-page {
    padding: 4rem 2rem 1rem 2rem;
    max-width: 1000px;
    margin: 0 auto;
}
.nav-tabs .nav-link {
    cursor: pointer;
    border: 1px solid #dee2e6;
    border-bottom: none;
    border-radius: 0.25rem 0.25rem 0 0;
}
.nav-tabs .nav-link.active {
    background-color: #7DA5F0;
    color: white;
    border-color: #7DA5F0;
}
.clickable {
    cursor: pointer;
}
.clickable:hover {
    background-color: #f0f4ff;
}
</style>
