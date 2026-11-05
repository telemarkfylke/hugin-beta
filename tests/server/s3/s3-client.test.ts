import { beforeEach, describe, expect, it, vi } from "vitest"

const mockEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>)
vi.mock("$env/dynamic/private", () => ({ env: mockEnv }))

import { getS3Connection } from "$lib/server/s3/s3-client"

const COMPLETE = {
	S3_ENDPOINT: "https://s3.ki.telemarkfylke.no/",
	S3_ACCESS_KEY: "key",
	S3_SECRET_KEY: "secret"
}

beforeEach(() => {
	for (const name of Object.keys(mockEnv)) delete mockEnv[name]
})

describe("getS3Connection", () => {
	it("returns the connection with the trailing slash trimmed and a default region", () => {
		Object.assign(mockEnv, COMPLETE)
		expect(getS3Connection()).toEqual({ endpoint: "https://s3.ki.telemarkfylke.no", accessKey: "key", secretKey: "secret", region: "us-east-1" })
	})

	it("uses S3_REGION when set", () => {
		Object.assign(mockEnv, COMPLETE, { S3_REGION: "eu-north-1" })
		expect(getS3Connection()?.region).toBe("eu-north-1")
	})

	// All traffic to S3 must be encrypted - there is deliberately no exception for localhost
	it.each(["http://10.201.82.131:9000", "http://localhost:9000", "HTTP://s3.test", "s3.ki.telemarkfylke.no", "ftp://s3.test"])("refuses the non-HTTPS endpoint %s", (endpoint) => {
		Object.assign(mockEnv, COMPLETE, { S3_ENDPOINT: endpoint })
		expect(getS3Connection()).toBeNull()
	})

	it.each(["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"])("is null when %s is missing", (name) => {
		Object.assign(mockEnv, COMPLETE, { [name]: undefined })
		expect(getS3Connection()).toBeNull()
	})
})
