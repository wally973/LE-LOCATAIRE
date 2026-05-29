import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LiaLabService } from './lia-lab.service';
import {
  CreateLabSessionDto,
  LabMessageDto,
  LabTtsDto,
} from './dto/lia-lab.dto';

/** Lia-Lab — intercom Jarvis (ADMIN) : STT, TTS, chat sandbox + console visualisation. */
@ApiTags('lia-lab')
@ApiBearerAuth()
@Controller('lia-lab')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LiaLabController {
  constructor(private readonly lab: LiaLabService) {}

  @Post('sessions')
  createSession(@Body() dto: CreateLabSessionDto) {
    return this.lab.createSession(dto);
  }

  @Post('sessions/start')
  startSession(@Body() dto: CreateLabSessionDto) {
    return this.lab.startSession(dto);
  }

  @Post('sessions/:id/opening')
  openSession(@Param('id') id: string) {
    return this.lab.runOpening(id);
  }

  @Post('sessions/:id/message')
  message(@Param('id') id: string, @Body() dto: LabMessageDto) {
    return this.lab.sendTenantMessage(id, dto.text);
  }

  @Get('sessions/:id/visualization')
  visualization(@Param('id') id: string) {
    return this.lab.getVisualization(id);
  }

  @Post('transcribe')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      return { text: '' };
    }
    const text = await this.lab.transcribeAudio(
      file.buffer,
      file.mimetype || 'audio/webm',
    );
    return { text };
  }

  @Post('tts')
  async tts(@Body() dto: LabTtsDto) {
    return this.lab.synthesizeSpeech(dto.text, dto.language ?? 'fr');
  }
}
