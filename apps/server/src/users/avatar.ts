import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import { AuthError, err, ok } from '@lyra/shared';
import type { Result } from '@lyra/shared';

const AVATAR_SIZE = 256;
const AVATAR_QUALITY = 85;
// Rejects decompression bombs before sharp allocates the full bitmap.
const MAX_INPUT_PIXELS = 40_000_000;

export function avatarPath(dataDir: string, userId: string) {
  return join(dataDir, 'avatars', `${userId}.webp`);
}

/** Crops to a square, strips metadata and stores it as WebP. */
export async function saveAvatar(
  dataDir: string,
  userId: string,
  image: ArrayBuffer,
): Promise<Result<null, AuthError>> {
  let output: Buffer;

  try {
    output = await sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .webp({ quality: AVATAR_QUALITY })
      .toBuffer();
  } catch {
    return err(AuthError.InvalidImage);
  }

  await mkdir(join(dataDir, 'avatars'), { recursive: true });
  await Bun.write(avatarPath(dataDir, userId), output);

  return ok(null);
}

export async function deleteAvatar(dataDir: string, userId: string) {
  await rm(avatarPath(dataDir, userId), { force: true });
}
