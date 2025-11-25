require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Path for blast log
const LOG_FILE = path.join(__dirname, 'blast-log.csv');

// Append a row to blast-log.csv
function appendBlastLog(entry) {
  const header = 'timestamp,number,callSid,status,success,error\n';
  const {
    timestamp,
    number,
    callSid = '',
    status = '',
    success = false,
    error = ''
  } = entry;
  const safeError = String(error).replace(/"/g, '""');
  const line = `${timestamp},${number},${callSid},${status},${success ? 1 : 0},"${safeError}"\n`;
  try {
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, header);
    }
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    console.error('Failed to write blast log:', err.message);
  }
}

// TwiML endpoint - returns XML that plays voicemail recording
app.post('/twiml/voicemail', (req, res) => {
    const voicemailUrl = process.env.VOICEMAIL_AUDIO_URL;
  
    if (!voicemailUrl) {
      console.error('VOICEMAIL_AUDIO_URL not configured');
      return res.status(500).send('Voicemail URL not configured');
    }
  
    const twiml = new twilio.twiml.VoiceResponse();
  
    // Wait for greeting + beep so beginning doesn't get cut
    twiml.pause({ length: 10 });
  
    // Play pre-recorded voicemail
    twiml.play(voicemailUrl);
  
    // Buffer at end so voicemail doesn't clip last words
    twiml.pause({ length: 2 });
  
    twiml.hangup();
  
    res.type('text/xml');
    res.send(twiml.toString());
  });  

// AMD webhook - receives Answering Machine Detection results
app.post('/webhooks/amd', (req, res) => {
  const callSid = req.body.CallSid;
  const to = req.body.To;
  const answeredBy = req.body.AnsweredBy || 'unknown';

  console.log('=== AMD Result ===');
  console.log(`CallSid: ${callSid}`);
  console.log(`To: ${to}`);
  console.log(`AnsweredBy: ${answeredBy}`);
  console.log('==================');

  // Respond with 200 OK
  res.status(200).send('OK');
});

// Blast endpoint - initiates voicemail blasts to multiple numbers
app.post('/blast', async (req, res) => {
  try {
    const { numbers } = req.body;

    // Validate input
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({
        error: 'Invalid request. Expected "numbers" array with at least one phone number.'
      });
    }

    // Validate environment variables
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;

    if (!fromNumber || !publicBaseUrl) {
      return res.status(500).json({
        error: 'Server configuration error. Missing TWILIO_FROM_NUMBER or PUBLIC_BASE_URL.'
      });
    }

    const results = [];
    const twimlUrl = `${publicBaseUrl}/twiml/voicemail`;
    const amdWebhookUrl = `${publicBaseUrl}/webhooks/amd`;

    console.log(`Starting blast to ${numbers.length} numbers...`);

    // Rate limiter: wait 2 seconds between calls
    const delayMs = 2000;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Process each number
    for (const number of numbers) {
      const timestamp = new Date().toISOString();
      try {
        const call = await client.calls.create({
          to: number,
          from: fromNumber,
          url: twimlUrl,
          method: 'POST',
          machineDetection: 'DetectMessageEnd',
          asyncAmd: 'true',
          asyncAmdStatusCallback: amdWebhookUrl,
          asyncAmdStatusCallbackMethod: 'POST'
        });

        results.push({
          number,
          success: true,
          callSid: call.sid,
          status: call.status
        });

        console.log(`Call initiated to ${number}: ${call.sid}`);
        appendBlastLog({
          timestamp,
          number,
          callSid: call.sid,
          status: call.status,
          success: true,
          error: ''
        });
      } catch (error) {
        results.push({
          number,
          success: false,
          error: error.message
        });

        console.error(`Failed to call ${number}:`, error.message);
        appendBlastLog({
          timestamp,
          number,
          callSid: '',
          status: 'error',
          success: false,
          error: error.message
        });
      }

      await sleep(delayMs);
    }

    const response = {
      count: numbers.length,
      results: results
    };

    console.log(`Blast completed. ${results.filter(r => r.success).length}/${numbers.length} calls initiated.`);

    res.json(response);
  } catch (error) {
    console.error('Blast endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BusyLine Voicemail Blaster server running on port ${PORT}`);
  console.log(`TwiML endpoint: http://localhost:${PORT}/twiml/voicemail`);
  console.log(`AMD webhook: http://localhost:${PORT}/webhooks/amd`);
  console.log(`Blast endpoint: http://localhost:${PORT}/blast`);
});

