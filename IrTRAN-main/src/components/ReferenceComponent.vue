<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { getToken, isAppAdmin, isPureStudentAccount } from '@/helpers/keycloak';
import { postReferenceMaterialView } from '@/helpers/API';

const loading = ref(false);
const items = ref([]);
const total = ref(0);
const query = ref('');
const page = ref(1);
const pageSize = ref(20);

const file = ref(null);
const title = ref('');
const uploadError = ref('');
const searchError = ref('');
const downloadError = ref('');

const isAdmin = ref(false);

onMounted(() => {
  isAdmin.value = isAppAdmin();
  loadData();
});

function onFileChange(event) {
  const target = event.target;
  if (target && target.files && target.files.length > 0) {
    file.value = target.files[0];
  } else {
    file.value = null;
  }
}

async function loadData() {
  try {
    loading.value = true;
    searchError.value = '';

    const token = getToken();
    const params = {
      q: query.value || '',
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value
    };

    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/reference`,
      {
        params,
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      }
    );

    items.value = response.data.items || [];
    total.value = response.data.total || 0;
  } catch (error) {
    console.error('Error loading reference list:', error);
    searchError.value = 'Не удалось загрузить список справочных материалов.';
  } finally {
    loading.value = false;
  }
}

async function uploadReference() {
  try {
    uploadError.value = '';

    if (!title.value.trim()) {
      uploadError.value = 'Укажите название справочного материала.';
      return;
    }

    if (!file.value) {
      uploadError.value = 'Выберите файл для загрузки.';
      return;
    }

    const formData = new FormData();
    formData.append('title', title.value.trim());
    formData.append('file', file.value);

    const token = getToken();

    await axios.post(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/reference`,
      formData,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    // Очистить форму и обновить список
    title.value = '';
    file.value = null;
    const input = document.getElementById('reference-file-input');
    if (input) {
      input.value = '';
    }

    await loadData();
  } catch (error) {
    console.error('Error uploading reference:', error);
    if (
      error.response &&
      error.response.data &&
      error.response.data.message
    ) {
      uploadError.value = error.response.data.message;
    } else {
      uploadError.value = 'Не удалось загрузить справочный материал.';
    }
  }
}

async function downloadItem(item) {
  downloadError.value = '';
  try {
    const token = getToken();
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/reference/${item.id}/download`,
      {
        responseType: 'blob',
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      }
    );

    const blob = new Blob([response.data], { type: item.mime_type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', item.filename || 'document');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    if (isPureStudentAccount()) {
      try {
        await postReferenceMaterialView(item.id);
      } catch (e) {
        console.warn('reference view log:', e);
      }
    }
  } catch (error) {
    console.error('Error downloading reference:', error);
    if (error.response && error.response.status === 410) {
      downloadError.value = 'Файл документа отсутствует на сервере. Обратитесь к администратору для повторной загрузки.';
    } else {
      downloadError.value = (error.response && error.response.data && error.response.data.message) || 'Не удалось скачать документ.';
    }
  }
}
</script>

<template>
  <div class="container mt-4">
    <div class="row mb-4">
      <div class="col-md-8 d-flex align-items-end">
        <div class="w-100">
          <label class="form-label">Поиск по названию и содержимому</label>
          <div class="input-group">
            <input
              v-model="query"
              type="text"
              class="form-control"
              placeholder="Введите текст для поиска..."
            />
            <button class="btn btn-primary" type="button" @click="loadData">
              Найти
            </button>
          </div>
          <div v-if="searchError" class="text-danger mt-1">
            {{ searchError }}
          </div>
          <div v-if="downloadError" class="alert alert-warning mt-2 mb-0">
            {{ downloadError }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="isAdmin" class="row mb-4">
      <div class="col-md-8">
        <h5>Загрузка нового справочного материала (только администратор)</h5>
        <div class="mb-3">
          <label class="form-label">Название материала</label>
          <input
            v-model="title"
            type="text"
            class="form-control"
            placeholder="Например, Инструкция по оформлению заявки"
          />
        </div>
        <div class="mb-3">
          <label class="form-label"
            >Файл (PDF или документ Word: .pdf, .doc, .docx)</label
          >
          <input
            id="reference-file-input"
            type="file"
            class="form-control"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            @change="onFileChange"
          />
        </div>
        <button class="btn btn-success" type="button" @click="uploadReference">
          Загрузить
        </button>
        <div v-if="uploadError" class="text-danger mt-2">
          {{ uploadError }}
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-12">
        <h5>Справочные материалы</h5>
        <div v-if="loading">Загрузка...</div>
        <table v-else class="table table-striped align-middle">
          <thead>
            <tr>
              <th scope="col">Название</th>
              <th scope="col">Тип</th>
              <th scope="col">Размер</th>
              <th scope="col">Дата добавления</th>
              <th scope="col">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!items.length">
              <td colspan="5" class="text-center">
                Нет доступных справочных материалов.
              </td>
            </tr>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.mime_type }}</td>
              <td>
                <span v-if="item.size != null">
                  {{ (item.size / 1024).toFixed(1) }} КБ
                </span>
              </td>
              <td>
                <span v-if="item.created_at">
                  {{ new Date(item.created_at).toLocaleString() }}
                </span>
              </td>
              <td>
                <button
                  class="btn btn-sm btn-outline-primary"
                  type="button"
                  @click="downloadItem(item)"
                >
                  Скачать
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1000px;
}
</style>

