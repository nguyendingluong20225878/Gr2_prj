import type { XAccountSchema } from "../../db/schema/x_accounts.js";
import { Repository } from "./Repository.js";

export type XAccountSelect = XAccountSchema;
export type XAccountRepoInsert = XAccountSchema;

export interface XAccountRepository
  extends Repository<XAccountSelect, XAccountRepoInsert> {

  findByUserId(userId: string): Promise<XAccountSelect[]>;

  updateLastTweetUpdatedAt(
    accountId: string,
    tweetTimestamp: Date
  ): Promise<void>;

  addUser(accountId: string, userId: string): Promise<void>;
  removeUser(accountId: string, userId: string): Promise<void>;
}
