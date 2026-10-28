import { describe, expect, it } from "vitest"
import { ATTACHMENT_STRIP_MODE, attachmentId, exceedsAttachmentLimit, listConversationAttachments, MAX_ARMED_ATTACHMENTS, stripUnarmedAttachments } from "../../src/lib/chat-history"
import type { ChatInputItem } from "../../src/lib/types/chat-item"

const file = (name: string) => ({ type: "input_file", fileName: name, fileUrl: `data:application/pdf;base64,${name}` }) as const
const image = { type: "input_image", imageUrl: "data:image/png;base64,BBB" } as const
const answer = (id: string): ChatInputItem => ({ id, type: "message.output", role: "assistant", content: [{ type: "output_text", text: "svar" }] })
const user = (...content: Extract<ChatInputItem, { type: "message.input" }>["content"]): ChatInputItem => ({ type: "message.input", role: "user", content })
const text = (t: string) => ({ type: "input_text", text: t }) as const
const attachmentsIn = (inputs: ChatInputItem[]): string[] =>
	inputs.flatMap((item) => (item.type === "message.input" ? item.content.flatMap((c) => (c.type === "input_file" ? [c.fileName] : c.type === "input_image" ? ["image"] : [])) : []))

describe("stripUnarmedAttachments", () => {
	it.skipIf(ATTACHMENT_STRIP_MODE === "off")("keeps the newest message's attachments and replaces unarmed earlier ones with a note", async () => {
		const out = await stripUnarmedAttachments([user(text("les denne"), file("a.pdf")), answer("1"), user(image), answer("2"), user(text("og denne"), file("b.pdf"))])

		expect(attachmentsIn(out)).toEqual(["b.pdf"])
		expect(out[0]).toEqual(user(text("les denne"), text(expect.stringContaining("«a.pdf»"))))
		expect(out[2]).toEqual(user(text(expect.stringContaining("(bilde)"))))
		expect(out[1]).toEqual(answer("1"))
	})

	it.skipIf(ATTACHMENT_STRIP_MODE !== "armed")("keeps armed earlier attachments", async () => {
		const a = file("a.pdf")
		const out = await stripUnarmedAttachments([user(a), answer("1"), user(file("b.pdf")), answer("2"), user(text("spørsmål"))], [await attachmentId(a)])
		expect(attachmentsIn(out)).toEqual(["a.pdf"])
	})

	it.skipIf(ATTACHMENT_STRIP_MODE !== "armed")("caps armed attachments at MAX_ARMED_ATTACHMENTS, newest first, counting the new message's own", async () => {
		const earlier = Array.from({ length: MAX_ARMED_ATTACHMENTS + 2 }, (_, i) => file(`${i}.pdf`))
		const inputs = [...earlier.flatMap((f, i) => [user(f), answer(String(i))]), user(file("ny.pdf"))]
		const out = await stripUnarmedAttachments(inputs, await Promise.all(earlier.map(attachmentId)))

		const kept = attachmentsIn(out)
		expect(kept).toHaveLength(MAX_ARMED_ATTACHMENTS)
		expect(kept.at(-1)).toBe("ny.pdf")
		expect(kept).toContain(`${MAX_ARMED_ATTACHMENTS + 1}.pdf`)
		expect(kept).not.toContain("0.pdf")
	})

	it.skipIf(ATTACHMENT_STRIP_MODE === "off")("sends a file that appears several times only once", async () => {
		const a = file("a.pdf")
		const out = await stripUnarmedAttachments([user(a), answer("1"), user(text("igjen"), a)], [await attachmentId(a)])
		expect(attachmentsIn(out)).toEqual(["a.pdf"])
	})

	it("returns text-only history unchanged", async () => {
		const inputs: ChatInputItem[] = [user(text("hei")), answer("1")]
		expect(await stripUnarmedAttachments(inputs)).toEqual(inputs)
	})
})

describe("listConversationAttachments", () => {
	it("lists distinct attachments in order of first appearance", async () => {
		const list = await listConversationAttachments([user(file("a.pdf"), image), answer("1"), user(file("a.pdf"))])
		expect(list.map((a) => [a.kind, a.name])).toEqual([
			["file", "a.pdf"],
			["image", "Bilde 1"]
		])
		expect(list[0]?.id).toBe(await attachmentId(file("a.pdf")))
	})
})

describe("exceedsAttachmentLimit", () => {
	const newFiles = (n: number) => user(text("se på disse"), ...Array.from({ length: n }, (_, i) => file(`ny-${i}.pdf`)))

	it("allows up to MAX_ARMED_ATTACHMENTS new files with nothing armed", async () => {
		expect(await exceedsAttachmentLimit([newFiles(MAX_ARMED_ATTACHMENTS)], [])).toBe(false)
		expect(await exceedsAttachmentLimit([newFiles(MAX_ARMED_ATTACHMENTS + 1)], [])).toBe(true)
	})

	it("counts new files and re-armed earlier ones together", async () => {
		const earlier = [file("a.pdf"), file("b.pdf")]
		const armed = await Promise.all(earlier.map(attachmentId))
		const history = [user(...earlier), answer("1")]

		expect(await exceedsAttachmentLimit([...history, newFiles(MAX_ARMED_ATTACHMENTS - 2)], armed)).toBe(false)
		expect(await exceedsAttachmentLimit([...history, newFiles(MAX_ARMED_ATTACHMENTS - 1)], armed)).toBe(true)
	})

	it("doesn't count a new file twice when it's also listed as armed", async () => {
		const files = Array.from({ length: MAX_ARMED_ATTACHMENTS }, (_, i) => file(`ny-${i}.pdf`))
		const ids = await Promise.all(files.map(attachmentId))
		expect(await exceedsAttachmentLimit([user(...files)], ids)).toBe(false)
	})

	it("ignores a message with only text", async () => {
		expect(await exceedsAttachmentLimit([user(text("hei"))], [])).toBe(false)
	})
})
