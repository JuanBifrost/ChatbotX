import nodemailer from "nodemailer"
import { keys } from "./keys"

export type SmtpTransportOptions = {
  host: string
  port: number
  username: string
  password: string
}

export const createSmtpTransporter = (options?: SmtpTransportOptions) => {
  const env = keys()

  return nodemailer.createTransport(
    options
      ? {
          host: options.host,
          port: options.port,
          secure: options.port === 465,
          auth: { user: options.username, pass: options.password },
        }
      : env.SMTP_SERVER,
  )
}
