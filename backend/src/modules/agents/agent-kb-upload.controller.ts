import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import { AgentKbService } from './agent-kb.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentKbFileEntity } from '../../database/entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

@Controller('admin/agents/:agentId/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AgentKbUploadController {
  constructor(
    private service: AgentKbService,
    @InjectRepository(AgentKbFileEntity)
    private fileRepo: Repository<AgentKbFileEntity>,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('agentId', ParseIntPipe) agentId: number,
    @UploadedFile() file: MulterFile,
    @CurrentUser('id') operatorId: number,
  ) {
    if (!file) throw new BadRequestException('请选择文件');
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = ['pdf', 'docx', 'ppt', 'pptx', 'txt', 'md'];
    if (!allowed.includes(ext)) {
      throw new BadRequestException(`不支持的格式: .${ext} (允许: ${allowed.join(', ')})`);
    }
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || '/workspace/backend/uploads', 'agents');
    await fs.mkdir(uploadDir, { recursive: true });
    const timestamp = Date.now();
    const random = randomBytes(6).toString('hex');
    const safeName = `${timestamp}_${random}.${ext}`;
    const storagePath = path.join(uploadDir, safeName);
    await fs.writeFile(storagePath, file.buffer);

    const fileType = ext === 'pptx' ? 'pptx' : ext;
    const record = this.fileRepo.create({
      agentId,
      filename: file.originalname,
      fileType,
      fileSize: file.size,
      storagePath,
      status: 'pending' as any,
      uploadedBy: operatorId || null,
    });
    const result = await this.fileRepo.save(record);
    const saved = Array.isArray(result) ? result[0] : result;

    await this.service.enqueueFileParsing(agentId, saved.id, storagePath, fileType);

    return {
      id: saved.id,
      filename: saved.filename,
      fileSize: saved.fileSize,
      status: saved.status,
      message: '上传成功，正在后台解析...',
    };
  }
}
