import { PDFDocument, PDFImage, StandardFonts, rgb } from 'pdf-lib'
export enum ImageType { JPG = 'image/jpeg', PNG = 'image/png' }


export async function wrapInPdf(imageData: string, mimetype: ImageType): Promise<string> {
	const pdfDoc = await PDFDocument.create()
	let pdfImage: PDFImage;
	if (mimetype === ImageType.JPG) {
		pdfImage = await pdfDoc.embedJpg(imageData)
	}
	else if (mimetype === ImageType.PNG) {
		pdfImage = await pdfDoc.embedPng(imageData)
	}
	else{
		throw Error("Unsupported imageType") 
	}
	const page = pdfDoc.addPage([pdfImage.width, pdfImage.height])
	page.drawImage(pdfImage, { x: 0, y: 0 })	
	const data = await pdfDoc.saveAsBase64()
	return 'data:application/pdf;base64,'+data
}