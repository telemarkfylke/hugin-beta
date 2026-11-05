import { describe, expect, it } from "vitest"
import { audioKey, docxKey, hasAcceptedAudioExtension, jobPrefix } from "$lib/server/transcription/transcription-keys"

const USER = "3656c983-c859-4a8e-9b2f-0123b2f8d7"
const JOB = "0b9e5c1e-1111-4222-8333-444455556666"

describe("transcription S3 keys", () => {
	it("keeps every file of a job under transcription/<userId>/<jobId>/", () => {
		expect(jobPrefix(USER, JOB)).toBe(`transcription/${USER}/${JOB}/`)
		expect(audioKey(USER, JOB, "møte 1.mp3")).toBe(`transcription/${USER}/${JOB}/audio/møte 1.mp3`)
		expect(docxKey(USER, JOB)).toBe(`transcription/${USER}/${JOB}/transkripsjon.docx`)
	})

	it.each([
		["a traversing user id", "..", JOB, "a.mp3"],
		["a user id with a slash", "a/b", JOB, "a.mp3"],
		["a traversing job id", USER, "..", "a.mp3"],
		["a file name with a slash", USER, JOB, "../../other/a.mp3"]
	])("refuses %s", (_label, userId, jobId, fileName) => {
		expect(() => audioKey(userId, jobId, fileName)).toThrow()
	})
})

describe("hasAcceptedAudioExtension", () => {
	it.each(["a.mp3", "B.WAV", "møte.m4a", "film.mkv"])("accepts %s", (name) => {
		expect(hasAcceptedAudioExtension(name)).toBe(true)
	})
	it.each(["notes.txt", "a.mp3.exe", "mp3"])("rejects %s", (name) => {
		expect(hasAcceptedAudioExtension(name)).toBe(false)
	})
})
