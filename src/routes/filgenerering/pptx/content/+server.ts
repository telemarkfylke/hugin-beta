import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET({ cookies }) {
    const userID = cookies.get('userID');
    if (!userID) {
        return new Response('userID mangler', { status: 400 });
    }

    let filePath = path.join(process.cwd(), 'src', 'routes', 'filgenerering', 'pptx', 'data', `${userID}.md`); // Stien til markdown-filen som pandoc leser fra
    if (!filePath) {
        filePath = path.join(process.cwd(), 'src', 'routes', 'filgenerering', 'pptx', 'data', `introduction.md`); // Stien til markdown-filen som pandoc leser fra
    }
    const content = await fs.readFile(filePath, 'utf-8');
    return new Response(content, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}