const puppeteer = require('puppeteer');

(async () => {
  try {
    // Launch Puppeteer to trigger Chromium download
    await puppeteer.launch();
    console.log('Chromium installation successful');
  } catch (error) {
    console.error('Chromium installation failed:', error);
    process.exit(1);
  }
})();
