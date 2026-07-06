import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolve } from 'node:dns';
import { rejects } from 'node:assert';

export async function GET() {
    const slidesPath = path.join(process.cwd(), 'src', 'routes', 'filgenerering', 'pptx', 'content.md'); // siten for .md fila for presangtasjonen
    const pptxPath = path.join(process.cwd(), "content", "dist", "presentation.pptx"); // for hvor pptx fila skal lagres

    // Skjekk om slides.md finnes
    if (!slidesPath) {
        return new Response('slides.md ikke funnet', {
            status: 404
        });
        
    }

    // Oppretter output-mappa for å søgre for at den finnes
    const templatePath = path.join(process.cwd(), 'Template.pptx');
    // kjører pandoc som henter 
    await runPandoc([
        slidesPath,
        "-o",
        pptxPath,
        `--reference-doc=${templatePath}`
    ]);
    // leser inn pptx fila og sender den som nedlastning
    const donwloand_file = await fs.readFile(pptxPath);

    // returnerer pptx fila som en nedlastning med riktig content-type og content-disposition header
    return new Response(donwloand_file, {
        headers: {
            'Content-Type':
				'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'Content-Disposition': 'attachment; filename="presentation.pptx"'
        }
    });
}


function runPandoc(args: string[]) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn('pandoc', args, {
			shell: false
		});

		let stderr = '';

		child.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		child.on('close', (code) => {
			if (code === 0) resolve();
			else reject(new Error(stderr || `Pandoc feilet med kode ${code}`));
		});
	});
}