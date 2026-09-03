import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ChatService, ChatTabType } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Dua tab: 'visitor' (E2V/V2E) dan 'exhibitor' (E2E) - sama polanya
  // dengan Meeting.
  @Get('rooms')
  @ApiQuery({ name: 'type', enum: ['visitor', 'exhibitor'], required: true })
  listRooms(@CurrentUser() user: CurrentExhibitor, @Query('type') type: ChatTabType) {
    return this.chatService.listRooms(user, type);
  }

  @Get('rooms/:chatId/messages')
  getMessages(
    @CurrentUser() user: CurrentExhibitor,
    @Param('chatId', ParseIntPipe) chatId: number,
  ) {
    return this.chatService.getMessages(user, chatId);
  }

  @Post('rooms/:chatId/messages')
  sendMessage(
    @CurrentUser() user: CurrentExhibitor,
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user, chatId, dto.message);
  }
}
