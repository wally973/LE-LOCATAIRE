import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecordAiDiagnosticDto } from './dto/record-ai-diagnostic.dto';

const EMAIL_LIKE =
  /\b[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,64}\.[a-zA-Z]{2,63}\b/g;

@Injectable()
export class AiDiagnosticsService {
  constructor(private prisma: PrismaService) {}

  userHash(userId: number): string {
    const salt =
      process.env.AI_DIAGNOSTIC_SALT ??
      process.env.SHAI_SECRET ??
      'le-locataire-ai-salt-change-in-prod';
    return createHash('sha256').update(`${userId}:${salt}`).digest('hex');
  }

  sanitizeSummary(text: string): string {
    return text
      .replace(EMAIL_LIKE, '[email]')
      .replace(/\b(?:0[1-9])(?:[\s.-]?\d{2}){4}\b/g, '[tel]')
      .replace(/\b\d{13,17}\b/g, '[digits]')
      .slice(0, 3900);
  }

  async record(userId: number, dto: RecordAiDiagnosticDto) {
    const summary = this.sanitizeSummary(dto.diagnosticSummary);
    return this.prisma.aiDiagnostic.create({
      data: {
        userHash: this.userHash(userId),
        locale: dto.locale,
        category: dto.category,
        severity: dto.severity,
        target: dto.target,
        refused: dto.refused,
        refusalReason: dto.refusalReason?.slice(0, 512) ?? null,
        diagnosticSummary: summary,
        pipelineSteps:
          dto.pipelineSteps != null
            ? (dto.pipelineSteps as Prisma.InputJsonValue)
            : undefined,
        avatarVariant: dto.avatarVariant ?? null,
        artisanType: dto.artisanType ?? null,
        bailleurFlag: dto.bailleurFlag,
        adminFlag: dto.adminFlag,
      },
    });
  }

  async deleteByUserId(userId: number) {
    const h = this.userHash(userId);
    const r = await this.prisma.aiDiagnostic.deleteMany({
      where: { userHash: h },
    });
    return { deleted: r.count };
  }

  /** Retention RGPD recommandée : 30 jours (cron / appel admin). */
  async purgeOlderThanDays(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const r = await this.prisma.aiDiagnostic.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deleted: r.count };
  }

  async purgeAll() {
    const r = await this.prisma.aiDiagnostic.deleteMany({});
    return { deleted: r.count };
  }

  async getStatsForDashboard() {
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const rows = await this.prisma.aiDiagnostic.findMany({
      where: { createdAt: { gte: since30 } },
      select: {
        refused: true,
        locale: true,
        category: true,
        target: true,
        artisanType: true,
        bailleurFlag: true,
        adminFlag: true,
        createdAt: true,
      },
    });

    const totals = {
      all: rows.length,
      refused: rows.filter((r) => r.refused).length,
      accepted: rows.filter((r) => !r.refused).length,
      artisanOriented: rows.filter(
        (r) =>
          !r.refused &&
          (r.artisanType != null ||
            ['PRESTATAIRE'].includes(r.target ?? '') ||
            ['PLUMBING', 'ELECTRICITY', 'HUMIDITY', 'LOCKSMITH'].includes(
              r.category ?? '',
            )),
      ).length,
      bailleurOriented: rows.filter(
        (r) => !r.refused && (r.bailleurFlag || r.target === 'BAILLEUR'),
      ).length,
      adminOriented: rows.filter(
        (r) => !r.refused && (r.adminFlag || r.target === 'ADMIN'),
      ).length,
    };

    const byLocale: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byHour: number[] = Array.from({ length: 24 }, () => 0);
    const byDayOfWeek: number[] = Array.from({ length: 7 }, () => 0);
    const byMonthDay: Record<string, number> = {};

    for (const r of rows) {
      byLocale[r.locale] = (byLocale[r.locale] ?? 0) + 1;
      const cat = r.category || 'UNKNOWN';
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      const h = r.createdAt.getUTCHours();
      byHour[h] += 1;
      byDayOfWeek[r.createdAt.getUTCDay()] += 1;
      const dk = `${r.createdAt.getUTCFullYear()}-${String(
        r.createdAt.getUTCMonth() + 1,
      ).padStart(2, '0')}-${String(r.createdAt.getUTCDate()).padStart(2, '0')}`;
      byMonthDay[dk] = (byMonthDay[dk] ?? 0) + 1;
    }

    const sortedDates = Object.keys(byMonthDay).sort();

    return {
      windowDays: 30,
      totals,
      byLocale,
      byCategory,
      charts: {
        byHourUtc: byHour.map((count, hour) => ({ hour, count })),
        byDayOfWeekUtc: byDayOfWeek.map((count, day) => ({ day, count })),
        byDate: sortedDates.map((date) => ({ date, count: byMonthDay[date]! })),
      },
    };
  }
}
