import { TweetInsert, TweetSelect } from "../../db/schema/tweets.js";
import { Repository } from "./Repository.js";

export interface TweetRepository extends Repository<TweetSelect, TweetInsert> {
  findByAccountId(accountId: string, limit?: number): Promise<TweetSelect[]>;
  findLatestByAccountId(accountId: string): Promise<TweetSelect | null>;
  create(tweet: TweetInsert): Promise<TweetSelect>;
}
