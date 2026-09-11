"use client"

import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@chatbotx.io/ui/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@chatbotx.io/ui/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@chatbotx.io/ui/components/ui/tooltip"
import { useDebouncedCallback } from "@chatbotx.io/ui/hooks/use-debounced-callback"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, HelpCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useWorkspaceId } from "@/hooks/routing"
import { orpc } from "@/lib/orpc/query"

const SEARCH_DEBOUNCE_MS = 300
const TEST_CONTACT_PAGE_SIZE = 20

type TestContactOption = {
  id: string
  label: string
}

type TestContactPickerProps = {
  value?: string
  onChange: (contactId: string | undefined) => void
}

const contactLabel = (contact: {
  id: string
  fullName?: string | null
  firstName?: string | null
  lastName?: string | null
  phoneNumber?: string | null
}): string => {
  const name =
    contact.fullName?.trim() ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim()
  if (name) {
    return name
  }
  if (contact.phoneNumber) {
    return contact.phoneNumber
  }
  return contact.id
}

export const TestContactPicker = ({
  value,
  onChange,
}: TestContactPickerProps) => {
  const t = useTranslations()
  const workspaceId = useWorkspaceId()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [debouncedKeyword, setDebouncedKeyword] = useState("")
  const [selected, setSelected] = useState<TestContactOption | undefined>()
  const applyDebouncedKeyword = useDebouncedCallback(
    setDebouncedKeyword,
    SEARCH_DEBOUNCE_MS,
  )

  const handleKeywordChange = (next: string) => {
    setKeyword(next)
    applyDebouncedKeyword(next)
  }

  const search = useQuery(
    orpc.contactsAPIs.listContactsByPOSTAuthenticatedAPI.queryOptions({
      input: {
        workspaceId,
        page: 1,
        perPage: TEST_CONTACT_PAGE_SIZE,
        keyword: debouncedKeyword.trim() || undefined,
      },
      enabled: open && Boolean(workspaceId),
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    }),
  )

  const options = useMemo<TestContactOption[]>(
    () =>
      (search.data?.data ?? []).map((contact) => ({
        id: contact.id,
        label: contactLabel(contact),
      })),
    [search.data?.data],
  )

  const selectedOption =
    selected && value && selected.id === value
      ? selected
      : value
        ? options.find((option) => option.id === value)
        : undefined

  const triggerLabel =
    selectedOption?.label ??
    (value
      ? t("errorLogs.unknownContact")
      : t("fields.testContact.placeholder"))

  const handleSelect = (option: TestContactOption) => {
    setSelected(option)
    onChange(option.id)
    setOpen(false)
  }

  const handleClear = () => {
    setSelected(undefined)
    onChange(undefined)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-sm">
          {t("fields.testContact.label")}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-label={t("fields.testContact.description")}
                className="text-muted-foreground"
                type="button"
              >
                <HelpCircle className="size-3.5" />
              </button>
            }
          />
          <TooltipContent className="max-w-xs">
            {t("fields.testContact.description")}
          </TooltipContent>
        </Tooltip>
      </div>

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <Button
              className="w-full justify-between font-normal"
              type="button"
              variant="outline"
            >
              <span className="truncate text-start">{triggerLabel}</span>
              <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={handleKeywordChange}
              placeholder={t("fields.testContact.placeholder")}
              value={keyword}
            />
            <CommandList>
              <CommandEmpty>{t("fields.testContact.empty")}</CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem onSelect={handleClear} value="__clear__">
                    {t("fields.testContact.clear")}
                  </CommandItem>
                )}
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    onSelect={() => handleSelect(option)}
                    value={option.id}
                  >
                    {option.label}
                    <Check
                      className={
                        option.id === value
                          ? "ms-auto size-4 opacity-100"
                          : "ms-auto size-4 opacity-0"
                      }
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
