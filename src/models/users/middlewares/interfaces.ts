import { User } from '../entities/user.entity';

export interface ICurrentUser {
  error: string | null;
  user: User | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser: ICurrentUser;
    }
  }
}
