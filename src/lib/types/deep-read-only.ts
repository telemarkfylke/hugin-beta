/**
 * Recursively makes all properties of an object type readonly.
 * @link https://www.geeksforgeeks.org/typescript/how-to-create-deep-readonly-type-in-typescript/
 */
export type DeepReadonly<T> = T extends (infer U)[]
	? ReadonlyArray<DeepReadonly<U>>
	: {
			readonly [K in keyof T]: T[K] extends object
				? DeepReadonly<T[K]>
				: // Recursively apply DeepReadonly for nested objects
					T[K]
			// Otherwise, keep the original type
		}
