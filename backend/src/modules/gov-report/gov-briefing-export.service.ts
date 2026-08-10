import { Injectable, Logger } from '@nestjs/common';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from 'docx';
import puppeteer from 'puppeteer';
import { marked } from 'marked';

@Injectable()
export class GovBriefingExportService {
  private readonly logger = new Logger(GovBriefingExportService.name);

  async exportWord(content: string, title: string): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: this.parseMarkdown(content, title),
        },
      ],
    });
    return Packer.toBuffer(doc);
  }

  async exportPdf(content: string, title: string): Promise<Buffer> {
    const html = this.generateHtml(content, title);
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private parseMarkdown(content: string, title: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    const lines = content.split('\n');

    for (const line of lines) {
      if (!line.trim()) {
        paragraphs.push(new Paragraph({ text: '' }));
        continue;
      }

      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
        );
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 250, after: 150 },
          }),
        );
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          }),
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(2),
            bullet: { level: 0 },
            spacing: { before: 50, after: 50 },
          }),
        );
      } else if (/^\d+\.\s/.test(line)) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^\d+\.\s/, ''),
            bullet: { level: 0 },
            spacing: { before: 50, after: 50 },
          }),
        );
      } else {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun(line)],
            spacing: { before: 100, after: 100 },
          }),
        );
      }
    }

    return paragraphs;
  }

  private generateHtml(content: string, title: string): string {
    const htmlContent = marked.parse(content) as string;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body { font-family: "Microsoft YaHei", "SimSun", "Arial", sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; font-size: 14px; }
    h1 { color: #1a1a1a; border-bottom: 3px solid #c0392b; padding-bottom: 10px; margin-top: 30px; margin-bottom: 20px; font-size: 28px; text-align: center; }
    h2 { color: #333; margin-top: 25px; margin-bottom: 15px; font-size: 22px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; }
    h3 { color: #666; margin-top: 20px; margin-bottom: 12px; font-size: 18px; }
    p { text-align: justify; margin: 10px 0; }
    ul, ol { margin: 10px 0; padding-left: 30px; }
    li { margin: 5px 0; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #c0392b; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
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
