import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// Decorators are not part of DI system, so we cannot use any service here.
// We can use context, which allows to retrieve the request
// So, we can use a service indirectly by using an interceptor or a middleware (both can use DI) and enrich
// the request with what we want before it reaches the decorator

/**
 * Returns the user sending the request.
 * May be null if no user detected.
 * You should use AuthGuard to prevent access to routes requiring an authenticated user
 */
export const CurrentUser = createParamDecorator(
  // when we use the decorator, anything we put in @CurrentUser('here') will be available in param data:'here'
  // here, we never pass data, because we don't need it, sor we tell it to typescript (never)
  (_data: never, context: ExecutionContext) => {
    const req: Request = context.switchToHttp().getRequest();
    if (!req.currentUser) throw new Error('Fatal error: CurrentUserDecorator requires CurrentUserMiddleware');
    return req.currentUser.user;
  }
);
