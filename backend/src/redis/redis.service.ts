import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType, RedisModules, RedisFunctions, RedisScripts } from 'redis';

type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  public client: RedisClient;
  private subscriber: RedisClient;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db');

    const url = `redis://${host}:${port}/${db}`;
    const options: Record<string, unknown> = { url };
    if (password) {
      (options as any).password = password;
    }

    this.client = createClient(options) as RedisClient;
    this.subscriber = this.client.duplicate();

    this.client.on('error', (err) => this.logger.error('Redis client error', err));
    this.subscriber.on('error', (err) => this.logger.error('Redis subscriber error', err));

    await this.client.connect();
    await this.subscriber.connect();
    this.logger.log(`Connected to Redis at ${host}:${port}`);
  }

  async onApplicationShutdown() {
    if (this.client) await this.client.quit();
    if (this.subscriber) await this.subscriber.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
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

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel, callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
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
    return result;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result > 0;
  }
}
