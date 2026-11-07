/**
 * Cifrado del sorteo.
 *
 * Cada resultado ("a quién le regala X") se guarda cifrado con AES-256-GCM usando una
 * llave derivada de DRAW_SECRET (variable de entorno del servidor) + el id de quien regala.
 * La base de datos nunca guarda el resultado en claro y el panel de admin no tiene forma
 * de descifrarlo: solo el endpoint del participante, tras validar su PIN.
 *
 * El PIN (6 dígitos) se guarda solo como hash scrypt (con sal).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** PIN nuevo: 6 dígitos. */
export const PIN_REGEX = /^\d{6}$/;
/** Para entrar se aceptan también PINs antiguos de 4 dígitos (creados antes del cambio a 6). */
export const PIN_LOGIN_REGEX = /^\d{4,6}$/;
const PIN_SCRYPT = { N: 1 << 14, r: 8, p: 1 };
const INFO = Buffer.from("amigo-secreto/draw/v2");

function masterKey(): Buffer {
  const s = process.env.DRAW_SECRET;
  if (!s || s.length < 16) throw new Error("DRAW_SECRET debe tener al menos 16 caracteres");
  return Buffer.from(s, "utf8");
}

function keyFor(giverId: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey(), Buffer.from(giverId), INFO, 32));
}

/** Cifra el resultado de un participante. */
export function sealForGiver(giverId: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(giverId), iv);
  cipher.setAAD(Buffer.from(giverId));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v2", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

export function openForGiver(giverId: string, sealed: string): string {
  const [v, ivB64, tagB64, ctB64] = sealed.split(".");
  if (v !== "v2") throw new Error("Formato de cifrado desconocido");
  const decipher = createDecipheriv("aes-256-gcm", keyFor(giverId), Buffer.from(ivB64, "base64"));
  decipher.setAAD(Buffer.from(giverId));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

function scryptAsync(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, salt, 32, PIN_SCRYPT, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

export async function verifyPin(pin: string, salt: string, hash: string) {
  const actual = await scryptAsync(pin, Buffer.from(salt, "base64"));
  const expected = Buffer.from(hash, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
