import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Req,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';
import * as jwt from 'jsonwebtoken';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { headers: { authorization?: string } },
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Token requerido');

    let payload: { rol: string };
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
        rol: string;
      };
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    if (payload.rol !== 'superadmin') {
      throw new ForbiddenException('Solo superadmin puede subir documentos');
    }

    return this.ragService.uploadDocument(file);
  }
}
