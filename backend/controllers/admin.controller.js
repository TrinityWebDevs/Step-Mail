const os = require("os");

function createAdminController({
  config,
  redis,
  addLog,
  getLogs,
  getClientIP,
}) {
  const authenticate = (req, res) => {
    const { password } = req.body;

    if (password === config.ADMIN_PASSWORD) {
      addLog("info", "Admin login successful", { ip: getClientIP(req) });
      return res.json({ success: true, authenticated: true });
    }

    addLog("error", "Admin login failed", { ip: getClientIP(req) });
    return res.status(401).json({ success: false, error: "Invalid password" });
  };

  const getStats = async (req, res) => {
    try {
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const cpuPercentage = Math.min(100, (loadAvg[0] / cpus.length) * 100);

      let handleCount = 0;
      let permanentCount = 0;
      let expiringCount = 0;
      let cursor = "0";

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          "email:*@*",
          "COUNT",
          1000,
        );
        const emailKeys = keys.filter(
          (k) => !k.includes(":inbox:") && !k.includes(":sent:"),
        );

        if (emailKeys.length > 0) {
          const pipeline = redis.pipeline();
          emailKeys.forEach((key) => pipeline.ttl(key));
          const ttls = await pipeline.exec();

          ttls.forEach(([, ttl]) => {
            if (ttl !== -2) {
              handleCount += 1;
              if (ttl === -1) permanentCount += 1;
              else expiringCount += 1;
            }
          });
        }

        cursor = nextCursor;
      } while (cursor !== "0");

      let rateLimitedIPs = 0;
      cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          "ratelimit:*",
          "COUNT",
          100,
        );
        rateLimitedIPs += keys.length;
        cursor = nextCursor;
      } while (cursor !== "0");

      const redisInfo = await redis.info();
      const usedMemoryMatch = redisInfo.match(/used_memory_human:(\S+)/);
      const connectedClientsMatch = redisInfo.match(/connected_clients:(\d+)/);
      const totalConnectionsMatch = redisInfo.match(
        /total_connections_received:(\d+)/,
      );

      res.json({
        success: true,
        system: {
          cpu: {
            cores: cpus.length,
            loadAvg: loadAvg[0].toFixed(2),
            percentage: cpuPercentage.toFixed(1),
          },
          memory: {
            total: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100,
            used: Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100,
            percentage: ((usedMem / totalMem) * 100).toFixed(1),
          },
          uptime: Math.floor(os.uptime()),
          nodeUptime: Math.floor(process.uptime()),
        },
        handles: {
          total: handleCount,
          permanent: permanentCount,
          expiring: expiringCount,
        },
        redis: {
          memory: usedMemoryMatch ? usedMemoryMatch[1] : "N/A",
          clients: connectedClientsMatch
            ? parseInt(connectedClientsMatch[1], 10)
            : 0,
          totalConnections: totalConnectionsMatch
            ? parseInt(totalConnectionsMatch[1], 10)
            : 0,
        },
        rateLimiting: {
          activeKeys: rateLimitedIPs,
        },
        config: {
          emailDomain: config.EMAIL_DOMAIN,
          defaultTTL: config.EMAIL_TTL,
          spamThreshold: config.SPAM_THRESHOLD,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error getting admin stats:", error);
      res.status(500).json({ success: false, error: "Failed to get stats" });
    }
  };

  const listLogs = (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 100;
    const type = req.query.type;
    const result = getLogs({ type, limit });

    res.json({
      success: true,
      logs: result.logs,
      total: result.total,
    });
  };

  const listHandles = async (req, res) => {
    try {
      const cursor = req.query.cursor || "0";
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        "email:*",
        "COUNT",
        limit * 2,
      );
      const emailKeys = keys
        .filter(
          (key) =>
            key.startsWith("email:") &&
            !key.includes(":inbox:") &&
            !key.includes(":sent:"),
        )
        .slice(0, limit);

      const pipeline = redis.pipeline();
      emailKeys.forEach((key) => {
        pipeline.ttl(key);
        pipeline.get(key);
      });
      const results = await pipeline.exec();

      const handles = [];
      for (let i = 0; i < emailKeys.length; i++) {
        const ttl = results[i * 2][1];
        const dataStr = results[i * 2 + 1][1];

        if (ttl !== -2 && dataStr) {
          try {
            const data = JSON.parse(dataStr);
            const email = emailKeys[i].replace("email:", "");
            const inboxCount = await redis.llen(`inbox:${email}`);

            handles.push({
              email,
              handle: email.split("@")[0],
              createdAt: data.createdAt,
              ttl: ttl === -1 ? null : ttl,
              isPermanent: ttl === -1,
              hasForwarding: !!data.forwardTo,
              forwardTo: data.forwardTo || null,
              inboxCount,
            });
          } catch (e) {
            // Ignore malformed values.
          }
        }
      }

      res.json({
        success: true,
        handles,
        cursor: nextCursor,
        hasMore: nextCursor !== "0",
      });
    } catch (error) {
      console.error("Error fetching admin handles:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch handles" });
    }
  };

  const deleteHandle = async (req, res) => {
    try {
      const email = req.params.email.toLowerCase();
      const deleted = await redis.del(
        `email:${email}`,
        `inbox:${email}`,
        `sent:${email}`,
      );

      addLog("info", `Admin deleted handle: ${email}`, {
        deletedKeys: deleted,
      });
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error deleting handle:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete handle" });
    }
  };

  return {
    authenticate,
    getStats,
    listLogs,
    listHandles,
    deleteHandle,
  };
}

module.exports = {
  createAdminController,
};
