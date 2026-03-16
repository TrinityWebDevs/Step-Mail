const { SMTPServer } = require("smtp-server");

function createSmtpServer({ config, processIncomingEmail, addLog }) {
  const smtpServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH"],
    secure: false,

    onConnect(session, callback) {
      addLog("info", "SMTP connection", { ip: session.remoteAddress });
      callback();
    },

    onRcptTo(address, session, callback) {
      const email = address.address.toLowerCase();
      const domain = email.split("@")[1];

      if (domain === config.EMAIL_DOMAIN) {
        callback();
      } else {
        callback(new Error(`We don't accept mail for ${domain}`));
      }
    },

    onData(stream, session, callback) {
      let emailData = "";

      stream.on("data", (chunk) => {
        emailData += chunk;
      });

      stream.on("end", async () => {
        try {
          await processIncomingEmail({ emailData, session });
          callback();
        } catch (error) {
          addLog("error", "Error processing incoming email", {
            error: error.message,
          });
          callback(new Error("Error processing email"));
        }
      });
    },
  });

  smtpServer.on("error", (err) => {
    addLog("error", "SMTP server error", { error: err.message });
  });

  return smtpServer;
}

module.exports = {
  createSmtpServer,
};
