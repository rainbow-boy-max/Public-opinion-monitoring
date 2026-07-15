import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeBaseFileEntity } from '../../database/entities';
import { KnowledgeBasesService } from './knowledge-bases.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomBytes } from 'crypto';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('admin/knowledge/:id/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class KnowledgeBasesUploadController {
  constructor(
    private service: KnowledgeBasesService,
    @InjectRepository(KnowledgeBaseFileEntity)
    private fileRepo: Repository<KnowledgeBaseFileEntity>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile,
    @CurrentUser('id') operatorId: number,
    @Body('filename_utf8') filenameUtf8?: string,
  ) {
    if (!file) throw new BadRequestException('请选择文件');
    // multer 将中文文件名存储为 latin-1 编码，前端传 filename_utf8 覆盖
    const decodedName: string = (filenameUtf8
      ? filenameUtf8
      : Buffer.from(file.originalname, 'binary').toString('utf8')
    ).replace(/[<>:"/\\|?*]/g, '_');
    const ext = path.extname(decodedName).toLowerCase().replace('.', '');
    const allowed = ['pdf', 'docx', 'ppt', 'pptx', 'txt', 'md', 'html'];
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        `不支持的格式: .${ext} (允许: ${allowed.join(', ')})`,
      );
    }

    const kb = await this.service.getOne(id);

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || '/workspace/backend/uploads', 'knowledge', String(kb.id));
    await fs.mkdir(uploadDir, { recursive: true });
    const timestamp = Date.now();
    const random = randomBytes(6).toString('hex');
    const safeName = `${timestamp}_${random}.${ext}`;
    const storagePath = path.join(uploadDir, safeName);
    await fs.writeFile(storagePath, file.buffer);

    const fileType = ext === 'pptx' ? 'pptx' : ext;
    const record = this.fileRepo.create({
      kbId: kb.id,
      filename: decodedName,
      fileType,
      fileSize: file.size,
      storagePath,
      status: 'pending' as any,
      uploadedBy: operatorId,
    });
    const result = await this.fileRepo.save(record);
    const saved = Array.isArray(result) ? result[0] : result;

    kb.status = 'processing' as any;
    await this.service.update(kb.id, {});
    await this.service.enqueueParse(kb.id, saved.id, storagePath, fileType);

    return {
      id: saved.id,
      kbId: saved.kbId,
      filename: saved.filename,
      fileSize: saved.fileSize,
      status: saved.status,
      message: '上传成功，正在后台 AI 解析、打分与增强...',
    };
  }
}
