require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startBiddingJob, ensureOpenWindow } = require('./src/jobs/biddingJob');

const PORT = process.env.PORT || 3000;

connectDB().then(async () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // ensure there is always an open window when the server starts
  await ensureOpenWindow();

  startBiddingJob();
});
