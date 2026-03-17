<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useListsStore } from "@/stores/main";
import { updateTitle } from "@/helpers/headerHelper";
import { getStations, saveStudentDocument, updateStudentDocument } from "@/helpers/API";
import { getToken } from "@/helpers/keycloak";

const route = useRoute();
const router = useRouter();
const listsStore = useListsStore();
const STORAGE_KEY = "common_act_documents";
const saveError = ref(null);
const saveSuccess = ref(null);

function getDefaultDocument() {
    return {
        id: null,
        signed: false,
        id_station: null,
        act_date: new Date().toISOString().split("T")[0],
        downtime_type: "",
        description: "",
        supplement: "",
        persons: [],
        wagons: [],
        backendId: null,
    };
}

const document = ref(getDefaultDocument());

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
                    const created = await saveStudentDocument("common_act", payload);
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
        updateTitle("Акты (Общей формы) № " + doc.id);
        saveSuccess.value = "Документ сохранён.";
        setTimeout(() => { saveSuccess.value = null; }, 3000);
        if (!route.params.id) router.replace("/act/common/create/" + doc.id);
    } catch (e) {
        console.error(e);
        saveError.value = "Не удалось сохранить документ.";
    }
}

function signDocument() {
    if (document.value.signed) return;
    if (!confirm("Подписать акт?")) return;
    saveError.value = null;
    saveSuccess.value = null;
    document.value.signed = true;
    saveDocument();
    saveSuccess.value = "Акт подписан и сохранён.";
    setTimeout(() => { saveSuccess.value = null; }, 3000);
}

function spoilDocument() {
    if (!confirm("Испортить акт? Действие необратимо.")) return;
    saveError.value = null;
    saveSuccess.value = null;
    const id = document.value.id;
    if (id) {
        const list = getStoredList().filter((d) => d.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    document.value = getDefaultDocument();
    updateTitle("Акты (Новый документ)");
    router.push("/act/common/menu");
}

function loadDocumentById(id) {
    const list = getStoredList();
    const found = list.find((d) => d.id === id);
    if (found) {
        document.value = { ...getDefaultDocument(), ...found };
        updateTitle("Акты (Общей формы) № " + id);
    }
}

onMounted(async () => {
    await getStations();
    if (route.params.id) loadDocumentById(route.params.id);
    else updateTitle("Акты (Новый документ)");
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
        </ul>
        <div class="tab-content" id="myTabContent">
            <div class="tab-pane fade show active" style="margin-top: 1em" id="home-tab-pane" role="tabpanel" aria-labelledby="home-tab" tabindex="0">
                <div class="row mb-1">
                    <select-with-search title="Станция составления акта" :values="listsStore.stations" valueKey="id" name="name" v-model="document.id_station" modalName="CommonActStation" :fields="{ 'Код станции': 'code', 'Наименование станции': 'name', 'Краткое наименование': 'short_name' }" />
                    <disable-simple-input title="Код" :dis="true" :value="listsStore.stations[document.id_station]?.code ?? ''" :fixWidth="false" styleInput="width: 173px" />
                </div>

                <div class="row mb-1">
                    <simple-input title="Дата составления акта" type="date" v-model="document.act_date" styleInput="width: 250px" />
                </div>
                <!-------------------------Настоящий акт составлен в присутствии следующих лиц-------------------------------------------------------------------->
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" style="width: auto; font-weight: bold">Настоящий акт составлен в присутствии следующих лиц</label>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#aktsostavlen">Добавить</button>
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#aktsostavlen">Изменить</button>
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#">Удалить</button>
                    </div>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <div class="table-responsive" style="border: #c1c1c1 solid 1px">
                            <table class="table table-hover table-bordered border-white">
                                <thead style="background-color: #7da5f0; color: white">
                                    <tr>
                                        <th></th>
                                        <th style="width: 400px">Должность</th>
                                        <th style="width: 500px">ФИО</th>
                                    </tr>
                                </thead>
                                <tbody class="table-group-divider">
                                    <tr>
                                        <td><input type="checkbox" class="row-checkbox" /></td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!--Настоящий акт составлен в присутствии следующих лиц модальное окно -->
                <div class="modal fade bd-example-modal-lg" id="aktsostavlen" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg" style="max-width: 60%">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center col-auto" id="staticBackdropLabel" style="color: white; font-weight: bold">Акт составлен</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-auto">
                                        <button type="button" class="btn btn-custom">Применить</button>
                                        <button type="button" class="btn btn-custom">Отменить</button>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Должность</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" placeholder="" style="width: 300px" />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">ФИО</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" placeholder="" style="width: 300px" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <div class="row mb-1">
                    <simple-select title="Начало/Окончание простоя" :values="[{ id: 'start', name: 'Начало простоя' }, { id: 'end', name: 'Окончание простоя' }]" valueKey="id" name="name" v-model="document.downtime_type" />
                </div>

                <!--------------------------------------------------------------------------------------------->


                <!-------------------------Вагоны, контейнеры отправки-------------------------------------------------------------------->
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" style="width: auto; font-weight: bold">Отправки, вагоны/контейнеры</label>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#otprakaAkt">Добавить</button>
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#otprakaAkt">Изменить</button>
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#">Удалить</button>
                    </div>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <div class="table-responsive" style="border: #c1c1c1 solid 1px">
                            <table class="table table-hover table-bordered border-white">
                                <thead style="background-color: #7da5f0; color: white">
                                    <tr>
                                        <th></th>
                                        <th>№ п/п</th>
                                        <th>Номер вагона/контейнера</th>
                                        <th>Номер отправки</th>
                                        <th>Дата и время начала простоя</th>
                                        <th>Номер акта на начало простоя</th>
                                        <th>Кол-во суток простоя</th>
                                    </tr>
                                </thead>
                                <tbody class="table-group-divider">
                                    <tr>
                                        <td><input type="checkbox" class="row-checkbox" /></td>
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
                    </div>
                </div>

                <!--Вагоны, контейнеры отправки модальное окно -->
                <div class="modal fade bd-example-modal-lg" id="otprakaAkt" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg" style="max-width: 70%">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center col-auto" id="staticBackdropLabel" style="color: white; font-weight: bold">Отправки</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-auto">
                                        <button type="button" class="btn btn-custom">Применить</button>
                                        <button type="button" class="btn btn-custom">Отменить</button>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Вагон, контейнер №</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" placeholder="" style="width: 150px"/>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Отправка №</label>
                                    <div class="input-group" style="width: 270px">
                                        <input type="text" class="form-control custom-search" placeholder="Поиск" aria-label="Введите запрос" />
                                        <button class="btn btn-outline-secondary" type="button" data-toggle="modal" data-target="#naityOtpravku">
                                            <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
                                        </button>
                                    </div>
                                </div>

                                 <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата и время начала простоя</label>
                                    <div class="col-auto">
                                        <input type="datetime-local" class="form-control mt-0 custom-input" placeholder="" style="width: 150px"/>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата и время окончания простоя</label>
                                    <div class="col-auto">
                                        <input type="datetime-local" class="form-control mt-0 custom-input" placeholder="" style="width: 150px"/>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Номер акта на начало простоя</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" placeholder="" style="width: 150px" disabled/>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Кол-во суток простоя</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" placeholder="" style="width: 150px" disabled/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--------------------------------------------------------------------------------------------->

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Описание обстоятельств, вызвавших составление акта</label>
                    <div class="col-10">
                        <input type="text" class="form-control mt-0 custom-input" style="height: 150px; min-width: 100%" v-model="document.description" />
                    </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Дополнение к описанию обстоятельств</label>
                    <div class="col-10">
                        <input type="text" class="form-control mt-0 custom-input" style="height: 150px; min-width: 100%" v-model="document.supplement" />
                    </div>
                </div>


                <!--Найти № Отправки модальное окно -->
                <div class="modal fade" id="naityOtpravku" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Отправки</span>
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
                                                <th>Код отправки</th>
                                                <th>№ отправки</th>
                                            </tr>
                                        </thead>
                                        <tbody class="table-group-divider">
                                            <tr>
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


                <!--Найти Подписать акт модальное окно -->
                <div class="modal fade" id="podpisat" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-sm">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Подпись акта</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row justify-content-md-center">
                                    <label class="col-auto col-form-label mb-0 label-custom">Подписать акт?</label>
                                </div>
                                <div class="row justify-content-md-center">
                                    <button type="button" class="btn btn-custom" style="width: 70px; margin: 10px">Да</button>
                                    <button type="button" class="btn btn-custom" data-dismiss="modal" style="width: 70px; margin: 10px">Нет</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--Найти Испортить акт модальное окно -->
                <div class="modal fade" id="isportit" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-sm">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Удаление акта</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row justify-content-md-center">
                                    <label class="col-12 col-form-label mb-0 label-custom">Вы действительно хотите удалить акт?</label>
                                </div>
                                <div class="row justify-content-md-center">
                                    <button type="button" class="btn btn-custom" style="width: 70px; margin: 10px">Да</button>
                                    <button type="button" class="btn btn-custom" data-dismiss="modal" style="width: 70px; margin: 10px">Нет</button>
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
</style>
