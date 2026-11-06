import { ConflictException, Injectable } from '@nestjs/common';
import { IntegrationUser, UserTypeOrmRepository } from '@/infrastructure/repositories/user.repository';

@Injectable()
export class LoadUserIntegrationUseCase {
  constructor(private readonly usersRepository: UserTypeOrmRepository) {}

  async execute(data: IntegrationUser) {
    const byProvider = await this.usersRepository.findByIntegration(data);
    if (byProvider) {
      return byProvider;
    }

    // Same person signing in with another provider: the email column is unique, so creating a second user would fail.
    const byEmail = await this.usersRepository.findByEmail(data.email);
    if (!byEmail) {
      return null;
    }

    // Linking by email lets whoever controls that email into the account, so the provider must have verified it.
    if (!data.email_verified) {
      throw new ConflictException('An account with this email already exists and the provider did not verify the email.');
    }

    const providerIdColumn = data.type === 'github' ? 'github_id' : 'google_id';
    if (byEmail[providerIdColumn] && byEmail[providerIdColumn] !== String(data.id)) {
      throw new ConflictException(`This account is already linked to a different ${data.type} account.`);
    }

    return this.usersRepository.update(byEmail.id, {
      [providerIdColumn]: String(data.id),
      ...(data.type === 'github' && !byEmail.github_link ? { github_link: data.github_link } : {}),
      ...(!byEmail.avatar_url && data.avatar_url ? { avatar_url: data.avatar_url } : {}),
    });
  }
}
