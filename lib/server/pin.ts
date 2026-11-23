// PIN 해시·검증·생성. 원문 PIN은 어디에도 저장하거나 로그로 남기지 않습니다.
import { scryptSync, randomBytes, timingSafeEqual, randomInt } from 'crypto'

const SCRYPT = { N: 16384, r: 8, p: 1 }
const KEY_LEN = 32

export const PIN_LENGTH = 6
export const PIN_RE = /^\d{6}$/

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, KEY_LEN, SCRYPT)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split('$')
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT)
  return timingSafeEqual(actual, expected)
}

/** 운영체제 난수(crypto.randomInt)로 만든 6자리 임시 PIN. 쉬운 번호는 다시 뽑습니다. */
export function generateTempPin(): string {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(PIN_LENGTH, '0')
    if (!weakPinReason(pin)) return pin
  }
}

/** 너무 쉬운 PIN이면 이유를, 괜찮으면 null을 돌려줍니다. */
export function weakPinReason(pin: string, employeeNumber?: string): string | null {
  if (!PIN_RE.test(pin)) return 'PIN은 숫자 6자리로 정해주세요.'
  if (/^(\d)\1{5}$/.test(pin)) return '같은 숫자만 반복한 PIN은 쓸 수 없어요.'
  const digits = pin.split('').map(Number)
  const step = digits[1] - digits[0]
  if ((step === 1 || step === -1) && digits.every((d, i) => i === 0 || d - digits[i - 1] === step)) {
    return '123456처럼 연속된 숫자는 쓸 수 없어요.'
  }
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return '반복되는 숫자 묶음은 쓸 수 없어요.'
  if (employeeNumber && employeeNumber.replace(/\D/g, '').length >= 4 && pin.includes(employeeNumber.replace(/\D/g, ''))) {
    return '사번이 들어간 PIN은 쓸 수 없어요.'
  }
  return null
}
