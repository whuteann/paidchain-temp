import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { TerminalDetail } from "@/components/screen-terminals";
import { api, ApiError } from "@/lib/api";
import type { SimCardOut } from "@/lib/api";

export default function TerminalDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  const [simState, setSimState] = useState<{ terminalId: string | null; sim: SimCardOut | null; loaded: boolean }>({
    terminalId: null,
    sim: null,
    loaded: false,
  });

  useEffect(() => {
    if (typeof id !== "string") return;

    let cancelled = false;

    api.terminals.simCard(id)
      .then((sim) => {
        if (!cancelled) setSimState({ terminalId: id, sim, loaded: true });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setSimState({ terminalId: id, sim: null, loaded: true });
          return;
        }
        console.error(e);
        setSimState({ terminalId: id, sim: null, loaded: true });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) return null;

  const terminalId = id as string;
  const linkedSim = simState.terminalId === terminalId ? simState.sim : null;
  const simLoaded = simState.terminalId === terminalId && simState.loaded;

  return <Shell><TerminalDetail key={terminalId} id={terminalId} nav={nav} initialLinkedSim={linkedSim} simLoaded={simLoaded} /></Shell>;
}
