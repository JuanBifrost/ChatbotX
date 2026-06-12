import type {
  SendImageStepSchema,
  SendVideoStepSchema,
} from "@chatbotx.io/flow-config"
import type { SendFlowStepProps } from "@chatbotx.io/sdk"
import { logger } from "../../../lib/logger"
import type { InstagramAuthValue } from "../../../schemas"
import { convertMediaType } from "./send-attachment"

export function* convertFlowStepMedia(
  props: SendFlowStepProps<
    InstagramAuthValue,
    SendImageStepSchema | SendVideoStepSchema
  >,
) {
  const {
    data: { step },
  } = props
  try {
    const media_type = convertMediaType(step.stepType)

    yield {
      attachments: [
        {
          type: media_type,
          payload: {
            url: step.url,
          },
        },
      ],
    }
  } catch (error) {
    logger.error(error, "Error uploading media")
  }
}
