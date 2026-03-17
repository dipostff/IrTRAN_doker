import { createRouter, createWebHistory } from "vue-router";
import { isAuthenticated, initKeycloak } from "@/helpers/keycloak";

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: "/", //Страница авторизации
            name: "authotrization",
            component: () => import("../views/AuthorizationView.vue"),
        },
        {
            path: "/menu", //Страница меню
            name: "menu",
            component: () => import("../views/MenuView.vue"),
        },
        {
            path: "/transporation", //Страница грузоперевозок
            name: "transporation",
            redirect: "/transporation/menu",
            children: [
                {
                    path: "menu", //Страница меню грузоперевозок
                    name: "transporation-menu",
                    component: () => import("../views/TransportationMenuView.vue"),
                },
                {
                    path: "create/:id?", //Страница создания заявки на грузоперевозку
                    name: "transporation-create",
                    component: () => import("../views/TransportationCreateView.vue"),
                },
            ],
        },
        {
            path: "/invoice", //Страница накладной
            name: "invoice",
            redirect: "/invoice/menu",
            children: [
                {
                    path: "menu", //Страница меню грузоперевозок
                    name: "invoice-menu",
                    component: () => import("../views/InvoiceMenuView.vue"),
                },
                {
                    path: "create/:id?",
                    name: "invoice-create",
                    component: () => import("../views/InvoiceCreateView.vue"),
                },
            ],
        },
        {
            path: "/act", //Страница актов
            name: "act",
            redirect: "/act/menu",
            children: [
                {
                    path: "menu", //Страница меню актов
                    name: "act-menu",
                    component: () => import("../views/ActMenuView.vue"),
                },
                {
                    path: "common", //Страница общих актов
                    redirect: "/act/common/menu",
                    name: "act-common",
                    children: [
                        {
                            path: "menu", //Страница меню общих актов
                            name: "act-common-menu",
                            component: () => import("../views/CommonActMenuView.vue"),
                        },
                        {
                            path: "create/:id?",
                            name: "act-common-create",
                            component: () => import("../views/CommonActCreateView.vue"),
                        },
                    ],
                },
                {
                    path: "commercial", //Страница коммерческих актов
                    redirect: "/act/commercial/menu",
                    name: "act-commercial",
                    children: [
                        {
                            path: "menu", //Страница меню коммерческих актов
                            name: "act-commercial-menu",
                            component: () => import("../views/CommercialActMenuView.vue"),
                        },
                        {
                            path: "create/:id?",
                            name: "act-commercial-create",
                            component: () => import("../views/CommercialActCreateView.vue"),
                        },
                    ],
                },
            ],
        },
        {
            path: "/reminder", //Страница памятки
            name: "reminder",
            redirect: "/reminder/menu",
            children: [
                {
                    path: "menu", //Страница меню памятки
                    name: "reminder-menu",
                    component: () => import("../views/ReminderMenuView.vue"),
                },
                {
                    path: "create/:id?",
                    name: "reminder-create",
                    component: () => import("../views/ReminderCreateView.vue"),
                },
            ],
        },
        {
            path: "/filling-statement", //Страница ведомости подачи и уборки
            name: "filling-statement",
            redirect: "/filling-statement/menu",
            children: [
                {
                    path: "menu", //Страница меню ведомости подачи и уборки
                    name: "filling-statement-menu",
                    component: () => import("../views/FillingStatementMenuView.vue"),
                },
                {
                    path: "create/:id?",
                    name: "filling-statement-create",
                    component: () => import("../views/FillingStatementCreateView.vue"),
                },
            ],
        },
        {
            path: "/cumulative-statement", //Страница накопительной ведомости
            name: "cumulative-statement",
            redirect: "/cumulative-statement/menu",
            children: [
                {
                    path: "menu", //Страница меню накопительной ведомости
                    name: "cumulative-statement-menu",
                    component: () => import("../views/CumulativeStatementMenuView.vue"),
                },
                {
                    path: "create/:id?",
                    name: "cumulative-statement-create",
                    component: () => import("../views/CumulativeStatementCreateView.vue"),
                },
            ],
        },
        {
            path: "/documents",
            name: "documents",
            redirect: "/documents/list",
            children: [
                {
                    path: "list",
                    name: "documents-list",
                    component: () => import("../views/DocumentsListView.vue"),
                },
                {
                    path: "view/:source/:id",
                    name: "documents-view",
                    component: () => import("../views/DocumentViewView.vue"),
                },
            ],
        },
        {
            path: "/beginner-scenario", //Страница Сценарий обучения "Новичок"
            name: "beginner-scenario",
            redirect: "/beginner-scenario/menu",
            children: [
                {
                    path: "menu", //Страница меню Сценарий обучения "Новичок"
                    name: "beginner-scenario-menu",
                    component: () => import("../views/BeginnerScenarioMenuView.vue"),
                },
            ],
        },
         {
            path: "/beginner-simulator", //Страница Сценарий обучения "Новичок" - Тренажер
            name: "beginner-simulator",
            redirect: "/beginner-simulator/menu",
            children: [
                {
                    path: "menu", //Страница меню Сценарий обучения "Новичок" - Тренажер
                    name: "beginner-simulator-menu",
                    component: () => import("../views/BeginnerSimulatorMenuView.vue"),
                },
            ],
        },
        {
            path: "/beginner-instructions", //Страница Сценарий "Новичок" - Инструкции
            name: "beginner-instructions",
            redirect: "/beginner-instructions/menu",
            children: [
                {
                    path: "menu", //Страница меню Сценарий "Новичок" - Инструкции
                    name: "beginner-instructions-menu",
                    component: () => import("../views/BeginnerInstructionsView.vue"),
                },
                {
                    path: "transporation", //Страница Сценарий "Новичок" - Инструкции - Инструкции на заявку по грузоперевозке
                    name: "beginner-instructions-transporation",
                    component: () => import("../views/BeginnerTransporationView.vue"),
                },
            ],
        },
        {
            path: "/advanced-scenario", //Страница Сценарий обучения "Продвинутый"
            name: "advanced-scenario",
            redirect: "/advanced-scenario/menu",
            children: [
                {
                    path: "menu", //Страница меню Сценарий обучения "Продвинутый"
                    name: "advanced-scenario-menu",
                    component: () => import("../views/AdvancedScenarioMenuView.vue"),
                },
            ],
        },
        {
            path: "/advanced-simulator", //Страница Сценарий обучения "Продвинутый" - Тренажер
            name: "advanced-simulator",
            redirect: "/advanced-simulator/menu",
            children: [
                {
                    path: "menu", //Страница меню Сценарий обучения "Продвинутый" - Тренажер
                    name: "advanced-simulator-menu",
                    component: () => import("../views/AdvancedSimulatorMenuView.vue"),
                },
            ],
        },
        {
            path: "/report-error",
            name: "report-error",
            component: () => import("../views/ReportErrorView.vue"),
        },
        {
            path: "/test-mode", // Режим теста: пройти тест, банк заданий, конструктор (всё в одном разделе)
            name: "test-mode",
            component: () => import("../views/TestModeView.vue"),
        },
        {
            path: "/question-bank",
            redirect: { name: "test-mode", query: { tab: "bank" } },
        },
        {
            path: "/test-constructor",
            redirect: { name: "test-mode", query: { tab: "constructor" } },
        },
        {
            path: "/admin", // Панель управления (администратор тренажёра)
            name: "admin-panel",
            component: () => import("../views/AdminPanelView.vue"),
        },
        {
            path: "/teacher-dashboard", // Панель преподавателя
            name: "teacher-dashboard",
            component: () => import("../views/TeacherDashboardView.vue"),
        },
        {
            path: "/reference", // Страница Справочник
            name: "reference",
            component: () => import("../views/ReferenceView.vue"),
        },
        {
            path: "/dictionary-module", // Страница Заполнение справочников
            name: "dictionary-module",
            component: () => import("../views/DictionaryModuleView.vue"),
        },
        {
            path: "/scenarios", // Страница Сценарии (банк сценариев)
            name: "scenarios",
            component: () => import("../views/ScenariosView.vue"),
        },
    ],
});

const PAGE_TITLE = {
    authotrization: "Авторизация",
    menu: "Тренажер ЭТРАН главное меню",
    "transporation-menu": "Заявка на грузоперевозку",
    "transporation-create": "Заявка на грузоперевозку",
    "invoice-menu": "Накладная",
    "invoice-create": "Накладная ",
    "invoice-menu": "Накладная",
    "invoice-create": "Накладная ",
    "report-error": "Тренажер ЭТРАН - Сообщить об ошибке",
    "test-mode": "Тренажер ЭТРАН - Режим теста",
    reference: "Тренажер ЭТРАН - Справочник",
    scenarios: "Тренажер ЭТРАН - Сценарии",
    "admin-panel": "Тренажер ЭТРАН - Панель управления",
    "teacher-dashboard": "Тренажер ЭТРАН - Панель преподавателя",
    "dictionary-module": "Тренажер ЭТРАН - Заполнение справочников",
};

// Navigation guard to protect routes
router.beforeEach(async (to, from, next) => {
    // Wait for Keycloak initialization (it's already initialized in main.js, but we wait for it)
    // Use try-catch but don't block navigation on error
    let authenticated = false;
    try {
        authenticated = await initKeycloak();
    } catch (error) {
        // If initialization fails, still allow navigation but log the error
        console.error('Keycloak initialization error in router:', error);
    }

    // Allow access to authorization page
    if (to.name === 'authotrization') {
        // If already authenticated, redirect to menu
        if (authenticated || isAuthenticated()) {
            next({ name: 'menu' });
        } else {
            next();
        }
        return;
    }

    // Check authentication for all other routes
    if (authenticated || isAuthenticated()) {
        next();
    } else {
        // Redirect to login if not authenticated
        next({ name: 'authotrization' });
    }
});

router.afterEach((toRoute, fromRoute) => {
    window.document.title = PAGE_TITLE[toRoute.name] ?? "Тренажер ЭТРАН";
    console.log(toRoute); // this lets you check what else is available to you here
});

export default router;
