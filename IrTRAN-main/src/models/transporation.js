import { getDocumentTypes, getMessageTypes, getSignsSending, getCountries, getLegalEntities, getOwnerships, getOwnersNonPublicRailway, getApprovalsWithOwner, getCargoGroups, getMethodsSubmission, getStations, getSendings, getCargos, getTransportPackageTypes, getSendTypes, getRollingStockTypes, getSpeedTypes, getDestinationIndications, getContracts, getPayers } from "@/helpers/API";
import { updateSubtitle } from "@/helpers/headerHelper";
import { useListsStore } from "@/stores/main";
import { getDiffDays } from "@/helpers/dateHelper";

const listsStore = useListsStore();
const date = new Date().toISOString().split("T")[0];

export class Transporation {
    static getRequiredFields() {
        return {
            id_document_type: "Нет типа документа",
            registration_date: "Нет даты регистрации документа",
            transportation_date_from: "Нет дат периода перевозок",
            transportation_date_to: "Нет дат периода перевозок",
            id_message_type: "Не выбран вид сообщения",
            id_sign_sending: "Не указан признак отправки",
            id_country_departure: "Не указана страна отправления",
            id_station_departure: "Не указана станция отправления/входа в СНГ",
            id_shipper: "Не указан грузоотправитель",
            id_carriage_ownership: "Не указана принадлежность вагонов/контейнеров",
            id_cargo_group: "Не указана группа груза",
            id_method_submission: "Не указан способ подачи",
        };
    }

    static getDefaultDocument() {
        return {
            id_document_type: 4,
            registration_date: date,
            Sendings: [],
        };
    }

    static getStatus() {
        return {
            0: "Хз",
            1: "Хз",
            2: "Подписан",
            null: "Хз",
        };
    }

    static checkSignature(object) {
        return object.document_status === 2;
    }

    static subscribe(object) {
        object.document_status = 2;
    }

    static checkAutoFilledFields(newVal, oldVal) {
        if (newVal.id_message_type !== oldVal.id_message_type) {
            if (listsStore.message_types[newVal.id_message_type]?.name === "Прямое" || listsStore.message_types[newVal.id_message_type]?.name === "Местное") {
                let filterCountries = Object.values(listsStore.countries).filter((item) => item.name == "Российская Федерация");
                let idRussia = filterCountries.length ? filterCountries[0].id : null;
                newVal.id_country_departure = idRussia;
                newVal.update = true;
            }
        }
    }

    static async loadLists() {
        await Promise.all([
            getDocumentTypes(),
            getMessageTypes(),
            getSignsSending(),
            getCountries(),
            getLegalEntities(),
            getOwnerships(),
            getOwnersNonPublicRailway(),
            getApprovalsWithOwner(),
            getCargoGroups(),
            getMethodsSubmission(),
            getStations(),
            getSendings(),
            getCargos(),
            getTransportPackageTypes(),
            getSendTypes(),
            getRollingStockTypes(),
            getSpeedTypes(),
            getDestinationIndications(),
            getContracts(),
            getPayers(),
        ]);
    }

    /**
     * Сообщение о блокирующей ошибке перед сохранением или null, если можно сохранять.
     * Используется тренажёром при включённой «Проверке ошибок».
     */
    static getBlockingMessage(object) {
        if (Transporation.checkSignature(object)) {
            return null;
        }

        const requiredFields = this.getRequiredFields();
        for (const field in requiredFields) {
            if (!object[field]) {
                return requiredFields[field];
            }
        }

        const dateMsg = Transporation.getDateValidationMessage(object);
        if (dateMsg) return dateMsg;

        if (!object.Sendings || object.Sendings.length === 0) {
            return "Не указаны отправки";
        }

        return null;
    }

    static checkRequiredFields(object) {
        updateSubtitle("");

        const msg = Transporation.getBlockingMessage(object);
        if (msg) {
            updateSubtitle(msg);
        }
    }

    static getDateValidationMessage(object) {
        if (object.registration_date < date) {
            return "Дата регистрации должна быть не раньше текущей даты";
        }
        if (object.transportation_date_from > object.transportation_date_to) {
            return "Начало перевозки должно быть раньше конца перевозки";
        }
        if (object.transportation_date_from < date || object.transportation_date_to < date) {
            return "Период перевозок должен быть не раньше текущей даты";
        }
        if (getDiffDays(object.transportation_date_from, object.transportation_date_to) > 45) {
            return "Перевозка превышает 45 дней";
        }
        return null;
    }

    static checkCorrectDate(object) {
        const msg = Transporation.getDateValidationMessage(object);
        if (msg) {
            updateSubtitle(msg);
            return;
        }
        return true;
    }
}
