# BusyLine Voicemail Blaster

A minimal Node.js backend service for blasting pre-recorded voicemails to lists of phone numbers using Twilio with Answering Machine Detection (AMD).

## Features

- **Outbound voicemail blasts** via Twilio API
- **Answering Machine Detection** with async webhook callbacks
- **TwiML voicemail playback** endpoint
- **RESTful API** for triggering blasts
- **No UI** - pure command-line/HTTP backend

## Prerequisites

- Node.js (v14 or higher)
- Twilio account with:
  - Account SID and Auth Token
  - A verified phone number (or Twilio number) for outbound calls
- A publicly accessible URL for webhooks (use ngrok for local development)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
PUBLIC_BASE_URL=https://your-public-url.com
VOICEMAIL_AUDIO_URL=https://your-audio-file-url.mp3
PORT=3000
```

**Important Notes:**
- `TWILIO_FROM_NUMBER`: Must be a Twilio phone number in E.164 format (e.g., `+1234567890`)
- `PUBLIC_BASE_URL`: Must be publicly accessible. Twilio needs to reach your webhooks.
- `VOICEMAIL_AUDIO_URL`: Public URL to your voicemail audio file (MP3, WAV, etc.)

### 3. Local Development with ngrok

For local testing, expose your server using ngrok:

```bash
# Install ngrok (if not already installed)
# macOS: brew install ngrok
# Or download from https://ngrok.com/

# Start your server
npm start

# In another terminal, expose it
ngrok http 3000
```

Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) and set it as `PUBLIC_BASE_URL` in your `.env` file.

**Important:** Update your `.env` file with the ngrok URL, then restart your server.

## Usage

### Start the Server

```bash
npm start
```

The server will start on the port specified in `PORT` (default: 3000).

### Trigger a Voicemail Blast

Send a POST request to `/blast` with an array of phone numbers:

```bash
curl -X POST "http://localhost:3000/blast" \
  -H "Content-Type: application/json" \
  -d '{"numbers":["+18595550101","+18595550102"]}'
```

Or using the public URL:

```bash
curl -X POST "$PUBLIC_BASE_URL/blast" \
  -H "Content-Type: application/json" \
  -d '{"numbers":["+18595550101","+18595550102"]}'
```

**Response:**

```json
{
  "count": 2,
  "results": [
    {
      "number": "+18595550101",
      "success": true,
      "callSid": "CA1234567890abcdef",
      "status": "queued"
    },
    {
      "number": "+18595550102",
      "success": true,
      "callSid": "CA0987654321fedcba",
      "status": "queued"
    }
  ]
}
```

## How It Works

### 1. Blast Endpoint (`/blast`)

When you POST to `/blast`:
- Validates the `numbers` array
- For each number, creates a Twilio outbound call with:
  - `machineDetection: "DetectMessageEnd"` - Detects answering machines
  - `asyncAmd: "true"` - Uses async AMD (non-blocking)
  - `asyncAmdStatusCallback` - Webhook URL for AMD results
- Returns results with call SIDs or errors

### 2. TwiML Endpoint (`/twiml/voicemail`)

Twilio calls this endpoint when a call connects:
- Returns TwiML XML that:
  - Pauses for 1 second
  - Plays the voicemail audio from `VOICEMAIL_AUDIO_URL`
  - Hangs up

**TwiML Response:**
```xml
<Response>
  <Pause length="1"/>
  <Play>https://your-audio-file-url.mp3</Play>
  <Hangup/>
</Response>
```

### 3. AMD Webhook (`/webhooks/amd`)

Twilio POSTs to this endpoint when AMD completes:
- Logs the result to console:
  - `CallSid`
  - `To` (recipient number)
  - `AnsweredBy` (`machine`, `human`, or `unknown`)
- Responds with 200 OK

**Example Console Output:**
```
=== AMD Result ===
CallSid: CA1234567890abcdef
To: +18595550101
AnsweredBy: machine
==================
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/blast` | Initiate voicemail blast to multiple numbers |
| POST | `/twiml/voicemail` | TwiML endpoint (called by Twilio) |
| POST | `/webhooks/amd` | AMD webhook (called by Twilio) |
| GET | `/health` | Health check endpoint |

## Deployment

This service is designed to be deployable on any Node.js hosting platform:

- **Railway**: Add environment variables in dashboard
- **Render**: Set environment variables in service settings
- **Fly.io**: Use `fly secrets set` command
- **Supabase Edge Functions**: Adapt for Deno runtime
- **Heroku**: Use `heroku config:set`

Ensure `PUBLIC_BASE_URL` points to your deployed service URL.

## Error Handling

- Invalid requests return `400` with error message
- Missing configuration returns `500` with error details
- Individual call failures are logged but don't stop the blast
- All errors are logged to console

## Logging

The service logs:
- Server startup information
- Call initiation status
- AMD results (when received)
- Errors and failures

All logs go to `console.log`/`console.error` for easy integration with logging services.

## License

ISC

