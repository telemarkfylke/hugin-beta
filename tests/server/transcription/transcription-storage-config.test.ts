import { beforeEach, describe, expect, it, vi } from "vitest"

const mockEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>)
vi.mock("$env/dynamic/private", () => ({ env: mockEnv }))

import { getTranscriptionStorage } from "$lib/server/transcription/transcription-storage"

const COMPLETE = { S3_ENDPOINT: "https://s3.ki.telemarkfylke.no", S3_ACCESS_KEY: "key", S3_SECRET_KEY: "secret", TRANSCRIPTION_S3_BUCKET: "hugin-transcription" }

beforeEach(() => {
	for (const name of Object.keys(mockEnv)) delete mockEnv[name]
})

describe("getTranscriptionStorage", () => {
	it("uses the shared S3 connection and its own bucket", () => {
		Object.assign(mockEnv, COMPLETE)
		expect(getTranscriptionStorage()).toEqual({ endpoint: "https://s3.ki.telemarkfylke.no", accessKey: "key", secretKey: "secret", region: "us-east-1", bucket: "hugin-transcription" })
	})

	it("is independent of the S3 POC flag and bucket", () => {
		Object.assign(mockEnv, COMPLETE, { S3_POC_ENABLED: "false", S3_BUCKET: "hugin-poc" })
		expect(getTranscriptionStorage()?.bucket).toBe("hugin-transcription")
	})

	it("is null without TRANSCRIPTION_S3_BUCKET", () => {
		Object.assign(mockEnv, COMPLETE, { TRANSCRIPTION_S3_BUCKET: " " })
		expect(getTranscriptionStorage()).toBeNull()
	})

	it("is null when the endpoint is not HTTPS", () => {
		Object.assign(mockEnv, COMPLETE, { S3_ENDPOINT: "http://10.201.82.131:9000" })
		expect(getTranscriptionStorage()).toBeNull()
	})
})
