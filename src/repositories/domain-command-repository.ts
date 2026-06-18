import type { SupabaseClient } from "@supabase/supabase-js";
import { RpcRepository } from "@/lib/database/rpc-repository";

export class DomainCommandRepository {
  private readonly rpc: RpcRepository;

  constructor(client: SupabaseClient) {
    this.rpc = new RpcRepository(client);
  }

  execute<T>(operation: string, args: Record<string, unknown> = {}) {
    return this.rpc.call<T>(operation, args);
  }
}
