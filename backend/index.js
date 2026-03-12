const { createApp } = require("./src/app");

const { app, smtpServer, config, addLog } = createApp();

smtpServer.listen(config.SMTP_PORT, "0.0.0.0", () => {
  addLog("info", `SMTP server listening on port ${config.SMTP_PORT}`);
});

app.listen(config.API_PORT, "0.0.0.0", () => {
  addLog("info", `API server started on port ${config.API_PORT}`);
  console.log(`API Server listening on port ${config.API_PORT}`);
  console.log(`Email domain: ${config.EMAIL_DOMAIN}`);
  console.log(`Email TTL: ${config.EMAIL_TTL} seconds`);
});
