/**
 * Real Twilio wiring, not a stub pretending to be one: with TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER set, this actually calls the Twilio SDK
 * and sends a real SMS. Without them (the default - no Twilio account needed to run
 * this project), it logs what would have been sent and resolves - every caller works
 * identically either way, so nothing else in the codebase needs to know which mode
 * it's in.
 */
const HAS_TWILIO_CREDS = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
);

let client = null;
function getClient() {
  if (!client) {
    // Required lazily so the project runs with zero Twilio setup - `npm install`
    // still pulls the package, but it's never touched unless credentials exist.
    const twilio = require('twilio');
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

/** Sends `body` to `to` over SMS if Twilio is configured; otherwise just logs it. */
async function sendSms(to, body) {
  if (!to) return { sent: false, reason: 'no destination phone number' };

  if (!HAS_TWILIO_CREDS) {
    console.log(`[notify] (no Twilio credentials configured) would SMS ${to}: "${body}"`);
    return { sent: false, reason: 'twilio not configured' };
  }

  try {
    const message = await getClient().messages.create({
      to,
      from: process.env.TWILIO_FROM_NUMBER,
      body,
    });
    return { sent: true, sid: message.sid };
  } catch (err) {
    console.error(`[notify] Twilio send failed for ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendSms, HAS_TWILIO_CREDS };
