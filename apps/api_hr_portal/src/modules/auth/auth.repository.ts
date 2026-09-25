import { AppDataSource, User } from "@hr-portal/database";

const userOrm = AppDataSource.getRepository(User);

export class AuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    // Prefer lowest id when case-duplicates exist (keeps historical timesheets)
    return userOrm
      .createQueryBuilder("user")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .orderBy("user.id", "ASC")
      .getOne();
  }

  create(data: { email: string; pin?: string; name?: string }): User {
    return userOrm.create({
      ...data,
      email: data.email.toLowerCase().trim(),
    });
  }

  async save(user: User): Promise<User> {
    return userOrm.save(user);
  }
}

export const authRepository = new AuthRepository();
