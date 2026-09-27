import { z } from 'zod';

// Özel mesaj verilmemiş doğrulama hataları da Türkçe dönsün.
z.config(z.locales.tr());

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (what = 'Kayıt') => new HttpError(404, `${what} bulunamadı.`);

/** Parses req.body with a zod schema, turning issues into a 400 with Turkish field messages. */
export function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw new HttpError(400, 'Lütfen form alanlarını kontrol edin.', { fields });
}

export function idParam(req, name = 'id') {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Geçersiz kimlik.');
  return n;
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ?? {}) });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Geçersiz JSON gövdesi.' });
  }
  if (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'Bu kayıt zaten mevcut (benzersiz alan çakışması).' });
  }
  if (typeof err?.message === 'string' && err.message.includes('FOREIGN KEY constraint failed')) {
    return res.status(409).json({ error: 'Bu kayıt başka kayıtlarla ilişkili olduğu için işlem yapılamadı.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Beklenmeyen bir hata oluştu.' });
}

// Ortak zod yardımcıları --------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const zDate = z.string().regex(DATE_RE, 'Tarih YYYY-AA-GG biçiminde olmalı.');
export const zOptDate = z
  .union([zDate, z.literal(''), z.null()])
  .optional()
  .transform((v) => v || null);
export const zOptText = (max = 500) =>
  z
    .union([z.string().max(max, `En fazla ${max} karakter olabilir.`), z.null()])
    .optional()
    .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null));
export const zText = (max = 200, msg = 'Bu alan zorunludur.') => z.string().trim().min(1, msg).max(max);
export const zBool = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .optional()
  .transform((v) => (v ? 1 : 0));
export const zOptId = z
  .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
  .optional()
  .transform((v) => (v === '' || v == null ? null : v));
export const zId = z.coerce.number({ message: 'Seçim yapınız.' }).int().positive('Seçim yapınız.');
export const zMoney = z.coerce.number({ message: 'Geçerli bir tutar giriniz.' }).min(0, 'Negatif olamaz.');
