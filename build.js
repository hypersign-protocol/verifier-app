const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const publicDir = path.join(__dirname, 'public');
const outDir = path.join(__dirname, 'dist');

async function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  await fs.promises.rm(dir, { recursive: true, force: true });
}

function injectEnvVariables(htmlContent) {
  const entityDashboardBaseUrl = process.env.HYPERSIGN_DASHBOARD_SERVICE_BASE_URL || 'https://api.entity.dashboard.hypersign.id';
  const idDashboardServiceBaseUrl = process.env.ID_SERVICE_BASE_URL || 'https://api.cavach.hypersign.id';
  const widgetUrl = process.env.WIDGET_URL || 'https://verify.hypersign.id/';

  const envScript = `\n    <script>\n        window.HYPERSIGN_DASHBOARD_SERVICE_BASE_URL = '${entityDashboardBaseUrl}';\n        window.ID_SERVICE_BASE_URL = '${idDashboardServiceBaseUrl}';\n        window.WIDGET_URL = '${widgetUrl}';\n        window.KYC_WIDGET_URL = '${process.env.KYC_WIDGET_URL || 'https://verify.hypersign.id/'}';\n    </script>\n`;

  return htmlContent.replace('</head>', `${envScript}\n</head>`);
}

async function copyRecursive(src, dest) {
  const stat = await fs.promises.stat(src);
  if (stat.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src);
    await Promise.all(entries.map(e => copyRecursive(path.join(src, e), path.join(dest, e))));
  } else {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
  }
}

async function build() {
  console.log('Building static site into dist/');
  await rmDir(outDir);
  await fs.promises.mkdir(outDir, { recursive: true });

  // Process both entry documents so direct and SPA-fallback routes share config.
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = await fs.promises.readFile(indexPath, 'utf8');
    const processed = injectEnvVariables(html);
    await Promise.all([
      fs.promises.writeFile(path.join(outDir, 'index.html'), processed, 'utf8'),
      fs.promises.writeFile(path.join(outDir, '404.html'), processed, 'utf8'),
    ]);
  }

  // Copy static assets and data; entry documents were generated above.
  const entries = await fs.promises.readdir(publicDir);
  await Promise.all(entries.map(async (entry) => {
    if (entry === 'index.html' || entry === '404.html') return;
    await copyRecursive(path.join(publicDir, entry), path.join(outDir, entry));
  }));

  console.log('Build complete. Serve the `dist` folder as static site.');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
