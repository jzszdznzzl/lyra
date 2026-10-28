import { z } from 'zod';

// Mirrors the WebAuthn JSON option types, so the browser can validate what the server sends
// before handing it to `navigator.credentials`.

const Requirement = z.enum(['discouraged', 'preferred', 'required']);

const Transport = z.enum(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);

const Hint = z.enum(['hybrid', 'security-key', 'client-device']);

const CredentialDescriptor = z.object({
  id: z.string(),
  type: z.literal('public-key'),
  transports: z.array(Transport).exactOptional(),
});

const Extensions = z.object({ credProps: z.boolean().exactOptional() });

export const PasskeyCreationOptions = z.object({
  rp: z.object({ name: z.string(), id: z.string().exactOptional() }),
  user: z.object({ id: z.string(), name: z.string(), displayName: z.string() }),
  challenge: z.string(),
  pubKeyCredParams: z.array(z.object({ alg: z.number(), type: z.literal('public-key') })),
  timeout: z.number().exactOptional(),
  excludeCredentials: z.array(CredentialDescriptor).exactOptional(),
  authenticatorSelection: z
    .object({
      authenticatorAttachment: z.enum(['cross-platform', 'platform']).exactOptional(),
      requireResidentKey: z.boolean().exactOptional(),
      residentKey: Requirement.exactOptional(),
      userVerification: Requirement.exactOptional(),
    })
    .exactOptional(),
  hints: z.array(Hint).exactOptional(),
  attestation: z.enum(['direct', 'enterprise', 'indirect', 'none']).exactOptional(),
  extensions: Extensions.exactOptional(),
});

export type PasskeyCreationOptions = z.infer<typeof PasskeyCreationOptions>;

export const PasskeyRequestOptions = z.object({
  challenge: z.string(),
  timeout: z.number().exactOptional(),
  rpId: z.string().exactOptional(),
  allowCredentials: z.array(CredentialDescriptor).exactOptional(),
  userVerification: Requirement.exactOptional(),
  hints: z.array(Hint).exactOptional(),
  extensions: Extensions.exactOptional(),
});

export type PasskeyRequestOptions = z.infer<typeof PasskeyRequestOptions>;

export const PasskeyRegistrationStart = z.object({
  challengeId: z.string(),
  options: PasskeyCreationOptions,
});

export type PasskeyRegistrationStart = z.infer<typeof PasskeyRegistrationStart>;

export const PasskeyLoginStart = z.object({
  challengeId: z.string(),
  options: PasskeyRequestOptions,
});

export type PasskeyLoginStart = z.infer<typeof PasskeyLoginStart>;
