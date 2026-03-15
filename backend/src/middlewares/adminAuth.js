function createAdminAuth(config) {
  return (req, res, next) => {
    const password = req.headers["x-admin-password"];
    if (password !== config.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
  };
}

module.exports = {
  createAdminAuth,
};
