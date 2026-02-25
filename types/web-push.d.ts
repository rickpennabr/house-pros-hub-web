declare module 'web-push' {
  interface PushSubscriptionLike {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function generateVAPIDKeys(): Promise<VapidKeys>;

  export function sendNotification(
    subscription: PushSubscriptionLike,
    payload: string | Buffer | null,
    options?: { TTL?: number; contentEncoding?: string }
  ): Promise<{ statusCode: number }>;

  export function sendNotification(
    subscription: PushSubscriptionLike,
    payload: string | Buffer | null,
    options: { TTL?: number; contentEncoding?: string; vapidDetails?: { subject: string; publicKey: string; privateKey: string } }
  ): Promise<{ statusCode: number }>;
}
