const Bid = require('../models/Bid');
const BidWindow = require('../models/BidWindow');
const Profile = require('../models/Profile');

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Pinned to UTC to match the cron timezone (TZ=UTC in .env)

const getDateStr = (offsetDays = 0) => {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays));
  return utc.toISOString().split('T')[0];
};

// ─── GET /api/bids/window ─────────────────────────────────────────────────────
// Returns metadata for the current open window. No amounts exposed.

const getWindow = async (req, res, next) => {
  try {
    const today = getDateStr(0);
    const tomorrow = getDateStr(1);

    const window = await BidWindow.findOne({ date: today, status: 'open' });

    if (!window) {
      return res.status(404).json({
        message: 'No active bidding window right now. Bidding opens daily and closes at 6PM UTC.',
      });
    }

    const bidCount = await Bid.countDocuments({ bidWindowId: window._id, isActive: true });

    res.json({
      windowId: window._id,
      biddingDate: window.date,
      featuredDate: tomorrow,
      status: window.status,
      totalActiveBids: bidCount,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/bids ───────────────────────────────────────────────────────────
// Place a new bid.
// Concurrency note: a unique index on { userId, bidWindowId } is set in the Bid model.
// If two requests arrive simultaneously for the same user + window, the second
// insert will throw a duplicate key error (E11000) which we catch and handle cleanly.

const placeBid = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const today = getDateStr(0);

    const profile = await Profile.findOne({ userId: req.session.userId });
    if (!profile || !profile.firstName) {
      return res.status(403).json({
        message: 'You must complete your profile before placing a bid.',
      });
    }

    if (!profile.canBidThisMonth()) {
      const limit = profile.hasEventBonus ? 4 : 3;
      return res.status(403).json({
        message: `You have reached the maximum of ${limit} featured slots this month.`,
      });
    }

    // double-check: re-fetch window status here, not just at the start of the request
    // prevents a race where window closes between the profile check and the bid insert
    const window = await BidWindow.findOne({ date: today, status: 'open' });
    if (!window) {
      return res.status(400).json({
        message: 'Bidding has closed for today. Come back tomorrow.',
      });
    }

    // check for an existing bid record (active or cancelled)
    const existing = await Bid.findOne({
      userId: req.session.userId,
      bidWindowId: window._id,
    });

    if (existing) {
      if (existing.isActive) {
        return res.status(409).json({
          message: 'You already have an active bid. Use PATCH /api/bids/:id to increase it.',
        });
      }

      // previously cancelled — re-activate rather than creating a duplicate
      // this avoids hitting the unique index constraint
      existing.amount = amount;
      existing.isActive = true;
      await existing.save();

      return res.status(201).json({
        _id: existing._id,
        message: 'Bid placed successfully.',
        featuredDate: getDateStr(1),
      });
    }

    try {
      const bid = await Bid.create({
        userId: req.session.userId,
        profileId: profile._id,
        bidWindowId: window._id,
        amount,
      });

      res.status(201).json({
        _id: bid._id,
        message: 'Bid placed successfully.',
        featuredDate: getDateStr(1),
      });
    } catch (err) {
      // E11000 = duplicate key — two concurrent requests hit the unique index
      if (err.code === 11000) {
        return res.status(409).json({
          message: 'You already have a bid in this window. Use PATCH /api/bids/:id to update it.',
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/bids/:id ──────────────────────────────────────────────────────
// Atomically increase bid amount. Uses findOneAndUpdate with amount condition
// so the "must be higher" check and the update happen in a single DB operation,
// eliminating the read-then-write race condition.

const updateBid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    // first confirm the bid belongs to this user and the window is still open
    const existing = await Bid.findOne({
      _id: id,
      userId: req.session.userId,
      isActive: true,
    }).populate('bidWindowId', 'status');

    if (!existing) {
      return res.status(404).json({ message: 'Active bid not found.' });
    }

    // double-check window status (DB-level safety on top of the controller check)
    if (!existing.bidWindowId || existing.bidWindowId.status !== 'open') {
      return res.status(400).json({
        message: 'The bidding window for this bid is no longer open.',
      });
    }

    if (amount <= existing.amount) {
      return res.status(400).json({
        message: 'New amount must be higher than your current bid. Bids can only be increased.',
      });
    }

    // atomic update: the amount condition ensures we never accidentally lower a bid
    // even if two PATCH requests arrive for the same bid simultaneously
    const updated = await Bid.findOneAndUpdate(
      {
        _id: id,
        userId: req.session.userId,
        isActive: true,
        amount: { $lt: amount }, // only update if new amount is genuinely higher
      },
      { $set: { amount } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(400).json({
        message: 'Update failed. Your bid may have already been updated to a higher amount.',
      });
    }

    res.json({
      _id: updated._id,
      message: 'Bid updated successfully.',
      featuredDate: getDateStr(1),
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/bids/:id ─────────────────────────────────────────────────────
// Soft-cancel. Keeps the record, sets isActive = false.
// Users can re-bid after cancelling (placeBid reactivates the same record).

const cancelBid = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bid = await Bid.findOne({
      _id: id,
      userId: req.session.userId,
      isActive: true,
    }).populate('bidWindowId', 'status');

    if (!bid) {
      return res.status(404).json({ message: 'Active bid not found.' });
    }

    // window status double-check — controller + DB-sourced
    if (!bid.bidWindowId || bid.bidWindowId.status !== 'open') {
      return res.status(400).json({
        message: 'Cannot cancel a bid after the window has closed.',
      });
    }

    bid.isActive = false;
    await bid.save();

    res.json({
      message: 'Bid cancelled successfully. You may place a new bid before 6PM UTC.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/bids/status ─────────────────────────────────────────────────────
// Returns winning/not-winning boolean only. Amounts never leave the server.

const getBidStatus = async (req, res, next) => {
  try {
    const today = getDateStr(0);

    const window = await BidWindow.findOne({ date: today, status: 'open' });
    if (!window) {
      return res.json({
        hasActiveBid: false,
        isWinning: false,
        message: 'No open bidding window currently.',
      });
    }

    const myBid = await Bid.findOne({
      userId: req.session.userId,
      bidWindowId: window._id,
      isActive: true,
    }).select('amount');

    if (!myBid) {
      return res.json({ hasActiveBid: false, isWinning: false });
    }

    // fetch top bid for comparison — only used server-side, not sent to client
    const topBid = await Bid.findOne({ bidWindowId: window._id, isActive: true })
      .sort({ amount: -1, createdAt: 1 })
      .select('amount')
      .lean();

    const isWinning = topBid ? myBid.amount >= topBid.amount : false;

    res.json({
      hasActiveBid: true,
      isWinning,
      bidId: myBid._id,  // needed by the UI to send PATCH /api/bids/:id
      featuredDate: getDateStr(1),
      // amounts deliberately omitted — blind bidding
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/bids/history ────────────────────────────────────────────────────
// Own bid history. Own amounts are shown (personal data). Others' are not.

const getBidHistory = async (req, res, next) => {
  try {
    const bids = await Bid.find({ userId: req.session.userId })
      .populate('bidWindowId', 'date status')
      .sort({ createdAt: -1 })
      .select('amount isWinner isActive bidWindowId createdAt');

    res.json(bids);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/bids/monthly-limit ─────────────────────────────────────────────

const getMonthlyLimit = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ userId: req.session.userId });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    const currentMonth = new Date().getUTCMonth() + 1;
    const effectiveWins = profile.lastWinMonth === currentMonth ? profile.monthlyWins : 0;
    const limit = profile.hasEventBonus ? 4 : 3;

    res.json({
      used: effectiveWins,
      limit,
      remaining: Math.max(0, limit - effectiveWins),
      hasEventBonus: profile.hasEventBonus,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWindow,
  placeBid,
  updateBid,
  cancelBid,
  getBidStatus,
  getBidHistory,
  getMonthlyLimit,
};
