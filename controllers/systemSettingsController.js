const { SystemSetting } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { logAction } = require('../utils/auditLogger');

/**
 * Get all system settings
 */
exports.getAllSettings = catchAsync(async (req, res, next) => {
  const settings = await SystemSetting.findAll({
    order: [['key', 'ASC']]
  });

  res.status(200).json({
    status: 'success',
    data: { settings }
  });
});

/**
 * Update a specific setting
 */
exports.updateSetting = catchAsync(async (req, res, next) => {
  const { key, value } = req.body;

  const setting = await SystemSetting.findOne({ where: { key } });
  
  if (!setting) {
    return next(new AppError(`Setting with key '${key}' not found`, 404));
  }

  await setting.update({ value });

  logAction(req, 'SETTING_UPDATED', { key, value });

  res.status(200).json({
    status: 'success',
    data: { setting }
  });
});

/**
 * Bulk update settings (Admin Hub)
 */
exports.bulkUpdateSettings = catchAsync(async (req, res, next) => {
  const { settings } = req.body; // Array of { key, value }

  if (!Array.isArray(settings)) {
    return next(new AppError('Format must be an array of settings', 400));
  }

  const results = [];
  for (const s of settings) {
    const entry = await SystemSetting.findOne({ where: { key: s.key } });
    if (entry) {
      await entry.update({ value: s.value });
      results.push(entry);
    }
  }

  logAction(req, 'SETTINGS_BULK_UPDATED', { count: results.length });

  res.status(200).json({
    status: 'success',
    data: { updated: results.length }
  });
});

/**
 * Get setting by key
 */
exports.getSettingByKey = catchAsync(async (req, res, next) => {
  const setting = await SystemSetting.findOne({ where: { key: req.params.key } });
  if (!setting) return next(new AppError('Setting not found', 404));

  res.status(200).json({
    status: 'success',
    data: { setting }
  });
});

/**
 * Get public settings (thrift amount, etc)
 */
exports.getPublicSettings = catchAsync(async (req, res, next) => {
  const keys = ['monthly_thrift_amount', 'monthlyThriftAmount', 'loan_interest_tiers'];
  const settings = await SystemSetting.findAll({ where: { key: keys } });
  
  // Map to simple object
  const publicSettings = {};
  settings.forEach(s => {
    publicSettings[s.key] = s.value;
  });

  res.status(200).json({
    status: 'success',
    data: { settings: publicSettings }
  });
});
