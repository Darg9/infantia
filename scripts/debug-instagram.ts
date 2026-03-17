// Debug: test different strategies to access Instagram data without login
import 'dotenv/config';
import { chromium } from 'playwright';

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function main() {
  const username = (process.argv[2] || 'fcecolombia').replace(/.*instagram\.com\//, '').replace(/\//g, '');

  console.log(`\n=== Strategy 1: GraphQL API (fetch) ===`);
  try {
    const graphqlUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const resp = await fetch(graphqlUrl, {
      headers: {
        'User-Agent': DESKTOP_UA,
        'X-IG-App-ID': '936619743392459', // Public IG web app ID
      },
    });
    console.log(`Status: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json() as any;
      const user = data?.data?.user;
      if (user) {
        console.log(`Username: ${user.username}`);
        console.log(`Full name: ${user.full_name}`);
        console.log(`Bio: ${user.biography}`);
        console.log(`Followers: ${user.edge_followed_by?.count}`);
        console.log(`Posts count: ${user.edge_owner_to_timeline_media?.count}`);
        const posts = user.edge_owner_to_timeline_media?.edges || [];
        console.log(`Posts in response: ${posts.length}`);
        for (const edge of posts.slice(0, 5)) {
          const node = edge.node;
          const shortcode = node.shortcode;
          const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || '(no caption)';
          console.log(`  /p/${shortcode}: ${caption.substring(0, 80)}...`);
        }
      }
    } else {
      const text = await resp.text();
      console.log(`Response: ${text.substring(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }

  console.log(`\n=== Strategy 2: HTML page with desktop UA (Playwright) ===`);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: DESKTOP_UA,
      viewport: { width: 1280, height: 800 },
      locale: 'es-CO',
    });
    const page = await context.newPage();
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Check for shared_data or window._sharedData
    const sharedData = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        if (text.includes('window._sharedData')) {
          const match = text.match(/window\._sharedData\s*=\s*({[\s\S]*?});\s*$/);
          if (match) return match[1].substring(0, 500);
        }
        if (text.includes('window.__additionalDataLoaded')) {
          return 'Found __additionalDataLoaded script';
        }
      }
      return null;
    });
    console.log(`window._sharedData: ${sharedData ? 'found' : 'not found'}`);

    // Check for post links on desktop
    const postLinks = await page.locator('a[href*="/p/"], a[href*="/reel/"]').count();
    console.log(`Post links on desktop: ${postLinks}`);

    // Try to dismiss login overlay and scroll
    try {
      await page.locator('button:has-text("Not Now"), button:has-text("Ahora no")').first().click({ timeout: 2000 });
      await new Promise(r => setTimeout(r, 1000));
    } catch { /* no popup */ }

    const postLinksAfter = await page.locator('a[href*="/p/"], a[href*="/reel/"]').count();
    console.log(`Post links after dismiss attempt: ${postLinksAfter}`);

    // Screenshot
    await page.screenshot({ path: 'data/ig-debug-desktop.png' });
    console.log(`Screenshot: data/ig-debug-desktop.png`);

    await context.close();
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }

  console.log(`\n=== Strategy 3: Direct post URL ===`);
  try {
    const context = await browser.newContext({
      userAgent: DESKTOP_UA,
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    // Try a known FCE post (we'll pick one if GraphQL worked)
    await page.goto('https://www.instagram.com/fcecolombia/', { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Get page source for embedded data
    const html = await page.content();
    // Look for JSON-LD or meta tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content').catch(() => null);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => null);
    console.log(`og:title: ${ogTitle}`);
    console.log(`og:description: ${ogDesc?.substring(0, 200)}`);
    console.log(`og:image: ${ogImage ? 'yes' : 'no'}`);

    await context.close();
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }

  await browser.close();
}

main().catch(console.error);
