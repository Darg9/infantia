import { PrismaClient } from '../../generated/prisma/client';
import { createLogger } from '../../lib/logger';
import { PrismaPg } from '@prisma/adapter-pg';

const log = createLogger('dedup:cluster');

export interface ActivityClusterNode {
  id: string;
  title: string;
  startDate: Date | null;
  locationId: string | null;
  providerId: string;
  sourceDomain: string | null;
  sourceConfidence: number;
  duplicatesCount: number;
}

export interface ActivityCluster {
  id: string; // cluster id (auto-generated)
  canonical: ActivityClusterNode;
  matches: ActivityClusterNode[];
}

/** Levenshtein Distance for String Similarity */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

export function titleSimilarity(str1: string, str2: string): number {
  const norm1 = str1.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, ' ').trim();
  const norm2 = str2.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, ' ').trim();
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0;
  
  const dist = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  return 1 - (dist / maxLen);
}

/** Hybrid Score Algorithm
 * score = 0.5 * titleSimilarity + 0.3 * sameLocation + 0.2 * sameTime 
 */
export function computeHybridScore(a: ActivityClusterNode, b: ActivityClusterNode): { score: number; rejected: boolean; reason?: string } {
  const tSim = titleSimilarity(a.title, b.title);
  if (tSim < 0.7 && !a.title.toLowerCase().includes(b.title.toLowerCase()) && !b.title.toLowerCase().includes(a.title.toLowerCase())) {
     return { score: 0, rejected: true, reason: 'title_mismatch_too_high' };
  }

  // Comparamos fechas
  let sameTime = 0;
  let dateDiffDays = null;
  if (a.startDate && b.startDate) {
      const diffMs = Math.abs(a.startDate.getTime() - b.startDate.getTime());
      dateDiffDays = diffMs / (1000 * 60 * 60 * 24);
      if (dateDiffDays > 1) {
          return { score: 0, rejected: true, reason: 'date_diff_too_large' };
      }
      // sameTime: 1 si es exacto, algo menos si difiere horas, pero para el formula pondremos 1 si <=1d
      sameTime = dateDiffDays === 0 ? 1 : 0.8;
  } else if (!a.startDate && !b.startDate) {
      sameTime = 0.5; // Neutral
  } else {
      return { score: 0, rejected: true, reason: 'one_date_missing' }; // Un evento tiene fecha, otro no -> Incomparable de forma segura
  }

  // Location id
  // Note: if cityId matches but locationId differs, we need to penalize. 
  // For safety in this engine, if both have different locationId, it's 0 location score.
  let sameLocation = 0;
  if (a.locationId && b.locationId) {
      if (a.locationId === b.locationId) {
          sameLocation = 1;
      } else {
          sameLocation = 0;
      }
  } else {
      sameLocation = 0.5; // neutral
  }

  const score = (0.5 * tSim) + (0.3 * sameLocation) + (0.2 * sameTime);

  // Recurrency Pattern Guard: 
  // If exactly 7 days difference (or multiple of 7) and time is matching -> Recurrent events. 
  // But wait, dateDiff > 1 already rejected them! So weekly recurrent events are safe :)

  return { score, rejected: false };
}

/** 
 * Agrupa los nodos comparándolos con el Hybrid Score
 * N=O(n^2) en el batch para los nodos provistos
 */
export function clusterizeNodes(nodes: ActivityClusterNode[]): ActivityCluster[] {
   const clusters: ActivityCluster[] = [];
   const visited = new Set<string>();

   for (let i = 0; i < nodes.length; i++) {
       const node = nodes[i];
       if (visited.has(node.id)) continue;

       const cluster: ActivityCluster = {
           id: `cluster-${node.id}`,
           canonical: node, // Temporarily selected node, resolved properly in merger
           matches: []
       };

       visited.add(node.id);

       for (let j = i + 1; j < nodes.length; j++) {
           const candidate = nodes[j];
           if (visited.has(candidate.id)) continue;

           const { score, rejected } = computeHybridScore(node, candidate);
           
           if (!rejected && score >= 0.7) {
               cluster.matches.push(candidate);
               visited.add(candidate.id);
           }
       }

       if (cluster.matches.length > 0) {
           clusters.push(cluster);
       }
   }

   return clusters;
}
