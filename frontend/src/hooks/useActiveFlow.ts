/**

 *

 *

 *   pattern          → 'mastery_gate' | 'socratic_retry' | 'spaced_retrieval' | 'adaptive_branch' | 'default'

 *   config           → { consecutive_correct?, max_hints?, review_days?, threshold_score? }

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

    const interval = setInterval(fetchFlow, 30_000);

    return () => clearInterval(interval);

  }, [classId]);

  return { flow, isLoading };

}

