"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chatbotx.io/ui/components/ui/table"
import { format } from "date-fns"
import { useTranslations } from "next-intl"
import { useAnalysisStore } from "../../provider/analysis-store-context"

export function ReflinkStatsTable() {
  const t = useTranslations("analytics")
  const refLinkStats = useAnalysisStore((state) => state.refLinkStats)

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {refLinkStats.length > 0 ? (
            refLinkStats.map((row) => (
              <TableRow key={row.dateReport}>
                <TableCell>
                  {format(new Date(row.dateReport), "MMM d, yyyy")}
                </TableCell>
                <TableCell>{row.count}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={2}>
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
