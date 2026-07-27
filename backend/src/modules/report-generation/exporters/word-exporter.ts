import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from 'docx';

export class WordExporter {
  async export(content: string, title: string): Promise<Buffer> {
    const doc = new Document({
      sections: [{
        properties: {},
        children: this.parseMarkdown(content, title),
      }],
    });
    
    return Packer.toBuffer(doc);
  }

  private parseMarkdown(content: string, title: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    
    // 添加标题
    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line.trim()) {
        // 空行
        paragraphs.push(new Paragraph({ text: '' }));
        continue;
      }
      
      if (line.startsWith('# ')) {
        // H1 标题
        paragraphs.push(new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 },
        }));
      } else if (line.startsWith('## ')) {
        // H2 标题
        paragraphs.push(new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 250, after: 150 },
        }));
      } else if (line.startsWith('### ')) {
        // H3 标题
        paragraphs.push(new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }));
      } else if (line.match(/^\d+\.\s/)) {
        // 有序列表
        const text = line.replace(/^\d+\.\s/, '');
        paragraphs.push(new Paragraph({
          text: text,
          bullet: { level: 0 },
          spacing: { before: 50, after: 50 },
        }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // 无序列表
        const text = line.substring(2);
        paragraphs.push(new Paragraph({
          text: text,
          bullet: { level: 0 },
          spacing: { before: 50, after: 50 },
        }));
      } else if (line.match(/^\s+\d+\.\s/) || line.match(/^\s+[-*]\s/)) {
        // 缩进列表
        const indent = line.search(/\S/);
        const level = Math.floor(indent / 2);
        const text = line.trim().replace(/^(\d+\.|-|\*)\s/, '');
        paragraphs.push(new Paragraph({
          text: text,
          bullet: { level: Math.min(level, 8) },
          spacing: { before: 50, after: 50 },
        }));
      } else {
        // 普通段落
        paragraphs.push(new Paragraph({
          children: [new TextRun(line)],
          spacing: { before: 100, after: 100 },
        }));
      }
    }
    
    return paragraphs;
  }
}
