import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { Terminals } from "@/components/screen-terminals";

export default function TerminalsPage() {
  const router = useRouter();
  const nav = useNav();
  const register = router.isReady && router.query.register === "1";
  const termSettingId = router.isReady && typeof router.query.term_setting_id === "string"
    ? router.query.term_setting_id
    : undefined;

  return (
    <Shell>
      <Terminals
        key={`${register ? "register" : "index"}-${termSettingId ?? "none"}`}
        nav={nav}
        initialRegister={register}
        initialTermSettingId={termSettingId}
      />
    </Shell>
  );
}
