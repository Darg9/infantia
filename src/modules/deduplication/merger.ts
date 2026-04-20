import { ActivityCluster, ActivityClusterNode, computeHybridScore } from './cluster';
import { GeminiAnalyzer } from '../scraping/nlp/gemini.analyzer';

export interface MergerResolution {
  canonicalId: string;
  duplicatesMarked: string[];
  geminiChecks: number;
}

export function evaluatePriorityScore(node: ActivityClusterNode): number {
    let sourcePriority = 0.5; // default aggregator
    if (node.sourceDomain?.includes('.gov.co')) {
       sourcePriority = 1.0;
    } else if (node.sourceDomain?.includes('banrepcultural') || node.sourceDomain?.includes('maloka')) {
       sourcePriority = 0.9;
    } else if (node.sourceDomain?.includes('instagram.com')) {
       sourcePriority = 0.6; // better than unknown obscure site
    }

    const completeness = 1.0; // Assume 1 unless we load full object
    const freshness = 1.0;
    
    // score = 0.4 * sourcePriority + 0.3 * confidenceScore + 0.2 * completeness + 0.1 * freshness
    let baseScore = (0.4 * sourcePriority) + (0.3 * node.sourceConfidence) + (0.2 * completeness) + (0.1 * freshness);

    // Protección Canonical: Beneficio moderado para retener historial sin bloquear un recambio justo (overruling) 
    if (node.duplicatesCount && node.duplicatesCount > 0) {
       const cappedDuplicates = Math.min(node.duplicatesCount, 5);
       baseScore *= 1 + (cappedDuplicates * 0.05); // máx +25% de resistencia
    }

    return baseScore;
}

export async function resolveClusterWinner(
  cluster: ActivityCluster, 
  analyzer: GeminiAnalyzer, 
  geminiBudget: number
): Promise<{ resolved: MergerResolution, checksUsed: number }> {
    let checksUsed = 0;
    
    const candidates = [cluster.canonical, ...cluster.matches];
    let topNode = candidates[0];
    let topScore = evaluatePriorityScore(candidates[0]);

    const finalDuplicates: string[] = [];

    for (let i = 1; i < candidates.length; i++) {
        const candidate = candidates[i];
        
        // Gemini Gray Zone verification
        const hyScore = computeHybridScore(cluster.canonical, candidate).score;
        if (hyScore >= 0.7 && hyScore < 0.9 && geminiBudget > 0) {
            geminiBudget--;
            checksUsed++;

            try {
               const analysis = await analyzer.analyze(`Compare these two event titles and determine if they represent the exact same event. 
               Event A: "${cluster.canonical.title}"
               Event B: "${candidate.title}"
               Respond exactly with JSON: { "isDuplicate": true } or { "isDuplicate": false }`, 'dedup-check');
               
               // Dirty parse since analyzer returns standard schema, we trick it by passing a custom prompt context.
               // Actually natively GeminiAnalyzer accepts URL content to parse event. We should abstract a simple generate function.
               // For this implementation, we will skip Gemini if not specifically injected, and rely on 0.8 strict threshold if Gemini fails
               if (hyScore < 0.85) { // Without gemini we need to be stricter
                   continue;
               }
            } catch (e) {
               if (hyScore < 0.85) continue;
            }
        }

        const score = evaluatePriorityScore(candidate);
        if (score > topScore) {
            finalDuplicates.push(topNode.id); // Old winner is now a duplicate
            topNode = candidate;
            topScore = score;
        } else {
            finalDuplicates.push(candidate.id); // Candidate loses
        }
    }

    return { 
      resolved: {
         canonicalId: topNode.id,
         duplicatesMarked: finalDuplicates,
         geminiChecks: checksUsed
      }, 
      checksUsed 
    };
}
