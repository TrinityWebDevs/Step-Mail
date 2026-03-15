function createRateLimiters(redis) {
  function getClientIP(req) {
    return (
      req.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown"
    );
  }

  async function checkRateLimit(key, maxRequests, windowSeconds) {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    return current <= maxRequests;
  }

  const generalRateLimiter = async (req, res, next) => {
    const ip = getClientIP(req);
    const key = `ratelimit:general:${ip}`;
    const allowed = await checkRateLimit(key, 200, 60);

    if (!allowed) {
      return res.status(429).json({
        error: "Too many requests. Please slow down.",
        retryAfter: 60,
      });
    }
    next();
  };

  const createHandleRateLimiter = async (req, res, next) => {
    const ip = getClientIP(req);
    const key = `ratelimit:create:${ip}`;
    const allowed = await checkRateLimit(key, 15, 3600);

    if (!allowed) {
      return res.status(429).json({
        error: "Handle creation limit reached. Try again in an hour.",
        retryAfter: 3600,
      });
    }
    next();
  };

  const sendEmailRateLimiter = async (req, res, next) => {
    const ip = getClientIP(req);
    const key = `ratelimit:send:${ip}`;
    const allowed = await checkRateLimit(key, 20, 3600);

    if (!allowed) {
      return res.status(429).json({
        error: "Email sending limit reached. Try again later.",
        retryAfter: 3600,
      });
    }
    next();
  };

  return {
    getClientIP,
    generalRateLimiter,
    createHandleRateLimiter,
    sendEmailRateLimiter,
  };
}

module.exports = {
  createRateLimiters,
};
