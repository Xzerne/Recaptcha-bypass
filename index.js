const express = require('express');
const puppeteerExtra = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const undici = require('undici');
const app = express();
const port = 3000;

// Add the stealth plugin to puppeteer-extra
puppeteerExtra.use(pluginStealth());

function rdn(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

async function solve(page) {
  try {
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe[src*="api2/anchor"]');
      if (!iframe) return false;
      return !!iframe.contentWindow.document.querySelector('#recaptcha-anchor');
    });

    let frames = await page.frames();
    const recaptchaFrame = frames.find(frame => frame.url().includes('api2/anchor'));

    const checkbox = await recaptchaFrame.$('#recaptcha-anchor');
    await checkbox.click({ delay: rdn(30, 150) });

    const challenge = await page.waitForFunction(() => {
      let iframe = document.querySelector('iframe[src*="api2/anchor"]');
      if (iframe == null || !!iframe.contentWindow.document.querySelector('#recaptcha-anchor[aria-checked="true"]')) {
        return false;
      }

      iframe = document.querySelector('iframe[src*="api2/bframe"]');
      const img = iframe.contentWindow.document.querySelector('.rc-image-tile-wrapper img');
      return img && img.complete;
    }, { timeout: 5000 });

    if (!challenge) return null;

    frames = await page.frames();
    const imageFrame = frames.find(frame => frame.url().includes('api2/bframe'));
    const audioButton = await imageFrame.$('#recaptcha-audio-button');
    await audioButton.click({ delay: rdn(30, 150) });

    while (true) {
      try {
        await page.waitForFunction(() => {
          const iframe = document.querySelector('iframe[src*="api2/bframe"]');
          if (!iframe) return false;
          return !!iframe.contentWindow.document.querySelector('.rc-audiochallenge-tdownload-link');
        }, { timeout: 5000 });

        const audioLink = await page.evaluate(() => {
          const iframe = document.querySelector('iframe[src*="api2/bframe"]');
          return iframe.contentWindow.document.querySelector('#audio-source').src;
        });

        const audioBytes = await page.evaluate(audioLink => {
          return (async () => {
            const response = await window.fetch(audioLink);
            const buffer = await response.arrayBuffer();
            return Array.from(new Uint8Array(buffer));
          })();
        }, audioLink);

        const response = await undici.fetch('https://api.wit.ai/speech?v=20220622', {
          method: 'POST',
          body: new Uint8Array(audioBytes),
          headers: {
            Authorization: 'Bearer JVHWCNWJLWLGN6MFALYLHAPKUFHMNTAC',
            'Content-Type': 'audio/mp3'  // Adjust content type if necessary
          }
        }).then((res) => res.text());

        let audioTranscript = null;

        try {
          audioTranscript = response.match('"text": "(.*?)",')[1].trim();
        } catch (e) {
          const reloadButton = await imageFrame.$('#recaptcha-reload-button');
          await reloadButton.click({ delay: rdn(30, 150) });
          continue;
        }

        const input = await imageFrame.$('#audio-response');
        await input.click({ delay: rdn(30, 150) });
        await input.type(audioTranscript, { delay: rdn(30, 75) });

        const verifyButton = await imageFrame.$('#recaptcha-verify-button');
        await verifyButton.click({ delay: rdn(30, 150) });

        try {
          await page.waitForFunction(() => {
            const iframe = document.querySelector('iframe[src*="api2/anchor"]');
            return iframe && !!iframe.contentWindow.document.querySelector('#recaptcha-anchor[aria-checked="true"]');
          }, { timeout: 5000 });

          return page.evaluate(() => document.getElementById('g-recaptcha-response').value);
        } catch (e) {
          console.error(e);
          continue;
        }
      } catch (e) {
        console.error(e);
        continue;
      }
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

app.use(express.json());

app.post('/solve', async (req, res) => {
  const url = req.body.url;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const executablePath = '/vercel/.cache/puppeteer/chrome/linux-128.0.6613.119/chrome-linux64/chrome'; // Adjust the path as necessary
    const browser = await puppeteerExtra.launch({ executablePath, headless: true });
    const page = await browser.newPage();

    await page.goto(url);

    const result = await solve(page);

    await browser.close();

    if (result) {
      res.json({ success: true, token: result });
    } else {
      res.json({ success: false, message: 'Failed to solve reCAPTCHA' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
