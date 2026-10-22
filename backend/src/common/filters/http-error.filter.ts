import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

const DEFAULT_CODES: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

const DEFAULT_MESSAGES: Record<number, string> = {
  401: 'Sesi tidak valid, silakan masuk kembali',
  403: 'Anda tidak memiliki akses',
  404: 'Data tidak ditemukan',
  429: 'Terlalu banyak permintaan, coba lagi nanti',
};

/** Menyeragamkan respons error ke format { error: { code, message, details } }. */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private logger = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const b = (typeof body === 'object' && body) || {};

    if (status >= 500) this.logger.error(exception);

    const rawMessage = (b as any).message;
    const details = Array.isArray(rawMessage) ? rawMessage : undefined;
    res.status(status).json({
      error: {
        code: (b as any).code ?? DEFAULT_CODES[status] ?? 'INTERNAL_ERROR',
        message: details
          ? 'Isian tidak valid'
          : status >= 500
            ? 'Terjadi kesalahan pada server'
            : typeof rawMessage === 'string'
              ? rawMessage
              : typeof body === 'string'
                ? body
                : DEFAULT_MESSAGES[status] ?? 'Permintaan tidak dapat diproses',
        ...(details && { details }),
      },
    });
  }
}
