import puppeteer from 'puppeteer';
import { marked } from 'marked';

export class PdfExporter {
  async export(content: string, title: string): Promise<Buffer> {
    const html = this.generateHtml(content, title);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        printBackground: true,
      });
      
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private generateHtml(content: string, title: string): string {
    const htmlContent = marked.parse(content) as string;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body {
      font-family: "Microsoft YaHei", "SimSun", "Arial", sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-size: 14px;
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #409EFF;
      padding-bottom: 10px;
      margin-top: 30px;
      margin-bottom: 20px;
      font-size: 28px;
      text-align: center;
    }
    h2 {
      color: #333;
      margin-top: 25px;
      margin-bottom: 15px;
      font-size: 22px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 8px;
    }
    h3 {
      color: #666;
      margin-top: 20px;
      margin-bottom: 12px;
      font-size: 18px;
    }
    p {
      text-align: justify;
      margin: 10px 0;
    }
    ul, ol {
      margin: 10px 0;
      padding-left: 30px;
    }
    li {
      margin: 5px 0;
    }
    code {
      background-color: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: "Consolas", "Monaco", monospace;
    }
    pre {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid #409EFF;
      padding-left: 15px;
      margin: 15px 0;
      color: #666;
      font-style: italic;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #409EFF;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
    `;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
