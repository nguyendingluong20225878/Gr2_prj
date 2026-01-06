import { HumanMessage } from "@langchain/core/messages";

export const proposalGenerationPrompt: any = {
  name: "proposalGenerationPrompt",
  invoke: async (input: any) => {
    if (input?.messages) return input.messages;
    const text = typeof input?.inputText === "string" ? input.inputText : JSON.stringify(input);
    return [new HumanMessage(text)];
  },
};

export const parser: any = {
  name: "proposalParser",
  invoke: async (output: any) => {
    // Lấy nội dung text từ kết quả của Model
    const raw = output?.content ?? output?.text ?? (typeof output === "string" ? output : JSON.stringify(output));
    let str = String(raw).trim();

    // Xử lý loại bỏ các khối code Markdown nếu Model vô tình trả về
    if (str.includes("```")) {
      str = str.replace(/```json|```/g, "").trim();
    }

    try {
      return JSON.parse(str);
    } catch (e) {
      // Cố gắng tìm phần nằm trong dấu ngoặc nhọn nếu parse lỗi
      const m = str.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch (_) {}
      }
      console.error("[Parser Error] Model Output was not valid JSON:", str);
      throw new Error("proposal parser: failed to parse model output as JSON");
    }
  },
};