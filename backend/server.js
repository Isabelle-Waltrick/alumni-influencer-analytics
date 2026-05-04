require('dotenv').config();

// import modules to ensure they are registered
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { startBiddingJob, ensureOpenWindow } = require('./src/jobs/biddingJob');

// start the server after connecting to the database
const PORT = process.env.PORT || 3000;

// connect to the database and then start the server
connectDB().then(async () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // ensure there is always an open window when the server starts
  await ensureOpenWindow();

  startBiddingJob();
});
