import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { requestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** IP & user-agent diambil dari permintaan HTTP yang sedang berjalan bila tidak diberikan. */
  log(e: AuditEntry, tx: Prisma.TransactionClient = this.prisma) {
    const ctx = requestContext();
    return tx.auditLog.create({ data: { ...e, ip: e.ip ?? ctx?.ip, userAgent: e.userAgent ?? ctx?.userAgent } });
  }
}
