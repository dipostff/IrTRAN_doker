//-----------Подключаемые модули-----------//
const express = require('express');
const keycloakAuth = require('./../auth/keycloakAuth');
const {
  listUsers,
  getUserRealmRoles,
  addRealmRolesToUser,
  removeRealmRolesFromUser
} = require('./../auth/keycloakAdmin');
//-----------Подключаемые модули-----------//

/**
 * Регистрация маршрутов панели управления (администратор тренажёра).
 *
 * Доступ только для роли app-admin.
 */
function registerAdminRoutes(app) {
  const router = express.Router();

  // Список пользователей с их ролями
  router.get(
    '/api/admin/users',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireRealmRole('app-admin'),
    async (req, res) => {
      try {
        const users = await listUsers();
        const search = (req.query.q || '').toString().toLowerCase().trim();

        const enriched = [];
        for (const u of users) {
          // eslint-disable-next-line no-await-in-loop
          const roles = await getUserRealmRoles(u.id);
          const base = {
            id: u.id,
            username: u.username,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            roles
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
              // фильтрация по поисковой строке
              // eslint-disable-next-line no-continue
              continue;
            }
          }

          enriched.push(base);
        }

        return res.json(enriched);
      } catch (error) {
        console.error('Error listing admin users:', error.response?.data || error);
        return res.status(500).json({
          error: 'admin_users_failed',
          message: 'Не удалось получить список пользователей из Keycloak.'
        });
      }
    }
  );

  // Управление ролями пользователя
  router.post(
    '/api/admin/users/:id/roles',
    keycloakAuth.verifyToken(),
    keycloakAuth.requireRealmRole('app-admin'),
    async (req, res) => {
      try {
        const userId = req.params.id;
        const { add, remove } = req.body || {};

        if (!userId) {
          return res.status(400).json({
            error: 'user_id_required',
            message: 'Не указан идентификатор пользователя.'
          });
        }

        if (Array.isArray(add) && add.length > 0) {
          await addRealmRolesToUser(userId, add);
        }

        if (Array.isArray(remove) && remove.length > 0) {
          await removeRealmRolesFromUser(userId, remove);
        }

        const roles = await getUserRealmRoles(userId);

        return res.json({
          id: userId,
          roles
        });
      } catch (error) {
        console.error('Error updating user roles:', error.response?.data || error);
        return res.status(500).json({
          error: 'admin_roles_failed',
          message: 'Не удалось обновить роли пользователя.'
        });
      }
    }
  );

  app.use(router);
}

//-----------Экспортируемые модули-----------//
module.exports = {
  registerAdminRoutes
};
//-----------Экспортируемые модули-----------//

