//-----------Подключаемые модули-----------//
const WorkerController = require('./../worker/WorkerController');
const bodyParser = require('body-parser');
const config_restapi = require('./../../../config/restapi.json');
const config_app = require('./../../../config/app.json');
const sequelize = require('./../sequelize/db');
const keycloakAuth = require('./../auth/keycloakAuth');
//-----------Подключаемые модули-----------//

/**
 * Класс для работы с Post запросами к серверу
 */
class Post {
  /** Объект для работы с сервером */
  app;
  /** Массив обрабатываемых маршрутов */
  routes;

  /** Конструктор класса */
  constructor(app) {
    this.app = app;
    this.routes = config_restapi.POST;
    this.PostBodyParser();
    this.ListPost();
  }

  /**
   * Список всех обрабатываемых сервером Post запросов
   */
  ListPost() {
    // Применяем аутентификацию Keycloak ко всем маршрутам, если она включена
    const authMiddleware = config_app.enable_auth ? keycloakAuth.verifyToken() : (req, res, next) => next();
    
    for(let i = 0; i < this.routes.length; i++) {
      this.app.post(this.routes[i], authMiddleware, (req, res) => {
        // Привязка заявок на перевозку к пользователю (Keycloak sub)
        if (this.routes[i] === '/requests_transportation' && req.body && req.body.act === 'create' && req.body.object && req.user && req.user.sub) {
          req.body.object.user_id = req.user.sub;
        }
        req.query.type_request = `POST ${this.routes[i]}`;
        WorkerController.HandleRequest(req, res);
      });
    }
  }

  /**
   * 
   */
  PostBodyParser() {
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());
  }

  /**
   * Функция, которая обрабатывает CRUD-операции
   */
  static async CRUD(message, model) {
    // Проверка наличия связей many-to-many
    let hasManyToMany = Object.values(model.associations).some(
      association => association.associationType === 'BelongsToMany'
    );
    // Получаем список всех many-to-many
    let modelAssociations;
    if(hasManyToMany) {
      modelAssociations = Object.values(model.associations)
        .filter(a => a.associationType === 'BelongsToMany')
        .map(a => a.as);
    }

    if(message.body.act == 'create') {
      let result;
      try {
        const payload = { ...message.body.object };
        if (hasManyToMany) {
          for (const association of modelAssociations) {
            delete payload[association];
          }
        }
        result = await model.create(payload);

        if(hasManyToMany) {
          for(let association of modelAssociations) {
            if(message.body.object[association] !== undefined) {
              await result[`add${association}`](message.body.object[association]);
            }
          }
        }

        return result.dataValues;
      } catch (error) {
        console.error(`Error creating ${model.name}:`, error);
        if (error.name === 'SequelizeForeignKeyConstraintError') {
          return {
            error: 'foreign_key_violation',
            message: 'Связанный объект не найден. Проверьте выбранные справочные значения.',
            details: {
              table: error.table,
              fields: error.fields,
              value: error.value
            }
          };
        }
        return {
          error: 'database_error',
          message: error.message
        };
      }
    }
    else if(message.body.act == 'read') {
      let params = {};

      if(hasManyToMany) {
        params.include = modelAssociations;
      }

      if(message.body.selection_type == "one") {
        return await model.findByPk(message.body.object.id, params);
      }
      else if(message.body.selection_type == "all") {
        return await model.findAll(params);
      }
    }
    else if(message.body.act == 'update') {
      try {
        if (!message.body.object || !message.body.object.id) {
          return { error: 'id_required', message: 'Не указан идентификатор объекта для обновления.' };
        }
        const id = message.body.object.id;
        const instance = await model.findByPk(id);
        if (!instance) {
          return { error: 'not_found', message: `${model.name} с указанным id не найден.` };
        }

        const dataToUpdate = { ...message.body.object };
        delete dataToUpdate.id;
        if (hasManyToMany) {
          for (const association of modelAssociations) {
            delete dataToUpdate[association];
          }
        }

        await instance.update(dataToUpdate);

        if (hasManyToMany) {
          for (const association of modelAssociations) {
            if (message.body.object[association] !== undefined) {
              await instance[`set${association}`](message.body.object[association]);
            }
          }
        }

        return instance.dataValues;
      } catch (error) {
        console.error(`Error updating ${model.name}:`, error);
        if (error.name === 'SequelizeForeignKeyConstraintError') {
          return {
            error: 'foreign_key_violation',
            message: 'Связанный объект не найден. Проверьте выбранные справочные значения.',
            details: {
              table: error.table,
              fields: error.fields,
              value: error.value
            }
          };
        }
        return {
          error: 'database_error',
          message: error.message
        };
      }
    }
    else if(message.body.act == 'delete') {

    }
    else {
      return "bad act";
    }
  }
}

//-----------Экспортируемые модули-----------//
module.exports = Post;
//-----------Экспортируемые модули-----------//










