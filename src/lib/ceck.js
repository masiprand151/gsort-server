function isExpired(expireTime) {
  if (!expireTime) return true;
  return Number(expireTime) * 1000 < Date.now();
}

module.exports = { isExpired };
