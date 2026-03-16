function createSpamService(config) {
  async function checkSpamOOPSpam(emailContent, senderEmail, senderIP) {
    if (!config.OOPSPAM_API_KEY) {
      return null;
    }

    try {
      const response = await fetch("https://api.oopspam.com/v1/spamdetection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": config.OOPSPAM_API_KEY,
        },
        body: JSON.stringify({
          content: (emailContent || "").substring(0, 5000),
          senderIP: senderIP || "",
          email: senderEmail || "",
          checkForLength: false,
          blockTempEmail: false,
        }),
      });

      if (!response.ok) {
        console.error("OOPSpam error:", response.status);
        return null;
      }

      const result = await response.json();
      return {
        score: result.Score || 0,
        isSpam: result.Score >= 3,
        details: result.Details || {},
      };
    } catch (error) {
      console.error("OOPSpam check failed:", error.message);
      return null;
    }
  }

  async function checkSpamRspamd(rawEmail) {
    try {
      const response = await fetch(`${config.RSPAMD_URL}/checkv2`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: rawEmail,
      });

      if (!response.ok) {
        console.error("Rspamd error:", response.status);
        return null;
      }

      const result = await response.json();
      const normalizedScore = Math.min((result.score || 0) / 2.5, 6);

      return {
        score: normalizedScore,
        rawScore: result.score || 0,
        isSpam:
          result.action === "reject" ||
          result.action === "soft reject" ||
          normalizedScore >= 3,
        action: result.action || "no action",
      };
    } catch (error) {
      console.error("Rspamd check failed:", error.message);
      return null;
    }
  }

  async function checkSpam(rawEmail, parsedEmail, senderIP) {
    const emailText = parsedEmail?.text || "";
    const senderEmail = parsedEmail?.from?.value?.[0]?.address || "";

    const [oopspamResult, rspamdResult] = await Promise.all([
      checkSpamOOPSpam(emailText, senderEmail, senderIP),
      checkSpamRspamd(rawEmail),
    ]);

    if (oopspamResult) {
      const combinedScore = rspamdResult
        ? Math.max(oopspamResult.score, rspamdResult.score)
        : oopspamResult.score;

      return {
        isSpam: combinedScore >= config.SPAM_THRESHOLD,
        score: combinedScore,
        source: "oopspam+rspamd",
        details: {
          oopspam: oopspamResult,
          rspamd: rspamdResult,
        },
      };
    }

    if (rspamdResult) {
      return {
        isSpam: rspamdResult.score >= config.SPAM_THRESHOLD,
        score: rspamdResult.score,
        source: "rspamd",
        action: rspamdResult.action,
      };
    }

    return { isSpam: false, score: 0, source: "none" };
  }

  async function trainRspamd(emailContent, isSpam) {
    try {
      const learnType = isSpam ? "spam" : "ham";
      const response = await fetch(`${config.RSPAMD_URL}/learn${learnType}`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: emailContent,
      });

      if (!response.ok) {
        console.error(`Rspamd learn error: ${response.status}`);
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Rspamd training failed:", error.message);
      return false;
    }
  }

  return {
    checkSpam,
    trainRspamd,
  };
}

module.exports = {
  createSpamService,
};
