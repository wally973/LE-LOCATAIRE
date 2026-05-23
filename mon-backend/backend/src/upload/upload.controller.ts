import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('upload')
@ApiBearerAuth('bearer')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
  @Post()
  @Roles('LOCATAIRE', 'BAILLEUR', 'ADMIN', 'PRESTATAIRE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const ext = file.originalname.split('.').pop();
          const filename = `${uuid()}.${ext}`;
          callback(null, filename);
        },
      }),
    }),
  )
  uploadFile(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    const configured = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    const base =
      configured ||
      `${req.protocol}://${req.get('host') ?? 'localhost:3000'}`;
    return {
      url: `${base}/uploads/${file.filename}`,
    };
  }
}
