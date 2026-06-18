import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/require-user";
import { DomainCommandRepository } from "@/repositories/domain-command-repository";

export class DomainCommandService {
  private readonly repository: DomainCommandRepository;

  constructor(private readonly client: SupabaseClient) {
    this.repository = new DomainCommandRepository(client);
  }

  async execute<T>(operation: string, args: Record<string, unknown> = {}) {
    await requireUser(this.client);
    return this.repository.execute<T>(operation, args);
  }
}
