import { Injectable } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';

/** Filtre global : formate toutes les erreurs en JSON cohérent. */
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    let status = 500;
    let message = 'Erreur interne du serveur.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload: any = exception.getResponse();
      message =
        typeof payload === 'string'
          ? payload
          : Array.isArray(payload.message)
            ? payload.message.join(' ')
            : payload.message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }
    res.status(status).json({ statusCode: status, message });
  }
}

export const GlobalProviders = [
  { provide: APP_FILTER, useClass: AllExceptionsFilter },
];
