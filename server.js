require('dotenv').config();
// ------------------------
// STRIPE INITIALIZATION
// ------------------------
const Stripe = require('stripe');
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    })
  : null;

// ------------------------
// FROM NUMBER ROTATION LOGIC (DEPRECATED - now per-user via TwilioConfig)
// ------------------------
// Global rotation logic removed - now handled per-user in buildTwilioClientAndPoolFromConfig
// const primaryFromNumber = process.env.TWILIO_FROM_NUMBER;
// const fromNumberPool = (process.env.TWILIO_FROM_NUMBER_POOL || '')
//   .split(',')
//   .map(n => n.trim())
//   .filter(Boolean);
// let rotationIndex = 0;
// function getNextFromNumber() { ... }

const express = require('express');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const { sessionMiddleware, requireAuth } = require('./auth/session');
const prisma = require('./db/prisma');

// Billing period configuration
const BILLING_PERIOD_DAYS = 30; // you can tweak later

// ========== Onboarding Helpers ==========

const ONBOARDING_STEPS = [
  'business',
  'twilio',
  'voicemail',
  'campaign',
  'leads',
  'blast'
];

function deriveOnboardingCompleted(user) {
  return (
    user.onboardingBusinessDone &&
    user.onboardingTwilioDone &&
    user.onboardingVoicemailDone &&
    user.onboardingCampaignDone &&
    user.onboardingLeadsDone &&
    user.onboardingBlastDone
  );
}

// Helper to check if user can perform blasts (subscription gate)
async function ensureCanBlast(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      billingUsageCents: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const hasActiveSubscription =
    user.subscriptionStatus === 'active' ||
    user.subscriptionStatus === 'trialing';

  // Simple rule:
  // - Allow up to 100 free calls (~$2.00) without subscription
  // - After that, require active subscription
  const FREE_CALLS_CAP = 100;
  const PER_CALL_CENTS = 2; // keep in sync with BillingEvent
  const approxCallsUsed = Math.floor((user.billingUsageCents || 0) / PER_CALL_CENTS);

  if (!hasActiveSubscription && approxCallsUsed >= FREE_CALLS_CAP) {
    const error = new Error('Free usage limit reached; subscription required');
    error.code = 'SUBSCRIPTION_REQUIRED';
    throw error;
  }
}

// Helper to ensure billing period exists and reset if needed
async function ensureBillingPeriod(userId) {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      billingUsageCents: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
    },
  });

  if (!user) {
    throw new Error(`User ${userId} not found in ensureBillingPeriod`);
  }

  const { billingPeriodStart, billingPeriodEnd } = user;

  const needsNewPeriod =
    !billingPeriodStart ||
    !billingPeriodEnd ||
    now > billingPeriodEnd;

  if (!needsNewPeriod) {
    return user;
  }

  const start = now;
  const end = new Date(now.getTime() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      billingUsageCents: 0,
      billingPeriodStart: start,
      billingPeriodEnd: end,
    },
    select: {
      id: true,
      billingUsageCents: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
    },
  });

  return updated;
}

// ========== Twilio Config Helpers (per-user) ==========

async function getUserTwilioConfig(userId) {
  if (!userId) {
    throw new Error('getUserTwilioConfig requires a userId');
  }

  const config = await prisma.twilioConfig.findUnique({
    where: { userId },
  });

  return config;
}

function buildTwilioClientAndPoolFromConfig(config) {
  if (!config) {
    throw new Error('TwilioConfig not provided');
  }

  const accountSid = config.accountSid;
  const authToken = config.authToken;
  const defaultFromNumber = config.defaultFromNumber;
  const rawPool = config.numberPool || '';

  if (!accountSid || !authToken || !defaultFromNumber) {
    throw new Error('Incomplete TwilioConfig: accountSid, authToken, and defaultFromNumber are required');
  }

  const client = twilio(accountSid, authToken);

  const pool = rawPool
    .split(',')
    .map(n => n.trim())
    .filter(Boolean);

  const rotationPool = pool.length > 0 ? pool : [defaultFromNumber];

  let rotationIndex = 0;

  function getNextFromNumber() {
    if (!rotationPool.length) {
      throw new Error('No FROM numbers available for rotation');
    }

    const number = rotationPool[rotationIndex];
    rotationIndex = (rotationIndex + 1) % rotationPool.length;

    return number;
  }

  return {
    client,
    getNextFromNumber,
    defaultFromNumber,
    rotationPool,
  };
}

// Optional dev fallback using global .env Twilio (for your own account)
function buildFallbackTwilioClientAndPool() {
  const envSid = process.env.TWILIO_ACCOUNT_SID;
  const envToken = process.env.TWILIO_AUTH_TOKEN;
  const baseFrom = process.env.TWILIO_FROM_NUMBER;
  const rawPool = process.env.TWILIO_FROM_NUMBER_POOL || '';

  if (!envSid || !envToken || !baseFrom) {
    return null;
  }

  const client = twilio(envSid, envToken);

  const pool = rawPool
    .split(',')
    .map(n => n.trim())
    .filter(Boolean);

  const rotationPool = pool.length > 0 ? pool : [baseFrom];

  let rotationIndex = 0;

  function getNextFromNumber() {
    if (!rotationPool.length) {
      throw new Error('No FROM numbers available for rotation (fallback)');
    }

    const number = rotationPool[rotationIndex];
    rotationIndex = (rotationIndex + 1) % rotationPool.length;

    return number;
  }

  return {
    client,
    getNextFromNumber,
    defaultFromNumber: baseFrom,
    rotationPool,
  };
}

const app = express();

// Uploads directory for voicemail audio
const UPLOADS_ROOT = path.join(__dirname, 'uploads');
const VOICEMAIL_DIR = path.join(UPLOADS_ROOT, 'voicemail');

if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

if (!fs.existsSync(VOICEMAIL_DIR)) {
  fs.mkdirSync(VOICEMAIL_DIR, { recursive: true });
}

// Multer storage for voicemail audio
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VOICEMAIL_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const audioFileFilter = (req, file, cb) => {
  // Accept basic audio types
  if (!file.mimetype.startsWith('audio/')) {
    return cb(new Error('Only audio uploads allowed'), false);
  }
  cb(null, true);
};

const uploadVoicemail = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
  },
});

// Stripe webhook: must use raw body and NOT express.json()
// This route must be defined BEFORE app.use(express.json())
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;

app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !stripeWebhookSecret) {
      console.error('Stripe webhook called but Stripe or STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecret
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer;

          // Find the user by Stripe customer id
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: String(customerId) },
            select: { id: true },
          });

          if (!user) {
            console.warn(
              'Stripe webhook: subscription event for unknown customer',
              customerId
            );
            break;
          }

          const firstItem = subscription.items?.data?.[0] || null;
          const subscriptionItemId = firstItem ? firstItem.id : null;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionItemId: subscriptionItemId,
              subscriptionStatus: subscription.status,
            },
          });

          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const customerId = invoice.customer;

          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: String(customerId) },
            select: { id: true },
          });

          if (!user) {
            console.warn(
              'Stripe webhook: invoice.payment_succeeded for unknown customer',
              customerId
            );
            break;
          }

          // Mark subscription as active if we have one
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: 'active',
            },
          });

          // Optional: you can also align billingPeriodStart/billingPeriodEnd
          // to the invoice period here if desired.

          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer;

          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: String(customerId) },
            select: { id: true },
          });

          if (!user) {
            console.warn(
              'Stripe webhook: invoice.payment_failed for unknown customer',
              customerId
            );
            break;
          }

          // Mark subscription as past_due or similar
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: 'past_due',
            },
          });

          break;
        }

        default: {
          // For now, just log unhandled event types
          console.log(`Stripe webhook: unhandled event type ${event.type}`);
        }
      }

      // Acknowledge receipt of the event
      res.json({ received: true });
    } catch (err) {
      console.error('Error processing Stripe webhook event:', err);
      // Still respond 200 so Stripe does not endlessly retry if the error is on our side
      res.json({ received: true, error: 'internal handler error' });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Serve /media/* from /uploads
app.use('/media', express.static(UPLOADS_ROOT));

// Initialize Twilio client (DEPRECATED - now per-user via TwilioConfig)
// Global client removed - now created per-user in runBlast
// const client = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// Path for blast log
const LOG_FILE = path.join(__dirname, 'blast-log.csv');

// Append a row to blast-log.csv
function appendBlastLog(entry) {
  const header = 'timestamp,number,callSid,status,success,error,fromNumber\n';
  const {
    timestamp,
    number,
    callSid = '',
    status = '',
    success = false,
    error = '',
    fromNumber = ''
  } = entry;
  const safeError = String(error).replace(/"/g, '""');
  const line = `${timestamp},${number},${callSid},${status},${success ? 1 : 0},"${safeError}",${fromNumber}\n`;
  try {
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, header);
    }
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    console.error('Failed to write blast log:', err.message);
  }
}

// ==================== AUTH ENDPOINTS ====================

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    // Stripe customer creation (if Stripe is configured)
    if (stripe && !user.stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            appUserId: String(user.id),
          },
        });

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeCustomerId: customer.id,
          },
        });
      } catch (err) {
        console.error('Error creating Stripe customer:', err);
        // Non-fatal: continue without blocking signup
      }
    }

    // Log them in by setting the session
    req.session.userId = user.id;
    return res.status(201).json({
      id: user.id,
      email: user.email,
    });
  } catch (err) {
    console.error('Error in /auth/register:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// GET /auth/me
app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, email: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== Onboarding Routes ==========

// Get onboarding state for current user
app.get('/onboarding/state', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        onboardingBusinessDone: true,
        onboardingTwilioDone: true,
        onboardingVoicemailDone: true,
        onboardingCampaignDone: true,
        onboardingLeadsDone: true,
        onboardingBlastDone: true,
        onboardingCompleted: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Derive completed in case flags changed
    const completed = deriveOnboardingCompleted(user);

    // Optional: keep DB in sync
    if (completed !== user.onboardingCompleted) {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingCompleted: completed }
      });
    }

    return res.json({
      onboardingCompleted: completed,
      steps: {
        business: user.onboardingBusinessDone,
        twilio: user.onboardingTwilioDone,
        voicemail: user.onboardingVoicemailDone,
        campaign: user.onboardingCampaignDone,
        leads: user.onboardingLeadsDone,
        blast: user.onboardingBlastDone
      }
    });
  } catch (err) {
    console.error('Error in /onboarding/state:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark an onboarding step as completed
app.post('/onboarding/complete-step', requireAuth, async (req, res) => {
  const { step } = req.body || {};

  if (!step || !ONBOARDING_STEPS.includes(step)) {
    return res.status(400).json({ error: 'Invalid or missing step' });
  }

  const stepFieldMap = {
    business:  'onboardingBusinessDone',
    twilio:    'onboardingTwilioDone',
    voicemail: 'onboardingVoicemailDone',
    campaign:  'onboardingCampaignDone',
    leads:     'onboardingLeadsDone',
    blast:     'onboardingBlastDone'
  };

  const fieldName = stepFieldMap[step];

  try {
    // Update the specific step to true
    const updated = await prisma.user.update({
      where: { id: req.session.userId },
      data: {
        [fieldName]: true
      },
      select: {
        id: true,
        onboardingBusinessDone: true,
        onboardingTwilioDone: true,
        onboardingVoicemailDone: true,
        onboardingCampaignDone: true,
        onboardingLeadsDone: true,
        onboardingBlastDone: true,
        onboardingCompleted: true
      }
    });

    const completed = deriveOnboardingCompleted(updated);

    if (completed !== updated.onboardingCompleted) {
      await prisma.user.update({
        where: { id: updated.id },
        data: { onboardingCompleted: completed }
      });
    }

    return res.json({
      onboardingCompleted: completed,
      steps: {
        business: updated.onboardingBusinessDone,
        twilio: updated.onboardingTwilioDone,
        voicemail: updated.onboardingVoicemailDone,
        campaign: updated.onboardingCampaignDone,
        leads: updated.onboardingLeadsDone,
        blast: updated.onboardingBlastDone
      }
    });
  } catch (err) {
    console.error('Error in /onboarding/complete-step:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== Voicemail Audio Library ==========

// List voicemail audios for logged-in user
app.get('/voicemail-audio', requireAuth, async (req, res) => {
  try {
    const audios = await prisma.voicemailAudio.findMany({
      where: { userId: req.session.userId },
      orderBy: { createdAt: 'desc' },
    });

    const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';

    const items = audios.map(a => {
      const relativeUrl = `/media/${a.filePath}`;
      const fullUrl = publicBaseUrl
        ? `${publicBaseUrl}${relativeUrl}`
        : relativeUrl;

      return {
        ...a,
        url: fullUrl,
      };
    });

    return res.json({ items: items });
  } catch (err) {
    console.error('Error listing voicemail audio:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload a new voicemail audio file
app.post(
  '/voicemail-audio',
  requireAuth,
  uploadVoicemail.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const displayName = (req.body && req.body.name) || req.file.originalname;

      const relativePath = path.join('voicemail', req.file.filename).replace(/\\/g, '/');

      const audio = await prisma.voicemailAudio.create({
        data: {
          userId: req.session.userId,
          name: displayName,
          filePath: relativePath,
        },
      });

      const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
      const relativeUrl = `/media/${audio.filePath}`;
      const fullUrl = publicBaseUrl
        ? `${publicBaseUrl}${relativeUrl}`
        : relativeUrl;

      return res.status(201).json({
        ...audio,
        url: fullUrl,
      });
    } catch (err) {
      console.error('Error uploading voicemail audio:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ==================== CAMPAIGNS ENDPOINTS ====================

// GET /campaigns
app.get('/campaigns', requireAuth, async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.session.userId },
      include: {
        _count: {
          select: { leads: true, callLogs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /campaigns
app.post('/campaigns', requireAuth, async (req, res) => {
  try {
    const { name, fromNumber } = req.body;

    if (!name || !fromNumber) {
      return res.status(400).json({ error: 'Name and fromNumber are required' });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        fromNumber,
        userId: req.session.userId,
        status: 'draft'
      },
      include: {
        _count: {
          select: { leads: true, callLogs: true }
        }
      }
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single campaign with lead/call counts
// GET /campaigns/:id
app.get('/campaigns/:id', requireAuth, async (req, res) => {
  const campaignId = parseInt(req.params.id, 10);

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Invalid campaign id' });
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.session.userId,
      },
      include: {
        _count: {
          select: { leads: true, callLogs: true },
        },
        voicemailAudio: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    return res.json(campaign);
  } catch (err) {
    console.error('Error fetching campaign:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /campaigns/:id/leads
app.post('/campaigns/:id/leads', requireAuth, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'leads must be a non-empty array' });
    }

    // Verify campaign exists and belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.session.userId
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Create leads
    const createdLeads = await prisma.lead.createMany({
      data: leads.map(lead => ({
        campaignId,
        name: lead.name || null,
        number: lead.number,
        status: 'queued',
        attempts: 0
      }))
    });

    res.status(201).json({
      count: createdLeads.count,
      message: `Created ${createdLeads.count} leads`
    });
  } catch (error) {
    console.error('Create leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leads for a campaign
// GET /campaigns/:id/leads
app.get('/campaigns/:id/leads', requireAuth, async (req, res) => {
  const campaignId = parseInt(req.params.id, 10);

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Invalid campaign id' });
  }

  try {
    // Ensure campaign belongs to this user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.session.userId,
      },
      select: { id: true },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const leads = await prisma.lead.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(leads);
  } catch (err) {
    console.error('Error fetching leads:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Attach a voicemail audio to a campaign
app.post('/campaigns/:id/voicemail', requireAuth, async (req, res) => {
  const campaignId = parseInt(req.params.id, 10);
  const { voicemailAudioId } = req.body || {};

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Invalid campaign id' });
  }

  if (!voicemailAudioId) {
    return res.status(400).json({ error: 'voicemailAudioId is required' });
  }

  try {
    // Ensure campaign belongs to this user
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: req.session.userId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Ensure audio belongs to this user
    const audio = await prisma.voicemailAudio.findFirst({
      where: { id: voicemailAudioId, userId: req.session.userId },
    });

    if (!audio) {
      return res.status(404).json({ error: 'Voicemail audio not found' });
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        voicemailAudioId: audio.id,
      },
      include: {
        voicemailAudio: true,
      },
    });

    const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
    let voicemailUrl = null;

    if (updated.voicemailAudio) {
      const rel = `/media/${updated.voicemailAudio.filePath}`;
      voicemailUrl = publicBaseUrl ? `${publicBaseUrl}${rel}` : rel;
    }

    return res.json({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      fromNumber: updated.fromNumber,
      voicemailAudioId: updated.voicemailAudioId,
      voicemailUrl,
    });
  } catch (err) {
    console.error('Error attaching voicemail audio to campaign:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Blast all leads for a campaign from the database
// POST /campaigns/:id/blast
app.post('/campaigns/:id/blast', requireAuth, async (req, res) => {
  const campaignId = parseInt(req.params.id, 10);

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Invalid campaign id' });
  }

  try {
    // Ensure the campaign belongs to the logged-in user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.session.userId
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Load leads attached to this campaign
    const leads = await prisma.lead.findMany({
      where: { campaignId: campaign.id },
      orderBy: { id: 'asc' }
    });

    if (!leads.length) {
      return res.status(400).json({ error: 'No leads attached to this campaign' });
    }

    // Extract and normalize phone numbers
    const numbers = leads
      .map(l => (l.number || '').trim())
      .filter(Boolean);

    if (!numbers.length) {
      return res.status(400).json({ error: 'No valid phone numbers in campaign leads' });
    }

    const userId = req.session.userId;

    // Ensure billing period and reset usage if needed
    await ensureBillingPeriod(userId);
    await ensureCanBlast(userId);

    console.log(
      `Starting campaign blast for campaign ${campaign.id} (${campaign.name}) with ${numbers.length} leads...`
    );

    try {
      const result = await runBlast(numbers, {
        campaignId: campaign.id,
        userId,
      });

      // Optionally update campaign status to 'running' or 'completed'
      try {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'running' }
        });
      } catch (err) {
        console.error('Failed to update campaign status:', err.message);
      }

      return res.json({
        campaignId: campaign.id,
        name: campaign.name,
        ...result
      });
    } catch (err) {
      if (err.code === 'TWILIO_NOT_CONFIGURED') {
        return res.status(400).json({
          error: 'Twilio not configured',
          code: 'TWILIO_NOT_CONFIGURED',
          message: 'Connect your Twilio account in Settings → Twilio before blasting.',
        });
      }

      console.error('Error blasting campaign:', err);
      throw err; // Re-throw to be caught by outer catch
    }
  } catch (err) {
    console.error('Error blasting campaign:', err);
    if (err.code === 'SUBSCRIPTION_REQUIRED') {
      return res.status(402).json({ error: 'Subscription required' });
    }
    if (err.code === 'TWILIO_NOT_CONFIGURED') {
      return res.status(400).json({
        error: 'Twilio not configured',
        code: 'TWILIO_NOT_CONFIGURED',
        message: 'Connect your Twilio account in Settings → Twilio before blasting.',
      });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /billing/usage - Get billing usage for current user
app.get('/billing/usage', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Ensure billing period and reset usage if needed
    const user = await ensureBillingPeriod(userId);

    const events = await prisma.billingEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // last 50 billable events
    });

    return res.json({
      usageCents: user.billingUsageCents ?? 0,
      billingPeriodStart: user.billingPeriodStart,
      billingPeriodEnd: user.billingPeriodEnd,
      events,
    });
  } catch (err) {
    console.error('Error fetching billing usage:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /billing/status - Get Stripe subscription status
app.get('/billing/status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionItemId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasStripeCustomer = !!user.stripeCustomerId;
    const hasActiveSubscription =
      user.subscriptionStatus === 'active' ||
      user.subscriptionStatus === 'trialing';

    return res.json({
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeSubscriptionItemId: user.stripeSubscriptionItemId,
      subscriptionStatus: user.subscriptionStatus || null,
      hasStripeCustomer,
      hasActiveSubscription,
    });
  } catch (err) {
    console.error('Error in /billing/status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /billing/start - Create metered subscription
app.post('/billing/start', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured on server' });
  }

  const priceId = process.env.STRIPE_METERED_PRICE_ID;
  if (!priceId) {
    return res.status(500).json({ error: 'STRIPE_METERED_PRICE_ID not configured' });
  }

  try {
    const userId = req.session.userId;
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionItemId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create customer if missing
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { appUserId: String(user.id) },
      });
      stripeCustomerId = customer.id;
      user = await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
        select: {
          id: true,
          email: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripeSubscriptionItemId: true,
          subscriptionStatus: true,
        },
      });
    }

    // If subscription already exists, just return its status
    if (user.stripeSubscriptionId && user.stripeSubscriptionItemId) {
      return res.json({
        message: 'Subscription already exists',
        subscriptionStatus: user.subscriptionStatus || 'unknown',
        stripeSubscriptionId: user.stripeSubscriptionId,
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: priceId,
          // price must be configured as metered on Stripe side
        },
      ],
      expand: ['items.data.price'],
    });

    const item = subscription.items.data[0];
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionItemId: item.id,
        subscriptionStatus: subscription.status,
      },
    });

    return res.json({
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionItemId: item.id,
      subscriptionStatus: updatedUser.subscriptionStatus,
    });
  } catch (err) {
    console.error('Error in /billing/start:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /billing/portal - Stripe Billing Portal session
app.post('/billing/portal', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured on server' });
  }

  const returnUrl =
    process.env.STRIPE_BILLING_PORTAL_RETURN_URL ||
    'http://localhost:5173/app/settings';

  try {
    const userId = req.session.userId;
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ensure customer exists
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { appUserId: String(user.id) },
      });
      stripeCustomerId = customer.id;
      user = await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return res.json({ url: portalSession.url });
  } catch (err) {
    console.error('Error in /billing/portal:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== Settings: Twilio Config ==========

// GET /settings/twilio
// Returns the current user's Twilio configuration (without exposing authToken)
app.get('/settings/twilio', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const config = await prisma.twilioConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return res.json({
        hasConfig: false,
        config: null,
      });
    }

    // Redact authToken from the response
    const safeConfig = {
      id: config.id,
      accountSid: config.accountSid,
      defaultFromNumber: config.defaultFromNumber,
      numberPool: config.numberPool || '',
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };

    return res.json({
      hasConfig: true,
      config: safeConfig,
    });
  } catch (err) {
    console.error('Error in GET /settings/twilio:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /settings/twilio
// Body: { accountSid, authToken, defaultFromNumber, numberPool }
app.put('/settings/twilio', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const {
    accountSid,
    authToken,
    defaultFromNumber,
    numberPool,
  } = req.body || {};

  if (!accountSid || !authToken || !defaultFromNumber) {
    return res.status(400).json({
      error: 'accountSid, authToken, and defaultFromNumber are required',
    });
  }

  // Basic string trims
  const trimmedAccountSid = String(accountSid).trim();
  const trimmedAuthToken = String(authToken).trim();
  const trimmedDefaultFrom = String(defaultFromNumber).trim();
  const trimmedPool = typeof numberPool === 'string' ? numberPool.trim() : '';

  try {
    const existing = await prisma.twilioConfig.findUnique({
      where: { userId },
    });

    let config;

    if (existing) {
      config = await prisma.twilioConfig.update({
        where: { userId },
        data: {
          accountSid: trimmedAccountSid,
          authToken: trimmedAuthToken,
          defaultFromNumber: trimmedDefaultFrom,
          numberPool: trimmedPool || null,
        },
      });
    } else {
      config = await prisma.twilioConfig.create({
        data: {
          userId,
          accountSid: trimmedAccountSid,
          authToken: trimmedAuthToken,
          defaultFromNumber: trimmedDefaultFrom,
          numberPool: trimmedPool || null,
        },
      });
    }

    // Return a safe representation (no authToken)
    const safeConfig = {
      id: config.id,
      accountSid: config.accountSid,
      defaultFromNumber: config.defaultFromNumber,
      numberPool: config.numberPool || '',
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };

    return res.json({
      success: true,
      config: safeConfig,
    });
  } catch (err) {
    console.error('Error in PUT /settings/twilio:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /call-logs - Get all call logs for user's campaigns
app.get('/call-logs', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { campaignId } = req.query || {};

    const where = {
      campaign: {
        userId,
      },
    };

    let parsedCampaignId = null;
    if (campaignId) {
      const cid = parseInt(campaignId, 10);
      if (!Number.isNaN(cid)) {
        parsedCampaignId = cid;
        where.campaignId = cid;
      }
    }

    // Find all call logs for campaigns owned by this user
    const logs = await prisma.callLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200, // simple cap for now
      include: {
        campaign: {
          select: { id: true, name: true, userId: true },
        },
        lead: {
          select: { id: true, name: true, number: true },
        },
      },
    });

    // Filter to only this user's campaigns (defensive)
    const filtered = logs.filter((log) => log.campaign?.userId === userId);

    const result = filtered.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      campaignId: log.campaignId,
      campaignName: log.campaign?.name ?? 'Unknown campaign',
      leadId: log.leadId,
      leadName: log.lead?.name ?? 'Unknown lead',
      leadNumber: log.lead?.number ?? null,
      answeredBy: log.answeredBy,
      status: log.answeredBy, // keep alias for UI
      callSid: log.callSid,
      duration: log.duration ?? null,
      success: log.success,
    }));

    return res.json({ logs: result });
  } catch (err) {
    console.error('Error fetching call logs:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TWILIO ENDPOINTS (v1 compatibility) ====================

// TwiML endpoint - returns XML that plays voicemail recording
app.post('/twiml/voicemail', async (req, res) => {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
  const fallbackUrl = process.env.VOICEMAIL_AUDIO_URL;
  let playUrl = null;

  try {
    const campaignIdRaw = req.query.campaignId || req.body.campaignId;

    if (campaignIdRaw) {
      const campaignId = parseInt(campaignIdRaw, 10);

      if (!Number.isNaN(campaignId)) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { voicemailAudio: true },
        });

        if (campaign && campaign.voicemailAudio) {
          const rel = `/media/${campaign.voicemailAudio.filePath}`;
          playUrl = publicBaseUrl ? `${publicBaseUrl}${rel}` : rel;
        }
      }
    }
  } catch (err) {
    console.error('Error resolving campaign voicemail audio:', err);
  }

  if (!playUrl) {
    // Fallback to global env URL
    if (!fallbackUrl) {
      console.error('VOICEMAIL_AUDIO_URL not configured and no campaign audio found');
      return res.status(500).send('Voicemail URL not configured');
    }
    playUrl = fallbackUrl;
  }

  const twiml = new twilio.twiml.VoiceResponse();

  // Wait for greeting + beep so beginning doesn't get cut
  twiml.pause({ length: 1 });

  // Play pre-recorded voicemail
  twiml.play(playUrl);

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

// Shared blast runner for CSV-based and campaign-based blasts.
// numbers: array of E.164 phone numbers
// options: { campaignId?: number | null, userId: number, rateLimitMs?: number }
async function runBlast(numbers, options = {}) {
  const { campaignId = null, userId } = options;

  if (!userId) {
    throw new Error('runBlast requires a userId');
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;

  if (!publicBaseUrl) {
    throw new Error('PUBLIC_BASE_URL not configured');
  }

  const baseTwimlUrl = `${publicBaseUrl}/twiml/voicemail`;
  const amdWebhookUrl = `${publicBaseUrl}/webhooks/amd`;

  // Load per-user Twilio configuration
  let twilioClient;
  let getNextFromNumber;

  try {
    const userTwilioConfig = await getUserTwilioConfig(userId);

    if (userTwilioConfig) {
      const built = buildTwilioClientAndPoolFromConfig(userTwilioConfig);
      twilioClient = built.client;
      getNextFromNumber = built.getNextFromNumber;
    } else {
      // No per-user config; try fallback .env config (optional) or fail with clear error
      const fallback = buildFallbackTwilioClientAndPool();

      if (fallback) {
        console.warn(
          'runBlast: No TwilioConfig for user, using fallback .env Twilio credentials (dev/admin only)'
        );
        twilioClient = fallback.client;
        getNextFromNumber = fallback.getNextFromNumber;
      } else {
        const err = new Error('Twilio is not configured for this user');
        err.code = 'TWILIO_NOT_CONFIGURED';
        throw err;
      }
    }
  } catch (err) {
    console.error('Error preparing Twilio client/pool in runBlast:', err);
    throw err;
  }

  const delayMs = 2000; // keep your existing rate limit
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const results = [];

  // Billing: flat price per call
  const unitPriceCents = 2; // $0.02 per call (adjust later)

  console.log(`Starting blast to ${numbers.length} numbers...`);

  for (const number of numbers) {
    const timestamp = new Date().toISOString();
    try {
      const fromNumber = getNextFromNumber();

      console.log('[blast] Dialing', number, 'FROM', fromNumber);

      let callUrl = baseTwimlUrl;
      if (campaignId) {
        callUrl = `${baseTwimlUrl}?campaignId=${campaignId}`;
      }

      const call = await twilioClient.calls.create({
        to: number,
        from: fromNumber,
        url: callUrl,
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

      // CSV logging if appendBlastLog exists
      if (typeof appendBlastLog === 'function') {
        appendBlastLog({
          timestamp,
          number,
          callSid: call.sid,
          status: call.status,
          success: true,
          error: '',
          fromNumber
        });
      }

      // Optional DB logging into CallLog if Prisma model exists
      let callLogRecord = null;
      if (prisma && prisma.callLog && typeof prisma.callLog.create === 'function') {
        try {
          callLogRecord = await prisma.callLog.create({
            data: {
              callSid: call.sid,
              number,
              status: call.status,
              campaignId: campaignId || null,
              // answeredBy will be updated later by AMD webhook if you do that in another step
            }
          });
        } catch (err) {
          console.error('Failed to create CallLog row:', err.message);
        }
      }

      // Billing: one unit per call attempt
      const totalCents = unitPriceCents;
      try {
        await prisma.$transaction([
          prisma.billingEvent.create({
            data: {
              userId,
              campaignId: campaignId || null,
              callLogId: callLogRecord ? callLogRecord.id : null,
              units: 1,
              unitPriceCents,
              totalCents,
            },
          }),
          prisma.user.update({
            where: { id: userId },
            data: {
              billingUsageCents: {
                increment: totalCents,
              },
            },
          }),
        ]);
      } catch (err) {
        console.error('Failed to record billing event:', err.message);
        // Continue even if billing fails - don't break the call flow
      }

      // Stripe metered usage reporting (non-blocking best-effort)
      if (stripe && userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              stripeSubscriptionItemId: true,
            },
          });

          if (user && user.stripeSubscriptionItemId) {
            await stripe.subscriptionItems.createUsageRecord(
              user.stripeSubscriptionItemId,
              {
                quantity: 1, // 1 call = 1 unit
                timestamp: Math.floor(Date.now() / 1000),
                action: 'increment',
              },
            );
          }
        } catch (err) {
          console.error('Error reporting Stripe usage:', err);
          // Do not throw; usage reporting failure should not break dialing
        }
      }

      console.log(`Call initiated to ${number}: ${call.sid} | billed ${totalCents} cents`);
    } catch (error) {
      results.push({
        number,
        success: false,
        error: error.message
      });

      console.error(`Failed to call ${number}:`, error.message);

      if (typeof appendBlastLog === 'function') {
        appendBlastLog({
          timestamp,
          number,
          callSid: '',
          status: 'error',
          success: false,
          error: error.message,
          fromNumber: ''
        });
      }
    }

    // Rate limit delay between calls
    if (typeof sleep === 'function' && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log(
    `Blast completed. ${results.filter(r => r.success).length}/${numbers.length} calls initiated.`
  );

  return {
    count: numbers.length,
    results
  };
}

// Blast endpoint - initiates voicemail blasts to multiple numbers (v1 compatibility)
app.post('/blast', requireAuth, async (req, res) => {
  try {
    const { numbers } = req.body || {};

    // Validate input
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({
        error: 'Invalid request. Expected "numbers" array with at least one phone number.',
      });
    }

    const userId = req.session.userId;

    // Ensure billing period and reset usage if needed
    await ensureBillingPeriod(userId);
    await ensureCanBlast(userId);

    try {
      const result = await runBlast(numbers, {
        campaignId: null,
        userId,
      });

      return res.json(result);
    } catch (err) {
      if (err.code === 'TWILIO_NOT_CONFIGURED') {
        return res.status(400).json({
          error: 'Twilio not configured',
          code: 'TWILIO_NOT_CONFIGURED',
          message: 'Connect your Twilio account in Settings → Twilio before blasting.',
        });
      }

      console.error('Error in /blast:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    }
  } catch (error) {
    console.error('Blast endpoint error:', error);
    if (error.code === 'SUBSCRIPTION_REQUIRED') {
      return res.status(402).json({ error: 'Subscription required' });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
  console.log(`Voicemail Blaster v2 server running on port ${PORT}`);
  console.log(`Auth endpoints: /auth/login, /auth/register, /auth/logout, /auth/me`);
  console.log(`Campaign endpoints: GET /campaigns, POST /campaigns, POST /campaigns/:id/leads, POST /campaigns/:id/blast`);
  console.log(`TwiML endpoint: http://localhost:${PORT}/twiml/voicemail`);
  console.log(`AMD webhook: http://localhost:${PORT}/webhooks/amd`);
  console.log(`Blast endpoint: http://localhost:${PORT}/blast`);
});
