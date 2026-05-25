const express = require("express");
const cors = require("cors");
const { connectToWhatsApp, sendBulkMessages, getQR } = require("./whatsapp");
const supabase = require("./supabase");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Sendbulk backend is running" });
});

// QR Code endpoint
app.get("/qr", (req, res) => {
  const qr = getQR();
  if (qr) {
    res.json({ qr });
  } else {
    res.json({ message: "WhatsApp already connected!" });
  }
});

// Send bulk messages route
app.post("/send", async (req, res) => {
  const { contacts, message } = req.body;

  if (!contacts || !message) {
    return res.status(400).json({ error: "Contacts and message are required" });
  }

  if (contacts.length === 0) {
    return res.status(400).json({ error: "No contacts provided" });
  }

  try {
    const results = await sendBulkMessages(contacts, message);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const { error } = await supabase.from("campaigns").insert({
      message: message,
      total_contacts: contacts.length,
      successful: successful,
      failed: failed,
    });

    if (error) {
      console.log("Failed to save campaign:", error);
    } else {
      console.log("✅ Campaign saved to database!");
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get campaign history
app.get("/campaigns", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, campaigns: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/qr-scan", (req, res) => {
  const qr = getQR();
  if (qr) {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sendbulk - Scan QR</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <style>
            body { 
              background: #030712; 
              display: flex; 
              flex-direction: column;
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              font-family: sans-serif;
              color: white;
            }
            h2 { color: #4ade80; margin-bottom: 20px; }
            #qrcode { 
              background: white; 
              padding: 20px; 
              border-radius: 12px; 
            }
            p { color: #9ca3af; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2>📱 Scan With WhatsApp</h2>
          <div id="qrcode"></div>
          <p>Open WhatsApp → Linked Devices → Link a Device</p>
          <script>
            new QRCode(document.getElementById("qrcode"), {
              text: "${qr}",
              width: 256,
              height: 256,
            });
          </script>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sendbulk - Connected</title>
          <style>
            body { 
              background: #030712; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              font-family: sans-serif;
            }
            h2 { color: #4ade80; }
          </style>
        </head>
        <body>
          <h2>✅ WhatsApp Already Connected!</h2>
        </body>
      </html>
    `);
  }
});

// Connect WhatsApp
connectToWhatsApp();

// Start server
app.listen(PORT, () => {
  console.log(`Sendbulk server running on port ${PORT}`);
});
