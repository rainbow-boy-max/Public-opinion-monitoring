import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as fs from 'fs';

interface UploadedFileType {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: UploadedFileType) {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('不支持的文件类型');
    }
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = `/data/uploads/${filename}`;
    await fs.promises.mkdir('/data/uploads', { recursive: true });
    await fs.promises.writeFile(filepath, file.buffer);
    return { url: `/uploads/${filename}`, name: file.originalname, size: file.size };
  }
}
