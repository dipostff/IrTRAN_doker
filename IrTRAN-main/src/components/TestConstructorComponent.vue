<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { getToken } from '@/helpers/keycloak';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const step = ref(1);
const loading = ref(false);
const bankQuery = ref('');
const bankItems = ref([]);
const bankTotal = ref(0);
const variantMode = ref('single_shuffled');
// Для single_shuffled: { id, text, points }
const selectedItems = ref([]);
// Для per_variant: { label, items: [{ id, text, points }] }
const variants = ref([{ label: 'Вариант 1', items: [] }]);
const activeVariantIndex = ref(0);
const randomCount = ref(5);
const randomWarning = ref('');

const testTitle = ref('');
const testDescription = ref('');
// Порог прохождения (процент правильных ответов от 0 до 100)
const passPercent = ref(60);
// Максимальное число попыток (0 или пусто = без ограничения)
const maxAttempts = ref(0);
const createError = ref('');
const creating = ref(false);

function getAuthHeaders() {
  const token = getToken();
  return { Authorization: token ? `Bearer ${token}` : '' };
}

async function loadBank() {
  try {
    loading.value = true;
    const res = await axios.get(`${apiBase}/api/questions`, {
      params: { q: bankQuery.value || '', limit: 200, offset: 0 },
      headers: getAuthHeaders()
    });
    bankItems.value = res.data.items || [];
    bankTotal.value = res.data.total || 0;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadBank();
});

function isSelected(id) {
  if (variantMode.value === 'single_shuffled') {
    return selectedItems.value.some((x) => x.id === id);
  }
  const active = variants.value[activeVariantIndex.value];
  return active ? active.items.some((x) => x.id === id) : false;
}

function addQuestion(q) {
  if (variantMode.value === 'single_shuffled') {
    if (isSelected(q.id)) return;
    selectedItems.value = [
      ...selectedItems.value,
      { id: q.id, text: (q.text || '').slice(0, 120), points: 1 }
    ];
    return;
  }
  const v = variants.value[activeVariantIndex.value];
  if (!v || v.items.some((x) => x.id === q.id)) return;
  v.items = [
    ...v.items,
    { id: q.id, text: (q.text || '').slice(0, 120), points: 1 }
  ];
  variants.value = [...variants.value];
}

function addRandom() {
  const n = Math.max(1, parseInt(randomCount.value, 10) || 1);
  randomWarning.value = '';
  axios
    .get(`${apiBase}/api/questions/random?count=${n}`, { headers: getAuthHeaders() })
    .then(async (res) => {
      const ids = res.data.ids || [];
      const total = res.data.total || 0;
      if (ids.length === 0) {
        randomWarning.value = 'В банке нет вопросов. Добавьте вопросы в банк заданий.';
        return;
      }
      if (total < n) {
        randomWarning.value = `В банке только ${total} вопросов. Добавлено ${ids.length}.`;
      }
      const allRes = await axios.get(`${apiBase}/api/questions`, {
        params: { limit: 500, offset: 0 },
        headers: getAuthHeaders()
      });
      const idToText = {};
      (allRes.data.items || []).forEach((q) => {
        idToText[q.id] = (q.text || '').slice(0, 120);
      });
      const addToSingle = (id, text) => {
        selectedItems.value = [...selectedItems.value, { id, text, points: 1 }];
      };
      const addToVariant = (id, text) => {
        const v = variants.value[activeVariantIndex.value];
        if (v && !v.items.some((x) => x.id === id)) {
          v.items = [...v.items, { id, text, points: 1 }];
          variants.value = [...variants.value];
        }
      };
      ids.forEach((id) => {
        const text = idToText[id] || `Вопрос #${id}`;
        if (variantMode.value === 'single_shuffled') {
          if (selectedItems.value.some((x) => x.id === id)) return;
          addToSingle(id, text);
        } else {
          addToVariant(id, text);
        }
      });
    })
    .catch((e) => {
      console.error(e);
      randomWarning.value = 'Не удалось получить случайные вопросы.';
    });
}

function removeSelected(id) {
  selectedItems.value = selectedItems.value.filter((x) => x.id !== id);
}

function removeFromVariant(variantIndex, id) {
  const v = variants.value[variantIndex];
  if (v) {
    v.items = v.items.filter((x) => x.id !== id);
    variants.value = [...variants.value];
  }
}

function addVariant() {
  variants.value = [
    ...variants.value,
    { label: `Вариант ${variants.value.length + 1}`, items: [] }
  ];
  activeVariantIndex.value = variants.value.length - 1;
}

function removeVariant(index) {
  if (variants.value.length <= 1) return;
  variants.value = variants.value.filter((_, i) => i !== index);
  if (activeVariantIndex.value >= variants.value.length) {
    activeVariantIndex.value = Math.max(0, variants.value.length - 1);
  }
}

function goStep2() {
  if (variantMode.value === 'single_shuffled') {
    if (selectedItems.value.length === 0) return;
  } else {
    if (variants.value.length === 0 || variants.value.some((v) => v.items.length === 0)) {
      randomWarning.value = 'Добавьте хотя бы один вариант и хотя бы один вопрос в каждый вариант.';
      return;
    }
    randomWarning.value = '';
  }
  step.value = 2;
  if (!testTitle.value) testTitle.value = 'Новый тест';
  if (!testDescription.value) testDescription.value = '';
}

function goStep1() {
  step.value = 1;
}

function goStep3() {
  if (!testTitle.value.trim()) return;
  step.value = 3;
}

function createTest() {
  createError.value = '';
  creating.value = true;
  const payload =
    variantMode.value === 'single_shuffled'
      ? {
          title: testTitle.value.trim(),
          description: testDescription.value.trim(),
          variantMode: 'single_shuffled',
          // Для каждого вопроса задаём количество баллов
          questions: selectedItems.value.map((x) => ({
            id: x.id,
            points: Number.isFinite(x.points) && x.points > 0 ? x.points : 1
          })),
          passPercent: Number.isFinite(passPercent.value)
            ? Math.max(0, Math.min(100, Number(passPercent.value)))
            : null,
          maxAttempts:
            Number.isFinite(maxAttempts.value) && maxAttempts.value > 0
              ? Math.floor(maxAttempts.value)
              : null
        }
      : {
          title: testTitle.value.trim(),
          description: testDescription.value.trim(),
          variantMode: 'per_variant',
          variants: variants.value.map((v) => ({
            label: v.label.trim() || `Вариант`,
            questions: v.items.map((x) => ({
              id: x.id,
              points: Number.isFinite(x.points) && x.points > 0 ? x.points : 1
            }))
          })),
          passPercent: Number.isFinite(passPercent.value)
            ? Math.max(0, Math.min(100, Number(passPercent.value)))
            : null,
          maxAttempts:
            Number.isFinite(maxAttempts.value) && maxAttempts.value > 0
              ? Math.floor(maxAttempts.value)
              : null
        };
  axios
    .post(`${apiBase}/api/tests`, payload, { headers: getAuthHeaders() })
    .then(() => {
      step.value = 1;
      selectedItems.value = [];
      variants.value = [{ label: 'Вариант 1', items: [] }];
      activeVariantIndex.value = 0;
      testTitle.value = '';
      testDescription.value = '';
      creating.value = false;
      loadBank();
    })
    .catch((e) => {
      creating.value = false;
      createError.value = (e.response && e.response.data && e.response.data.message) || 'Не удалось создать тест.';
    });
}

function changeTest() {
  step.value = 2;
}

function cancelCreate() {
  step.value = 1;
  selectedItems.value = [];
  variants.value = [{ label: 'Вариант 1', items: [] }];
  activeVariantIndex.value = 0;
  testTitle.value = '';
  testDescription.value = '';
  createError.value = '';
}
</script>

<template>
  <div class="container mt-4">
    <h5 class="mb-3">Конструктор тестов</h5>
    <p class="text-muted small">Выберите вопросы из банка заданий вручную или укажите количество — нужное число вопросов будет выбрано случайно. Затем задайте название теста и создайте его после проверки.</p>

    <!-- Шаг 1: выбор вопросов -->
    <div v-if="step === 1" class="card p-4">
      <h6>Шаг 1. Режим теста и выбор вопросов</h6>
      <div class="mb-4">
        <label class="form-label">Режим теста</label>
        <div class="d-flex gap-4">
          <label class="form-check">
            <input v-model="variantMode" type="radio" value="single_shuffled" class="form-check-input" />
            <span class="form-check-label">Один вариант (вопросы в случайном порядке)</span>
          </label>
          <label class="form-check">
            <input v-model="variantMode" type="radio" value="per_variant" class="form-check-input" />
            <span class="form-check-label">Несколько вариантов (разные наборы вопросов)</span>
          </label>
        </div>
      </div>

      <template v-if="variantMode === 'per_variant'">
        <div class="mb-3">
          <label class="form-label">Добавить вопросы в вариант</label>
          <select v-model.number="activeVariantIndex" class="form-select form-select-sm w-auto d-inline-block">
            <option v-for="(v, idx) in variants" :key="idx" :value="idx">{{ v.label || 'Вариант ' + (idx + 1) }}</option>
          </select>
        </div>
        <div class="mb-3">
          <div v-for="(v, vIdx) in variants" :key="vIdx" class="border rounded p-3 mb-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <input v-model="v.label" type="text" class="form-control form-control-sm w-auto d-inline-block" :placeholder="'Вариант ' + (vIdx + 1)" />
              <button class="btn btn-sm btn-outline-danger" type="button" :disabled="variants.length <= 1" @click="removeVariant(vIdx)">Удалить вариант</button>
            </div>
            <ul class="list-group list-group-flush">
              <li v-for="item in v.items" :key="item.id" class="list-group-item d-flex justify-content-between align-items-center py-1">
                <span>{{ item.text }}{{ item.text && item.text.length >= 120 ? '…' : '' }}</span>
                <button class="btn btn-sm btn-outline-danger" type="button" @click="removeFromVariant(vIdx, item.id)">Удалить</button>
              </li>
            </ul>
            <p v-if="v.items.length === 0" class="text-muted small mb-0 mt-1">Вопросов в этом варианте: 0</p>
          </div>
          <button class="btn btn-sm btn-outline-primary" type="button" @click="addVariant">Добавить вариант</button>
        </div>
      </template>

      <div class="row mb-3">
        <div class="col-md-6">
          <label class="form-label">Поиск по банку</label>
          <div class="input-group">
            <input v-model="bankQuery" type="text" class="form-control" placeholder="Текст или теги" @keyup.enter="loadBank" />
            <button class="btn btn-primary" type="button" @click="loadBank">Найти</button>
          </div>
        </div>
        <div class="col-md-6">
          <label class="form-label">Добавить случайных вопросов</label>
          <div class="input-group">
            <input v-model.number="randomCount" type="number" min="1" max="100" class="form-control" />
            <button class="btn btn-outline-primary" type="button" @click="addRandom">Добавить</button>
          </div>
          <span v-if="randomWarning" class="text-warning small d-block">{{ randomWarning }}</span>
        </div>
      </div>

      <p class="small text-muted">
        <template v-if="variantMode === 'single_shuffled'">Выберите вопросы из списка или добавьте случайные. Выбрано: {{ selectedItems.length }}</template>
        <template v-else>Выберите вариант выше и добавляйте в него вопросы из таблицы или случайные.</template>
      </p>

      <div v-if="loading" class="mb-2">Загрузка банка...</div>
      <div v-else class="table-responsive mb-4">
        <table class="table table-sm table-bordered">
          <thead>
            <tr>
              <th>ID</th>
              <th>Текст (начало)</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="q in bankItems" :key="q.id">
              <td>{{ q.id }}</td>
              <td>{{ (q.text || '').slice(0, 100) }}{{ (q.text && q.text.length > 100) ? '…' : '' }}</td>
              <td>
                <button class="btn btn-sm btn-outline-primary" type="button" :disabled="isSelected(q.id)" @click="addQuestion(q)">
                  {{ isSelected(q.id) ? 'Добавлен' : 'Добавить' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selectedItems.length > 0" class="mb-3">
        <strong>Выбранные вопросы ({{ selectedItems.length }}):</strong>
        <ul class="list-group mt-2">
          <li v-for="item in selectedItems" :key="item.id" class="list-group-item d-flex justify-content-between align-items-center">
            <div class="me-3 flex-grow-1">
              {{ item.text }}{{ item.text && item.text.length >= 120 ? '…' : '' }}
            </div>
            <div class="d-flex align-items-center gap-2">
              <div class="input-group input-group-sm" style="width: 120px;">
                <span class="input-group-text">Баллы</span>
                <input v-model.number="item.points" type="number" min="1" class="form-control" />
              </div>
              <button class="btn btn-sm btn-outline-danger" type="button" @click="removeSelected(item.id)">Удалить</button>
            </div>
          </li>
        </ul>
      </div>

      <button
        class="btn btn-primary"
        type="button"
        :disabled="variantMode === 'single_shuffled' ? selectedItems.length === 0 : !variants.length || variants.some(v => !v.items.length)"
        @click="goStep2"
      >
        Далее: название и описание теста
      </button>
    </div>

    <!-- Шаг 2: название и описание -->
    <div v-if="step === 2" class="card p-4">
      <h6>Шаг 2. Название и параметры теста</h6>
      <div class="mb-3">
        <label class="form-label">Название теста *</label>
        <input v-model="testTitle" type="text" class="form-control" placeholder="Например: Тест по накладным" />
      </div>
      <div class="mb-3">
        <label class="form-label">Описание (необязательно)</label>
        <textarea v-model="testDescription" class="form-control" rows="2" placeholder="Краткое описание для студентов"></textarea>
      </div>
      <div class="row mb-3">
        <div class="col-md-6">
          <label class="form-label">Порог прохождения, %</label>
          <input
            v-model.number="passPercent"
            type="number"
            min="0"
            max="100"
            class="form-control"
            placeholder="Например: 60"
          />
          <small class="text-muted">Минимальный процент набранных баллов для зачёта теста.</small>
        </div>
        <div class="col-md-6">
          <label class="form-label">Максимальное количество попыток</label>
          <input
            v-model.number="maxAttempts"
            type="number"
            min="0"
            class="form-control"
            placeholder="0 — без ограничения"
          />
          <small class="text-muted">0 или пусто — не ограничивать количество попыток.</small>
        </div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-secondary" type="button" @click="goStep1">Назад</button>
        <button class="btn btn-primary" type="button" @click="goStep3">Далее: предпросмотр</button>
      </div>
    </div>

    <!-- Шаг 3: предпросмотр и создание -->
    <div v-if="step === 3" class="card p-4">
      <h6>Шаг 3. Предпросмотр теста</h6>
      <p class="text-warning fw-bold">Проверьте тест перед созданием.</p>
      <p><strong>Название:</strong> {{ testTitle }}</p>
      <p><strong>Описание:</strong> {{ testDescription || '—' }}</p>
      <p><strong>Режим:</strong> {{ variantMode === 'single_shuffled' ? 'Один вариант (случайный порядок)' : 'Несколько вариантов' }}</p>
      <p><strong>Порог прохождения:</strong> {{ passPercent != null ? passPercent + '%' : 'не задан' }}</p>
      <p><strong>Максимальное количество попыток:</strong> {{ maxAttempts && maxAttempts > 0 ? maxAttempts : 'не ограничено' }}</p>
      <template v-if="variantMode === 'single_shuffled'">
        <p><strong>Вопросов:</strong> {{ selectedItems.length }}</p>
        <ol class="list-group list-group-numbered">
          <li v-for="(item, idx) in selectedItems" :key="item.id" class="list-group-item">
            {{ item.text }}{{ item.text && item.text.length >= 120 ? '…' : '' }} <span class="badge bg-secondary ms-2">Баллы: {{ item.points ?? 1 }}</span>
          </li>
        </ol>
      </template>
      <template v-else>
        <div v-for="(v, vIdx) in variants" :key="vIdx" class="mb-4">
          <p><strong>{{ v.label || 'Вариант ' + (vIdx + 1) }}</strong> — вопросов: {{ v.items.length }}</p>
          <ol class="list-group list-group-numbered">
            <li v-for="(item, idx) in v.items" :key="item.id" class="list-group-item">
              {{ item.text }}{{ item.text && item.text.length >= 120 ? '…' : '' }} <span class="badge bg-secondary ms-2">Баллы: {{ item.points ?? 1 }}</span>
            </li>
          </ol>
        </div>
      </template>

      <div v-if="createError" class="alert alert-danger mt-3">{{ createError }}</div>

      <div class="d-flex gap-2 mt-4">
        <button class="btn btn-success" type="button" :disabled="creating" @click="createTest">
          {{ creating ? 'Создание…' : 'Создать тест' }}
        </button>
        <button class="btn btn-primary" type="button" @click="changeTest">Изменить тест</button>
        <button class="btn btn-secondary" type="button" @click="cancelCreate">Отменить создание теста</button>
      </div>
    </div>
  </div>
</template>
