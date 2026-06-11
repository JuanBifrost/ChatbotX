"use client"

import AreaChart from "@chatbotx.io/ui/components/charts/area-chart"
import { format } from "date-fns"
import { useTranslations } from "next-intl"
import { useAnalysisStore } from "../../provider/analysis-store-context"

export function ReflinkStatsChart() {
  const t = useTranslations()

  const refLinkStats = useAnalysisStore((state) => state.refLinkStats)
  const linkName = useAnalysisStore(
    (state) => state.defaultSearchParams.linkName ?? "",
  )

  return (
    <AreaChart
      data={refLinkStats.map((row) => ({
        label: format(new Date(row.dateReport), "MMM d"),
        value: row.count,
      }))}
      title={t("analytics.sessionsThroughTheRef", { ref: linkName })}
      valueLabel={t("analytics.total")}
    />
  )
}
