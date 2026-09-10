import { AppDataSource, User } from "@hr-portal/database";

const userOrm = AppDataSource.getRepository(User);

export class AuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    return userOrm.findOneBy({ email });
  }

  create(data: { email: string; pin: string; name?: string }): User {
    return userOrm.create(data);
  }

  async save(user: User): Promise<User> {
    return userOrm.save(user);
  }
}

export const authRepository = new AuthRepository();
