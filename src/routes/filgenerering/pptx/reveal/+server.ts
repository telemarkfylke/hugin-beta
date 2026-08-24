import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export async function GET({ cookies }) {
    const userID = cookies.get('userID');
    if (!userID) {
        return new Response('userID mangler', { status: 400 });
    }
    let slidesPath = path.join(process.cwd(), 'src', 'routes', 'filgenerering', 'pptx', 'data', `${userID}.md`);
    if (!slidesPath){
        slidesPath = path.join(process.cwd(), 'src', 'routes', 'filgenerering', 'pptx', 'data', `introduction.md`);
    }
    const outputDir = path.join(process.cwd(), 'content', 'dist');
    const htmlPath = path.join(outputDir, `${userID}.html`);

    await fs.mkdir(outputDir, { recursive: true });

    await runPandoc([
        slidesPath,
        '-t',
        'revealjs',
        '-s',
        '-o',
        htmlPath,
        '--slide-level=2',
        '-V',
        'revealjs-url=https://unpkg.com/reveal.js@5',
        '-V',
        'theme=white',
        '-V',
        'transition=slide'
    ]);

    const html = await fs.readFile(htmlPath, 'utf-8');

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
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