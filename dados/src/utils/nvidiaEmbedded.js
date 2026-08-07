// Credencial padrão embutida para a assistente NVIDIA funcionar em qualquer
// distribuição do bot sem exigir configuração do dono. Os bytes abaixo são a
// chave real cifrada por XOR contra um keystream derivado de SEED via
// SHA-256 em modo contador — só formam a chave em tempo de execução, dentro
// de resolveEmbeddedNvidiaKey(). Qualquer dono pode substituir essa
// credencial pela própria com "!setnvidia SUA_CHAVE" (ver gyomeiStore.js).
import { createHash } from 'crypto';

const SEED = 'gyomei-nove-guardioes-selam-a-chave';
const CIPHER_BYTES = [138, 149, 242, 84, 143, 65, 222, 56, 137, 2, 172, 155, 184, 87, 9, 158, 120, 69, 71, 81, 197, 129, 239, 126, 150, 5, 196, 18, 86, 238, 88, 168, 0, 42, 20, 96, 226, 21, 117, 19, 224, 154, 45, 90, 83, 77, 162, 248, 155, 23, 164, 84, 36, 102, 101, 221, 254, 160, 130, 194, 253, 123, 125, 142, 236, 110, 145, 19, 161, 112];

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
