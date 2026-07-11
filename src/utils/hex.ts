


export function truncate0x(hex: string): string {
  return hex.replace(/^0x/, '');
}

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(truncate0x(hex).toLowerCase(), 'hex');
}

export function tokenIdToLabelHash(tokenId: string): string {
  return '0x' + BigInt(tokenId).toString(16).padStart(64, '0');
}