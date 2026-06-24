const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const reportDir = __dirname;
  const htmlPath = path.join(reportDir, 'fe-audit-report.html');
  const pdfPath = path.join(reportDir, 'fe-audit-report.pdf');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-size:8px;color:#64748b;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial, sans-serif;">
        <span>Báo cáo audit Frontend GR2/NDL</span>
        <span>Trang <span class="pageNumber"></span>/<span class="totalPages"></span></span>
      </div>
    `,
    margin: { top: '10mm', right: '0mm', bottom: '12mm', left: '0mm' },
  });
  await browser.close();
  console.log(pdfPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
