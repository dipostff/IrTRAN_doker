<script setup>
import { onMounted, ref, computed } from 'vue';
import axios from 'axios';
import { getToken } from '@/helpers/keycloak';

const loading = ref(false);
const error = ref('');
const users = ref([]);
const searchEmail = ref('');

const profileLoading = ref(false);
const profileError = ref('');
const profileRequests = ref([]);
const profileStatusFilter = ref('pending');

const filteredUsers = computed(() => {
  const q = searchEmail.value.toLowerCase().trim();
  if (!q) return users.value;
  return users.value.filter((u) => {
    const haystack = [
      u.email || '',
      u.username || '',
      (u.firstName || '') + ' ' + (u.lastName || '')
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

async function loadUsers() {
  try {
    loading.value = true;
    error.value = '';
    const token = getToken();
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/users`,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      }
    );
    users.value = response.data || [];
  } catch (e) {
    console.error('Error loading admin users:', e);
    error.value = 'Не удалось загрузить список пользователей.';
  } finally {
    loading.value = false;
  }
}

async function updateRoles(user, addRoles, removeRoles) {
  try {
    const token = getToken();
    await axios.post(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/users/${user.id}/roles`,
      {
        add: addRoles,
        remove: removeRoles
      },
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      }
    );
    await loadUsers();
  } catch (e) {
    console.error('Error updating user roles:', e);
    error.value = 'Не удалось обновить роли пользователя.';
  }
}

function makeStudent(user) {
  const add = user.roles.includes('student') ? [] : ['student'];
  const remove = user.roles.includes('teacher') ? ['teacher'] : [];
  updateRoles(user, add, remove);
}

function makeTeacher(user) {
  const add = [];
  if (!user.roles.includes('student')) add.push('student');
  if (!user.roles.includes('teacher')) add.push('teacher');
  updateRoles(user, add, []);
}

function toggleDictionaryAdmin(user) {
  const hasRole = user.roles.includes('dictionary-admin');
  const add = hasRole ? [] : ['dictionary-admin'];
  const remove = hasRole ? ['dictionary-admin'] : [];
  updateRoles(user, add, remove);
}

async function loadProfileRequests() {
  try {
    profileLoading.value = true;
    profileError.value = '';
    const token = getToken();
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/student-profile-requests`,
      {
        params: { status: profileStatusFilter.value },
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      }
    );
    profileRequests.value = response.data || [];
  } catch (e) {
    console.error(e);
    profileError.value = 'Не удалось загрузить заявки студентов.';
  } finally {
    profileLoading.value = false;
  }
}

async function approveProfileRequest(row) {
  try {
    const token = getToken();
    await axios.post(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/student-profile-requests/${row.id}/approve`,
      {},
      { headers: { Authorization: token ? `Bearer ${token}` : '' } }
    );
    await loadProfileRequests();
  } catch (e) {
    console.error(e);
    profileError.value = 'Не удалось одобрить заявку.';
  }
}

async function rejectProfileRequest(row) {
  const comment = window.prompt('Комментарий для студента (необязательно):') || '';
  try {
    const token = getToken();
    await axios.post(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/student-profile-requests/${row.id}/reject`,
      { comment },
      { headers: { Authorization: token ? `Bearer ${token}` : '' } }
    );
    await loadProfileRequests();
  } catch (e) {
    console.error(e);
    profileError.value = 'Не удалось отклонить заявку.';
  }
}

onMounted(() => {
  loadUsers();
  loadProfileRequests();
});
</script>

<template>
  <div>
    <h4 class="mb-3">Управление пользователями</h4>
    <div class="row mb-3">
      <div class="col-md-6">
        <label class="form-label">Поиск пользователя по email / ФИО / логину</label>
        <input
          v-model="searchEmail"
          type="text"
          class="form-control"
          placeholder="Введите email или часть имени..."
        />
      </div>
    </div>
    <div v-if="loading">Загрузка пользователей...</div>
    <div v-if="error" class="text-danger mb-2">
      {{ error }}
    </div>
    <table v-if="!loading" class="table table-striped align-middle">
      <thead>
        <tr>
          <th>Логин</th>
          <th>Имя</th>
          <th>Email</th>
          <th>Роли</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!filteredUsers.length">
          <td colspan="5" class="text-center">
            Пользователи не найдены.
          </td>
        </tr>
        <tr v-for="user in filteredUsers" :key="user.id">
          <td>{{ user.username }}</td>
          <td>{{ (user.lastName || '') + ' ' + (user.firstName || '') }}</td>
          <td>{{ user.email }}</td>
          <td>
            <span
              v-for="role in user.roles"
              :key="role"
              class="badge bg-secondary me-1"
            >
              {{ role }}
            </span>
          </td>
          <td>
            <button
              type="button"
              class="btn btn-sm btn-outline-primary me-2"
              @click="makeStudent(user)"
            >
              Сделать студентом
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-success"
              @click="makeTeacher(user)"
            >
              Сделать преподавателем
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-warning ms-2"
              @click="toggleDictionaryAdmin(user)"
            >
              {{ user.roles.includes('dictionary-admin') ? 'Убрать роль справочников' : 'Сделать админом справочников' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <hr class="my-5" />

    <h4 class="mb-3">Модерация данных студентов</h4>
    <p class="text-muted small">
      Заявки на изменение дополнительных полей профиля (телефон, отчество, группа, зачётная книжка). После одобрения
      данные записываются в профиль тренажёра.
    </p>
    <div class="row mb-3">
      <div class="col-md-4">
        <label class="form-label">Статус</label>
        <select v-model="profileStatusFilter" class="form-select" @change="loadProfileRequests">
          <option value="pending">На рассмотрении</option>
          <option value="approved">Одобренные</option>
          <option value="rejected">Отклонённые</option>
          <option value="all">Все</option>
        </select>
      </div>
      <div class="col-md-4 d-flex align-items-end">
        <button type="button" class="btn btn-outline-secondary" @click="loadProfileRequests">
          Обновить список
        </button>
      </div>
    </div>
    <div v-if="profileLoading">Загрузка заявок…</div>
    <div v-if="profileError" class="text-danger mb-2">{{ profileError }}</div>
    <table v-if="!profileLoading" class="table table-sm table-striped align-middle">
      <thead>
        <tr>
          <th>ID</th>
          <th>Студент</th>
          <th>Запрошенные данные</th>
          <th>Статус</th>
          <th>Дата</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!profileRequests.length">
          <td colspan="6" class="text-center text-muted">Нет заявок.</td>
        </tr>
        <tr v-for="r in profileRequests" :key="r.id">
          <td>{{ r.id }}</td>
          <td>
            <div>{{ (r.lastName || '') + ' ' + (r.firstName || '') }}</div>
            <div class="small text-muted">{{ r.email || r.username }}</div>
          </td>
          <td>
            <pre class="small mb-0 bg-light p-2 rounded">{{ JSON.stringify(r.payload, null, 2) }}</pre>
          </td>
          <td>{{ r.status }}</td>
          <td class="small">{{ r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' }}</td>
          <td>
            <template v-if="r.status === 'pending'">
              <button type="button" class="btn btn-sm btn-success me-1" @click="approveProfileRequest(r)">
                Одобрить
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger" @click="rejectProfileRequest(r)">
                Отклонить
              </button>
            </template>
            <span v-else class="text-muted small">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

