import { ReportStatus as S } from '@prisma/client';
import { canReview } from './report-status';

describe('canReview', () => {
  it.each([
    [S.SUBMITTED, S.APPROVED, true],
    [S.IN_REVIEW, S.NEEDS_REVISION, true],
    [S.IN_REVIEW, S.REJECTED, true],
    [S.DRAFT, S.APPROVED, false],
    [S.APPROVED, S.REJECTED, false],
    [S.REJECTED, S.APPROVED, false],
    [S.NEEDS_REVISION, S.APPROVED, false],
  ])('%s → %s = %s', (from, to, ok) => {
    expect(canReview(from, to)).toBe(ok);
  });
});
