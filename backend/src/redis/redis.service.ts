import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType, RedisModules, RedisFunctions, RedisScripts } from 'redis';

type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

interface SubscriberEntry {
  client: RedisClient;
  channels: Set<string>;
  callbacks: Map<string, Set<(message: string) => void>>;
}

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  public client: RedisClient;
  private subscribers: SubscriberEntry[] = [];
  private counter = 0;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(this.configService.get<string>('REDIS_PORT') || process.env.REDIS_PORT || '6379', 10);
    const password = this.configService.get<string>('REDIS_PASSWORD') || process.env.REDIS_PASSWORD || '';
    const db = parseInt(this.configService.get<string>('REDIS_DB') || process.env.REDIS_DB || '0', 10);

    const url = `redis://${host}:${port}/${db}`;
    const options: Record<string, unknown> = { url };
    if (password) {
      (options as any).password = password;
    }

    this.client = createClient(options) as RedisClient;
    this.client.on('error', (err) => this.logger.error('Redis client error', err));

    await this.client.connect();
    this.logger.log(`Connected to Redis at ${host}:${port}`);
  }

  async onApplicationShutdown() {
    if (this.client) {
      try { await this.client.quit(); } catch (err) { /* ignore */ }
    }
    for (const sub of this.subscribers) {
      try { await sub.client.quit(); } catch (err) { /* ignore */ }
    }
  }

  private async getOrCreateSubscriber(): Promise<SubscriberEntry> {
    let entry = this.subscribers.find((s) => s.channels.size === 0);
    if (!entry) {
      const newClient = this.client.duplicate();
      newClient.on('error', (err) => this.logger.error('Redis sub error', err));
      await newClient.connect();
      entry = {
        client: newClient,
        channels: new Set(),
        callbacks: new Map(),
      };
      this.subscribers.push(entry);
    }
    return entry;
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const sub = await this.getOrCreateSubscriber();
    sub.channels.add(channel);
    if (!sub.callbacks.has(channel)) {
      sub.callbacks.set(channel, new Set());
      await sub.client.subscribe(channel, (message: string) => {
        const callbacks = sub.callbacks.get(channel);
        if (!callbacks) return;
        for (const cb of callbacks) {
          try {
            cb(message);
          } catch (err) {
            this.logger.error(`Subscriber callback error: ${(err as Error).message}`);
          }
        }
      });
    }
    sub.callbacks.get(channel)!.add(callback);
    void this.counter++;
  }

  async unsubscribe(channel: string): Promise<void> {
    for (const sub of this.subscribers) {
      if (sub.channels.has(channel)) {
        sub.channels.delete(channel);
        sub.callbacks.delete(channel);
        try {
          await sub.client.unsubscribe(channel);
        } catch (err) {
          this.logger.warn('Unsubscribe error', (err as Error).message);
        }
      }
    }
  }

  async get(key: string): Promise<string | null> {
    const result = await this.client.get(key);
    if (result === null || result === undefined) return null;
    return String(result);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.client.sAdd(key, member);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.client.sRem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.sMembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sIsMember(key, member);
    return Boolean(result);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result > 0;
  }
}
