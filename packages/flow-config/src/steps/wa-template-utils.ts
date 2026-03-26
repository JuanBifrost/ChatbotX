import type { TemplateComponent } from "./send-wa-message-template"

export type ParameterInfo = {
  type: "header" | "body" | "button"
  index: number
  paramName: string
  format?: string
  buttonIndex?: number
}

export function extractParameterInfos(
  components: TemplateComponent[],
): ParameterInfo[] {
  const params: ParameterInfo[] = []

  if (!components || components.length === 0) {
    return params
  }

  for (const component of components) {
    if (component.type === "HEADER") {
      if (component.format === "TEXT" && component.text) {
        const matches = component.text.match(/\{\{(\d+|[a-zA-Z_]+)\}\}/g)
        if (matches) {
          for (const [idx, match] of matches.entries()) {
            const paramName = match.replace(/\{\{|\}\}/g, "")
            params.push({
              type: "header",
              index: idx,
              paramName,
              format: "text",
            })
          }
        }
      } else if (
        ["IMAGE", "VIDEO", "DOCUMENT"].includes(component.format || "")
      ) {
        params.push({
          type: "header",
          index: 0,
          paramName: "1",
          format: component.format?.toLowerCase(),
        })
      }
    } else if (component.type === "BODY" && component.text) {
      const matches = component.text.match(/\{\{(\d+|[a-zA-Z_]+)\}\}/g)
      if (matches) {
        for (const [idx, match] of matches.entries()) {
          const paramName = match.replace(/\{\{|\}\}/g, "")
          params.push({
            type: "body",
            index: idx,
            paramName,
          })
        }
      }
    } else if (component.type === "BUTTONS" && component.buttons) {
      for (const [buttonIdx, button] of component.buttons.entries()) {
        if (button.type === "URL" && button.url?.includes("{{1}}")) {
          params.push({
            type: "button",
            index: 0,
            paramName: "1",
            buttonIndex: buttonIdx,
          })
        }
      }
    }
  }

  return params
}
