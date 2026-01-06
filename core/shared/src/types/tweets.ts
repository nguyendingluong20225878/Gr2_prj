// shared/src/types/tweets.ts

export interface Tweet {
  url: string;
  data: string;        // db.ts đang map t.data vào content
  time: string | Date; // db.ts đang dùng new Date(t.time)
  retweetCount?: number;
  replyCount?: number;
  likeCount?: number;
}