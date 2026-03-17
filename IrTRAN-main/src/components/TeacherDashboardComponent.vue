<script setup>
import { onMounted, ref, computed } from 'vue';
import axios from 'axios';
import { getToken } from '@/helpers/keycloak';

const students = ref([]);
const studentsLoading = ref(false);
const studentsError = ref('');
const searchEmail = ref('');

const selectedStudent = ref(null);
const studentProfile = ref(null);
const profileLoading = ref(false);
const profileError = ref('');

const filteredStudents = computed(() => {
  const q = searchEmail.value.toLowerCase().trim();
  if (!q) return students.value;
  return students.value.filter((s) => {
    const haystack = [
      s.email || '',
      s.username || '',
      (s.firstName || '') + ' ' + (s.lastName || '')
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

async function loadStudents() {
  try {
    studentsLoading.value = true;
    studentsError.value = '';
    const token = getToken();
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await axios.get(`${baseUrl}/api/teacher/students`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    });
    students.value = response.data || [];
  } catch (e) {
    console.error('Error loading students:', e);
    studentsError.value = 'Не удалось загрузить список студентов.';
  } finally {
    studentsLoading.value = false;
  }
}

async function loadStudentProfile(student) {
  try {
    selectedStudent.value = student;
    studentProfile.value = null;
    profileError.value = '';
    profileLoading.value = true;

    const token = getToken();
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await axios.get(
      `${baseUrl}/api/teacher/students/${student.id}/profile`,
      {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      }
    );
    studentProfile.value = response.data || null;
  } catch (e) {
    console.error('Error loading student profile:', e);
    profileError.value = 'Не удалось загрузить профиль студента.';
  } finally {
    profileLoading.value = false;
  }
}

onMounted(() => {
  loadStudents();
});
</script>

<template>
  <div>
    <h4 class="mb-3">Панель преподавателя</h4>

    <!-- Список студентов -->
    <div class="mb-4">
      <h5>Студенты</h5>
      <div class="row mb-3">
        <div class="col-md-6">
          <label class="form-label">Поиск по email / ФИО / логину</label>
          <input
            v-model="searchEmail"
            type="text"
            class="form-control"
            placeholder="Введите email или часть имени..."
          />
        </div>
      </div>
      <div v-if="studentsLoading">Загрузка студентов...</div>
      <div v-if="studentsError" class="text-danger mb-2">
        {{ studentsError }}
      </div>
      <div class="row">
        <div
          v-for="s in filteredStudents"
          :key="s.id"
          class="col-md-4 mb-3"
        >
          <div class="student-card" @click="loadStudentProfile(s)">
            <div class="student-avatar">
              <img
                src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
                alt="Студент"
              />
            </div>
            <div class="student-info">
              <div class="student-name">
                {{ (s.lastName || '') + ' ' + (s.firstName || '') || s.username }}
              </div>
              <div class="student-email">
                {{ s.email }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Профиль выбранного студента -->
    <div v-if="selectedStudent" class="mb-4">
      <h5>Профиль студента</h5>
      <div v-if="profileLoading">Загрузка профиля...</div>
      <div v-if="profileError" class="text-danger mb-2">
        {{ profileError }}
      </div>
      <div v-if="studentProfile">
        <div class="d-flex align-items-center mb-3">
          <div class="student-avatar-lg me-3">
            <img
              src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
              alt="Студент"
            />
          </div>
          <div>
            <div class="fw-bold">
              {{ (studentProfile.user.lastName || '') + ' ' + (studentProfile.user.firstName || '') || studentProfile.user.username }}
            </div>
            <div>{{ studentProfile.user.email }}</div>
          </div>
        </div>

        <h6>Тесты</h6>
        <table class="table table-striped align-middle mb-4">
          <thead>
            <tr>
              <th>Тест</th>
              <th>Статус</th>
              <th>Попыток</th>
              <th>Правильных</th>
              <th>Неправильных</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in studentProfile.tests"
              :key="t.testId"
            >
              <td>{{ t.title }}</td>
              <td>
                <span
                  v-if="t.passed"
                  class="badge bg-success"
                >Прошел</span>
                <span
                  v-else
                  class="badge bg-secondary"
                >Не проходил</span>
              </td>
              <td>{{ t.attemptsCount }}</td>
              <td>{{ t.bestCorrectAnswers }}</td>
              <td>{{ t.bestWrongAnswers }}</td>
              <td>{{ (Number(t.bestPercent) || 0).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>

        <h6>Сценарии</h6>
        <table class="table table-striped align-middle">
          <thead>
            <tr>
              <th>Сценарий</th>
              <th>Статус</th>
              <th>Первый просмотр</th>
              <th>Последний просмотр</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="sc in studentProfile.scenarios"
              :key="sc.scenarioId"
            >
              <td>{{ sc.title }}</td>
              <td>
                <span
                  v-if="sc.viewed"
                  class="badge bg-success"
                >Ознакомился</span>
                <span
                  v-else
                  class="badge bg-secondary"
                >Не ознакомился</span>
              </td>
              <td>
                <span v-if="sc.firstViewedAt">
                  {{ new Date(sc.firstViewedAt).toLocaleString() }}
                </span>
              </td>
              <td>
                <span v-if="sc.lastViewedAt">
                  {{ new Date(sc.lastViewedAt).toLocaleString() }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

