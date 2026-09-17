import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/guards';
import { AssistantService } from './assistant.service';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Le message est requis.' })
  @MaxLength(2000, { message: 'Message trop long (2000 caractères max).' })
  message: string;
}

/**
 * Assistant IA Shield — espace CLIENT.
 * Conversation textuelle ou vocale (la transcription des notes vocales
 * est faite côté navigateur, l'API reçoit du texte).
 */
@ApiTags('assistant')
@ApiBearerAuth()
@Controller('customer/assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('welcome')
  @ApiOperation({ summary: "Message d'accueil de l'assistant" })
  welcome(@CurrentUser() user: any) {
    return this.assistant.welcome(user);
  }

  @Post('chat')
  @ApiOperation({ summary: "Envoyer un message (texte ou note vocale transcrite) à l'assistant" })
  chat(@CurrentUser() user: any, @Body() dto: ChatMessageDto) {
    return this.assistant.chat(user, dto.message);
  }
}
