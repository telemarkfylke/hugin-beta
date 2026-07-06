import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
    const filePath = path.join(process.cwd(), 'src', 'routes', 'filgenerering', 'pptx', 'content.md');
    const content = await fs.readFile(filePath, 'utf-8');
    return new Response(content, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}
