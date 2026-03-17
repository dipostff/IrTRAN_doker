<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useListsStore } from "@/stores/main";
import { updateTitle } from "@/helpers/headerHelper";
import { getStations, getOwnersNonPublicRailway, saveStudentDocument, updateStudentDocument } from "@/helpers/API";
import { getToken } from "@/helpers/keycloak";

const route = useRoute();
const router = useRouter();
const listsStore = useListsStore();
const STORAGE_KEY = "reminder_documents";
const saveError = ref(null);
const saveSuccess = ref(null);

const reminderTypeOptions = [
    { id: "На уборку", name: "На уборку" },
    { id: "На подачу", name: "На подачу" },
];

const locomotiveOptions = [
    { id: "railway", name: "Железная дорога" },
    { id: "owner", name: "Владелец п/пути" },
];

function getDefaultDocument() {
    return {
        id: null,
        signed: false,
        reminder_type: "",
        id_station: null,
        id_owner: null,
        place_of_delivery: "",
        locomotive_by: null,
        train_index: "",
        backendId: null,
    };
}

const document = ref(getDefaultDocument());

const reminderTitle = computed(() => {
    const type = document.value.reminder_type === "На уборку" ? "уборку" : "подачу";
    const num = document.value.id || "000000";
    return `ПАМЯТКА ПРИЕМОСДАТЧИКА №${num} на ${type} вагонов`;
});

function getStoredList() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveDocument() {
    saveError.value = null;
    saveSuccess.value = null;
    try {
        const list = getStoredList();
        const doc = { ...document.value };
        if (!doc.id) {
            doc.id = Date.now().toString();
            doc.createdAt = new Date().toISOString();
            list.push(doc);
        } else {
            const idx = list.findIndex((d) => d.id === doc.id);
            if (idx >= 0) list[idx] = { ...doc, createdAt: list[idx].createdAt };
            else list.push(doc);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        document.value = { ...doc };
        if (getToken()) {
            try {
                const payload = { ...document.value };
                if (payload.backendId) {
                    await updateStudentDocument(payload.backendId, payload);
                } else {
                    const created = await saveStudentDocument("reminder", payload);
                    document.value.backendId = created.id;
                    const list2 = getStoredList();
                    const idx = list2.findIndex((d) => d.id === doc.id);
                    if (idx >= 0) list2[idx].backendId = created.id;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(list2));
                }
            } catch (apiErr) {
                console.warn("Синхронизация с сервером не выполнена:", apiErr);
            }
        }
        updateTitle("Памятка приемосдатчика № " + doc.id);
        saveSuccess.value = "Документ сохранён.";
        setTimeout(() => { saveSuccess.value = null; }, 3000);
        if (!route.params.id) router.replace("/reminder/create/" + doc.id);
    } catch (e) {
        console.error(e);
        saveError.value = "Не удалось сохранить документ.";
    }
}

function signDocument() {
    if (document.value.signed) return;
    if (!confirm("Подписать документ?")) return;
    saveError.value = null;
    saveSuccess.value = null;
    document.value.signed = true;
    saveDocument();
    saveSuccess.value = "Документ подписан и сохранён.";
    setTimeout(() => { saveSuccess.value = null; }, 3000);
}

function spoilDocument() {
    if (!confirm("Испортить документ? Действие необратимо.")) return;
    saveError.value = null;
    saveSuccess.value = null;
    const id = document.value.id;
    if (id) {
        const list = getStoredList().filter((d) => d.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    document.value = getDefaultDocument();
    updateTitle("Памятка приемосдатчика (Заготовка)");
    router.push("/reminder/menu");
}

function loadDocumentById(id) {
    const list = getStoredList();
    const found = list.find((d) => d.id === id);
    if (found) {
        document.value = { ...getDefaultDocument(), ...found };
        updateTitle("Памятка приемосдатчика № " + id);
    }
}

onMounted(async () => {
    await Promise.all([getStations(), getOwnersNonPublicRailway()]);
    if (route.params.id) loadDocumentById(route.params.id);
    else updateTitle("Памятка приемосдатчика (Заготовка)");
});
</script>

<template>
    <div class="search-box">
        <div class="row">
            <div class="col-auto">
                <button type="button" class="btn btn-custom" @click="saveDocument">Сохранить</button>
                <button type="button" class="btn btn-custom" @click="signDocument" :disabled="document.signed">{{ document.signed ? 'Подписано' : 'Подписать' }}</button>
                <button type="button" class="btn btn-custom" @click="spoilDocument">Испортить</button>
            </div>
        </div>
        <div class="row mt-2" v-if="saveError">
            <div class="col-auto"><div class="alert alert-danger py-1 px-2 mb-0">{{ saveError }}</div></div>
        </div>
        <div class="row mt-2" v-if="saveSuccess">
            <div class="col-auto"><div class="alert alert-success py-1 px-2 mb-0">{{ saveSuccess }}</div></div>
        </div>
    </div>

    <div class="content-container">
        <ul class="nav nav-tabs" id="myTab" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="home-tab" data-toggle="tab" data-target="#home-tab-pane" type="button" role="tab" aria-controls="home-tab-pane" aria-selected="true">Документ</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="History-tab" data-toggle="tab" data-target="#History-tab-pane" type="button" role="tab" aria-controls="History-tab-pane" aria-selected="false" disabled>История</button>
            </li>
        </ul>
        <div class="tab-content" id="myTabContent">
            <div class="tab-pane fade show active" style="margin-top: 1em" id="home-tab-pane" role="tabpanel" aria-labelledby="home-tab" tabindex="0">
                <div class="row mb-1 justify-content-md-end" style="margin-right: 10px">
                    <label class="col-auto col-form-label mb-0 label-custom" style="font-weight: bold">Форма ГУ-45 ЭТД</label>
                    <label class="col-auto col-form-label mb-0 label-custom" style="border: solid 1px black; width: 100px">0367802</label>
                </div>

                <div class="row mb-1 justify-content-md-end" style="margin-right: 10px">
                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Утверждена ОАО "РЖД" в 2015г.</label>
                </div>

                <div class="row mb-1">
                    <simple-select title="Тип памятки" :values="reminderTypeOptions" valueKey="id" name="name" v-model="document.reminder_type" />
                </div>

                <div class="row mb-1">
                    <select-with-search title="Станция" :values="listsStore.stations" valueKey="id" name="name" v-model="document.id_station" modalName="ReminderStation" :fields="{ 'Код станции': 'code', 'Наименование станции': 'name', 'Краткое наименование': 'short_name' }" />
                    <disable-simple-input title="Номер станции" :dis="true" :value="listsStore.stations[document.id_station]?.code ?? ''" :fixWidth="false" styleInput="width: 120px" />
                </div>

                <div class="row mb-1 justify-content-md-center">
                    <label class="col-4 col-form-label mb-0 label-custom" style="font-weight: bold">{{ reminderTitle }}</label>
                </div>

                <div class="row mb-1">
                    <select-with-search title="Наименование владельца п/п(клиента)" :values="listsStore.owners_non_public_railway" valueKey="id" name="name" v-model="document.id_owner" modalName="ReminderOwner" :fields="{ 'Код ОКПО': 'code', 'Наименование владельца': 'name' }" />
                    <simple-input title="Место подачи" v-model="document.place_of_delivery" :fixWidth="false" styleInput="width: 200px" />
                </div>

                <div class="row mb-1">
                    <simple-select title="Подача производилась локомотивом" :values="locomotiveOptions" valueKey="id" name="name" v-model="document.locomotive_by" />
                    <simple-input title="Индекс поезда" v-model="document.train_index" :fixWidth="false" styleInput="width: 150px" />
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#OsnovnoyRazdelPamaitky">Добавить</button>
                        <button type="button" class="btn btn-custom">Изменить</button>
                        <button type="button" class="btn btn-custom">Удалить</button>
                        <button type="button" class="btn btn-custom">Копировать</button>
                        <button type="button" class="btn btn-custom">Вставить</button>
                    </div>
                </div>

                <div class="table-responsive" style="border: black solid 1px; padding-bottom: 100px">
                    <table class="table table-hover table-bordered border-dark">
                        <thead style="background-color: rgba(135, 135, 135, 0.4); color: black">
                            <tr>
                                <th rowspan="2" style="width: 30px">№п/<br />п</th>
                                <th>№ вагона</th>
                                <th rowspan="2" style="width: 30px">Код <br />ж.д <br />адм.</th>
                                <th rowspan="2" style="width: 60px">
                                    Принадл.<br />
                                    вагонов
                                </th>
                                <th rowspan="2" style="width: 40px">
                                    Груз.<br />
                                    опер.
                                </th>
                                <th colspan="3">
                                    Время выполнения операции<br />
                                    день-месяц<br />
                                    часы-минуты
                                </th>
                                <th colspan="2">
                                    Задержка окончания<br />
                                    груз. операции
                                </th>
                                <th rowspan="2" style="width: 30px">
                                    Кол-во<br />
                                    взв.
                                </th>
                                <th rowspan="2" style="width: 300px">Примечание</th>
                            </tr>
                            <tr>
                                <th>Наименование груза</th>
                                <th>
                                    Подача/<br />передача<br />
                                    на<br />
                                    выстав.<br />
                                    путь
                                </th>
                                <th>
                                    Уведом.<br />
                                    о <br />заверш.<br />
                                    гр. опер.<br />
                                    возврт.<br />
                                    на выст.<br />
                                    путь
                                </th>
                                <th>Уборка</th>
                                <th>
                                    Время <br />
                                    час <br />мин
                                </th>
                                <th>
                                    № акта<br />
                                    ГУ-23
                                </th>
                            </tr>
                            <tr>
                                <th>1</th>
                                <th>2</th>
                                <th>3</th>
                                <th>4</th>
                                <th>5</th>
                                <th>6</th>
                                <th>7</th>
                                <th>8</th>
                                <th>9</th>
                                <th>10</th>
                                <th>11</th>
                                <th>12</th>
                            </tr>
                        </thead>
                        <tbody class="table-group-divider">
                            <tr>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!--Добавить Основной раздел памятки модальное окно -->
                <div class="modal fade" id="OsnovnoyRazdelPamaitky" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticGraficPodachLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Основной раздел памятки</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-1">
                                    <div class="col-auto">
                                        <button type="button" class="btn btn-custom">Применить</button>
                                        <button type="button" class="btn btn-custom" data-dismiss="modal">Отменить</button>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Номер вагона</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" placeholder="" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Грузовая операция</label>
                                    <div class="col-3">
                                        <select class="form-select mt-0 custom-input">
                                            <option value="">Выберете элемент списка</option>
                                            <option value="Погрузка">Погрузка</option>
                                            <option value="Выгрузка">Выгрузка</option>
                                            <option value="Сдвоенная">Сдвоенная</option>
                                            <option value="Без операций">Без операций</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Наименование груза</label>
                                    <div class="col-auto">
                                        <div class="input-group" style="width: 270px">
                                            <input type="text" class="form-control custom-search" placeholder="Поиск" aria-label="Введите запрос" />
                                            <button class="btn btn-outline-secondary" type="button" data-toggle="modal" data-target="#NaimenovanieGruza">
                                                <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата подачи</label>
                                    <div class="col-auto">
                                        <input type="date" class="form-control mt-0 custom-input" style="width: 150px" />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Время подачи</label>
                                    <div class="col-auto">
                                        <input type="time" class="form-control mt-0 custom-input" style="width: 150px" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата уборки</label>
                                    <div class="col-auto">
                                        <input type="date" class="form-control mt-0 custom-input" style="width: 150px" />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Время уборки</label>
                                    <div class="col-auto">
                                        <input type="time" class="form-control mt-0 custom-input" style="width: 150px" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--Подписать документ модальное окно -->
                <div class="modal fade" id="Podpisatdoc" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <h1 class="modal-title fs-5" id="staticBackdropLabel" style="color: white">Подпись документа</h1>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-1 justify-content-md-end" style="margin-right: 10px">
                                    <label class="col-auto col-form-label mb-0 label-custom" style="font-weight: bold">Форма ГУ-45 ЭТД</label>
                                    <label class="col-auto col-form-label mb-0 label-custom" style="border: solid 1px black; width: 100px">0000000</label>
                                </div>

                                <div class="row mb-1 justify-content-md-end" style="margin-right: 10px">
                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Утверждена ОАО "РЖД" в 2015г.</label>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">Станция:</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">(Наименование станции)</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">(Номер станции)</label>
                                </div>

                                <div class="row mb-1 justify-content-md-center">
                                    <label class="col-4 col-form-label mb-0 label-custom" style="font-weight: bold">{{ reminderTitle }}</label>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">Наименование владельца п/п(клиента):</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">(Наименование клиента/владельца)</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">Место подачи:</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">(Наименование Места подачи)</label>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">Подача производилась:</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">(Наименование кем производилась подача)</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">Индекс поезда:</label>
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">(индекс)</label>
                                </div>

                                <div class="row mb-1"></div>

                                <div class="table-responsive" style="border: black solid 1px; padding-bottom: 100px">
                                    <table class="table table-bordered border-dark">
                                        <thead style="color: black">
                                            <tr>
                                                <th rowspan="2" style="width: 30px">№п/<br />п</th>
                                                <th>№ вагона</th>
                                                <th rowspan="2" style="width: 30px">Код <br />ж.д <br />адм.</th>
                                                <th rowspan="2" style="width: 60px">
                                                    Принадл.<br />
                                                    вагонов
                                                </th>
                                                <th rowspan="2" style="width: 40px">
                                                    Груз.<br />
                                                    опер.
                                                </th>
                                                <th colspan="3">
                                                    Время выполнения операции<br />
                                                    день-месяц<br />
                                                    часы-минуты
                                                </th>
                                                <th colspan="2">
                                                    Задержка окончания<br />
                                                    груз. операции
                                                </th>
                                                <th rowspan="2" style="width: 30px">
                                                    Кол-во<br />
                                                    взв.
                                                </th>
                                                <th rowspan="2" style="width: 300px">Примечание</th>
                                            </tr>
                                            <tr>
                                                <th>Наименование груза</th>
                                                <th>
                                                    Подача/<br />передача<br />
                                                    на<br />
                                                    выстав.<br />
                                                    путь
                                                </th>
                                                <th>
                                                    Уведом.<br />
                                                    о <br />заверш.<br />
                                                    гр. опер.<br />
                                                    возврт.<br />
                                                    на выст.<br />
                                                    путь
                                                </th>
                                                <th>Уборка</th>
                                                <th>
                                                    Время <br />
                                                    час <br />мин
                                                </th>
                                                <th>
                                                    № акта<br />
                                                    ГУ-23
                                                </th>
                                            </tr>
                                            <tr>
                                                <th>1</th>
                                                <th>2</th>
                                                <th>3</th>
                                                <th>4</th>
                                                <th>5</th>
                                                <th>6</th>
                                                <th>7</th>
                                                <th>8</th>
                                                <th>9</th>
                                                <th>10</th>
                                                <th>11</th>
                                                <th>12</th>
                                            </tr>
                                        </thead>
                                        <tbody class="table-group-divider">
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto; font-weight: bold">Место для отметок</label>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto; font-weight: bold">Вагон ПРИНЯЛ</label>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto; font-weight: bold">Вагон СДАЛ приемосдатчик ж.д.</label>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto; font-weight: bold">Памятка проведена по ведомости подачи и уборки №</label>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto; font-weight: bold">Товарный кассир(агент станции)</label>
                                </div>

                                <div class="row justify-content-md-end">
                                    <button type="button" class="btn btn-custom" style="width: 150px; margin: 1em">Подписать</button>
                                    <button type="button" class="btn btn-custom" data-dismiss="modal" style="width: 150px; margin: 1em">Отмена</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--Найти Наименование груза модальное окно -->
                <div class="modal fade" id="NaimenovanieGruza" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Наименование груза</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row justify-content-md-center mb-2">
                                    <div class="col-12">
                                        <div class="input-group">
                                            <input type="text" class="form-control" id="clearimput" placeholder="Поиск" aria-label="Поиск" />
                                            <div class="input-group-append">
                                                <button class="btn btn-outline-secondary" type="button" id="clearButton">
                                                    <font-awesome-icon icon="fa-solid fa-xmark" />
                                                </button>
                                                <button class="btn btn-outline-secondary" type="button">
                                                    <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 200px">
                                    <table class="table table-hover table-bordered border-white">
                                        <thead style="background-color: #7da5f0; color: white">
                                            <tr>
                                                <th>Код груза</th>
                                                <th>Наименование груза</th>
                                                <th>Краткое наименование груза</th>
                                            </tr>
                                        </thead>
                                        <tbody class="table-group-divider">
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div class="row justify-content-md-end">
                                    <button type="button" class="btn btn-custom" style="width: 70px; margin: 10px">Да</button>
                                    <button type="button" class="btn btn-custom" data-dismiss="modal" style="width: 70px; margin: 10px">Нет</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->
            </div>

            <!----------------------------------------------------------------------------------История изменений-------------------------------------------------------------------------------------------------->
            <div class="tab-pane fade" style="margin-top: 1em" id="History-tab-pane" role="tabpanel" aria-labelledby="History-tab" tabindex="0">
                <div class="table-responsive" style="border: black solid 1px; padding-bottom: 100px">
                    <table class="table table-hover table-bordered">
                        <thead style="background-color: rgba(135, 135, 135, 0.4); color: black">
                            <tr>
                                <th>Дата и время операции</th>
                                <th>Отчетная дата</th>
                                <th>Должность</th>
                                <th>ФИО</th>
                                <th>Операция</th>
                                <th>Результат</th>
                                <th>ЭП</th>
                                <th>Примечание</th>
                                <th>Рабочее место</th>
                                <th>Контакты</th>
                            </tr>
                        </thead>
                        <tbody class="table-group-divider">
                            <tr data-toggle="modal" data-target="#ViewHistory" style="cursor: pointer">
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!--Посмотреть историю изменений модальное окно -->
                <div class="modal fade" id="ViewHistory" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">История изменений</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата и время операции</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Отчетная дата</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Должность</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">ФИО</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Операция</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Результат</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">ЭП</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Рабочее место</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Контакты</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Примечание</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%; height: 200px" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1 justify-content-md-end">
                                    <button type="button" class="btn btn-custom" style="width: 80px; margin-right: 30px">Печать</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->
            </div>
        </div>
    </div>
</template>

<style scoped>
.header {
    background-color: #7da5f0;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 15px;
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
}

.header .title {
    flex-grow: 1;
    text-align: center;
}

.dropdown {
    margin-left: 0 5px;
}
.btn-custom {
    width: auto;
    background-color: #7da5f0;
    color: white;
    margin: 3px;
}
.btn-custom:hover {
    background-color: #3e6cb4;
    color: white;
}
body {
    font-family: "Open Sans", sans-serif;
    font-size: 14px;
    padding-top: 50px;
}

.search-box {
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: white;
    height: 70px;
    width: 100%;
    position: fixed;
    top: 50px;
    left: 15px;
    z-index: 1000;
}

.content-container {
    padding: 120px 15px;
    top: 100px;
}
.span-custom {
    background-color: #ffffde;
    border: solid #a8a8a8 1px;
    color: black;
    height: 30px;
    padding: 3px 50px;
}
.disabled-input {
    background-color: #ffffde;
    opacity: 1;
    height: 30px;
    width: 270px;
    font-family: "Open Sans", sans-serif;
    font-size: 14px;
    border: 1px solid #c1c1c1;
}
.custom-input {
    background-color: #e3e2ff;
    height: 30px;
    font-family: "Open Sans", sans-serif;
    font-size: 14px;
    width: 270px;
    border: 1px solid #c1c1c1;
}
.input-group .form-control {
    background-color: #e3e2ff;
    border: 1px solid #c1c1c1;
    height: 30px;
    font-family: "Open Sans", sans-serif;
    font-size: 14px;
}
.input-group .btn {
    background-color: #e3e2ff;
    border: 1px solid #c1c1c1;
    height: 30px;
    font-family: "Open Sans", sans-serif;
    font-size: 14px;
}
.input-group .btn:hover {
    background-color: #d1d0ff;
}
.label-custom {
    width: 180px;
}
.form-check-input-checked-bg-color {
    background-color: #7da5f0;
}

.btn-box {
    width: 90%;
    position: fixed;
}

.modal-title {
    text-align: center !important;
}
.selected {
    background-color: #2165b6;
    color: white;
}

.table-bordered {
    border: 1px solid rgba(135, 135, 135, 0.4);
}
.table-bordered th,
.table-bordered tr,
.table-bordered thead,
.table-bordered td {
    border: 1px solid rgba(135, 135, 135, 0.4); /* Устанавливаем черный цвет для ячеек */
}
</style>
