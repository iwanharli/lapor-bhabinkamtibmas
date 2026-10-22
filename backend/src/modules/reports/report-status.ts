import { ReportStatus } from '@prisma/client';

/** Transisi yang boleh dilakukan verifikator (docs/teknis/03-modul-laporan.md §6). */
export const REVIEW_TRANSITIONS: Partial<Record<ReportStatus, ReportStatus[]>> = {
  SUBMITTED: [ReportStatus.IN_REVIEW, ReportStatus.APPROVED, ReportStatus.NEEDS_REVISION, ReportStatus.REJECTED],
  IN_REVIEW: [ReportStatus.APPROVED, ReportStatus.NEEDS_REVISION, ReportStatus.REJECTED],
};

export const NOTE_REQUIRED: ReportStatus[] = [ReportStatus.NEEDS_REVISION, ReportStatus.REJECTED];

export function canReview(from: ReportStatus, to: ReportStatus) {
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}
