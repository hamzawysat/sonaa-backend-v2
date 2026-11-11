'use strict';

const { CATEGORIES } = require('../config/professions');

function normalizeServiceKey(value) {
  return String(value || '').normalize('NFC').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('ar-EG');
}

function isExcludedService(value) {
  const normalized = normalizeServiceKey(value).replace(/^[^ء-ي]+/, '').replace(/ة/g, 'ه');
  return normalized === normalizeServiceKey('تعليق شاشة حائط').replace(/ة/g, 'ه') ||
    normalized === normalizeServiceKey('تركيب شاشة حائط').replace(/ة/g, 'ه');
}

async function getServiceRecords(Service) {
  return Service.find({}).select('name category emoji isActive sortOrder categorySortOrder').lean();
}

async function getActiveServiceNames(Service) {
  const records = await getServiceRecords(Service);
  const active = new Map(records.filter(item => item.isActive !== false && !isExcludedService(item.name)).map(item => [normalizeServiceKey(item.name), item.name]));
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

module.exports = { normalizeServiceKey, isExcludedService, getServiceRecords, getActiveServiceNames, isActiveService };
