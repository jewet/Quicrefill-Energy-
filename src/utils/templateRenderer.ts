
import Handlebars from "handlebars";
import { EmailTemplate, SMSTemplate, PushTemplate } from "@prisma/client";

export interface DynamicData {
  [key: string]: string | number | boolean;
}

export const renderTemplate = (
  template: EmailTemplate | SMSTemplate | PushTemplate,
  dynamicData: DynamicData,
  channel: "EMAIL" | "SMS" | "PUSH"
): { content: string; title?: string } => {
  try {
    let content = "";
    let title: string | undefined;

    if (channel === "EMAIL" && "htmlContent" in template) {
      const compiled = Handlebars.compile(template.htmlContent);
      content = compiled(dynamicData);
      title = template.subject;
    } else if (channel === "SMS" && "content" in template) {
      const compiled = Handlebars.compile(template.content);
      content = compiled(dynamicData);
    } else if (channel === "PUSH" && "title" in template && "body" in template) {
      const compiledTitle = Handlebars.compile(template.title);
      const compiledBody = Handlebars.compile(template.body);
      content = compiledBody(dynamicData);
      title = compiledTitle(dynamicData);
    } else {
      throw new Error(`No content defined for channel ${channel}`);
    }

    return { content, title };
  } catch (error) {
    throw new Error(`Template rendering failed: ${(error as Error).message}`);
  }
};