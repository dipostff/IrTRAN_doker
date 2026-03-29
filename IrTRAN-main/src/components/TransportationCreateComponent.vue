<script setup>
import { onMounted, ref, watch, computed } from "vue";
import { saveTransporation, deleteTransporation, getTransportation, getCargoConstraints } from "@/helpers/API";
import { updateTitle } from "@/helpers/headerHelper";
import router from "@/router";
import { useRoute } from "vue-router";
import { Transporation } from "@/models/transporation";
import { useListsStore } from "@/stores/main";
import { useTrainingSimulatorContext } from "@/composables/useTrainingSimulatorContext";
import SendingCompanent from "@/components/SendingCompanent.vue";
import TrainingScenarioPanel from "@/components/training/TrainingScenarioPanel.vue";

const listsStore = useListsStore();
const { trainingContext } = useTrainingSimulatorContext();

const route = useRoute();
const document = ref(Transporation.getDefaultDocument());
const selectedPayerId = ref(null);
const saveError = ref(null);

// Допустимые группы грузов по узлу/станции (когда в БД настроены ограничения)
const cargoConstraints = ref({
  hasGroupRestrictions: false,
  cargoGroupIds: []
});

const filteredCargoGroups = computed(() => {
  const groups = listsStore.cargo_groups || {};
  if (!cargoConstraints.value?.hasGroupRestrictions) return groups;
  const allowed = new Set((cargoConstraints.value.cargoGroupIds || []).map((x) => Number(x)));
  const out = {};
  for (const [id, item] of Object.entries(groups)) {
    if (allowed.has(Number(id))) out[id] = item;
  }
  return out;
});

const watchedComputed = computed(() => Object.assign({}, document.value));

// Первая отправка из заявки (для секции «Провозная плата»)
const firstSending = computed(() => {
    const ids = document.value?.Sendings;
    if (!Array.isArray(ids) || ids.length === 0) return null;
    return listsStore.sendings[ids[0]] ?? null;
});

const firstSendingDestinationStationName = computed(() => {
    const s = firstSending.value;
    return s && listsStore.stations[s.id_station_destination]?.name ? listsStore.stations[s.id_station_destination].name : "—";
});

const firstSendingCargoName = computed(() => {
    const s = firstSending.value;
    return s && listsStore.cargos[s.id_cargo]?.name ? listsStore.cargos[s.id_cargo].name : "—";
});

// Упрощённое расстояние для учебного расчёта (в реальности берётся из справочника/карты)
const freightDistanceKm = computed(() => {
    return document.value?.freight_distance_km ?? null;
});

// Сумма вагонов по всем отправкам
const totalWagonsCount = computed(() => {
    const ids = document.value?.Sendings;
    if (!Array.isArray(ids)) return "—";
    const sendings = listsStore.sendings || {};
    const total = ids.reduce((sum, id) => {
        const s = sendings[id];
        return sum + (Number(s?.count_wagon) || 0);
    }, 0);
    return total || "—";
});

// Средняя загрузка вагона (тонн): по группе груза или 60 как норма
const avgLoadPerWagon = computed(() => {
    const g = listsStore.cargo_groups[document.value?.id_cargo_group];
    if (g && (g.min_load || g.max_load)) {
        const min = Number(g.min_load) || 0;
        const max = Number(g.max_load) || 0;
        return min && max ? `${min}–${max}` : (max || min || "—");
    }
    return "60";
});

// Расчёт провозной платы (упрощённый учебный): сумма по отправкам (вагоны × условная загрузка × тариф)
const freightCostFormatted = computed(() => {
    const ids = document.value?.Sendings;
    if (!Array.isArray(ids) || ids.length === 0) return "—";
    const distanceKm = Number(document.value?.freight_distance_km) || 500;
    const ratePerTonKm = 0.5; // условный тариф руб/(т·км) для обучения
    let total = 0;
    const sendings = listsStore.sendings || {};
    for (const id of ids) {
        const s = sendings[id];
        if (!s) continue;
        const wagons = Number(s.count_wagon) || 0;
        const weight = Number(s.weight) || wagons * 60; // тонн
        total += weight * distanceKm * ratePerTonKm;
    }
    return total ? total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "—";
});

/** API отдаёт Sendings как объекты; в БД и addSendings нужны только id */
function normalizeSendingIds(sendings) {
    if (!Array.isArray(sendings)) return [];
    return sendings
        .map((item) => {
            if (item == null) return null;
            if (typeof item === "object" && item.id != null) return Number(item.id);
            const n = Number(item);
            return Number.isFinite(n) ? n : null;
        })
        .filter((id) => id != null);
}

function normalizeDocument(data) {
    const base = Transporation.getDefaultDocument();
    const merged = Object.assign({}, base, data || {});
    merged.Sendings = normalizeSendingIds(merged.Sendings);
    return merged;
}

async function saveDocument() {
    saveError.value = null;
    if (trainingContext.value?.errorChecking) {
        const msg = Transporation.getBlockingMessage(document.value);
        if (msg) {
            saveError.value = msg;
            return;
        }
    }
    try {
        const payload = {
            ...document.value,
            Sendings: normalizeSendingIds(document.value.Sendings),
            Payers: selectedPayerId.value ? [selectedPayerId.value] : []
        };
        let saveDoc = await saveTransporation(payload);
        if (!saveDoc || saveDoc.error || !saveDoc.id) {
            saveError.value = saveDoc?.message || "Не удалось сохранить заявку. Проверьте заполненные данные.";
            return;
        }
        document.value = normalizeDocument(saveDoc);
    updateTitle("Заявка на перевозку №" + document.value.id);
        router.push("/transporation/create/" + document.value.id);
    } catch (error) {
        console.error(error);
        saveError.value = error.message || "Произошла ошибка при сохранении.";
    }
}

function copyDocument() {
    document.value.id = null;
    saveDocument();
}

function signDocument() {
    Transporation.subscribe(document.value);
    saveDocument();
}

function deleteDocument() {
    deleteTransporation(document.value);
    router.push("/menu");
}

function updateSending(sendingId) {
    const id = sendingId != null ? Number(sendingId) : NaN;
    if (!Number.isFinite(id)) return;
    if (document.value.Sendings.includes(id)) return;
    document.value.Sendings.push(id);
}

async function fetchData() {
    if (route.params.id) {
        const response = await getTransportation(route.params.id);
        if (!response || response.error) {
            saveError.value = response?.message || "Не удалось загрузить заявку.";
            document.value = normalizeDocument();
            return;
        }
        document.value = normalizeDocument(response);
        if (Array.isArray(response.Payers) && response.Payers.length > 0) {
            selectedPayerId.value = response.Payers[0].id || response.Payers[0];
        } else {
            selectedPayerId.value = null;
        }
        updateTitle("Заявка на перевозку №" + (document.value.id ?? "")); 
    } else {
        document.value = normalizeDocument();
        updateTitle("Заявка на перевозку (Новый документ)");
        selectedPayerId.value = null;
    }
}

onMounted(async () => {
    try {
        await Transporation.loadLists();
    } catch (e) {
        console.error("Ошибка загрузки справочников:", e);
    }
    fetchData();
});

watch(
  () => document.value?.id_station_departure,
  async (newStationId) => {
    try {
      if (!newStationId) {
        cargoConstraints.value = {
          hasGroupRestrictions: false,
          cargoGroupIds: []
        };
        return;
      }
      const c = await getCargoConstraints({ stationId: newStationId });
      cargoConstraints.value = {
        hasGroupRestrictions: !!c?.hasGroupRestrictions,
        cargoGroupIds: Array.isArray(c?.cargoGroupIds) ? c.cargoGroupIds : []
      };

      if (
        cargoConstraints.value.hasGroupRestrictions &&
        document.value?.id_cargo_group != null
      ) {
        const allowed = new Set(cargoConstraints.value.cargoGroupIds);
        if (!allowed.has(Number(document.value.id_cargo_group))) {
          document.value.id_cargo_group = null;
        }
      }
    } catch (e) {
      console.error('Failed to sync cargo constraints:', e);
    }
  },
  { immediate: true }
);

watch(
    watchedComputed,
    async (newVal, oldVal) => {
        Transporation.checkAutoFilledFields(newVal, oldVal);
        const tc = trainingContext.value;
        const runRequiredCheck = !tc || tc.errorChecking;
        if (runRequiredCheck) {
            Transporation.checkRequiredFields(newVal);
        }

        if (newVal.update) {
            delete newVal.update;
            document.value = Object.assign({}, newVal);
        }
    },
    { deep: true }
);
</script>

<template>
    <div class="search-box">
        <div class="row">
            <div class="col-auto">
                <simple-button @click="saveDocument" title="Сохранить"/>
                <simple-button  @click="copyDocument" v-if="document.id" title="Копировать"/>
                <simple-button @click="signDocument" v-if="document.id" title="Подписать" />
                <simple-button @click="deleteDocument" v-if="document.id" title="Испортить" />
            </div>
        </div>
        <div
            class="row mt-2"
            v-if="saveError && (!trainingContext || trainingContext.errorVisibility)"
        >
            <div class="col-auto">
                <div
                    class="alert alert-danger py-1 px-2 mb-0"
                    role="button"
                    tabindex="0"
                    style="cursor: pointer"
                    title="Скрыть сообщение"
                    @click="saveError = null"
                    @keydown.enter.prevent="saveError = null"
                    @keydown.space.prevent="saveError = null"
                >{{ saveError }}</div>
            </div>
        </div>
        <TrainingScenarioPanel doc-type="transportation" :document="document" />
    </div>
    <div class="content-container">
        <ul class="nav nav-tabs" id="myTab" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="home-tab" data-toggle="tab" data-target="#home-tab-pane" type="button" role="tab" aria-controls="home-tab-pane" aria-selected="true">Документ</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="profile-tab" data-toggle="tab" data-target="#profile-tab-pane" type="button" role="tab" aria-controls="profile-tab-pane" aria-selected="false">Учетная карточка</button>
            </li>
             <li class="nav-item" role="presentation">
                <button class="nav-link" id="profile-1-tab" data-toggle="tab" data-target="#profile-1-tab-pane" type="button" role="tab" aria-controls="profile-1-tab-pane" aria-selected="false">Провозная плата</button>
            </li>
        </ul>
        <div class="tab-content" id="myTabContent">
            <div class="tab-pane fade show active" style="margin-top: 1em" id="home-tab-pane" role="tabpanel" aria-labelledby="home-tab" tabindex="0">
                <div class="row mb-1">
                    <disable-simple-input title="Тип документа" :dis="true" :value="listsStore.document_types[document.id_document_type]?.name" :req="true" />
                </div>

                <div class="row mb-1">
                    <simple-input title="Дата регистрации" type="date" v-model="document.registration_date" :req="true" />
                </div>

                <div class="row mb-1">
                    <simple-input title="Период перевозок с" type="date" v-model="document.transportation_date_from" :req="true" />
                    <simple-input title="по" type="date" v-model="document.transportation_date_to" :req="true" :fixWidth="false" />
                </div>

                <div class="row mb-1">
                    <simple-select title="Вид сообщения" :values="listsStore.message_types" valueKey="id" name="name" v-model="document.id_message_type" :req="true" />
                </div>

                <div class="row mb-1">
                    <simple-select title="Признак отправки" :values="listsStore.signs_sending" valueKey="id" name="name" v-model="document.id_sign_sending" :req="true" />
                </div>

                <div class="row mb-1">
                    <select-with-search title="Страна отправления" :values="listsStore.countries" valueKey="id" name="name" v-model="document.id_country_departure" :req="true" modalName="CountryDeparture" :fields="{ 'Код ОСКМ': 'OSCM_code', 'Наименование страны': 'name', 'Краткое наименование': 'short_name' }" />
                </div>

                <div class="row mb-1">
                    <select-with-search title="Станция отправления/входа в СНГ" :values="listsStore.stations" valueKey="id" name="name" v-model="document.id_station_departure" :req="true" modalName="StationDeparture" :fields="{ 'Код станции': 'code', 'Наименование станции': 'name', 'Краткое наименование': 'short_name', 'Параграфы': 'paragraph' }" />
                    <disable-simple-input title="Код дороги" :dis="true" :value="listsStore.stations[document.id_station_departure]?.railway" :fixWidth="false" styleInput="width: 120px" />
                    <disable-simple-input title="Код станции" :dis="true" :value="listsStore.stations[document.id_station_departure]?.code" :fixWidth="false" styleInput="width: 120px" />
                    <disable-simple-input title="Параграфы" :dis="true" :value="listsStore.stations[document.id_station_departure]?.paragraph" :fixWidth="false" styleInput="width: auto" />
                </div>

                <div class="row mb-1">
                    <select-with-search title="Грузоотправитель" :values="listsStore.legal_entities" valueKey="id" name="name" v-model="document.id_shipper" :req="true" modalName="Shipper" :fields="{ 'Код ОКПО': 'OKPO', 'Наименование грузоотправителя': 'name', 'ИД бизнеса': 'id_business', 'ИД холдинга': 'id_holding', 'Наименование холдинга': 'name_holding' }" />
                    <disable-simple-input title="ОКПО" :dis="true" :value="listsStore.legal_entities[document.id_shipper]?.OKPO" :fixWidth="false" styleInput="width: 120px" />
                    <disable-simple-input title="Код ТГНЛ" :dis="true" :value="listsStore.legal_entities[document.id_shipper]?.TGNL_code" :fixWidth="false" styleInput="width: 120px" />
                    <disable-simple-input title="ИНН" :dis="true" :value="listsStore.legal_entities[document.id_shipper]?.INN" :fixWidth="false" styleInput="width: auto" />
                </div>

                <div class="row mb-1">
                    <simple-input title="Среди организаций при станции отправления" type="checkbox" v-model="document.is_departure_station" styleLabel="width: auto;" styleInput="width: 20px; height: 20px;"/>
                </div>

                <div class="row mb-1">
                    <disable-simple-input title="Наименование организации грузоотправителя" :dis="true" :value="listsStore.legal_entities[document.id_shipper]?.name" styleInput="width: 500px" />
                </div>

                <div class="row mb-1">
                    <simple-input title="Адрес" v-model="document.addr" styleInput="width: 500px" />
                </div>

                <div class="row mb-1">
                    <simple-select title="Принадлежность вагонов/контейнеров" :values="listsStore.ownerships" valueKey="id" name="name" v-model="document.id_carriage_ownership" :req="true" />
                </div>

                <div class="row mb-1">
                    <simple-input title="Номер договора" v-model="document.contract_number" />
                </div>

                <div class="row mb-1">
                    <select-with-search title="Владелец жд. пути необщего пользования" :values="listsStore.owners_non_public_railway" valueKey="id" name="name" v-model="document.id_owner_non_public_railway" modalName="OwnerNonPublicRailway" :fields="{ 'Код ОКПО': 'code', 'Наименование владельца пути': 'name' }" />
                </div>

                <!-- Появляются при выборе владельца жд пути необщ пользования -->
                <div class="row mb-1" v-if="document.contract_number && document.id_owner_non_public_railway">
                    <simple-select
                        title="Отметка о согласовании владельцем пути"
                        :values="[
                            { id: true, name: 'Согласовано' },
                            { id: false, name: 'Согласовано по доверенности' },
                        ]"
                        valueKey="id"
                        name="name"
                        v-model="document.is_owner_approval"
                    />
                </div>

                <div class="row mb-1" v-if="document.contract_number && document.id_owner_non_public_railway">
                    <simple-input title="Дата согласования с владельцем пути" type="date" v-model="document.owner_approval_date" />
                </div>
                <!-- ------------------------------------------------------ -->

                <div class="row mb-1">
                    <select-with-search title="Группа груза" :req="true" :values="filteredCargoGroups" valueKey="id" name="name" v-model="document.id_cargo_group" modalName="CargoGroup" :fields="{ 'Код группы груза': 'code', 'Наименование группы груза': 'name', 'Минимальная нагрузка': 'min_load', 'Максимальная нагрузка': 'max_load' }" />
                    <disable-simple-input title="Код группы груза" :dis="true" :value="listsStore.cargo_groups[document.id_cargo_group]?.code" :fixWidth="false" styleInput="width: 100px" />
                    <disable-simple-input title="Мин. норма загр. т" :dis="true" :value="listsStore.cargo_groups[document.id_cargo_group]?.min_load" :fixWidth="false" styleInput="width: 100px" />
                    <disable-simple-input title="Макс. норма загр. т" :dis="true" :value="listsStore.cargo_groups[document.id_cargo_group]?.max_load" :fixWidth="false" styleInput="width: 100px" />
                </div>

                <div class="row mb-1">
                    <simple-select title="Способ подачи" :values="listsStore.methods_submission" valueKey="id" name="name" v-model="document.id_method_submission" :req="true" />
                </div>

                <!-- Отправки -->
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" style="width: auto; font-weight: bold">Отправки</label>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <simple-button data-toggle="modal" data-target="#DobavitOtpravka" title="Добавить"/>
                        <simple-button title="Изменить"/>
                        <simple-button title="Удалить"/>
                        <simple-button title="Копировать"/>
                        <simple-button title="Вставить"/>
                    </div>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 50px">
                            <table class="table table-hover table-bordered border-white">
                                <thead style="background-color: #7da5f0; color: white">
                                    <tr>
                                        <th></th>
                                        <th>№</th>
                                        <th>Код груза</th>
                                        <th>Груз</th>
                                        <th>Род подвижного состава</th>
                                        <th>Кол-во ваг/конт</th>
                                        <th>Вес (тонн)</th>
                                        <th>Станция отправления</th>
                                        <th>Дорога</th>
                                        <th>Страна назначения</th>
                                        <th>Плата</th>
                                        <th>Валюта</th>
                                        <th>Сумма НДС</th>
                                        <th>Примечание</th>
                                        <th>Собственник вагонов</th>
                                    </tr>
                                </thead>
                                <tbody class="table-group-divider">
                                    <tr
                                        v-for="(idSending, index) in document.Sendings"
                                        :key="idSending"
                                        v-if="listsStore.sendings && listsStore.sendings[idSending]"
                                    >
                                        <td><input type="checkbox" class="row-checkbox" /></td>
                                        <td>{{ listsStore.sendings?.[idSending]?.id ?? '' }}</td>
                                        <td>{{ listsStore.cargos[listsStore.sendings?.[idSending]?.id_cargo]?.code_ETSNG ?? '' }}</td>
                                        <td>{{ listsStore.cargos[listsStore.sendings?.[idSending]?.id_cargo]?.name ?? '' }}</td>
                                        <td>{{ listsStore.rolling_stock_types[listsStore.sendings?.[idSending]?.id_rolling_stock_type]?.name ?? '' }}</td>
                                        <td>{{ listsStore.sendings?.[idSending]?.count_wagon ?? '' }}</td>
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

                <!--Создание новой Отправки модальное окно -->
                <SendingCompanent :object="document" @saveSending="updateSending"/>
                <!------------------------------->

                <!-- Стат нагрузка появляется после заполнения отправки -->
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Стат. нагрузка</label>
                    <div class="col-auto">
                        <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled="disabled" />
                    </div>
                </div>

                

                <!-- График подач -->
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" style="width: auto; font-weight: bold">График подач</label>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom">Рассчитать график подач</button>
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#staticGraficPodach">Добавить</button>
                        <button type="button" class="btn btn-custom">Изменить</button>
                        <button type="button" class="btn btn-custom">Удалить</button>
                        <button type="button" class="btn btn-custom">Копировать</button>
                        <button type="button" class="btn btn-custom">Вставить</button>
                    </div>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 50px">
                            <table class="table table-hover table-bordered border-white">
                                <thead style="background-color: #7da5f0; color: white">
                                    <tr>
                                        <th></th>
                                        <th>№</th>
                                        <th>№ отправки</th>
                                        <th>Дата подачи</th>
                                        <th>Кол-во вагонов/контейнеров</th>
                                        <th>Вес (тонн)</th>
                                        <th>Срок доставки</th>
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

                <!--Добавить График подач модальное окно -->
                <div class="modal fade" id="staticGraficPodach" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticGraficPodachLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">График подачи</span>
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
                                    <label class="col-auto col-form-label mb-0 label-custom">Отправка</label>
                                    <div class="col-3">
                                        <select class="form-select mt-0 custom-input">
                                            <option value="">Выберете элемент списка</option>
                                            <option value="">Отправка №1</option>
                                            <option value="">Отправка №2</option>
                                            <option value="">Отправка №3</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата подачи</label>
                                    <div class="col-auto">
                                        <input type="date" class="form-control mt-0 custom-input" style="width: 150px" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Вес (тонн)</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" placeholder="" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Кол-во вагонов (конт)</label>
                                    <div class="col-auto">
                                        <input type="text" class="form-control mt-0 custom-input" placeholder="" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!-- ------------------------------------------------------- -->

                <!-- Плательщики/Экспедиторы -->
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0" style="width: auto; font-weight: bold">Плательщики/Экспедиторы</label>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#staticPlatelshic">Добавить</button>
                        <button type="button" class="btn btn-custom">Изменить</button>
                        <button type="button" class="btn btn-custom">Удалить</button>
                        <button type="button" class="btn btn-custom">Копировать</button>
                        <button type="button" class="btn btn-custom">Вставить</button>
                    </div>
                </div>

                <div class="row mb-1">
                    <div class="col-auto">
                        <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 50px">
                            <table class="table table-hover table-bordered border-white">
                                <thead style="background-color: #7da5f0; color: white">
                                    <tr>
                                        <th></th>
                                        <th>№</th>
                                        <th>Код плательщика</th>
                                        <th>ОКПО</th>
                                        <th>Наименование</th>
                                        <th>Страна</th>
                                        <th>Плат/Экспед</th>
                                        <th>№ отправки</th>
                                        <th>Код перевозчика</th>
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
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!--Добавить Плательщики/Экспедиторы модальное окно -->
                <div class="modal fade" id="staticPlatelshic" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticPlatelshicLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg" style="max-width: 70%">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Плательщики/Экспедиторы</span>
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; background-color: red; margin: 0 20%">Не указано, кто платит по заявке</span>
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
                                    <label class="col-auto col-form-label mb-0 label-custom">Кто платит по заявке</label>
                                    <div class="col-3">
                                        <select class="form-select mt-0 custom-input">
                                            <option value="">Выберете элемент списка</option>
                                            <option value="">Грузоотправитель</option>
                                            <option value="">Плательщик</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Страна, за перевозку по которой, платят</label>
                                    <div class="col-auto">
                                        <select-with-search
                                            title=""
                                            :values="listsStore.countries"
                                            valueKey="id"
                                            name="name"
                                            v-model="document.id_country_departure_point"
                                            :req="false"
                                            modalName="CountryPay"
                                            :fields="{ 'Код ОСКМ': 'OSCM_code', 'Наименование страны': 'name', 'Краткое наименование': 'short_name' }"
                                        />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Плательщик/Экспедитор</label>
                                    <div class="col-auto">
                                        <select-with-search
                                            title=""
                                            :values="listsStore.payers"
                                            valueKey="id"
                                            name="name"
                                            v-model="selectedPayerId"
                                            :req="false"
                                            modalName="PayerExpeditor"
                                            :fields="{ 'Код ОКПО': 'OKPO', 'Наименование плательщика': 'name', 'Адрес': 'addr' }"
                                        />
                                    </div>

                                    <label class="col-auto col-form-label mb-0 label-custom">Код ОКПО</label>
                                    <div class="col-auto">
                                        <input
                                            type="text"
                                            class="form-control mt-0 custom-input"
                                            :value="listsStore.payers[selectedPayerId]?.OKPO || ''"
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Наименование</label>
                                    <div class="col-9">
                                        <input
                                            type="text"
                                            class="form-control mt-0 custom-input"
                                            :value="listsStore.payers[selectedPayerId]?.name || ''"
                                            placeholder=""
                                            style="min-width: 100%"
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Адрес</label>
                                    <div class="col-9">
                                        <input
                                            type="text"
                                            class="form-control mt-0 custom-input"
                                            :value="listsStore.payers[selectedPayerId]?.addr || ''"
                                            placeholder=""
                                            style="min-width: 100%"
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Примечание</label>

                                    <div class="col-9">
                                        <input
                                            type="text"
                                            class="form-control mt-0 custom-input"
                                            :value="listsStore.payers[selectedPayerId]?.note || ''"
                                            style="height: 100px; min-width: 100%"
                                            disabled
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--Найти Плательщик/Экспедитор модальное окно -->
                <div class="modal fade" id="staticPlatelshicNaity" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Плательщик/Экспедитор</span>
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
                                                <th>ИД холдинга</th>
                                                <th>Наименование холдинга</th>
                                                <th>ОКПО</th>
                                                <th>Наименование грузополучателя</th>
                                                <th>ИД бизнеса</th>
                                                <th>Наименование бизнеса</th>
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

                <!--Найти Страна, за перевозку по которой, платят модальное окно -->
                <div class="modal fade" id="staticStranaPlatel" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Страна, за перевозку по которой, платят</span>
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
                                                <th>Краткое наименование</th>
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
                <div class="row mb-1">
                    <div class="col-12">
                        <input type="text" class="form-control mt-0 custom-input" style="height: 100px; min-width: 100%" />
                    </div>
                </div>
            </div>

            <!------------------------------------------------------------------Учетная карточка------------------------------------------------------------------------------------------------------------------------------------------->

            <div class="tab-pane fade" style="margin-top: 1em" id="profile-tab-pane" role="tabpanel" aria-labelledby="profile-tab" tabindex="0">
                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="">Подписать</button>
                    </div>
                </div>
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Грузоотправитель</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="listsStore.legal_entities[document.id_shipper]?.name ?? ''"/>
                        </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Банковские реквизиты</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="document.addr ?? ''"/>
                        </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Станция отправления</label>
                    <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="listsStore.stations[document.id_station_departure]?.name ?? ''"/>
                        </div>
                    <label class="col-auto col-form-label mb-0 label-custom">Группа груза</label>
                    <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="listsStore.cargo_groups[document.id_cargo_group]?.name ?? ''"/>
                        </div>
                </div>

                <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 200px">
                    <table class="table table-hover table-bordered border-white">
                        <thead style="background-color: #7da5f0; color: white">
                            <tr>
                                <th rowspan="2"></th>
                                <th rowspan="2">Дата погрузки</th>
                                <th rowspan="2">Станция</th>
                                <th colspan="2">Заявлено</th>
                                <th>Подано</th>
                                <th colspan="2">Погружено</th>
                                <th colspan="3">Причины невыполнения заявки</th>
                                <th colspan="2">Подпись</th>
                            </tr>
                            <tr>
                                <td>Вагонов(конт.)</td>
                                <td>Тонн</td>
                                <td>Вагонов(конт.)</td>
                                <td>Вагонов(конт.)</td>
                                <td>Тонн</td>
                                <td>Общий недогруз в вагонах (конт.)</td>
                                <td>Ж.Д.</td>
                                <td>Отправитель</td>
                                <td>Станции</td>
                                <td>Грузоотправителя</td>
                            </tr>
                        </thead>
                        <tbody class="table-group-divider">
                            <tr>
                                <td><input type="checkbox" class="row-checkbox" /></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td><input style="width: 100%; height: 100%; background-color: transparent; border-color: transparent;"/></td>
                                <td><input style="width: 100%; height: 100%; background-color: transparent; border-color: transparent;"/></td>
                                <td><input style="width: 100%; height: 100%; background-color: transparent; border-color: transparent;"/></td>
                                <td data-toggle="modal" data-target="#NaityPrichiny"></td>
                                <td data-toggle="modal" data-target="#NaityPrichiny"></td>
                                <td data-toggle="modal" data-target="#NaityPrichiny"></td>
                                <td data-toggle="modal" data-target="#PodpisatSutky"></td>
                                <td data-toggle="modal" data-target="#PodpisatSutky"></td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>ИТОГО</td>
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

                <!--Найти Причины не выполнения модальное окно -->
                <div class="modal fade" id="NaityPrichiny" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Причины</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 200px">
                                    <table class="table table-hover table-bordered border-white">
                                        <thead style="background-color: #7da5f0; color: white">
                                            <tr>
                                                <th>Группа причин</th>
                                                <th>№</th>
                                                <th>Причина не выполнения</th>
                                                <th>Кол-во вагонов (конт.)</th>
                                            </tr>
                                        </thead>
                                        <tbody class="table-group-divider">
                                            <tr>
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
                    </div>
                </div>
                <!----------------------------- -->

                <div class="row mb-1">
                    <div class="col-auto">
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#DobavitDatuPogr" disabled>Добавить дату погр.</button>
                        <button type="button" class="btn btn-custom" data-toggle="modal" data-target="#UdalitDatuPodachy" disabled>Удалить дату погр.</button>
                    </div>
                </div>

                <!--Добавить дату погрузки модальное окно -->
                <div class="modal fade" id="DobavitDatuPogr" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Добавление даты погрузки</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Дата погрузки</label>
                                    <div class="col-auto">
                                        <input type="date" class="form-control mt-0 custom-input" style="width: 150px" />
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Станция назначения</label>
                                    <div class="col-3">
                                        <select class="form-select mt-0 custom-input">
                                            <option value="">Выберете элемент списка</option>
                                            <option value="">Станция №1</option>
                                            <option value="">Станция №2</option>
                                            <option value="">Станция №3</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-1">
                                    <label class="col-auto col-form-label mb-0 label-custom">Подвижной состав</label>
                                    <div class="col-3">
                                        <select class="form-select mt-0 custom-input">
                                            <option value="">Выберете элемент списка</option>
                                            <option value="">КО</option>
                                            <option value="">КО</option>
                                            <option value="">КО</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row justify-content-md-start">
                                    <button type="button" class="btn btn-custom" style="width: 70px; margin: 10px">ОК</button>
                                    <button type="button" class="btn btn-custom" data-dismiss="modal" style="width: 80px; margin: 10px">Отмена</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--Подписать учетные сутки модальное окно -->
                <div class="modal fade" id="PodpisatSutky" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Подтверждение</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-1">
                                    <label class="col-12 col-form-label mb-0 label-custom">Вы хотите подписать отчётные сутки?</label>
                                </div>
                                <div class="row justify-content-md-start">
                                    <button type="button" class="btn btn-custom" style="width: 70px; margin: 10px">ОК</button>
                                    <button type="button" class="btn btn-custom" data-dismiss="modal" style="width: 80px; margin: 10px">Отмена</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!----------------------------- -->

                <!--Подтвердить удаление даты погрузки модальное окно -->
                <div class="modal fade" id="UdalitDatuPodachy" data-backdrop="static" data-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header" style="background-color: #7da5f0">
                                <span class="modal-title text-center" id="staticBackdropLabel" style="color: white; font-weight: bold">Подтверждение</span>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Закрыть" style="color: white"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-1">
                                    <label class="col-12 col-form-label mb-0 label-custom">Вы хотите удалить дату погрузки?</label>
                                </div>
                                <div class="row justify-content-md-start">
                                    <button type="button" class="btn btn-custom" style="width: 70px; margin: 10px">ОК</button>
                                    <button type="button" class="btn btn-custom" data-dismiss="modal" style="width: 80px; margin: 10px">Отмена</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="table-responsive" style="border: #c1c1c1 solid 1px; padding-bottom: 200px">
                    <table class="table table-hover table-bordered border-white">
                        <thead style="background-color: #7da5f0; color: white">
                            <tr>
                                <th colspan="13">Ответственность за невыполнение принятой заявки, начисленная на:</th>
                                <th rowspan="4">Сальдо по штрафам</th>
                                <th rowspan="4">№НК / №Ув</th>
                            </tr>
                            <tr>
                                <td colspan="10">Грузоотправителя</td>
                                <td colspan="3">Железную дорогу</td>
                            </tr>
                            <tr>
                                <td colspan="3">Невыполненные заявки</td>
                                <td colspan="3">По дор.(ст.) назначения</td>
                                <td colspan="4">Сбор за изменение заявки</td>
                                <td colspan="3">Невыполненные заявки</td>
                            </tr>
                            <tr>
                                <td>В ваг.(конт.)</td>
                                <td>В тоннах</td>
                                <td>Сумма штрафа</td>
                                <td>В тоннах</td>
                                <td>Сумма сбора</td>
                                <td>В ваг.(конт.)</td>
                                <td>Кол-во изм.</td>
                                <td>В ваг.(конт.)</td>
                                <td>Тонн</td>
                                <td>Сумма сбора</td>
                                <td>В ваг.(конт.)</td>
                                <td>В тоннах</td>
                                <td>Сумма штрафа</td>
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
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <!-------------------------------------------------------------Конец учетной карточки------------------------------------------------------------------------->

            <!--------------------------------------------------------------Провозная плата---------------------------------------------------------------------------------------->
            <div class="tab-pane fade" style="margin-top: 1em" id="profile-1-tab-pane" role="tabpanel" aria-labelledby="profile-tab" tabindex="0">
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Станция отправления из заявки</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="listsStore.stations[document.id_station_departure]?.name ?? ''"/>
                        </div>
                    <label class="col-auto col-form-label mb-0 label-custom">Станция назначения из заявки</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="firstSendingDestinationStationName"/>
                        </div>
                </div>
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Фактическое расстояние между станциями, км</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="freightDistanceKm ?? '—'"/>
                        </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Наименование перевозимого груза из заявки</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="firstSendingCargoName"/>
                        </div>
                    <label class="col-auto col-form-label mb-0 label-custom">Тарифный класс груза</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="listsStore.cargo_groups[document.id_cargo_group]?.code ?? '—'"/>
                        </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Вид отправки из заявки</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="listsStore.send_types[firstSending?.id_send_type]?.name ?? '—'"/>
                        </div>
                    <label class="col-auto col-form-label mb-0 label-custom">Род вагонов из заявки</label>
                    <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="listsStore.rolling_stock_types[firstSending?.id_rolling_stock_type]?.name ?? '—'"/>
                        </div>
                    <label class="col-auto col-form-label mb-0 label-custom">Количество вагонов из заявки</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="totalWagonsCount"/>
                        </div>
                    <label class="col-auto col-form-label mb-0 label-custom">Загрузка одного вагона, тонн</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="avgLoadPerWagon"/>
                        </div>
                </div>
                <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Используется тарифная схема</label>
                     <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled value="Упрощённый расчёт (обучение)" />
                        </div>
                    <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled/>
                        </div>
                </div>
                  <div class="row mb-1">
                    <label class="col-auto col-form-label mb-0 label-custom">Провозная плата составляет</label>
                        <div class="col-auto">
                             <input type="text" class="form-control mt-0 disabled-input" placeholder="" disabled :value="freightCostFormatted"/>
                        </div>
                    <label class="col-auto col-form-label mb-0 label-custom">руб.</label>
                </div>

            </div>
            <!---------------------------------------------------------------Конец провозной платы---------------------------------------------------------------------------------->
        </div>
    </div>
</template>

<style scoped>
li {
    margin-left: -10px;
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
    font-size: 14px;
}
.span-custom {
    background-color: #ffffde;
    border: solid #a8a8a8 1px;
    color: black;
    height: 30px;
    padding: 3px 50px;
}

.form-check-input-checked-bg-color {
    background-color: #7da5f0;
}

.btn-box {
    width: 90%;
    position: fixed; 
}

.selected {
    background-color: #2165b6; 
    color: white;
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

.disabled-input {
            background-color: #FFFFDE; 
            opacity: 1;
            height: 30px;
            width: 270px;
            font-family: "Open Sans", sans-serif;
            font-size: 14px;
            border: 1px solid #C1C1C1;
            
        }
        .custom-input {
            background-color: #E3E2FF; 
            height: 30px;
            font-family: "Open Sans", sans-serif;
            font-size: 14px;
            width: 270px;
            border: 1px solid #C1C1C1;
            
        }
        .input-group .form-control {
            background-color: #E3E2FF; 
            border: 1px solid #C1C1C1; 
            height: 30px;
            font-family: "Open Sans", sans-serif;
            font-size: 14px;
            
        }
        .input-group .btn {
            background-color: #E3E2FF;
            border: 1px solid #C1C1C1; 
            height: 30px;
            font-family: "Open Sans", sans-serif;
            font-size: 14px;
        }
        .input-group .btn:hover {
            background-color: #D1D0FF; 
        }
        .label-custom{
            width: 180px;
        }
        .form-check-input-checked-bg-color{
            background-color:  #7DA5F0;;
        }
</style>
