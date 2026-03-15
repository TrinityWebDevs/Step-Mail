const { Resend } = require("resend");

function createResendClient(apiKey) {
  return apiKey ? new Resend(apiKey) : null;
}

module.exports = {
  createResendClient,
};
