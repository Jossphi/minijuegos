/**
 * Cifrado del sorteo.
 *
 * Cada participante elige una clave secreta al registrarse. De esa clave se deriva
 * (scrypt) un par de llaves X25519. En la base de datos solo se guarda la llave
 * PÚBLICA. Cuando se hace el sorteo, el servidor cifra "a quién le toca" con la
 * llave pública de cada persona y descarta el resultado en claro: nunca se guarda.
 *
 * Para leer su resultado, la persona escribe su clave → se vuelve a derivar la
 * llave privada → se descifra. Ni el admin ni quien mire la base de datos puede
 * leer los resultados sin las claves de cada uno.
 */
import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PKCS8_X25519_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");
const INFO = Buffer.from("amigo-secreto/v1");

export const MIN_SECRET_LENGTH = 6;

export function normalizeSecret(secret: string) {
  return secret.normalize("NFKC").trim();
}

function deriveSeed(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(normalizeSecret(secret), salt, 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

function privateKeyFromSeed(seed: Buffer): KeyObject {
  return createPrivateKey({ key: Buffer.concat([PKCS8_X25519_PREFIX, seed]), format: "der", type: "pkcs8" });
}

function rawPublic(key: KeyObject): Buffer {
  const der = createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer;
  return der.subarray(der.length - 32);
}

function publicKeyFromRaw(raw: Buffer): KeyObject {
  const spki = Buffer.concat([Buffer.from("302a300506032b656e032100", "hex"), raw]);
  return createPublicKey({ key: spki, format: "der", type: "spki" });
}

/** Al registrarse: devuelve la sal y la llave pública que se guardan en la BD. */
export async function createKeyMaterial(secret: string) {
  const salt = randomBytes(16);
  const seed = await deriveSeed(secret, salt);
  const pub = rawPublic(privateKeyFromSeed(seed));
  return { kdfSalt: salt.toString("base64"), publicKey: pub.toString("base64") };
}

/** Comprueba la clave y devuelve la llave privada si es correcta. */
export async function unlock(secret: string, kdfSalt: string, publicKey: string): Promise<KeyObject | null> {
  const seed = await deriveSeed(secret, Buffer.from(kdfSalt, "base64"));
  const priv = privateKeyFromSeed(seed);
  const expected = Buffer.from(publicKey, "base64");
  const actual = rawPublic(priv);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return priv;
}

/** Cifra un texto para el dueño de `publicKey` (ECIES: X25519 + HKDF + AES-256-GCM). */
export function sealFor(publicKey: string, plaintext: string): string {
  const recipientRaw = Buffer.from(publicKey, "base64");
  const eph = generateKeyPairSync("x25519");
  const ephRaw = rawPublic(eph.privateKey);
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: publicKeyFromRaw(recipientRaw) });
  const key = Buffer.from(hkdfSync("sha256", shared, Buffer.concat([ephRaw, recipientRaw]), INFO, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", ephRaw, iv, cipher.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64"))).join(".");
}

export function open(privateKey: KeyObject, sealed: string): string {
  const [v, ephB64, ivB64, tagB64, ctB64] = sealed.split(".");
  if (v !== "v1") throw new Error("Formato de cifrado desconocido");
  const ephRaw = Buffer.from(ephB64, "base64");
  const recipientRaw = rawPublic(privateKey);
  const shared = diffieHellman({ privateKey, publicKey: publicKeyFromRaw(ephRaw) });
  const key = Buffer.from(hkdfSync("sha256", shared, Buffer.concat([ephRaw, recipientRaw]), INFO, 32));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
