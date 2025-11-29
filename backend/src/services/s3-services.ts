// src/services/s3-service.ts
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION ?? 'us-east-1';
const bucket = process.env.AWS_S3_BUCKET ?? '';

if (!bucket) {
  // você pode trocar por logger se quiser
  console.warn('[s3-service] AWS_S3_BUCKET não definido. Uploads não vão funcionar.');
}

export const s3 = new S3Client({
  region,
  // se estiver rodando no Docker/ECS/Lambda com IAM, pode até omitir credenciais
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      }
    : undefined,
});

export type UploadParams = {
  key: string;
  body: Buffer | Uint8Array | Blob | string | Readable;
  contentType?: string;
  aclPublic?: boolean;
};

/**
 * Faz upload de um arquivo para o S3.
 * Retorna a URL pública (ou do bucket) do objeto salvo.
 */
export async function uploadToS3(params: UploadParams): Promise<string> {
  const { key, body, contentType, aclPublic } = params;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: aclPublic ? 'public-read' : undefined,
  });

  await s3.send(command);

  const baseUrl =
    process.env.AWS_S3_BASE_URL ??
    `https://${bucket}.s3.${region}.amazonaws.com`;

  return `${baseUrl}/${encodeURI(key)}`;
}

/**
 * Remove um objeto do S3.
 */
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3.send(command);
}

/**
 * Gera uma URL assinada temporária para download.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });

  return url;
}
