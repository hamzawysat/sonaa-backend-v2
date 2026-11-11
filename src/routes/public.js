
'use strict';

const express = require('express');
const AdminConfig = require('../models/AdminConfig');
const Service = require('../models/Service');
const Fanni = require('../models/Fanni');
const Region = require('../models/Region');
const { AREA_OPTIONS, normalizeArea, getEffectiveAreaOptions } = require('../config/areas');
const { getActiveServiceNames, getServiceRecords, isExcludedService } = require('../services/serviceCatalog');

const { CATEGORIES } = require('../config/professions');

const router = express.Router();

// Publicly expose only the two transfer numbers needed by technician wallets.
router.get('/wallet-settings', async (req, res, next) => {
  try {
    const config = await AdminConfig.findOne({ key: 'main' }).select('settings.walletPhone1 settings.walletPhone2').lean();
    res.set('Cache-Control', 'no-store');
    return res.json({
      walletPhone1: String(config?.settings?.walletPhone1 || '').trim(),
      walletPhone2: String(config?.settings?.walletPhone2 || '').trim()
    });
  } catch (err) { next(err); }
});

function normalize(value) {
  return String(value || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ريسيفر/g, 'رسيفر');
}

function normalizeBrokenWallScreenServiceName(value) {
  return normalize(value)
    .replace(/^[^ء-ي]+/, '')
    .replace(/ة/g, 'ه');
}

const BROKEN_WALL_SCREEN_SERVICE_NAMES = [
  normalizeBrokenWallScreenServiceName('تعليق شاشة حائط'),
  normalizeBrokenWallScreenServiceName('تركيب شاشة حائط')
];

function isBrokenWallScreenService(value) {
  return BROKEN_WALL_SCREEN_SERVICE_NAMES.includes(normalizeBrokenWallScreenServiceName(value));
}


/* قائمة مناطق الخدمة المعتمدة: القائمة الأساسية + المناطق النشطة التي تعتمدها الإدارة. */
router.get('/areas', async (req, res, next) => {
  try {
    const [adminRegions, approvedTechnicians, activeServiceNames] = await Promise.all([
      Region.find({}).select('name isActive isDeleted isBase').lean(),
      Fanni.find({ status: 'معتمد', role: 'fanni' }).select('specialties areas').lean(),
      getActiveServiceNames(Service)
    ]);
    const areas = getEffectiveAreaOptions(adminRegions);
    const publicServiceNames = new Set(activeServiceNames.map(normalize));
    const serviceEligibleTechnicians = approvedTechnicians.filter(technician =>
      Array.isArray(technician.specialties) && technician.specialties.some(value => publicServiceNames.has(normalize(value)))
    );
    const technicianCountByArea = Object.fromEntries(areas.map(area => {
      const areaKey = normalizeArea(area);
      const count = serviceEligibleTechnicians.filter(technician =>
        Array.isArray(technician.areas) && technician.areas.some(value => normalizeArea(value) === areaKey)
      ).length;
      return [area, count];
    }));
    return res.set('Cache-Control', 'no-store').json({ ok: true, areas, technicianCountByArea });
  } catch (err) { next(err); }
});

/*
 * GET /api/services
 * القائمة الموحدة للخدمات القديمة والجديدة.
 */
router.get('/services', async (req, res, next) => {
  try {
    const [savedServices, approvedTechnicians, allRegions] = await Promise.all([
      getServiceRecords(Service),
      Fanni.find({ status: 'معتمد', role: 'fanni' }).select('specialties areas').lean(),
      Region.find({}).select('name isActive isDeleted isBase').lean()
    ]);
    const activeAreaNames = getEffectiveAreaOptions(allRegions);
    const categoriesMap = new Map();
    const savedPairs = new Set(savedServices.map(item => normalize(item.category) + '|' + normalize(item.name)));

    // Keep built-in services only when the administrator has never created a database record for them.
    for (const [categoryIndex, category] of CATEGORIES.entries()) {
      const services = [];
      for (const [index, name] of category.services.entries()) {
        if (isExcludedService(name) || savedPairs.has(normalize(category.label) + '|' + normalize(name))) continue;
        services.push({ name, emoji: category.emoji, isActive: true, sortOrder: (index + 1) * 10 });
      }
      if (services.length) categoriesMap.set(normalize(category.label), {
        label: category.label, emoji: category.emoji,
        categorySortOrder: (categoryIndex + 1) * 10, services
      });
    }

    // Every active database service is public, regardless of whether it existed in the original hard-coded catalog.
    for (const saved of savedServices) {
      if (saved.isActive === false || isExcludedService(saved.name)) continue;
      const key = normalize(saved.category);
      if (!categoriesMap.has(key)) categoriesMap.set(key, {
        label: saved.category, emoji: saved.emoji || '🔧',
        categorySortOrder: Number(saved.categorySortOrder) || 100000, services: []
      });
      const category = categoriesMap.get(key);
      category.services.push({
        name: saved.name, emoji: saved.emoji || category.emoji || '🔧',
        isActive: true, sortOrder: Number(saved.sortOrder) || 0
      });
    }

    const allActiveNames = new Set();
    for (const category of categoriesMap.values()) {
      const seen = new Set();
      category.services = category.services
        .filter(item => {
          const key = normalize(item.name);
          if (!key || seen.has(key)) return false;
          seen.add(key); allActiveNames.add(key); return true;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar'));
    }

    const activeTechnicians = approvedTechnicians.filter(technician =>
      Array.isArray(technician.specialties) && technician.specialties.some(value => allActiveNames.has(normalize(value)))
    );
    const categories = Array.from(categoriesMap.values())
      .filter(category => category.services.length)
      .sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.label.localeCompare(b.label, 'ar'))
      .map(category => {
        const names = category.services.map(item => item.name);
        const normalizedNames = new Set(names.map(normalize));
        const technicianCountByArea = Object.fromEntries(activeAreaNames.map(area => {
          const areaKey = normalizeArea(area);
          const count = approvedTechnicians.filter(technician =>
            Array.isArray(technician.areas) &&
            technician.areas.some(value => normalizeArea(value) === areaKey) &&
            Array.isArray(technician.specialties) &&
            technician.specialties.some(value => normalizedNames.has(normalize(value)))
          ).length;
          return [area, count];
        }));
        return {
          label: category.label,
          emoji: category.emoji,
          services: names,
          technicianCount: activeTechnicians.filter(technician =>
            technician.specialties.some(value => normalizedNames.has(normalize(value)))
          ).length,
          technicianCountByArea,
          serviceTechnicianCounts: Object.fromEntries(names.map(name => [
            name,
            approvedTechnicians.filter(technician =>
              Array.isArray(technician.specialties) && technician.specialties.some(value => normalize(value) === normalize(name))
            ).length
          ])),
          serviceTechnicianCountsByArea: Object.fromEntries(names.map(name => [name,
            Object.fromEntries(activeAreaNames.map(area => [area,
              approvedTechnicians.filter(technician =>
                Array.isArray(technician.areas) && technician.areas.some(value => normalizeArea(value) === normalizeArea(area)) &&
                Array.isArray(technician.specialties) && technician.specialties.some(value => normalize(value) === normalize(name))
              ).length
            ]))
          ]))
        };
      });
    const services = [...new Set(categories.flatMap(category => category.services))];
    return res.set('Cache-Control', 'no-store').json({ ok: true, categories, services });
  } catch (err) { next(err); }
});

router.get('/content', async (req, res, next) => {
  try {
    const config = await AdminConfig.findOne({ key: 'main' }).select('content settings.siteName settings.maintenance settings.maintenanceMessage').lean();
    const content = config?.content || { announcement: '', faqs: [] };
    return res.set('Cache-Control', 'no-store').json({
      siteName: String(config?.settings?.siteName && config.settings.siteName !== 'صُنّاع' ? config.settings.siteName : 'حمزاوي سات'),
      maintenance: Boolean(config?.settings?.maintenance),
      maintenanceMessage: String(config?.settings?.maintenanceMessage || ''),
      announcement: String(content.announcement || ''),
      faqs: (Array.isArray(content.faqs) ? content.faqs : []).filter(item => item.active !== false).map(item => ({
        question: String(item.question || ''),
        answer: String(item.answer || '')
      }))
    });
  } catch (err) { next(err); }
});

/*
 * GET /api/health
 */
router.get('/health', (req, res) => {
  return res.json({
    ok: true,
    time: new Date().toISOString()
  });
});

module.exports = router;
