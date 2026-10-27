import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SensitiveDataService } from '../../common/crypto/sensitive-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { cosine, DetectedFace, detectFaces, embed } from './face-engine';

/** Wajah menghadap depan bila |yaw| ≤ ini; foto "menoleh" harus bergeser minimal TURN_MIN dari foto depan. */
const FRONTAL_MAX = 0.35;
const TURN_MIN = 0.35;
/** Wajah terlalu kecil (jauh dari kamera) tidak andal dicocokkan. */
const MIN_FACE_PX = 80;
/** Foto depan & menoleh harus orang yang sama (ambang lebih longgar karena sudut berbeda). */
const SAME_PERSON_POSE = 0.3;

export interface FacePair { frontal: Buffer; turned: Buffer }

/**
 * Verifikasi wajah sebagai faktor kedua login. Uji kehidupan: dua foto (depan + menoleh ke samping) — foto cetak/layar
 * diam tidak bisa menoleh; arah toleh boleh kiri/kanan (kamera depan sebagian HP/webcam mencerminkan gambar).
 * Sidik wajah (bukan foto) disimpan terenkripsi; foto tidak disimpan.
 */
@Injectable()
export class FaceService {
  private readonly threshold: number;

  constructor(private prisma: PrismaService, private crypto: SensitiveDataService, private audit: AuditService, config: ConfigService) {
    this.threshold = Number(config.get('FACE_MATCH_THRESHOLD', 0.38));
  }

  private fail(code: string, message: string): never {
    throw new BadRequestException({ code, message });
  }

  private async single(image: Buffer, label: string) {
    const d = await detectFaces(image).catch(() => this.fail('FACE_BAD_IMAGE', `Foto ${label} tidak dapat dibaca.`));
    if (!d.faces.length) this.fail('FACE_NOT_FOUND', `Wajah tidak terdeteksi di foto ${label}. Pastikan wajah terlihat jelas dan cukup terang.`);
    if (d.faces.length > 1) this.fail('FACE_MULTIPLE', `Terdeteksi lebih dari satu wajah di foto ${label}. Pastikan hanya Anda yang terlihat.`);
    const face: DetectedFace = d.faces[0];
    if (Math.min(face.box[2], face.box[3]) < MIN_FACE_PX) this.fail('FACE_TOO_SMALL', `Wajah di foto ${label} terlalu kecil. Dekatkan kamera ke wajah.`);
    return { face, embedding: await embed(d.rgb, d.width, d.height, face) };
  }

  /** Periksa pasangan foto (depan + menoleh) dan kembalikan sidik wajah foto depan. */
  private async live(pair: FacePair) {
    const front = await this.single(pair.frontal, 'depan');
    if (Math.abs(front.face.yaw) > FRONTAL_MAX) this.fail('FACE_NOT_FRONTAL', 'Foto pertama harus menghadap lurus ke kamera.');
    const turn = await this.single(pair.turned, 'menoleh');
    if (Math.abs(turn.face.yaw - front.face.yaw) < TURN_MIN) this.fail('FACE_NOT_TURNED', 'Pada foto kedua, tolehkan kepala sedikit ke kiri atau kanan.');
    if (cosine(front.embedding, turn.embedding) < SAME_PERSON_POSE) this.fail('FACE_NOT_SAME', 'Kedua foto harus wajah orang yang sama.');
    return front.embedding;
  }

  async enroll(userId: string, pair: FacePair) {
    const embedding = await this.live(pair);
    await this.prisma.user.update({
      where: { id: userId },
      data: { faceEmbedding: Buffer.from(this.crypto.encrypt({ v: 1, model: 'sface-2021dec', e: Array.from(embedding) })), faceEnrolledAt: new Date() },
    });
    await this.audit.log({ actorId: userId, action: 'FACE_ENROLL', entity: 'user', entityId: userId });
    return { enrolled: true };
  }

  /** Cocokkan dengan wajah terdaftar; melempar 401 FACE_MISMATCH bila tidak cocok. Mengembalikan skor kemiripan. */
  async verify(userId: string, pair: FacePair) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { faceEmbedding: true } });
    if (!user.faceEmbedding) this.fail('FACE_NOT_ENROLLED', 'Wajah belum didaftarkan.');
    const embedding = await this.live(pair);
    const enrolled = Float32Array.from(this.crypto.decrypt(Buffer.from(user.faceEmbedding)).e as number[]);
    const score = cosine(enrolled, embedding);
    if (score < this.threshold) {
      throw new UnauthorizedException({ code: 'FACE_MISMATCH', message: 'Wajah tidak cocok dengan yang terdaftar. Coba lagi dengan cahaya yang cukup.', score: Math.round(score * 1000) / 1000 });
    }
    return Math.round(score * 1000) / 1000;
  }

  async reset(actorId: string, userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { faceEmbedding: null, faceEnrolledAt: null } });
    await this.audit.log({ actorId, action: 'FACE_RESET', entity: 'user', entityId: userId });
  }
}
