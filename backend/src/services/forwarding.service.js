async function forwardEmail({ resend, config, emailObj, forwardTo }) {
  if (!resend) {
    console.error("Cannot forward: Resend not configured");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: `TempMail Forward <forward@${config.EMAIL_DOMAIN}>`,
      to: forwardTo,
      subject: `[Fwd] ${emailObj.subject}`,
      text: `--- Forwarded from ${emailObj.from} ---\n\n${emailObj.text}`,
      html: emailObj.html
        ? `<p><em>Forwarded from ${emailObj.from}</em></p><hr/>${emailObj.html}`
        : undefined,
    });

    if (error) {
      console.error("Forward error:", error);
      return false;
    }

    console.log(`Forwarded email to ${forwardTo}`);
    return true;
  } catch (error) {
    console.error("Forward failed:", error);
    return false;
  }
}

module.exports = {
  forwardEmail,
};
