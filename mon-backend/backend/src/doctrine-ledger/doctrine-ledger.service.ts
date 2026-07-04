import { Injectable, NotFoundException } from '@nestjs/common';
import {
  listLedgerLessons,
  readDoctrineLedger,
  type DoctrineLedgerEntry,
  type JarvisDoctrineLedger,
} from '../agents/orchestrateur/living-intelligence/living-doctrine-ledger';
import { LivingCyberGardienService } from '../agents/orchestrateur/living-intelligence/living-cyber-gardien.service';
import { listPendingDoctrineLessons } from '../agents/orchestrateur/living-intelligence/living-doctrine-stylo';

@Injectable()
export class DoctrineLedgerService {
  constructor(private readonly cyberGardien: LivingCyberGardienService) {}
  getLedger(): JarvisDoctrineLedger {
    return readDoctrineLedger();
  }

  listAll(status?: 'PENDING_ADMIN_SIGNATURE' | 'SIGNED'): DoctrineLedgerEntry[] {
    return listLedgerLessons({ status, limit: 200 });
  }

  listPending(): DoctrineLedgerEntry[] {
    return listPendingDoctrineLessons(200).map((l) => ({
      id: l.id,
      title: l.title,
      body: l.body,
      author: l.author,
      createdAt: l.createdAt,
      status: l.status,
      signedAt: l.signedAt ?? null,
      signedBy: l.signedBy ?? null,
      sessionRef: l.sessionRef,
      filePath: l.filePath,
    }));
  }

  signLesson(id: string, signedBy: string): DoctrineLedgerEntry {
    const signed = this.cyberGardien.signDoctrineAsAdmin(id, signedBy);
    return {
      id: signed.id,
      title: signed.title,
      body: signed.body,
      author: signed.author,
      createdAt: signed.createdAt,
      status: signed.status,
      signedAt: signed.signedAt ?? null,
      signedBy: signed.signedBy ?? null,
      sessionRef: signed.sessionRef,
      filePath: signed.filePath,
    };
  }

  rejectLesson(id: string): { ok: true; id: string } {
    const ok = this.cyberGardien.rejectDoctrineAsAdmin(id);
    if (!ok) throw new NotFoundException(`Leçon doctrine introuvable : ${id}`);
    return { ok: true, id };
  }
}
