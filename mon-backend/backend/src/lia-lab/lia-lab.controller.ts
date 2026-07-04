import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
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
  LabPathologyQuestionDto,
  LabTtsDto,
} from './dto/lia-lab.dto';

/** Lia-Lab — Intercom Grock (mono-agent, ADMIN). */
@ApiTags('lia-lab')
@ApiBearerAuth()
@Controller('lia-lab')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LiaLabController {
  constructor(private readonly lab: LiaLabService) {}

  @Post('sessions/start')
  startSession(@Body() dto: CreateLabSessionDto) {
    return this.lab.startSession(dto);
  }

  @Post('sessions/:id/message')
  message(@Param('id') id: string, @Body() dto: LabMessageDto) {
    return this.lab.sendTenantMessage(id, dto.text);
  }

  @Post('sessions/:id/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  photo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Photo requise (champ photo).');
    }
    return this.lab.sendTenantPhoto(
      id,
      file.buffer,
      file.mimetype || 'image/jpeg',
      caption,
    );
  }

  @Get('sessions/:id/visualization')
  visualization(@Param('id') id: string) {
    return this.lab.getVisualization(id);
  }

  @Post('sessions/:id/discard')
  discardSession(@Param('id') id: string) {
    this.lab.discardSession(id);
    return { ok: true };
  }

  @Post('admin/purge-living-state')
  purgeLivingState() {
    return this.lab.purgeAllLivingBuildingStates();
  }

  @Get('groq/status')
  groqStatus() {
    return this.lab.getGroqStatus();
  }

  @Post('transcribe')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) return { text: '' };
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

  /** Consultation pathologie — question directe, sans scénario Intercom. */
  @Post('pathology/ask')
  async askPathology(@Body() dto: LabPathologyQuestionDto) {
    return this.lab.askPathology(dto.question, dto.language ?? 'fr');
  }
}
