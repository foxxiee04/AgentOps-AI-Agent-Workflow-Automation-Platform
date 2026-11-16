import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { Response } from "express";
import { REQUEST_ID_HEADER, RequestWithId } from "./request-id.middleware";

type ErrorBody = {
  error?: string;
  message?: string | string[];
  details?: unknown;
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const body = this.toErrorBody(exceptionResponse);

    response.status(statusCode).json({
      statusCode,
      error: body.error ?? exception.name,
      message: body.message ?? exception.message,
      ...(body.details !== undefined ? { details: body.details } : {}),
      requestId: request.requestId ?? response.getHeader(REQUEST_ID_HEADER),
      path: request.originalUrl,
      timestamp: new Date().toISOString()
    });
  }

  private toErrorBody(response: string | object): ErrorBody {
    if (typeof response === "string") {
      return { message: response };
    }

    return response as ErrorBody;
  }
}
