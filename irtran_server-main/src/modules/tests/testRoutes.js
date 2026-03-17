//-----------Подключаемые модули-----------//
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const keycloakAuth = require('./../auth/keycloakAuth');
const Question = require('./../../models/Question');
const Test = require('./../../models/Test');
const TestVariant = require('./../../models/TestVariant');
const TestVariantQuestion = require('./../../models/TestVariantQuestion');
const TestQuestion = require('./../../models/TestQuestion');
const TestAttempt = require('./../../models/TestAttempt');
//-----------Подключаемые модули-----------//

const questionsUploadDir =
  process.env.QUESTIONS_UPLOAD_DIR ||
  path.join(__dirname, '../../../uploads/questions');

if (!fs.existsSync(questionsUploadDir)) {
  fs.mkdirSync(questionsUploadDir, { recursive: true });
}

const questionImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, questionsUploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, unique + ext);
  }
});

const uploadQuestionImage = multer({
  storage: questionImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP).'));
    }
  }
});

function buildSurveyQuestionFromModel(question, points) {
  const base = {
    name: question.code || `q_${question.id}`,
    title: question.text,
    type: question.type || 'radiogroup'
  };

  if (question.options) {
    base.choices = question.options;
  }

  if (question.correct_answer !== undefined && question.correct_answer !== null) {
    base.correctAnswer = question.correct_answer;
  }

  if (question.image_path) {
    base.imagePath = `/api/questions/${question.id}/image`;
  }

  if (points != null) {
    base.points = points;
  }

  return base;
}

async function buildSurveySchemaForTest(test, options = {}) {
  const { variantId, shuffleSingle } = options;

  let questions = [];
  let variantQuestions = [];
  let testQuestions = [];

  if (test.variant_mode === 'per_variant') {
    let variant;
    if (variantId) {
      variant = await TestVariant.findOne({
        where: { id: variantId, test_id: test.id }
      });
    }
    if (!variant) {
      variant = await TestVariant.findOne({
        where: { test_id: test.id },
        order: [['id', 'ASC']]
      });
    }
    if (!variant) {
      return null;
    }

    variantQuestions = await TestVariantQuestion.findAll({
      where: { variant_id: variant.id },
      order: [['order', 'ASC']]
    });
    const questionIds = variantQuestions.map((vq) => vq.question_id);
    questions = await Question.findAll({
      where: { id: { [Op.in]: questionIds } }
    });

    // Упорядочиваем в соответствии с order
    const byId = new Map(questions.map((q) => [q.id, q]));
    questions = variantQuestions
      .map((vq) => byId.get(vq.question_id))
      .filter(Boolean);
  } else {
    // single_shuffled
    testQuestions = await TestQuestion.findAll({
      where: { test_id: test.id },
      order: [['order', 'ASC']]
    });
    const questionIds = testQuestions.map((tq) => tq.question_id);
    questions = await Question.findAll({
      where: { id: { [Op.in]: questionIds } }
    });

    const byId = new Map(questions.map((q) => [q.id, q]));
    questions = testQuestions
      .map((tq) => byId.get(tq.question_id))
      .filter(Boolean);

    if (shuffleSingle) {
      questions = questions
        .map((q) => ({ q, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((x) => x.q);
    }
  }

  // Баллы берём из связующих таблиц (если есть)
  let pointsByQuestionId = new Map();

  if (test.variant_mode === 'per_variant') {
    // Для per_variant баллы в test_variant_questions (используем уже загруженные variantQuestions)
    pointsByQuestionId = new Map(
      (variantQuestions || []).map((vq) => [vq.question_id, vq.points || 1])
    );
  } else {
    // Для single_shuffled баллы в test_questions (используем уже загруженные testQuestions)
    pointsByQuestionId = new Map(
      (testQuestions || []).map((tq) => [tq.question_id, tq.points || 1])
    );
  }

  const surveyQuestions = questions.map((q) =>
    buildSurveyQuestionFromModel(q, pointsByQuestionId.get(q.id) || 1)
  );

  return {
    title: test.title,
    description: test.description,
    pages: [
      {
        name: 'page1',
        elements: surveyQuestions
      }
    ]
  };
}

/**
 * Регистрация маршрутов для банка заданий и тестов.
 *
 * - Управление вопросами и тестами: teacher/app-admin.
 * - Получение структуры теста для прохождения: любой авторизованный пользователь.
 */
function registerTestRoutes(app) {
  const router = express.Router();

  function parseQuestionBody(body) {
    const code = body.code;
    let text = body.text;
    const type = body.type || 'radiogroup';
    let options = body.options;
    let correctAnswer = body.correctAnswer;
    const difficulty = body.difficulty;
    const tags = body.tags;
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (_) {
        options = null;
      }
    }
    if (typeof correctAnswer === 'string') {
      try {
        correctAnswer = JSON.parse(correctAnswer);
      } catch (_) {
        correctAnswer = correctAnswer;
      }
    }
    return { code, text, type, options, correctAnswer, difficulty, tags };
  }

  // Создание вопроса (только teacher/app-admin), с опциональной картинкой
  router.post(
    '/api/questions',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    uploadQuestionImage.single('image'),
    async (req, res) => {
      try {
        const body = req.body || {};
        const { text, type, options, correctAnswer, difficulty, tags, code } = parseQuestionBody(body);
        const textStr = typeof text === 'string' ? text.trim() : '';

        if (!textStr) {
          return res.status(400).json({
            error: 'text_required',
            message: 'Необходимо указать текст вопроса.'
          });
        }

        const user = req.user || {};
        const createdBy = user.sub || null;
        const now = new Date();
        const imagePath = req.file ? req.file.path : null;

        const question = await Question.create({
          code: code || null,
          text: textStr,
          type: type || 'radiogroup',
          options: options || null,
          correct_answer: correctAnswer !== undefined ? correctAnswer : null,
          difficulty: difficulty || null,
          tags: tags || null,
          image_path: imagePath,
          created_by_user_id: createdBy,
          created_at: now,
          updated_at: now
        });

        return res.status(201).json(question);
      } catch (error) {
        console.error('Error creating question:', error);
        const msg = (error.original && error.original.code === 'ER_BAD_FIELD_ERROR') || (error.message && error.message.includes('image_path'))
          ? 'В таблице questions отсутствует колонка image_path. Выполните миграции: npx sequelize-cli db:migrate'
          : 'Не удалось создать вопрос.';
        return res.status(500).json({
          error: 'create_failed',
          message: msg
        });
      }
    }
  );

  // Получение списка вопросов (только teacher/app-admin)
  router.get(
    '/api/questions',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const q = (req.query.q || '').trim();
        const limit = Math.min(
          parseInt(req.query.limit, 10) || 50,
          100
        );
        const offset = parseInt(req.query.offset, 10) || 0;

        const where = {};

        if (q) {
          where[Op.or] = [
            { text: { [Op.like]: `%${q}%` } },
            { tags: { [Op.like]: `%${q}%` } }
          ];
        }

        const { rows, count } = await Question.findAndCountAll({
          where,
          limit,
          offset,
          order: [['created_at', 'DESC']]
        });

        return res.json({
          items: rows,
          total: count
        });
      } catch (error) {
        console.error('Error listing questions:', error);
        const msg = (error.original && error.original.code === 'ER_BAD_FIELD_ERROR') || (error.message && error.message.includes('image_path'))
          ? 'В таблице questions отсутствует колонка image_path. Выполните миграции: npx sequelize-cli db:migrate'
          : 'Не удалось загрузить список вопросов.';
        return res.status(500).json({
          error: 'list_failed',
          message: msg
        });
      }
    }
  );

  // Случайные вопросы из банка (для конструктора тестов)
  router.get(
    '/api/questions/random',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const count = Math.min(
          Math.max(1, parseInt(req.query.count, 10) || 1),
          100
        );
        const total = await Question.count();
        const rows = await Question.findAll({
          attributes: ['id'],
          order: [Question.sequelize.fn('RAND')],
          limit: count
        });
        const ids = rows.map((r) => r.id);
        return res.json({ ids, total });
      } catch (error) {
        console.error('Error getting random questions:', error);
        return res.status(500).json({
          error: 'random_failed',
          message: 'Не удалось получить случайные вопросы.'
        });
      }
    }
  );

  // Один вопрос по id (для редактирования)
  router.get(
    '/api/questions/:id',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({
            error: 'bad_id',
            message: 'Некорректный идентификатор вопроса.'
          });
        }
        const question = await Question.findByPk(id);
        if (!question) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Вопрос не найден.'
          });
        }
        return res.json(question);
      } catch (error) {
        console.error('Error getting question:', error);
        return res.status(500).json({
          error: 'get_failed',
          message: 'Не удалось загрузить вопрос.'
        });
      }
    }
  );

  // Картинка вопроса (доступна авторизованным при прохождении теста)
  router.get(
    '/api/questions/:id/image',
    keycloakAuth.verifyToken(),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({
            error: 'bad_id',
            message: 'Некорректный идентификатор вопроса.'
          });
        }
        const question = await Question.findByPk(id);
        if (!question || !question.image_path) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Изображение не найдено.'
          });
        }
        if (!fs.existsSync(question.image_path)) {
          return res.status(404).json({
            error: 'file_missing',
            message: 'Файл изображения отсутствует.'
          });
        }
        return res.sendFile(path.resolve(question.image_path));
      } catch (error) {
        console.error('Error serving question image:', error);
        return res.status(500).json({
          error: 'image_failed',
          message: 'Не удалось отдать изображение.'
        });
      }
    }
  );

  // Обновление вопроса (только teacher/app-admin)
  router.put(
    '/api/questions/:id',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    uploadQuestionImage.single('image'),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({
            error: 'bad_id',
            message: 'Некорректный идентификатор вопроса.'
          });
        }
        const question = await Question.findByPk(id);
        if (!question) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Вопрос не найден.'
          });
        }
        const body = req.body || {};
        const { text, type, options, correctAnswer, difficulty, tags, code } = parseQuestionBody(body);
        if (typeof text === 'string' && text.trim()) {
          question.text = text.trim();
        }
        if (type) question.type = type;
        if (options !== undefined) question.options = options;
        if (correctAnswer !== undefined) question.correct_answer = correctAnswer;
        if (difficulty !== undefined) question.difficulty = difficulty;
        if (tags !== undefined) question.tags = tags;
        if (code !== undefined) question.code = code;
        if (req.file) {
          if (question.image_path && fs.existsSync(question.image_path)) {
            try {
              fs.unlinkSync(question.image_path);
            } catch (_) {}
          }
          question.image_path = req.file.path;
        }
        question.updated_at = new Date();
        await question.save();
        return res.json(question);
      } catch (error) {
        console.error('Error updating question:', error);
        return res.status(500).json({
          error: 'update_failed',
          message: 'Не удалось обновить вопрос.'
        });
      }
    }
  );

  // Удаление вопроса из банка (только teacher/app-admin)
  router.delete(
    '/api/questions/:id',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({
            error: 'bad_id',
            message: 'Некорректный идентификатор вопроса.'
          });
        }
        const question = await Question.findByPk(id);
        if (!question) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Вопрос не найден.'
          });
        }
        if (question.image_path && fs.existsSync(question.image_path)) {
          try {
            fs.unlinkSync(question.image_path);
          } catch (_) {}
        }
        await question.destroy();
        return res.status(204).send();
      } catch (error) {
        console.error('Error deleting question:', error);
        return res.status(500).json({
          error: 'delete_failed',
          message: 'Не удалось удалить вопрос.'
        });
      }
    }
  );

  // Создание теста (оба режима вариантов)
  router.post(
    '/api/tests',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      const transaction = await Test.sequelize.transaction();
      try {
        const {
          title,
          description,
          variantMode,
          variants,
          questionIds,
          questions,
          passPercent,
          maxAttempts
        } = req.body || {};

        if (!title || !title.trim()) {
          await transaction.rollback();
          return res.status(400).json({
            error: 'title_required',
            message: 'Необходимо указать название теста.'
          });
        }

        if (variantMode !== 'per_variant' && variantMode !== 'single_shuffled') {
          await transaction.rollback();
          return res.status(400).json({
            error: 'variant_mode_invalid',
            message:
              'variantMode должен быть per_variant или single_shuffled.'
          });
        }

        const user = req.user || {};
        const createdBy = user.sub || null;
        const now = new Date();

        const test = await Test.create(
          {
            title: title.trim(),
            description: description || '',
            variant_mode: variantMode,
            pass_percent:
              typeof passPercent === 'number'
                ? Math.max(0, Math.min(100, passPercent))
                : null,
            max_attempts:
              typeof maxAttempts === 'number' && maxAttempts > 0
                ? Math.floor(maxAttempts)
                : null,
            created_by_user_id: createdBy,
            created_at: now,
            updated_at: now
          },
          { transaction }
        );

        if (variantMode === 'per_variant') {
          if (!Array.isArray(variants) || variants.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
              error: 'variants_required',
              message:
                'Для режима per_variant необходимо передать массив variants.'
            });
          }

          for (const v of variants) {
            const vQuestions = Array.isArray(v.questions)
              ? v.questions
              : (v.questionIds || []).map((id) => ({ id, points: 1 }));

            if (!v || !v.label || vQuestions.length === 0) {
              await transaction.rollback();
              return res.status(400).json({
                error: 'variant_invalid',
                message:
                  'Каждый вариант должен содержать label и непустой массив questionIds.'
              });
            }

            const variant = await TestVariant.create(
              {
                test_id: test.id,
                label: v.label
              },
              { transaction }
            );

            let order = 1;
            for (const q of vQuestions) {
              await TestVariantQuestion.create(
                {
                  variant_id: variant.id,
                  question_id: q.id,
                  order,
                  points:
                    typeof q.points === 'number' && q.points > 0
                      ? Math.floor(q.points)
                      : 1
                },
                { transaction }
              );
              order += 1;
            }
          }
        } else {
          const qList = Array.isArray(questions)
            ? questions
            : (questionIds || []).map((id) => ({ id, points: 1 }));

          if (qList.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
              error: 'question_ids_required',
              message:
                'Для режима single_shuffled необходимо передать массив questionIds.'
            });
          }

          let order = 1;
          for (const q of qList) {
            await TestQuestion.create(
              {
                test_id: test.id,
                question_id: q.id,
                order,
                points:
                  typeof q.points === 'number' && q.points > 0
                    ? Math.floor(q.points)
                    : 1
              },
              { transaction }
            );
            order += 1;
          }
        }

        await transaction.commit();
        return res.status(201).json(test);
      } catch (error) {
        console.error('Error creating test:', error);
        await transaction.rollback();
        return res.status(500).json({
          error: 'create_failed',
          message: 'Не удалось создать тест.'
        });
      }
    }
  );

  // Список тестов (виден всем авторизованным, без деталей вариантов)
  router.get(
    '/api/tests',
    keycloakAuth.verifyToken(),
    async (req, res) => {
      try {
        const tests = await Test.findAll({
          order: [['created_at', 'DESC']]
        });
        return res.json(tests);
      } catch (error) {
        console.error('Error listing tests:', error);
        return res.status(500).json({
          error: 'list_failed',
          message: 'Не удалось загрузить список тестов.'
        });
      }
    }
  );

  // Получение схемы теста для прохождения (SurveyJS-compatible)
  router.get(
    '/api/tests/:id/run',
    keycloakAuth.verifyToken(),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({
            error: 'bad_id',
            message: 'Некорректный идентификатор теста.'
          });
        }

        const test = await Test.findByPk(id);
        if (!test) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Тест не найден.'
          });
        }

        const schema = await buildSurveySchemaForTest(test, {
          shuffleSingle: true
        });

        if (!schema) {
          return res.status(400).json({
            error: 'no_questions',
            message: 'Для данного теста не настроены вопросы.'
          });
        }

        return res.json({
          id: test.id,
          title: test.title,
          description: test.description,
          variantMode: test.variant_mode,
          passPercent: test.pass_percent,
          maxAttempts: test.max_attempts,
          userAttemptCount: 0,
          schema
        });
      } catch (error) {
        console.error('Error building test run schema:', error);
        return res.status(500).json({
          error: 'run_failed',
          message: 'Не удалось подготовить тест для прохождения.'
        });
      }
    }
  );

  app.use(router);
}

//-----------Экспортируемые модули-----------//
module.exports = {
  registerTestRoutes
};
//-----------Экспортируемые модули-----------//

