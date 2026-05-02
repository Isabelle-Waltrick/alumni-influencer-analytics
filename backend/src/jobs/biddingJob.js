const cron = require('node-cron');
const BidWindow = require('../models/BidWindow');
const Bid = require('../models/Bid');
const Profile = require('../models/Profile');
const FeaturedAlumni = require('../models/FeaturedAlumni');
const { sendBidResultEmail } = require('../services/emailService');

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Always use UTC methods to avoid timezone drift between the server and cron schedule.
// node-cron schedules are based on the system clock, so we pin everything to UTC
// to ensure "midnight" and "6PM" refer to the same timezone consistently.

const getDateStr = (offsetDays = 0) => {
  const d = new Date();
  // use UTC date arithmetic to avoid daylight saving / timezone shifting
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays));
  return utc.toISOString().split('T')[0];
};

// ─── Window lifecycle ─────────────────────────────────────────────────────────
//
// window.date = the day bids are PLACED (today)
// The winner of today's window is featured TOMORROW.
//
// Timeline:
//   6PM UTC Day N   → close Day N window, open Day N+1 window
//   Midnight UTC Day N+1 → find Day N window (yesterday, closed), pick winner

// ─── Midnight job ─────────────────────────────────────────────────────────────

const runMidnightSelection = async () => {
  const yesterday = getDateStr(-1);
  const today = getDateStr(0);

  console.log(`[cron] Midnight selection — looking for closed window on ${yesterday}`);

  try {
    const window = await BidWindow.findOne({ date: yesterday });

    if (!window) {
      console.log(`[cron] No window found for ${yesterday}, skipping`);
      return;
    }

    // guard: if this window was already resolved (e.g. cron ran twice), do nothing
    if (window.status === 'resolved') {
      console.log(`[cron] Window for ${yesterday} already resolved, skipping`);
      return;
    }

    // count active bids before trying to select — handle the no-bids case cleanly
    const bidCount = await Bid.countDocuments({ bidWindowId: window._id, isActive: true });

    if (bidCount === 0) {
      console.log(`[cron] No active bids for ${yesterday} — resolving with no winner`);
      window.status = 'resolved';
      window.resolvedAt = new Date();
      await window.save();
      return;
    }

    // find the highest active bid — ties broken by earliest placement (createdAt asc)
    const winningBid = await Bid.findOne({ bidWindowId: window._id, isActive: true })
      .sort({ amount: -1, createdAt: 1 })
      .lean();

    // mark the winning bid
    await Bid.updateOne({ _id: winningBid._id }, { isWinner: true });

    // lock the window as resolved — any subsequent cron run will exit early above
    window.winnerProfileId = winningBid.profileId;
    window.winnerBidAmount = winningBid.amount;
    window.resolvedAt = new Date();
    window.status = 'resolved';
    await window.save();

    // reset all active-today flags, then set the winner
    await Profile.updateMany({}, { isActiveToday: false });

    const winnerProfile = await Profile.findById(winningBid.profileId);
    if (winnerProfile) {
      winnerProfile.isActiveToday = true;
      winnerProfile.recordWin();
      await winnerProfile.save();
    }

    // permanent record — what the public API reads
    await FeaturedAlumni.create({
      profileId: winningBid.profileId,
      bidWindowId: window._id,
      date: today,
      winningBidAmount: winningBid.amount,
    });

    // notify every bidder
    const allBids = await Bid.find({ bidWindowId: window._id, isActive: true })
      .populate({ path: 'userId', select: 'email' });

    for (const bid of allBids) {
      if (bid.userId?.email) {
        const won = bid._id.equals(winningBid._id);
        await sendBidResultEmail(bid.userId.email, won, today);
      }
    }

    console.log(`[cron] Winner selected for ${today} — profileId: ${winningBid.profileId}`);
  } catch (err) {
    console.error('[cron] Error in midnight selection:', err);
  }
};

// ─── 6PM job ──────────────────────────────────────────────────────────────────

const run6pmWindowRollover = async () => {
  const today = getDateStr(0);
  const tomorrow = getDateStr(1);

  try {
    // close today's window atomically — only transitions if still open
    const closed = await BidWindow.findOneAndUpdate(
      { date: today, status: 'open' },
      { status: 'closed' },
      { new: true }
    );

    if (closed) {
      console.log(`[cron] Closed bid window for ${today}`);
    }

    // open tomorrow's window (idempotent — skips if already exists)
    const exists = await BidWindow.findOne({ date: tomorrow });
    if (!exists) {
      await BidWindow.create({ date: tomorrow, status: 'open' });
      console.log(`[cron] Opened bid window for ${tomorrow}`);
    }
  } catch (err) {
    console.error('[cron] Error in 6PM window rollover:', err);
  }
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// Ensures there is always an open window when the server starts.
// Without this, the first day would have no window until 6PM.

const ensureOpenWindow = async () => {
  const today = getDateStr(0);
  const exists = await BidWindow.findOne({ date: today });
  if (!exists) {
    await BidWindow.create({ date: today, status: 'open' });
    console.log(`[bootstrap] Created initial bid window for ${today}`);
  }
};

// ─── Register cron jobs ───────────────────────────────────────────────────────
// Cron expressions use UTC ('0 0 * * *' = midnight UTC, '0 18 * * *' = 6PM UTC).
// Set TZ=UTC in your environment to ensure node-cron schedules in UTC.

const startBiddingJob = () => {
  cron.schedule('0 0 * * *', runMidnightSelection, { timezone: 'UTC' });
  cron.schedule('0 18 * * *', run6pmWindowRollover, { timezone: 'UTC' });
  console.log('[cron] Bidding jobs registered (midnight UTC + 18:00 UTC)');
};

module.exports = { startBiddingJob, ensureOpenWindow };
