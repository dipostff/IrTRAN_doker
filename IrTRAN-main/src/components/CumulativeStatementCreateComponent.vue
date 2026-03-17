<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useListsStore } from "@/stores/main";
import { updateTitle } from "@/helpers/headerHelper";
import { getLegalEntities, saveStudentDocument, updateStudentDocument } from "@/helpers/API";
import { getToken } from "@/helpers/keycloak";

const route = useRoute();
const router = useRouter();
const listsStore = useListsStore();
const STORAGE_KEY = "cumulative_statement_documents";
const saveError = ref(null);
const saveSuccess = ref(null);

const placeOptions = [{ id: "ЦФТО", name: "ЦФТО" }];

function getDefaultDocument() {
    return {
        id: null,
        signed: false,
        document_number: "",
        manual_number: false,
        period_from: "",
        period_to: "",
        arbitration_court: false,
        id_carrier_org: null,
        place_of_calculation: "",
        id_payer: null,
        total_to_pay: null,
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
                    const created = await saveStudentDocument("cumulative_statement", payload);
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
        updateTitle("Накопительная ведомость № " + doc.id);
        saveSuccess.value = "Документ сохранён.";
        setTimeout(() => { saveSuccess.value = null; }, 3000);
        if (!route.params.id) router.replace("/cumulative-statement/create/" + doc.id);
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
    updateTitle("Накопительная ведомость (Новый документ)");
    router.push("/cumulative-statement/menu");
}

function loadDocumentById(id) {
    const list = getStoredList();
    const found = list.find((d) => d.id === id);
    if (found) {
        document.value = { ...getDefaultDocument(), ...found };
        updateTitle("Накопительная ведомость № " + id);
    }
}

onMounted(async () => {
    await getLegalEntities();
    if (route.params.id) loadDocumentById(route.params.id);
    else updateTitle("Накопительная ведомость (Новый документ)");
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
                    <label class="col-auto col-form-label mb-0 label-custom">Вид документа</label>
                    <div class="col-auto">
                        <input type="text" class="form-control mt-0 disabled-input" placeholder="Накопительная ведомость" disabled="disabled" />
                    </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">Ввод номера документа вручную</label>
                    <div class="col-auto">
                        <input class="form-check-input custom-input" style="width: 20px; height: 20px" type="checkbox" id="cumManualNumber" v-model="document.manual_number" />
                    </div>
                </div>

                <div class="row mb-1">
                    <simple-input title="Номер документа" v-model="document.document_number" :fixWidth="false" styleInput="width: 200px" />
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Период с</label>
                    <div class="col-auto">
                        <input type="date" class="form-control mt-0 custom-input" style="width: 150px" v-model="document.period_from" />
                    </div>
                    <label class="col-auto col-form-label mb-0">по</label>
                    <div class="col-auto">
                        <input type="date" class="form-control mt-0 custom-input" style="width: 150px" v-model="document.period_to" />
                    </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" for="customCheck1" style="width: auto">Арбитражный суд</label>
                    <div class="col-auto">
                        <input class="form-check-input custom-input" style="width: 20px; height: 20px" type="checkbox" id="cumArbitration" v-model="document.arbitration_court" />
                    </div>
                </div>

                <div class="row mb-1">
                    <select-with-search title="Организация перевозчика" :values="listsStore.legal_entities" valueKey="id" name="name" v-model="document.id_carrier_org" modalName="CumCarrier" :fields="{ 'Код ОКПО': 'OKPO', 'Наименование': 'name', 'ИД бизнеса': 'id_business', 'ИД холдинга': 'id_holding' }" />
                    <disable-simple-input title="ж.д." :dis="true" :value="''" :fixWidth="false" styleInput="width: 80px" />
                </div>

                <div class="row mb-1">
                    <simple-select title="Место расчета" :values="placeOptions" valueKey="id" name="name" v-model="document.place_of_calculation" />
                </div>

                <div class="row mb-1">
                    <select-with-search title="Плательщик" :values="listsStore.legal_entities" valueKey="id" name="name" v-model="document.id_payer" modalName="CumPayer" :fields="{ 'Код ОКПО': 'OKPO', 'Наименование': 'name', 'ИД бизнеса': 'id_business', 'ИД холдинга': 'id_holding' }" />
                    <disable-simple-input title="Код" :dis="true" :value="listsStore.legal_entities[document.id_payer]?.id ?? ''" :fixWidth="false" styleInput="width: 80px" />
                    <disable-simple-input title="ОКПО" :dis="true" :value="listsStore.legal_entities[document.id_payer]?.OKPO ?? ''" :fixWidth="false" styleInput="width: 120px" />
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Форма расчета</label>
                    <div class="col-3">
                        <select class="form-select mt-0 disabled-input" disabled>
                            <option value="">Безналичный централизованный</option>
                        </select>
                    </div>
                </div>

                <!-- Сборы -->
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" style="width: auto; font-weight: bold">Сборы</label>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#AddSbor">Добавить</button>
                        <button type="button" class="btn btn-custom">Изменить</button>
                        <button type="button" class="btn btn-custom">Удалить</button>
                        <button type="button" class="btn btn-custom">Копировать</button>
                        <button type="button" class="btn btn-custom">Вставить</button>
                        <button type="button" class="btn btn-custom" disabled>Данные из актов</button>
                    </div>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 50px">
                            <table class="table table-hover table-bordered border-white">
                                <thead style="background-color: #7da5f0; color: white">
                                    <tr>
                                        <th></th>
                                        <th>Дата</th>
                                        <th>Наименование документа</th>
                                        <th>Номер документа</th>
                                        <th>Состояние родительского документа</th>
                                        <th>Код статьи сбора</th>
                                        <th>Наименование сбора</th>
                                        <th>Примечание</th>
                                        <th>Номер ваг/конт</th>
                                        <th>Сумма, руб.</th>
                                        <th>Сумма, тенге</th>
                                        <th>Признак НДС</th>
                                        <th>Сумма НДС</th>
                                        <th>Ставка НДС</th>
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
                    </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Итого к оплате</label>
                    <div class="col-auto">
                        <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled="disabled" :value="document.total_to_pay != null ? document.total_to_pay : ''" />
                    </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">ФИО руководителя, подписывающего документ</label>
                    <div class="col-auto">
                        <input type="text" class="form-control mt-0 custom-input" placeholder="" />
                    </div>
                </div>

                <!--Данные по актам Сборов модальное окно -->
                <div class="modal fade bd-example-modal-lg" id="AddSbor" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg" style="max-width: 90%">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center col-auto" id="staticBackdropLabel" style="color: white; font-weight: bold">Сборы</span>
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; background-color: red; margin: 0 35%">Не указана статья сбора</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-auto">
                                        <button type="button" class="btn btn-custom">Применить</button>
                                        <button type="button" class="btn btn-custom" data-dismiss="modal">Отменить</button>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата сбора</label>
                                    <div class="col-auto">
                                        <input type="date" class="form-control mt-0 custom-input" style="width: 150px" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Наименование документа</label>
                                    <div class="col-3">
                                        <select class="form-select mt-0 custom-input">
                                            <option value="">Выберете элемент списка</option>
                                            <option value="Накладная">Накладная</option>
                                            <option value="Ведомость подачи и уборки">Ведомость подачи и уборки</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Номер документа</label>
                                    <div class="col-auto">
                                        <div class="input-group" style="width: 270px">
                                            <input type="text" class="form-control custom-search" placeholder="Поиск" aria-label="Введите запрос" />
                                            <button class="btn btn-outline-secondary" type="button" data-toggle="modal" data-target="#NomerDocumenta">
                                                <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
                                            </button>
                                        </div>
                                    </div>


                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Ид*</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 120px" placeholder="" disabled="disabled" />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Состояние документа</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 120px" placeholder="" disabled="disabled" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Статья сбора</label>
                                    <div class="col-auto">
                                        <div class="input-group" style="width: 478px">
                                            <input type="text" class="form-control custom-search" placeholder="Поиск" aria-label="Введите запрос" />
                                            <button class="btn btn-outline-secondary" type="button" data-toggle="modal" data-target="#StatiaSbora">
                                                <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
                                            </button>
                                        </div>
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Код статьи</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 120px" placeholder="" disabled="disabled" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Признак НДС</label>
                                    <div class="col-3">
                                        <select class="form-select mt-0 custom-input" >
                                            <option value="">Выберете элемент списка</option>
                                            <option value="">С НДС 20%</option>
                                            <option value="">Без НДС</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дополнительный код</label>
                                    <div class="col-auto">
                                        <div class="input-group" style="width: 270px">
                                            <input type="text" class="form-control custom-search" placeholder="Поиск" aria-label="Введите запрос" />
                                            <button class="btn btn-outline-secondary" type="button" data-toggle="modal" data-target="#DopKod">
                                                <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
                                            </button>
                                        </div>
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Код</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 120px" placeholder="" disabled="disabled" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Рассчетная сумма</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Сумма сбора</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="width: 100px" placeholder="" />
                                    </div>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Ставка НДС</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled/>
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom" style="width: auto">Сумма НДС</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>

                                     <div class="col-auto">
                                        <button type="button" class="btn btn-custom">Расчет</button>
                                    </div>

                                    <div class="col-auto">
                                        <button type="button" class="btn btn-custom" disabled>Формула расчетов</button>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Коэф. надбавки на безопаность</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="width: 100px" placeholder=""  />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Коэф. надбавки на компенсацию налогов</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="width: 100px" placeholder=""  />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Коэф. надбавки на кап. ремонт</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" style="width: 100px" placeholder=""  />
                                    </div>

                                    <div class="col-auto">
                                        <button type="button" class="btn btn-custom">Расчет</button>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Сумма без неиндек. части тарифа</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Сумма без коэф. на безопасность</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Сумма без коэф. на налог</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Сумма без доп коэф.</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Доход от надбавки на обесп. безопасности</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Доход от надбавки на компенсацию налогов</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Доход от надбавки на кап. ремонт</label>

                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 disabled-input" style="width: 100px" placeholder="" disabled />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Примечание</label>

                                    <div class="col-10">
                                        <input type="text" class="form-control mt-0 custom-input" style="min-width: 100%" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--Найти Номер документа модальное окно -->
                <div class="modal fade" id="NomerDocumenta" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Номер документа</span>
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
                                                <th>Код</th>
                                                <th>Наименование</th>
                                                <th>Примечание</th>
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

                <!--Найти Статья сборов модальное окно -->
                <div class="modal fade" id="StatiaSbora" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Статья сборов</span>
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
                                                <th>Код</th>
                                                <th>Наименование</th>
                                                <th>Примечание</th>
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

                <!--Найти Дополнительный код модальное окно -->
                <div class="modal fade" id="DopKod" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="DopKod" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Дополнительный код</span>
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
                                                <th>Код</th>
                                                <th>Наименование</th>
                                                <th>Примечание</th>
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
                <!-- ------------------------------------------------------- -->
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
</style>
