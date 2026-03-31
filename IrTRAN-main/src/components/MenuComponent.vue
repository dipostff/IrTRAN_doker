<script setup>
import { computed, ref, watch } from 'vue';
import { hasAnyRealmRole, isAppAdmin, isDictionaryAdmin, isStudent } from '@/helpers/keycloak';
import AppID2 from '@/assets/IMAGES/AppID_2.png';
import AppID1 from '@/assets/IMAGES/AppID_1.png';
import AppID19 from '@/assets/IMAGES/AppID_19.png';
import AppID11809 from '@/assets/IMAGES/AppID_11809.png';

const isTeacherOrAdmin = computed(() => hasAnyRealmRole(['teacher', 'app-admin']));
const canSeeAdmin = computed(() => isAppAdmin());
const canSeeDictionary = computed(() => isDictionaryAdmin() || isAppAdmin());

const CATEGORIES = [
  {
    id: 'docs',
    label: 'Документы',
    visible: () => true,
    items: [
      { to: '/transporation/menu', title: 'Заявка на грузоперевозку', icon: AppID2 },
      { to: '/invoice/menu', title: 'Накладная', icon: AppID1 },
      { to: '/act/menu', title: 'Акты', icon: 'https://cdn-icons-png.freepik.com/512/3566/3566009.png' },
      { to: '/reminder/menu', title: 'Памятка приёмосдатчика', icon: 'https://d1xez26aurxsp6.cloudfront.net/models/mkjAgYDBaZG/thumbnails/6361d9e53a2ff.png' },
      { to: '/filling-statement/menu', title: 'Ведомости подачи и уборки', icon: AppID19 },
      { to: '/cumulative-statement/menu', title: 'Накопительная ведомость', icon: AppID11809 },
      { to: '/documents', title: 'Документы пользователя', subtitle: 'загрузка / выгрузка', icon: 'https://cdn-icons-png.flaticon.com/512/3767/3767084.png' }
    ]
  },
  {
    id: 'study',
    label: 'Обучение',
    visible: () => true,
    items: [
      { to: '/beginner-scenario/menu', title: 'Сценарий «Новичок»', icon: 'https://cdn-icons-png.freepik.com/512/2234/2234794.png' },
      { to: '/advanced-scenario/menu', title: 'Сценарий «Продвинутый»', icon: 'https://static.tildacdn.com/tild3632-3336-4232-b165-386337626361/main.png' },
      { to: '/scenarios', title: 'Сценарии', subtitle: 'банк сценариев', icon: 'https://cdn-icons-png.flaticon.com/512/1995/1995515.png' },
      { to: '/reference', title: 'Справочник', subtitle: 'поиск по материалам', icon: 'https://cdn-icons-png.flaticon.com/512/599/599055.png' }
    ]
  },
  {
    id: 'tests',
    label: 'Тестирование',
    visible: () => true,
    items: [
      { to: '/test-mode', title: 'Режим теста', subtitle: 'проходить / создавать', icon: 'https://cdn-icons-png.flaticon.com/512/1508/1508866.png' },
      {
        to: '/student-performance',
        title: 'Успеваемость',
        subtitle: 'профиль, тесты, прогресс',
        icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        visible: () => isStudent()
      }
    ]
  },
  {
    id: 'service',
    label: 'Сервис',
    visible: () => true,
    items: [
      { to: '/notifications', title: 'Уведомления и дедлайны', subtitle: 'события / сроки', icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827370.png' },
      { to: '/report-error', title: 'Сообщить об ошибке', subtitle: 'тикеты / статус', icon: 'https://cdn-icons-png.flaticon.com/512/3300/3300742.png' }
    ]
  },
  {
    id: 'admin',
    label: 'Преподавателю / Админу',
    visible: () => isTeacherOrAdmin.value || canSeeDictionary.value || canSeeAdmin.value,
    items: [
      {
        to: '/teacher-dashboard',
        title: 'Панель преподавателя',
        subtitle: 'группы / успеваемость',
        icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
        visible: () => isTeacherOrAdmin.value
      },
      {
        to: '/dictionary-module',
        title: 'Заполнение справочников',
        subtitle: 'импорт / шаблоны',
        icon: 'https://cdn-icons-png.flaticon.com/512/942/942799.png',
        visible: () => canSeeDictionary.value
      },
      {
        to: '/admin',
        title: 'Панель управления',
        subtitle: 'пользователи / роли',
        icon: 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png',
        visible: () => canSeeAdmin.value
      }
    ]
  }
];

const categories = computed(() => CATEGORIES.filter((c) => (typeof c.visible === 'function' ? c.visible() : true)));

const activeCategoryId = ref(categories.value[0]?.id || 'docs');
const transitionName = ref('tiles-down');
watch(
  () => categories.value.map((c) => c.id).join(','),
  () => {
    if (!categories.value.some((c) => c.id === activeCategoryId.value)) {
      activeCategoryId.value = categories.value[0]?.id || 'docs';
    }
  }
);

const activeCategory = computed(() => categories.value.find((c) => c.id === activeCategoryId.value) || categories.value[0]);

const tiles = computed(() => {
  const cat = activeCategory.value;
  if (!cat) return [];
  return (cat.items || []).filter((it) => (typeof it.visible === 'function' ? it.visible() : true));
});

function setActive(id) {
  const ids = categories.value.map((c) => c.id);
  const prevIdx = ids.indexOf(activeCategoryId.value);
  const nextIdx = ids.indexOf(id);
  if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
    transitionName.value = nextIdx > prevIdx ? 'tiles-right' : 'tiles-left';
  } else {
    transitionName.value = 'tiles-down';
  }
  activeCategoryId.value = id;
}

function iconSrc(icon) {
  // Support static URLs. Local assets already resolved by bundler when used directly in template.
  return icon;
}

function countForCategory(cat) {
  const arr = (cat.items || []).filter((it) => (typeof it.visible === 'function' ? it.visible() : true));
  return arr.length;
}

const CATEGORY_ICON = {
  docs: ['fas', 'file-lines'],
  study: ['fas', 'graduation-cap'],
  tests: ['fas', 'clipboard-check'],
  service: ['fas', 'wrench'],
  admin: ['fas', 'user-shield']
};
</script>

<template>
  <div class="menu-shell">
    <div class="menu-hero">
      <div class="hero-card">
        <div class="hero-badge">IrTRAN</div>
        <h2 class="hero-title">Тренажёр ЭТРАН по транспортной документации</h2>
        <p class="hero-text">
          Здесь вы можете отрабатывать оформление документов, проходить обучающие сценарии и закреплять теорию тестами.
          Всё сделано так, чтобы тренироваться быстро и без «страха ошибки».
        </p>
      </div>
    </div>

    <div class="menu-categories">
      <button
        v-for="c in categories"
        :key="c.id"
        type="button"
        class="cat-pill"
        :class="{ active: c.id === activeCategoryId }"
        @click="setActive(c.id)"
      >
        <font-awesome-icon class="cat-icon" :icon="CATEGORY_ICON[c.id] || ['fas','layer-group']" />
        <span class="cat-label">{{ c.label }}</span>
        <span class="cat-count">{{ countForCategory(c) }}</span>
        <span class="cat-underline" />
      </button>
    </div>

    <div class="menu-tiles">
      <transition-group :name="transitionName" tag="div" class="tiles-grid">
        <router-link
          v-for="t in tiles"
          :key="t.to"
          :to="t.to"
          class="tile"
        >
          <div class="tile-icon-wrap">
            <img
              v-if="typeof t.icon === 'string'"
              class="tile-icon"
              :src="iconSrc(t.icon)"
              :alt="t.title"
              loading="lazy"
            />
          </div>
          <div class="tile-body">
            <div class="tile-title">{{ t.title }}</div>
            <div v-if="t.subtitle" class="tile-subtitle">{{ t.subtitle }}</div>
          </div>
          <div class="tile-chevron" aria-hidden="true">→</div>
        </router-link>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
/* Single palette aligned with header (#7da5f0) */
.menu-shell {
  --bg: #f6f8ff;
  --surface: #ffffff;
  --ink: #1f2937;
  --muted: #5b667a;
  --brand: #7da5f0;
  --brand-2: #4f85eb;
  --ring: rgba(125, 165, 240, 0.28);
  --shadow: 0 18px 50px rgba(16, 24, 40, 0.10);

  padding: 78px 20px 40px; /* header fixed */
  min-height: calc(100vh - 50px);
  background:
    radial-gradient(900px 280px at 50% 0%, rgba(125, 165, 240, 0.22), transparent 70%),
    linear-gradient(180deg, var(--bg), #ffffff);
}

.menu-hero {
  display: flex;
  justify-content: center;
  margin: 6px 0 18px;
}

.hero-card {
  width: min(980px, 100%);
  background: var(--surface);
  border: 1px solid rgba(16, 24, 40, 0.08);
  border-radius: 18px;
  box-shadow: var(--shadow);
  padding: 18px 18px 16px;
  position: relative;
  overflow: hidden;
}

.hero-card::before {
  content: "";
  position: absolute;
  inset: -2px;
  background:
    radial-gradient(600px 200px at 20% 0%, rgba(125, 165, 240, 0.26), transparent 60%),
    radial-gradient(500px 180px at 80% 10%, rgba(79, 133, 235, 0.18), transparent 65%);
  pointer-events: none;
}

.hero-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #0b3aa8;
  background: rgba(125, 165, 240, 0.18);
  border: 1px solid rgba(125, 165, 240, 0.35);
  border-radius: 999px;
  padding: 6px 10px;
}

.hero-title {
  position: relative;
  margin: 10px 0 6px;
  font-size: 22px;
  line-height: 1.2;
  color: var(--ink);
}

.hero-text {
  position: relative;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
  max-width: 78ch;
}

.menu-categories {
  width: min(980px, 100%);
  margin: 0 auto 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.cat-pill {
  appearance: none;
  border: 1px solid rgba(16, 24, 40, 0.10);
  background: rgba(255, 255, 255, 0.8);
  color: var(--ink);
  border-radius: 999px;
  padding: 12px 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
}

.cat-icon {
  width: 16px;
  height: 16px;
  color: rgba(31, 41, 55, 0.72);
}

.cat-pill:hover {
  transform: translateY(-1px);
  border-color: rgba(125, 165, 240, 0.35);
  box-shadow: 0 10px 24px rgba(125, 165, 240, 0.14);
}

.cat-pill.active {
  background: rgba(125, 165, 240, 0.16);
  border-color: rgba(125, 165, 240, 0.45);
  box-shadow: 0 14px 34px rgba(79, 133, 235, 0.16);
}

.cat-pill.active .cat-icon {
  color: rgba(79, 133, 235, 0.95);
}

.cat-label {
  font-weight: 700;
  font-size: 14px;
}

.cat-count {
  min-width: 26px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: rgba(31, 41, 55, 0.85);
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(16, 24, 40, 0.10);
}

.cat-pill.active .cat-count {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(125, 165, 240, 0.35);
}

.cat-underline {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 6px;
  height: 2px;
  border-radius: 999px;
  background: transparent;
  transition: background-color 140ms ease, transform 140ms ease;
  transform: scaleX(0.3);
  transform-origin: center;
}

.cat-pill.active .cat-underline {
  background: linear-gradient(90deg, var(--brand), var(--brand-2));
  transform: scaleX(1);
}

.menu-tiles {
  width: min(980px, 100%);
  margin: 0 auto;
}

.tiles-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.tile {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(16, 24, 40, 0.10);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 10px 26px rgba(16, 24, 40, 0.08);
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  will-change: transform;
}

.tile:hover {
  transform: translateY(-2px);
  border-color: rgba(125, 165, 240, 0.42);
  box-shadow: 0 16px 44px rgba(79, 133, 235, 0.16);
}

.tile:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--ring), 0 16px 44px rgba(79, 133, 235, 0.16);
}

.tile-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(125, 165, 240, 0.18), rgba(79, 133, 235, 0.10));
  border: 1px solid rgba(125, 165, 240, 0.30);
  display: grid;
  place-items: center;
}

.tile-icon {
  width: 38px;
  height: 38px;
  object-fit: contain;
}

.tile-title {
  font-weight: 800;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.2;
}

.tile-subtitle {
  margin-top: 2px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.2;
}

.tile-chevron {
  color: rgba(31, 41, 55, 0.55);
  font-weight: 900;
  font-size: 18px;
  transition: transform 160ms ease, color 160ms ease;
}

.tile:hover .tile-chevron {
  transform: translateX(2px);
  color: rgba(79, 133, 235, 0.9);
}

/* Animations: "tiles красиво выезжают" */
.tiles-down-enter-active,
.tiles-down-leave-active,
.tiles-left-enter-active,
.tiles-left-leave-active,
.tiles-right-enter-active,
.tiles-right-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

/* Default (down) */
.tiles-down-enter-from {
  opacity: 0;
  transform: translateY(14px);
}
.tiles-down-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.tiles-down-leave-from {
  opacity: 1;
  transform: translateY(0);
}
.tiles-down-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

/* Slide left (when switching to previous category) */
.tiles-left-enter-from {
  opacity: 0;
  transform: translateX(-18px);
}
.tiles-left-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.tiles-left-leave-from {
  opacity: 1;
  transform: translateX(0);
}
.tiles-left-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

/* Slide right (when switching to next category) */
.tiles-right-enter-from {
  opacity: 0;
  transform: translateX(18px);
}
.tiles-right-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.tiles-right-leave-from {
  opacity: 1;
  transform: translateX(0);
}
.tiles-right-leave-to {
  opacity: 0;
  transform: translateX(-18px);
}

.tiles-down-move,
.tiles-left-move,
.tiles-right-move {
  transition: transform 220ms ease;
}

@media (max-width: 980px) {
  .tiles-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .menu-shell {
    padding-top: 72px;
  }
  .tiles-grid {
    grid-template-columns: 1fr;
  }
}
</style>
