<script setup>
import { onMounted, ref, computed } from 'vue';
import axios from 'axios';
import { getToken } from '@/helpers/keycloak';

const loading = ref(false);
const error = ref('');
const users = ref([]);
const searchEmail = ref('');

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

onMounted(() => {
  loadUsers();
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
  </div>
</template>

