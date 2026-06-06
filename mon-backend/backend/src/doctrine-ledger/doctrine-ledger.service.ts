import { Injectable, NotFoundException } from '@nestjs/common';
import {
  listLedgerLessons,
  readDoctrineLedger,
  type DoctrineLedgerEntry,
  type JarvisDoctrineLedger,
} from '../agents/orchestrateur/living-intelligence/living-doctrine-ledger';
import {
  listPendingDoctrineLessons,
  rejectDoctrineLesson,
  signDoctrineLesson,
} from '../agents/orchestrateur/living-intelligence/living-doctrine-stylo';

@Injectable()
export class DoctrineLedgerService {
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
    const signed = signDoctrineLesson(id, signedBy);
    if (!signed) throw new NotFoundException(`Leçon doctrine introuvable : ${id}`);
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
    const ok = rejectDoctrineLesson(id);
    if (!ok) throw new NotFoundException(`Leçon doctrine introuvable : ${id}`);
    return { ok: true, id };
  }
}
