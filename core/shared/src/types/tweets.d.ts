export interface Tweet {
    url: string;
    data: string;
    time: string | Date;
    retweetCount?: number;
    replyCount?: number;
    likeCount?: number;
}
