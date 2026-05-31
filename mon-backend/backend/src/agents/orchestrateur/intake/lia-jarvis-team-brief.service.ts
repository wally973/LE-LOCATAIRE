import { Injectable } from '@nestjs/common';
import { LegalReferencesService } from '../../../legal-references/legal-references.service';
import {
  buildArchivistBrief,
  buildDiagnosticianBrief,
  mergeJarvisTeamBrief,
  type JarvisTeamBrief,
} from './lia-jarvis-team-brief';

@Injectable()
export class LiaJarvisTeamBriefService {
  constructor(private readonly legalReferences: LegalReferencesService) {}

  /**
   * Consulte Archiviste (legal-references + lia-juridique-savoir, même pipeline qu’AiLegalService)
   * et Diagnostiqueur (master-diagnostic-rules) avant Groq.
   */
  async build(params: {
    title: string;
    description: string;
    message: string;
  }): Promise<JarvisTeamBrief> {
    const archivist = await buildArchivistBrief(this.legalReferences, params);
    const diagnostician = buildDiagnosticianBrief(params);
    return mergeJarvisTeamBrief({ ...params, archivist, diagnostician });
  }
}
