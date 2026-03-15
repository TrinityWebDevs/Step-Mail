const Redis = require("ioredis");

function createRedisClient(redisUrl) {
  return new Redis(redisUrl);
}

module.exports = {
  createRedisClient,
};
