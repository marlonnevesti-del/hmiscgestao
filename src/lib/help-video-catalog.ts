import type { HelpVideo } from "./help-video";
import chapterData from "@/assets/tutoriais/help-video-chapters.json";
import recepcaoAsset from "@/assets/tutoriais/recepcao.mp4.asset.json";
import triagemAsset from "@/assets/tutoriais/triagem.mp4.asset.json";
import pepMedicoAsset from "@/assets/tutoriais/pep-medico.mp4.asset.json";
import enfermagemAsset from "@/assets/tutoriais/enfermagem.mp4.asset.json";
import utiUciAsset from "@/assets/tutoriais/uti-uci.mp4.asset.json";
import nirAsset from "@/assets/tutoriais/nir.mp4.asset.json";
import farmaciaAsset from "@/assets/tutoriais/farmacia.mp4.asset.json";
import almoxarifadoAsset from "@/assets/tutoriais/almoxarifado.mp4.asset.json";
import centroCirurgicoAsset from "@/assets/tutoriais/centro-cirurgico-cme.mp4.asset.json";
import apoioSadtAsset from "@/assets/tutoriais/apoio-sadt.mp4.asset.json";
import faturamentoAsset from "@/assets/tutoriais/faturamento.mp4.asset.json";
import administracaoAsset from "@/assets/tutoriais/administracao.mp4.asset.json";

type Chapter = { title: string; seconds: number };
type ChapterCatalog = Record<string, { duration: number; chapters: Chapter[] }>;

const chapters = chapterData as ChapterCatalog;

function tutorial(id: string, title: string, asset: { url: string }): HelpVideo {
  const metadata = chapters[id];
  return {
    url: asset.url,
    title: `Tutorial narrado · ${title}`,
    ...(metadata ? { durationSeconds: Math.round(metadata.duration), chapters: metadata.chapters } : {}),
  };
}

/** Real narrated videos; the written tutorial remains independent and printable. */
export const HELP_VIDEOS: Record<string, HelpVideo> = {
  recepcao: tutorial("recepcao", "Recepção", recepcaoAsset),
  triagem: tutorial("triagem", "Acolhimento e Classificação de Risco", triagemAsset),
  "pep-medico": tutorial("pep-medico", "Atendimento Médico e PEP", pepMedicoAsset),
  enfermagem: tutorial("enfermagem", "Posto de Enfermagem", enfermagemAsset),
  "uti-uci": tutorial("uti-uci", "UTI Pediátrica, UCI e UTI Neonatal", utiUciAsset),
  nir: tutorial("nir", "NIR e Censo de Internações", nirAsset),
  farmacia: tutorial("farmacia", "Farmácia Hospitalar", farmaciaAsset),
  almoxarifado: tutorial("almoxarifado", "Almoxarifado Geral", almoxarifadoAsset),
  "centro-cirurgico-cme": tutorial("centro-cirurgico-cme", "Centro Cirúrgico, SRPA e CME", centroCirurgicoAsset),
  "apoio-sadt": tutorial("apoio-sadt", "SADT e Serviços de Apoio", apoioSadtAsset),
  faturamento: tutorial("faturamento", "Faturamento SUS, TISS e Custos", faturamentoAsset),
  administracao: tutorial("administracao", "Administração, Colaboradores e Backups", administracaoAsset),
};
