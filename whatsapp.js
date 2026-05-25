const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

let sock = null;
let lastQR = null; // Store QR globally

function getQR() {
  return lastQR;
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: require("pino")({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      lastQR = qr; // Save QR so endpoint can serve it
      console.log("\n📱 QR Code ready! Visit /qr endpoint\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log("❌ Connection closed. Status code:", statusCode);

      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        connectToWhatsApp();
      } else {
        console.log(
          "🚫 Logged out. Please delete auth_info folder and restart.",
        );
      }
    }

    if (connection === "open") {
      lastQR = null; // Clear QR when connected
      console.log("✅ WhatsApp connected successfully!");
    }
  });
}

async function sendMessage(phone, message) {
  try {
    const jid = phone + "@s.whatsapp.net";
    await sock.sendMessage(jid, { text: message });
    console.log(`✅ Message sent to ${phone}`);
    return { success: true };
  } catch (error) {
    console.log(`❌ Failed to send to ${phone}:`, error);
    return { success: false, error: error.message };
  }
}

async function sendBulkMessages(contacts, message) {
  const results = [];

  for (const phone of contacts) {
    const result = await sendMessage(phone, message);
    results.push({ phone, ...result });
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return results;
}

module.exports = { connectToWhatsApp, sendMessage, sendBulkMessages, getQR };