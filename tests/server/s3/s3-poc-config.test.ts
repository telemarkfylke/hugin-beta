import { beforeEach, describe, expect, it, vi } from "vitest"

const mockEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>)
vi.mock("$env/dynamic/private", () => ({ env: mockEnv }))

import { getS3PocConfig } from "$lib/server/s3/s3-poc"

const COMPLETE = {
	S3_POC_ENABLED: "true",
	S3_ENDPOINT: "https://s3.ki.telemarkfylke.no/",
	S3_ACCESS_KEY: "key",
	S3_SECRET_KEY: "secret",
	S3_BUCKET: "hugin-poc"
}

beforeEach(() => {
	for (const name of Object.keys(mockEnv)) delete mockEnv[name]
})

describe("getS3PocConfig", () => {
	it("returns the config when the flag is on and everything is set", () => {
		Object.assign(mockEnv, COMPLETE)
		expect(getS3PocConfig()).toEqual({
			endpoint: "https://s3.ki.telemarkfylke.no",
			accessKey: "key",
			secretKey: "secret",
			bucket: "hugin-poc",
			region: "us-east-1",
			keyPrefix: "s3-poc"
		})
	})

	it("uses S3_REGION when set", () => {
		Object.assign(mockEnv, COMPLETE, { S3_REGION: "eu-north-1" })
		expect(getS3PocConfig()?.region).toBe("eu-north-1")
	})

	it.each([undefined, "", "false", "TRUE", "1"])("is off when S3_POC_ENABLED is %j", (value) => {
		Object.assign(mockEnv, COMPLETE, { S3_POC_ENABLED: value })
		expect(getS3PocConfig()).toBeNull()
	})

	it.each(["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"])("is off when %s is missing", (name) => {
		Object.assign(mockEnv, COMPLETE, { [name]: undefined })
		expect(getS3PocConfig()).toBeNull()
	})
})
