import { Body, Controller, HttpStatus, HttpException, Post, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { LoginUserUseCase } from '@/application/user/use-case/login-user.use-case';
import { CreateJwtUserUseCase } from '@/application/user/use-case/create-jwt-user.use-case';
import { LoginUserRequest } from '@/presentation/requests/user/login-user.request';
import { LoginUserDocs } from './login-user.doc';

@ApiTags(LoginUserDocs.tags)
@Controller('user/login')
export class LoginUserController {
  constructor(
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly createJwtUserUseCase: CreateJwtUserUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation(LoginUserDocs.operation)
  @ApiBody({ type: LoginUserRequest, ...LoginUserDocs.body })
  @ApiResponse(LoginUserDocs.response)
  async login(@Body() dataRequest: LoginUserRequest, @Res({ passthrough: true }) res: FastifyReply) {
    try {
      const user = await this.loginUserUseCase.execute(dataRequest);
      const token = await this.createJwtUserUseCase.execute(user);

      res.setCookie('meta-session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      return {
        success: true,
        message: 'Logado com sucesso!',
        accessToken: token,
      };
    } catch (error) {
      if (error.getStatus?.()) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Ocorreu um erro inesperado ao autenticar usuário',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
