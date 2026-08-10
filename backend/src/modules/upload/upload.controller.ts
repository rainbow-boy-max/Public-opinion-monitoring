import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  PayloadTooLargeException,
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
      fileFilter: (req, file, callback) => {
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'video/mp4', 'video/quicktime',
          'application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain', 'text/csv',
          'application/json', 'application/octet-stream',
        ];
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException('不支持的文件类型'), false);
        }
      },
    }),
  )
  async upload(@UploadedFile() file: UploadedFileType) {
    if (!file) {
      throw new BadRequestException('文件上传失败');
    }
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = `/data/uploads/${filename}`;
    await fs.promises.mkdir('/data/uploads', { recursive: true });
    await fs.promises.writeFile(filepath, file.buffer);
    return { url: `/uploads/${filename}`, name: file.originalname, size: file.size };
  }
}
