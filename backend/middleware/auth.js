const jwt = require('jsonwebtoken');
const { createAuditLog } = require('../db/init');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

const auditLog = (action, resource) => {
  return async (req, res, next) => {
    // Capture request start time
    const startTime = Date.now();

    // Continue to next middleware
    res.on('finish', async () => {
      try {
        const success = res.statusCode < 400;
        const duration = Date.now() - startTime;

        // Get error message if failed
        let errorMessage = null;
        if (!success && res.locals.errorMessage) {
          errorMessage = res.locals.errorMessage;
        }

        await createAuditLog({
          userId: req.user?.id,
          action,
          resource,
          resourceId: req.params.id || null,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          success,
          errorMessage,
        });
      } catch (error) {
        console.error('Audit log error:', error);
        // Don't fail the request if audit logging fails
      }
    });

    next();
  };
};

module.exports = {
  authenticate,
  auditLog,
};
