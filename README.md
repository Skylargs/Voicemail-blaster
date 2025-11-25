# Voicemail Blaster

Twilio-powered voicemail drop blaster. Upload a CSV → run the script → auto-dial each lead → drop a voicemail without ringing.

## What It Does

This tool automatically dials phone numbers from a CSV file and drops pre-recorded voicemails using Twilio. It uses Answering Machine Detection (AMD) to ensure voicemails are only left on answering machines, not when humans answer.

## Requirements

- **Node.js** (v14 or higher)
- **Twilio account** with:
  - Account SID and Auth Token
  - A verified phone number (or Twilio number) for outbound calls
- **ngrok** (for local development) - to expose your local server to Twilio webhooks

## Setup

```bash
git clone https://github.com/Skylargs/voicemail-blaster.git
cd voicemail-blaster
npm install
cp .env.example .env   # then fill it in
npm start              # runs webhook server
npm run blast:csv      # runs the CSV dialer
```

### Configure Environment Variables

After copying `.env.example` to `.env`, edit `.env` with your actual values:

- `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token
- `TWILIO_FROM_NUMBER`: Your Twilio phone number in E.164 format (e.g., `+1234567890`)
- `PUBLIC_BASE_URL`: Your ngrok URL (e.g., `https://abc123.ngrok.io`) or your deployed domain
- `VOICEMAIL_AUDIO_URL`: Public URL to your voicemail audio file (MP3, WAV, etc.)

### Local Development with ngrok

1. Start the server: `npm start`
2. In another terminal, expose it: `ngrok http 3000`
3. Copy the ngrok HTTPS URL and set it as `PUBLIC_BASE_URL` in your `.env` file
4. Restart your server

## Usage

### Start the Webhook Server

The webhook server must be running for Twilio to deliver callbacks:

```bash
npm start
```

### Run CSV Blast

With the server running, execute the CSV dialer:

```bash
npm run blast:csv
```

The script will read from `leads.csv` and dial each number, dropping voicemails when answering machines are detected.

### API Endpoint (Alternative)

You can also trigger blasts via HTTP POST:

```bash
curl -X POST "http://localhost:3000/blast" \
  -H "Content-Type: application/json" \
  -d '{"numbers":["+18595550101","+18595550102"]}'
```

## How It Works

1. **CSV Blast Script** (`blast-from-csv.js`): Reads phone numbers from `leads.csv` and initiates calls via the `/blast` API endpoint
2. **Blast Endpoint** (`/blast`): Creates Twilio outbound calls with Answering Machine Detection (AMD)
3. **TwiML Endpoint** (`/twiml/voicemail`): Returns TwiML XML that plays your voicemail audio when a call connects
4. **AMD Webhook** (`/webhooks/amd`): Receives AMD results from Twilio and logs them

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/blast` | Initiate voicemail blast to multiple numbers |
| POST | `/twiml/voicemail` | TwiML endpoint (called by Twilio) |
| POST | `/webhooks/amd` | AMD webhook (called by Twilio) |
| GET | `/health` | Health check endpoint |

## Deployment

Deploy to any Node.js hosting platform (Railway, Render, Fly.io, Heroku, etc.). Ensure `PUBLIC_BASE_URL` points to your deployed service URL and all environment variables are set.

## License

ISC
