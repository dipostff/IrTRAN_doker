//-----------Подключаемые модули-----------//
const express = require('express');
const keycloakAuth = require('./../auth/keycloakAuth');
const { listUsers, getUserRealmRoles } = require('./../auth/keycloakAdmin');
const Test = require('./../../models/Test');
const TestAttempt = require('./../../models/TestAttempt');
const Scenario = require('./../../models/Scenario');
const ScenarioView = require('./../../models/ScenarioView');
//-----------Подключаемые модули-----------//

/**
 * Регистрация маршрутов панели преподавателя.
 */
function registerTeacherRoutes(app) {
  const router = express.Router();

  // Фиксация попытки прохождения теста (доступен всем авторизованным)
  router.post(
    '/api/tests/:id/attempts',
    keycloakAuth.verifyToken(),
    async (req, res) => {
      try {
        const testId = parseInt(req.params.id, 10);
        if (Number.isNaN(testId)) {
          return res.status(400).json({
            error: 'bad_id',
            message: 'Некорректный идентификатор теста.'
          });
        }

        const {
          correctAnswers,
          questionCount,
          earnedPoints,
          maxPoints
        } = req.body || {};
        if (
          typeof correctAnswers !== 'number' ||
          typeof questionCount !== 'number' ||
          questionCount <= 0
        ) {
          return res.status(400).json({
            error: 'bad_payload',
            message: 'Некорректные данные по результатам теста.'
          });
        }

        const test = await Test.findByPk(testId);
        if (!test) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Тест не найден.'
          });
        }

        const user = req.user || {};
        const userId = user.sub || null;
        const username = user.preferred_username || user.username || null;
        let percent = (correctAnswers / questionCount) * 100;
        if (
          typeof earnedPoints === 'number' &&
          typeof maxPoints === 'number' &&
          maxPoints > 0
        ) {
          percent = (earnedPoints / maxPoints) * 100;
        }

        await TestAttempt.create({
          test_id: testId,
          user_id: userId,
          username,
          correct_answers: correctAnswers,
          question_count: questionCount,
          percent,
          created_at: new Date()
        });

        return res.status(201).json({ status: 'ok' });
      } catch (error) {
        console.error('Error saving test attempt:', error);
        return res.status(500).json({
          error: 'attempt_failed',
          message: 'Не удалось сохранить результат теста.'
        });
      }
    }
  );

  // Список студентов (через Keycloak Admin API)
  router.get(
    '/api/teacher/students',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const users = await listUsers();
        const search = (req.query.q || '').toString().toLowerCase().trim();
        const students = [];

        for (const u of users) {
          // eslint-disable-next-line no-await-in-loop
          const roles = await getUserRealmRoles(u.id);
          if (!roles.includes('student')) {
            // eslint-disable-next-line no-continue
            continue;
          }

          const base = {
            id: u.id,
            username: u.username,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName
          };

          if (search) {
            const haystack = [
              u.username || '',
              u.email || '',
              u.firstName || '',
              u.lastName || ''
            ]
              .join(' ')
              .toLowerCase();
            if (!haystack.includes(search)) {
              // eslint-disable-next-line no-continue
              continue;
            }
          }

          students.push(base);
        }

        return res.json(students);
      } catch (error) {
        console.error('Error listing students:', error.response?.data || error);
        return res.status(500).json({
          error: 'students_failed',
          message: 'Не удалось получить список студентов.'
        });
      }
    }
  );

  // Агрегированная статистика по тестам
  router.get(
    '/api/teacher/tests/results',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const testIdFilter = req.query.testId
          ? parseInt(req.query.testId, 10)
          : null;

        const whereTest = {};
        if (testIdFilter && !Number.isNaN(testIdFilter)) {
          whereTest.id = testIdFilter;
        }

        const tests = await Test.findAll({ where: whereTest });
        const results = [];

        for (const test of tests) {
          // eslint-disable-next-line no-await-in-loop
          const attempts = await TestAttempt.findAll({
            where: { test_id: test.id }
          });

          const byUser = new Map();
          for (const a of attempts) {
            const key = a.user_id || a.username || 'unknown';
            const existing = byUser.get(key);
            if (!existing) {
              byUser.set(key, {
                userId: a.user_id,
                username: a.username,
                bestPercent: a.percent,
                attemptsCount: 1,
                lastAttemptAt: a.created_at
              });
            } else {
              existing.attemptsCount += 1;
              if (a.percent > existing.bestPercent) {
                existing.bestPercent = a.percent;
              }
              if (a.created_at > existing.lastAttemptAt) {
                existing.lastAttemptAt = a.created_at;
              }
            }
          }

          results.push({
            testId: test.id,
            testTitle: test.title,
            students: Array.from(byUser.values())
          });
        }

        return res.json(results);
      } catch (error) {
        console.error('Error getting test results:', error);
        return res.status(500).json({
          error: 'test_results_failed',
          message: 'Не удалось получить результаты тестов.'
        });
      }
    }
  );

  // Фиксация просмотра сценария студентом
  router.post(
    '/api/scenarios/:id/view',
    keycloakAuth.verifyToken(),
    async (req, res) => {
      try {
        const scenarioId = parseInt(req.params.id, 10);
        if (Number.isNaN(scenarioId)) {
          return res.status(400).json({
            error: 'bad_id',
            message: 'Некорректный идентификатор сценария.'
          });
        }

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Сценарий не найден.'
          });
        }

        const user = req.user || {};
        const userId = user.sub || null;
        const username = user.preferred_username || user.username || null;
        const now = new Date();

        let record = await ScenarioView.findOne({
          where: {
            scenario_id: scenarioId,
            user_id: userId
          }
        });

        if (!record) {
          record = await ScenarioView.create({
            scenario_id: scenarioId,
            user_id: userId,
            username,
            first_viewed_at: now,
            last_viewed_at: now,
            completed: false
          });
        } else {
          record.last_viewed_at = now;
          await record.save();
        }

        return res.status(201).json({ status: 'ok' });
      } catch (error) {
        console.error('Error saving scenario view:', error);
        return res.status(500).json({
          error: 'scenario_view_failed',
          message: 'Не удалось сохранить просмотр сценария.'
        });
      }
    }
  );

  // Сводка по просмотрам сценариев
  router.get(
    '/api/teacher/scenarios/views',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const scenarios = await Scenario.findAll();
        const data = [];

        for (const sc of scenarios) {
          // eslint-disable-next-line no-await-in-loop
          const views = await ScenarioView.findAll({
            where: { scenario_id: sc.id }
          });

          const byUser = new Map();
          for (const v of views) {
            const key = v.user_id || v.username || 'unknown';
            const existing = byUser.get(key);
            if (!existing) {
              byUser.set(key, {
                userId: v.user_id,
                username: v.username,
                viewed: true,
                firstViewedAt: v.first_viewed_at,
                lastViewedAt: v.last_viewed_at,
                completed: v.completed
              });
            } else {
              if (v.first_viewed_at < existing.firstViewedAt) {
                existing.firstViewedAt = v.first_viewed_at;
              }
              if (v.last_viewed_at > existing.lastViewedAt) {
                existing.lastViewedAt = v.last_viewed_at;
              }
              existing.completed = existing.completed || v.completed;
            }
          }

          data.push({
            scenarioId: sc.id,
            title: sc.title,
            students: Array.from(byUser.values())
          });
        }

        return res.json(data);
      } catch (error) {
        console.error('Error getting scenario views:', error);
        return res.status(500).json({
          error: 'scenario_views_failed',
          message: 'Не удалось получить статистику по сценариям.'
        });
      }
    }
  );

  // Профиль студента: результаты по тестам и сценариям
  router.get(
    '/api/teacher/students/:id/profile',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireAnyRealmRole(['teacher', 'app-admin']),
    async (req, res) => {
      try {
        const userId = req.params.id;
        if (!userId) {
          return res.status(400).json({
            error: 'user_id_required',
            message: 'Не указан идентификатор пользователя.'
          });
        }

        const users = await listUsers();
        const user = users.find((u) => u.id === userId);
        if (!user) {
          return res.status(404).json({
            error: 'user_not_found',
            message: 'Пользователь не найден в Keycloak.'
          });
        }

        const tests = await Test.findAll();
        const attempts = await TestAttempt.findAll({
          where: { user_id: userId }
        });

        const attemptsByTest = new Map();
        for (const a of attempts) {
          const arr = attemptsByTest.get(a.test_id) || [];
          arr.push(a);
          attemptsByTest.set(a.test_id, arr);
        }

        const testsSummary = tests.map((t) => {
          const aList = attemptsByTest.get(t.id) || [];
          if (!aList.length) {
            return {
              testId: t.id,
              title: t.title,
              passed: false,
              attemptsCount: 0,
              bestCorrectAnswers: 0,
              bestWrongAnswers: 0,
              bestPercent: 0
            };
          }
          let best = aList[0];
          for (const a of aList) {
            if (a.percent > best.percent) best = a;
          }
          const bestCorrect = best.correct_answers || 0;
          const bestTotal = best.question_count || 0;
          const bestWrong =
            bestTotal > bestCorrect ? bestTotal - bestCorrect : 0;
          return {
            testId: t.id,
            title: t.title,
            passed: true,
            attemptsCount: aList.length,
            bestCorrectAnswers: bestCorrect,
            bestWrongAnswers: bestWrong,
            bestPercent: best.percent || 0
          };
        });

        const scenarios = await Scenario.findAll();
        const views = await ScenarioView.findAll({
          where: { user_id: userId }
        });
        const viewsByScenario = new Map();
        for (const v of views) {
          const arr = viewsByScenario.get(v.scenario_id) || [];
          arr.push(v);
          viewsByScenario.set(v.scenario_id, arr);
        }

        const scenariosSummary = scenarios.map((sc) => {
          const vList = viewsByScenario.get(sc.id) || [];
          if (!vList.length) {
            return {
              scenarioId: sc.id,
              title: sc.title,
              viewed: false,
              firstViewedAt: null,
              lastViewedAt: null
            };
          }
          let first = vList[0].first_viewed_at;
          let last = vList[0].last_viewed_at;
          for (const v of vList) {
            if (v.first_viewed_at < first) first = v.first_viewed_at;
            if (v.last_viewed_at > last) last = v.last_viewed_at;
          }
          return {
            scenarioId: sc.id,
            title: sc.title,
            viewed: true,
            firstViewedAt: first,
            lastViewedAt: last
          };
        });

        return res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          },
          tests: testsSummary,
          scenarios: scenariosSummary
        });
      } catch (error) {
        console.error('Error getting student profile:', error);
        return res.status(500).json({
          error: 'student_profile_failed',
          message: 'Не удалось получить профиль студента.'
        });
      }
    }
  );

  app.use(router);
}

//-----------Экспортируемые модули-----------//
module.exports = {
  registerTeacherRoutes
};
//-----------Экспортируемые модули-----------//

