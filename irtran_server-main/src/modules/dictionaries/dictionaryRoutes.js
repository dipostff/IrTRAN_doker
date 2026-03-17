//-----------Подключаемые модули-----------//
const express = require('express');
const keycloakAuth = require('../auth/keycloakAuth');
const sequelize = require('../sequelize/db');
//-----------Подключаемые модули-----------//

const queryInterface = sequelize.getQueryInterface();

// Разрешённые справочники. Ключ используется на фронтенде.
// Таблицы уже существуют в БД и используются формами документов.
const DICTIONARIES = {
  countries: {
    table: 'countries',
    label: 'Страны',
    fieldLabels: {
      name: 'Наименование страны',
      short_name: 'Краткое наименование',
      OSCM_code: 'Код ОКСМ',
      COATO_code: 'Код ОКАТО',
      OSZhD_code: 'Код ОСЖД',
      type_state: 'Тип государства',
      administration_code_digit: 'Цифровой код администрации',
      administration_code_symbol: 'Буквенный код администрации',
      order_number: 'Порядковый номер',
      country_code_ISO_3166: 'Код ISO 3166'
    },
    fieldOrder: [
      'name',
      'short_name',
      'OSCM_code',
      'COATO_code',
      'OSZhD_code',
      'type_state',
      'administration_code_digit',
      'administration_code_symbol',
      'order_number',
      'country_code_ISO_3166'
    ]
  },
  stations: {
    table: 'stations',
    label: 'Станции',
    fieldLabels: {
      name: 'Наименование станции',
      code: 'Код станции',
      road: 'Дорога',
      node: 'Узел'
    }
  },
  legal_entities: {
    table: 'legal_entities',
    label: 'Юридические лица',
    fieldLabels: {
      title: 'Наименование организации',
      inn: 'ИНН',
      kpp: 'КПП',
      code: 'Код',
      short_name: 'Краткое наименование'
    }
  },
  owners_non_public_railway: {
    table: 'owners_non_public_railway',
    label: 'Владельцы ж/д путей необщего пользования',
    fieldLabels: {
      name: 'Наименование владельца',
      code: 'Код владельца'
    }
  },
  transport_package_types: {
    table: 'transport_package_types',
    label: 'Виды транспортной упаковки',
    fieldLabels: {
      code: 'Код вида упаковки',
      name: 'Наименование вида упаковки'
    }
  },
  rolling_stock_types: {
    table: 'rolling_stock_types',
    label: 'Виды подвижного состава',
    fieldLabels: {
      code: 'Код рода подвижного состава',
      name: 'Наименование рода подвижного состава'
    }
  },
  destination_indications: {
    table: 'destination_indications',
    label: 'Признаки назначения/станций',
    fieldLabels: {
      name: 'Наименование признака',
      code: 'Код признака'
    }
  },
  contracts: {
    table: 'contracts',
    label: 'Договоры/контракты',
    fieldLabels: {
      code: 'Код договора',
      short_name: 'Обозначение договора',
      title: 'Полное наименование договора'
    }
  },
  payer_types: {
    table: 'payer_types',
    label: 'Виды плательщиков',
    fieldLabels: {
      name: 'Наименование вида плательщика'
    }
  },
  payers: {
    table: 'payers',
    label: 'Плательщики / экспедиторы',
    fieldLabels: {
      id_payer_type: 'Тип плательщика',
      id_country_transportation: 'Страна перевозки',
      id_payer: 'Организация-плательщик',
      OKPO: 'ОКПО',
      name: 'Наименование плательщика',
      addr: 'Адрес',
      note: 'Примечание'
    }
  },
  cargo_groups: {
    table: 'cargo_groups',
    label: 'Группы грузов',
    fieldLabels: {
      name: 'Наименование группы груза',
      code: 'Код группы груза',
      min_load: 'Минимальная масса груза (тонн)',
      max_load: 'Максимальная масса груза (тонн)'
    }
  },
  cargo: {
    table: 'cargo',
    label: 'Грузы',
    fieldLabels: {
      name: 'Наименование груза',
      short_name: 'Краткое наименование',
      code_ETSNG: 'Код ЕТ СНГ / ГНГ',
      number_group: 'Номер группы груза',
      name_group: 'Наименование группы груза'
    }
  },
  ownerships: {
    table: 'ownerships',
    label: 'Формы собственности вагонов',
    fieldLabels: {
      name: 'Наименование формы собственности',
      code: 'Код формы собственности'
    }
  },
  speed_types: {
    table: 'speed_types',
    label: 'Виды скорости перевозки',
    fieldLabels: {
      name: 'Наименование вида скорости',
      code: 'Код вида скорости'
    }
  },
  methods_submission: {
    table: 'methods_submission',
    label: 'Способы подачи вагонов',
    fieldLabels: {
      name: 'Наименование способа подачи',
      code: 'Код способа подачи'
    }
  },
  send_types: {
    table: 'send_types',
    label: 'Виды отправок',
    fieldLabels: {
      name: 'Наименование вида отправки',
      code_IODV: 'Код ИОДВ',
      abbreviation: 'Сокращённое обозначение',
      code_CO_11: 'Код СО-11'
    }
  },
  signs_sending: {
    table: 'signs_sending',
    label: 'Признаки отправки',
    fieldLabels: {
      name: 'Наименование признака отправки',
      code: 'Код признака отправки'
    }
  }
};

// Кэш описаний таблиц, чтобы не вызывать describeTable на каждый запрос.
const tableMetaCache = new Map();

async function getTableMeta(dictKey) {
  const def = DICTIONARIES[dictKey];
  if (!def) {
    const err = new Error('unknown_dictionary');
    err.statusCode = 400;
    throw err;
  }
  const cacheKey = def.table;
  if (tableMetaCache.has(cacheKey)) {
    return tableMetaCache.get(cacheKey);
  }
  const meta = await queryInterface.describeTable(def.table);
  tableMetaCache.set(cacheKey, meta);
  return meta;
}

/**
 * Регистрация маршрутов для работы со справочниками.
 *
 * Доступ:
 *  - только пользователи с ролью dictionary-admin или app-admin.
 */
function registerDictionaryRoutes(app) {
  const router = express.Router();

  // Список доступных справочников
  router.get(
    '/api/dictionaries',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['dictionary-admin', 'app-admin']),
    (req, res) => {
      const items = Object.entries(DICTIONARIES).map(([key, def]) => ({
        key,
        label: def.label,
        table: def.table
      }));
      res.json(items);
    }
  );

  // Метаданные полей таблицы
  router.get(
    '/api/dictionaries/:key/meta',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['dictionary-admin', 'app-admin']),
    async (req, res) => {
      try {
        const dictKey = req.params.key;
        const def = DICTIONARIES[dictKey];
        if (!def) {
          return res.status(400).json({ error: 'unknown_dictionary' });
        }
        const meta = await getTableMeta(dictKey);
        res.json({
          columns: meta,
          fieldLabels: def.fieldLabels || {},
          fieldOrder: def.fieldOrder || null
        });
      } catch (error) {
        if (error.statusCode) {
          return res.status(error.statusCode).json({
            error: error.message
          });
        }
        console.error('Error getting dictionary meta:', error);
        return res.status(500).json({
          error: 'dictionary_meta_failed',
          message: 'Не удалось получить структуру справочника.'
        });
      }
    }
  );

  // Получить строки справочника
  router.get(
    '/api/dictionaries/:key/rows',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['dictionary-admin', 'app-admin']),
    async (req, res) => {
      try {
        const dictKey = req.params.key;
        const def = DICTIONARIES[dictKey];
        if (!def) {
          return res.status(400).json({ error: 'unknown_dictionary' });
        }
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = parseInt(req.query.offset, 10) || 0;

        const [rows] = await sequelize.query(
          `SELECT * FROM \`${def.table}\` ORDER BY id LIMIT :limit OFFSET :offset`,
          {
            replacements: { limit, offset }
          }
        );

        res.json({ items: rows, limit, offset });
      } catch (error) {
        console.error('Error loading dictionary rows:', error);
        res.status(500).json({
          error: 'dictionary_rows_failed',
          message: 'Не удалось загрузить данные справочника.'
        });
      }
    }
  );

  // Создать строку в справочнике
  router.post(
    '/api/dictionaries/:key/rows',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['dictionary-admin', 'app-admin']),
    async (req, res) => {
      try {
        const dictKey = req.params.key;
        const def = DICTIONARIES[dictKey];
        if (!def) {
          return res.status(400).json({ error: 'unknown_dictionary' });
        }
        const meta = await getTableMeta(dictKey);
        const body = req.body || {};

        // Разрешённые поля: все, кроме id и авто‑полей (created_at/updated_at и т.п.)
        const allowedColumns = Object.keys(meta).filter((col) => {
          const lower = col.toLowerCase();
          if (lower === 'id') return false;
          if (lower === 'created_at' || lower === 'updated_at') return false;
          return true;
        });

        const data = {};
        allowedColumns.forEach((col) => {
          if (Object.prototype.hasOwnProperty.call(body, col)) {
            data[col] = body[col];
          }
        });

        if (Object.keys(data).length === 0) {
          return res.status(400).json({
            error: 'no_fields',
            message: 'Не переданы данные для создания записи.'
          });
        }

        const columnsSql = Object.keys(data)
          .map((c) => `\`${c}\``)
          .join(', ');
        const valuesPlaceholders = Object.keys(data)
          .map((c) => `:${c}`)
          .join(', ');

        const [result] = await sequelize.query(
          `INSERT INTO \`${def.table}\` (${columnsSql}) VALUES (${valuesPlaceholders})`,
          {
            replacements: data
          }
        );

        const insertedId =
          result && typeof result.insertId === 'number'
            ? result.insertId
            : null;

        if (!insertedId) {
          return res.status(201).json({ ok: true });
        }

        const [rows] = await sequelize.query(
          `SELECT * FROM \`${def.table}\` WHERE id = :id`,
          { replacements: { id: insertedId } }
        );

        return res.status(201).json(rows[0] || { id: insertedId });
      } catch (error) {
        console.error('Error creating dictionary row:', error);
        return res.status(500).json({
          error: 'dictionary_create_failed',
          message: 'Не удалось создать запись справочника.'
        });
      }
    }
  );

  // Обновить строку справочника
  router.patch(
    '/api/dictionaries/:key/rows/:id',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['dictionary-admin', 'app-admin']),
    async (req, res) => {
      try {
        const dictKey = req.params.key;
        const def = DICTIONARIES[dictKey];
        if (!def) {
          return res.status(400).json({ error: 'unknown_dictionary' });
        }
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({ error: 'bad_id' });
        }

        const meta = await getTableMeta(dictKey);
        const body = req.body || {};

        const allowedColumns = Object.keys(meta).filter((col) => {
          const lower = col.toLowerCase();
          if (lower === 'id') return false;
          if (lower === 'created_at' || lower === 'updated_at') return false;
          return true;
        });

        const data = {};
        allowedColumns.forEach((col) => {
          if (Object.prototype.hasOwnProperty.call(body, col)) {
            data[col] = body[col];
          }
        });

        if (Object.keys(data).length === 0) {
          return res.status(400).json({
            error: 'no_fields',
            message: 'Не переданы данные для обновления записи.'
          });
        }

        const setSql = Object.keys(data)
          .map((c) => `\`${c}\` = :${c}`)
          .join(', ');

        await sequelize.query(
          `UPDATE \`${def.table}\` SET ${setSql} WHERE id = :id`,
          {
            replacements: { ...data, id }
          }
        );

        const [rows] = await sequelize.query(
          `SELECT * FROM \`${def.table}\` WHERE id = :id`,
          { replacements: { id } }
        );

        return res.json(rows[0] || { id });
      } catch (error) {
        console.error('Error updating dictionary row:', error);
        return res.status(500).json({
          error: 'dictionary_update_failed',
          message: 'Не удалось обновить запись справочника.'
        });
      }
    }
  );

  // Удалить строку справочника
  router.delete(
    '/api/dictionaries/:key/rows/:id',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['dictionary-admin', 'app-admin']),
    async (req, res) => {
      try {
        const dictKey = req.params.key;
        const def = DICTIONARIES[dictKey];
        if (!def) {
          return res.status(400).json({ error: 'unknown_dictionary' });
        }
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({ error: 'bad_id' });
        }

        await sequelize.query(
          `DELETE FROM \`${def.table}\` WHERE id = :id LIMIT 1`,
          { replacements: { id } }
        );

        return res.json({ ok: true });
      } catch (error) {
        console.error('Error deleting dictionary row:', error);
        return res.status(500).json({
          error: 'dictionary_delete_failed',
          message: 'Не удалось удалить запись справочника.'
        });
      }
    }
  );

  app.use(router);
}

module.exports = {
  registerDictionaryRoutes,
  DICTIONARIES
};

