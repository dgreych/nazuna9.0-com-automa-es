// Credencial padrão embutida para a assistente NVIDIA funcionar em qualquer
// distribuição do bot sem exigir configuração do dono. Os bytes abaixo são a
// chave real cifrada por XOR contra um keystream derivado de SEED via
// SHA-256 em modo contador — só formam a chave em tempo de execução, dentro
// de resolveEmbeddedNvidiaKey(). Qualquer dono pode substituir essa
// credencial pela própria com "!setnvidia SUA_CHAVE" (ver gyomeiStore.js).
import { createHash } from 'crypto';

const SEED = 'gyomei-nove-guardioes-selam-a-chave';
const CIPHER_BYTES = [138, 149, 242, 84, 143, 65, 236, 62, 130, 121, 184, 139, 136, 11, 59, 189, 126, 121, 22, 86, 206, 136, 227, 127, 234, 121, 203, 1, 81, 182, 41, 162, 61, 42, 124, 121, 244, 17, 62, 59, 206, 146, 49, 21, 4, 22, 226, 251, 238, 16, 220, 111, 45, 52, 6, 185, 212, 249, 132, 178, 248, 73, 21, 168, 206, 105, 181, 37, 240, 95];

function keystream(seed, length) {
  const out = Buffer.alloc(length);
  let offset = 0;
  let counter = 0;
  while (offset < length) {
    const block = createHash('sha256').update(seed + ':' + counter).digest();
    block.copy(out, offset, 0, Math.min(block.length, length - offset));
    offset += block.length;
    counter += 1;
  }
  return out;
}

export function resolveEmbeddedNvidiaKey() {
  const stream = keystream(SEED, CIPHER_BYTES.length);
  const bytes = Buffer.from(CIPHER_BYTES.map((byte, i) => byte ^ stream[i]));
  return bytes.toString('utf8');
}
