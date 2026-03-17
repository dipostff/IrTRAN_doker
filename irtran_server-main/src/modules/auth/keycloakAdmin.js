//-----------Подключаемые модули-----------//
const axios = require('axios');
const fileKeycloak = require('./../../../config/keycloak.json');
//-----------Подключаемые модули-----------//

/**
 * Конфиг для работы с Keycloak Admin REST API.
 * Используем тот же реалм, что и для аутентификации приложения.
 * Базовый URL для админ‑эндпоинтов берём из KEYCLOAK_JWKS_URL (в Docker это http://keycloak:8080),
 * чтобы обращаться к Keycloak по имени сервиса, а не по localhost.
 */
function getAdminConfig() {
  const realm = process.env.KEYCLOAK_REALM || fileKeycloak.realm;

  const baseUrlFromEnv =
    process.env.KEYCLOAK_JWKS_URL ||
    process.env.KEYCLOAK_AUTH_SERVER_URL ||
    fileKeycloak['auth-server-url'];

  const baseUrl = baseUrlFromEnv.replace(/\/$/, '');

  const adminUsername = process.env.KEYCLOAK_ADMIN || 'admin';
  const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

  return {
    realm,
    baseUrl,
    adminUsername,
    adminPassword,
    tokenUrl: `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
    adminApiBaseUrl: `${baseUrl}/admin/realms/${realm}`
  };
}

const adminConfig = getAdminConfig();

/**
 * Получить access token администратора Keycloak через password grant.
 */
async function getAdminAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', 'admin-cli');
  params.append('username', adminConfig.adminUsername);
  params.append('password', adminConfig.adminPassword);

  const response = await axios.post(adminConfig.tokenUrl, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data.access_token;
}

async function getRoleRepresentation(roleName, token) {
  const res = await axios.get(
    `${adminConfig.adminApiBaseUrl}/roles/${encodeURIComponent(roleName)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  return res.data;
}

/**
 * Добавить пользователю одну или несколько realm‑ролей по именам.
 */
async function addRealmRolesToUser(userId, roleNames) {
  if (!Array.isArray(roleNames) || roleNames.length === 0) return;
  const token = await getAdminAccessToken();
  const roles = [];
  for (const name of roleNames) {
    // eslint-disable-next-line no-await-in-loop
    const rep = await getRoleRepresentation(name, token);
    roles.push(rep);
  }

  await axios.post(
    `${adminConfig.adminApiBaseUrl}/users/${encodeURIComponent(
      userId
    )}/role-mappings/realm`,
    roles,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Удалить у пользователя одну или несколько realm‑ролей по именам.
 */
async function removeRealmRolesFromUser(userId, roleNames) {
  if (!Array.isArray(roleNames) || roleNames.length === 0) return;
  const token = await getAdminAccessToken();
  const roles = [];
  for (const name of roleNames) {
    // eslint-disable-next-line no-await-in-loop
    const rep = await getRoleRepresentation(name, token);
    roles.push(rep);
  }

  await axios.delete(
    `${adminConfig.adminApiBaseUrl}/users/${encodeURIComponent(
      userId
    )}/role-mappings/realm`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: roles
    }
  );
}

/**
 * Получить список пользователей realm’а (с базовыми полями).
 */
async function listUsers() {
  const token = await getAdminAccessToken();
  const res = await axios.get(`${adminConfig.adminApiBaseUrl}/users`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return res.data || [];
}

/**
 * Получить текущие realm‑роли пользователя.
 */
async function getUserRealmRoles(userId) {
  const token = await getAdminAccessToken();
  const res = await axios.get(
    `${adminConfig.adminApiBaseUrl}/users/${encodeURIComponent(
      userId
    )}/role-mappings/realm`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  const roles = (res.data || []).map((r) => r.name);
  return roles;
}

//-----------Экспортируемые модули-----------//
module.exports = {
  addRealmRolesToUser,
  removeRealmRolesFromUser,
  listUsers,
  getUserRealmRoles
};
//-----------Экспортируемые модули-----------//

