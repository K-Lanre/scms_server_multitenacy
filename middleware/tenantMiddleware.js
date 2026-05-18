const AppError = require('../utils/appError');

/**
 * Middleware to ensure the user is scoped to an institution.
 * It attaches the institutionId to the request object and ensures
 * that users (except super_admins) can only access data belonging to their institution.
 */
exports.scopeToInstitution = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  // Super admins can bypass institution scoping if needed, 
  // but by default, we scope everyone to their registered institution.
  // If they are a super_admin and have NO institutionId, we might allow them global access.
  
  if (req.user.role !== 'super_admin' && !req.user.institutionId) {
    return next(new AppError('Your account is not linked to any financial institution. Please contact support.', 403));
  }

  // Attach institutionId to request for easy access in controllers
  req.institutionId = req.user.institutionId;

  next();
};

/**
 * Helper to add institutionId to a sequelize 'where' clause.
 */
exports.attachInstitution = (req, whereClause = {}) => {
  // If user is super_admin and no specific institution is being viewed/impersonated,
  // we return the original where clause (global view).
  if (req.user.role === 'super_admin' && !req.institutionId && !req.query.institutionId) {
    return whereClause;
  }
  
  // Use either the forced institutionId (from impersonation) or the user's own link
  const targetId = req.query.institutionId || req.institutionId;

  if (!targetId && req.user.role !== 'super_admin') {
     return { ...whereClause, institutionId: -1 }; // Force empty result for unlinked non-super-admins
  }

  return {
    ...whereClause,
    ...(targetId ? { institutionId: targetId } : {})
  };
};
