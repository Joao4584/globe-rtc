import { Body, Controller, HttpStatus, HttpException, Post, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { RegisterUserUseCase } from '@/application/user/use-case/register-user.use-case';
import { CreateJwtUserUseCase } from '@/application/user/use-case/create-jwt-user.use-case';
import { RegisterUserRequest } from '@/presentation/requests/user/register-user.request';
import { RegisterUserDocs } from './register-user.doc';

@ApiTags(RegisterUserDocs.tags)
@Controller('user/register')
export class RegisterUserController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly createJwtUserUseCase: CreateJwtUserUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation(RegisterUserDocs.operation)
  @ApiBody({ type: RegisterUserRequest, ...RegisterUserDocs.body })
  @ApiResponse(RegisterUserDocs.response)
  async register(@Body() dataRequest: RegisterUserRequest, @Res({ passthrough: true }) res: FastifyReply) {
    try {
      const user = await this.registerUserUseCase.execute(dataRequest);
      const token = await this.createJwtUserUseCase.execute(user);

      res.setCookie('meta-session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      return {
        success: true,
        message: 'Cadastro realizado com sucesso!',
        accessToken: token,
      };
    } catch (error) {
      if (error.getStatus?.()) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Ocorreu um erro inesperado ao registrar usuário',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
