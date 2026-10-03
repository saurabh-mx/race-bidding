'use server';

export async function verifySecurityCode(code: string) {
  const correctCode = process.env.SECURITY_CODE || '69389';
  return code === correctCode;
}
