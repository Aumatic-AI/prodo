export interface PublishResult {
  success: boolean;
  /** Encoded as "job_id:xxx" or "request_id:xxx" so getStatus() later knows
   * which query param Upload-Post expects — a scheduled submission returns
   * a job_id, an immediate one a request_id. */
  providerRef?: string;
  url?: string;
  error?: string;
  /** True when this was submitted as a future scheduled post — Upload-Post
   * itself holds and fires it, so "success" here means "queued", not "live". */
  scheduled?: boolean;
}

export interface Publisher {
  publishPhoto(params: {
    imageUrl: string;
    caption: string;
    accountId: string;
    scheduledDate?: string;
  }): Promise<PublishResult>;

  publishVideo(params: {
    videoUrl: string;
    caption: string;
    accountId: string;
    scheduledDate?: string;
  }): Promise<PublishResult>;

  publishText(params: {
    caption: string;
    accountId: string;
    scheduledDate?: string;
  }): Promise<PublishResult>;

  getStatus(providerRef: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    url?: string;
    error?: string;
  }>;

  listAccounts(): Promise<
    {
      id: string;
      platform: string;
      name: string;
      profileUrl?: string;
      avatarUrl?: string;
    }[]
  >;
}
