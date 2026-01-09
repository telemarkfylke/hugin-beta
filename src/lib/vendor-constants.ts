import type { VendorSupportedMessageMimeTypesMap } from "./types/AIVendor"

export const OPEN_AI_VENDOR_ID = "openai"

const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES = ["application/pdf"]
const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/bmp", "image/tiff", "image/heif"]

export const VENDOR_SUPPORTED_MESSAGE_MIME_TYPES: VendorSupportedMessageMimeTypesMap = {
  [`${OPEN_AI_VENDOR_ID}-gpt-4o`]: {
    file: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
    image: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
  },
  [`${OPEN_AI_VENDOR_ID}-gpt-4`]: {
    file: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
    image: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
  }
}

/*
Vi har en config med en vendorId (som vi vet) og en model (som vi ikke nødvendigvis vet noe om)

Hvis vi vi hardkoder inn en map/object med key som er {vendorId}-{model}, og hvis den finnes så kan vi la bruker laste opp filer med de mime typene som er i arrayet for den keyen. Hvis den ikke finnes, så kan vi ikke tillate noen fil opplastinger.
*/

