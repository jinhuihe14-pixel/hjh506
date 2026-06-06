import dayjs from 'dayjs';

export function generateOrderNo(prefix) {
  const date = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${date}${random}`;
}

export function success(data = null, message = 'success') {
  return { code: 0, message, data };
}

export function fail(message = 'error', code = 1) {
  return { code, message, data: null };
}
