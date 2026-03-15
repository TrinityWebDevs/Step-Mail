const express = require("express");

function createAdminRoutes({ adminController, adminAuth }) {
  const router = express.Router();

  router.post("/auth", adminController.authenticate);
  router.get("/stats", adminAuth, adminController.getStats);
  router.get("/logs", adminAuth, adminController.listLogs);
  router.get("/handles", adminAuth, adminController.listHandles);
  router.delete("/handle/:email", adminAuth, adminController.deleteHandle);

  return router;
}

module.exports = {
  createAdminRoutes,
};
