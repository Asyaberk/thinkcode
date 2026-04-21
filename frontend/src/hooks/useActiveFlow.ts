/**
 * hooks/useActiveFlow.ts — Bir sınıfın aktif pedagojik flow'unu çeker.
 *
 * Flow Designer'da "Deploy to Students" basıldıktan sonra
 * öğrenci sayfaları bu hook ile o class'a ait aktif pattern + config'i alır.
 *
 * DÖNDÜRÜR:
 *   pattern          → 'mastery_gate' | 'socratic_retry' | 'spaced_retrieval' | 'adaptive_branch' | 'default'
 *   config           → { consecutive_correct?, max_hints?, review_days?, threshold_score? }
 *   hasActiveFlow    → false ise varsayılan davranış (kısıtsız ilerle)
 *   isLoading        → fetch devam ediyor
 */

import { useState, useEffect } from 'react';
import { getActiveFlow } from '../api/flows';
import type { FlowConfig } from '../api/flows';

export interface ActiveFlow {
  pattern: string;
  config: FlowConfig;
  hasActiveFlow: boolean;
}

export function useActiveFlow(classId: string | null): {
  flow: ActiveFlow;
  isLoading: boolean;
} {
  const [flow, setFlow] = useState<ActiveFlow>({
    pattern: 'default',
    config: {},
    hasActiveFlow: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!classId) return;

    const fetchFlow = () => {
      getActiveFlow(classId)
        .then(data => {
          setFlow({
            pattern: data.pattern ?? 'default',
            config: data.config ?? {},
            hasActiveFlow: data.has_active_flow ?? false,
          });
        })
        .catch(() => {
          setFlow({ pattern: 'default', config: {}, hasActiveFlow: false });
        })
        .finally(() => setIsLoading(false));
    };

    setIsLoading(true);
    fetchFlow();

    // 30 saniyede bir polling — instructor deploy edince öğrenci sayfası güncellenir
    const interval = setInterval(fetchFlow, 30_000);
    return () => clearInterval(interval);
  }, [classId]);

  return { flow, isLoading };
}
