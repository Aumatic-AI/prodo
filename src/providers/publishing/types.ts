export interface PublishResult {
  success: boolean;
  providerRef?: string;
  url?: string;
  error?: string;
}

export interface Publisher {
  publishPhoto(params: {
    imageUrl: string;
    caption: string;
    accountId: string;
  }): Promise<PublishResult>;

  publishVideo(params: {
    videoUrl: string;
    caption: string;
    accountId: string;
  }): Promise<PublishResult>;

  publishText(params: {
    caption: string;
    accountId: string;
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

  getConnectUrl(): Promise<string>;
}
