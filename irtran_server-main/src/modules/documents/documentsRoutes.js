//-----------Подключаемые модули-----------//
const express = require('express');
const keycloakAuth = require('../auth/keycloakAuth');
const RequestTransportation = require('../../models/RequestTransportation');
const StudentDocument = require('../../models/StudentDocument');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
//-----------Подключаемые модули-----------//

const DOCUMENT_TYPES = {
  transportation: 'transportation_request',
  invoice: 'invoice',
  common_act: 'common_act',
  commercial_act: 'commercial_act',
  reminder: 'reminder',
  filling_statement: 'filling_statement',
  cumulative_statement: 'cumulative_statement'
};

const DOCUMENT_TYPE_LABELS = {
  transportation_request: 'Заявка на грузоперевозку',
  invoice: 'Накладная',
  common_act: 'Акт общей формы (ГУ-23)',
  commercial_act: 'Коммерческий акт (ГУ-22)',
  reminder: 'Памятка приемосдатчика',
  filling_statement: 'Ведомость подачи и уборки',
  cumulative_statement: 'Накопительная ведомость'
};

function toWinAnsiSafeText(value) {
  // StandardFonts.Helvetica в pdf-lib поддерживает WinAnsi и падает на кириллице.
  // Чтобы не ронять скачивание PDF, заменяем неподдерживаемые символы.
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

function getUserId(req) {
  const user = req.user || {};
  return user.sub || null;
}

function ensureAuth(req, res, next) {
  if (!getUserId(req)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Требуется авторизация' });
  }
  next();
}

/**
 * Формирует сводный список документов пользователя (заявки + student_documents).
 */
async function listDocuments(userId, options = {}) {
  const { documentType, includeDeleted = false } = options;
  const list = [];

  if (!documentType || documentType === DOCUMENT_TYPES.transportation) {
    const where = { user_id: userId };
    if (!includeDeleted) where.deleted_at = null;
    const transportations = await RequestTransportation.findAll({
      where,
      order: [['created_at', 'DESC']],
      raw: true
    });
    transportations.forEach((row) => {
      list.push({
        source: 'transportation',
        type: DOCUMENT_TYPES.transportation,
        typeLabel: DOCUMENT_TYPE_LABELS.transportation_request,
        id: row.id,
        createdAt: row.created_at,
        deletedAt: row.deleted_at,
        signed: row.document_status != null,
        summary: `Заявка № ${row.id}`
      });
    });
  }

  const studentWhere = { user_id: userId };
  if (!includeDeleted) studentWhere.deleted_at = null;
  if (documentType && documentType !== DOCUMENT_TYPES.transportation) {
    studentWhere.document_type = documentType;
  }
  const studentDocs = await StudentDocument.findAll({
    where: studentWhere,
    order: [['created_at', 'DESC']],
    raw: true
  });
  studentDocs.forEach((row) => {
    const payload = row.payload || {};
    const docId = payload.id || row.id;
    list.push({
      source: 'student',
      type: row.document_type,
      typeLabel: DOCUMENT_TYPE_LABELS[row.document_type] || row.document_type,
      id: row.id,
      documentId: docId,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      signed: !!payload.signed,
      summary: `${DOCUMENT_TYPE_LABELS[row.document_type] || row.document_type} № ${docId}`
    });
  });

  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

/**
 * Генерация PDF из данных документа (простой текстовый отчёт).
 */
async function buildPdfFromData(title, fields) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();
  let y = height - 50;

  page.drawText(toWinAnsiSafeText(title), { x: 50, y, size: 16, font, color: rgb(0, 0, 0) });
  y -= 28;

  const lineHeight = 14;
  for (const [label, value] of Object.entries(fields)) {
    const text = toWinAnsiSafeText(`${String(label)}: ${value != null ? String(value) : '-'}`).slice(0, 80);
    page.drawText(text, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function registerDocumentsRoutes(app) {
  const router = express.Router();

  // Список заявок на перевозку текущего пользователя (для модуля «Заявка» и для сводки)
  router.get('/api/requests_transportation', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const includeDeleted = req.query.include_deleted === '1' || req.query.include_deleted === 'true';
      const where = { user_id: userId };
      if (!includeDeleted) where.deleted_at = null;
      const list = await RequestTransportation.findAll({
        where,
        order: [['created_at', 'DESC']],
        raw: true
      });
      return res.json(list);
    } catch (err) {
      console.error('GET /api/requests_transportation', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.get('/api/documents', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const documentType = req.query.type || null;
      const includeDeleted = req.query.include_deleted === '1' || req.query.include_deleted === 'true';
      const list = await listDocuments(userId, { documentType, includeDeleted });
      return res.json(list);
    } catch (err) {
      console.error('GET /api/documents', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.get('/api/documents/transportation/:id', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
      const row = await RequestTransportation.findByPk(id, { raw: true });
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.user_id !== userId) return res.status(403).json({ error: 'forbidden' });
      return res.json(row);
    } catch (err) {
      console.error('GET /api/documents/transportation/:id', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.patch('/api/documents/transportation/:id', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
      const row = await RequestTransportation.findByPk(id);
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.user_id !== userId) return res.status(403).json({ error: 'forbidden' });
      const { action } = req.body || {};
      if (action === 'delete') {
        row.deleted_at = new Date();
        await row.save();
        return res.json({ ok: true, deleted: true });
      }
      if (action === 'restore') {
        row.deleted_at = null;
        await row.save();
        return res.json({ ok: true, restored: true });
      }
      return res.status(400).json({ error: 'invalid_action' });
    } catch (err) {
      console.error('PATCH /api/documents/transportation/:id', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.get('/api/documents/student/:id', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
      const row = await StudentDocument.findByPk(id, { raw: true });
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.user_id !== userId) return res.status(403).json({ error: 'forbidden' });
      return res.json(row);
    } catch (err) {
      console.error('GET /api/documents/student/:id', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.post('/api/documents/student', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { document_type, payload } = req.body || {};
      const allowed = Object.values(DOCUMENT_TYPES).filter(t => t !== DOCUMENT_TYPES.transportation);
      if (!document_type || !allowed.includes(document_type)) {
        return res.status(400).json({ error: 'invalid_document_type', allowed });
      }
      const doc = await StudentDocument.create({
        user_id: userId,
        document_type,
        payload: payload || {}
      });
      return res.status(201).json(doc);
    } catch (err) {
      console.error('POST /api/documents/student', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.patch('/api/documents/student/:id', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
      const row = await StudentDocument.findByPk(id);
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.user_id !== userId) return res.status(403).json({ error: 'forbidden' });
      const { action, payload } = req.body || {};
      if (action === 'delete') {
        row.deleted_at = new Date();
        await row.save();
        return res.json({ ok: true, deleted: true });
      }
      if (action === 'restore') {
        row.deleted_at = null;
        await row.save();
        return res.json({ ok: true, restored: true });
      }
      if (payload !== undefined) {
        row.payload = payload;
        await row.save();
        return res.json(row);
      }
      return res.status(400).json({ error: 'invalid_request' });
    } catch (err) {
      console.error('PATCH /api/documents/student/:id', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.get('/api/documents/transportation/:id/pdf', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
      const row = await RequestTransportation.findByPk(id, { raw: true });
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.user_id !== userId) return res.status(403).json({ error: 'forbidden' });
      const title = `Заявка на грузоперевозку № ${row.id}`;
      const fields = {
        'ID': row.id,
        'Дата регистрации': row.registration_date,
        'Период перевозки с': row.transportation_date_from,
        'Период перевозки по': row.transportation_date_to,
        'Статус': row.document_status
      };
      const pdfBuffer = await buildPdfFromData(title, fields);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="zayavka-${row.id}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error('GET /api/documents/transportation/:id/pdf', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  router.get('/api/documents/student/:id/pdf', keycloakAuth.verifyToken(), ensureAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
      const row = await StudentDocument.findByPk(id, { raw: true });
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.user_id !== userId) return res.status(403).json({ error: 'forbidden' });
      const payload = row.payload || {};
      const typeLabel = DOCUMENT_TYPE_LABELS[row.document_type] || row.document_type;
      const title = `${typeLabel} № ${payload.id || row.id}`;
      const fields = {
        'Тип документа': typeLabel,
        'ID записи': row.id,
        'Подписан': payload.signed ? 'Да' : 'Нет',
        'Дата создания': row.created_at
      };
      Object.keys(payload).filter(k => !['id', 'signed', 'createdAt'].includes(k)).slice(0, 15).forEach((k) => {
        fields[k] = payload[k];
      });
      const pdfBuffer = await buildPdfFromData(title, fields);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="document-${row.id}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error('GET /api/documents/student/:id/pdf', err);
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  app.use(router);
}

module.exports = { registerDocumentsRoutes, DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS };
