import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import { s3Environment } from '@core/config/environments.js';
import type { IUploadProfilePictureInput } from '@core/interfaces/storage/IUploadProfilePictureInput.js';

@injectable()
export class StorageService {
  private readonly client = new S3Client({
    region: s3Environment.region,
    endpoint: s3Environment.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: s3Environment.accessKey,
      secretAccessKey: s3Environment.secretKey,
    },
  });

  async uploadProfilePicture(
    input: IUploadProfilePictureInput
  ): Promise<string> {
    const extension =
      this.extensionFromMime(input.mimeType) ??
      this.extensionFromName(input.originalName) ??
      'bin';
    const key = `users/profile-pictures/${randomUUID()}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: s3Environment.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
      })
    );

    return `${s3Environment.publicBaseUrl.replace(/\/$/, '')}/${s3Environment.bucket}/${key}`;
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const key = this.keyFromUrl(url);
    if (!key) return;

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: s3Environment.bucket,
        Key: key,
      })
    );
  }

  private keyFromUrl(url: string): string | null {
    const marker = `/${s3Environment.bucket}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return url.slice(index + marker.length);
  }

  private extensionFromMime(mimeType: string): string | null {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    return map[mimeType] ?? null;
  }

  private extensionFromName(name: string): string | null {
    const parts = name.split('.');
    if (parts.length < 2) return null;
    return parts.at(-1)?.toLowerCase() ?? null;
  }
}
