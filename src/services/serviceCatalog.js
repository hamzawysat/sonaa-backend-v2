'use strict';

const { CATEGORIES } = require('../config/professions');

function normalizeServiceKey(value) {
  return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar-EG');
}

function isExcludedService(value) {
  const normalized = normalizeServiceKey(value).replace(/^[^ء-ي]+/, '').replace(/ة/g, 'ه');
  return normalized === normalizeServiceKey('تعليق شاشة حائط').replace(/ة/g, 'ه') ||
    normalized === normalizeServiceKey('تركيب شاشة حائط').replace(/ة/g, 'ه');
}

const SERVICE_VISIBILITY_CUTOVER = new Date('2026-11-11T00:00:00.000Z');

function isPublicServiceRecord(item) {
  return isBuiltInServiceRecord(item) || item.isPublic === true ||
    (item.isPublic === undefined && item.createdAt && new Date(item.createdAt) >= SERVICE_VISIBILITY_CUTOVER);
}

async function getServiceRecords(Service) {
  return Service.find({}).select('name category emoji isActive isPublic sortOrder categorySortOrder createdAt').lean();
}

function isBuiltInServiceRecord(item) {
  return CATEGORIES.some(category => normalizeServiceKey(category.label) === normalizeServiceKey(item.category) &&
    category.services.some(name => normalizeServiceKey(name) === normalizeServiceKey(item.name)));
}

async function getActiveServiceNames(Service) {
  const records = await getServiceRecords(Service);
  // Old Sonaa services were stored as active but deliberately hidden from customers.
  // Only the current built-in catalog or an explicit owner opt-in may be public.
  const active = new Map(records.filter(item => item.isActive !== false && !isExcludedService(item.name) &&
    isPublicServiceRecord(item)).map(item => [normalizeServiceKey(item.name), item.name]));
  const recordsByPair = new Set(records.map(item => normalizeServiceKey(item.category) + '|' + normalizeServiceKey(item.name)));
  for (const category of CATEGORIES) {
    for (const name of category.services) {
      const pair = normalizeServiceKey(category.label) + '|' + normalizeServiceKey(name);
      if (!recordsByPair.has(pair) && !isExcludedService(name) && !active.has(normalizeServiceKey(name))) active.set(normalizeServiceKey(name), name);
    }
  }
  return Array.from(active.values());
}

async function isActiveService(Service, name) {
  const key = normalizeServiceKey(name);
  if (!key || isExcludedService(name)) return false;
  const activeNames = await getActiveServiceNames(Service);
  return activeNames.some(value => normalizeServiceKey(value) === key);
}

module.exports = { normalizeServiceKey, isExcludedService, isBuiltInServiceRecord, isPublicServiceRecord, getServiceRecords, getActiveServiceNames, isActiveService };
